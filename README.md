# Open File Lines

**English** · [Русский](README.ru.md)

Put the cursor on a path reference in any text, press **Alt+P**, and the file opens with the referenced lines selected.

```text
episodes/e03.md            -> opens the file, selects nothing
episodes/e03.md:300        -> opens the file, goes to line 300 and selects it
episodes/e03.md:494-586    -> opens the file, goes to line 494 and selects lines 494..586
```

Wrapping the reference in backticks or quotes changes nothing — `` `episodes/e03.md:494-586` `` works exactly like the bare form, and so do markdown links, `<angle brackets>`, and references followed by a comma or a full stop.

## Install

[![Marketplace](https://vsmarketplacebadges.dev/version/bytecoded.open-file-lines.svg?style=flat&label=VS%20Code%20Marketplace&logo=visualstudiocode)](https://marketplace.visualstudio.com/items?itemName=bytecoded.open-file-lines)

Search for *Open File Lines* in the Extensions view, or:

```bash
code --install-extension bytecoded.open-file-lines
```

## Commands and keys

| Key | Command | What it does |
| --- | --- | --- |
| `Alt+P` | `Open File Lines: Open File at Cursor` | opens in the active editor group |
| `Alt+Shift+P` | `Open File Lines: Open File at Cursor to the Side` | opens in a group beside it |

Both are also in the editor context menu. If you have text selected, the selection is used as the reference instead of the token under the cursor.

## Reference syntax

| Form | Result |
| --- | --- |
| `path` | open only |
| `path:300` | line 300 selected |
| `path:494-586` | lines 494..586 selected |
| `path#L494-L586`, `path#300` | same, GitHub anchor style |
| `path:300:12` | cursor at line 300, column 12, nothing selected |
| `https://…` | handed to the system browser |

A backwards range (`path:586-494`) is read as the same range. Line numbers past the end of the file are clamped to the last line. `path(300,12)` is *not* supported: parentheses have to end a reference so that `[text](path:1-2)` keeps working.

## How a path is resolved

The first existing entry wins:

1. absolute paths (including `C:\…`, `file://…`, `~/…`, `${workspaceFolder}/…`, `${userHome}/…`, `%VAR%`) as they are;
2. relative to the folder of the file the reference lives in;
3. relative to each workspace root, starting with the one that owns the current file;
4. relative to every folder in `openFileLines.searchPaths`.

If the reference has no extension, the ones from `openFileLines.extensions` are tried in order. When nothing matches, a warning appears with a **Show searched paths** button that lists every location that was probed in the *Open File Lines* output channel. A reference that points at a folder reveals it in the explorer.

## Settings

| Setting | Default | Meaning |
| --- | --- | --- |
| `openFileLines.searchPaths` | `[]` | extra lookup folders; relative entries are resolved against the current file's folder and every workspace root |
| `openFileLines.extensions` | `[".md", ".txt", ".ts", ".js", ".json"]` | extensions tried when the reference has none; `[]` disables guessing |
| `openFileLines.delimiters` | `` `'"<>|*?,;!=&^()[]`` plus space and tab | characters that end a reference when it is picked up from the text around the cursor |
| `openFileLines.selectLines` | `true` | select the range; when off, only the cursor is moved |
| `openFileLines.preview` | `false` | open in preview mode (reused, italic tab) |

## Development

```bash
npm install
```

```bash
npm test
```

`npm test` runs the parsing and path-resolution suites in plain node — no VSCode instance needed. Press `F5` to launch an Extension Development Host; `samples/links.md` has references to try against `samples/episodes/e03.md`, which is 600 numbered lines long.

## Install locally without packaging

Uninstall the Marketplace build first. Two copies contribute the same commands and both bind `Alt+P`, and VSCode picks between them by scan order:

```bash
code --uninstall-extension bytecoded.open-file-lines
```

Then copy or symlink this folder into your extensions directory and restart VSCode:

```bash
cmd //c mklink //d "%USERPROFILE%\.vscode\extensions\bytecoded.open-file-lines" "D:\Me\Projects\vscode-open-file-lines"
```

The folder name is a convention rather than a requirement — VSCode reads the identifier from `package.json` — but `publisher.name` keeps it in line with every other entry in that directory.

Or build a `.vsix`:

```bash
npx @vscode/vsce package
```

## Prior art, and why this exists

The token-under-cursor handling, the search-path fallbacks and the extension guessing reproduce the behaviour of [Fr43nk.seito-openfile](https://marketplace.visualstudio.com/items?itemName=Fr43nk.seito-openfile) — a mature and actively maintained extension in this space. Its path resolution is a good deal richer than what I built here: leading-path mapping, glob-based subfolder search, per-language extension guessing, a quick-open fallback. For pointing at plain paths in code and in terminal output, use it.

And this extension exists because it is optimised for references embedded in prose. Notes, review comments, transcripts — text where a reference sits inside a sentence, wrapped in punctuation, and points at a range of lines rather than at a single line. Here, for example, is a line from the notes it was written for:

```text
- She speaks briefly and directly. (/episodes/e01.md:448-487; /episodes/e01.md:972-1012)
```

Three requirements have to hold at once here:

1. **The range has to survive tokenisation.** `:` and `-` must stay *inside* the token, or `448-487` stops being a range — while every other punctuation mark around it has to be cut away. That takes two separate mechanisms: a delimiter set that ends a token, and a trim pass for wrapping punctuation (`DEFAULT_DELIMITERS` and `TRIM_LEADING` / `TRIM_TRAILING` in `src/parse.js`). A single word-boundary character class cannot express *"`(` ends the token but `-` does not, and a trailing full stop is punctuation rather than part of the name"*.

2. **Parentheses have to be delimiters**, which means giving up `path(300,12)`, the compiler-diagnostic form. That trade-off is deliberate: markdown links and parenthesised asides are everywhere in prose, MSVC diagnostics are not. An extension aimed at build output should make the opposite call — and seito-openfile does, which is why a reference written as `(path:448-487` does not resolve there.

3. **A malformed range must not silently succeed.** Parsed loosely, `path:972-1012` yields line 972: the file opens, the range is quietly dropped, and nothing looks wrong. Here the position suffix is matched by anchored regexes, so a reference either parses as a range or is left alone as part of the path.
