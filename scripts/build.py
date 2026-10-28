"""Turn <workdir>/data.js into the finished test folder: 3 PDFs + MP3s + .source backup. Works on macOS and Windows.
Usage: python3 build.py <workdir> <output folder> [--no-audio]
  --no-audio: skip MP3 rendering (use when only RC/print layout changed; existing MP3s are kept)
"""
import os, shutil, subprocess, sys
from pathlib import Path

sys.stdout.reconfigure(encoding='utf-8')
HERE = Path(__file__).resolve().parent
W, OUT = Path(sys.argv[1]).resolve(), Path(sys.argv[2])
AUDIO = len(sys.argv) < 4 or sys.argv[3] != '--no-audio'

def find_chrome():
    for p in ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
              *(os.path.join(os.environ.get(v, ''), r'Google\Chrome\Application\chrome.exe')
                for v in ('PROGRAMFILES', 'PROGRAMFILES(X86)', 'LOCALAPPDATA'))]:
        if os.path.exists(p): return p
    sys.exit('Google Chrome을 찾지 못했어요. 크롬을 설치해 주세요.')

subprocess.run(['node', str(HERE / 'gen.js'), str(W)], check=True)
P, chrome = W / 'print', find_chrome()
for f in ['booklet', 'answersheet', 'answerkey']:
    subprocess.run([chrome, '--headless=new', '--disable-gpu', '--no-pdf-header-footer',
                    f'--print-to-pdf={P / f"{f}.pdf"}', (P / f'{f}.html').as_uri()], check=True, stderr=subprocess.DEVNULL)

(OUT / '.source').mkdir(parents=True, exist_ok=True)
for f, name in [('booklet', '1_문제지'), ('answersheet', '2_답안지(OMR)'), ('answerkey', '3_정답_스크립트_해설')]:
    shutil.copy(P / f'{f}.pdf', OUT / f'{name}.pdf')
for f in [W / 'data.js', HERE / 'gen.js', HERE / 'audio.py']:
    shutil.copy(f, OUT / '.source')
# pdfinfo comes with poppler; it's only a page-count report, so skip it if poppler isn't installed
if shutil.which('pdfinfo'):
    for f in ['booklet', 'answersheet', 'answerkey']:
        info = subprocess.run(['pdfinfo', str(P / f'{f}.pdf')], capture_output=True, text=True).stdout
        print(f'{f}.pdf:', next((l.split()[1] for l in info.splitlines() if l.startswith('Pages')), '?'), 'pages')

if AUDIO:
    album = subprocess.run(['node', '-e', 'const fs=require("fs"),vm=require("vm");const m=vm.runInNewContext(fs.readFileSync(process.argv[1],"utf8")+";typeof META===\\"undefined\\"?{}:META");console.log(`TOEIC 실전 모의고사 ${m.n||1}회${m.level?` (${m.level})`:""}`)',
                            str(W / 'data.js')], check=True, capture_output=True, encoding='utf-8').stdout.strip()
    subprocess.run([sys.executable, str(HERE / 'audio.py'), str(P), str(OUT / '듣기음원'), album], check=True)
print(f'done → {OUT}')
