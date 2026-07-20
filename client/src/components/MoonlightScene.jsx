import { useEffect, useRef } from 'react';
import { chime, ripplePing } from '../sound.js';

// —— 月夜海面（v1.2 · 三种模式）——
// 叙事：悬着的心是天上的月亮；月亮下垂着一幅会随风轻响的珠帘，手拨帘开、帘荡回来；
// 月亮的回信像水面飘来的签文；得到回应之后，最后一幕是月亮安然躺在水上。
//   home ：满月悬空，月光珠帘风铃式轻摆，五处涟漪（欢迎屏 / 写字屏）
//   calm ：安静版——只有水面和淡淡月光，给签文让戏（回信屏）
//   rest ：月亮匀速降落泊在水面，鼠标划水生成涟漪（休息屏）

// 调色：与 styles.css 一致
const SKY_TOP = '#f6d5db';
const SKY_MID = '#f1c4cd'; // 水红本色
const SKY_LOW = '#edbcc6';
const SEA_TOP = '#93bdad'; // 苍筤本色
const SEA_BOTTOM = '#7ea795';
// 珠帘：桃夭粉 #FDCECC 与比肩 #F4EC92 交错，再配两个更浅的近亲
const BEAD_COLORS = ['#fdcecc', '#f4ec92', '#fbdfd6', '#f9f3b6'];
const HORIZON = 0.72; // 海平面在画面高度的 72% 处（home/rest）
const HORIZON_CALM = 0.5; // 回信屏天水对半：给签文更多水面漂动的空间
const MOON_X = 0.25; // 整组动效靠左
const MOON_Y = 0.21;
const MOON_R = 0.125; // 相对画面高度（1.25 倍定稿）

const LAND_SECONDS = 8; // rest 模式：月亮降落用时（0.75 倍速，更缓）
const SINK = 0.3; // 落定后月亮下缘浸入水面的比例

// 月面质感：大而柔的深浅斑，若有似无
const MOON_MOTTLES = [
  { dx: 0.3, dy: -0.25, cr: 0.55, a: 0.09, light: false },
  { dx: -0.35, dy: 0.3, cr: 0.5, a: 0.08, light: false },
  { dx: 0.15, dy: 0.45, cr: 0.4, a: 0.1, light: false },
  { dx: -0.2, dy: -0.45, cr: 0.45, a: 0.07, light: true },
  { dx: 0.5, dy: 0.1, cr: 0.35, a: 0.08, light: true },
];

// 五处涟漪锚点（左下 → 右上），home 专用
const ANCHORS = [
  { fx: 0.09, fy: 0.72, scale: 0.42, period: 1.7 },
  { fx: 0.2, fy: 0.56, scale: 0.5, period: 2.0 },
  { fx: 0.14, fy: 0.36, scale: 0.58, period: 1.8 },
  { fx: 0.36, fy: 0.42, scale: 1.0, period: 2.3 },
  { fx: 0.44, fy: 0.13, scale: 0.66, period: 2.1 },
];
const RIPPLE_STAGGER = 1.1; // 五处涟漪依次醒来的间隔

