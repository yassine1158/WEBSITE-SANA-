# Tunisian Derja voices for an episode's dialogue, then cartoon effects.
# TTS: silma-tts-derja (F5-TTS fine-tuned on Tunisian Derja, https://huggingface.co/Ghazouaniwala/silma-tts-derja,
# CC-BY-NC-4.0), run locally on CPU (~30s per take). F5 clones the voice of a short reference clip; the references
# are synthetic Microsoft Edge ar-TN voices (no real person's voice is cloned).
# Each line is synthesized with a few seeds and the take whose Whisper transcript is closest to the script is kept.
# Setup: pip install f5-tts edge-tts faster-whisper soundfile (CPU torch: --index-url https://download.pytorch.org/whl/cpu)
# Usage: python3 voices.py ep1_ai.html [line numbers...]  -> voices/ep1_ai/NN.wav (22050 Hz mono)
import asyncio, difflib, os, re, subprocess, sys
import certifi
if os.path.exists('/root/.ccr/ca-bundle.crt'):  # session proxy CA (edge_tts pins certifi's bundle)
    certifi.where = lambda: '/root/.ccr/ca-bundle.crt'
import edge_tts, numpy as np, soundfile as sf, torch, torchaudio
from huggingface_hub import snapshot_download

def _load(path, *a, **k):  # torchaudio.load needs torchcodec, which doesn't load everywhere
    d, sr = sf.read(path, dtype='float32', always_2d=True)
    return torch.from_numpy(d.T.copy()), sr
torchaudio.load = _load

REF_TEXT = 'آهلا بيكم، اليوم باش نحكيولكم على حاجة باهية برشا.'
REF_VOICE = {'sami': 'ar-TN-ReemNeural', 'bip': 'ar-TN-HediNeural'}
FX = {  # Sami: pitched up to a kid's voice; Bip: robot
    'sami': 'asetrate=22050*1.16,aresample=22050,atempo=1/1.16,highpass=f=120,acompressor=threshold=-18dB:ratio=3',
    'bip':  ("asplit[d][r];[r]afftfilt=real='hypot(re,im)':imag='0':win_size=512:overlap=0.75,volume=0.7[rb];"
             "[d][rb]amix=inputs=2:weights='0.75 0.6',flanger=delay=2:depth=1.5:speed=0.6,aecho=0.8:0.5:14:0.25,"
             "highpass=f=150,acompressor=threshold=-18dB:ratio=3"),
}
SPOKEN = {'4.5 مليار': 'أربعة مليار ونص', 'قريب 1 كيلومتر': 'قريب كيلومتر'}
SEEDS = (1, 2, 3)

page = sys.argv[1]
only = {int(x) for x in sys.argv[2:]}
html = open(page, encoding='utf-8').read()
LINES = [(float(a), float(b), w, txt) for a, b, w, txt in re.findall(r"\[([\d.]+), ([\d.]+), '(\w+)', '([^']*)'\]", html)]
out_dir = f'voices/{os.path.splitext(os.path.basename(page))[0]}'
os.makedirs(out_dir, exist_ok=True)

def spoken(txt):
    for k, v in SPOKEN.items():
        txt = txt.replace(k, v)
    txt = re.sub(r'[\U0001F000-\U0001FFFF☀-➿️]', '', txt)  # emojis
    return re.sub(r'\s+', ' ', txt.replace('…', '، ')).strip()

def norm(txt):  # compare letters only, folding what Whisper (trained on MSA) mixes up in Derja
    txt = re.sub(r'[^ء-ي]', '', txt)
    return txt.translate(str.maketrans('أإآةىط', 'اااهيت'))

def duration(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]))

async def references():
    for who, voice in REF_VOICE.items():
        path = f'voices/ref_{who}.wav'
        if not os.path.exists(path):
            await edge_tts.Communicate(REF_TEXT, voice).save(path + '.mp3')
            subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', path + '.mp3', '-ar', '24000', '-ac', '1', path], check=True)
            os.remove(path + '.mp3')
asyncio.run(references())

from f5_tts.api import F5TTS
import f5_tts
from faster_whisper import WhisperModel
ckpt = snapshot_download('Ghazouaniwala/silma-tts-derja')
cfg = os.path.join(list(f5_tts.__path__)[0], 'configs', 'SilmaDerja.yaml')
if not os.path.exists(cfg):
    import shutil; shutil.copy(f'{ckpt}/config.yaml', cfg)
tts = F5TTS(model='SilmaDerja', ckpt_file=f'{ckpt}/model.pt', vocab_file=f'{ckpt}/vocab.txt', device='cpu', use_ema=False)
asr = WhisperModel('small', device='cpu', compute_type='int8')

for i, (t0, t1, who, txt) in enumerate(LINES):
    if only and i not in only:
        continue
    text, best = spoken(txt), None
    for seed in SEEDS:
        audio, sr, _ = tts.infer(ref_file=f'voices/ref_{who}.wav', ref_text=REF_TEXT, gen_text=text, nfe_step=32, seed=seed)
        a16 = np.interp(np.arange(0, len(audio), sr / 16000), np.arange(len(audio)), audio).astype(np.float32)
        heard = ' '.join(s.text for s in asr.transcribe(a16, language='ar', beam_size=3)[0])
        score = difflib.SequenceMatcher(None, norm(text), norm(heard)).ratio()
        print(f'  {i:02d} seed {seed}: {score:.2f} {heard.strip()}', flush=True)
        if not best or score > best[0]:
            best = (score, audio, sr)
    raw, wav = f'{out_dir}/{i:02d}.raw.wav', f'{out_dir}/{i:02d}.wav'
    sf.write(raw, best[1], best[2])
    # fit the line into its slot (keep 0.2s of air before the next line)
    tempo = max(1.0, duration(raw) / (t1 - t0 - 0.2))
    if tempo > 1.2:
        print(f'  ! line {i} needs x{tempo:.2f} to fit, shorten its text', file=sys.stderr)
    af = f'atempo={tempo:.3f},' if tempo > 1.0 else ''
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-i', raw, '-filter_complex', af + FX[who] + ',loudnorm=I=-17:TP=-2',
                    '-ar', '22050', '-ac', '1', wav], check=True)
    os.remove(raw)
    print(f'{i:02d} {who:4s} {t1 - t0:4.1f}s slot  {duration(wav):4.2f}s voice  x{tempo:.2f}  match {best[0]:.2f}  {text}', flush=True)
