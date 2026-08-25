# Changelog

## 0.1.1

- Fixed: the line range was not selected when the target file was already open —
  VSCode restored that editor's remembered cursor position over the selection passed
  through `showTextDocument`. The selection is now assigned to the editor afterwards.
- Added `Open File Lines: Show Log`, an output channel recording the token, the parsed
  target, the resolved path and the applied selection for every invocation.
- The output channel is created once instead of on every failed lookup.

## 0.1.0

- Initial release: `Alt+P` opens the path reference under the cursor and selects the line range it
  points at (`path`, `path:300`, `path:494-586`, `path#L494-L586`, `path:300:12`).
- References wrapped in backticks, quotes, angle brackets or markdown link parentheses are handled
  the same as bare ones.
- Resolution falls back through the current file's folder, the workspace roots, and
  `openFileLines.searchPaths`, with extension guessing via `openFileLines.extensions`.
- `Alt+Shift+P` opens the reference in the editor group beside the current one.
