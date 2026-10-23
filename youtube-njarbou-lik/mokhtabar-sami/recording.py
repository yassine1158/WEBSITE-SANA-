# Dialogue voices from your own recording -> voices/<page>/NN.wav, mixed in by audio.py.
# Record the lines in order (skip Bip's beep-only lines like "بيب بوب", audio.py beeps those), with about one second
# of silence between lines, in your normal voice: Sami is pitched up to a kid's voice, Bip gets a robot filter.
# Usage: python3 recording.py ep1_ai.html rec.m4a              one file: split on the silences
#        python3 recording.py ep1_ai.html l01.m4a l02.m4a ...  one file per line, in order
# SAMI_PITCH (default 1.35) and BIP_PITCH (default 1.0) tune the voices, e.g. SAMI_PITCH=1.15 for a higher voice.
import os, re, subprocess, sys, tempfile

SR = 22050
SAMI_PITCH = float(os.environ.get('SAMI_PITCH', 1.35))
BIP_PITCH = float(os.environ.get('BIP_PITCH', 1.0))
CLEAN = 'highpass=f=80,afftdn=nf=-25'
FX = {
    # formants up a little (asetrate), the rest of the pitch with formants kept: a kid, not a chipmunk
    'sami': f'asetrate={SR}*1.12,aresample={SR},atempo=1/1.12,rubberband=pitch={SAMI_PITCH / 1.12:.3f}:formant=preserved,'
            'acompressor=threshold=-18dB:ratio=3',
    'bip': (f"rubberband=pitch={BIP_PITCH},asplit[d][r];"
            "[r]afftfilt=real='hypot(re,im)':imag='0':win_size=512:overlap=0.75,volume=0.7[rb];"
            "[d][rb]amix=inputs=2:weights='0.75 0.6',flanger=delay=2:depth=1.5:speed=0.6,aecho=0.8:0.5:14:0.25,"
            "highpass=f=150,acompressor=threshold=-18dB:ratio=3"),
}

page, inputs = sys.argv[1], sys.argv[2:]
html = open(page, encoding='utf-8').read()
LINES = [(float(a), float(b), w, txt) for a, b, w, txt in re.findall(r"\[([\d.]+), ([\d.]+), '(\w+)', '([^']*)'\]", html)]
beeps = lambda txt: re.fullmatch(r'((بيب|بوب)[\s!؟?…،]*)+', re.sub(r'[\U0001F000-\U0001FFFF☀-➿️]', '', txt).strip())
spoken = [i for i, l in enumerate(LINES) if not beeps(l[3])]
out_dir = f'voices/{os.path.splitext(os.path.basename(page))[0]}'
os.makedirs(out_dir, exist_ok=True)
tmp = tempfile.mkdtemp()

def ffmpeg(*args):
    return subprocess.run(['ffmpeg', '-hide_banner', '-nostats', '-y', *args], check=True, capture_output=True, text=True).stderr

def duration(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]))

def silences(path, noise=-35, gap=0.3):
    log = ffmpeg('-i', path, '-af', f'silencedetect=noise={noise}dB:d={gap}', '-f', 'null', '-')
    starts = [float(x) for x in re.findall(r'silence_start: ([\d.]+)', log)]
    ends = [float(x) for x in re.findall(r'silence_end: ([\d.]+)', log)] + [duration(path)]
    return list(zip(starts, ends))

if len(inputs) == 1:
    src = f'{tmp}/all.wav'
    ffmpeg('-i', inputs[0], '-ac', '1', '-ar', str(SR), src)
    total, quiet = duration(src), silences(src)
    head = quiet[0][1] if quiet and quiet[0][0] < 0.05 else 0.0
    tail = quiet[-1][0] if quiet and quiet[-1][1] > total - 0.05 else total
    # the longest pauses inside the recording are the breaks between lines (pauses within a line are shorter)
    inner = sorted((q for q in quiet if q[0] > head and q[1] < tail), key=lambda q: q[1] - q[0], reverse=True)
    if len(inner) < len(spoken) - 1:
        sys.exit(f'only {len(inner) + 1} pieces for {len(spoken)} lines: leave a clear pause between lines, or send one file per line')
    cuts = sorted(inner[:len(spoken) - 1])
    edges = [head] + [x for q in cuts for x in q] + [tail]
    segs = [(edges[k], edges[k + 1]) for k in range(0, len(edges), 2)]
    pieces = []
    for k, (a, b) in enumerate(segs):
        ffmpeg('-i', src, '-ss', f'{max(0, a - 0.08):.3f}', '-to', f'{b + 0.12:.3f}', f'{tmp}/{k}.wav')
        pieces.append(f'{tmp}/{k}.wav')
else:
    if len(inputs) != len(spoken):
        sys.exit(f'{len(inputs)} files for {len(spoken)} lines')
    pieces = []
    for k, path in enumerate(inputs):  # trim the silence around each take
        ffmpeg('-i', path, '-ac', '1', '-ar', str(SR), '-af',
               'silenceremove=start_periods=1:start_threshold=-40dB,areverse,silenceremove=start_periods=1:start_threshold=-40dB,areverse',
               f'{tmp}/{k}.wav')
        pieces.append(f'{tmp}/{k}.wav')

for f in os.listdir(out_dir):
    os.remove(f'{out_dir}/{f}')
for k, (i, piece) in enumerate(zip(spoken, pieces)):
    t0, t1, who, txt = LINES[i]
    # fit the line into its slot (keep 0.2s of air before the next line)
    tempo = max(1.0, duration(piece) / (t1 - t0 - 0.2))
    warn = '  <- too long, say it faster' if tempo > 1.25 else ''
    af = f'{CLEAN},' + (f'atempo={tempo:.3f},' if tempo > 1.0 else '') + FX[who] + ',loudnorm=I=-17:TP=-2'
    ffmpeg('-i', piece, '-filter_complex', af, '-ar', str(SR), '-ac', '1', '-sample_fmt', 's16', f'{out_dir}/{i:02d}.wav')
    print(f'{i:02d} {who:4s} {duration(piece):4.1f}s in a {t1 - t0:3.1f}s slot  x{tempo:.2f}{warn}  {txt}')
