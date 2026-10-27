"""Render audio.json (from gen.js) into MP3 tracks with macOS `say`, inserting the test's answer pauses.
Usage: python3 audio.py <workdir>/print <output mp3 dir> "<album title>"
"""
import json, sys, wave, hashlib, subprocess, os
from concurrent.futures import ThreadPoolExecutor

HERE = os.path.abspath(sys.argv[1])
OUT = sys.argv[2]
ALBUM = sys.argv[3]
# shared across tests so re-rendering after small script edits only synthesizes the changed lines
CACHE = os.path.expanduser('~/.cache/toeic-mock-test/seg')
os.makedirs(CACHE, exist_ok=True)
RATE = 22050
# US / UK / AU accents, like the real test's mix of speakers
VOICES = {'N': 'Reed (영어(미국))', 'W': 'Samantha', 'W2': 'Karen', 'M': 'Daniel (영어(영국))', 'M2': 'Eddy (영어(미국))'}
WPM = '160'

tracks = json.load(open(os.path.join(HERE, 'audio.json')))

def seg_path(v, t):
    return os.path.join(CACHE, hashlib.md5(f'{v}|{t}'.encode()).hexdigest() + '.wav')

def render(job):
    v, t = job
    p = seg_path(v, t)
    if not os.path.exists(p):
        subprocess.run(['say', '-v', VOICES[v], '-r', WPM, '--file-format=WAVE', f'--data-format=LEI16@{RATE}', '-o', p, t], check=True)

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
