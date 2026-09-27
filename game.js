/* EchoOrbit shared game engine.

   The two gameplay screens used to be separate near-identical copies of
   ~600 lines each; this is the single implementation, with `mode`
   ('listen' | 'say') switching the voice layer on or off. Everything
   here reads a fixed set of element ids that both pages provide.

   What changed relative to the old copies:
     - the canvas is keyboard-operable (arrows aim, space fires) and the
       round is narrated into an aria-live region, so the game is not
       mouse-and-eyes only;
     - "Easy tap" gives a no-aim way to pop a bubble, on by default for
       kindergarten units;
     - a miss now says which sound it actually was and speaks that word,
       which is the contrastive practice that teaches the pair;
     - the correct bubble is always kept on screen and hit tests pick the
       nearest bubble rather than the last one drawn;
     - progress and best scores are persisted through progression.js. */

window.EchoOrbitGame = (function(){
  const COMPLETE_AT = 6;    // correct matches needed to finish a unit
  const MIN_BUBBLES = 3;
  const MAX_BUBBLES = 6;
  const BUBBLE_R = 34;
  const EASY_TAP_KEY = 'echoorbit.easytap';

  // Optional lookups stay silent: the two screens legitimately provide
  // different subsets (only "Say it" has a mic row). The boot check below
  // is what reports a genuinely missing element.
  function $(id){
    return document.getElementById(id);
  }

  const REQUIRED = ['field','toast','status','unitTag','scoreNum','comboNum',
    'targetIpa','targetBadge','backBtn','completeOverlay','summaryScore',
    'summaryCorrect','unlockLine','continueBtn','easyTap','easyTapRow'];

  function start(options){
    const opts = options || {};
    const mode = opts.mode === 'say' ? 'say' : 'listen';

    const missing = REQUIRED.concat(mode === 'say' ? ['micBtn', 'micLabel'] : [])
      .filter(id => !document.getElementById(id));
    if (missing.length){
      console.error('[echoOrbit] page is missing required element(s): ' + missing.join(', '));
    }

    const canvas = $('field');
    const ctx = canvas.getContext('2d');
    const W = canvas.width, H = canvas.height;

    /* ---------- unit selection ---------- */
    const params = new URLSearchParams(window.location.search);
    restoreProgress();
    applyUnlockedParam(params.get('unlocked'));
    const unit = resolveUnit(params.get('unit'));
    const pool = unit.phonemes.map(p => ({
      ipa: p.ipa, word: primaryWord(p), colorKey: unit.colorKey, data: p
    }));

    /* ---------- state ---------- */
    let bubbles = [];
    let particles = [];
    let projectile = null;
    let target = null;
    let score = 0, combo = 0, correctCount = 0, misses = 0;
    let roundOver = false;
    let rafId = null;
    let aim = { x: W/2, y: H/2 };
    let aimAngle = -Math.PI/2, aimDist = 240;   // keyboard aiming
    const CANNON = { x: W/2, y: H - 30 };

    // Voice-input bookkeeping. `micWanted` is what the player asked for;
    // `isListening` is whether recognition is actually running right now.
    // They differ while the game is speaking, which is exactly when the
    // mic has to stay off so it doesn't hear the game.
    let recognition = null;
    let isListening = false;
    let micWanted = false;
    let speaking = false;

    const stars = Array.from({length:26}, () => ({
      x: Math.random()*W, y: Math.random()*H,
      r: Math.random()*1.3 + 0.4,
      phase: Math.random()*Math.PI*2
    }));

    function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }

    /* Difficulty ramps with score: more bubbles on screen and a faster
       fall. Recalculated live rather than fixed at spawn time. */
    function desiredBubbleCount(){
      return Math.min(MAX_BUBBLES, MIN_BUBBLES + Math.floor(score / 25));
    }
    function speedMultiplier(){
      return Math.min(2.2, 1 + score / 120);
    }

    /* ---------- narration ----------
       Screen-reader announcements have to be batched: popping a bubble
       fires "Match!" and then immediately "New sound: ...", and writing
       them one after another means the first is never spoken. */
    const status = $('status');
    let announceTimer = null;
    let announceQueue = [];
    function announce(msg){
      if (!status) return;
      announceQueue.push(msg);
      // Clearing first guarantees repeated identical messages still fire.
      status.textContent = '';
      window.clearTimeout(announceTimer);
      announceTimer = window.setTimeout(() => {
        const batch = announceQueue;
        announceQueue = [];
        status.textContent = batch.join(' ');
      }, 100);
    }

    function toast(msg, cls){
      const el = $('toast');
      if (!el) return;
      el.textContent = msg;
      el.className = 'feedback-toast show ' + cls;
      window.setTimeout(() => el.classList.remove('show'), 900);
    }

    /* ---------- distractor selection ----------
       Real phonics instruction deliberately pairs a target sound with
       sounds it's commonly confused with, so this biases toward those
       instead of picking a fully random pool member -- that is what
       builds discrimination skill rather than symbol recognition. The
       1-in-4 fallback keeps some easy, unrelated decoys in the mix so a
       round isn't always maximally hard. */
    function pickDistractor(){
      if (target){
        const confusable = getConfusablePhonemes(target.ipa);
        if (confusable.length){
          const inPool = pool.filter(p => p.ipa !== target.ipa && confusable.includes(p.ipa));
          if (inPool.length && Math.random() < 0.75) return pick(inPool);

          const crossUnit = confusable
            .map(ipa => findPhonemeSource(ipa, true))
            .filter(src => src && src.unit.id !== unit.id);
          if (crossUnit.length && Math.random() < 0.6){
            const src = pick(crossUnit);
            return { ipa: src.phoneme.ipa, word: primaryWord(src.phoneme),
                     colorKey: src.unit.colorKey, data: src.phoneme };
          }
        }
      }
      const rest = target ? pool.filter(p => p.ipa !== target.ipa) : pool;
      return pick(rest.length ? rest : pool);
    }

    // Spawn somewhere that isn't already covered by another bubble, so
    // two planets never stack up into an unreadable blob.
    function spawnX(){
      for (let attempt = 0; attempt < 12; attempt++){
        const x = BUBBLE_R + 16 + Math.random() * (W - 2*(BUBBLE_R + 16));
        const clash = bubbles.some(b => Math.abs(b.x - x) < BUBBLE_R * 2 && b.y < BUBBLE_R * 3);
        if (!clash) return x;
      }
      return BUBBLE_R + 16 + Math.random() * (W - 2*(BUBBLE_R + 16));
    }

    function spawnBubble(forceMatch, slot){
      const def = forceMatch ? target : pickDistractor();
      bubbles.push({
        ipa: def.ipa,
        word: def.word,
        data: def.data,
        colorKey: def.colorKey,
        x: spawnX(),
        y: -BUBBLE_R - (slot || 0) * (BUBBLE_R * 2.6),
        vy: 0.35 + Math.random()*0.25,
        wob: Math.random()*Math.PI*2,
        r: BUBBLE_R
      });
    }

    /* ---------- the articulation cue ---------- */
    function renderCue(){
      const panel = $('cuePanel');
      if (!panel) return;
      const p = target.data;
      const art = $('cueArt');
      if (art && typeof mouthSvg === 'function') art.innerHTML = mouthSvg(p, 116);
      const tip = $('cueTip');
      if (tip) tip.textContent = p.tip || '';
      const cap = $('cueCaption');
      if (cap) cap.textContent = mouthCaption(p);
      const list = $('cueWords');
      if (list){
        list.innerHTML = '';
        (p.words || []).forEach(w => {
          const li = document.createElement('li');
          const b = document.createElement('button');
          b.type = 'button';
          b.className = 'cue-word';
          b.textContent = w;
          b.addEventListener('click', () => { unlockAudio(); speak(w); });
          li.appendChild(b);
          list.appendChild(li);
        });
      }
    }

    /* ---------- easy tap row ---------- */
    function easyTapDefault(){
      try {
        const saved = window.localStorage.getItem(EASY_TAP_KEY);
        if (saved !== null) return saved === '1';
      } catch (e) {}
      return unit.grade === 'K';   // kindergarten players start with no aiming
    }
    function setEasyTap(on){
      const wrap = $('easyTap'), btn = $('easyTapBtn');
      if (wrap) wrap.hidden = !on;
      if (btn) btn.setAttribute('aria-pressed', on ? 'true' : 'false');
      try { window.localStorage.setItem(EASY_TAP_KEY, on ? '1' : '0'); } catch (e) {}
      if (on) renderEasyTap();
      announce(on ? 'Easy tap mode on. Choose a sound from the buttons.' : 'Easy tap mode off.');
    }
    function renderEasyTap(){
      const row = $('easyTapRow');
      const wrap = $('easyTap');
      if (!row || !wrap || wrap.hidden) return;
      row.innerHTML = '';
      bubbles.forEach((b, i) => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'bubble-pick';
        btn.dataset.index = String(i);
        btn.innerHTML = '<span class="key">' + (i + 1) + '</span><span class="ipa"></span>';
        btn.querySelector('.ipa').textContent = b.ipa;
        btn.setAttribute('aria-label', 'Pop bubble ' + (i + 1) + ': ' + b.ipa + ', as in ' + b.word);
        btn.addEventListener('click', () => resolvePop(i, false));
        row.appendChild(btn);
      });
    }

    /* ---------- round flow ---------- */
    function newTarget(){
      target = pick(pool);
      $('targetIpa').textContent = target.ipa;
      const wordEl = $('targetWord');
      if (wordEl) wordEl.textContent = '\u201c' + target.word + '\u201d';
      const badge = $('targetBadge');
      if (badge) badge.setAttribute('aria-label', 'Play the sound ' + target.ipa + ', as in ' + target.word);

      bubbles = [];
      spawnBubble(true, 0);
      const count = desiredBubbleCount();
      for (let i = 1; i < count; i++) spawnBubble(false, i);

      renderCue();
      renderEasyTap();
      announce('New sound: ' + target.ipa + ', as in ' + target.word + '. Find it or pop it.');
      speakTarget();
    }

    // Says the target word, pausing mic listening first and resuming it
    // afterward if the player had it on -- otherwise the mic would hear
    // the game's own voice output and score it as the player's attempt.
    function speakTarget(onDone){
      speaking = true;
      if (isListening && recognition){
        try { recognition.stop(); } catch (err) {}
      }
      speak(target.word, { onEnd: () => {
        speaking = false;
        restartMicIfWanted();
        if (onDone) onDone();
      }});
    }

    function resolvePop(index, viaVoice){
      if (roundOver || index < 0 || index >= bubbles.length) return;
      const bubble = bubbles[index];
      const correct = target && bubble.ipa === target.ipa;
      popBubble(index, correct, viaVoice);
    }

    function popBubble(index, correct, viaVoice){
      const popped = bubbles[index];
      bubbles.splice(index, 1);

      if (correct){
        spawnPopParticles(popped.x, popped.y, popped.colorKey);
        const bonus = viaVoice ? 8 : 0;
        const gained = 10 + combo * 2 + bonus;
        score += gained;
        combo += 1;
        correctCount += 1;
        toast(viaVoice ? 'Great sound! +' + gained : 'Match! +' + gained, viaVoice ? 'voice' : 'correct');
        playCorrectChime();
        updateHud();
        announce('Match! ' + popped.ipa + ' as in ' + popped.word + '. Plus ' + gained + ' points. Score ' + score + '. '
          + (COMPLETE_AT - correctCount) + ' more to finish the unit.');
        if (correctCount >= COMPLETE_AT){
          completeRound();
          return;
        }
        newTarget();
      } else {
        spawnMissParticles(popped.x, popped.y);
        combo = 0;
        misses += 1;
        toast('That was ' + popped.ipa, 'wrong');
        playWrongTone();
        // The useful feedback is the contrast: name the sound they got
        // and let them hear it next to the target.
        announce('Not quite. That was ' + popped.ipa + ', as in ' + popped.word + '. The sound to find is '
          + target.ipa + ', as in ' + target.word + '.');
        speak(popped.word);
        const count = desiredBubbleCount();
        while (bubbles.length < count - 1) spawnBubble(false, 0);
        // Never let the round reach a state with no correct bubble.
        if (!bubbles.some(b => b.ipa === target.ipa)) spawnBubble(true, 0);
        updateHud();
      }
      renderEasyTap();
    }

    function updateHud(){
      $('scoreNum').textContent = score;
      $('comboNum').textContent = combo;
    }

    function completeRound(){
      roundOver = true;
      bubbles = [];
      projectile = null;
      if (rafId !== null){ cancelAnimationFrame(rafId); rafId = null; }
      playCompleteFanfare();
      stopListening();
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();

      const next = unlockNext(unit.id);
      markComplete(unit.id, score);

      $('summaryScore').textContent = score;
      $('summaryCorrect').textContent = correctCount + ' of ' + COMPLETE_AT;
      const best = $('summaryBest');
      if (best) best.textContent = getBestScore(unit.id);
      const unlockLine = $('unlockLine');
      unlockLine.textContent = next
        ? 'New unit unlocked: ' + next.title
        : 'You\u2019ve finished every unit in the path!';

      const overlay = $('completeOverlay');
      overlay.classList.add('active');
      spawnConfetti();
      announce('Unit complete! Score ' + score + '. ' + unlockLine.textContent);

      const continueBtn = $('continueBtn');
      continueBtn.onclick = () => {
        window.location.href = 'index.html?unit=' + encodeURIComponent(unit.id)
          + '&unlocked=' + encodeURIComponent(unlockedIdList());
      };
      const replayBtn = $('replayBtn');
      if (replayBtn) replayBtn.onclick = () => window.location.reload();
      // Move focus into the dialog so keyboard users land on an action.
      window.setTimeout(() => continueBtn.focus(), 60);
    }

    function spawnConfetti(){
      const overlay = $('completeOverlay');
      if (!overlay) return;
      overlay.querySelectorAll('.confetti-piece').forEach(el => el.remove());
      const colors = ['var(--teal)', 'var(--coral)', 'var(--amber)'];
      for (let i = 0; i < 20; i++){
        const el = document.createElement('div');
        el.className = 'confetti-piece';
        el.style.left = (8 + Math.random() * 84) + '%';
        el.style.background = colors[i % colors.length];
        el.style.animationDuration = (1.1 + Math.random() * 0.9) + 's';
        el.style.animationDelay = (Math.random() * 0.35) + 's';
        overlay.appendChild(el);
      }
    }

    /* ---------- rendering ---------- */
    function drawStars(t){
      stars.forEach(s => {
        ctx.globalAlpha = 0.25 + 0.4 * (0.5 + 0.5*Math.sin(t/900 + s.phase));
        ctx.fillStyle = '#F5EFE0';
        ctx.beginPath();
        ctx.arc(s.x, s.y, s.r, 0, Math.PI*2);
        ctx.fill();
      });
      ctx.globalAlpha = 1;
    }

    function drawPlanet(b){
      const colors = palette[b.colorKey];
      const grad = ctx.createRadialGradient(
        b.x - b.r*0.35, b.y - b.r*0.4, b.r*0.15,
        b.x, b.y, b.r
      );
      grad.addColorStop(0, colors.light);
      grad.addColorStop(0.55, colors.fill);
      grad.addColorStop(1, colors.dark);
      ctx.beginPath();
      ctx.arc(b.x, b.y, b.r, 0, Math.PI*2);
      ctx.fillStyle = grad;
      ctx.fill();

      // `ink` rather than `dark`: the symbol has to stay readable against
      // the bright middle of the planet (7:1 instead of 3:1).
      ctx.fillStyle = colors.ink || colors.dark;
      ctx.font = '700 20px Baloo 2, sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(b.ipa, b.x, b.y + 1);
    }

    // Correct pops get an energetic shard burst plus an expanding
    // shockwave ring, colored to match the bubble that popped.
    function spawnPopParticles(x, y, colorKey){
      const colors = palette[colorKey];
      const count = 12;
      for (let i = 0; i < count; i++){
        const angle = (Math.PI * 2 * i / count) + (Math.random() - 0.5) * 0.5;
        const speed = 2 + Math.random() * 2;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed,
          r: 3 + Math.random() * 2.5,
          color: Math.random() < 0.5 ? colors.fill : colors.light,
          life: 1,
          decay: 0.022 + Math.random() * 0.014
        });
      }
      particles.push({ ring: true, x, y, r: 8, maxR: 44, life: 1, decay: 0.045, color: colors.fill });
    }

    // Misses get a quiet, muted puff -- fewer particles, no shockwave,
    // since wrong answers shouldn't feel punished, just acknowledged.
    function spawnMissParticles(x, y){
      for (let i = 0; i < 6; i++){
        const angle = Math.random() * Math.PI * 2;
        const speed = 0.5 + Math.random() * 0.6;
        particles.push({
          x, y,
          vx: Math.cos(angle) * speed,
          vy: Math.sin(angle) * speed - 0.2,
          r: 2 + Math.random() * 1.4,
          color: 'rgba(245,239,224,0.55)',
          life: 1,
          decay: 0.035
        });
      }
    }

    function updateAndDrawParticles(){
      particles = particles.filter(p => p.life > 0);
      particles.forEach(p => {
        if (p.ring){
          p.r += (p.maxR - p.r) * 0.22;
          p.life -= p.decay;
          ctx.globalAlpha = Math.max(p.life, 0) * 0.6;
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = 2;
          ctx.stroke();
        } else {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.05;
          p.life -= p.decay;
          ctx.globalAlpha = Math.max(p.life, 0);
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
          ctx.fillStyle = p.color;
          ctx.fill();
        }
      });
      ctx.globalAlpha = 1;
    }

    function drawCannon(){
      const dx = aim.x - CANNON.x, dy = aim.y - CANNON.y;
      const angle = Math.atan2(dy, dx);

      ctx.save();
      ctx.strokeStyle = 'rgba(245,239,224,0.22)';
      ctx.setLineDash([5, 7]);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.moveTo(CANNON.x, CANNON.y);
      ctx.lineTo(CANNON.x + Math.cos(angle)*260, CANNON.y + Math.sin(angle)*260);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.restore();

      ctx.save();
      ctx.translate(CANNON.x, CANNON.y);
      ctx.rotate(angle + Math.PI/2);
      ctx.beginPath();
      ctx.moveTo(0, -20); ctx.lineTo(9, 10); ctx.lineTo(-9, 10);
      ctx.closePath();
      ctx.fillStyle = '#F5EFE0';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-9,10); ctx.lineTo(-14,20); ctx.lineTo(-4,14); ctx.closePath();
      ctx.fillStyle = '#EF9F27';
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(9,10); ctx.lineTo(14,20); ctx.lineTo(4,14); ctx.closePath();
      ctx.fillStyle = '#F0997B';
      ctx.fill();
      ctx.restore();
    }

    function loop(t){
      if (roundOver) return;
      ctx.clearRect(0,0,W,H);
      drawStars(t);

      const mult = speedMultiplier();
      bubbles.forEach(b => {
        b.y += b.vy * mult;
        b.x += Math.sin(t/700 + b.wob) * 0.4;
        if (b.y - b.r > H){ b.y = -b.r; b.x = spawnX(); }
        drawPlanet(b);
      });
      drawCannon();

      if (projectile){
        projectile.x += projectile.vx;
        projectile.y += projectile.vy;
        ctx.beginPath();
        ctx.arc(projectile.x, projectile.y, 6, 0, Math.PI*2);
        ctx.fillStyle = '#F5EFE0';
        ctx.fill();

        // Nearest overlapping bubble, not merely the last one tested.
        let hitIndex = -1, hitDist = Infinity;
        bubbles.forEach((b, i) => {
          const d = Math.hypot(projectile.x - b.x, projectile.y - b.y);
          if (d < b.r + 6 && d < hitDist){ hitDist = d; hitIndex = i; }
        });
        if (hitIndex > -1){
          projectile = null;
          resolvePop(hitIndex, false);
        } else if (projectile.x < 0 || projectile.x > W || projectile.y < 0 || projectile.y > H){
          projectile = null;
        }
      }

      updateAndDrawParticles();
      rafId = requestAnimationFrame(loop);
    }

    function fire(x, y){
      if (projectile || roundOver) return;
      const dx = x - CANNON.x, dy = y - CANNON.y;
      const len = Math.hypot(dx, dy) || 1;
      projectile = { x: CANNON.x, y: CANNON.y, vx: dx/len * 9, vy: dy/len * 9 };
    }

    function pointerPos(evt){
      const rect = canvas.getBoundingClientRect();
      const touch = evt.touches && evt.touches[0];
      const clientX = touch ? touch.clientX : evt.clientX;
      const clientY = touch ? touch.clientY : evt.clientY;
      return {
        x: (clientX - rect.left) * (W / rect.width),
        y: (clientY - rect.top) * (H / rect.height)
      };
    }

    /* ---------- input ---------- */
    canvas.addEventListener('mousemove', e => { aim = pointerPos(e); });
    canvas.addEventListener('click', e => {
      unlockAudio(); dismissStartHint();
      const p = pointerPos(e); aim = p; fire(p.x, p.y);
    });
    canvas.addEventListener('touchstart', e => {
      unlockAudio(); dismissStartHint();
      const p = pointerPos(e); aim = p; fire(p.x, p.y); e.preventDefault();
    }, {passive:false});

    // Keyboard play: arrows aim, space or enter fires, 1-6 pop a bubble
    // directly, R repeats the sound. This is what makes the round
    // completable without a pointer.
    canvas.addEventListener('keydown', e => {
      unlockAudio(); dismissStartHint();
      const step = 0.06;
      let handled = true;
      switch (e.key){
        case 'ArrowLeft':  aimAngle -= step; break;
        case 'ArrowRight': aimAngle += step; break;
        case 'ArrowUp':    aimDist = Math.min(420, aimDist + 12); break;
        case 'ArrowDown':  aimDist = Math.max(60, aimDist - 12); break;
        case ' ': case 'Spacebar': case 'Enter': fire(aim.x, aim.y); break;
        case 'r': case 'R': speakTarget(); break;
        default:
          if (/^[1-9]$/.test(e.key)){
            const i = parseInt(e.key, 10) - 1;
            if (i < bubbles.length) resolvePop(i, false);
          } else {
            handled = false;
          }
      }
      if (handled){
        e.preventDefault();
        // Keep arrows constrained to the upper half so the aim line
        // never points back down at the cannon.
        aimAngle = Math.max(-Math.PI + 0.15, Math.min(-0.15, aimAngle));
        aim = { x: CANNON.x + Math.cos(aimAngle) * aimDist,
                y: CANNON.y + Math.sin(aimAngle) * aimDist };
      }
    });

    function dismissStartHint(){
      const hint = $('startHint');
      if (hint) hint.hidden = true;
    }

    $('targetBadge').addEventListener('click', () => {
      unlockAudio(); dismissStartHint();
      speakTarget();
    });

    const slowBtn = $('slowBtn');
    if (slowBtn){
      slowBtn.addEventListener('click', () => {
        unlockAudio(); dismissStartHint();
        speaking = true;
        if (isListening && recognition){
          try { recognition.stop(); } catch (err) {}
        }
        speakSlow(target.word, () => { speaking = false; restartMicIfWanted(); });
      });
    }

    const cueBtn = $('cueBtn');
    if (cueBtn){
      cueBtn.addEventListener('click', () => {
        const panel = $('cuePanel');
        const open = panel.hidden;
        panel.hidden = !open;
        cueBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
        announce(open ? 'How to make the sound: ' + (target.data.tip || '') : 'Sound help closed.');
      });
    }

    const easyTapBtn = $('easyTapBtn');
    if (easyTapBtn) easyTapBtn.addEventListener('click', () => setEasyTap($('easyTap').hidden));

    /* ---------- mute ---------- */
    const muteBtn = $('muteBtn');
    const muteIconWave = $('muteIconWave');
    const muteIconSlash = $('muteIconSlash');
    function syncMuteIcon(){
      const muted = getMuted();
      if (muteIconSlash) muteIconSlash.style.display = muted ? 'block' : 'none';
      if (muteIconWave) muteIconWave.style.display = muted ? 'none' : 'block';
      if (muteBtn){
        muteBtn.setAttribute('aria-label', muted ? 'Unmute sound' : 'Mute sound');
        muteBtn.setAttribute('aria-pressed', muted ? 'true' : 'false');
      }
    }
    if (muteBtn) muteBtn.addEventListener('click', () => {
      unlockAudio();
      toggleMute();
      syncMuteIcon();
      announce(getMuted() ? 'Sound off.' : 'Sound on.');
    });
    syncMuteIcon();

    $('backBtn').addEventListener('click', () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
      const dest = 'index.html?unit=' + encodeURIComponent(unit.id)
        + '&unlocked=' + encodeURIComponent(unlockedIdList());
      if (window.history.length > 1) window.history.back();
      else window.location.href = dest;
    });

    /* ---------- voice input (say-it mode, bonus layer never a gate) ----------
       Tap-to-fire always works on its own. Speech recognition is an
       additional, more lenient way to trigger the same match -- if it is
       unsupported or the mic is blocked, the game stays fully playable. */
    const micBtn = $('micBtn');
    const micLabel = $('micLabel');
    const micHeard = $('micHeard');
    const micUnsupported = $('micUnsupported');
    const SpeechRecognitionCtor = window.SpeechRecognition || window.webkitSpeechRecognition;

    function normalize(str){
      return String(str || '').toLowerCase().replace(/[^a-z']/g, '').trim();
    }

    /* Lenient on purpose. Exact match, "contains", or one letter off all
       count, because a young child's mic audio is noisy and this layer
       exists to encourage attempts, not to grade pronunciation. */
    function isCloseMatch(said, word){
      const a = normalize(said), b = normalize(word);
      if (!a || !b) return false;
      if (a === b || a.includes(b) || b.includes(a)) return true;
      if (Math.abs(a.length - b.length) > 2) return false;
      let diffs = 0;
      const len = Math.max(a.length, b.length);
      for (let i = 0; i < len; i++){
        if (a[i] !== b[i]) diffs++;
      }
      return diffs <= 1;
    }

    function setMicUi(label){
      if (micBtn) micBtn.classList.toggle('listening', isListening);
      if (micLabel) micLabel.textContent = label;
    }

    /* The mic restarts itself between utterances, but never while the
       game is speaking and never once the round is over. */
    function restartMicIfWanted(){
      if (!recognition || !micWanted || speaking || roundOver || !micBtn || micBtn.disabled){
        return;
      }
      if (isListening) return;
      isListening = true;
      setMicUi('Listening\u2026');
      try { recognition.start(); } catch (err) { /* already starting */ }
    }

    function stopListening(){
      micWanted = false;
      if (recognition && isListening){
        try { recognition.stop(); } catch (err) {}
      }
      isListening = false;
      setMicUi('Tap to talk');
    }

    function handleTranscript(transcript, confidence){
      if (roundOver || !target) return;
      if (micHeard) micHeard.textContent = 'I heard: \u201c' + transcript + '\u201d';
      if (!isCloseMatch(transcript, target.word)){
        toast('Try saying it again', 'wrong');
        announce('I heard ' + transcript + '. The word is ' + target.word + '. Try it once more.');
        return;
      }
      const idx = bubbles.findIndex(b => b.ipa === target.ipa);
      if (idx === -1){
        announce('Good. Now pop the ' + target.ipa + ' bubble to score it.');
        return;
      }
      popBubble(idx, true, true);
      // The browser's own confidence is a rough proxy for how clearly the
      // sound came through, so a mumbled attempt still scores but asks
      // for a stronger one next time.
      if (confidence < 0.6){
        announce('I heard you. Try saying it a little louder and slower.');
      }
    }

    if (mode === 'say'){
      if (SpeechRecognitionCtor){
        recognition = new SpeechRecognitionCtor();
        recognition.lang = 'en-US';
        recognition.continuous = false;
        recognition.interimResults = false;

        recognition.onresult = (e) => {
          const result = e.results[e.results.length - 1][0];
          handleTranscript(result.transcript, typeof result.confidence === 'number' ? result.confidence : 1);
        };
        recognition.onerror = (e) => {
          if (e.error === 'not-allowed' || e.error === 'service-not-allowed'){
            micWanted = false;
            isListening = false;
            setMicUi('Mic blocked');
            micBtn.disabled = true;
            if (micUnsupported){
              micUnsupported.hidden = false;
              micUnsupported.textContent = 'Microphone access was blocked \u2014 tap the bubbles instead.';
            }
          }
          // Other errors (no-speech, network) fall through to onend,
          // which restarts listening automatically.
        };
        recognition.onend = () => {
          isListening = false;
          // Recognition fires onend after every utterance; keep going if
          // the player still wants the mic and the game isn't talking.
          restartMicIfWanted();
        };

        micBtn.addEventListener('click', () => {
          unlockAudio();
          micWanted = !micWanted;
          if (micWanted){
            announce('Listening. Say ' + target.word + '.');
            restartMicIfWanted();
          } else {
            stopListening();
            announce('Microphone off.');
          }
        });
      } else {
        micBtn.disabled = true;
        if (micLabel) micLabel.textContent = 'Voice unavailable';
        if (micUnsupported) micUnsupported.hidden = false;
      }
    }

    /* ---------- boot ---------- */
    $('unitTag').textContent = unit.title;
    document.title = 'EchoOrbit \u2014 ' + unit.title;
    document.addEventListener('pointerdown', dismissStartHint, { once: true });
    setEasyTap(easyTapDefault());
    installAudioUnlock();
    newTarget();
    rafId = requestAnimationFrame(loop);

    // Don't leave a voice talking after the player navigates away.
    window.addEventListener('pagehide', () => {
      if ('speechSynthesis' in window) window.speechSynthesis.cancel();
    });

    // Expose a little of the internals so the test suite can drive a
    // real round without reaching for a pointer.
    return {
      unit: unit,
      mode: mode,
      get bubbles(){ return bubbles; },
      get target(){ return target; },
      get score(){ return score; },
      get roundOver(){ return roundOver; },
      pop: resolvePop,
      fire: fire,
      sayWord: handleTranscript,
      get micWanted(){ return micWanted; },
      setAim: (x, y) => { aim = { x: x, y: y }; }
    };
  }

  return { start: start };
})();
