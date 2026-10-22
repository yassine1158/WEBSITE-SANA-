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
- `mokhtabar-sami/sami_bip_keyart.png` — 3D reference image of Sami and Bip (Nano Banana 2.1 via Weave); use it as the input image for image-to-video so the characters stay consistent

### Next steps (free pipeline)
- Video clips: Hugging Face ZeroGPU Spaces via `gradio_client` with `HF_TOKEN` (e.g. `Lightricks/ltx-video-distilled` `/image_to_video`, `zerogpu-aoti/wan2-2-fp8da-aoti-faster` `/generate_video`); free quota is a few clips per day
- Publishing: Metricool connector, brand id 7591652 (YouTube + TikTok linked), daily at 20:00 Africa/Tunis
