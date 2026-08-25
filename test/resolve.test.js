'use strict';

const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { test } = require('node:test');

const { candidates, expandVariables, resolvePath } = require('../src/resolve');

const root = fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), 'open-file-lines-')));
fs.mkdirSync(path.join(root, 'episodes'), { recursive: true });
fs.mkdirSync(path.join(root, 'docs', 'nested'), { recursive: true });
fs.writeFileSync(path.join(root, 'episodes', 'e03.md'), 'line 1\nline 2\n');
fs.writeFileSync(path.join(root, 'docs', 'nested', 'sibling.md'), 'x\n');
fs.writeFileSync(path.join(root, 'docs', 'guide.md'), 'x\n');

const context = { currentDir: path.join(root, 'docs', 'nested'), workspaceFolders: [root] };

test('workspace relative link', () => {
  const found = resolvePath('episodes/e03.md', context);
  assert.deepEqual(found, { path: path.join(root, 'episodes', 'e03.md'), isDirectory: false });
});

test('the current file folder wins over the workspace root', () => {
  const found = resolvePath('sibling.md', context);
  assert.equal(found.path, path.join(root, 'docs', 'nested', 'sibling.md'));
});

test('relative walk up', () => {
  const found = resolvePath('../guide.md', context);
  assert.equal(found.path, path.join(root, 'docs', 'guide.md'));
});

test('absolute path', () => {
  const target = path.join(root, 'episodes', 'e03.md');
  assert.equal(resolvePath(target, context).path, target);
});

test('missing extension is guessed', () => {
  const found = resolvePath('episodes/e03', context);
  assert.equal(found.path, path.join(root, 'episodes', 'e03.md'));

  const noGuessing = Object.assign({}, context, { extensions: [] });
  assert.equal(resolvePath('episodes/e03', noGuessing), undefined);
});

test('folders are reported as folders', () => {
  const found = resolvePath('episodes', context);
  assert.deepEqual(found, { path: path.join(root, 'episodes'), isDirectory: true });
});

test('extra search paths', () => {
  const bare = { currentDir: root, workspaceFolders: [root] };
  assert.equal(resolvePath('e03.md', bare), undefined);

  const withSearchPath = Object.assign({}, bare, { searchPaths: ['episodes'] });
  assert.equal(resolvePath('e03.md', withSearchPath).path, path.join(root, 'episodes', 'e03.md'));
});

test('unknown path resolves to undefined but still lists candidates', () => {
  assert.equal(resolvePath('episodes/nope.md', context), undefined);
  assert.ok(candidates('episodes/nope.md', context).length >= 2);
});

test('variable expansion', () => {
  // Substitution keeps the separators as written; path.resolve copes with the mix.
  assert.equal(
    path.normalize(expandVariables('${workspaceFolder}/a.md', root, '/home/x')),
    path.join(root, 'a.md')
  );
  assert.equal(expandVariables('~/a.md', root, path.join(root, 'home')), path.join(root, 'home', 'a.md'));
  assert.equal(expandVariables('  a.md  ', root, '/home/x'), 'a.md');
});

test('file:// urls become plain paths', () => {
  const target = path.join(root, 'episodes', 'e03.md');
  const url = 'file:///' + target.replace(/\\/g, '/').replace(/^\//, '');
  assert.equal(resolvePath(url, context).path, target);
});

test.after(() => fs.rmSync(root, { recursive: true, force: true }));
