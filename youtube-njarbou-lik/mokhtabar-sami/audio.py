# Soundtrack for an episode: dialogue voices, space pad music, SFX.
# Voices come from voices/<page>/NN.wav (voices.py) when present, else cartoon babble from the dialogue timings.
import math, os, random, re, struct, sys, wave
SR = 22050
html = open(sys.argv[1], encoding='utf-8').read()
LINES = [(float(a), float(b), w, txt) for a, b, w, txt in re.findall(r"\[([\d.]+), ([\d.]+), '(\w+)', '([^']*)'\]", html)]
TOTAL = float(re.search(r"const TOTAL = ([\d.]+)", html).group(1))
buf = [0.0] * int(TOTAL * SR)
rnd = random.Random(42)

def add(t0, dur, fn):
    s0 = int(t0 * SR)
    for i in range(int(dur * SR)):
        if 0 <= s0 + i < len(buf): buf[s0 + i] += fn(i / SR)

def env(x, dur, a=0.01):
    return min(1, x / a) * max(0, 1 - x / dur)

def sami_syl(t0, f):
    dur = 0.075 + rnd.random() * 0.03
    add(t0, dur, lambda x: 0.32 * env(x, dur) * (math.sin(2*math.pi*f*x*(1+0.08*x/dur)) + 0.4*math.sin(4*math.pi*f*x) + 0.15*math.sin(6*math.pi*f*x)))

def bip_syl(t0, f):
    dur = 0.06
    add(t0, dur, lambda x: 0.16 * env(x, dur, 0.003) * (1 if math.sin(2*math.pi*f*x) > 0 else -1))

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

for i, (t0, t1, who, txt) in enumerate(LINES):  # babble for lines without a voice file
    if os.path.exists(f'{vdir}/{i:02d}.wav'):
        continue
    td = min(t1 - t0 - 0.9, 0.3 + len(txt) * 0.05)
    t = t0
    while t < t0 + td - 0.05:
        if who == 'sami': sami_syl(t, rnd.choice([330, 370, 415, 440, 494, 523]) * (1.15 if '!' in txt or '؟' in txt else 1))
        else: bip_syl(t, rnd.choice([880, 1047, 1175, 1319, 1568]))
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

sweep(0.0, 0.8, 200, 900, 0.25)                    # title whoosh up
for s in (24.5, 28.0, 31.5): sweep(s, 0.35, 900, 200, 0.3)   # cannon shots
sweep(16.0, 0.5, 300, 700, 0.2)                    # surprise
nz = [rnd.uniform(-1, 1) for _ in range(SR)]
add(54.8, 5.0, lambda x: 0.18 * min(1, x / 0.5) * max(0, 1 - x / 5) * nz[int(x * SR) % SR] * (0.5 + 0.5 * math.sin(2*math.pi*7*x)))  # rocket rumble

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
