// Builds the printable test booklet / answer sheet / answer key HTML and the audio script (JSON)
// Usage: node gen.js <workdir>   (reads <workdir>/data.js, writes <workdir>/print/)
const fs = require('fs'), vm = require('vm'), path = require('path');
const D = path.resolve(process.argv[2] || '.');
const {LC, RC, META} = vm.runInNewContext(fs.readFileSync(`${D}/data.js`, 'utf8') + '\n;({LC, RC, META: typeof META === "undefined" ? {} : META})');
const OUT = path.join(D, 'print');
fs.mkdirSync(OUT, {recursive: true});
const NO = META.n || 1, LV = META.level || '', LVEN = {'고난도': 'Advanced', '기본': 'Standard'}[LV] || LV;
const T_KO = `제${NO}회${LV ? ` (${LV})` : ''}`, T_EN = `Practice Test ${NO}${LVEN ? ` (${LVEN})` : ''}`;

const UNITS = [...LC, ...RC], QS = [];
UNITS.forEach(u => u.qs.forEach(q => { q.n = QS.length + 1; q.p = u.p; QS.push(q); }));
if (QS.length !== 200) throw new Error('expected 200 questions, got ' + QS.length);

const L = 'ABCD';
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const range = u => [u.qs[0].n, u.qs[u.qs.length - 1].n];
const listWords = a => a.length === 1 ? a[0] : a.length === 2 ? `${a[0]} and ${a[1]}` : `${a.slice(0, -1).join(', ')}, and ${a[a.length - 1]}`;
const referTo = u => u.p === 3 ? `conversation${u.three ? ' with three speakers' : ''}${u.g ? ' and ' + u.g.kind : ''}`
  : u.p === 4 ? `${u.kind}${u.g ? ' and ' + u.g.kind : ''}`
  : listWords(u.ps.map(p => p.t.toLowerCase()));

const DIR = {
  general: 'This is a test of your ability to use the English language. The total time for the test is approximately two hours. The test is divided into two sections, Listening and Reading, and each section has its own directions. Try to answer as many questions as you can within the time allowed. Mark every answer on the separate answer sheet: for each question, choose the best answer from the choices given and fill in the matching space. If you change an answer, erase your first mark completely before marking the new one.',
  lc: 'In the Listening test, you will be asked to show how well you understand spoken English. The entire Listening test will last approximately 45 minutes. There are four parts, and directions are given for each part. You must mark your answers on the separate answer sheet. Do not write your answers in your test book.',
  rc: 'In the Reading test, you will read a variety of texts and answer several different types of reading comprehension questions. The entire Reading test will last 75 minutes. There are three parts, and directions are given for each part. Try to answer as many questions as possible within the time allowed. You must mark your answers on the separate answer sheet. Do not write your answers in your test book.',
  1: 'For each question in this part, you will hear four statements about a picture in your test book. When you hear the statements, you must select the one statement that best describes what you see in the picture. Then find the number of the question on your answer sheet and mark your answer. The statements will not be printed in your test book and will be spoken only one time.',
  2: 'You will hear a question or statement and three responses spoken in English. They will not be printed in your test book and will be spoken only one time. Select the best response to the question or statement and mark the letter (A), (B), or (C) on your answer sheet.',
  3: 'You will hear some conversations between two or more people. You will be asked to answer three questions about what the speakers say in each conversation. Select the best response to each question and mark the letter (A), (B), (C), or (D) on your answer sheet. The conversations will not be printed in your test book and will be spoken only one time.',
  4: 'You will hear some talks given by a single speaker. You will be asked to answer three questions about what the speaker says in each talk. Select the best response to each question and mark the letter (A), (B), (C), or (D) on your answer sheet. The talks will not be printed in your test book and will be spoken only one time.',
  5: 'A word or phrase is missing in each of the sentences below. Four answer choices are given below each sentence. Select the best answer to complete the sentence. Then mark the letter (A), (B), (C), or (D) on your answer sheet.',
  6: 'Read the texts that follow. A word, phrase, or sentence is missing in parts of each text. Four answer choices for each question are given below the text. Select the best answer to complete the text. Then mark the letter (A), (B), (C), or (D) on your answer sheet.',
  7: 'In this part you will read a selection of texts, such as magazine and newspaper articles, e-mails, and instant messages. Each text or set of texts is followed by several questions. Select the best answer for each question and mark the letter (A), (B), (C), or (D) on your answer sheet.'
};
const PNAME = {1:'Photographs',2:'Question-Response',3:'Conversations',4:'Talks',5:'Incomplete Sentences',6:'Text Completion',7:'Reading Comprehension'};
const PKO = {1:'사진 묘사',2:'질의 응답',3:'짧은 대화',4:'짧은 담화',5:'단문 빈칸 채우기',6:'장문 빈칸 채우기',7:'독해'};

