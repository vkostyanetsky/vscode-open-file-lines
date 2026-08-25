# References to try with Alt+P

Put the cursor anywhere inside a reference and press `Alt+P`.

## The three shapes from the spec

- opens only: episodes/e03.md
- one line: episodes/e03.md:300
- a range: episodes/e03.md:494-586

## The same, wrapped

- backticks: `episodes/e03.md:494-586`
- apostrophes: 'episodes/e03.md:300'
- quotes: "episodes/e03.md"
- markdown link: [episode 3, the good part](episodes/e03.md:494-586)
- angle brackets: <episodes/e03.md:300>
- end of a sentence: see episodes/e03.md:494-586.
- in a list, comma separated: episodes/e03.md:300, episodes/e03.md:494-586

## Other accepted forms

- github anchor: episodes/e03.md#L494-L586
- github single line: episodes/e03.md#300
- line and column: episodes/e03.md:300:12
- backwards range, read as 494-586: episodes/e03.md:586-494
- no extension, guessed from settings: episodes/e03
- clamped to the last line (the file has 600): episodes/e03.md:9000
- a folder, revealed in the explorer: episodes
- a url, handed to the browser: https://code.visualstudio.com/api

## Should do nothing useful

- not a path: just some prose
- missing file: episodes/e99.md:1-5
