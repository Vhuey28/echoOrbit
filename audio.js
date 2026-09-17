/* EchoOrbit shared audio module.
   - Words are spoken with the browser's built-in speech synthesis, so no
     recorded audio files are needed for this prototype.
   - Feedback sounds (correct/wrong/complete) are synthesized tones via
     the Web Audio API, same reason.
   - Browsers block audio before a user gesture happens on the page, so
     nothing here plays automatically until unlockAudio() has run once,
     which the calling screens trigger on the player's first tap/click. */

let audioUnlocked = false;
let isMuted = false;
let audioCtx = null;

function unlockAudio(){
  if (audioUnlocked) return;
  audioUnlocked = true;
  try {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  } catch (e) {
    audioCtx = null;
  }
  // Some browsers need an explicit resume even after construction.
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {});
  }
}

function toggleMute(){
  isMuted = !isMuted;
  if (isMuted && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  return isMuted;
}

// Best-effort only -- exact voice availability varies by device and OS,
// so this can't guarantee a "kid-friendly" voice, just a reasonable one.
function pickVoice(){
  if (!('speechSynthesis' in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  return voices.find(v => v.lang === 'en-US') || voices[0] || null;
}

function speak(text, onEnd){
  if (isMuted || !audioUnlocked || !('speechSynthesis' in window)) {
    if (onEnd) onEnd();
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = 0.85;   // slightly slower, easier for early readers to track
  utter.pitch = 1.08;
  utter.lang = 'en-US';
  const voice = pickVoice();
  if (voice) utter.voice = voice;
  if (onEnd) utter.onend = onEnd;
  window.speechSynthesis.speak(utter);
}

function tone(freq, duration, delay, type){
  if (isMuted || !audioCtx) return;
  const osc = audioCtx.createOscillator();
  const gain = audioCtx.createGain();
  osc.type = type || 'sine';
  osc.frequency.value = freq;
  osc.connect(gain);
  gain.connect(audioCtx.destination);
  const start = audioCtx.currentTime + (delay || 0);
  gain.gain.setValueAtTime(0.0001, start);
  gain.gain.exponentialRampToValueAtTime(0.15, start + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
  osc.start(start);
  osc.stop(start + duration + 0.03);
}

function playCorrectChime(){
  tone(523.25, 0.12, 0, 'sine');    // C5
  tone(659.25, 0.16, 0.08, 'sine'); // E5
}

// Deliberately gentle and low, not buzzer-like -- misses shouldn't feel
// punishing, per the no-fail-state design of these gameplay screens.
function playWrongTone(){
  tone(220, 0.18, 0, 'sine');
}

function playCompleteFanfare(){
  tone(523.25, 0.14, 0);
  tone(659.25, 0.14, 0.12);
  tone(783.99, 0.24, 0.24);
}