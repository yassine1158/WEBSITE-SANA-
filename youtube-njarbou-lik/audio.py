# Synthesizes the soundtrack: soft arpeggio bed + countdown ticks + reveal ding
import math, re, struct, wave, sys
SR = 44100
page = open(sys.argv[1] if len(sys.argv) > 1 else 'short.html', encoding='utf-8').read()  # python3 audio.py [short2.html]
INTRO, QLEN, OUTRO = map(float, re.search(r'const INTRO = ([\d.]+), QLEN = ([\d.]+), OUTRO = ([\d.]+)', page).groups())
m = re.search(r'const COUNT0 = ([\d.]+), COUNT = (\d+)', page)
COUNT0, COUNT = (float(m.group(1)), int(m.group(2))) if m else (1.5, 5)
NQ = page.count('{ q:')
TOTAL = INTRO + NQ * QLEN + OUTRO
buf = [0.0] * int(TOTAL * SR)

def tone(t0, dur, freq, vol, decay):
    s0 = int(t0 * SR)
    for i in range(int(dur * SR)):
        if s0 + i >= len(buf): break
        x = i / SR
        buf[s0 + i] += vol * math.sin(2 * math.pi * freq * x) * math.exp(-x * decay)

# background: A minor arpeggio, eighth notes at 110 bpm
notes = [220.0, 261.63, 329.63, 392.0, 329.63, 261.63]
step = 60 / 110 / 2
t, k = 0.0, 0
while t < TOTAL - 0.5:
    tone(t, step * 1.6, notes[k % len(notes)], 0.06, 5)
    if k % 8 == 0: tone(t, 0.5, 110.0, 0.08, 4)
    t += step; k += 1

for q in range(NQ):
    s = INTRO + q * QLEN
    for j in range(COUNT):
        tone(s + COUNT0 + j, 0.08, 1500 if j < COUNT - 2 else 1900, 0.35, 40)
    tone(s + COUNT0 + COUNT, 0.9, 1046.5, 0.3, 4)
    tone(s + COUNT0 + COUNT + 0.12, 0.9, 1568.0, 0.25, 4)
tone(INTRO + NQ * QLEN, 1.2, 784.0, 0.2, 3)

# fade out at the end
for i in range(int(SR * 1.0)):
    buf[-1 - i] *= i / SR
peak = max(abs(v) for v in buf)
with wave.open('audio.wav', 'w') as w:
    w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
    w.writeframes(b''.join(struct.pack('<h', int(v / peak * 0.9 * 32767)) for v in buf))
print('ok', TOTAL)
