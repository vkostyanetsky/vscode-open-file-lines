'use strict';

/**
 * Pure link-parsing helpers. Deliberately free of any `vscode` dependency so
 * the whole thing can be exercised from plain node (see test/parse.test.js).
 */

/**
 * Characters that terminate a path token when it is picked up from the text
 * around the cursor.
 *
 * Notes on the deliberate omissions:
 *   - `:` and `-` must stay inside the token, they carry the line range;
 *   - `{`, `}` and `$` are kept so that `${workspaceFolder}/a.md` survives;
 *   - backtick and quotes are here, which is what makes `` `a.md:1-2` `` work.
 */
const DEFAULT_DELIMITERS = "`'\"<>|*?,;!=&^()[] \t\u00a0";

/** Punctuation stripped from both ends after the token has been cut out. */
const TRIM_LEADING = "`'\"<>([{,;:!?*=&|";
const TRIM_TRAILING = "`'\"<>)]},;:!?*=&|.";

const URL_RE = /^([a-z][a-z0-9+.-]*):\/\//i;

/**
 * Grabs the path-looking token surrounding `character` in `lineText`.
 *
 * @param {string} lineText
 * @param {number} character cursor offset inside `lineText`
 * @param {string} [delimiters]
 * @returns {string} the raw token ('' when the cursor sits in empty space)
 */
function extractToken(lineText, character, delimiters = DEFAULT_DELIMITERS) {
  if (typeof lineText !== 'string' || lineText.length === 0) return '';

  const isDelimiter = (index) =>
    index < 0 || index >= lineText.length || delimiters.indexOf(lineText[index]) !== -1;

  let cursor = Math.max(0, Math.min(character, lineText.length));

  // The cursor may sit just past the end of the token (a very common case when
  // it was placed by double-clicking or by pressing End); step back once.
  if (isDelimiter(cursor) && !isDelimiter(cursor - 1)) cursor -= 1;
  if (isDelimiter(cursor)) return '';

  let start = cursor;
  while (!isDelimiter(start - 1)) start -= 1;

  let end = cursor;
  while (!isDelimiter(end + 1)) end += 1;

  return trimToken(lineText.slice(start, end + 1));
}

/**
 * Strips wrapping quotes/brackets/punctuation. Applied to tokens taken from the
 * cursor as well as to text the user selected by hand.
 *
 * @param {string} token
 * @returns {string}
 */
function trimToken(token) {
  let value = String(token == null ? '' : token).trim();

  let changed = true;
  while (changed && value.length > 0) {
    changed = false;
    while (value.length > 0 && TRIM_LEADING.indexOf(value[0]) !== -1) {
      value = value.slice(1);
      changed = true;
    }
    while (value.length > 0 && TRIM_TRAILING.indexOf(value[value.length - 1]) !== -1) {
      value = value.slice(0, -1);
      changed = true;
    }
  }

  return value;
}

/**
 * Splits a token into a path plus an optional position.
 *
 * Recognised shapes:
 *   a.md              -> {}
 *   a.md:300          -> line 300
 *   a.md:494-586      -> lines 494..586
 *   a.md#L494-L586    -> lines 494..586   (GitHub style)
 *   a.md:300:12       -> line 300, column 12
 *
 * The `a.md(300,12)` compiler style is deliberately absent: parentheses have to
 * end a token so that markdown links like `[text](a.md:1-2)` keep working.
 *
 * @param {string} token
 * @returns {{path: string, line?: number, endLine?: number, column?: number}}
 */
function parseTarget(token) {
  const value = trimToken(token);
  if (value.length === 0) return { path: '' };

  // A URL has no position suffix to look for, and its own `:` would confuse us.
  if (URL_RE.test(value)) return { path: value };

  let match;

  // a.md:300:12  (line and column, never a range)
  match = /^(.+?):(\d+):(\d+)$/.exec(value);
  if (match) return position(match[1], match[2], undefined, match[3]);

  // a.md:494-586 / a.md#L494-L586
  match = /^(.+?)[:#]\s*L?(\d+)\s*[-–—]\s*L?(\d+)$/i.exec(value);
  if (match) return position(match[1], match[2], match[3], undefined);

  // a.md:300 / a.md#L300
  match = /^(.+?)[:#]\s*L?(\d+)$/i.exec(value);
  if (match) return position(match[1], match[2], undefined, undefined);

  return { path: value };
}

function position(rawPath, line, endLine, column) {
  const target = { path: trimPathTail(rawPath) };

  const first = toPositive(line);
  if (first !== undefined) target.line = first;

  const last = toPositive(endLine);
  if (last !== undefined) target.endLine = last;

  const col = toPositive(column);
  if (col !== undefined) target.column = col;

  // `a.md:586-494` is treated as the same range, just written backwards.
  if (target.line !== undefined && target.endLine !== undefined && target.endLine < target.line) {
    const swap = target.line;
    target.line = target.endLine;
    target.endLine = swap;
  }

  return target;
}

/** Removes trailing separators left over after the position was cut off. */
function trimPathTail(rawPath) {
  return String(rawPath).replace(/[\s:#(,-]+$/, '');
}

function toPositive(value) {
  if (value === undefined || value === null || value === '') return undefined;
  const parsed = Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return parsed;
}

/**
 * @param {string} value
 * @returns {string|undefined} lowercase scheme when `value` looks like a URL
 */
function urlScheme(value) {
  const match = URL_RE.exec(String(value == null ? '' : value));
  return match ? match[1].toLowerCase() : undefined;
}

module.exports = {
  DEFAULT_DELIMITERS,
  extractToken,
  trimToken,
  parseTarget,
  urlScheme,
};
