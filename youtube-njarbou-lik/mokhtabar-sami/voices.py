# Tunisian voices for an episode's dialogue: Microsoft Edge neural TTS (free, ar-TN voices) + cartoon effects.
# Usage: python3 voices.py ep1_ai.html   -> voices/ep1_ai/NN.wav (22050 Hz mono), then python3 audio.py ep1_ai.html
import asyncio, os, re, subprocess, sys
import certifi
if os.path.exists('/root/.ccr/ca-bundle.crt'):  # session proxy CA (edge_tts pins certifi's bundle)
    certifi.where = lambda: '/root/.ccr/ca-bundle.crt'
import edge_tts

VOICE = {
    'sami': dict(voice='ar-TN-ReemNeural', pitch='+30Hz', rate='+6%'),   # kid: Reem pitched up
    'bip':  dict(voice='ar-TN-HediNeural', pitch='+12Hz', rate='+4%'),   # robot: Hedi + robot filter below
}
FX = {
    'sami': 'highpass=f=120,acompressor=threshold=-18dB:ratio=3,volume=1.2',
    'bip':  ("asplit[d][r];[r]afftfilt=real='hypot(re,im)':imag='0':win_size=512:overlap=0.75,volume=0.7[rb];"
             "[d][rb]amix=inputs=2:weights='0.75 0.6',flanger=delay=2:depth=1.5:speed=0.6,aecho=0.8:0.5:14:0.25,"
             "highpass=f=150,acompressor=threshold=-18dB:ratio=3"),
}
# how a line is read aloud when the bubble text doesn't say it well
SPOKEN = {
    '4.5 مليار': 'أربعة مليار ونص',
    'قريب 1 كيلومتر': 'قريب كيلومتر',
    'بيب بوب؟': 'بيب بوب؟',
}

page = sys.argv[1]
html = open(page, encoding='utf-8').read()
LINES = [(float(a), float(b), w, txt) for a, b, w, txt in re.findall(r"\[([\d.]+), ([\d.]+), '(\w+)', '([^']*)'\]", html)]
out_dir = f'voices/{os.path.splitext(os.path.basename(page))[0]}'
os.makedirs(out_dir, exist_ok=True)

def spoken(txt):
    for k, v in SPOKEN.items():
        txt = txt.replace(k, v)
    txt = re.sub(r'[\U0001F000-\U0001FFFF☀-➿️]', '', txt)  # emojis
    return txt.replace('…', '، ').strip()

def duration(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]))

async def main():
    for i, (t0, t1, who, txt) in enumerate(LINES):
        raw, wav = f'{out_dir}/{i:02d}.mp3', f'{out_dir}/{i:02d}.wav'
        v = VOICE[who]
        await edge_tts.Communicate(spoken(txt), v['voice'], pitch=v['pitch'], rate=v['rate']).save(raw)
        # fit the line into its slot (keep 0.2s of air before the next line)
        tempo = max(1.0, duration(raw) / (t1 - t0 - 0.2))
        if tempo > 1.2:
            print(f'  ! line {i} needs x{tempo:.2f} to fit, shorten its text', file=sys.stderr)
        af = f'atempo={tempo:.3f},' if tempo > 1.0 else ''
        subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-filter_complex', af + FX[who] + ',loudnorm=I=-17:TP=-2',
                        '-ar', '22050', '-ac', '1', wav], check=True)
        os.remove(raw)
        print(f'{i:02d} {who:4s} {t1 - t0:4.1f}s slot  {duration(wav):4.2f}s voice  x{tempo:.2f}  {spoken(txt)}')

asyncio.run(main())
