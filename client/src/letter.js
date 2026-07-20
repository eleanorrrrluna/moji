// —— 信件下载 ——
// 把「我写给月亮的」和「月亮回给我的」装进一份自包含的 HTML：
// 回信屏的配色 + 月亮呼吸 + 五处水波纹动态 + 涟漪音效（base64 内嵌，离线可开）。
// 全部在浏览器本地生成（Blob 下载），不经过任何服务器。

async function fetchAsDataURI(url) {
  const res = await fetch(url);
  const buf = await res.arrayBuffer();
  let bin = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
  return 'data:audio/mpeg;base64,' + btoa(bin);
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export async function downloadLetter({ name, entry, reflection, mood }) {
  const [snd1, snd2] = await Promise.all([
    fetchAsDataURI('/sounds/ripple1.mp3'),
    fetchAsDataURI('/sounds/ripple2.mp3'),
  ]);
  const date = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });
  const displayName = name ? name.charAt(0).toUpperCase() + name.slice(1) : 'Me';

  // 场景脚本（内嵌进信件页）：不用反引号，避免模板嵌套
  const sceneJS = [
    'var cv=document.getElementById("sea"),cx2=cv.getContext("2d");',
    'var W,H;function rs(){W=innerWidth;H=innerHeight;var d=Math.min(devicePixelRatio||1,2);cv.width=W*d;cv.height=H*d;cx2.setTransform(d,0,0,d,0,0);}rs();addEventListener("resize",rs);',
    'var A=[[0.09,0.72,0.42,1.7],[0.2,0.56,0.5,2.0],[0.14,0.36,0.58,1.8],[0.36,0.42,1.0,2.3],[0.44,0.13,0.66,2.1]];',
    'var F=A.map(function(a,i){return{fx:a[0],fy:a[1],sc:a[2],pd:a[3],rings:[],next:0,idx:i};});',
    'var SND=[new Audio(S1),new Audio(S2)],ok=false,turn=0,lastPing=-9;',
    'addEventListener("pointerdown",function(){ok=true;},{once:true});',
    'function ping(sc,i){if(!ok)return;var a=SND[i%2].cloneNode();a.volume=Math.min(0.05+sc*0.11,1);a.playbackRate=1.28-sc*0.42;a.play().catch(function(){});}',
    'function ring(){var s=[],n=6+(Math.random()*3|0);for(var i=0;i<n;i++)s.push([Math.random()*6.283,0.35+Math.random()*1.1,1+(Math.random()*2-1)*0.04]);return{age:0,life:4+Math.random()*1.6,segs:s};}',
    'var t=0,last=performance.now();',
    'function frame(now){var dt=Math.min((now-last)/1000,0.05);last=now;t+=dt;',
    'var hz=H*0.5,cxm=W*0.25,cy=H*0.21,r=H*0.125;',
    'var sky=cx2.createLinearGradient(0,0,0,hz);sky.addColorStop(0,"#f6d5db");sky.addColorStop(0.55,"#f1c4cd");sky.addColorStop(1,"#edbcc6");cx2.fillStyle=sky;cx2.fillRect(0,0,W,hz);',
    'var sea=cx2.createLinearGradient(0,hz,0,H);sea.addColorStop(0,"#93bdad");sea.addColorStop(1,"#7ea795");cx2.fillStyle=sea;cx2.fillRect(0,hz,W,H-hz);',
    'var bt=hz-H*0.1,bh=H*0.22,bl=cx2.createLinearGradient(0,bt,0,bt+bh);bl.addColorStop(0,"rgba(241,196,205,0)");bl.addColorStop(0.4,"rgba(236,206,205,0.9)");bl.addColorStop(0.55,"rgba(213,208,198,0.85)");bl.addColorStop(0.75,"rgba(172,197,184,0.55)");bl.addColorStop(1,"rgba(147,189,173,0)");cx2.fillStyle=bl;cx2.fillRect(0,bt,W,bh);',
    'var halo=cx2.createRadialGradient(cxm,cy,r*0.5,cxm,cy,r*2.8);halo.addColorStop(0,"rgba(255,233,120,0.45)");halo.addColorStop(0.5,"rgba(254,215,26,0.14)");halo.addColorStop(1,"rgba(254,215,26,0)");cx2.fillStyle=halo;cx2.fillRect(cxm-r*3,cy-r*3,r*6,r*6);',
    'cx2.globalAlpha=0.96+0.04*Math.sin(t/6.5*6.283);var dc=cx2.createRadialGradient(cxm-r*0.15,cy-r*0.2,r*0.15,cxm,cy,r);dc.addColorStop(0,"#ffe75e");dc.addColorStop(1,"#fed71a");cx2.fillStyle=dc;cx2.beginPath();cx2.arc(cxm,cy,r,0,6.283);cx2.fill();cx2.globalAlpha=1;',
    'var sh=H-hz;for(var fi=0;fi<F.length;fi++){var f=F[fi];var wake=2+f.idx*1.1;if(t<wake)continue;',
    'var x=f.fx*W,y=hz+f.fy*sh,mr=Math.min(Math.max(W*0.085,60),170)*f.sc;',
    'if(t>=Math.max(f.next,wake)){f.rings.push(ring());f.next=t+f.pd*(0.8+Math.random()*0.4);if(f.idx===turn%5&&t-lastPing>2.4){turn++;lastPing=t;ping(f.sc,turn);}}',
    'var g=cx2.createRadialGradient(x,y,0,x,y,mr*0.22);g.addColorStop(0,"rgba(255,251,238,0.35)");g.addColorStop(1,"rgba(255,251,238,0)");cx2.fillStyle=g;cx2.fillRect(x-mr*0.25,y-mr*0.12,mr*0.5,mr*0.24);',
    'for(var i=f.rings.length-1;i>=0;i--){var rg=f.rings[i];rg.age+=dt;if(rg.age>=rg.life){f.rings.splice(i,1);continue;}var k=rg.age/rg.life,e=1-Math.pow(1-k,2.2),rx=4+e*mr,ry=rx*0.3,al=0.8*(1-k)*(k<0.1?k/0.1:1);cx2.strokeStyle="rgba(255,250,232,"+al+")";cx2.lineWidth=1.9-k;for(var s2=0;s2<rg.segs.length;s2++){var sg=rg.segs[s2];cx2.beginPath();cx2.ellipse(x,y,rx*sg[2],ry*sg[2],0,sg[0],sg[0]+sg[1]);cx2.stroke();}}}',
    'requestAnimationFrame(frame);}requestAnimationFrame(frame);',
  ].join('\n');

  const html = [
    '<!doctype html><html lang="en"><head><meta charset="UTF-8"/>',
    '<meta name="viewport" content="width=device-width, initial-scale=1.0"/>',
    '<title>moji · a letter with the moon · ' + esc(date) + '</title>',
    '<link href="https://fonts.googleapis.com/css2?family=Aboreto&family=Cormorant:wght@400;500&display=swap" rel="stylesheet"/>',
    '<style>',
    '*{margin:0;padding:0;box-sizing:border-box}',
    'body{min-height:100vh;font-family:"Iowan Old Style",Palatino,Georgia,serif;color:#310f10;overflow-x:hidden}',
    'canvas#sea{position:fixed;inset:0;width:100%;height:100%;z-index:-1}',
    '.wrap{max-width:34em;margin:0 auto;padding:9vh 6vw 12vh;display:flex;flex-direction:column;gap:3.5vh}',
    'h1{font-family:Aboreto,serif;font-size:1.15rem;letter-spacing:0.25em;text-align:center}',
    '.date{font-family:Cormorant,serif;text-align:center;opacity:0.7;margin-top:-2vh}',
    '.card{position:relative;padding:1.7rem 1.9rem 1.4rem}',
    '.card::before{content:"";position:absolute;inset:-4px;z-index:-1;border-radius:22px;border:1px solid rgba(255,255,255,0.55);background:linear-gradient(150deg,rgba(255,252,240,0.5),rgba(252,244,230,0.34) 55%,rgba(255,240,214,0.44));backdrop-filter:blur(10px) saturate(125%);-webkit-backdrop-filter:blur(10px) saturate(125%);box-shadow:0 0 30px rgba(255,240,190,0.45),0 10px 26px rgba(49,15,16,0.07),inset 0 0 26px rgba(255,248,220,0.4)}',
    '.from{font-family:Cormorant,serif;font-size:0.92rem;letter-spacing:0.12em;opacity:0.7;margin-bottom:0.7rem}',
    '.chip{display:inline-flex;gap:0.5em;padding:0.35em 0.95em;border-radius:999px;background:rgba(255,255,255,0.4);border:1px solid rgba(255,255,255,0.65);font-size:0.9rem;margin-bottom:0.8rem;text-transform:capitalize}',
    '.card p{line-height:1.95;font-size:1.06rem;white-space:pre-wrap}',
    '.sign{font-family:Cormorant,serif;text-align:right;margin-top:1rem;opacity:0.8;line-height:1.6}',
    '.hint{font-family:Cormorant,serif;text-align:center;font-size:0.85rem;opacity:0.55}',
    '</style></head><body>',
    '<canvas id="sea" aria-hidden="true"></canvas>',
    '<div class="wrap">',
    '<h1>A LETTER WITH THE MOON</h1>',
    '<p class="date">' + esc(date) + '</p>',
    '<div class="card"><div class="from">From ' + esc(displayName) + '</div><p>' + esc(entry) + '</p><p class="sign">— ' + esc(displayName) + '</p></div>',
    '<div class="card"><div class="from">From the Moon</div><span class="chip">' + esc(mood.emoji) + ' ' + esc(mood.label) + '</span><p>' + esc(reflection) + '</p><p class="sign">Until tomorrow.<br/>— The Moon</p></div>',
    '<p class="hint">Click anywhere to hear the water. — moji</p>',
    '</div>',
    '<script>var S1="' + snd1 + '",S2="' + snd2 + '";</script>',
    '<script>' + sceneJS + '</script>',
    '</body></html>',
  ].join('\n');

  const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  // 用本地日期做文件名（toISOString 是 UTC，会在时差里差一天）
  const d = new Date();
  const stamp =
    d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
  a.href = url;
  a.download = 'moji-letter-' + stamp + '.html';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}
