# Builds a long 16:9 narrated video from a facts file: long/<name>.mp4
# Voice: Microsoft Edge neural TTS (free), Tunisian voice reading Modern Standard Arabic; the timeline follows the voice.
# Run from youtube-njarbou-lik/: python3 long/make_long.py long/space_facts.json [--preview]
import asyncio, json, os, re, shutil, subprocess, sys
import certifi
if os.path.exists('/root/.ccr/ca-bundle.crt'):  # session proxy CA (edge_tts pins certifi's bundle)
    certifi.where = lambda: '/root/.ccr/ca-bundle.crt'
import edge_tts

VOICE, RATE = 'ar-TN-HediNeural', '+6%'  # a touch faster: livelier
src = sys.argv[1]
name = os.path.splitext(os.path.basename(src))[0]
D = json.load(open(src, encoding='utf-8'))
vdir = f'long/voice/{name}'
CREDITS = json.load(open('long/media/credits.json', encoding='utf-8')) if os.path.exists('long/media/credits.json') else {}
os.makedirs(vdir, exist_ok=True)

def duration(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]))

def subtitles(text, t0, dur):
    # one sentence at a time, timed by its share of the characters
    parts = [p.strip() for p in re.split(r'(?<=[.!؟?])\s+', text) if p.strip()]
    total, t, out = sum(len(p) for p in parts), t0, []
    for p in parts:
        d = dur * len(p) / total
        out.append({'t0': round(t, 2), 't1': round(t + d, 2), 'text': p})
        t += d
    return out

segments = [dict(D['intro'], title=D['title'], n=0)] + [dict(f, n=i) for i, f in enumerate(D['facts'], 1)] \
         + [dict(D['outro'], title='شنوّة فاجأك أكثر؟ 👇', big='اشترك 🔔', n=0)]
scenes, voices, t = [], [], 0.0
for i, s in enumerate(segments):
    path = f'{vdir}/{i:02d}.mp3'
    if not os.path.exists(path):
        asyncio.run(edge_tts.Communicate(s['say'], VOICE, rate=RATE).save(path))
    d = duration(path)
    v0 = t + (1.3 if s['n'] else 0.6)  # facts open with a 1.4s number card
    end = v0 + d + 1.0
    scenes.append({'kind': s['kind'], 'title': s.get('title', ''), 'big': s.get('big', ''), 'tag': s.get('tag', ''), 'n': s['n'],
                   'img': s.get('img'), 'credit': CREDITS.get(s.get('img'), {}).get('credit', ''),
                   'start': round(t, 2), 'end': round(end, 2), 'subs': subtitles(s['say'], v0, d)})
    voices.append((path, v0))
    t = end
data = {'scenes': scenes, 'total': round(t, 2), 'count': len(D['facts'])}
page = f'long/{name}.html'
open(page, 'w', encoding='utf-8').write(
    open('long/space_long.html', encoding='utf-8').read().replace('/*DATA*/', json.dumps(data, ensure_ascii=False)))
print('total', round(t, 1), 's', flush=True)

env = dict(os.environ, PAGE=page, W='1920', H='1080',
           NODE_PATH=subprocess.check_output(['npm', 'root', '-g'], text=True).strip())
if '--preview' in sys.argv:  # stills at the middle of each scene
    times = ','.join(str(round((s['start'] + s['end']) / 2, 1)) for s in scenes)
    subprocess.run(['node', 'render.js', '30', times], env=env, check=True)
    sys.exit()
shutil.rmtree('frames', ignore_errors=True)
subprocess.run(['node', 'render.js', '30'], env=env, check=True)

# soundtrack: a light beat + chords under the voice, whooshes on the cuts, a hit when the big number lands
import numpy as np, wave
SR = 44100
N = int(t * SR) + SR
music, sfx = np.zeros(N, np.float32), np.zeros(N, np.float32)
rng = np.random.default_rng(7)
def put(buf, at, sig):
    i = int(at * SR); sig = sig[:max(0, N - i)]; buf[i:i + len(sig)] += sig
