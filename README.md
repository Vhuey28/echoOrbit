# EchoOrbit

A free, browser-based pronunciation game for kindergarten through fifth grade.
Children hear a sound, see how the mouth makes it, then pop the matching
bubble — and say it out loud for bonus points.

No build step, no framework, no backend. Open `index.html` or run the
included static server.

```bash
npm start          # serves on http://0.0.0.0:8080
npm test           # runs the jsdom suite (53 checks)
npm install        # only needed for the tests (dev dependency: jsdom)
```

## Screens

| File | What it is |
| --- | --- |
| `index.html` | Home: progression path, sound lab, mode picker, teacher notes |
| `echoorbit-path.html` | The full K–5 map with unlocked / completed / locked states |
| `echoorbit-gameplay.html` | "Listen and match" bubble round |
| `echoorbit-sayit.html` | The same round with speech-recognition scoring |

## Shared modules

| File | Role |
| --- | --- |
| `progression.js` | The phonics scope and sequence, confusion pairs, persisted progress |
| `audio.js` | Speech synthesis, gesture-unlock queue, Web Audio feedback tones |
| `mouth.js` | Draws the "how do I make this sound?" mouth diagram from data |
| `game.js` | The gameplay engine both play screens share |
| `theme.css` | Palette, typography, focus ring, reduced-motion baseline |
| `game.css` | Gameplay layout shared by both play screens |
| `serve.js` | Dependency-free static server (also used by the test suite) |

Both play screens are thin markup shells over `game.js`; they used to be
two near-identical 700-line copies. `mode: 'listen' | 'say'` switches the
voice layer on. `window.echoOrbitGame` is a debug handle exposing the
current unit, score and bubbles.

## How the teaching works

- **Real scope and sequence.** Nine units from short vowels in kindergarten
  to a full IPA lab in fifth grade, each with example words.
- **Confusion-biased decoys.** Distractors are drawn from real minimal
  pairs — `ship`/`chip`, `thumb`/`this`, `light`/`rain` — so a round builds
  discrimination rather than symbol recognition. See `confusionPairs`.
- **Articulation, not just audio.** Every phoneme carries `mouth`
  (jaw opening, lip rounding, tongue position), `voiced` and an optional
  `air` route. `mouth.js` renders that as a diagram plus a kid-sized tip,
  which is the part that actually teaches pronunciation.
- **Contrastive feedback.** A miss names the sound the child hit and speaks
  that word next to the target, instead of a bare "try again".
- **No fail state.** Bubbles wrap rather than escape, misses cost the combo
  but nothing else, and the correct bubble is always kept on screen.

## Accessibility

- The canvas is keyboard-operable: arrow keys aim, space fires, `R` repeats
  the sound, number keys pop a bubble directly.
- Every state change is narrated into an `aria-live` region, batched so a
  fast "Match!" isn't swallowed by the "New sound" that follows it.
- **Easy tap** offers a no-aim way to play, on by default for kindergarten
  units, and doubles as the screen-reader path.
- Voice input is a bonus layer, never a gate — the round is fully playable
  if the mic is blocked or unsupported.
- Text colours are measured, not eyeballed: every token in `theme.css`
  clears WCAG AA 4.5:1 on the surface it sits on, and the suite fails if a
  colour is faded back below that with `opacity`.
- `prefers-reduced-motion` disables every animation; all icons have labels;
  focus rings are visible everywhere.

## Progress

Kept in `localStorage` under `echoorbit.progress.v1` (unlocked units,
completed units, best score per unit) and written on every change. The
`?unlocked=` URL parameter is still honoured as a fallback for browsers
where storage is blocked, and progress is merged from both sources.

## Tests

`npm test` boots the real pages in jsdom against the real server and drives
them: it checks the content model (26 phonemes, every confusion pair
resolves, mouth coordinates in range), the contrast ratios, all four
screens rendering, a full six-match round including misses, keyboard and
easy-tap input, speech scoring, and progress surviving a reload. Canvas and
speech synthesis are stubbed because jsdom implements neither; everything
else is the shipping code.

`capture-screenshot.js` is an optional visual tool — it needs
`npm install --no-save puppeteer` and a Chrome download.
