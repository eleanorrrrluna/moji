import { useEffect, useRef } from 'react';

// —— 休息屏的真实水面（WebGL2 波动方程模拟）——
// 一张看不见的"高度场"每帧解一次波动方程（ping-pong 双缓冲），
// 鼠标划过注入轻扰动（禅意力度）——波纹沿轨迹绽放、传播、互相穿过；
// 月光的波光由波面法线 + 高光泽镜面反射实时算出：粼粼是水自己闪的，不是画的。
// 月亮落定的瞬间注入一次大扰动（入水推开水波），之后随起伏轻轻脉动。

const HORIZON = 0.72; // 与 MoonlightScene 一致
const MOON_X = 0.25;
const LAND_SECONDS = 8;

export function waterSimSupported() {
  try {
    const c = document.createElement('canvas');
    const gl = c.getContext('webgl2');
    return !!(gl && gl.getExtension('EXT_color_buffer_float'));
  } catch {
    return false;
  }
}

const VERT = `#version 300 es
precision highp float;
layout(location=0) in vec2 aPos;
out vec2 vUv;
void main(){ vUv = aPos * 0.5 + 0.5; gl_Position = vec4(aPos, 0.0, 1.0); }`;

// 模拟通道：r = 高度，g = 速度
const SIM_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uPrev;
uniform vec2 uTexel;
uniform vec3 uSplat;   // xy = 扰动位置(uv)，z = 强度（<=0 表示本帧无扰动）
uniform float uAspect;
void main(){
  vec2 hv = texture(uPrev, vUv).rg;
  float l = texture(uPrev, vUv - vec2(uTexel.x, 0.)).r;
  float r = texture(uPrev, vUv + vec2(uTexel.x, 0.)).r;
  float b = texture(uPrev, vUv - vec2(0., uTexel.y)).r;
  float t = texture(uPrev, vUv + vec2(0., uTexel.y)).r;
  float v = hv.y + ((l + r + b + t) - 4. * hv.x) * 0.08; // 波速放慢：涟漪缓缓地荡
  v *= 0.978;                                            // 阻尼加重：荡三四圈就缓缓停住
  float h = (hv.x + v) * 0.999;
  if (uSplat.z > 0.) {
    vec2 d = (vUv - uSplat.xy) * vec2(uAspect, 1.);
    h += uSplat.z * exp(-dot(d, d) * 500.); // 落点放大一倍：圈也大一倍，且圈数更少更干净
  }
  o = vec4(h, v, 0., 1.);
}`;

// 渲染通道：底色 + 折射明暗 + 月光路 + 镜面波光
const DRAW_FRAG = `#version 300 es
precision highp float;
in vec2 vUv; out vec4 o;
uniform sampler2D uField;
uniform vec2 uTexel;
uniform float uGlade;
uniform float uMoonX;
void main(){
  float l = texture(uField, vUv - vec2(uTexel.x, 0.)).r;
  float r = texture(uField, vUv + vec2(uTexel.x, 0.)).r;
  float b = texture(uField, vUv - vec2(0., uTexel.y)).r;
  float t = texture(uField, vUv + vec2(0., uTexel.y)).r;
  vec3 n = normalize(vec3((l - r) * 55., (b - t) * 55., 1.));

  // 苍筤水底色（带波面折射的明暗起伏）
  float depth = 1. - vUv.y;                    // 0 = 吃水线，1 = 画面底
  float yy = clamp(depth + n.y * 0.06, 0., 1.);
  vec3 col = mix(vec3(0.576, 0.741, 0.678), vec3(0.494, 0.655, 0.584), yy);
  col += n.x * 0.05;

  // 月光路（照参考照片）：笔直、微微加宽的光带，靠近吃水线有一段亮芯
  float halfW = 0.055 + 0.10 * depth;
  float path = 1. - smoothstep(0., halfW, abs(vUv.x - uMoonX));
  vec3 gold = vec3(0.996, 0.843, 0.102);
  col += gold * path * uGlade * 0.10;
  col += gold * pow(path, 6.) * (1. - depth) * uGlade * 0.22; // 吃水线附近的亮芯

  // 静态波光（照片质感，不闪不动）：两种尺度的碎钻叠出真实颗粒——
  // 细密的小钻铺满光带 + 稀疏的大亮斑点缀，越靠近吃水线越密亮
  vec2 c1 = floor(vUv * vec2(240., 110.));
  float h1 = fract(sin(dot(c1, vec2(127.1, 311.7))) * 43758.55);
  vec2 c2 = floor(vUv * vec2(90., 40.) + 7.3);
  float h2 = fract(sin(dot(c2, vec2(269.5, 183.3))) * 34791.13);
  float sp1 = smoothstep(0.80, 1., h1) * 0.5;
  float sp2 = smoothstep(0.90, 1., h2) * 0.45;
  float near = 0.35 + 0.65 * (1. - depth);
  col += vec3(1., 0.94, 0.72) * (sp1 + sp2) * path * near * uGlade;

  // 上缘渐透：露出底下 2D 场景的天水雾状过渡带
  float a = smoothstep(1.0, 0.90, vUv.y);
  o = vec4(col * a, a);
}`;

export default function WaterSim() {
  const ref = useRef(null);

  useEffect(() => {
    const canvas = ref.current;
    const gl = canvas.getContext('webgl2', { alpha: true, premultipliedAlpha: true });
    if (!gl || !gl.getExtension('EXT_color_buffer_float')) return;

    function compile(type, src) {
      const s = gl.createShader(type);
      gl.shaderSource(s, src);
      gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
        console.error('[WaterSim] shader:', gl.getShaderInfoLog(s));
      }
      return s;
    }
    function program(fragSrc) {
      const p = gl.createProgram();
      gl.attachShader(p, compile(gl.VERTEX_SHADER, VERT));
      gl.attachShader(p, compile(gl.FRAGMENT_SHADER, fragSrc));
      gl.linkProgram(p);
      if (!gl.getProgramParameter(p, gl.LINK_STATUS)) {
        console.error('[WaterSim] link:', gl.getProgramInfoLog(p));
      }
      return p;
    }
    const simProg = program(SIM_FRAG);
    const drawProg = program(DRAW_FRAG);

    // 全屏四边形
    const vao = gl.createVertexArray();
    gl.bindVertexArray(vao);
    const buf = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buf);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
    gl.enableVertexAttribArray(0);
    gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

    let sw = 0;
    let sh = 0;
    let texA = null;
    let texB = null;
    let fbo = gl.createFramebuffer();

    function makeTex() {
      const tx = gl.createTexture();
      gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RG16F, sw, sh, 0, gl.RG, gl.HALF_FLOAT, null);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      // 清零：静水
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tx, 0);
      gl.clearColor(0, 0, 0, 1);
      gl.clear(gl.COLOR_BUFFER_BIT);
      return tx;
    }

    function resize() {
      const w = window.innerWidth;
      const seaH = Math.round(window.innerHeight * (1 - HORIZON));
      if (!w || !seaH) return; // 窗口暂时报 0（后台标签等），等下一次 resize 再初始化
      canvas.width = w;
      canvas.height = seaH;
      sw = Math.max(2, Math.round(w / 3)); // 模拟网格 1/3 分辨率足够，还省电
      sh = Math.max(2, Math.round(seaH / 3));
      texA = makeTex();
      texB = makeTex();
    }
    resize();
    window.addEventListener('resize', resize);

    // 鼠标：像水滴一滴滴落下——不连成一条沟，每隔一小会儿在指尖处落一滴，
    // 荡出一圈干净的圆涟漪（禅意力度）
    let cursor = null; // 最新的水面内位置 {u, v}
    function onMove(e) {
      const y0 = window.innerHeight * HORIZON;
      if (e.clientY <= y0) {
        cursor = null;
        return;
      }
      cursor = {
        u: e.clientX / window.innerWidth,
        v: 1 - (e.clientY - y0) / (window.innerHeight - y0),
      };
    }
    window.addEventListener('mousemove', onMove);

    let t = 0;
    let last = performance.now();
    let raf = 0;
    let lastDrop = 0; // 上一滴鼠标水滴的时刻

    const uSim = {
      texel: gl.getUniformLocation(simProg, 'uTexel'),
      splat: gl.getUniformLocation(simProg, 'uSplat'),
      aspect: gl.getUniformLocation(simProg, 'uAspect'),
      prev: gl.getUniformLocation(simProg, 'uPrev'),
    };
    const uDraw = {
      texel: gl.getUniformLocation(drawProg, 'uTexel'),
      glade: gl.getUniformLocation(drawProg, 'uGlade'),
      moonX: gl.getUniformLocation(drawProg, 'uMoonX'),
      time: gl.getUniformLocation(drawProg, 'uTime'),
      field: gl.getUniformLocation(drawProg, 'uField'),
    };

    function frame(now) {
      if (!texA) {
        resize(); // 尺寸还没就绪（窗口曾报 0）：重试初始化，先不画
        last = now;
        raf = requestAnimationFrame(frame);
        return;
      }
      const dt = Math.min((now - last) / 1000, 0.05);
      last = now;
      t += dt;

      // 本帧的扰动：鼠标水滴（节流成一滴一滴）；否则偶尔一粒环境微澜（偏向月光路里）
      let splat = null;
      if (cursor && t - lastDrop > 0.16) {
        lastDrop = t;
        splat = { u: cursor.u, v: cursor.v, s: 0.014 };
      }
      if (!splat && Math.random() < 0.1) {
        splat = {
          u: MOON_X + (Math.random() - 0.5) * 0.6 * Math.random(),
          v: Math.random(),
          s: 0.0038,
        };
      }

      // —— 模拟通道（ping-pong）——
      gl.useProgram(simProg);
      gl.bindVertexArray(vao);
      gl.viewport(0, 0, sw, sh);
      gl.bindFramebuffer(gl.FRAMEBUFFER, fbo);
      gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texB, 0);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texA);
      gl.uniform1i(uSim.prev, 0);
      gl.uniform2f(uSim.texel, 1 / sw, 1 / sh);
      gl.uniform1f(uSim.aspect, sw / sh);
      if (splat) gl.uniform3f(uSim.splat, splat.u, splat.v, splat.s);
      else gl.uniform3f(uSim.splat, 0, 0, -1);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
      const tmp = texA;
      texA = texB;
      texB = tmp;

      // —— 渲染通道 ——
      gl.bindFramebuffer(gl.FRAMEBUFFER, null);
      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.useProgram(drawProg);
      gl.bindTexture(gl.TEXTURE_2D, texA);
      gl.uniform1i(uDraw.field, 0);
      gl.uniform2f(uDraw.texel, 1 / sw, 1 / sh);
      gl.uniform1f(uDraw.glade, 1); // 一进休息屏就有月光与波光，不必等月亮落完
      gl.uniform1f(uDraw.moonX, MOON_X);
      gl.uniform1f(uDraw.time, t);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

      raf = requestAnimationFrame(frame);
    }
    raf = requestAnimationFrame(frame);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', onMove);
    };
  }, []);

  return <canvas ref={ref} className="water-sim" aria-hidden="true" />;
}