beat = 60 / 92
chords = [[220.0, 261.63, 329.63], [174.61, 220.0, 261.63], [261.63, 329.63, 392.0], [196.0, 246.94, 293.66]]
x = np.arange(int(beat * 4 * SR)) / SR
for bar in range(int(t / (beat * 4)) + 1):
    t0, ch = bar * beat * 4, chords[bar % 4]
    pad = sum(np.sin(2 * np.pi * f * x) + 0.3 * np.sin(4 * np.pi * f * x) for f in ch) / 3
    put(music, t0, (0.10 * pad * np.minimum(1, x / 0.6) * np.minimum(1, (x[-1] - x) / 0.4)).astype(np.float32))
    for k in range(4):  # kick on the beat, hat on the off-beat, a pluck arpeggio
        y = np.arange(int(0.3 * SR)) / SR
        put(music, t0 + k * beat, (0.35 * np.sin(2 * np.pi * (45 * y + 75 * (1 - np.exp(-y * 30)) / 30)) * np.exp(-y * 9)).astype(np.float32))
        h = np.diff(rng.standard_normal(int(0.04 * SR) + 1)).astype(np.float32)
        put(music, t0 + (k + 0.5) * beat, 0.03 * h * np.exp(-np.arange(len(h)) / SR * 80))
        for j, f in enumerate([ch[k % 3] * 2, ch[(k + 1) % 3] * 2]):
            z = np.arange(int(0.35 * SR)) / SR
            put(music, t0 + (k + j * 0.5) * beat, (0.05 * np.sin(2 * np.pi * f * z) * np.exp(-z * 7)).astype(np.float32))
def whoosh(at, d=0.7):
    z = np.arange(int(d * SR)) / SR
    n = np.convolve(rng.standard_normal(len(z)), np.ones(12) / 12, 'same')
    env = np.sin(np.pi * z / d) ** 2
    put(sfx, at - d / 2, (0.5 * n * env * (0.6 + 0.4 * np.sin(2 * np.pi * (2 + 10 * z / d) * z))).astype(np.float32))
def hit(at):
    z = np.arange(int(0.7 * SR)) / SR
    boom = 0.7 * np.sin(2 * np.pi * (38 * z + 60 * (1 - np.exp(-z * 12)) / 12)) * np.exp(-z * 5)
    crack = 0.25 * rng.standard_normal(len(z)) * np.exp(-z * 40)
    put(sfx, at, (boom + crack).astype(np.float32))
for sc in scenes:
    if sc['start'] > 0: whoosh(sc['start'])
    if sc['big']: hit(sc['start'] + (2.2 if sc['n'] else 0.6))
z = np.arange(int(1.6 * SR)) / SR  # opening riser
put(sfx, 0, (0.25 * np.sin(2 * np.pi * (200 * z + 300 * z * z)) * (z / 1.6) * np.exp(-np.maximum(0, z - 1.4) * 20)).astype(np.float32))
bed = f'{vdir}/bed.wav'
mixbuf = 0.55 * music / (np.abs(music).max() + 1e-9) + 0.8 * sfx / (np.abs(sfx).max() + 1e-9)
fade = np.ones(N, np.float32); fade[-2 * SR:] = np.linspace(1, 0, 2 * SR)
with wave.open(bed, 'w') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes((np.clip(mixbuf * fade, -1, 1) * 32767 * 0.9).astype('<i2').tobytes())
inputs, chains = ['-i', bed], ['[1:a]volume=0.32[m]']
for k, (path, v0) in enumerate(voices):
    inputs += ['-i', path]
    ms = int(v0 * 1000)
    chains.append(f'[{k + 2}:a]aresample=44100,adelay={ms}|{ms}[v{k}]')
mix = ';'.join(chains) + ';[m]' + ''.join(f'[v{k}]' for k in range(len(voices))) + \
      f'amix=inputs={len(voices) + 1}:normalize=0,loudnorm=I=-14:TP=-1.5[out]'
out = f'long/njarbou_lik_{name}.mp4'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '30', '-i', 'frames/f%05d.jpg', *inputs,
                '-filter_complex', mix, '-map', '0:v', '-map', '[out]', '-c:v', 'libx264', '-preset', 'medium', '-crf', '22',
                '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '160k', '-movflags', '+faststart', '-shortest', out], check=True)
print(out, flush=True)