/* ================= TEST BOOKLET ================= */
const tbl = t => `<table class="tb"><thead><tr>${t.head.map(h => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r => `<tr>${r.map(c => `<td>${esc(c)}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
const qBlock = (q, withText = true) => `<div class="q"><span class="qn">${q.n}.</span><div class="qb">${withText && q.q ? `<div class="qt">${esc(q.q).replace(/\n/g, '<br>')}</div>` : ''}<div class="opts">${q.o.map((t, i) => `<div class="o"><span class="ol">(${L[i]})</span> ${esc(t)}</div>`).join('')}</div></div></div>`;

function passage(x, u){
  return esc(x).split('\n').map(line => line
    .replace(/^(To|From|Date|Subject|Re|Location):/, '<b>$1:</b>')
    .replace(/^([A-Z][a-z]+ [A-Z][a-z]+) \[(\d+:\d+ [AP]\.M\.)\]$/, '<b>$1</b> [$2]')
    .replace(/\{(\d)\}/g, (_, k) => `<span class="blank"><span class="bl"></span><span class="bnum">${u.qs[k - 1].n}.</span></span>`)
    .replace(/—\[(\d)\]—/g, '<b class="ins">—[$1]—</b>')
  ).join('\n');
}
const directions = (p, extraKo = '') => `<div class="part-h"><span class="pn">PART ${p}</span></div><div class="dir"><b>Directions:</b> ${DIR[p]}${extraKo ? `<div class="ko">${extraKo}</div>` : ''}</div>`;

let B = '';
// cover
B += `<section class="cover">
  <div class="c-top">PRACTICE TEST · 실전 모의고사</div>
  <h1>TOEIC<sup>®</sup><br>Listening &amp; Reading</h1>
  <div class="c-form">Test ${NO} · ${T_KO}</div>
  <div class="c-box"><b>General Directions</b><p>${DIR.general}</p></div>
  <table class="c-info"><tr><td>Name</td><td></td><td>Date</td><td></td></tr></table>
  <div class="c-sec"><div><b>LISTENING</b><span>Part 1–4 · 100 questions · approx. 45 min</span></div><div><b>READING</b><span>Part 5–7 · 100 questions · 75 min</span></div></div>
  <p class="c-note">연습용으로 새로 만든 문항이며 ETS 공식 시험이 아닙니다. 답은 별도의 답안지에 표시하세요. 듣기 음원은 함께 제공된 MP3 파일(LC_전체.mp3)을 사용하세요.</p>
</section>`;

// LISTENING
B += `<section class="sec-start"><h2 class="sec-h">LISTENING TEST</h2><p class="sec-p">${DIR.lc}</p>${directions(1, '※ 이 모의고사에서는 사진 대신 장면 설명을 넣었습니다. 설명을 사진이라고 생각하고 들려주는 문장 중 가장 알맞은 것을 고르세요.')}</section>`;
const p1 = LC.filter(u => u.p === 1);
for (let i = 0; i < p1.length; i += 2){
  B += `<section class="p1page">${p1.slice(i, i + 2).map(u => `<div class="photo-q"><span class="qn big">${u.qs[0].n}.</span><div class="photo"><div class="ph-in"><span class="ph-label">PHOTO · 장면 설명</span><span class="ph-ko">${esc(u.photo)}</span></div></div></div>`).join('')}</section>`;
}
B += `<section class="brk">${directions(2)}<div class="cols p2">${LC.filter(u => u.p === 2).map(u => `<div class="p2q"><span class="qn">${u.qs[0].n}.</span> Mark your answer on your answer sheet.</div>`).join('')}</div></section>`;

for (const p of [3, 4]){
  B += `<section class="brk lcq">${directions(p)}<div class="cols">`;
  LC.filter(u => u.p === p).forEach(u => {
    const g = u.g ? `<div class="graphic"><div class="gt">${esc(u.g.title)}</div>${tbl(u.g)}</div>` : '';
    B += `<div class="set">${g}${u.qs.map(q => qBlock(q)).join('')}</div>`;
  });
  B += `</div></section>`;
}

// READING
B += `<section class="brk"><h2 class="sec-h">READING TEST</h2><p class="sec-p">${DIR.rc}</p>${directions(5)}<div class="cols">${RC.filter(u => u.p === 5).flatMap(u => u.qs).map(q => qBlock(q)).join('')}</div></section>`;
B += `<section class="brk">${directions(6)}`;
RC.filter(u => u.p === 6).forEach(u => {
  const [a, b] = range(u);
  B += `<div class="rset p6"><div class="refer"><b>Questions ${a}-${b}</b> refer to the following ${esc(referTo(u))}.</div>${u.ps.map(p => `<div class="doc"><div class="doc-x">${passage(p.x, u)}</div></div>`).join('')}<div class="cols qs">${u.qs.map(q => qBlock(q, false)).join('')}</div></div>`;
});
B += `</section><section class="brk">${directions(7)}`;
const p7 = RC.filter(u => u.p === 7);
p7.forEach((u, k) => {
  const [a, b] = range(u), multi = u.ps.length > 1, last = k === p7.length - 1;
  const docs = u.ps.map(p => `<div class="doc">${p.x ? `<div class="doc-x">${passage(p.x, u)}</div>` : ''}${p.tbl ? tbl(p.tbl) : ''}${p.x2 ? `<div class="doc-x">${passage(p.x2, u)}</div>` : ''}</div>`).join('');
  const html = `<div class="refer"><b>Questions ${a}-${b}</b> refer to the following ${esc(referTo(u))}.</div><div class="docs${multi ? ' multi' : ''}">${docs}</div><div class="cols qs">${u.qs.map(q => qBlock(q)).join('')}</div>`;
  B += last ? `</section><section class="last rset">${html}<div class="stop"><b>Stop!</b> This is the end of the test. If you finish before time is called, you may go back to Parts 5, 6, and 7 and check your work.</div></section>`
            : `<div class="rset${multi ? ' multi' : ''}">${html}</div>`;
});

const FONT_EN = `"Times New Roman", Times, serif`;
const BOOK_CSS = `
@page { size: A4; margin: 15mm 14mm 18mm;
  @bottom-center { content: counter(page); font: 10pt ${FONT_EN}; }
  @bottom-right { content: "GO ON TO THE NEXT PAGE"; font: 700 8.5pt Arial, sans-serif; letter-spacing: .04em; } }
@page cover { @bottom-center { content: none } @bottom-right { content: none } }
@page last { @bottom-right { content: none } }
* { box-sizing: border-box }
body { margin: 0; font: 10.5pt/1.38 ${FONT_EN}; color: #000; -webkit-print-color-adjust: exact; print-color-adjust: exact }
.cover { page: cover; height: 262mm; display: flex; flex-direction: column; gap: 9mm; padding-top: 10mm }
.c-top { font: 700 9pt Arial, "Apple SD Gothic Neo", sans-serif; letter-spacing: .2em; border-bottom: 2px solid #000; padding-bottom: 2mm }
.cover h1 { font: 700 34pt/1.1 ${FONT_EN}; margin: 6mm 0 0 }
.cover h1 sup { font-size: 14pt }
.c-form { font: 700 15pt Arial, "Apple SD Gothic Neo", sans-serif }
.c-box { border: 1.5px solid #000; padding: 5mm 6mm; font-size: 11pt }
.c-box p { margin: 2mm 0 0; text-align: justify }
.c-info { border-collapse: collapse; width: 100% }
.c-info td { border: 1px solid #000; height: 11mm; padding: 0 3mm; font: 700 9pt Arial, sans-serif }
.c-info td:nth-child(odd) { width: 18mm; background: #eee }
.c-sec { display: grid; grid-template-columns: 1fr 1fr; gap: 4mm }
.c-sec div { border: 1px solid #000; padding: 4mm; display: grid; gap: 1mm }
.c-sec b { font: 700 13pt Arial, sans-serif; letter-spacing: .06em }
.c-sec span { font-size: 10pt }
.c-note { margin-top: auto; font: 8.5pt/1.5 "Apple SD Gothic Neo", sans-serif; color: #333 }
.brk, .sec-start, .p1page { break-before: page }
.sec-h { font: 700 17pt Arial, sans-serif; letter-spacing: .08em; margin: 0 0 2mm; border-bottom: 2.5px solid #000; padding-bottom: 1.5mm }
.sec-p { margin: 0 0 4mm; text-align: justify }
.part-h { margin: 3mm 0 1.5mm }
.pn { font: 700 13pt Arial, sans-serif; background: #000; color: #fff; padding: .6mm 3mm }
.dir { border: 1px solid #000; padding: 2.5mm 3.5mm; margin-bottom: 4mm; text-align: justify; font-size: 10pt }
.dir .ko { font: 8.5pt/1.5 "Apple SD Gothic Neo", sans-serif; margin-top: 1.5mm; color: #333 }
.p1page { display: flex; flex-direction: column; gap: 10mm; padding-top: 4mm }
.photo-q { display: flex; gap: 4mm; align-items: flex-start }
.qn { font-weight: 700 }
.qn.big { font-size: 13pt; width: 8mm }
.photo { flex: 1; height: 112mm; border: 1.2px solid #000; display: grid; place-items: center;
  background: repeating-linear-gradient(135deg, #f1f1f1 0 6px, #fff 6px 12px) }
.ph-in { background: #fff; border: 1px solid #999; padding: 5mm 7mm; max-width: 120mm; display: grid; gap: 2mm; text-align: center }
.ph-label { font: 700 8pt Arial, sans-serif; letter-spacing: .15em; color: #555 }
.ph-ko { font: 12.5pt/1.6 "Apple SD Gothic Neo", sans-serif }
.cols { column-count: 2; column-gap: 9mm; column-rule: .5px solid #999 }
.p2 { margin-top: 2mm }
.p2q { padding: 2.2mm 0; break-inside: avoid }
.set { break-inside: avoid; margin-bottom: 1mm }
.lcq .q { border-bottom: .6px solid #777; padding-bottom: 2.4mm; margin-bottom: 2.6mm }
.q { display: flex; gap: 2mm; break-inside: avoid; margin-bottom: 3.6mm }
.q .qn { min-width: 8mm }
.qb { flex: 1; min-width: 0 }
.qt { margin-bottom: .6mm }
.o { padding-left: 7mm; text-indent: -7mm }
.ol { display: inline-block; width: 7mm; text-indent: 0 }
.graphic { border: 1.2px solid #000; margin: 0 0 3mm; break-inside: avoid }
.graphic .gt { font-weight: 700; text-align: center; border-bottom: 1px solid #000; padding: 1mm }
.tb { border-collapse: collapse; width: 100%; font-size: 9.8pt }
.tb th, .tb td { border: .6px solid #555; padding: .8mm 2mm; text-align: left }
.tb th { background: #eee }
.graphic .tb th, .graphic .tb td { border-left: 0; border-right: 0 }
.rset { margin-bottom: 7mm }
.rset:not(.multi) { break-inside: avoid }
.refer { margin: 0 0 2mm; break-after: avoid }
.rset.multi { break-before: page }
.docs { display: grid; gap: 3mm; margin-bottom: 3mm }
.doc { border: 1px solid #000; padding: 3mm 4mm; break-inside: avoid }
.doc .tb { margin: 1.5mm 0 }
.doc-x { white-space: pre-wrap; text-align: left }
.qs { margin-top: 1mm; break-inside: avoid }
.blank { display: inline-flex; flex-direction: column; align-items: center; vertical-align: top; line-height: 1 }
.bl { width: 20mm; border-bottom: 1.4px dashed #000; height: 3.6mm }
.bnum { font-size: 8.5pt; font-weight: 700; margin-top: .6mm }
.ins { white-space: nowrap }
.last { page: last; break-before: page }
.stop { margin-top: 8mm; border: 2px solid #000; padding: 4mm 5mm; font-size: 11pt }
`;
const page = (title, css, body) => `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${title}</title><style>${css}</style></head><body>${body}</body></html>`;
fs.writeFileSync(`${OUT}/booklet.html`, page(`TOEIC ${T_EN}`, BOOK_CSS, B));

/* ================= ANSWER SHEET (OMR) ================= */
const omrCol = (from) => `<div class="oc"><div class="oh"><span>No.</span><span>ANSWER</span></div>${Array.from({length:20}, (_, i) => from + i).map(n => `<div class="or"><span class="on">${n}</span>${[0,1,2,3].map(i => `<span class="ob">${L[i]}</span>`).join('')}</div>`).join('')}</div>`;
const omrSec = (name, start, parts) => `<div class="os"><div class="osh"><b>${name} SECTION</b><span>${parts}</span></div><div class="og">${[0,1,2,3,4].map(c => omrCol(start + c * 20)).join('')}</div></div>`;
const OMR = `<div class="sheet">
  <div class="top"><div><b class="tt">ANSWER SHEET</b><span class="ts">TOEIC Listening &amp; Reading · ${T_EN} · 답안지</span></div>
  <table class="id"><tr><td>성명 Name</td><td></td></tr><tr><td>날짜 Date</td><td></td></tr></table></div>
  <div class="howto">바른 표기 <span class="ob f">A</span> &nbsp; 잘못된 표기 <span class="ob">✓</span> <span class="ob">×</span> <span class="ob">·</span> &nbsp;— 원 안을 꽉 채워 칠하세요. Part 2(7–31번)는 (A)~(C)만 사용합니다.</div>
  ${omrSec('LISTENING', 1, 'Part 1–4')}
  ${omrSec('READING', 101, 'Part 5–7')}
  <div class="score"><div>LC 정답 수 <span></span>/100</div><div>RC 정답 수 <span></span>/100</div><div>추정 점수 <span></span>/990</div></div>
</div>`;
const OMR_CSS = `
@page { size: A4; margin: 10mm 10mm }
* { box-sizing: border-box }
body { margin: 0; font: 9pt Arial, "Apple SD Gothic Neo", sans-serif; color: #c2255c; -webkit-print-color-adjust: exact; print-color-adjust: exact }
.sheet { border: 2px solid #c2255c; padding: 3.5mm 5mm; display: grid; gap: 3mm }
.top { display: flex; justify-content: space-between; gap: 6mm; align-items: center }
.tt { font-size: 18pt; letter-spacing: .08em; display: block }
.ts { font-size: 9pt }
.id { border-collapse: collapse; width: 85mm }
.id td { border: 1px solid #c2255c; height: 8mm; padding: 0 2mm; font-size: 8.5pt }
.id td:first-child { width: 22mm; background: #fde8ef }
.howto { font-size: 8.5pt; display: flex; align-items: center; gap: 1.5mm; flex-wrap: wrap }
.os { border: 1.4px solid #c2255c }
.osh { background: #c2255c; color: #fff; display: flex; justify-content: space-between; padding: 1mm 3mm; font-size: 10pt; letter-spacing: .06em }
.og { display: grid; grid-template-columns: repeat(5, 1fr) }
.oc { border-right: 1px solid #c2255c; padding: 1mm 1.5mm 1.5mm }
.oc:last-child { border-right: 0 }
.oh { display: flex; justify-content: space-between; font-size: 7pt; border-bottom: 1px solid #c2255c; padding: 0 1mm .8mm; margin-bottom: .8mm }
.or { display: flex; align-items: center; gap: 1.1mm; height: 4.75mm }
.or:nth-child(5n+1) { border-bottom: .5px dotted #c2255c }
.on { width: 7mm; text-align: right; font: 700 8pt Arial, sans-serif; padding-right: 1mm; color: #000 }
.ob { width: 4mm; height: 4mm; border: .9px solid #c2255c; border-radius: 50%; display: inline-grid; place-items: center; font-size: 6.2pt; line-height: 1 }
.ob.f { background: #000; border-color: #000; color: #000 }
.score { display: grid; grid-template-columns: repeat(3, 1fr); gap: 3mm }
.score div { border: 1px solid #c2255c; padding: 2.5mm 3mm; font-size: 9pt }
.score span { display: inline-block; width: 16mm; border-bottom: 1px solid #c2255c; margin: 0 1mm }
`;
fs.writeFileSync(`${OUT}/answersheet.html`, page('Answer Sheet', OMR_CSS, OMR + '<div style="break-before:page"></div>' + OMR));

/* ================= ANSWER KEY + SCRIPTS + EXPLANATIONS ================= */
// ponytail: rough linear estimate (same as the web version), not an official ETS conversion table
const est = (raw, lc) => raw === 0 ? 5 : Math.max(5, Math.min(495, Math.round((raw * 5 + (lc ? 10 : -5)) / 5) * 5));
const SPK = {M:'M', M2:'M2', W:'W', W2:'W2'};
let K = `<h1>정답 · 스크립트 · 해설</h1><p class="sub">TOEIC Listening &amp; Reading 실전 모의고사 ${T_KO}</p>`;
K += `<h2>정답표</h2><div class="keygrid">${[0,1,2,3,4,5,6,7,8,9].map(c => `<div class="kc">${Array.from({length:20}, (_, i) => QS[c * 20 + i]).map(q => `<div><span>${q.n}</span><b>${L[q.a]}</b></div>`).join('')}</div>`).join('')}</div>`;
const conv = [100, 90, 80, 70, 60, 50, 40, 30, 20, 10];
K += `<h2>점수 추정표 <small>(대략치 · 실제 토익은 회차마다 환산표가 다름)</small></h2><table class="tb conv"><thead><tr><th>정답 수</th>${conv.map(r => `<th>${r}</th>`).join('')}</tr></thead><tbody><tr><td>LC</td>${conv.map(r => `<td>${est(r, true)}</td>`).join('')}</tr><tr><td>RC</td>${conv.map(r => `<td>${est(r, false)}</td>`).join('')}</tr></tbody></table><p class="note">계산법: LC ≈ 정답 수 × 5 + 10, RC ≈ 정답 수 × 5 − 5 (5점 단위 반올림, 최대 495점)</p>`;

const ans = q => `<div class="ka"><b>정답 (${L[q.a]})</b> ${esc(q.e)}</div>`;
for (let p = 1; p <= 7; p++){
  K += `<h2 class="${p === 1 || p === 5 ? 'brk' : ''}">${p <= 4 ? 'LISTENING' : 'READING'} · PART ${p} <small>${PNAME[p]} · ${PKO[p]}</small></h2><div class="kcols">`;
  UNITS.filter(u => u.p === p).forEach(u => {
    if (p === 1){ const q = u.qs[0]; K += `<div class="ki"><div class="kh">${q.n}. <span class="ko">${esc(u.photo)}</span></div>${q.o.map((t, i) => `<div class="ko2${i === q.a ? ' ok' : ''}">(${L[i]}) ${esc(t)}</div>`).join('')}${ans(q)}</div>`; }
    else if (p === 2){ const q = u.qs[0]; K += `<div class="ki"><div class="kh">${q.n}. ${esc(q.q)}</div>${q.o.map((t, i) => `<div class="ko2${i === q.a ? ' ok' : ''}">(${L[i]}) ${esc(t)}</div>`).join('')}${ans(q)}</div>`; }
    else if (p <= 4){
      const [a, b] = range(u);
      K += `<div class="ki set"><div class="kh">Questions ${a}-${b}${u.g ? ` · 시각자료: ${esc(u.g.title)}` : ''}</div><div class="scr">${u.talk.map(([s, t]) => `<div><b>${SPK[s]}</b> ${esc(t)}</div>`).join('')}</div>${u.qs.map(q => `<div class="kq"><div>${q.n}. ${esc(q.q)}</div><div class="kopts">${q.o.map((t, i) => `<span class="${i === q.a ? 'ok' : ''}">(${L[i]}) ${esc(t)}</span>`).join('')}</div>${ans(q)}</div>`).join('')}</div>`;
    } else if (p === 5){
      u.qs.forEach(q => { K += `<div class="ki"><div class="kh">${q.n}. ${esc(q.q)}</div><div class="kopts">${q.o.map((t, i) => `<span class="${i === q.a ? 'ok' : ''}">(${L[i]}) ${esc(t)}</span>`).join('')}</div>${ans(q)}</div>`; });
    } else {
      const [a, b] = range(u);
      K += `<div class="ki"><div class="kh">Questions ${a}-${b} · ${esc(referTo(u))}</div>${u.qs.map(q => `<div class="kq"><div>${q.n}. ${q.q ? esc(q.q).replace(/\n/g, '<br>') : '(빈칸)'} → <b>(${L[q.a]}) ${esc(q.o[q.a])}</b></div>${ans(q)}</div>`).join('')}</div>`;
    }
  });
  K += '</div>';
}
const KEY_CSS = `
@page { size: A4; margin: 14mm 13mm 15mm; @bottom-center { content: counter(page); font: 9pt Arial } }
* { box-sizing: border-box }
body { margin: 0; font: 9.3pt/1.5 "Apple SD Gothic Neo", sans-serif; color: #111; -webkit-print-color-adjust: exact; print-color-adjust: exact }
h1 { font-size: 20pt; margin: 0 }
.sub { margin: 1mm 0 5mm; color: #555 }
h2 { font-size: 12pt; border-bottom: 2px solid #111; padding-bottom: 1mm; margin: 6mm 0 3mm }
h2 small { font-weight: 400; color: #555; font-size: 9pt }
.brk { break-before: page }
.keygrid { display: grid; grid-template-columns: repeat(10, 1fr); border: 1px solid #111 }
.kc { border-right: .6px solid #999 } .kc:last-child { border-right: 0 }
.kc:nth-child(5) { border-right: 1.5px solid #111 }
.kc div { display: flex; justify-content: space-between; padding: .4mm 2mm; font: 9pt Arial, sans-serif }
.kc div:nth-child(even) { background: #f2f2f2 }
.kc b { color: #c2255c }
.tb { border-collapse: collapse; width: 100% }
.tb th, .tb td { border: .6px solid #888; padding: 1mm 2mm; text-align: center; font: 9pt Arial, sans-serif }
.tb th { background: #eee }
.note { font-size: 8.5pt; color: #555 }
.kcols { column-count: 2; column-gap: 7mm; column-rule: .5px solid #bbb }
.ki { break-inside: avoid; margin-bottom: 3.5mm }
.ki.set { break-inside: auto }
.kh { font-weight: 700; font-family: "Times New Roman", "Apple SD Gothic Neo", serif; font-size: 10pt }
.kh .ko { font-weight: 400; font-family: "Apple SD Gothic Neo", sans-serif; font-size: 9pt }
.ko2, .kq > div:first-child, .kopts, .scr { font-family: "Times New Roman", "Apple SD Gothic Neo", serif; font-size: 9.8pt }
.ok { font-weight: 700; text-decoration: underline }
.kopts { display: flex; flex-wrap: wrap; gap: 0 4mm }
.scr { background: #f3f3f3; padding: 2mm 2.5mm; margin: 1mm 0 2mm; display: grid; gap: .8mm }
.scr b { font: 700 8pt Arial; color: #c2255c; margin-right: 1mm }
.kq { margin-bottom: 2mm; break-inside: avoid }
.ka { font-size: 8.8pt; color: #333; border-left: 2px solid #c2255c; padding-left: 2mm; margin-top: .6mm }
.ka b { color: #c2255c }
`;
fs.writeFileSync(`${OUT}/answerkey.html`, page('정답 및 해설', KEY_CSS, K));

/* ================= AUDIO SCRIPT ================= */
// segments: [voiceKey, text] or [seconds] for silence
const tracks = {};
const intro = [['N', 'Listening Test.'], [1], ['N', DIR.lc], [2]];
const dirSeg = p => [['N', `Part ${p}.`], [0.8], ['N', 'Directions. ' + DIR[p]], [2]];
tracks.part1 = [...dirSeg(1)];
LC.filter(u => u.p === 1).forEach(u => { const q = u.qs[0], v = q.n % 2 ? 'W' : 'M';
  tracks.part1.push(['N', `Number ${q.n}. Look at the picture marked number ${q.n} in your test book.`], [1.2]);
  q.o.forEach((t, i) => tracks.part1.push([v, `${L[i]}. ${t}`], [1.3]));
  tracks.part1.push([4]); });
tracks.part2 = [...dirSeg(2)];
LC.filter(u => u.p === 2).forEach(u => { const q = u.qs[0], [x, y] = q.n % 2 ? ['W', 'M'] : ['M2', 'W2'];
  tracks.part2.push(['N', `Number ${q.n}.`], [0.6], [x, q.q], [1.3]);
  q.o.forEach((t, i) => tracks.part2.push([y, `${L[i]}. ${t}`], [1.2]));
  tracks.part2.push([4]); });
for (const p of [3, 4]){
  const t = tracks['part' + p] = [...dirSeg(p)];
  LC.filter(u => u.p === p).forEach(u => {
    const [a, b] = range(u);
    t.push(['N', `Questions ${a} through ${b} refer to the following ${referTo(u)}.`], [1]);
    u.talk.forEach(([s, x]) => t.push([s, x], [0.45]));
    t.push([1.2]);
    u.qs.forEach(q => t.push(['N', `${q.n}. ${q.q}`], [/graphic/i.test(q.q) ? 12 : 8]));
  });
}
tracks.part4.push(['N', 'This is the end of the Listening test. Turn to Part 5 in your test book.'], [2]);
tracks.full = [...intro, ...tracks.part1, [2], ...tracks.part2, [2], ...tracks.part3, [2], ...tracks.part4];
fs.writeFileSync(`${OUT}/audio.json`, JSON.stringify(tracks));
console.log('ok', Object.fromEntries(Object.entries(tracks).map(([k, v]) => [k, v.length])));

/* ================= SELF-CHECK REPORT ================= */
// Numbers to eyeball before printing: answer balance, passage lengths, how many money/calculation questions.
const words = s => (s.match(/[A-Za-z][A-Za-z'’-]*/g) || []).length;
const dist = qs => L.split('').map((c, i) => `${c}${qs.filter(q => q.a === i).length}`).join(' ');
console.log('answers LC(P1,P3,P4):', dist(QS.filter(q => q.p !== 2 && q.p <= 4)), '| P2:', dist(QS.filter(q => q.p === 2)), '| RC:', dist(QS.filter(q => q.p >= 5)));
const calc = QS.filter(q => q.p >= 3 && q.q && /how much|how many|total|cost|price|fee|charge|pay|refund|discount/i.test(q.q));
console.log('money/number question candidates (check by eye):', calc.map(q => q.n).join(', ') || 'none');
RC.filter(u => u.ps).forEach(u => { const [a, b] = range(u);
  console.log(`  ${a}-${b} P${u.p} ${u.ps.map(p => `${p.t}:${words(p.x + ' ' + (p.x2 || '') + (p.tbl ? ' ' + p.tbl.rows.flat().join(' ') : ''))}w`).join(' + ')}`); });
