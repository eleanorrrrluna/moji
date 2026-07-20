// 回信屏（v1.1）：月亮的回信像寺庙求来的水签——
// 一张宣纸签文从水面缓缓浮上来，心情印盖在签头，回信在纸上逐句渗出
import { downloadLetter } from '../letter.js';

const SLIP_RISE = 3; // 签文浮上来的用时（秒），文字等它到位再现身

export default function Reflection({ result, onDone }) {
  const { reflection, mood } = result;
  // 按句子切开，每句错开一点时间浮现
  const lines = reflection.split(/(?<=[。！？!?.])\s*/).filter(Boolean);
  const closingDelay = SLIP_RISE + 0.6 + lines.length * 0.75;

  return (
    <div className="screen">
      {/* 双层动画：外层 fortune-rise 走一条顺滑的位移曲线，内层 fortune-slip 持续轻摆——
          疊加起来才是鱼在水里游的流畅感（单层多段关键帧会一顿一顿） */}
      <div className="fortune-rise">
        <div className="fortune-slip">
        <div className="mood-chip" style={{ animationDelay: `${SLIP_RISE - 0.2}s` }}>
          <span className="mood-emoji">{mood.emoji}</span>
          <span className="mood-word">{mood.label}</span>
        </div>

        <p className="reflection-text" lang={/[一-鿿]/.test(reflection) ? 'zh' : 'en'}>
          {lines.map((line, i) => (
            <span key={i} className="ink-line" style={{ animationDelay: `${SLIP_RISE + 0.4 + i * 0.75}s` }}>
              {line}{' '}
            </span>
          ))}
        </p>

          {/* 唯一的出口：把这封信收好——下载「我与月亮的信件往来」HTML，然后去休息屏 */}
          <div className="closing" style={{ animationDelay: `${closingDelay}s` }}>
            <button
              className="quiet"
              onClick={() => {
                downloadLetter(result).catch(() => {}); // 下载失败也不拦着去休息
                onDone();
              }}
            >
              Until tomorrow.
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
