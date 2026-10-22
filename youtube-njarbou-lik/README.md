# Njarbou Lik (نجرّبو ليك) — YouTube channel files

- `njarbou_lik_logo.png` — channel logo (800x800), rendered from `logo.html` with `shot.js`
- `njarbou_lik_short1.mp4` — Short #1 (3-question experiments quiz, 31s)
- `short.html` — the Short's animation, driven by `render(t)`
- `render.js` — renders `short.html` to frames: `NODE_PATH=$(npm root -g) node render.js 30`
- `audio.py` — synthesizes the soundtrack (`audio.wav`)

Encode: `ffmpeg -framerate 30 -i frames/f%05d.jpg -i audio.wav -c:v libx264 -pix_fmt yuv420p -crf 20 -c:a aac -shortest out.mp4` (episodes with voices: add `-af loudnorm=I=-14:TP=-1.5 -ar 44100` for YouTube loudness)

## Mokhtabar Sami (مخبر سامي) — cartoon series

Original characters: Sami (Tunisian kid scientist in a red chechia) and Bip (his robot).
Voices are synthesized cartoon babble; dialogue is shown in speech bubbles.

- `mokhtabar-sami/ep1.html` — episode 1 "علاش القمر ما يطيحش؟" (Newton's cannon, Moon orbit), 60s
- Render: `PAGE=ep1.html NODE_PATH=$(npm root -g) node render.js 30`, audio: `python3 audio.py ep1.html`
- `mokhtabar-sami/sami_bip_keyart.png` — 3D reference image of Sami and Bip (Nano Banana 2.1 via Weave); use it as the input image for image-to-video so the characters stay consistent
- `mokhtabar-sami/mokhtabar_sami_ep1_ai.mp4` — episode 1 with AI video clips of Sami and Bip instead of the SVG drawings (same script and timings), 60s
  - `gen_clips.py` — animates the keyart into `clips/<name>.mp4` (Wan 2.2 i2v on the ZeroGPU Space `zerogpu-aoti/wan2-2-fp8da-aoti-faster`): `HF_TOKEN=... [DURATION=5] python3 gen_clips.py [names]`
  - `clips/intro.mp4` (5s, Sami talks to Bip) and `clips/shock.mp4` (4s, Sami gasps) are the two clips in the episode
  - `ep1_ai.html` — full-frame clip for dialogue, clip shrinks to a bottom panel while the lab screen explains; camera crops (`CAM`) and shot list (`SHOTS`) give close-ups, push-ins and loops from the two clips
  - Voices: real Tunisian speech from Microsoft Edge neural TTS (free, `pip install edge-tts`): Sami = `ar-TN-ReemNeural` pitched up as a kid, Bip = `ar-TN-HediNeural` + robot filter. `python3 voices.py ep1_ai.html` writes `voices/ep1_ai/NN.wav` (fitted to each line's slot, loudness-normalized; it warns when a line needs >1.2x speed, then shorten the text). `audio.py` uses them when present (else the babble) and ducks the music under speech
  - Extract frames, then render as usual: `for c in intro shock; do mkdir -p clips/$c; ffmpeg -i clips/$c.mp4 -vf scale=960:-1:flags=lanczos -q:v 2 clips/$c/%03d.jpg; done`, `PAGE=ep1_ai.html NODE_PATH=$(npm root -g) node render.js 30`, `python3 audio.py ep1_ai.html`

### Next steps (free pipeline)
- Video clips: Hugging Face ZeroGPU Spaces with `HF_TOKEN` (`gen_clips.py`). The free quota is about 3.5 min of GPU a day, i.e. one 5s clip (105s) plus one 4s clip; it resets 24h after use. More clips for ep1 (`question`, `bip_talk`, `cheer` are already written in `CLIPS`) can be added on later days and wired into `SHOTS`
- `gradio_client` gets its SSE stream cancelled behind the session proxy, and the Space has several replicas, so `gen_clips.py` uses the Gradio queue over plain HTTP pinned to one replica (`/--replicas/<id>/`)
- Publishing: Metricool connector, brand id 7591652 (YouTube + TikTok linked), daily at 20:00 Africa/Tunis
