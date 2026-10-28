"""Render audio.json (from gen.js) into MP3 tracks, inserting the test's answer pauses.
Voices come from macOS `say`, or on Windows from Microsoft Edge's online voices (edge-tts, needs internet).
Usage: python3 audio.py <workdir>/print <output mp3 dir> "<album title>"
"""
import json, sys, wave, hashlib, subprocess, os
from concurrent.futures import ThreadPoolExecutor

sys.stdout.reconfigure(encoding='utf-8')
HERE = os.path.abspath(sys.argv[1])
OUT = sys.argv[2]
ALBUM = sys.argv[3]
MAC = sys.platform == 'darwin'
# shared across tests so re-rendering after small script edits only synthesizes the changed lines
CACHE = os.path.expanduser('~/.cache/toeic-mock-test/seg')
os.makedirs(CACHE, exist_ok=True)
RATE = 22050
# US / UK / AU accents, like the real test's mix of speakers
if MAC:
    VOICES = {'N': 'Reed (영어(미국))', 'W': 'Samantha', 'W2': 'Karen', 'M': 'Daniel (영어(영국))', 'M2': 'Eddy (영어(미국))'}
else:
    VOICES = {'N': 'en-US-GuyNeural', 'W': 'en-US-JennyNeural', 'W2': 'en-AU-NatashaNeural', 'M': 'en-GB-RyanNeural', 'M2': 'en-US-ChristopherNeural'}
    VENV = os.path.expanduser('~/.cache/toeic-mock-test/ttsenv')
    BIN = os.path.join(VENV, 'Scripts' if os.name == 'nt' else 'bin')
    EDGE = os.path.join(BIN, 'edge-tts' + ('.exe' if os.name == 'nt' else ''))
    if not os.path.exists(EDGE):
        subprocess.run([sys.executable, '-m', 'venv', VENV], check=True)
        subprocess.run([os.path.join(BIN, 'python'), '-m', 'pip', '-q', 'install', 'edge-tts'], check=True)
WPM = '160'
EDGE_RATE = '+10%'  # Edge voices speak slower than `say` at 160 wpm; this keeps the LC near the real 45 minutes

tracks = json.load(open(os.path.join(HERE, 'audio.json'), encoding='utf-8'))

def seg_path(v, t):
    key = f'{v}|{t}' if MAC else f'edge{EDGE_RATE}|{v}|{t}'
    return os.path.join(CACHE, hashlib.md5(key.encode()).hexdigest() + '.wav')

def render(job):
    v, t = job
    p = seg_path(v, t)
    if os.path.exists(p): return
    if MAC:
        subprocess.run(['say', '-v', VOICES[v], '-r', WPM, '--file-format=WAVE', f'--data-format=LEI16@{RATE}', '-o', p, t], check=True)
        return
    mp3 = p[:-4] + '.mp3'
    for attempt in range(3):  # online service: retry brief network hiccups
        r = subprocess.run([EDGE, '--voice', VOICES[v], f'--rate={EDGE_RATE}', f'--text={t}', '--write-media', mp3], capture_output=True, text=True, encoding='utf-8', errors='replace')
        if r.returncode == 0: break
    else:
        raise RuntimeError(f'음성을 만들지 못했어요(인터넷 연결을 확인해 주세요): {t[:40]}\n{r.stderr}')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', mp3, '-ac', '1', '-ar', str(RATE), '-sample_fmt', 's16', p], check=True)
    os.remove(mp3)

jobs = {(s[0], s[1]) for tr in tracks.values() for s in tr if len(s) == 2}
with ThreadPoolExecutor(8) as ex:
    list(ex.map(render, jobs))

NAMES = {'full': 'LC_전체', 'part1': 'Part1_사진묘사', 'part2': 'Part2_질의응답', 'part3': 'Part3_짧은대화', 'part4': 'Part4_짧은담화'}
os.makedirs(OUT, exist_ok=True)
for key, segs in tracks.items():
    tmp = os.path.join(HERE, key + '.wav')
    with wave.open(tmp, 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes(b'\0\0' * int(RATE * 1.0))
        for s in segs:
            if len(s) == 1:
                w.writeframes(b'\0\0' * int(RATE * s[0]))
            else:
                with wave.open(seg_path(*s)) as r:
                    assert r.getframerate() == RATE and r.getnchannels() == 1 and r.getsampwidth() == 2
                    w.writeframes(r.readframes(r.getnframes()))
        w.writeframes(b'\0\0' * int(RATE * 2.0))
    mp3 = os.path.join(OUT, f'{NAMES[key]}.mp3')
    subprocess.run(['ffmpeg', '-y', '-loglevel', 'error', '-i', tmp, '-codec:a', 'libmp3lame', '-b:a', '64k',
                    '-metadata', f'title={NAMES[key]}', '-metadata', f'album={ALBUM}', mp3], check=True)
    with wave.open(tmp) as r:
        sec = r.getnframes() / RATE
    print(f'{NAMES[key]}.mp3  {int(sec // 60)}:{int(sec % 60):02d}')
    os.remove(tmp)
