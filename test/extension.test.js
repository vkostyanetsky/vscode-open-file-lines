'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { createDocument, loadExtension } = require('./vscode-stub');

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'open-file-lines-ext-')));
const targetLines = [];
for (let i = 1; i <= 600; i += 1) targetLines.push('Line ' + i + ' of e03.md');

fs.mkdirSync(path.join(root, 'episodes'), { recursive: true });
fs.writeFileSync(path.join(root, 'episodes', 'e03.md'), targetLines.join('\n') + '\n');

const TARGET = path.join(root, 'episodes', 'e03.md');
const NOTES = path.join(root, 'notes.md');
fs.writeFileSync(NOTES, 'placeholder\n');

/**
 * Runs the Alt+P command with `line` as the current line and the cursor at
 * `character`, then reports what the extension did.
 *
 * @param {string} line
 * @param {number} character
 * @param {object} [options]
 */
async function pressAltP(line, character, options = {}) {
  const { stub } = loadExtension();

  const notes = createDocument(NOTES, [line]);
  const target = createDocument(TARGET, targetLines);

  stub.__documents[path.normalize(TARGET)] = target;
  stub.__settings = Object.assign({ selectLines: true, preview: false }, options.settings);
  stub.workspace.workspaceFolders = [{ uri: { fsPath: root } }];

  const cursor = new stub.Position(0, character);
  stub.window.activeTextEditor = {
    document: notes,
    selection: options.selection
      ? new stub.Selection(
          new stub.Position(0, options.selection[0]),
          new stub.Position(0, options.selection[1])
        )
      : new stub.Selection(cursor, cursor),
  };

  await stub.__handlers[options.command || 'openFileLines.open']();

  const shown = stub.__calls.shown[0];
  return {
    stub,
    calls: stub.__calls,
    openedPath: shown ? shown.document.uri.fsPath : undefined,
    // What the editor actually ended up with — the assertion that matters.
    selection: shown ? shown.editor.selection : undefined,
    optionSelection: shown ? shown.options.selection : undefined,
    viewColumn: shown ? shown.options.viewColumn : undefined,
    preview: shown ? shown.options.preview : undefined,
    beside: stub.ViewColumn.Beside,
  };
}

/** @returns {[number, number, number, number]} start/end line and character, 0-based */
function asTuple(selection) {
  return [selection.start.line, selection.start.character, selection.end.line, selection.end.character];
}

test('a plain reference opens the file and selects nothing', async () => {
  const result = await pressAltP('see episodes/e03.md for the details', 10);
  assert.equal(result.openedPath, TARGET);
  assert.equal(result.optionSelection, undefined);
  // The editor keeps whatever position it had; nothing is moved or revealed.
  assert.deepEqual(asTuple(result.selection), [0, 0, 0, 0]);
  assert.equal(result.calls.revealed.length, 0);
});

test('a single line reference selects that whole line', async () => {
  const result = await pressAltP('see episodes/e03.md:300 for the details', 10);
  assert.equal(result.openedPath, TARGET);
  // Line 300 is index 299, selected from column 0 to the end of its text.
  assert.deepEqual(asTuple(result.selection), [299, 0, 299, targetLines[299].length]);
  assert.equal(result.calls.revealed.length, 1);
});

test('a range reference selects from the first line to the end of the last', async () => {
  const result = await pressAltP('see episodes/e03.md:494-586 for the details', 10);
  assert.deepEqual(asTuple(result.selection), [493, 0, 585, targetLines[585].length]);
  // The start of the range, not its end, is what gets scrolled into view.
  assert.equal(result.calls.revealed[0].range.start.line, 493);
});

test('the selection is set on the editor, not only passed in the show options', async () => {
  // The stub hands back an editor parked at 0:0, the way VSCode does when it
  // restores a remembered position over options.selection.
  const result = await pressAltP('episodes/e03.md:494-586', 3);
  assert.deepEqual(asTuple(result.optionSelection), [493, 0, 585, targetLines[585].length]);
  assert.deepEqual(asTuple(result.selection), [493, 0, 585, targetLines[585].length]);
});

test('backticks and quotes around the reference change nothing', async () => {
  for (const wrapper of ['`', "'", '"']) {
    const line = 'see ' + wrapper + 'episodes/e03.md:494-586' + wrapper + ' for the details';
    const result = await pressAltP(line, line.indexOf('e03'));
    assert.equal(result.openedPath, TARGET, wrapper);
    assert.deepEqual(asTuple(result.selection), [493, 0, 585, targetLines[585].length], wrapper);
  }
});

test('a hand-made selection is used as the reference', async () => {
  const line = 'x `episodes/e03.md:300` y';
  const result = await pressAltP(line, 0, { selection: [2, line.indexOf('` y') + 1] });
  assert.equal(result.openedPath, TARGET);
  assert.deepEqual(asTuple(result.selection), [299, 0, 299, targetLines[299].length]);
});

test('line and column places the cursor without selecting', async () => {
  const result = await pressAltP('episodes/e03.md:300:12', 3);
  assert.deepEqual(asTuple(result.selection), [299, 11, 299, 11]);
});

test('out of range lines are clamped to the last line', async () => {
  const result = await pressAltP('episodes/e03.md:9000-9100', 3);
  assert.deepEqual(asTuple(result.selection), [599, 0, 599, targetLines[599].length]);
});

test('selectLines: false only moves the cursor', async () => {
  const result = await pressAltP('episodes/e03.md:494-586', 3, { settings: { selectLines: false } });
  assert.deepEqual(asTuple(result.selection), [493, 0, 493, 0]);
});

test('preview: true is passed through to showTextDocument', async () => {
  const result = await pressAltP('episodes/e03.md:300', 3, { settings: { preview: true } });
  assert.equal(result.preview, true);
});

test('the side command opens beside the current group', async () => {
  const result = await pressAltP('episodes/e03.md:300', 3, { command: 'openFileLines.openToSide' });
  assert.equal(result.viewColumn, result.beside);
});

test('a folder reference is revealed in the explorer', async () => {
  const result = await pressAltP('see episodes for the details', 6);
  assert.equal(result.openedPath, undefined);
  assert.deepEqual(
    result.calls.executedCommands.map((call) => call.id),
    ['revealInExplorer']
  );
});

test('a url is handed to the browser', async () => {
  const result = await pressAltP('see https://example.com/a:300 now', 10);
  assert.deepEqual(result.calls.external, ['https://example.com/a:300']);
  assert.equal(result.openedPath, undefined);
});

test('a missing file warns and offers the searched paths', async () => {
  const result = await pressAltP('episodes/e99.md:1-5', 3);
  assert.equal(result.openedPath, undefined);
  assert.equal(result.calls.warnings.length, 1);
  assert.match(result.calls.warnings[0].message, /cannot find "episodes\/e99\.md"/);
  assert.deepEqual(result.calls.warnings[0].items, ['Show searched paths']);
});

test('the log channel is created once and reused', async () => {
  const result = await pressAltP('episodes/e03.md:300', 3);
  await result.stub.__handlers['openFileLines.open']();
  await result.stub.__handlers['openFileLines.showLog']();
  assert.equal(result.calls.channelsCreated, 1);
  assert.ok(result.calls.output.some((line) => /selected lines 300-300/.test(line)));
});

test('an empty spot warns without opening anything', async () => {
  const result = await pressAltP('   ', 1);
  assert.equal(result.openedPath, undefined);
  assert.match(result.calls.warnings[0].message, /no path found/);
});

test.after(() => fs.rmSync(root, { recursive: true, force: true }));
