# K-JUMPING V14 — Refactored

V13 gameplay structure split into separate HTML, CSS, JS, and character assets.

- `index.html` — scene markup
- `css/game.css` — main UI/game styling
- `css/board.css` — V13 plank visual overlay
- `js/game.js` — main game logic/UI
- `js/board.js` — plank visual synchronization
- `assets/characters/player_idle.png` — player
- `assets/characters/partner_idle.png` — partner

The goal is to preserve V13 behavior while removing the large base64 character images from the HTML.
