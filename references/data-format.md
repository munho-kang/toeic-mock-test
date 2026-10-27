# data.js format and test layout

`gen.js` reads one file, `data.js`, which defines three globals: `META`, `LC` and `RC`. It is plain JavaScript, not JSON, so unquoted keys and trailing commas are fine. Every question needs exactly these fields: `o` (the options), `a` (the 0-based index of the answer) and `e` (a Korean explanation for a non-major reader). The generator numbers questions automatically, and it fails if the total is not 200.

```js
const META = {n: 2, level: "고난도"};   // test number, and level: "고난도" | "기본" | "" — goes into every title
const LC = [ /* units, Part 1 → 4 in order */ ];
const RC = [ /* units, Part 5 → 7 in order */ ];
```

## Real test layout (what to produce)

| Part | Q numbers | Units | Notes |
|---|---|---|---|
| 1 Photographs | 1–6 | 6 × 1 question | 4 options. No real photos: `photo` is a Korean scene description printed in the photo box |
| 2 Question-Response | 7–31 | 25 × 1 question | **3 options**, `q` = the spoken question |
| 3 Conversations | 32–70 | 13 × 3 questions | Two of the 13 sets are 3-speaker sets (`three:true`, uses W2 or M2). The **last 3 sets (62–70) have a graphic** (`g`) |
| 4 Talks | 71–100 | 10 × 3 questions | `kind` = telephone message / announcement / broadcast / excerpt from a meeting / talk / advertisement / speech / tour… The **last 3 sets (92–100) have a graphic** |
| 5 Incomplete Sentences | 101–130 | 30 questions (put any number per unit; 5 per unit works) | `_____` marks the blank |
| 6 Text Completion | 131–146 | 4 × 4 questions | blanks `{1}`…`{4}`; one of the 4 is a sentence-insertion item |
| 7 single passages | 147–175 | 10 sets: 2,2,2,2,3,3,3,4,4,4 questions | one has a text-message chain or online chat (use "I'm on it"-style intent question), one or two have the —[1]— sentence-insertion question |
| 7 double | 176–185 | 2 × 5 | |
| 7 triple | 186–200 | 3 × 5 | |

## Units by part

```js
// Part 1 — photo is the Korean description of the picture. Option voice alternates automatically.
{p:1, photo:"목공 작업장. 한 남성이 작업대 앞에서 줄자로 나무판의 길이를 재고 있다. 벽에는 공구들이 걸려 있다.",
 qs:[{o:["A man is sawing a wooden board.","Some tools are being hung on a wall.","A man is measuring a piece of wood.","A workbench is being cleared off."], a:2,
      e:"줄자로 재는(measuring) 동작이 정답. 공구는 이미 걸려 있는 '상태'라 is being hung은 오답이에요."}]},

// Part 2 — q is spoken; 3 options.
{p:2, qs:[{q:"Where's the new printer going to be installed?", o:["It was installed last week.","Next to the supply cabinet.","Yes, it prints in color."], a:1, e:"..."}]},

// Part 3 — talk is [voice, line] pairs. Voices: M, W (main pair), M2, W2 (third speaker / alternate accents).
{p:3, three:true, talk:[["W","Jun, Carla, I just heard ..."],["M","That's frustrating. ..."],["W2","Well, I've worked with ..."]],
 qs:[{q:"What problem does the woman report?", o:[...4], a:2, e:"..."}, {...}, {...}]},

// Part 3/4 with a graphic — printed as a small table above the questions. Graphic question text starts with "Look at the graphic."
{p:3, g:{kind:"timetable", title:"Airport Express Shuttle — Departures", head:["Departs","Arrives"], rows:[["6:15 A.M.","7:05 A.M."], ...]},
 talk:[...], qs:[..., {q:"Look at the graphic. Which shuttle will the woman most likely take?", o:["6:15 A.M.", ...], a:0, e:"..."}, ...]},

// Part 4 — kind is read aloud in "Questions 71 through 73 refer to the following telephone message."
{p:4, kind:"telephone message", talk:[["M","Hi, Ms. Albright, this is ..."]], qs:[...3]},

// Part 5 — several questions per unit is fine.
{p:5, qs:[{q:"The board has decided to postpone the merger _____ a thorough review ... has been completed.", o:["until","by","during","unless"], a:0, e:"..."}, ...]},

// Part 6 — ps[0].t is the document type. Questions have no q (the blank number is the question).
{p:6, ps:[{t:"E-mail", x:"To: All Staff\nFrom: IT Services\nDate: October 9\nSubject: ...\n\nOver the weekend ... effort to {1} our ... {3}\n..."}],
 qs:[{o:["modernize","modernization","modernizing","modernized"], a:0, e:"..."}, ... 4 total]},

// Part 7 — one or more documents. x = text, optional tbl = table printed after x, optional x2 = text after the table.
{p:7, ps:[{t:"Web page", x:"Lindenwood Community College ...", tbl:{head:["Course","Day / Time","Fee"], rows:[[...],...]}, x2:"• Alumni receive 15% off ..."},
          {t:"E-mail", x:"To: registration@...\nFrom: Marcus Dlamini\nDate: August 28\nSubject: Fall registration\n\nHello, ..."}],
 qs:[{q:"What is indicated about ...?", o:[...4], a:1, e:"..."}, ...]},
```

Formatting the generator understands inside passage text:
- `To:` `From:` `Date:` `Subject:` `Re:` `Location:` at the start of a line are bolded (e-mail and memo headers).
- Chat lines: `Maria Lopez [10:42 A.M.]` on its own line, then the message on the next line.
- Sentence-insertion positions: `—[1]—` … `—[4]—`, and the question: `In which of the positions marked [1], [2], [3], and [4] does the following sentence best belong?\n"..."`.
- `\n` is a line break, `\n\n` a paragraph.

## Printing behavior worth knowing
- Part 3·4 questions are separated by thin horizontal rules (the user asked for this).
- Part 7 sets start on a fresh column/page when they don't fit; very long sets push pages, so the booklet is ~38–40 pages.
- The answer key prints every LC script with speaker labels, plus the Korean explanation `e` for every question, and an estimated score table.
