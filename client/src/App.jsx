import { useEffect, useState } from 'react';
import { initSoundUnlock } from './sound.js';
import Welcome from './components/Welcome.jsx';
import Home from './components/Home.jsx';
import Reflection from './components/Reflection.jsx';
import Rest from './components/Rest.jsx';
import MoonlightScene from './components/MoonlightScene.jsx';

// 整个 app 是一台四屏的小状态机：
// welcome（首次问名字）→ home（问候 + 写字）→ reflection（回信 + 心情印）→ rest（今天到此为止）
export default function App() {
  const [name, setName] = useState(() => localStorage.getItem('moji.name') || '');
  const [screen, setScreen] = useState(name ? 'home' : 'welcome');
  const [result, setResult] = useState(null);

  // 声音需要用户先动一下（浏览器自动播放政策）：等第一次点击/按键解锁
  useEffect(() => initSoundUnlock(), []);

  function handleName(n) {
    localStorage.setItem('moji.name', n); // 记住名字，下次直接“welcome home”
    setName(n);
    setScreen('home');
  }

  function handleReflection(r) {
    setResult(r);
    setScreen('reflection');
  }

  // v1.1：四屏都有场景，但各有各的戏——
  // 落地两屏 home（月光雨）、回信屏 calm（安静水面给签文让戏）、休息屏 rest（月亮落水）
  const sceneMode = screen === 'reflection' ? 'calm' : screen === 'rest' ? 'rest' : 'home';
  const splitLayout = screen === 'welcome' || screen === 'home';

  return (
    // scene-on：落地两屏的文字移到右半边（回信屏/休息屏保持居中）
    <div className={splitLayout ? 'app scene-on' : 'app'}>
      <MoonlightScene mode={sceneMode} />
      <header className="wordmark">
        <span className="wordmark-jelly">MOJI</span>
      </header>
      {/* key={screen} 让每次换屏都触发一次“翻页”动画 */}
      <main key={screen} className="page">
        {screen === 'welcome' && <Welcome onDone={handleName} />}
        {screen === 'home' && <Home name={name} onReflection={handleReflection} />}
        {screen === 'reflection' && (
          <Reflection result={result} onDone={() => setScreen('rest')} />
        )}
        {screen === 'rest' && <Rest name={name} />}
      </main>
      <footer className="footer">A reflective companion, not a substitute for professional support.</footer>
    </div>
  );
}
