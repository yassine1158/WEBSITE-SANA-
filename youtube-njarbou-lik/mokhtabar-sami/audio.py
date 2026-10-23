# Soundtrack for an episode: dialogue voices, space pad music, SFX.
# Voices come from voices/<page>/NN.wav (recording.py) when present, else cartoon babble from the dialogue timings.
# Sound effects: the page's `const SFX = [[time, 'kind'], ...]`, else the moon episode's set.
import math, os, random, re, struct, sys, wave
SR = 22050
html = open(sys.argv[1], encoding='utf-8').read()
LINES = [(float(a), float(b), w, txt) for a, b, w, txt in re.findall(r"\[([\d.]+), ([\d.]+), '(\w+)', '([^']*)'\]", html)]
TOTAL = float(re.search(r"const TOTAL = ([\d.]+)", html).group(1))
buf = [0.0] * int(TOTAL * SR)
rnd = random.Random(42)

def add(t0, dur, fn, out=None):
    out = buf if out is None else out
    s0 = int(t0 * SR)
    for i in range(int(dur * SR)):
        if 0 <= s0 + i < len(out): out[s0 + i] += fn(i / SR)

def env(x, dur, a=0.01):
    return min(1, x / a) * max(0, 1 - x / dur)

def sami_syl(t0, f, out=None, g=1):
    dur = 0.075 + rnd.random() * 0.03
    add(t0, dur, lambda x: g * 0.32 * env(x, dur) * (math.sin(2*math.pi*f*x*(1+0.08*x/dur)) + 0.4*math.sin(4*math.pi*f*x) + 0.15*math.sin(6*math.pi*f*x)), out)

def bip_syl(t0, f, out=None, g=1):
    dur = 0.06
    add(t0, dur, lambda x: g * 0.16 * env(x, dur, 0.003) * (1 if math.sin(2*math.pi*f*x) > 0 else -1), out)

vdir = 'voices/' + os.path.splitext(os.path.basename(sys.argv[1]))[0]
voice = [0.0] * len(buf)
for i, (t0, t1, who, txt) in enumerate(LINES):
    path = f'{vdir}/{i:02d}.wav'
    if not os.path.exists(path):
        continue
    with wave.open(path) as w:
        assert w.getframerate() == SR and w.getnchannels() == 1 and w.getsampwidth() == 2
        pcm = struct.unpack(f'<{w.getnframes()}h', w.readframes(w.getnframes()))
    s0 = int(t0 * SR)
    for j, v in enumerate(pcm):
        if s0 + j < len(voice): voice[s0 + j] += v / 32768
use_tts = any(voice)
# with TTS, babble goes on the voice track at speech level (and ducks the music like speech)
bab_out, bab_g = (voice, 2.5) if use_tts else (None, 1)

for i, (t0, t1, who, txt) in enumerate(LINES):  # babble for lines without a voice file
    if os.path.exists(f'{vdir}/{i:02d}.wav'):
        continue
    td = min(t1 - t0 - 0.9, 0.3 + len(txt) * 0.05)
    t = t0
    while t < t0 + td - 0.05:
        if who == 'sami': sami_syl(t, rnd.choice([330, 370, 415, 440, 494, 523]) * (1.15 if '!' in txt or '؟' in txt else 1), bab_out, bab_g)
        else: bip_syl(t, rnd.choice([880, 1047, 1175, 1319, 1568]), bab_out, bab_g)
        t += 0.09 + (0.07 if rnd.random() < 0.15 else 0)

# space pad: Am F C G, 4s each
chords = [[220, 261.63, 329.63], [174.61, 220, 261.63], [261.63, 329.63, 392], [196, 246.94, 293.66]]
t = 0
while t < TOTAL:
    for f in chords[int(t / 4) % 4]:
        add(t, 4.2, lambda x, f=f: 0.035 * min(1, x / 0.8) * max(0, min(1, (4.2 - x) / 0.6)) * math.sin(2*math.pi*f*x + 0.3*math.sin(2*math.pi*0.5*x)))
    t += 4

def sweep(t0, dur, f0, f1, vol):
    add(t0, dur, lambda x: vol * env(x, dur) * math.sin(2*math.pi*(f0*x + (f1 - f0) * x * x / (2 * dur))))

nz = [rnd.uniform(-1, 1) for _ in range(SR)]
def rumble(t0):  # rocket
    add(t0, 5.0, lambda x: 0.18 * min(1, x / 0.5) * max(0, 1 - x / 5) * nz[int(x * SR) % SR] * (0.5 + 0.5 * math.sin(2*math.pi*7*x)))

def thunder(t0):  # sharp crack, then a long low rumble (brown noise with a wobbling envelope)
    dur, b, rum = 3.2, 0.0, []
    for i in range(int(dur * SR)):
        b = 0.985 * b + 0.05 * rnd.uniform(-1, 1)
        rum.append(b)
    add(t0, dur, lambda x: 0.9 * min(1, x / 0.08) * math.exp(-x / 1.1) * (0.6 + 0.4 * math.sin(2*math.pi*1.7*x) * math.sin(2*math.pi*0.6*x)) * rum[int(x * SR)])
    add(t0, 0.25, lambda x: 0.3 * math.exp(-x / 0.05) * nz[int(x * SR * 3) % SR])

SOUNDS = {
    'whoosh': lambda t0: sweep(t0, 0.8, 200, 900, 0.25),
    'shot': lambda t0: sweep(t0, 0.35, 900, 200, 0.3),
    'surprise': lambda t0: sweep(t0, 0.5, 300, 700, 0.2),
    'rumble': rumble,
    'thunder': thunder,
}
m = re.search(r"const SFX = \[(.*?)\];", html, re.S)
SFX = [(float(a), k) for a, k in re.findall(r"\[([\d.]+), '(\w+)'\]", m.group(1))] if m else \
      [(0.0, 'whoosh'), (24.5, 'shot'), (28.0, 'shot'), (31.5, 'shot'), (16.0, 'surprise'), (54.8, 'rumble')]
for t0, kind in SFX:
    SOUNDS[kind](t0)

if use_tts:  # duck music/SFX to 45% under speech (50ms attack, 400ms release)
    g, att, rel = 0.0, 1 / (0.05 * SR), 1 / (0.4 * SR)
    for i, v in enumerate(voice):
        g = min(1.0, g + att) if abs(v) > 0.02 else max(0.0, g - rel)
        buf[i] = buf[i] * (1 - 0.55 * g) * 0.8 + v

for i in range(SR):                                # fade out last second
    buf[-1 - i] *= i / SR
peak = max(abs(v) for v in buf)
with wave.open('audio.wav', 'w') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(b''.join(struct.pack('<h', int(v / peak * 0.9 * 32767)) for v in buf))
print('audio', len(LINES), 'lines', TOTAL, 's')
