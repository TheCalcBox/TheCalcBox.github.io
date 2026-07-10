const $ = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

let poem = null;
let current = 0;
let playing = false;
let timer = null;
let currentUtterance = null;
let musicOn = false;
let audioCtx = null;
let musicNodes = [];
let speechWatchdog = null;

const USE_RECORDED_AUDIO = false;
const USE_RECORDED_MUSIC = false;

function poemId() {
  const queryId = new URLSearchParams(location.search).get('id');
  if (queryId) return queryId;
  const parts = location.pathname.split('/').filter(Boolean);
  return parts[parts.length - 1] || 'jing-ye-si';
}

function schemaFor(p) {
  return {
    '@context': 'https://schema.org',
    '@type': 'CreativeWork',
    name: p.title,
    author: { '@type': 'Person', name: p.author },
    inLanguage: 'zh-Hant',
    description: p.summary,
    keywords: p.tags.join(',')
  };
}

function setStatus(text) {
  const el = $('#playStatus');
  if (el) el.textContent = text;
}

async function loadPoem() {
  const id = poemId();
  poem = (window.CALCBOX_POEMS || {})[id];
  if (!poem) {
    document.body.innerHTML = '<p style="padding:2rem">找不到詩詞資料。</p>';
    return;
  }
  render();
}

