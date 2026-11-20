/**
 * gauge — 0~100 반원 게이지 하나. 첫 행의 값을 바늘로 가리킨다.
 *
 * options:
 *   value   'value'           값 필드 (0~100)
 *   label   —                 값 앞의 회색 이름 (예: 'Fear & Greed')
 *   zones   '20:극단적 공포,40:공포,60:중립,80:탐욕,100:극단적 탐욕'   '끝값:이름' — 5구간까지 색이 있다
 *
 * 현재 구간만 선명하게 칠하고, 아래에 '이름 값 상태' 한 줄을 둔다.
 */
import { read } from '../format';

const ZONE_COLORS = ['#E0605A', '#E09A45', '#8E8E96', '#7CC48A', '#3FC27A'];
const DEFAULT_ZONES = '20:극단적 공포,40:공포,60:중립,80:탐욕,100:극단적 탐욕';
const R = 76, CX = 100, CY = 100;

/** 값(0~100) → 반원 위의 점 */
function point(v, r) {
  const a = Math.PI * (1 - v / 100);
  return [CX + r * Math.cos(a), CY - r * Math.sin(a)];
}

function parseZones(text) {
  let from = 0;
  return String(text).split(',').map((part, i) => {
    const [end, name = ''] = part.split(':');
    const zone = { from, to: Number(end), name: name.trim(), color: ZONE_COLORS[i % ZONE_COLORS.length] };
    from = zone.to;
    return zone;
  }).filter((z) => Number.isFinite(z.to) && z.to > z.from);
}

export default function GaugeView({ rows, ctx, options = {} }) {
  const { value = 'value', label, zones: zoneText = DEFAULT_ZONES } = options;
  const raw = Number(read(rows[0], value, ctx));
  const v = Math.max(0, Math.min(100, Number.isFinite(raw) ? raw : 0));
  const zones = parseZones(zoneText);
  const current = zones.find((z, i) => v >= z.from && (v < z.to || i === zones.length - 1));
  const [nx, ny] = point(v, R - 18);

  return (
    <div className="h-full flex flex-col items-center justify-center px-4 pt-1 pb-3.5 min-h-0">
      <svg
        viewBox="0 0 200 112" className="block w-full min-h-0" style={{ maxWidth: 300, aspectRatio: '200 / 112', flex: '0 1 auto' }}
        role="img" aria-label={`${label || ''} ${v.toFixed(1)} ${current?.name || ''}`.trim()}
      >
        {zones.map((z) => {
          const [x1, y1] = point(z.from + 0.8, R), [x2, y2] = point(z.to - 0.8, R);
          return (
            <path
              key={z.to} fill="none" stroke={z.color} strokeWidth="14" opacity={z === current ? 1 : 0.3}
              d={`M ${x1.toFixed(1)} ${y1.toFixed(1)} A ${R} ${R} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`}
            />
          );
        })}
        <line x1={CX} y1={CY} x2={nx.toFixed(1)} y2={ny.toFixed(1)} stroke="var(--mp-text)" strokeWidth="3" strokeLinecap="round" />
        <circle cx={CX} cy={CY} r="5" fill="var(--mp-text)" />
        <text x="24" y="111" fill="var(--mp-faint)" fontSize="10" textAnchor="middle">0</text>
        <text x="176" y="111" fill="var(--mp-faint)" fontSize="10" textAnchor="middle">100</text>
      </svg>
      <div className="flex items-baseline gap-1.5 mt-0.5 flex-shrink-0">
        {label && <span className="text-xs text-[var(--mp-muted)]">{label}</span>}
        <span className="text-[17px] font-semibold">{v.toFixed(1)}</span>
        {current?.name && <span className="text-xs font-semibold" style={{ color: current.color }}>{current.name}</span>}
      </div>
    </div>
  );
}
