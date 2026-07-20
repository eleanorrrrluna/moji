// 呼吸印章（PRD 11.4）：朱砂红、墨字「墨」、毛边质感。
// feTurbulence + feDisplacementMap 把规整的圆形边缘“揉毛”，模拟印泥按在宣纸上的不均匀
export default function Seal() {
  return (
    <svg className="seal" viewBox="0 0 120 120" aria-hidden="true">
      <defs>
        <filter id="seal-ink" x="-20%" y="-20%" width="140%" height="140%">
          <feTurbulence type="fractalNoise" baseFrequency="0.09" numOctaves="3" seed="7" result="noise" />
          <feDisplacementMap in="SourceGraphic" in2="noise" scale="7" />
        </filter>
      </defs>
      <g filter="url(#seal-ink)">
        <circle cx="60" cy="60" r="44" fill="#9F452F" />
        <text
          x="60"
          y="77"
          textAnchor="middle"
          fontSize="48"
          fill="#F3ECE2"
          fontFamily="'Songti SC', 'Noto Serif SC', serif"
        >
          墨
        </text>
      </g>
    </svg>
  );
}
