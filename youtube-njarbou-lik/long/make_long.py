# Builds a long 16:9 narrated video from a facts file: long/<name>.mp4
# Voice: Microsoft Edge neural TTS (free), Tunisian voice reading Modern Standard Arabic; the timeline follows the voice.
# Run from youtube-njarbou-lik/: python3 long/make_long.py long/space_facts.json [--preview]
import asyncio, json, os, re, shutil, subprocess, sys
import certifi
if os.path.exists('/root/.ccr/ca-bundle.crt'):  # session proxy CA (edge_tts pins certifi's bundle)
    certifi.where = lambda: '/root/.ccr/ca-bundle.crt'
import edge_tts

VOICE, RATE = 'ar-TN-HediNeural', '+0%'
src = sys.argv[1]
name = os.path.splitext(os.path.basename(src))[0]
D = json.load(open(src, encoding='utf-8'))
vdir = f'long/voice/{name}'
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

# soundtrack: a soft space drone under the voice
inputs, chains = ['-f', 'lavfi', '-t', str(t), '-i',
                  "aevalsrc='0.05*sin(2*PI*110*t)*(0.6+0.4*sin(2*PI*0.05*t))+0.04*sin(2*PI*164.81*t)*(0.6+0.4*sin(2*PI*0.037*t))"
                  "+0.03*sin(2*PI*220.5*t)*(0.5+0.5*sin(2*PI*0.071*t))':s=44100"], ['[1:a]lowpass=f=900,volume=0.6[m]']
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
