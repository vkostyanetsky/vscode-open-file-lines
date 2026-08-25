'use strict';

const assert = require('node:assert/strict');
const { test } = require('node:test');

const { extractToken, parseTarget, trimToken, urlScheme } = require('../src/parse');

/** Extracts the token from a line marked with `|` at the cursor position. */
function tokenAt(marked) {
  const character = marked.indexOf('|');
  assert.ok(character !== -1, 'the fixture must contain a | cursor marker');
  return extractToken(marked.replace('|', ''), character);
}

test('the three shapes from the spec', () => {
  assert.deepEqual(parseTarget('episodes/e03.md'), { path: 'episodes/e03.md' });
  assert.deepEqual(parseTarget('episodes/e03.md:300'), { path: 'episodes/e03.md', line: 300 });
  assert.deepEqual(parseTarget('episodes/e03.md:494-586'), {
    path: 'episodes/e03.md',
    line: 494,
    endLine: 586,
  });
});

test('apostrophes and backticks are stripped', () => {
  for (const wrapper of ['`', "'", '"']) {
    const token = tokenAt('see ' + wrapper + 'episodes/e0|3.md:494-586' + wrapper + ' for details');
    assert.equal(token, 'episodes/e03.md:494-586');
    assert.deepEqual(parseTarget(token), { path: 'episodes/e03.md', line: 494, endLine: 586 });
  }
});

test('a bare link in prose is found from anywhere inside it', () => {
  const line = 'open episodes/e03.md:300 now';
  const from = line.indexOf('episodes');
  const to = line.indexOf(':300') + 4;
  for (let character = from; character <= to; character += 1) {
    assert.equal(extractToken(line, character), 'episodes/e03.md:300', 'at ' + character);
  }
});

test('cursor just past the token, and at the end of the line', () => {
  assert.equal(tokenAt('episodes/e03.md:300| rest'), 'episodes/e03.md:300');
  assert.equal(extractToken('episodes/e03.md:300', 19), 'episodes/e03.md:300');
});

test('cursor on a delimiter or in empty space yields nothing', () => {
  assert.equal(extractToken('   ', 1), '');
  assert.equal(extractToken('a.md , b.md', 5), '');
});

test('sentence punctuation is not part of the path', () => {
  assert.equal(tokenAt('read episodes/e0|3.md:300.'), 'episodes/e03.md:300');
  assert.equal(tokenAt('read episodes/e0|3.md:300, then stop'), 'episodes/e03.md:300');
  assert.equal(tokenAt('(see episodes/e0|3.md:494-586)'), 'episodes/e03.md:494-586');
});

test('markdown link targets', () => {
  assert.equal(tokenAt('[episode 3](episodes/e0|3.md:494-586)'), 'episodes/e03.md:494-586');
  assert.equal(tokenAt('<episodes/e0|3.md:300>'), 'episodes/e03.md:300');
});

test('github style anchors', () => {
  assert.deepEqual(parseTarget('episodes/e03.md#L494-L586'), {
    path: 'episodes/e03.md',
    line: 494,
    endLine: 586,
  });
  assert.deepEqual(parseTarget('episodes/e03.md#300'), { path: 'episodes/e03.md', line: 300 });
});

test('line and column form', () => {
  assert.deepEqual(parseTarget('src/a.ts:300:12'), { path: 'src/a.ts', line: 300, column: 12 });
});

test('windows absolute paths keep their drive letter', () => {
  assert.deepEqual(parseTarget('D:\\Me\\notes\\e03.md:494-586'), {
    path: 'D:\\Me\\notes\\e03.md',
    line: 494,
    endLine: 586,
  });
  assert.deepEqual(parseTarget('D:\\Me\\notes\\e03.md'), { path: 'D:\\Me\\notes\\e03.md' });
});

test('a backwards range is normalised', () => {
  assert.deepEqual(parseTarget('a.md:586-494'), { path: 'a.md', line: 494, endLine: 586 });
});

test('zero and garbage positions are ignored, path is kept intact', () => {
  assert.deepEqual(parseTarget('a.md:0'), { path: 'a.md' });
  assert.deepEqual(parseTarget('a.md:'), { path: 'a.md' });
  assert.deepEqual(parseTarget('e03.md'), { path: 'e03.md' });
});

test('numeric file names are not mistaken for positions', () => {
  assert.deepEqual(parseTarget('notes/2024.md'), { path: 'notes/2024.md' });
  assert.deepEqual(parseTarget('notes/2024'), { path: 'notes/2024' });
});

test('urls are passed through untouched', () => {
  assert.deepEqual(parseTarget('https://example.com/a:300'), { path: 'https://example.com/a:300' });
  assert.equal(urlScheme('https://example.com'), 'https');
  assert.equal(urlScheme('episodes/e03.md'), undefined);
});

test('trimToken handles hand-made selections', () => {
  assert.equal(trimToken('  `episodes/e03.md:300`  '), 'episodes/e03.md:300');
  assert.equal(trimToken('"episodes/e03.md"'), 'episodes/e03.md');
  assert.equal(trimToken('./episodes/e03.md'), './episodes/e03.md');
});

test('variable references survive tokenisation', () => {
  assert.equal(
    tokenAt('${workspaceFolder}/episo|des/e03.md:300'),
    '${workspaceFolder}/episodes/e03.md:300'
  );
  assert.equal(tokenAt('~/notes/e0|3.md:12-15'), '~/notes/e03.md:12-15');
});
