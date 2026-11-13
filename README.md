# Chai Tower ☕

A small physics stacking game. Tap to drop kulhads, samosas, biscuits and one very heavy kettle, and stack the chai stall as high as you can.

**Play:** https://heeray1.github.io/chai-tower/

## Modes

- **Levels:** Easy, Moderate and Tough each have 30 rule-generated levels (`levels.js`). Every level has one goal: stack N items, get perfect drops, keep misses low, survive the heavy kettle, or beat a boss level (wind or an early kettle) every 5th level. Clearing a level earns 1–3 stars, and progress is saved on the device. Easy levels 1–7 are deliberately gentle.
- **Daily Challenge:** the endless tower with Moderate rules. Everyone gets the same item order each day, and the score can be shared.

## Tech

Plain HTML5 + [Matter.js](https://brm.io/matter-js/) (MIT), with no build step. Serve the folder with any static server, e.g. `python3 -m http.server 8765`.

## Tests (Node 22+)

```bash
node --test tests/*.test.js                       # level rules
export CHROME=/path/to/chrome-headless-shell      # or any Chrome binary
node tests/harness.js easy-curve 10               # human-like bot must clear Easy 1-7 in at least 8/10 fresh runs
node tests/harness.js calibrate 3                 # human-like bot on the Daily (median collapse should be ~4)
node tests/harness.js run "mode=levels&level=moderate&n=1&bot=3&auto=1&upto=5" 300
node tests/harness.js shot "mode=levels&level=easy&n=1&bot=3" out/easy1 "3000,12000"   # W/H env set the viewport
```

## Bot URL parameters (testing and recording footage)

| Param | Meaning |
|---|---|
| `bot=3` / `bot=random` / `bot=human` | Careful (aim within 3 px), random tapping, or a calibrated casual player (`err=22`, `seed=N`) |
| `mode=levels`, `level=easy\|moderate\|tough`, `n=5` | Play level 5 of a difficulty (without `mode`, `level` picks the Daily's physics) |
| `auto=1`, `upto=7`, `cap=3` | Advance after a clear, stop after level 7, and allow at most 3 attempts per level |

Bot runs never send visitor-counter events.

`art/gen.py` regenerates the art assets with a local image model.
