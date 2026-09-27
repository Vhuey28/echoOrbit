/* EchoOrbit shared audio module.
   - Words are spoken with the browser's built-in speech synthesis, so no
     recorded audio files are needed for this prototype.
   - Feedback sounds (correct/wrong/complete) are synthesized tones via
     the Web Audio API, same reason.
   - Browsers block audio before a user gesture happens on the page.
     installAudioUnlock() listens once for that gesture; anything queued
     with speak() before it lands plays as soon as it does, so a kid who
     arrives straight on a gameplay screen is never left in silence. */

let audioUnlocked = false;
let isMuted = false;
let audioCtx = null;
let cachedVoices = [];
let pendingSpeak = null;   // only the most recent request is remembered

const MUTE_KEY = 'echoorbit.muted';

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
  loadMutePreference();
  const queued = pendingSpeak;
  pendingSpeak = null;
  if (queued && !isMuted) queued();
}

/* Wire a one-shot gesture listener so any first tap/click/keypress on
   the page unlocks audio. Safe to call more than once. */
function installAudioUnlock(){
  if (audioUnlocked) return;
  const events = ['pointerdown', 'keydown', 'touchstart'];
  const handler = () => {
    unlockAudio();
    events.forEach(ev => document.removeEventListener(ev, handler, true));
  };
  events.forEach(ev => document.addEventListener(ev, handler, true));
}

function loadMutePreference(){
  try {
    isMuted = window.localStorage.getItem(MUTE_KEY) === '1';
  } catch (e) { /* storage blocked -- start unmuted */ }
}

function persistMutePreference(){
  try { window.localStorage.setItem(MUTE_KEY, isMuted ? '1' : '0'); } catch (e) {}
}

function toggleMute(){
  isMuted = !isMuted;
  if (isMuted && 'speechSynthesis' in window) window.speechSynthesis.cancel();
  persistMutePreference();
  return isMuted;
}

function getMuted(){
  return isMuted;
}

// Apply the saved preference as soon as the module loads, so the mute
// button renders in the right state before any gesture happens.
loadMutePreference();

/* Chrome populates the voice list asynchronously, so the first
   getVoices() call often returns []. Cache what we see and refresh on
   the voiceschanged event; exact availability still varies by device. */
function refreshVoices(){
  if (!('speechSynthesis' in window)) return;
  const v = window.speechSynthesis.getVoices();
  if (v && v.length) cachedVoices = v;
}
function pickVoice(){
  if (!('speechSynthesis' in window)) return null;
  if (!cachedVoices.length) refreshVoices();
  return cachedVoices.find(v => /^en[-_]US/i.test(v.lang))
      || cachedVoices.find(v => /^en/i.test(v.lang))
      || cachedVoices[0] || null;
}
if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
  refreshVoices();
  window.speechSynthesis.addEventListener
    && window.speechSynthesis.addEventListener('voiceschanged', refreshVoices);
}

/* opts: { rate, pitch, onEnd }
   Slower than natural speech throughout -- early readers track it
   better, and it is easier to copy a sound you can actually hear. */
function speak(text, opts){
  const o = opts || {};
  if (!audioUnlocked) {
    // Remember the latest request only; a backlog of queued words would
    // blurt out all at once when audio finally unlocks.
    pendingSpeak = () => speak(text, o);
    if (o.onEnd) o.onEnd();
    return;
  }
  if (isMuted || !('speechSynthesis' in window)) {
    if (o.onEnd) o.onEnd();
    return;
  }
  window.speechSynthesis.cancel();
  const utter = new SpeechSynthesisUtterance(text);
  utter.rate = o.rate || 0.85;
  utter.pitch = o.pitch || 1.08;
  utter.lang = 'en-US';
  const voice = pickVoice();
  if (voice) utter.voice = voice;
  if (o.onEnd) utter.onend = o.onEnd;
  window.speechSynthesis.speak(utter);
}

/* Half-speed replay, for the "listen closely" button. */
function speakSlow(text, onEnd){
  speak(text, { rate: 0.5, pitch: 1.0, onEnd: onEnd });
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
