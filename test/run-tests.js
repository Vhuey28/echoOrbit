/* EchoOrbit test suite.

   Runs the real pages in jsdom against the real static server: the same
   progression.js / audio.js / mouth.js / game.js the browser loads, with
   only canvas and speech synthesis stubbed (jsdom implements neither).

   Run with:  npm test
   Requires:  npm install   (dev dependency: jsdom) */

const fs = require('fs');
const path = require('path');
const { JSDOM, VirtualConsole, ResourceLoader } = require('jsdom');
const { createServer } = require('../serve');

let passed = 0;
const failures = [];

async function check(name, fn){
  try {
    const detail = await fn();
    passed++;
    console.log('  ok   ' + name + (detail ? '  (' + detail + ')' : ''));
  } catch (e){
    failures.push(name + ' -- ' + e.message);
    console.log('  FAIL ' + name + '\n         ' + e.message);
  }
}

function assert(cond, msg){
  if (!cond) throw new Error(msg || 'assertion failed');
}
function eq(actual, expected, label){
  if (actual !== expected){
    throw new Error((label || 'value') + ': expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual));
  }
}

const tick = ms => new Promise(r => setTimeout(r, ms));

/* The shared modules declare their API with `const`, which lives in the
   global lexical scope rather than on `window` -- exactly how the browser
   sees it. Reach them the same way instead of via window properties. */
function g(win, name){ return win.eval(name); }

/* Satisfy the Google Fonts request locally. The webfonts are cosmetic and
   falling back to system-ui changes nothing these tests assert, but a
   real network round trip per page load makes the suite slow and
   dependent on the sandbox having outbound access. */
class OfflineFontLoader extends ResourceLoader {
  fetch(url, options){
    if (/fonts\.(googleapis|gstatic)\.com/.test(url)){
      return Promise.resolve(Buffer.from('/* fonts stubbed */'));
    }
    return super.fetch(url, options);
  }
}

/* ---------- canvas + browser API stubs ---------- */
function stubBrowserApis(window, preStorage){
  const ctx = {
    clearRect(){}, save(){}, restore(){}, translate(){}, rotate(){},
    beginPath(){}, closePath(){}, moveTo(){}, lineTo(){}, arc(){},
    fill(){}, stroke(){}, fillText(){}, setLineDash(){},
    createRadialGradient(){ return { addColorStop(){} }; },
    fillStyle:'', strokeStyle:'', lineWidth:1, font:'',
    textAlign:'', textBaseline:'', globalAlpha:1
  };
  window.HTMLCanvasElement.prototype.getContext = () => ctx;
  window.scrollTo = () => {};
  window.HTMLElement.prototype.scrollIntoView = () => {};
  if (preStorage){
    Object.keys(preStorage).forEach(k => window.localStorage.setItem(k, preStorage[k]));
  }
}

async function loadPage(serverPort, pathAndQuery, preStorage){
  const virtualConsole = new VirtualConsole();
  const pageErrors = [];
  const consoleErrors = [];
  virtualConsole.on('jsdomError', e => pageErrors.push(e.message));
  virtualConsole.on('error', (...a) => consoleErrors.push(a.join(' ')));

  const dom = await JSDOM.fromURL('http://127.0.0.1:' + serverPort + pathAndQuery, {
    runScripts: 'dangerously',
    resources: new OfflineFontLoader(),
    pretendToBeVisual: true,
    virtualConsole,
    beforeParse: window => stubBrowserApis(window, preStorage)
  });
  await new Promise(resolve => {
    if (dom.window.document.readyState === 'complete') return resolve();
    dom.window.addEventListener('load', resolve);
    setTimeout(resolve, 4000);
  });
  // Longer than game.js's 100ms announcement debounce, so the live
  // region has flushed by the time a test reads it.
  await tick(250);
  return {
    dom,
    window: dom.window,
    document: dom.window.document,
    pageErrors,
    consoleErrors,
    assertClean(label){
      assert(pageErrors.length === 0, (label || 'page') + ' errors: ' + pageErrors.join(' | '));
      assert(consoleErrors.length === 0, (label || 'page') + ' console errors: ' + consoleErrors.join(' | '));
    }
  };
}

function click(el){
  el.dispatchEvent(new el.ownerDocument.defaultView.MouseEvent('click', { bubbles: true, cancelable: true }));
}
function key(el, k){
  el.dispatchEvent(new el.ownerDocument.defaultView.KeyboardEvent('keydown', { key: k, bubbles: true, cancelable: true }));
}

/* ---------- contrast helpers ---------- */
function luminance(hex){
  const c = hex.replace('#', '');
  const [r, gr, b] = [0, 2, 4]
    .map(i => parseInt(c.substr(i, 2), 16) / 255)
    .map(v => (v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)));
  return 0.2126 * r + 0.7152 * gr + 0.0722 * b;
}
function contrast(a, b){
  const l1 = luminance(a), l2 = luminance(b);
  return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
}

