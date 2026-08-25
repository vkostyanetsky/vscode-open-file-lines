'use strict';

const path = require('path');
const vscode = require('vscode');

const { DEFAULT_DELIMITERS, extractToken, trimToken, parseTarget, urlScheme } = require('./src/parse');
const { DEFAULT_EXTENSIONS, candidates, resolvePath } = require('./src/resolve');

const CONFIG_SECTION = 'openFileLines';

/** @type {vscode.OutputChannel|undefined} Created on first use, disposed on deactivate. */
let outputChannel;

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {
  context.subscriptions.push(
    vscode.commands.registerCommand('openFileLines.open', () => openLink({ beside: false })),
    vscode.commands.registerCommand('openFileLines.openToSide', () => openLink({ beside: true })),
    vscode.commands.registerCommand('openFileLines.showLog', () => channel().show(true))
  );
}

function deactivate() {
  if (outputChannel) outputChannel.dispose();
  outputChannel = undefined;
}

/**
 * @param {{beside: boolean}} options
 */
async function openLink(options) {
  const editor = vscode.window.activeTextEditor;
  if (!editor) {
    vscode.window.showWarningMessage('Open File Lines: no active editor.');
    return;
  }

  const config = vscode.workspace.getConfiguration(CONFIG_SECTION);
  const token = tokenAtCursor(editor, config);
  log('token: ' + JSON.stringify(token));

  if (!token) {
    vscode.window.showWarningMessage('Open File Lines: no path found at the cursor.');
    return;
  }

  const target = parseTarget(token);
  log('target: ' + JSON.stringify(target));

  if (!target.path) {
    vscode.window.showWarningMessage(`Open File Lines: "${token}" is not a path.`);
    return;
  }

  const scheme = urlScheme(target.path);
  if (scheme === 'http' || scheme === 'https') {
    await vscode.env.openExternal(vscode.Uri.parse(target.path));
    return;
  }

  const context = resolveContext(editor, config);
  const found = resolvePath(target.path, context);
  log('resolved: ' + JSON.stringify(found));

  if (!found) {
    await reportNotFound(target.path, context);
    return;
  }

  const uri = vscode.Uri.file(found.path);

  if (found.isDirectory) {
    await vscode.commands.executeCommand('revealInExplorer', uri);
    return;
  }

  await revealFile(uri, target, config, options.beside);
}

/**
 * Selection wins when the user highlighted something on purpose; otherwise the
 * token is grown out of the line around the cursor.
 *
 * @param {vscode.TextEditor} editor
 * @param {vscode.WorkspaceConfiguration} config
 * @returns {string}
 */
function tokenAtCursor(editor, config) {
  const selection = editor.selection;
  if (!selection.isEmpty && selection.isSingleLine) {
    const selected = trimToken(editor.document.getText(selection));
    if (selected) return selected;
  }

  const position = selection.active;
  const lineText = editor.document.lineAt(position.line).text;
  const delimiters = delimitersFrom(config);

  const token = extractToken(lineText, position.character, delimiters);
  if (token) return token;

  // Cursor in whitespace: fall back to the nearest token to its left.
  let probe = position.character - 1;
  while (probe >= 0 && delimiters.indexOf(lineText[probe]) !== -1) probe -= 1;
  return probe >= 0 ? extractToken(lineText, probe, delimiters) : '';
}

/**
 * @param {vscode.WorkspaceConfiguration} config
 * @returns {string}
 */
function delimitersFrom(config) {
  const configured = config.get('delimiters');
  return typeof configured === 'string' && configured.length > 0 ? configured : DEFAULT_DELIMITERS;
}

/**
 * @param {vscode.TextEditor} editor
 * @param {vscode.WorkspaceConfiguration} config
 * @returns {import('./src/resolve').ResolveContext}
 */
