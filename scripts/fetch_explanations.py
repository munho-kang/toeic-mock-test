"""Download the Korean auto-captions of the latest official TOEIC past-exam explanation videos
(한국토익위원회 실제기출 공개영상) and turn each into a plain-text transcript.

Usage: python3 -I fetch_explanations.py <out dir> [part filter, e.g. "PART 5"]
Writes <out dir>/videos.tsv and <out dir>/NN_<title>.txt. Captions are cached in ~/.cache/toeic-mock-test/subs,
so re-runs (and later tests) don't hit YouTube again — YouTube answers 429 if asked too fast.
"""
import html, os, re, subprocess, sys, time, urllib.request

PAGE = 'https://exam.toeic.co.kr/content/common/realQuestion.php'
HOME = os.path.expanduser('~/.cache/toeic-mock-test')
VENV, SUBS = os.path.join(HOME, 'ytenv'), os.path.join(HOME, 'subs')
YTDLP = os.path.join(VENV, 'bin', 'yt-dlp')
out = sys.argv[1]
only = sys.argv[2].upper() if len(sys.argv) > 2 else ''
os.makedirs(out, exist_ok=True); os.makedirs(SUBS, exist_ok=True)

if not os.path.exists(YTDLP):
    subprocess.run([sys.executable, '-m', 'venv', VENV], check=True)
    subprocess.run([os.path.join(VENV, 'bin', 'pip'), '-q', 'install', 'yt-dlp'], check=True)

req = urllib.request.Request(PAGE, headers={'User-Agent': 'Mozilla/5.0'})
s = urllib.request.urlopen(req, timeout=30).read().decode('utf-8', 'replace')
text = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', re.sub(r'<script.*?</script>', ' ', s, flags=re.S))))
m = re.search(r'(\d+차) 공개', text)
m2 = re.search(r'(\d{4}년 [상하]반기)[^ ]* TOEIC', text)
print('최신 공개:', m.group(1) if m else '?', '/', m2.group(1) if m2 else '?')

# The newest round is the first block of thumbnails, which ends where the "회차별" (older rounds) tabs begin.
latest = s[:s.find('회차별')] if '회차별' in s else s
vids, seen = [], set()
for mm in re.finditer(r'img\.youtube\.com/vi/([\w-]+)/hqdefault\.jpg', latest):
    vid = mm.group(1)
    if vid in seen: continue
    seen.add(vid)
    label = re.sub(r'\s+', ' ', html.unescape(re.sub(r'<[^>]+>', ' ', latest[mm.end():mm.end() + 300]))).strip()
    label = re.match(r'"?[^>]*>?\s*(PART [^<]*?)(?: RC| LC|$| <)', label)
    vids.append((vid, (label.group(1) if label else '?').strip()))

with open(os.path.join(out, 'videos.tsv'), 'w') as f:
    f.writelines(f'{v}\t{t}\n' for v, t in vids)

def clean(vtt):
    lines, prev = [], None
    for ln in open(vtt, encoding='utf-8'):
        ln = re.sub(r'<[^>]+>', '', ln).strip()
        if not ln or '-->' in ln or ln.startswith(('WEBVTT', 'Kind:', 'Language:')) or ln == prev: continue
        lines.append(ln); prev = ln
    seen_l = set()
    return ' '.join(l for l in lines if not (l in seen_l or seen_l.add(l)))

for i, (vid, title) in enumerate(vids, 1):
    if only and not title.upper().startswith(only): continue
    vtt = os.path.join(SUBS, f'{vid}.ko.vtt')
    for attempt in range(4):
        if os.path.exists(vtt): break
        r = subprocess.run([YTDLP, '-q', '--skip-download', '--write-auto-subs', '--sub-langs', 'ko', '--sub-format', 'vtt',
                            '-o', os.path.join(SUBS, vid), f'https://www.youtube.com/watch?v={vid}'], capture_output=True, text=True)
        if os.path.exists(vtt): break
        wait = 30 * (attempt + 1) if '429' in r.stderr else 5
        print(f'  {vid} 실패, {wait}초 뒤 다시 시도: {r.stderr.strip().splitlines()[-1:]}')
        time.sleep(wait)
    else:
        print(f'  {vid} ({title}) 자막을 받지 못했어요. 건너뜀'); continue
    name = os.path.join(out, f'{i:02d}_{re.sub(r"[^0-9A-Za-z가-힣]+", "_", title).strip("_")}.txt')
    open(name, 'w').write(clean(vtt))
    print(f'{os.path.basename(name)}  {os.path.getsize(name) // 1000}KB')
    time.sleep(8)  # stay under YouTube's rate limit
