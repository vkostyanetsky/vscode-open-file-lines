# Open File Lines

Put the cursor on a path reference in any text, press **Alt+P**, and the file opens with the
referenced lines selected.

```text
episodes/e03.md            -> opens the file, selects nothing
episodes/e03.md:300        -> opens the file, goes to line 300 and selects it
episodes/e03.md:494-586    -> opens the file, goes to line 494 and selects lines 494..586
```

Wrapping the reference in backticks or quotes changes nothing — `` `episodes/e03.md:494-586` ``
works exactly like the bare form, and so do markdown links, `<angle brackets>`, and references
followed by a comma or a full stop.

## Install

[![Marketplace](https://img.shields.io/visual-studio-marketplace/v/bytecoded.open-file-lines?label=VS%20Code%20Marketplace)](https://marketplace.visualstudio.com/items?itemName=bytecoded.open-file-lines)

Search for *Open File Lines* in the Extensions view, or:

```bash
code --install-extension bytecoded.open-file-lines
```

## Commands and keys

| Key | Command | What it does |
| --- | --- | --- |
| `Alt+P` | `Open File Lines: Open File at Cursor` | opens in the active editor group |
| `Alt+Shift+P` | `Open File Lines: Open File at Cursor to the Side` | opens in a group beside it |

Both are also in the editor context menu. If you have text selected, the selection is used as the
reference instead of the token under the cursor.

## Reference syntax

| Form | Result |
| --- | --- |
| `path` | open only |
| `path:300` | line 300 selected |
| `path:494-586` | lines 494..586 selected |
| `path#L494-L586`, `path#300` | same, GitHub anchor style |
| `path:300:12` | cursor at line 300, column 12, nothing selected |
| `https://…` | handed to the system browser |

A backwards range (`path:586-494`) is read as the same range. Line numbers past the end of the
file are clamped to the last line. `path(300,12)` is *not* supported: parentheses have to end a
reference so that `[text](path:1-2)` keeps working.

## How a path is resolved

The first existing entry wins:

1. absolute paths (including `C:\…`, `file://…`, `~/…`, `${workspaceFolder}/…`, `${userHome}/…`, `%VAR%`) as they are;
2. relative to the folder of the file the reference lives in;
3. relative to each workspace root, starting with the one that owns the current file;
4. relative to every folder in `openFileLines.searchPaths`.

If the reference has no extension, the ones from `openFileLines.extensions` are tried in order.
When nothing matches, a warning appears with a **Show searched paths** button that lists every
location that was probed in the *Open File Lines* output channel. A reference that points at a
folder reveals it in the explorer.

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

`npm test` runs the parsing and path-resolution suites in plain node — no VSCode instance needed.
Press `F5` to launch an Extension Development Host; `samples/links.md` has references to try
against `samples/episodes/e03.md`, which is 600 numbered lines long.

## Install locally without packaging

Copy or symlink this folder into your extensions directory and restart VSCode:

```bash
cmd //c mklink //d "%USERPROFILE%\.vscode\extensions\open-file-lines" "D:\Me\Projects\vscode-open-file-lines"
```

Or build a `.vsix`:

```bash
npx @vscode/vsce package
```

## Prior art

The token-under-cursor handling, the search-path and extension fallbacks, and the folder-reveal
behaviour follow the conventions of [Fr43nk.seito-openfile](https://marketplace.visualstudio.com/items?itemName=Fr43nk.seito-openfile).
The line-range selection is the part that extension does not do.
