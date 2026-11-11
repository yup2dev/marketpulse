/**
 * 위젯 설정 화면의 공통 부품 — 내 위젯·기본 위젯·위젯 종류 목록이 같이 쓴다.
 */
import { URL_WIDGET_MAP } from '../../registry/urlWidgetMap';
import { ALL_SCREENS } from '../../registry/userWidgets';

/** 사용 여부 스위치 (use_yn) */
export function UseToggle({ on, onChange, label, disabled }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!on)}
      className={`relative w-8 h-[18px] rounded-full transition-colors disabled:opacity-40 ${on ? 'bg-cyan-600' : 'bg-gray-700'}`}
    >
      <span className={`absolute top-0.5 left-0.5 w-3.5 h-3.5 rounded-full bg-white transition-transform ${on ? 'translate-x-[14px]' : ''}`} />
    </button>
  );
}

const SCREEN_OPTIONS = Object.entries(URL_WIDGET_MAP).map(([path, page]) => ({ value: path, label: page.label }));

/**
 * 내놓을 화면 고르기. screens 에 '*' 가 있으면(또는 비어 있으면) 모든 화면이다.
 * '모든 화면' 과 개별 화면은 둘 중 하나다 — 개별 화면을 누르면 그 화면만 고른 상태가 되고,
 * 고른 화면을 전부 끄면 다시 모든 화면이 된다.
 * allLabel — '*' 칩의 이름 (내 위젯: '모든 화면', 기본 위젯: '기본 배치')
 */
export function ScreenChips({ screens, onChange, allLabel = '모든 화면' }) {
  const picked = screens.filter((s) => s !== ALL_SCREENS);
  const all = picked.length === 0 || screens.includes(ALL_SCREENS);
  const toggle = (value) => {
    if (value === ALL_SCREENS) { onChange([ALL_SCREENS]); return; }
    const base = all ? [] : picked;
    const next = base.includes(value) ? base.filter((s) => s !== value) : [...base, value];
    onChange(next.length ? next : [ALL_SCREENS]);
  };
  const chip = (value, label, active) => (
    <button
      key={value} type="button" onClick={() => toggle(value)}
      aria-pressed={active}
      className={`px-2.5 py-1 rounded-full text-[11px] border transition-colors ${
        active ? 'border-cyan-500 bg-cyan-600/20 text-white' : 'border-gray-700 text-gray-400 hover:border-gray-500'
      }`}
    >
      {label}
    </button>
  );
  return (
    <div className="flex flex-wrap gap-1.5">
      {chip(ALL_SCREENS, allLabel, all)}
      {SCREEN_OPTIONS.map((s) => chip(s.value, s.label, !all && picked.includes(s.value)))}
    </div>
  );
}