function resolveContext(editor, config) {
  const document = editor.document;
  const workspaceFolders = (vscode.workspace.workspaceFolders || []).map((folder) => folder.uri.fsPath);

  const currentDir = document.uri.scheme === 'file' ? path.dirname(document.uri.fsPath) : undefined;

  // Keep the folder owning the current file first, it is the most likely root.
  const owner = currentDir
    ? workspaceFolders.find((folder) => isInside(folder, currentDir))
    : undefined;
  const orderedFolders = owner
    ? [owner].concat(workspaceFolders.filter((folder) => folder !== owner))
    : workspaceFolders;

  return {
    currentDir,
    workspaceFolders: orderedFolders,
    searchPaths: asStringArray(config.get('searchPaths')),
    extensions: asStringArray(config.get('extensions'), DEFAULT_EXTENSIONS),
  };
}

/**
 * @param {vscode.Uri} uri
 * @param {{line?: number, endLine?: number, column?: number}} target
 * @param {vscode.WorkspaceConfiguration} config
 * @param {boolean} beside
 */
async function revealFile(uri, target, config, beside) {
  const document = await vscode.workspace.openTextDocument(uri);
  const selection = selectionFor(document, target, config);

  /** @type {vscode.TextDocumentShowOptions} */
  const showOptions = {
    preview: config.get('preview') === true,
    viewColumn: beside ? vscode.ViewColumn.Beside : vscode.ViewColumn.Active,
  };
  if (selection) showOptions.selection = selection;

  const editor = await vscode.window.showTextDocument(document, showOptions);
  if (!selection) return;

  // The selection passed through showOptions is not enough on its own: when the
  // document is already open, VSCode restores that editor's remembered cursor
  // position and wins. Assigning it here happens after that restore.
  editor.selection = selection;
  editor.revealRange(
    // Reveal the first line of the range rather than its end.
    new vscode.Range(selection.start, selection.start),
    vscode.TextEditorRevealType.InCenterIfOutsideViewport
  );

  log(
    'selected lines ' +
      (selection.start.line + 1) +
      '-' +
      (selection.end.line + 1) +
      ' in ' +
      uri.fsPath
  );
}

/**
 * @param {vscode.TextDocument} document
 * @param {{line?: number, endLine?: number, column?: number}} target
 * @param {vscode.WorkspaceConfiguration} config
 * @returns {vscode.Selection|undefined}
 */
function selectionFor(document, target, config) {
  if (target.line === undefined) return undefined;

  const lastLine = Math.max(0, document.lineCount - 1);
  const startLine = clamp(target.line - 1, 0, lastLine);

  if (target.column !== undefined) {
    const startText = document.lineAt(startLine).text;
    const column = clamp(target.column - 1, 0, startText.length);
    const position = new vscode.Position(startLine, column);
    return new vscode.Selection(position, position);
  }

  if (config.get('selectLines') === false) {
    const position = new vscode.Position(startLine, 0);
    return new vscode.Selection(position, position);
  }

  const endLine = clamp((target.endLine === undefined ? target.line : target.endLine) - 1, startLine, lastLine);
  const endCharacter = document.lineAt(endLine).text.length;

  return new vscode.Selection(new vscode.Position(startLine, 0), new vscode.Position(endLine, endCharacter));
}

/**
 * @param {string} rawPath
 * @param {import('./src/resolve').ResolveContext} context
 */
async function reportNotFound(rawPath, context) {
  const tried = candidates(rawPath, context);

  log(`cannot find "${rawPath}". Tried:`);
  for (const candidate of tried) log('  ' + candidate);

  const choice = await vscode.window.showWarningMessage(
    `Open File Lines: cannot find "${rawPath}".`,
    ...(tried.length > 0 ? ['Show searched paths'] : [])
  );

  if (choice === 'Show searched paths') channel().show(true);
}

/** @returns {vscode.OutputChannel} the single, lazily created channel */
function channel() {
  if (!outputChannel) outputChannel = vscode.window.createOutputChannel('Open File Lines');
  return outputChannel;
}

function log(message) {
  channel().appendLine(message);
}

function isInside(folder, target) {
  const relative = path.relative(folder, target);
  return relative === '' || (!relative.startsWith('..') && !path.isAbsolute(relative));
}

function asStringArray(value, fallback) {
  // An explicit empty array is meaningful (e.g. "never guess extensions"), so
  // only a missing/invalid setting falls back to the default.
  if (!Array.isArray(value)) return fallback;
  return value.filter((item) => typeof item === 'string' && item.trim().length > 0);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(value, max));
}

module.exports = { activate, deactivate };
