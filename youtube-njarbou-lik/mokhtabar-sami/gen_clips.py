# AI video clips of Sami and Bip, animated from sami_bip_keyart.png on a free HF ZeroGPU Space (Wan 2.2 i2v).
# Usage: HF_TOKEN=... [DURATION=5] python3 gen_clips.py [clip names...]   (existing clips/<name>.mp4 are skipped)
# Talks to the Gradio queue over plain HTTP: gradio_client's SSE stream gets cancelled behind some proxies.
import json, os, sys, uuid
import httpx
from PIL import Image

SPACE = 'https://zerogpu-aoti-wan2-2-fp8da-aoti-faster.hf.space/gradio_api'
STYLE = 'The robot has one single round glowing cyan eye. 3D Pixar-style animation, consistent characters, same lab background, smooth natural motion, static camera'
CLIPS = {
    'intro':    'The boy in the red chechia looks up from his tablet and talks excitedly to the floating white robot, gesturing with one hand. The robot bobs gently in the air and blinks its glowing cyan eye.',
    'question': 'The boy in the red chechia looks puzzled, scratches his head and points up at the Moon on the big screen behind him while talking. The robot hovers and tilts its head.',
    'bip_talk': 'The floating white robot turns toward the boy and talks, its cyan eye glowing and pulsing, its little arms waving as it explains. The boy listens and nods.',
    'shock':    'The boy in the red chechia gasps in amazement, eyes wide and mouth open, both hands on his cheeks. The robot bounces happily in the air.',
    'cheer':    'The boy in the red chechia smiles big and gives a thumbs up, then points at the toy rocket on the desk. The robot spins happily and its red antenna light blinks.',
}
DURATION = float(os.environ.get('DURATION', 5))  # seconds; a free account gets roughly one 5s clip a day
NEG = 'blurry, distorted face, extra fingers, deformed hands, morphing, text, subtitles, watermark, static image, camera shake'

os.makedirs('clips', exist_ok=True)
src = 'clips/keyart_768.png'
if not os.path.exists(src):
    Image.open('sami_bip_keyart.png').convert('RGB').resize((768, 1376), Image.LANCZOS).save(src)

with httpx.Client(timeout=600, headers={'Authorization': 'Bearer ' + os.environ['HF_TOKEN']}) as c:
    # the Space runs several replicas: pin upload, job and download to one of them
    cfg = c.get(SPACE.replace('/gradio_api', '/config'))
    SPACE = SPACE.replace('/gradio_api', f"/--replicas/{cfg.headers['x-proxied-replica']}/gradio_api")
    fn = next(d['id'] for d in cfg.json()['dependencies'] if d.get('api_name') == 'generate_video')
    up = c.post(SPACE + '/upload', files={'files': open(src, 'rb')}).json()[0]
    img = {'path': up, 'orig_name': 'keyart.png', 'meta': {'_type': 'gradio.FileData'}}
    for name in sys.argv[1:] or CLIPS:
        out = f'clips/{name}.mp4'
        if os.path.exists(out):
            continue
        # image, prompt, steps, negative, duration, guidance, guidance_2, seed, randomize
        args = [img, f'{CLIPS[name]} {STYLE}', 6, NEG, DURATION, 1, 1, 42, False]
        session = uuid.uuid4().hex[:10]
        c.post(SPACE + '/queue/join', json={'data': args, 'fn_index': fn, 'session_hash': session})
        with c.stream('GET', f'{SPACE}/queue/data?session_hash={session}') as s:
            for line in s.iter_lines():
                msg = json.loads(line[5:]) if line.startswith('data:') else {}
                if msg.get('msg') == 'process_completed':
                    break
        if not msg.get('success'):  # e.g. "You have exceeded your free ZeroGPU quota (105s requested vs. 91s left)"
            sys.exit(f"{name}: {msg.get('output', {}).get('error')}")
        with open(out, 'wb') as f:
            f.write(c.get(msg['output']['data'][0]['url']).content)
        print(name, out, flush=True)
