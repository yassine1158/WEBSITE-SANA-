# Njarbou Lik (نجرّبو ليك) — YouTube channel files

- `njarbou_lik_logo.png` — channel logo (800x800), rendered from `logo.html` with `shot.js`
- `njarbou_lik_short1.mp4` — Short #1 (3-question experiments quiz, 31s)
- `short.html` — the Short's animation, driven by `render(t)`
- `render.js` — renders `short.html` to frames: `NODE_PATH=$(npm root -g) node render.js 30`
- `audio.py` — synthesizes the soundtrack (`audio.wav`)

Encode: `ffmpeg -framerate 30 -i frames/f%05d.jpg -i audio.wav -c:v libx264 -pix_fmt yuv420p -crf 20 -c:a aac -shortest out.mp4`

## Mokhtabar Sami (مخبر سامي) — cartoon series

Original characters: Sami (Tunisian kid scientist in a red chechia) and Bip (his robot).
Voices are synthesized cartoon babble; dialogue is shown in speech bubbles.

- `mokhtabar-sami/ep1.html` — episode 1 "علاش القمر ما يطيحش؟" (Newton's cannon, Moon orbit), 60s
- Render: `PAGE=ep1.html NODE_PATH=$(npm root -g) node render.js 30`, audio: `python3 audio.py ep1.html`
