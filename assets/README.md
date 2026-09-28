# assets/

Drop an optional **`zenyu.png`** sprite sheet here to replace the procedural Zenyu.

If the file is missing (the default), the game draws Zenyu from pixel grids in
`src/sprites.js` and logs a friendly note in the console. Nothing breaks.

## Expected layout

The layout lives in `SPRITE_SHEET` in `src/config.js` — edit it to match your art.

| Row | Animation | Frames | Notes                        |
| --- | --------- | ------ | ---------------------------- |
| 0   | `idle`    | 2      | gentle breathing bob         |
| 1   | `walk`    | 4      |                              |
| 2   | `jump`    | 1      | also used for falling        |
| 3   | `photo`   | 2      | raise camera → at the eye    |

- Frames are `32×42` px, laid out left→right, one animation per row.
- Draw every frame **facing right**; the game mirrors it for walking left.
- `anchorX/anchorY` (default `16, 42`) is the point that sits on Zenyu's feet.
- Optional extra rows: add `fall` or `hurt` entries to `SPRITE_SHEET.animations`.
- Keep the background transparent and use nearest-neighbour exports (no smoothing).

`/tools/sprite-preview.html` (served from the repo root) shows every frame
of whichever sprite set is active — handy for checking a new sheet.
