'use strict';

const fs = require('fs');
const os = require('os');
const path = require('path');
const { fileURLToPath } = require('url');

/**
 * Turns a raw path from a link into an existing file (or folder) on disk.
 * No `vscode` dependency here either, so it stays testable.
 */

/** Extensions appended when the link has no usable one of its own. */
const DEFAULT_EXTENSIONS = ['.md', '.txt', '.ts', '.js', '.json'];

const WINDOWS_DRIVE_RE = /^[a-zA-Z]:[\\/]/;
const TRAILING_SEPARATOR_RE = /(.)[\\/]+$/;

/**
 * @typedef {object} ResolveContext
 * @property {string} [currentDir]        folder of the file the link lives in
 * @property {string[]} [workspaceFolders]
 * @property {string[]} [searchPaths]     extra lookup roots, absolute or relative
 * @property {string[]} [extensions]
 * @property {string} [homeDir]
 */

/**
 * @param {string} rawPath
 * @param {ResolveContext} [context]
 * @returns {{path: string, isDirectory: boolean}|undefined}
 */
function resolvePath(rawPath, context = {}) {
  for (const candidate of candidates(rawPath, context)) {
    const stat = statOrUndefined(candidate);
    if (!stat) continue;
    if (stat.isFile() || stat.isDirectory()) {
      return { path: path.normalize(candidate), isDirectory: stat.isDirectory() };
    }
  }
  return undefined;
}

/**
 * Every location that will be probed, in priority order. Exported for tests and
 * for the "not found" diagnostics.
 *
 * @param {string} rawPath
 * @param {ResolveContext} [context]
 * @returns {string[]}
 */
function candidates(rawPath, context = {}) {
  const workspaceFolders = context.workspaceFolders || [];
  const extensions = context.extensions || DEFAULT_EXTENSIONS;
  const homeDir = context.homeDir || os.homedir();

  const cleaned = expandVariables(rawPath, workspaceFolders[0], homeDir);
  if (!cleaned) return [];

  const bases = [];
  if (isAbsolute(cleaned)) {
    push(bases, cleaned);
  } else {
    for (const root of searchRoots(context, workspaceFolders, homeDir)) {
      push(bases, path.resolve(root, cleaned));
    }
  }

  const result = [];
  for (const base of bases) {
    push(result, base);
    if (!path.extname(base)) {
      for (const extension of extensions) {
        push(result, base + (extension.startsWith('.') ? extension : '.' + extension));
      }
    }
  }
  return result;
}

function searchRoots(context, workspaceFolders, homeDir) {
  const roots = [];

  if (context.currentDir) push(roots, context.currentDir);
  for (const folder of workspaceFolders) push(roots, folder);

  for (const entry of context.searchPaths || []) {
    const expanded = expandVariables(entry, workspaceFolders[0], homeDir);
    if (!expanded) continue;

    if (isAbsolute(expanded)) {
      push(roots, expanded);
      continue;
    }
    // A relative search path is relative to each root we already know about.
    if (context.currentDir) push(roots, path.resolve(context.currentDir, expanded));
    for (const folder of workspaceFolders) push(roots, path.resolve(folder, expanded));
  }

  return roots;
}

/**
 * Expands `file://`, `~`, `${workspaceFolder}`, `${userHome}` and `%VAR%`.
 *
 * @param {string} rawPath
 * @param {string} [workspaceFolder]
 * @param {string} [homeDir]
 * @returns {string}
 */
function expandVariables(rawPath, workspaceFolder, homeDir) {
  let value = String(rawPath == null ? '' : rawPath).trim();
  if (!value) return '';

  if (/^file:\/\//i.test(value)) {
    try {
      value = fileURLToPath(value);
    } catch (error) {
      value = decodeURIComponent(value.replace(/^file:\/\//i, ''));
    }
  }

  const home = homeDir || os.homedir();

  value = value.replace(/\$\{userHome\}/g, home);
  value = value.replace(/\$\{(?:workspaceFolder|workspaceRoot)\}/g, workspaceFolder || '');
  value = value.replace(/%([A-Za-z_][A-Za-z0-9_]*)%/g, (match, name) =>
    process.env[name] !== undefined ? process.env[name] : match
  );

  if (value === '~') value = home;
  else if (/^~[\\/]/.test(value)) value = path.join(home, value.slice(2));

  // A single leading separator on Windows ("/src/a.md" pasted from a POSIX box)
  // is treated as workspace-relative rather than as the drive root.
  if (process.platform === 'win32' && /^[\\/](?![\\/])/.test(value) && workspaceFolder) {
    value = path.join(workspaceFolder, value.slice(1));
  }

  // Drop a trailing separator, but never turn "/" or "C:\" into an empty string.
  return value.replace(TRAILING_SEPARATOR_RE, '$1');
}

function isAbsolute(value) {
  return path.isAbsolute(value) || WINDOWS_DRIVE_RE.test(value);
}

function statOrUndefined(candidate) {
  try {
    return fs.statSync(candidate);
  } catch (error) {
    return undefined;
  }
}

function push(list, value) {
  if (value && list.indexOf(value) === -1) list.push(value);
}

module.exports = {
  DEFAULT_EXTENSIONS,
  candidates,
  expandVariables,
  resolvePath,
};
