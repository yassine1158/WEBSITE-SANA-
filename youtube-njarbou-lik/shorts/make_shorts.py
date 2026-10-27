# Builds one float-or-sink Short per question in questions.json: shorts/njarbou_lik_qNN.mp4
# Run from youtube-njarbou-lik/: python3 shorts/make_shorts.py [numbers...]   (needs node + playwright, ffmpeg)
import json, os, shutil, subprocess, sys

QS = json.load(open('shorts/questions.json', encoding='utf-8'))
TEMPLATE = open('shorts/template.html', encoding='utf-8').read()
only = {int(x) for x in sys.argv[1:]}
node = dict(os.environ, NODE_PATH=subprocess.check_output(['npm', 'root', '-g'], text=True).strip())

for n, q in enumerate(QS, 1):
    if only and n not in only:
        continue
    page = f'shorts/q{n:02d}.html'
    with open(page, 'w', encoding='utf-8') as f:
        f.write(TEMPLATE.replace('/*Q*/', json.dumps(q, ensure_ascii=False)))
    shutil.rmtree('frames', ignore_errors=True)
    subprocess.run(['node', 'render.js', '30'], env=dict(node, PAGE=page), check=True, capture_output=True)
    subprocess.run(['python3', 'audio.py', page], check=True, capture_output=True)
    out = f'shorts/njarbou_lik_q{n:02d}.mp4'
    subprocess.run(['ffmpeg', '-v', 'error', '-y', '-framerate', '30', '-i', 'frames/f%05d.jpg', '-i', 'audio.wav',
                    '-c:v', 'libx264', '-preset', 'slow', '-pix_fmt', 'yuv420p', '-crf', '20', '-c:a', 'aac', '-b:a', '160k',
                    '-movflags', '+faststart', '-shortest', out], check=True)
    print(n, out, q['title'], flush=True)
