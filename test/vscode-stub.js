'use strict';

const Module = require('node:module');
const path = require('node:path');

/**
 * A minimal stand-in for the `vscode` module, enough to drive extension.js from
 * plain node. Only the API surface the extension actually touches is here.
 */
function createStub(overrides = {}) {
  class Position {
    constructor(line, character) {
      this.line = line;
      this.character = character;
    }
  }

  class Range {
    constructor(start, end) {
      this.start = start;
      this.end = end;
    }
  }

  class Selection extends Range {
    constructor(anchor, active) {
      super(anchor, active);
      this.anchor = anchor;
      this.active = active;
    }
    get isEmpty() {
      return this.anchor.line === this.active.line && this.anchor.character === this.active.character;
    }
    get isSingleLine() {
      return this.anchor.line === this.active.line;
    }
  }

  const calls = {
    shown: [],
    revealed: [],
    warnings: [],
    executedCommands: [],
    external: [],
    output: [],
    channelsCreated: 0,
  };

  const stub = {
    Position,
    Range,
    Selection,
    ViewColumn: { Active: -1, Beside: -2 },
    TextEditorRevealType: { InCenterIfOutsideViewport: 2 },
    Uri: {
      file: (fsPath) => ({ scheme: 'file', fsPath: path.normalize(fsPath), toString: () => fsPath }),
      parse: (value) => ({ scheme: String(value).split(':')[0], toString: () => value }),
    },
    commands: {
      registerCommand: (id, handler) => {
        stub.__handlers[id] = handler;
        return { dispose() {} };
      },
      executeCommand: async (id, ...args) => {
        calls.executedCommands.push({ id, args });
      },
    },
    env: {
      openExternal: async (uri) => {
        calls.external.push(uri.toString());
        return true;
      },
    },
    window: {
      activeTextEditor: undefined,
      showTextDocument: async (document, options) => {
        const editor = {
          document,
          // Mirrors the real world: the editor comes back sitting at whatever
          // position VSCode remembered for this file, regardless of what was
          // passed in options.selection. The extension has to set it itself.
          selection: new Selection(new Position(0, 0), new Position(0, 0)),
          revealRange: (range, type) => calls.revealed.push({ range, type }),
        };
        calls.shown.push({ document, options, editor });
        return editor;
      },
      showWarningMessage: async (message, ...items) => {
        calls.warnings.push({ message, items });
        return undefined;
      },
      createOutputChannel: () => {
        calls.channelsCreated += 1;
        return {
          appendLine: (line) => calls.output.push(line),
          show() {},
          dispose() {},
        };
      },
    },
    workspace: {
      workspaceFolders: [],
      getConfiguration: () => ({ get: (key) => stub.__settings[key] }),
      openTextDocument: async (uri) => stub.__documents[path.normalize(uri.fsPath)],
    },
    __handlers: {},
    __settings: {},
    __documents: {},
    __calls: calls,
  };

  return Object.assign(stub, overrides);
}

/**
 * Loads extension.js with `require('vscode')` pointing at the stub.
 *
 * @returns {{stub: object, extension: object, restore: function}}
 */
function loadExtension() {
  const stub = createStub();
  const originalLoad = Module._load;

  Module._load = function (request, parent, isMain) {
    if (request === 'vscode') return stub;
    return originalLoad.apply(this, [request, parent, isMain]);
  };

  const extensionPath = require.resolve('../extension.js');
  delete require.cache[extensionPath];

  let extension;
  try {
    extension = require(extensionPath);
    extension.activate({ subscriptions: [] });
  } finally {
    Module._load = originalLoad;
    delete require.cache[extensionPath];
  }

  return { stub, extension };
}

/**
 * Builds a fake TextDocument.
 *
 * @param {string} fsPath
 * @param {string[]} lines
 */
function createDocument(fsPath, lines) {
  return {
    uri: { scheme: 'file', fsPath: path.normalize(fsPath) },
    lineCount: lines.length,
    lineAt: (line) => ({ text: lines[line] === undefined ? '' : lines[line] }),
    getText: (selection) => {
      if (!selection) return lines.join('\n');
      const text = lines[selection.start.line] || '';
      return text.slice(selection.start.character, selection.end.character);
    },
  };
}

module.exports = { createDocument, createStub, loadExtension };