export default function MoonlightScene({ mode = 'home' }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    let w = 0;
    let h = 0;
    let raf = 0;

    function resize() {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = window.innerWidth;
      h = window.innerHeight;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    window.addEventListener('resize', resize);

    const horizonFrac = mode === 'calm' ? HORIZON_CALM : HORIZON;
    const geo = () => ({
      cx: w * MOON_X,
      cy: h * MOON_Y,
      r: h * MOON_R,
      horizon: h * horizonFrac,
    });

    // 珠帘（仅 home）：verlet 真链条物理——每颗珠子独立受力，珠与珠之间距离约束相连，
    // 首珠钉在月亮下缘。S 形波浪、荡几下停、帘尾抬起，全部由物理自己涌现。
    const strings = Array.from({ length: 16 }, (_, i) => ({
      // 挂点均匀分布在月亮下缘（带一点随机抖动），不会再有稀疏的豁口
      offset: -0.85 + (i / 15) * 1.7 + (Math.random() - 0.5) * 0.06,
      len: 0.97 + Math.random() * 0.08, // 串长：帘尾垂到水面、个别轻点水
      spacing: 15 + Math.random() * 5, // 珠距（也是链条节距）
      pts: null, // 链条节点，首帧按几何生成
      flow: Math.random() * 1000, // 雨感：珠子沿着帘线向下流动的相位
      flowSpeed: 26 + Math.random() * 18, // 每秒下流的像素，各串略有快慢
      beads: Array.from({ length: 64 }, () => ({
        size: 1.4 + Math.random() * 2.4,
        color: BEAD_COLORS[(Math.random() * BEAD_COLORS.length) | 0],
        alpha: 0.5 + Math.random() * 0.5,
        twinkle: 2 + Math.random() * 4,
        phase: Math.random() * Math.PI * 2,
      })),
    }));
    // 偶尔一阵微风（平时垂坠安静）
    let gustUntil = 0;
    let gustNext = 5 + Math.random() * 8;
    let gustDir = 1;

    let t = 0;
    let last = performance.now();
    const firstSplashT = 2; // 开屏 2 秒后，五处涟漪依次醒来（珠帘垂坠安定的节奏）

    // 拨帘的手 / 划水的手
    let mouse = null;
    const onMove = (e) => (mouse = { x: e.clientX, y: e.clientY });
    const onLeave = () => (mouse = null);
    if ((mode === 'home' || mode === 'rest') && !reduceMotion) {
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseout', onLeave);
    }

    // home/calm：五处固定涟漪（同一组锚点、同一套五音轮转）；rest：涟漪由鼠标划水现场生成
    const fields = (mode === 'home' || mode === 'calm' ? ANCHORS : []).map((a, i) => ({
      ...a,
      rings: [],
      nextAt: 0,
      wakeIdx: i,
    }));
    let lastRingAt = 0; // rest：上一个鼠标水波纹的诞生时刻
    let lastRingX = null; // rest：上一个水波纹的诞生位置——鼠标不挪窝就不再生新的
    let lastRingY = null;
    let pingTurn = 0; // home：涟漪音轮转指针（1→2→3→4→5 循环，直到离开这屏）
    let lastPingT = -Infinity; // 五音之间的呼吸间隔：慢下来才放松

    function makeRing() {
      const segs = [];
      const n = 6 + ((Math.random() * 3) | 0);
      for (let i = 0; i < n; i++) {
        segs.push({
          a0: Math.random() * Math.PI * 2,
          len: 0.35 + Math.random() * 1.1,
          jitter: 1 + (Math.random() * 2 - 1) * 0.04,
        });
      }
      return { age: 0, life: 4 + Math.random() * 1.6, segs };
    }

    // —— rest 模式：月亮的当前位置（匀速降落） ——
    function restMoonY() {
      const { r, horizon } = geo();
      const skyY = h * MOON_Y;
      const landY = horizon - r * (1 - SINK); // 落定：下缘浸入水面 SINK 比例
      const k = reduceMotion ? 1 : Math.min(t / LAND_SECONDS, 1); // 匀速，不加减速
      const bob = k >= 1 ? Math.sin((t - LAND_SECONDS) * 0.7) * r * 0.015 : 0; // 落定后轻轻起伏
      return skyY + (landY - skyY) * k + bob;
    }

    // —— 各层绘制 ——
    function drawSkyAndSea() {
      const { horizon } = geo();
      const sky = ctx.createLinearGradient(0, 0, 0, horizon);
      sky.addColorStop(0, SKY_TOP);
      sky.addColorStop(0.55, SKY_MID);
      sky.addColorStop(1, SKY_LOW);
      ctx.fillStyle = sky;
      ctx.fillRect(0, 0, w, horizon);

      const sea = ctx.createLinearGradient(0, horizon, 0, h);
      sea.addColorStop(0, SEA_TOP);
      sea.addColorStop(1, SEA_BOTTOM);
      ctx.fillStyle = sea;
      ctx.fillRect(0, horizon, w, h - horizon);

      // 柔和过渡带：水红和苍筤中间雾蒙蒙的灰粉→灰绿
      const bandTop = horizon - h * 0.1;
      const bandH = h * 0.22;
      const blend = ctx.createLinearGradient(0, bandTop, 0, bandTop + bandH);
      blend.addColorStop(0, 'rgba(241, 196, 205, 0)');
      blend.addColorStop(0.4, 'rgba(236, 206, 205, 0.9)');
      blend.addColorStop(0.55, 'rgba(213, 208, 198, 0.85)');
      blend.addColorStop(0.75, 'rgba(172, 197, 184, 0.55)');
      blend.addColorStop(1, 'rgba(147, 189, 173, 0)');
      ctx.fillStyle = blend;
      ctx.fillRect(0, bandTop, w, bandH);
    }

    function drawMoon(cy) {
      const { cx, r } = geo();
      const halo = ctx.createRadialGradient(cx, cy, r * 0.5, cx, cy, r * 2.8);
      halo.addColorStop(0, 'rgba(255, 233, 120, 0.45)');
      halo.addColorStop(0.5, 'rgba(254, 215, 26, 0.14)');
      halo.addColorStop(1, 'rgba(254, 215, 26, 0)');
      ctx.fillStyle = halo;
      ctx.fillRect(cx - r * 3, cy - r * 3, r * 6, r * 6);

      const breathe = 0.96 + 0.04 * Math.sin((t / 6.5) * Math.PI * 2);
      ctx.globalAlpha = breathe;
      const disc = ctx.createRadialGradient(cx - r * 0.15, cy - r * 0.2, r * 0.15, cx, cy, r);
      disc.addColorStop(0, '#ffe75e');
      disc.addColorStop(1, '#fed71a');
      ctx.fillStyle = disc;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();

      ctx.save();
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.clip();
      for (const m of MOON_MOTTLES) {
        const px = cx + m.dx * r;
        const py = cy + m.dy * r;
        const pr = m.cr * r;
        const tone = m.light ? '255, 244, 170' : '224, 183, 10';
        const blob = ctx.createRadialGradient(px, py, 0, px, py, pr);
        blob.addColorStop(0, `rgba(${tone}, ${m.a})`);
        blob.addColorStop(1, `rgba(${tone}, 0)`);
        ctx.fillStyle = blob;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
      ctx.globalAlpha = 1;
    }

    function drawGlade(strength = 0.12) {
      const { cx, horizon } = geo();
      const seaH = h - horizon;
      const gy = horizon + seaH * 0.4;
      const R = seaH * 0.85;
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, horizon, w, seaH);
      ctx.clip();
      ctx.translate(cx, gy);
      ctx.scale(0.38, 1);
      const glade = ctx.createRadialGradient(0, 0, 0, 0, 0, R);
      glade.addColorStop(0, `rgba(254, 215, 26, ${strength})`);
      glade.addColorStop(1, 'rgba(254, 215, 26, 0)');
      ctx.fillStyle = glade;
      ctx.fillRect(-R, -R, R * 2, R * 2);
      ctx.restore();
    }

    // 链条物理一步：积分（重力 + 手的推力 + 偶尔的风）→ 距离约束（3 轮迭代）
    function stepStrings(dt) {
      const { cx, cy, r, horizon } = geo();
      if (t > gustNext) {
        gustUntil = t + 1.6;
        gustNext = t + 6 + Math.random() * 9;
        gustDir = Math.random() < 0.5 ? -1 : 1;
      }
      const gustOn = t < gustUntil;
      const sub = 2; // 两个子步，链条更稳
      const sdt = Math.min(dt, 0.033) / sub;
      for (const s of strings) {
        const dxa = s.offset * r;
        const ax0 = cx + dxa;
        const ay0 = cy + Math.sqrt(Math.max(r * r - dxa * dxa, 0)) * 0.9;
        const Lpix = (horizon - ay0) * s.len;
        const n = Math.max(3, Math.min(s.beads.length, Math.floor(Lpix / s.spacing) + 1));
        if (!s.pts || s.pts.length !== n) {
          s.pts = Array.from({ length: n }, (_, i) => ({
            x: ax0,
            y: ay0 + i * s.spacing,
            px: ax0,
            py: ay0 + i * s.spacing,
          }));
        }
        for (let step = 0; step < sub; step++) {
          for (let i = 1; i < n; i++) {
            const p = s.pts[i];
            const vx = (p.x - p.px) * 0.982; // 门帘的重量感：荡几下便安静
            const vy = (p.y - p.py) * 0.982;
            p.px = p.x;
            p.py = p.y;
            let axl = 0;
            if (mouse) {
              const ddx = p.x - mouse.x;
              const ddy = p.y - mouse.y;
              const g = Math.exp(-(ddx * ddx + ddy * ddy) / 5200); // σ≈51px：优雅小开
              axl += (ddx >= 0 ? 1 : -1) * 2200 * g;
            }
            if (gustOn) {
              axl +=
                gustDir *
                110 *
                (i / n) *
                Math.sin(((t - (gustUntil - 1.6)) / 1.6) * Math.PI) *
                Math.sin(t * 2.2 + p.x * 0.01);
            }
            p.x += vx + axl * sdt * sdt;
            p.y += vy + 1500 * sdt * sdt; // 重力让帘子自然垂坠
          }
          s.pts[0].x = ax0;
          s.pts[0].y = ay0;
          for (let iter = 0; iter < 3; iter++) {
            /* 距离约束 */
            for (let i = 1; i < n; i++) {
              const a = s.pts[i - 1];
              const b = s.pts[i];
              const ddx = b.x - a.x;
              const ddy = b.y - a.y;
              const dist = Math.hypot(ddx, ddy) || 0.0001;
              const diff = (dist - s.spacing) / dist;
              if (i === 1) {
                b.x -= ddx * diff;
                b.y -= ddy * diff;
              } else {
                a.x += ddx * diff * 0.5;
                a.y += ddy * diff * 0.5;
                b.x -= ddx * diff * 0.5;
                b.y -= ddy * diff * 0.5;
              }
            }
            s.pts[0].x = ax0;
            s.pts[0].y = ay0;
          }
        }
        // 铃音：帘尾摆得够快就"叮"一声（音量随摆速、左右声像跟着帘子位置）
        const tip = s.pts[s.pts.length - 1];
        const tipV = Math.abs(tip.x - tip.px) / sdt;
        if (tipV > 90 && t - (s.lastChime || 0) > 0.4) {
          s.lastChime = t;
          chime(Math.min(tipV / 500, 1), (tip.x / w) * 1.6 - 0.8);
        }
      }
    }

    // 画珠：珠子不钉死在链节上，而是沿着帘线缓缓向下滑（雨顺着帘子流进海里），
    // 顶端淡入、快到水面淡出——帘形不变，雨意回来了
    function drawStrings(dt) {
      for (const s of strings) {
        if (!s.pts) continue;
        s.flow = (s.flow + s.flowSpeed * dt) % 100000;
        const n = s.pts.length;
        const L = (n - 1) * s.spacing;
        const count = Math.max(2, Math.floor(L / s.spacing));
        for (let k = 0; k < count; k++) {
          const b = s.beads[k % s.beads.length];
          const d = (k * s.spacing + s.flow) % L;
          const j = Math.min(n - 2, Math.floor(d / s.spacing));
          const f = d / s.spacing - j;
          const x = s.pts[j].x + (s.pts[j + 1].x - s.pts[j].x) * f;
          const y = s.pts[j].y + (s.pts[j + 1].y - s.pts[j].y) * f;
          const fade = Math.max(0, Math.min(d / 50, 1) * Math.min((L - d) / 22, 1));
          const tw = 0.72 + 0.28 * Math.sin(t * b.twinkle + b.phase);
          ctx.globalAlpha = b.alpha * tw * fade;
          ctx.fillStyle = b.color;
          ctx.beginPath();
          ctx.arc(x, y, b.size, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    }

    function drawFields(dt) {
      const { horizon } = geo();
      const seaH = h - horizon;
      for (let fi = fields.length - 1; fi >= 0; fi--) {
        const f = fields[fi];
        // home 的固定涟漪按序号依次醒来；鼠标涟漪（无 wakeIdx）随到随开
        const wakeAt = f.wakeIdx === undefined ? 0 : firstSplashT + f.wakeIdx * RIPPLE_STAGGER;
        if (!reduceMotion && t < wakeAt) continue;

        const x = f.fx * w;
        const y = horizon + f.fy * seaH;
        const maxR = Math.min(Math.max(w * 0.085, 60), 170) * f.scale;

        // shots：一次性涟漪只荡这么多圈，荡完自然消散（rest 的鼠标涟漪用）
        const canSpawn = f.shots === undefined || f.shots > 0;
        if (canSpawn && t >= Math.max(f.nextAt, wakeAt) && !reduceMotion) {
          f.rings.push(makeRing());
          f.nextAt = t + f.period * (0.8 + Math.random() * 0.4);
          if (f.shots !== undefined) f.shots--;
          // 涟漪音：五音轮转循环——只有"轮到"的水波纹绽开时响一声（踩在绽开瞬间），
          // 两声之间至少隔 2.4 秒（来得太急的圈安静跳过），慢呼吸的节奏；音量压到 3/4
          if (f.wakeIdx !== undefined && f.wakeIdx === pingTurn % 5 && t - lastPingT > 2.4) {
            pingTurn++;
            lastPingT = t;
            ripplePing(f.scale, f.fx * 1.6 - 0.8, 0.75);
          }
        }
        if (f.shots === 0 && f.rings.length === 0) {
          fields.splice(fi, 1);
          continue;
        }

        const glow = ctx.createRadialGradient(x, y, 0, x, y, maxR * 0.22);
        glow.addColorStop(0, 'rgba(255, 251, 238, 0.35)');
        glow.addColorStop(1, 'rgba(255, 251, 238, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - maxR * 0.25, y - maxR * 0.12, maxR * 0.5, maxR * 0.24);

        for (let i = f.rings.length - 1; i >= 0; i--) {
          const ring = f.rings[i];
          ring.age += dt;
          if (ring.age >= ring.life) {
            f.rings.splice(i, 1);
            continue;
          }
          const k = ring.age / ring.life;
          const ease = 1 - Math.pow(1 - k, 2.2);
          const rx = 4 + ease * maxR;
          const ry = rx * 0.3;
          const alpha = 0.8 * (1 - k) * (k < 0.1 ? k / 0.1 : 1);
          ctx.strokeStyle = `rgba(255, 250, 232, ${alpha})`;
          ctx.lineWidth = 1.9 - k * 1.0;
          for (const s of ring.segs) {
            ctx.beginPath();
            ctx.ellipse(x, y, rx * s.jitter, ry * s.jitter, 0, s.a0, s.a0 + s.len);
            ctx.stroke();
          }
        }
      }
    }

    function drawHome(dt) {
      drawSkyAndSea();
      drawGlade();
      drawMoon(geo().cy);
      stepStrings(dt);
      drawStrings(dt);
      drawFields(dt);
    }

    function drawCalm(dt) {
      // 回信屏：水、淡淡月光，加上写字屏同款的五处水波纹与五音轮转（签文在水声里飘来）
      drawSkyAndSea();
      drawGlade(0.08);
      drawMoon(geo().cy);
      drawFields(dt);
    }

    function drawRest(dt) {
      // 休息屏：月亮匀速降落，安然泊住；水面是写字屏同款的月光与涟漪
      const { cx, r, horizon } = geo();
      const cy = restMoonY();
      drawSkyAndSea();

      // 真实的水面：月亮只画海平线以上的部分，浸入水里的部分被水完全遮住
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, w, horizon);
      ctx.clip();
      drawMoon(cy);
      ctx.restore();

      // 月亮在水里的倒影微光
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, horizon, w, h - horizon);
      ctx.clip();
      ctx.translate(cx, horizon + r * 0.55);
      ctx.scale(1, 0.42);
      const mirror = ctx.createRadialGradient(0, 0, 0, 0, 0, r * 1.7);
      mirror.addColorStop(0, 'rgba(254, 215, 26, 0.22)');
      mirror.addColorStop(1, 'rgba(254, 215, 26, 0)');
      ctx.fillStyle = mirror;
      ctx.fillRect(-r * 2, -r * 2, r * 4, r * 4);
      ctx.restore();

      // 月光：与写字屏同一道柔光带（同一种视觉语言）
      drawGlade(0.12);

      // 鼠标划水：挪到一个新方位才诞生一个水波纹（悬停不动不会原地连生）；
      // 每个水波纹只在诞生瞬间响一次，之后荡 3~5 圈安静消散
      const moved =
        lastRingX === null || (mouse && Math.hypot(mouse.x - lastRingX, mouse.y - lastRingY) > 44);
      if (mouse && mouse.y > horizon && t - lastRingAt > 0.45 && moved) {
        lastRingAt = t;
        lastRingX = mouse.x;
        lastRingY = mouse.y;
        const fy = (mouse.y - horizon) / (h - horizon);
        // 一个涟漪 = 一个单音（生成瞬间响一次，后面荡的圈不出声）；大小联动同写字屏
        ripplePing(0.45 + fy * 0.65, (mouse.x / w) * 1.6 - 0.8);
        fields.push({
          fx: mouse.x / w,
          fy,
          scale: 0.45 + fy * 0.65, // 越近（越靠下）圈越大，透视一致
          period: 1.35, // 缓缓绽开
          rings: [],
          nextAt: t,
          shots: 3 + ((Math.random() * 3) | 0), // 每个水波纹随机荡 3~5 圈

        });
        if (fields.length > 14) fields.shift(); // 太多就让最早的先走
      }
      drawFields(dt);
    }

    function frame(now) {
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;

      if (mode === 'home') drawHome(dt);
      else if (mode === 'calm') drawCalm(dt);
      else drawRest(dt);

      raf = requestAnimationFrame(frame);
    }

    if (reduceMotion) {
      // 减弱动态效果：每种模式画一帧安静的定格
      gustNext = Infinity;
      if (mode === 'home') for (let i = 0; i < 30; i++) stepStrings(0.016); // 让链条垂坠安定
      for (const f of fields) {
        f.rings.push({ ...makeRing(), age: 1.5, life: 5 });
        f.rings.push({ ...makeRing(), age: 3.2, life: 5 });
      }
      t = LAND_SECONDS + 10; // rest 模式直接画落定状态
      if (mode === 'home') drawHome(0);
      else if (mode === 'calm') drawCalm(0);
      else drawRest(0);
    } else {
      raf = requestAnimationFrame(frame);
    }

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseout', onLeave);
    };
  }, [mode]);

  return <canvas ref={canvasRef} className="moon-scene" aria-hidden="true" />;
}
