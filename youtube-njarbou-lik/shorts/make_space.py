# Builds one space Short per question in space.json, with a voice-over: shorts/njarbou_lik_spaceNN.mp4
# The voice (Microsoft Edge neural TTS, free, Tunisian voice ar-TN-HediNeural) reads say_q, then say_a after the
# reveal; the Short's timings stretch to fit what it reads.
# Run from youtube-njarbou-lik/: python3 shorts/make_space.py [numbers...]   (needs node + playwright, ffmpeg, edge-tts)
import asyncio, json, math, os, shutil, subprocess, sys
import certifi
if os.path.exists('/root/.ccr/ca-bundle.crt'):  # session proxy CA (edge_tts pins certifi's bundle)
    certifi.where = lambda: '/root/.ccr/ca-bundle.crt'
import edge_tts

VOICE, RATE = 'ar-TN-HediNeural', '+5%'
QS = json.load(open('shorts/space.json', encoding='utf-8'))
TEMPLATE = open('shorts/space_template.html', encoding='utf-8').read()
only = {int(x) for x in sys.argv[1:]}
node = dict(os.environ, NODE_PATH=subprocess.check_output(['npm', 'root', '-g'], text=True).strip())
os.makedirs('shorts/voice', exist_ok=True)

def duration(path):
    return float(subprocess.check_output(['ffprobe', '-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', path]))

for n, q in enumerate(QS, 1):
    if only and n not in only:
        continue
    vq, va = f'shorts/voice/space{n:02d}_q.mp3', f'shorts/voice/space{n:02d}_a.mp3'
    asyncio.run(edge_tts.Communicate(q['say_q'], VOICE, rate=RATE).save(vq))
    asyncio.run(edge_tts.Communicate(q['say_a'], VOICE, rate=RATE).save(va))
    dq, da = duration(vq), duration(va)
    count = max(4, math.ceil(0.35 + dq + 0.8 - 1.0))  # the countdown ends 0.8s after the question is read
    reveal = 1.0 + count
    qlen = round(reveal + 0.3 + da + 1.2 + 0.4, 2)    # answer read, a beat to read the text, then the rewind
    page = f'shorts/space{n:02d}.html'
    with open(page, 'w', encoding='utf-8') as f:
        f.write(TEMPLATE.replace('/*Q*/', json.dumps(q, ensure_ascii=False))
                .replace('/*QLEN*/', str(qlen)).replace('/*COUNT*/', str(count)))
    shutil.rmtree('frames', ignore_errors=True)
    subprocess.run(['node', 'render.js', '30'], env=dict(node, PAGE=page), check=True, capture_output=True)
    subprocess.run(['python3', 'audio.py', page], check=True, capture_output=True)  # music, ticks, ding, STOP hit
    out = f'shorts/njarbou_lik_space{n:02d}.mp4'
    ms = int((reveal + 0.3) * 1000)
    mix = (f'[1:a]volume=0.45[m];[2:a]adelay=350|350[q];[3:a]adelay={ms}|{ms}[a];'
           '[m][q][a]amix=inputs=3:normalize=0,loudnorm=I=-14:TP=-1.5[out]')
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '30', '-i', 'frames/f%05d.jpg', '-i', 'audio.wav', '-i', vq, '-i', va,
                    '-filter_complex', mix,
                    '-map', '0:v', '-map', '[out]', '-c:v', 'libx264', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-crf', '20',
                    '-c:a', 'aac', '-b:a', '160k', '-ar', '44100', '-movflags', '+faststart', '-shortest', out], check=True)
    print(n, out, f'{qlen}s', q['title'], flush=True)
