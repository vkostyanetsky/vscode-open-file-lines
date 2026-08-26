# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## 0.1.2 - 2026-08-26

### Added

* Added a Russian README, linked from the English one and kept out of the packaged extension.

### Changed

* This release touches the documentation only: the extension itself is unchanged.
* Rewrote the README, so that what the extension is for and why it makes the trade-offs it makes — parentheses as delimiters, anchored range parsing — is now spelled out next to the prior art.

### Fixed

* Fixed the local-install instructions: the Marketplace build has to be uninstalled first, since two copies contribute the same commands and both bind `Alt+P`. The symlink is now named `bytecoded.open-file-lines` to match the publisher-qualified identifier.

## 0.1.1 - 2026-08-25

### Added

* Added `Open File Lines: Show Log`, an output channel recording the token, the parsed target, the resolved path and the applied selection for every invocation.

### Changed

* The output channel is created once instead of on every failed lookup.

### Fixed

* Fixed the line range not being selected when the target file was already open: VSCode restored that editor's remembered cursor position over the selection passed through `showTextDocument`. The selection is now assigned to the editor afterwards.

## 0.1.0 - 2026-08-25

### Added

* Initial release: `Alt+P` opens the path reference under the cursor and selects the line range it points at (`path`, `path:300`, `path:494-586`, `path#L494-L586`, `path:300:12`).
* References wrapped in backticks, quotes, angle brackets or markdown link parentheses are handled the same as bare ones.
* Resolution falls back through the current file's folder, the workspace roots, and `openFileLines.searchPaths`, with extension guessing via `openFileLines.extensions`.
* `Alt+Shift+P` opens the reference in the editor group beside the current one.
