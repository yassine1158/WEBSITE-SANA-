# Njarbou Lik (نجرّبو ليك) — YouTube channel files

- `njarbou_lik_logo.png` — channel logo (800x800), rendered from `logo.html` with `shot.js`
- `njarbou_lik_short1.mp4` — Short #1 (3-question experiments quiz, 31s)
- `njarbou_lik_short2.mp4` — Short #2 (`short2.html`: watermelon / apple / grape, float or sink, 25.5s): question 1 is on screen at frame 0, challenge line, 3s countdown, "the hardest" on Q3, comment-your-score ending
- `njarbou_lik_short3.mp4` — Short #3 (`short3.html`: sealed cola can sinks, the Diet one floats, 11s): one question per Short so the answer is the payoff at the end and the Short loops; "write your guess before it drops" on screen during the countdown; the can shakes from frame 0
- `short.html` — the Short's animation, driven by `render(t)`
- `render.js` — renders a Short page to frames: `[PAGE=short2.html] NODE_PATH=$(npm root -g) node render.js 30`
- `audio.py` — synthesizes the soundtrack (`audio.wav`) from the page's timings: `python3 audio.py [short2.html]`

Encode: `ffmpeg -framerate 30 -i frames/f%05d.jpg -i audio.wav -c:v libx264 -pix_fmt yuv420p -crf 20 -c:a aac -shortest out.mp4` (episodes with voices: add `-af loudnorm=I=-14:TP=-1.5 -ar 44100` for YouTube loudness)

## Mokhtabar Sami (مخبر سامي) — cartoon series

Original characters: Sami (Tunisian kid scientist in a red chechia) and Bip (his robot).
Dialogue is shown in speech bubbles; voices are recorded (`recording.py`), with synthesized cartoon babble as a placeholder.

- `mokhtabar-sami/ep1.html` — episode 1 "علاش القمر ما يطيحش؟" (Newton's cannon, Moon orbit), 60s
- Render: `PAGE=ep1.html NODE_PATH=$(npm root -g) node render.js 30`, audio: `python3 audio.py ep1.html`
- `mokhtabar-sami/sami_bip_keyart.png` — 3D reference image of Sami and Bip (Nano Banana 2.1 via Weave); use it as the input image for image-to-video so the characters stay consistent
- `mokhtabar-sami/mokhtabar_sami_ep1_ai.mp4` — episode 1 with AI video clips of Sami and Bip: "علاش نشوفو البرق قبل ما نسمعو الرعد؟" (light vs sound, count the seconds ÷ 3 = km), 60s. Placeholder babble until the recorded voices are in
  - `gen_clips.py` — animates the keyart into `clips/<name>.mp4` (Wan 2.2 i2v on the ZeroGPU Space `zerogpu-aoti/wan2-2-fp8da-aoti-faster`): `HF_TOKEN=... [DURATION=5] python3 gen_clips.py [names]`
  - `clips/intro.mp4` (5s, Sami talks to Bip) and `clips/shock.mp4` (4s, Sami gasps) are the two clips in the episode
  - `ep1_ai.html` — full-frame clip for dialogue, clip shrinks to a bottom panel while the lab screen explains; camera crops (`CAM`) and shot list (`SHOTS`) give close-ups, push-ins and loops from the two clips. `SFX` lists the sound effects (thunder) for `audio.py`
  - `moon_ai.html` — the Moon script ("علاش القمر ما يطيحش؟") on the same AI clips, kept for a later episode
  - Voices are recorded by a person: free Derja TTS (Edge ar-TN, `silma-tts-derja`) came out as MSA or broken Derja. Record the lines in order, skipping Bip's beep-only lines, with a clear pause between lines (or one file per line), then `python3 recording.py ep1_ai.html rec.m4a`: it cuts at the longest pauses, pitches Sami up to a kid's voice (`SAMI_PITCH`), puts a robot filter on Bip, fits each line to its slot and writes `voices/ep1_ai/NN.wav`
  - `audio.py` mixes the voice files (babble for lines without one) and ducks the music under speech
  - Extract frames, then render as usual: `for c in intro shock; do mkdir -p clips/$c; ffmpeg -i clips/$c.mp4 -vf scale=960:-1:flags=lanczos -q:v 2 clips/$c/%03d.jpg; done`, `PAGE=ep1_ai.html NODE_PATH=$(npm root -g) node render.js 30`, `python3 audio.py ep1_ai.html`

### One-question Shorts (`shorts/`)
- `questions.json` (14 float-or-sink questions) + `template.html` → `python3 shorts/make_shorts.py [numbers]` → `shorts/njarbou_lik_qNN.mp4` (9.4s)
- Scheduled on YouTube + TikTok through Metricool, 2 a day (10:00 and 16:00 Tunis, Metricool's best hours): q01 Oct 28 10:00, q02 Oct 28 18:00, then q03-q14 Oct 29 - Nov 3 at 10:00 and 16:00
- Short #3 analytics (day 1): 961 views, 37.2% stayed, 89.0% viewed, but a drop from 68% to 39% at 10.6s on the outro card and still 0 comments. Hence no outro (rewind to frame 0 for the loop), the item already falling on frame 0, and a one-keystroke comment ask (1 or 2)

### Shorts: what the analytics say
- Short #2 (day 1): 772 views (×3.4), 35.6% stayed (frame-0 hook: +15 pts), but 52.3% average viewed (13s of 26s: viewers leave once question 1 is answered) and 0 comments. Hence one question per Short and an explicit "comment your guess" before the reveal

### Shorts: the first second
- Short #1 analytics (day 1): 227 views, 85.7% average viewed, but only 20.1% stayed past the start. Its intro faded in from a blank frame. Every Short must show its hook on frame 0: no fade-in, a bold question, motion or a face, and a challenge to guess (`ep1_ai.html` opens on Sami's shocked face + the question + "خمّن قبل ما نقولك 👇", lightning at 0.4s)

### Next steps (free pipeline)
- Video clips: Hugging Face ZeroGPU Spaces with `HF_TOKEN` (`gen_clips.py`). The free quota is about 3.5 min of GPU a day, i.e. one 5s clip (105s) plus one 4s clip; it resets 24h after use. More clips for ep1 (`question`, `bip_talk`, `cheer` are already written in `CLIPS`) can be added on later days and wired into `SHOTS`
- `gradio_client` gets its SSE stream cancelled behind the session proxy, and the Space has several replicas, so `gen_clips.py` uses the Gradio queue over plain HTTP pinned to one replica (`/--replicas/<id>/`)
- Publishing: Metricool connector, brand id 7591652 (YouTube + TikTok linked), daily at 20:00 Africa/Tunis