const file = name => fs.readFileSync(path.join(__dirname, '..', name), 'utf8');

/* ================================================================== */
(async function main(){
  const server = createServer();
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const port = server.address().port;
  console.log('static server on port ' + port + '\n');

  /* ---------------- 1. content model ---------------- */
  console.log('progression.js content model');
  {
    const page = await loadPage(port, '/index.html');
    page.assertClean('index.html');
    const { window } = page;
    const P = g(window, 'progression');
    const PAL = g(window, 'palette');

    await check('progression defines all nine units', () => eq(P.length, 9, 'unit count'));
    await check('unit ids are unique', async () => {
      const ids = P.map(u => u.id);
      eq(new Set(ids).size, ids.length, 'unique ids');
    });
    await check('grades run K through 5 in order', async () => {
      eq(P.map(u => u.grade).join(''), 'KK11223 45'.replace(' ', ''), 'grade sequence');
    });
    await check('every unit uses a known colour key', async () => {
      P.forEach(u => assert(PAL[u.colorKey], u.id + ' has unknown colorKey ' + u.colorKey));
    });
    await check('every phoneme has words, a tip and a mouth shape', async () => {
      let n = 0;
      P.forEach(u => u.phonemes.forEach(p => {
        assert(Array.isArray(p.words) && p.words.length >= 2, p.ipa + ' needs at least 2 example words');
        assert(typeof p.tip === 'string' && p.tip.length > 8, p.ipa + ' needs a kid-sized tip');
        assert(p.mouth && typeof p.mouth.open === 'number' && typeof p.mouth.round === 'number', p.ipa + ' needs mouth.open/round');
        assert(p.mouth.tongue && typeof p.mouth.tongue.x === 'number' && typeof p.mouth.tongue.y === 'number', p.ipa + ' needs tongue x/y');
        assert(typeof p.voiced === 'boolean', p.ipa + ' needs a voiced flag');
        n++;
      }));
      return n + ' phonemes';
    });
    await check('mouth coordinates stay inside the 0-1 range', async () => {
      P.forEach(u => u.phonemes.forEach(p => {
        ['open', 'round'].forEach(k => assert(p.mouth[k] >= 0 && p.mouth[k] <= 1, p.ipa + '.' + k + ' out of range'));
        assert(p.mouth.tongue.x >= 0 && p.mouth.tongue.x <= 1, p.ipa + ' tongue.x out of range');
        assert(p.mouth.tongue.y >= 0 && p.mouth.tongue.y <= 1, p.ipa + ' tongue.y out of range');
      }));
    });
    await check('every confusion pair names two real phonemes', async () => {
      const find = g(window, 'findPhonemeSource');
      g(window, 'confusionPairs').forEach(pair => pair.forEach(ipa => {
        assert(find(ipa, false), 'confusion pair references unknown phoneme ' + ipa);
      }));
      return g(window, 'confusionPairs').length + ' pairs';
    });
    await check('bubble label ink passes 4.5:1 on its own fill', async () => {
      Object.keys(PAL).forEach(k => {
        const r = contrast(PAL[k].ink, PAL[k].fill);
        assert(r >= 4.5, k + ' ink on fill is ' + r.toFixed(2) + ':1');
      });
    });
    await check('primaryWord returns the first example word', async () => {
      eq(g(window, 'primaryWord')(P[0].phonemes[0]), P[0].phonemes[0].words[0], 'primaryWord');
    });
    await check('mouth diagram renders svg with an accessible label', async () => {
      const svg = g(window, 'mouthSvg')(P[1].phonemes[0], 100);   // /m/, lips closed
      assert(svg.includes('<svg'), 'no svg element');
      assert(svg.includes('role="img"'), 'missing role=img');
      assert(svg.includes('lips closed'), 'closed-lip caption missing');
    });
    /* There is no SVG rasterizer in this environment, so the diagram is
       checked by its geometry: the numbers mouth.js computes are what
       decide whether /m/ looks closed and /æ/ looks wide open. */
    await check('mouth opening tracks jaw drop', async () => {
      const svg = g(window, 'mouthSvg');
      const ry = p => parseFloat(svg(p, 100).match(/<ellipse[^>]*ry="([\d.]+)"[^>]*fill="#2B1526"/)[1]);
      const closed = P[1].phonemes[0];   // /m/
      const narrow = P[0].phonemes[1];   // /ɪ/
      const wide = P[0].phonemes[0];     // /æ/
      assert(ry(closed) < 4, '/m/ should be nearly closed, ry=' + ry(closed));
      assert(ry(narrow) < ry(wide), '/ɪ/ (' + ry(narrow) + ') should be narrower than /æ/ (' + ry(wide) + ')');
      assert(ry(wide) > 20, '/æ/ should be wide open, ry=' + ry(wide));
    });
    await check('lip rounding narrows the mouth', async () => {
      const svg = g(window, 'mouthSvg');
      const rx = p => parseFloat(svg(p, 100).match(/<ellipse[^>]*rx="([\d.]+)"[^>]*fill="#2B1526"/)[1]);
      const relaxed = P[0].phonemes[2];   // /ʌ/, round 0.1
      const pouted = P[3].phonemes[0];    // /ʃ/, round 0.65
      assert(rx(pouted) < rx(relaxed), '/ʃ/ (' + rx(pouted) + ') should be narrower than /ʌ/ (' + rx(relaxed) + ')');
    });
    await check('tongue sits forward for front vowels and back for back vowels', async () => {
      const svg = g(window, 'mouthSvg');
      const tongueCx = p => parseFloat(svg(p, 100).match(/<ellipse cx="([\d.]+)"[^>]*fill="#E0708A"/)[1]);
      const front = P[4].phonemes[0];   // /iː/ tongue x 0.12
      const back = P[2].phonemes[2];    // /ʊ/  tongue x 0.85
      assert(tongueCx(front) < 50, 'front vowel tongue should be left of centre: ' + tongueCx(front));
      assert(tongueCx(back) > 50, 'back vowel tongue should be right of centre: ' + tongueCx(back));
    });
    await check('/th/ shows the tongue between the teeth', async () => {
      const svg = g(window, 'mouthSvg')(P[3].phonemes[2], 100);
      eq((svg.match(/fill="#E0708A"/g) || []).length, 2, 'tongue shapes (one inside, one protruding)');
    });
    await check('nasal sounds show airflow through the nose', async () => {
      const svg = g(window, 'mouthSvg');
      assert(svg(P[1].phonemes[0], 100).includes('>nose<'), '/m/ has no nasal arrow');
      assert(svg(P[8].phonemes[1], 100).includes('>nose<'), '/ŋ/ has no nasal arrow');
      assert(!svg(P[0].phonemes[0], 100).includes('>nose<'), '/æ/ should not show a nasal arrow');
    });
    await check('voiced sounds are captioned as buzzing, voiceless as air', async () => {
      const cap = g(window, 'mouthCaption');
      const voiced = P[0].phonemes[0];                 // /æ/
      const voiceless = P[1].phonemes[1];              // /s/
      eq(voiced.voiced, true, '/æ/ should be voiced');
      eq(voiceless.voiced, false, '/s/ should be voiceless');
      assert(cap(voiced).includes('voice buzzes'), 'voiced caption: ' + cap(voiced));
      assert(cap(voiceless).includes('no buzz'), 'voiceless caption: ' + cap(voiceless));
    });
  }

  /* ---------------- 2. theme contrast ---------------- */
  console.log('\ntheme.css contrast');
  const themeCss = file('theme.css');
  const token = name => {
    const m = themeCss.match(new RegExp('--' + name + ':\\s*(#[0-9A-Fa-f]{6})'));
    assert(m, 'token --' + name + ' not found in theme.css');
    return m[1];
  };
  await check('body text passes 4.5:1 on both surfaces', async () => {
    const t = token('text');
    assert(contrast(t, token('void')) >= 4.5, 'text on void');
    assert(contrast(t, token('panel')) >= 4.5, 'text on panel');
  });
  await check('muted and dim text pass 4.5:1 on both surfaces', async () => {
    ['text-muted', 'text-dim'].forEach(name => {
      const c = token(name);
      const onVoid = contrast(c, token('void'));
      const onPanel = contrast(c, token('panel'));
      assert(onVoid >= 4.5, name + ' on void is ' + onVoid.toFixed(2) + ':1');
      assert(onPanel >= 4.5, name + ' on panel is ' + onPanel.toFixed(2) + ':1');
    });
  });
  await check('button ink passes 4.5:1 on every accent background', async () => {
    [['on-teal', 'teal'], ['on-coral', 'coral'], ['on-amber', 'amber-light']].forEach(([ink, bg]) => {
      const r = contrast(token(ink), token(bg));
      assert(r >= 4.5, ink + ' on ' + bg + ' is ' + r.toFixed(2) + ':1');
    });
  });
  await check('no text colour is dimmed with a low opacity value', async () => {
    // The old screens faded cream text with opacity, which is what failed
    // AA. Flag any rule that sets a colour and then fades it below 0.55;
    // purely decorative fades (twinkling stars) are left alone.
    ['index.html', 'echoorbit-path.html', 'game.css'].forEach(name => {
      file(name).split('}').forEach(block => {
        const fades = [...block.matchAll(/opacity:\s*0?\.(\d+)/g)];
        if (!fades.length) return;
        if (!/(^|[{;\s])(color|fill)\s*:/.test(block)) return;
        fades.forEach(m => assert(parseInt(m[1], 10) >= 55,
          name + ' fades text to 0.' + m[1] + ' in: ' + block.trim().slice(0, 90)));
      });
    });
  });

  /* ---------------- 3. landing page ---------------- */
  console.log('\nindex.html');
  {
    const page = await loadPage(port, '/index.html');
    page.assertClean('index.html');
    const { window, document } = page;
    const P = g(window, 'progression');

    await check('path track renders a node per unit', async () => {
      eq(document.querySelectorAll('#pathTrack .path-node').length, P.length, 'nodes');
    });
    await check('only unlocked units are clickable', async () => {
      const enabled = [...document.querySelectorAll('#pathTrack .path-node')]
        .filter(b => !b.disabled).map(b => b.dataset.id);
      eq(enabled.join(','), g(window, 'unlockedIdList')(), 'enabled nodes');
    });
    await check('unit card lists the unit phonemes as speakable chips', async () => {
      const unit = P[0];
      eq(document.querySelectorAll('#unitChips .phoneme-chip').length, unit.phonemes.length, 'chips');
      eq(document.getElementById('unitTitle').textContent, unit.title, 'title');
      eq(document.getElementById('unitGrade').textContent, 'Grade ' + unit.grade, 'grade');
    });
    await check('sound lab shows the mouth diagram for the first sound', async () => {
      assert(document.getElementById('labArt').querySelector('svg'), 'no mouth diagram rendered');
      assert(document.getElementById('labTip').textContent.length > 8, 'no tip text');
      eq(document.querySelectorAll('#labWords .cue-word').length, P[0].phonemes[0].words.length, 'word buttons');
    });
    await check('clicking a chip switches the lab to that sound', async () => {
      const chips = [...document.querySelectorAll('#unitChips .phoneme-chip')];
      const wanted = P[0].phonemes[2];
      click(chips[2]);
      eq(document.getElementById('labIpa').textContent, '/' + wanted.ipa + '/', 'lab ipa');
      eq(chips[2].getAttribute('aria-pressed'), 'true', 'pressed state');
      eq(chips[0].getAttribute('aria-pressed'), 'false', 'other chip pressed');
    });
    await check('selecting a locked unit is refused', async () => {
      const before = document.getElementById('unitTitle').textContent;
      g(window, 'selectUnit')('g5a');
      eq(document.getElementById('unitTitle').textContent, before, 'unit changed');
    });
    await check('play buttons point at the two game screens', async () => {
      const modes = [...document.querySelectorAll('.mode-card')].map(c => c.dataset.mode);
      eq(modes.join(','), 'listen,say', 'mode cards');
    });
    await check('page has a skip link and a live region', async () => {
      assert(document.querySelector('.skip-link'), 'no skip link');
      assert(document.querySelector('[aria-live]'), 'no live region');
    });
  }

  /* ---------------- 4. path page ---------------- */
  console.log('\nechoorbit-path.html');
  {
    const page = await loadPage(port, '/echoorbit-path.html');
    page.assertClean('echoorbit-path.html');
    const { window, document } = page;
    const P = g(window, 'progression');

    await check('renders one node per unit', async () => {
      eq(document.querySelectorAll('.node-btn').length, P.length, 'nodes');
    });
    await check('progress note counts unlocked units', async () => {
      eq(document.getElementById('progressNote').textContent,
         g(window, 'getUnlockedUnits')().length + ' of ' + P.length + ' unlocked \u00b7 0 completed', 'note');
    });
    await check('locked nodes are disabled and say so to screen readers', async () => {
      const locked = [...document.querySelectorAll('.node-btn[disabled]')];
      assert(locked.length === P.length - 1, 'expected ' + (P.length - 1) + ' locked, got ' + locked.length);
      locked.forEach(b => assert(b.getAttribute('aria-label').includes('locked'), 'aria-label: ' + b.getAttribute('aria-label')));
    });
    await check('route segments are drawn between every pair of nodes', async () => {
      eq(document.querySelectorAll('.route-svg path').length, P.length - 1, 'segments');
    });
  }

  /* ---------------- 5. listen-and-match round ---------------- */
  console.log('\nechoorbit-gameplay.html (listen mode)');
  {
    const page = await loadPage(port, '/echoorbit-gameplay.html?unit=k1');
    page.assertClean('echoorbit-gameplay.html');
    const { window, document } = page;
    const game = window.echoOrbitGame;
    const statusText = () => document.getElementById('status').textContent;
    const targetIndex = () => game.bubbles.findIndex(b => b.ipa === game.target.ipa);

    await check('game boots into the requested unit', async () => {
      eq(game.unit.id, 'k1', 'unit');
      eq(document.getElementById('unitTag').textContent, game.unit.title, 'hud unit');
    });
    await check('target is a phoneme from that unit', async () => {
      assert(game.unit.phonemes.some(p => p.ipa === game.target.ipa), 'target ' + game.target.ipa);
      eq(document.getElementById('targetIpa').textContent, game.target.ipa, 'badge');
      eq(document.getElementById('targetWord').textContent, '\u201c' + game.target.word + '\u201d', 'word');
    });
    await check('exactly one matching bubble is on screen', async () => {
      eq(game.bubbles.filter(b => b.ipa === game.target.ipa).length, 1, 'matching bubbles');
      assert(game.bubbles.length >= 3, 'only ' + game.bubbles.length + ' bubbles');
    });
    await check('bubbles do not spawn stacked on top of each other', async () => {
      const xs = game.bubbles.map(b => b.x);
      for (let i = 0; i < xs.length; i++){
        for (let j = i + 1; j < xs.length; j++){
          assert(Math.abs(xs[i] - xs[j]) > 20, 'bubbles ' + i + ' and ' + j + ' overlap at x=' + xs[i].toFixed(0));
        }
      }
    });
    await check('kindergarten units start in easy tap mode', async () => {
      eq(document.getElementById('easyTap').hidden, false, 'easyTap hidden');
      eq(document.querySelectorAll('#easyTapRow .bubble-pick').length, game.bubbles.length, 'buttons');
    });
    await check('new target is announced to screen readers', async () => {
      const s = statusText();
      assert(s.includes(game.target.ipa) && s.includes(game.target.word), 'status: "' + s + '"');
    });
    await check('"How?" reveals the mouth diagram for the target', async () => {
      click(document.getElementById('cueBtn'));
      eq(document.getElementById('cuePanel').hidden, false, 'panel hidden');
      eq(document.getElementById('cueBtn').getAttribute('aria-expanded'), 'true', 'aria-expanded');
      assert(document.getElementById('cueArt').querySelector('svg'), 'no diagram');
      assert(document.getElementById('cueCaption').textContent.length > 10, 'no caption');
    });
    await check('canvas is keyboard reachable and labelled', async () => {
      const canvas = document.getElementById('field');
      eq(canvas.getAttribute('tabindex'), '0', 'tabindex');
      assert(canvas.getAttribute('aria-label').length > 20, 'aria-label');
      eq(canvas.getAttribute('aria-describedby'), 'instructions', 'describedby');
    });
    await check('arrow keys aim and space fires without throwing', async () => {
      const canvas = document.getElementById('field');
      key(canvas, 'ArrowLeft'); key(canvas, 'ArrowLeft');
      key(canvas, 'ArrowUp'); key(canvas, 'ArrowDown');
      key(canvas, 'r');
      game.setAim(320, 100);
      key(canvas, ' ');
    });

    // Misses first, so the assertions below start from a known score.
    await check('a miss names the wrong sound and keeps the target alive', async () => {
      const wrongIndex = game.bubbles.findIndex(b => b.ipa !== game.target.ipa);
      const wrongIpa = game.bubbles[wrongIndex].ipa;
      game.pop(wrongIndex, false);
      await tick(220);
      eq(document.getElementById('scoreNum').textContent, '0', 'score');
      eq(document.getElementById('comboNum').textContent, '0', 'combo');
      assert(game.bubbles.some(b => b.ipa === game.target.ipa), 'no target bubble left after a miss');
      const s = statusText();
      assert(s.includes('Not quite'), 'status: "' + s + '"');
      assert(s.includes(wrongIpa), 'miss feedback should name ' + wrongIpa + ': "' + s + '"');
      assert(s.includes(game.target.word), 'miss feedback should repeat the target word: "' + s + '"');
    });
    await check('popping the matching bubble scores and narrates it', async () => {
      game.pop(targetIndex(), false);
      await tick(220);
      eq(game.score, 10, 'score');
      eq(document.getElementById('scoreNum').textContent, '10', 'hud score');
      eq(document.getElementById('comboNum').textContent, '1', 'hud combo');
      assert(statusText().includes('Match!'), 'status: "' + statusText() + '"');
    });
    await check('keyboard number keys pop a bubble', async () => {
      const before = game.score;
      key(document.getElementById('field'), String(targetIndex() + 1));
      assert(game.score > before, 'score did not increase (' + before + ' -> ' + game.score + ')');
    });
    await check('easy tap buttons pop the bubble they label', async () => {
      const before = game.score;
      const buttons = [...document.querySelectorAll('#easyTapRow .bubble-pick')];
      const match = buttons.find(b => b.querySelector('.ipa').textContent === game.target.ipa);
      assert(match, 'no easy tap button for the target');
      click(match);
      assert(game.score > before, 'score did not increase');
    });
    await check('finishing the unit unlocks the next one and persists it', async () => {
      let guard = 0;
      while (!game.roundOver && guard++ < 20){
        const idx = targetIndex();
        assert(idx > -1, 'no matching bubble on screen');
        game.pop(idx, false);
      }
      assert(game.roundOver, 'round never completed');
      eq(document.getElementById('completeOverlay').classList.contains('active'), true, 'overlay');
      eq(document.getElementById('summaryCorrect').textContent, '6 of 6', 'matches');
      const line = document.getElementById('unlockLine').textContent;
      assert(line.includes('First consonants'), 'unlock line: ' + line);
      const saved = JSON.parse(window.localStorage.getItem('echoorbit.progress.v1'));
      assert(saved.unlocked.includes('k2'), 'k2 not persisted: ' + JSON.stringify(saved));
      assert(saved.completed.includes('k1'), 'k1 not marked complete');
      eq(saved.bestScores.k1, game.score, 'best score saved');
      eq(document.getElementById('summaryBest').textContent, String(game.score), 'best in summary');
      // Three matches were already scored by the checks above, so this
      // loop only has to supply the rest of the six.
      assert(guard >= 1 && guard <= 6, 'pops needed to finish: ' + guard);
    });
    await check('completing a round stops the animation loop', async () => {
      const before = game.score;
      game.pop(0, false);
      eq(game.score, before, 'score changed after the round ended');
    });
  }

  /* ---------------- 6. persistence across screens ---------------- */
  console.log('\nprogress persistence across screens');
  {
    const stored = JSON.stringify({
      unlocked: ['k1', 'k2', 'g1a'], completed: ['k1', 'k2'], bestScores: { k1: 42, k2: 30 }
    });
    const page = await loadPage(port, '/echoorbit-gameplay.html?unit=g1a',
      { 'echoorbit.progress.v1': stored });
    page.assertClean('gameplay with saved progress');

    await check('a previously unlocked unit resolves from storage alone', async () => {
      eq(page.window.echoOrbitGame.unit.id, 'g1a', 'unit');
      eq(page.document.getElementById('unitTag').textContent, 'More short vowels', 'unit tag');
    });
    await check('best score is read back from storage', async () => {
      eq(g(page.window, 'getBestScore')('k1'), 42, 'best score');
    });
    await check('completed units are known to the path page', async () => {
      const p2 = await loadPage(port, '/echoorbit-path.html', { 'echoorbit.progress.v1': stored });
      p2.assertClean('path with saved progress');
      eq(p2.document.getElementById('progressNote').textContent, '3 of 9 unlocked \u00b7 2 completed', 'note');
      eq(p2.document.querySelectorAll('.node-btn:not([disabled])').length, 3, 'unlocked nodes');
      assert(p2.document.querySelector('.node-badge.done'), 'no completed badge rendered');
    });
    await check('home page resumes at the furthest unlocked unit', async () => {
      const p3 = await loadPage(port, '/index.html', { 'echoorbit.progress.v1': stored });
      p3.assertClean('index with saved progress');
      eq(p3.document.getElementById('unitTitle').textContent, 'More short vowels', 'resumed unit');
    });
    await check('an unknown unit id falls back instead of crashing', async () => {
      const p4 = await loadPage(port, '/echoorbit-gameplay.html?unit=does-not-exist');
      p4.assertClean('gameplay with bad unit');
      eq(p4.window.echoOrbitGame.unit.id, 'k1', 'fallback unit');
    });
  }

  /* ---------------- 7. say-it mode ---------------- */
  console.log('\nechoorbit-sayit.html (say mode)');
  {
    const page = await loadPage(port, '/echoorbit-sayit.html?unit=k1');
    page.assertClean('echoorbit-sayit.html');
    const { window, document } = page;
    const game = window.echoOrbitGame;

    await check('boots in say mode with a mic control', async () => {
      eq(game.mode, 'say', 'mode');
      assert(document.getElementById('micBtn'), 'no mic button');
    });
    await check('mic degrades gracefully without speech recognition', async () => {
      eq(document.getElementById('micBtn').disabled, true, 'mic should be disabled');
      eq(document.getElementById('micUnsupported').hidden, false, 'explanation hidden');
      assert(game.bubbles.length >= 3, 'no bubbles');   // still playable by tapping
    });
    await check('a correctly spoken word scores the voice bonus', async () => {
      const word = game.target.word;
      const before = game.score;
      game.sayWord(word, 0.9);
      eq(game.score - before, 18, 'points awarded (10 + 8 voice bonus)');
      assert(document.getElementById('micHeard').textContent.includes(word),
             'heard transcript: "' + document.getElementById('micHeard').textContent + '"');
      assert(document.getElementById('toast').textContent.includes('Great sound'),
             'toast: "' + document.getElementById('toast').textContent + '"');
    });
    await check('an unrelated word does not score', async () => {
      const before = game.score;
      game.sayWord('xylophone', 0.9);
      eq(game.score, before, 'score');
      eq(document.getElementById('toast').textContent, 'Try saying it again', 'toast');
    });
    await check('a one-letter-off attempt still counts', async () => {
      const word = game.target.word;
      const fuzzy = word.slice(0, -1) + (word.slice(-1) === 't' ? 'g' : 't');
      const before = game.score;
      game.sayWord(fuzzy, 0.4);
      assert(game.score > before, 'fuzzy "' + fuzzy + '" for "' + word + '" did not score');
    });
    await check('a mumbled attempt scores but asks for a louder one', async () => {
      const word = game.target.word;
      const before = game.score;
      game.sayWord(word, 0.2);
      assert(game.score > before, 'low-confidence attempt did not score');
      await tick(220);
      assert(document.getElementById('status').textContent.includes('louder'),
             'status: "' + document.getElementById('status').textContent + '"');
    });
  }

  /* ---------------- report ---------------- */
  console.log('\n' + '-'.repeat(52));
  if (failures.length){
    console.log(failures.length + ' FAILED, ' + passed + ' passed');
    failures.forEach(f => console.log('  - ' + f));
    process.exitCode = 1;
  } else {
    console.log('all ' + passed + ' checks passed');
  }
  server.close();
  process.exit(process.exitCode || 0);
})().catch(e => { console.error(e); process.exit(1); });
