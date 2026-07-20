// —— moji 的声音层 ——
// 铃：Freesound #535520（CC0）玻璃风铃实录切片 ×6 —— 珠帘物理驱动的事件音
// 啵：Freesound #451126（CC0）水滴落水声 ×3 个音高变体 —— 三三拍雨的氛围底 + 涟漪触发音
// 原则：全部事件化、稀疏、低音量；密度永远握在代码手里。
// 浏览器规定用户首次交互后才允许出声：首次点击/按键时解锁 AudioContext。

const BELL_URLS = [1, 2, 3, 4, 5, 6].map((i) => `/sounds/bell${i}.mp3`);
const PLOP_URLS = [1, 2, 3].map((i) => `/sounds/plop${i}.mp3`);
// 涟漪单音（两颗轮换，均 CC0）：ripple1 = Freesound #612133（HighPixel），ripple2 = #337525（Ev-Dawg 低沉版）
const RIPPLE_URLS = [1, 2].map((i) => `/sounds/ripple${i}.mp3`);

let audioCtx = null;
let bells = [];
let plops = [];
let ripples = [];
let lastChimeAt = 0;
let lastRippleAt = 0;
let muted = false;

async function load(urls) {
  return Promise.all(
    urls.map(async (u) => {
      const res = await fetch(u);
      const ab = await res.arrayBuffer();
      return audioCtx.decodeAudioData(ab);
    })
  );
}

async function unlock() {
  if (audioCtx) return;
  audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  audioCtx.resume();
  [bells, plops, ripples] = await Promise.all([load(BELL_URLS), load(PLOP_URLS), load(RIPPLE_URLS)]);
}

// 在 App 挂载时调用一次：等待用户的第一次点击/按键来解锁声音
export function initSoundUnlock() {
  const handler = () => {
    unlock();
    window.removeEventListener('pointerdown', handler);
    window.removeEventListener('keydown', handler);
  };
  window.addEventListener('pointerdown', handler);
  window.addEventListener('keydown', handler);
}

export function setMuted(m) {
  muted = m;
}

function play(buffers, gain, pan, rate) {
  if (!audioCtx || !buffers.length || muted) return;
  const src = audioCtx.createBufferSource();
  src.buffer = buffers[(Math.random() * buffers.length) | 0];
  src.playbackRate.value = rate;
  const g = audioCtx.createGain();
  g.gain.value = gain;
  if (audioCtx.createStereoPanner) {
    const p = audioCtx.createStereoPanner();
    p.pan.value = Math.max(-0.8, Math.min(0.8, pan));
    src.connect(g).connect(p).connect(audioCtx.destination);
  } else {
    src.connect(g).connect(audioCtx.destination);
  }
  src.start();
}

// 敲一声铃：intensity 0~1 决定音量，pan -1~1 左右声像（跟着帘子位置走）
export function chime(intensity = 0.5, pan = 0) {
  const now = performance.now();
  if (now - lastChimeAt < 110) return; // 全局节流：再热闹也保持稀疏
  lastChimeAt = now;
  play(bells, 0.04 + Math.min(intensity, 1) * 0.14, pan, 0.92 + Math.random() * 0.2);
}

// "啵"一声（三三拍雨专用的水滴音）
export function plop(intensity = 0.5, pan = 0) {
  play(plops, 0.05 + Math.min(intensity, 1) * 0.16, pan, 0.95 + Math.random() * 0.12);
}

// 涟漪单音：size 0~1 = 涟漪大小，音量、音高、时长三者联动——
// 小涟漪轻、亮、短（播放速率高），大涟漪响、沉、长（速率低），像不同大小的水花
export function ripplePing(size = 0.6, pan = 0, gainMul = 1) {
  const now = performance.now();
  if (now - lastRippleAt < 250) return; // 两处同时绽开时错开一口气
  lastRippleAt = now;
  const s = Math.min(Math.max(size, 0), 1);
  const gain = (0.04 + s * 0.15) * gainMul;
  const rate = 1.28 - s * 0.42 + (Math.random() * 0.04 - 0.02); // 大→0.86 沉长，小→1.26 亮短
  play(ripples, gain, pan, rate);
}

// —— 三三拍的雨（写字屏常驻氛围底）——
// 圆舞曲节奏：啵-啵-啵｜啵-啵-啵，第一拍重、后两拍轻；
// 每拍 ±40ms 的人性化偏差，弱拍偶尔省略——像雨，不像节拍器。
const BAR = 2.7; // 一小节秒数（拍速 ≈ 67 BPM，禅的步频）
const BEAT = BAR / 3;
let rainTimers = [];

export function startRain() {
  if (rainTimers.length) return;
  const bar = () => {
    for (let i = 0; i < 3; i++) {
      if (i > 0 && Math.random() < 0.18) continue; // 弱拍偶尔留白
      const jitter = Math.random() * 80 - 40;
      rainTimers.push(
        setTimeout(() => {
          const accent = i === 0;
          play(
            plops,
            accent ? 0.11 : 0.055, // 强-弱-弱
            Math.random() * 1.2 - 0.6, // 每颗雨珠落点左右不定
            accent ? 0.9 + Math.random() * 0.08 : 1.0 + Math.random() * 0.15 // 重拍更低沉
          );
        }, i * BEAT * 1000 + jitter)
      );
    }
    rainTimers.push(setTimeout(bar, BAR * 1000 + (Math.random() * 240 - 120)));
  };
  bar();
}

export function stopRain() {
  rainTimers.forEach(clearTimeout);
  rainTimers = [];
}