function render() {
  document.title = poem.seo.title;
  const description = document.querySelector('meta[name="description"]');
  if (description) description.content = poem.seo.description;

  const ld = document.createElement('script');
  ld.type = 'application/ld+json';
  ld.textContent = JSON.stringify(schemaFor(poem));
  document.head.appendChild(ld);

  $('#title').textContent = poem.title;
  $('#summary').textContent = poem.summary;
  $('#author').textContent = `${poem.author}【${poem.dynasty}代】`;
  $('#title2').textContent = poem.title;
  $('#author2').textContent = `${poem.author}｜${poem.form}｜${poem.grade}`;
  $('#background').textContent = poem.background;
  $('#authorBio').textContent = poem.authorBio;
  $('#english').textContent = poem.lines.map((x) => x.english).join('\n');

  $('#poemLines').innerHTML = poem.lines.map((line, index) =>
    `<div class="poem-line ${index === 0 ? 'active' : ''}" onclick="goTo(${index}, true)">
      ${line.text}<span class="pinyin">${line.pinyin}</span>
    </div>`
  ).join('');

  $('#scenes').innerHTML = poem.lines.map((line, index) =>
    `<div class="scene fallback-${(index % 4) + 1} ${index === 0 ? 'active' : ''}"></div>`
  ).join('');

  poem.lines.forEach((line, index) => {
    if (!line.image) return;
    const image = new Image();
    image.onload = () => {
      const scene = $$('.scene')[index];
      if (scene) scene.style.backgroundImage = `url("${line.image.replace(/^\/assets\//, 'assets/')}")`;
    };
    image.src = line.image.replace(/^\/assets\//, 'assets/');
  });

  update();
  preloadVoices();
}

function update() {
  $$('.scene').forEach((el, index) => el.classList.toggle('active', index === current));
  $$('.poem-line').forEach((el, index) => el.classList.toggle('active', index === current));
  $('#translation').textContent = poem.lines[current].translation;
  $('#explain').textContent = poem.lines[current].explain;
  $('#progress').style.width = `${((current + 1) / poem.lines.length) * 100}%`;
}

function preloadVoices() {
  if (!('speechSynthesis' in window)) return;
  speechSynthesis.getVoices();
  speechSynthesis.onvoiceschanged = () => speechSynthesis.getVoices();
}

function pickVoice() {
  if (!('speechSynthesis' in window)) return null;
  const voices = speechSynthesis.getVoices();
  return voices.find((v) => /zh-TW/i.test(v.lang)) ||
         voices.find((v) => /zh-HK/i.test(v.lang)) ||
         voices.find((v) => /zh-CN/i.test(v.lang)) ||
         voices.find((v) => /Chinese|Mandarin|Meijia|Ting-Ting|Sin-Ji/i.test(`${v.name} ${v.lang}`)) ||
         voices[0] || null;
}

function stopSpeech() {
  clearTimeout(speechWatchdog);
  speechWatchdog = null;
  currentUtterance = null;
  if ('speechSynthesis' in window) {
    speechSynthesis.cancel();
  }
}

function speakWithBrowser(callback) {
  if (!('speechSynthesis' in window) || typeof SpeechSynthesisUtterance === 'undefined') {
    setStatus('此瀏覽器不支援中文語音');
    if (callback) setTimeout(callback, 1200);
    return;
  }

  stopSpeech();
  const utterance = new SpeechSynthesisUtterance(poem.lines[current].text);
  utterance.lang = 'zh-TW';
  utterance.rate = 0.72;
  utterance.pitch = 0.94;
  utterance.volume = 1;
  const selectedVoice = pickVoice();
  if (selectedVoice) utterance.voice = selectedVoice;

  let finished = false;
  const finish = () => {
    if (finished) return;
    finished = true;
    clearTimeout(speechWatchdog);
    currentUtterance = null;
    if (callback) callback();
  };

  utterance.onstart = () => setStatus(`正在朗讀：${poem.lines[current].text}`);
  utterance.onend = finish;
  utterance.onerror = (event) => {
    setStatus(event.error === 'canceled' ? '已暫停' : '語音播放失敗，請再按一次');
    finish();
  };

  currentUtterance = utterance;

  // iOS Safari sometimes stays paused after returning from background.
  speechSynthesis.cancel();
  speechSynthesis.resume();
  setTimeout(() => {
    try {
      speechSynthesis.speak(utterance);
      speechSynthesis.resume();
    } catch (error) {
      setStatus('語音播放失敗，請再按一次');
      finish();
    }
  }, 80);

  // Prevent autoplay from getting stuck if Safari fails to emit onend.
  const estimatedMs = Math.max(1800, poem.lines[current].text.length * 420);
  speechWatchdog = setTimeout(finish, estimatedMs + 1800);
}

function speakRecorded(callback) {
  const src = poem.lines[current].audio;
  if (!src) {
    speakWithBrowser(callback);
    return;
  }
  const audio = new Audio(src.replace(/^\/assets\//, 'assets/'));
  audio.onended = () => callback && callback();
  audio.onerror = () => speakWithBrowser(callback);
  audio.play().catch(() => speakWithBrowser(callback));
}

function speak(callback) {
  if (USE_RECORDED_AUDIO) speakRecorded(callback);
  else speakWithBrowser(callback);
}

function goTo(index, shouldSpeak = false) {
  stopAutoPlay(false);
  current = Math.max(0, Math.min(poem.lines.length - 1, index));
  update();
  if (shouldSpeak) speak();
}

function playCurrentThenNext() {
  if (!playing) return;
  update();
  speak(() => {
    if (!playing) return;
    if (current < poem.lines.length - 1) {
      timer = setTimeout(() => {
        current += 1;
        playCurrentThenNext();
      }, 650);
    } else {
      playing = false;
      $('#playBtn').textContent = '▶ 自動播放';
      setStatus('播放完成');
    }
  });
}

function togglePlay() {
  if (playing) {
    stopAutoPlay(true);
    return;
  }

  // Keep playback inside the direct click flow for iOS Safari.
  playing = true;
  $('#playBtn').textContent = '❚❚ 暫停';
  setStatus('準備播放');
  playCurrentThenNext();
}

function stopAutoPlay(updateButton = true) {
  playing = false;
  clearTimeout(timer);
  timer = null;
  stopSpeech();
  if (updateButton && $('#playBtn')) $('#playBtn').textContent = '▶ 自動播放';
  setStatus('已暫停');
}

function resetPoem() {
  stopAutoPlay(true);
  current = 0;
  update();
  setStatus('已回到第一句');
}

function ensureAudioContext() {
  if (!audioCtx || audioCtx.state === 'closed') {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  }
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function startGeneratedMusic() {
  const ctx = ensureAudioContext();
  const master = ctx.createGain();
  master.gain.value = 0.035;
  master.connect(ctx.destination);

  const notes = [98, 123.47, 146.83, 196];
  notes.forEach((frequency, index) => {
    const oscillator = ctx.createOscillator();
    const gain = ctx.createGain();
    oscillator.type = index % 2 === 0 ? 'sine' : 'triangle';
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.18 / (index + 1);
    oscillator.connect(gain).connect(master);
    oscillator.start();
    musicNodes.push(oscillator, gain);
  });

  // Subtle wind-like noise.
  const bufferSize = ctx.sampleRate * 2;
  const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < bufferSize; i += 1) data[i] = (Math.random() * 2 - 1) * 0.12;
  const noise = ctx.createBufferSource();
  const filter = ctx.createBiquadFilter();
  const noiseGain = ctx.createGain();
  noise.buffer = buffer;
  noise.loop = true;
  filter.type = 'lowpass';
  filter.frequency.value = 480;
  noiseGain.gain.value = 0.025;
  noise.connect(filter).connect(noiseGain).connect(master);
  noise.start();
  musicNodes.push(noise, filter, noiseGain, master);
}

function stopGeneratedMusic() {
  musicNodes.forEach((node) => {
    try {
      if (typeof node.stop === 'function') node.stop();
      if (typeof node.disconnect === 'function') node.disconnect();
    } catch (_) {}
  });
  musicNodes = [];
  if (audioCtx && audioCtx.state !== 'closed') audioCtx.close();
  audioCtx = null;
}

function toggleMusic() {
  if (musicOn) {
    stopGeneratedMusic();
    musicOn = false;
    $('#musicBtn').textContent = '♫ 開啟配樂';
    setStatus('配樂已關閉');
    return;
  }

  try {
    if (USE_RECORDED_MUSIC && poem.music) {
      // Reserved for future professional MP3 soundtrack.
    }
    startGeneratedMusic();
    musicOn = true;
    $('#musicBtn').textContent = '♫ 關閉配樂';
    setStatus('配樂播放中');
  } catch (error) {
    setStatus('配樂啟動失敗，請再按一次');
  }
}

window.addEventListener('DOMContentLoaded', loadPoem);
window.addEventListener('pagehide', () => {
  stopAutoPlay(false);
  if (musicOn) stopGeneratedMusic();
});
