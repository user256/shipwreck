# Shipwreck (HTML5/JS) - Build Brief

## Vision
Create a single-player, browser-playable homage to the old flash games of yore:
- Steer a small boat in open water.
- Avoid homing mines that pursue the player.
- Collect randomly spawning treasure for score.
- Survive through increasingly difficult levels.

## Core Gameplay TODO
- [x] Player boat movement: rotate left/right, accelerate, reverse, drag.
- [x] Homing mines: spawn over time, seek player, explode on impact.
- [x] Mine-vs-mine collisions: both destroyed for tactical play.
- [x] Treasure spawn system: random drops with weighted values.
- [x] Treasure despawn logic by value:
  - high value disappears fastest
  - low value persists longer
- [x] Scoring: add treasure value to total score.
- [x] Level progression: every level increases mine speed/spawn pressure.
- [x] Lives/health and game over state.
- [x] Restart flow after game over.

## Next Iterations
- [ ] Add sprite art and sound effects.
- [ ] Add whirlpool special ability (once per game) as optional power.
- [ ] Add title screen + instructions overlay.
- [ ] Add persistent high score in localStorage.
- [ ] Tune difficulty curve and spawn pacing.
