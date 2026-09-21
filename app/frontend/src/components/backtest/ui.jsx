/**
 * Backtest Lab 위젯 공용 UI — 기간 바, 수식 입력(실시간 검증 + 함수 도움말), 포맷터.
 */
import { useMemo, useState } from 'react';
import { HelpCircle } from 'lucide-react';
import useBacktestStore from '../../store/backtestStore';
import { compile, FUNCTIONS } from './engine/expr';
import { RANGE_PRESETS, presetRange } from './engine/data';

export const inputCls =
  'w-full bg-[#0a0a0f] border border-gray-800 rounded px-2 py-1 text-[11px] text-gray-200 outline-none focus:border-cyan-700';
export const btnPrimary =
  'flex items-center gap-1 px-2.5 py-1 rounded text-[11px] font-medium bg-cyan-700 hover:bg-cyan-600 text-white disabled:opacity-40 transition-colors';
export const btnGhost =
  'flex items-center gap-1 px-2 py-1 rounded text-[11px] text-gray-400 hover:text-white hover:bg-gray-800 border border-gray-800 disabled:opacity-40 transition-colors';

export const IDENT_RE = /^[a-z_][a-z0-9_]{0,39}$/;

/** 변수·이벤트 이름 검증 — 수식 식별자 규칙 + 함수명/키워드 충돌 방지. */
export function nameError(name) {
  if (!name) return '이름을 입력하세요';
  if (!IDENT_RE.test(name)) return '영문 소문자로 시작, 소문자·숫자·밑줄만 (최대 40자)';
  if (FUNCTIONS[name] || ['and', 'or', 'not', 'true', 'false'].includes(name)) return '함수·키워드와 같은 이름은 쓸 수 없습니다';
  return null;
}

export const fmt = (v, digits = 2) =>
  v === null || v === undefined || !Number.isFinite(v)
    ? '—'
    : Math.abs(v) >= 1e6
      ? v.toExponential(2)
      : v.toLocaleString(undefined, { maximumFractionDigits: digits, minimumFractionDigits: Math.min(digits, 2) });

export const fmtPct = (v, digits = 2) => (v === null || v === undefined || !Number.isFinite(v) ? '—' : `${v >= 0 ? '+' : ''}${v.toFixed(digits)}%`);

export const signCls = (v) => (!Number.isFinite(v) ? 'text-gray-500' : v > 0 ? 'text-emerald-400' : v < 0 ? 'text-red-400' : 'text-gray-300');

export function Field({ label, hint, children, className = '' }) {
  return (
    <label className={`block ${className}`}>
      <span className="text-[10px] uppercase tracking-wide text-gray-500">{label}</span>
      <div className="mt-0.5">{children}</div>
      {hint && <span className="text-[10px] text-gray-600">{hint}</span>}
    </label>
  );
}

export function ErrorText({ children }) {
  if (!children) return null;
  return <div className="text-[11px] text-red-400 whitespace-pre-wrap break-words">{children}</div>;
}

export function Empty({ children }) {
  return <div className="text-center text-gray-600 text-[11px] py-6 px-3">{children}</div>;
}

/** 탭 공통 분석 기간 — 프리셋 또는 직접 입력. */
export function RangeBar() {
  const range = useBacktestStore((s) => s.range);
  const setRange = useBacktestStore((s) => s.setRange);
  return (
    <div className="flex items-center gap-1 flex-wrap">
      {RANGE_PRESETS.map((p) => (
        <button
          key={p}
          onClick={() => setRange(presetRange(p))}
          className={`px-1.5 py-0.5 rounded text-[10px] ${range.preset === p ? 'bg-cyan-900/60 text-cyan-300' : 'text-gray-500 hover:text-gray-200'}`}
        >
          {p}
        </button>
      ))}
      <input
        type="date"
        value={range.start}
        max={range.end}
        onChange={(e) => setRange({ preset: null, start: e.target.value, end: range.end })}
        className={`${inputCls} !w-[118px] !py-0.5`}
      />
      <span className="text-gray-600 text-[10px]">~</span>
      <input
        type="date"
        value={range.end}
        min={range.start}
        onChange={(e) => setRange({ preset: null, start: range.start, end: e.target.value })}
        className={`${inputCls} !w-[118px] !py-0.5`}
      />
    </div>
  );
}

/**
 * 수식 입력 — 파싱 오류, 없는 변수/이벤트 참조를 즉시 표시.
 * knownVariables/knownEvents: 이름 배열. allowEvents=false 면 event() 금지.
 */
export function ExprInput({ value, onChange, knownVariables = [], knownEvents = [], allowEvents = true, placeholder, rows = 2 }) {
  const [help, setHelp] = useState(false);
  const check = useMemo(() => validateExpr(value, { knownVariables, knownEvents, allowEvents }), [value, knownVariables, knownEvents, allowEvents]);

  return (
    <div className="space-y-1">
      <div className="relative">
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={rows}
          spellCheck={false}
          placeholder={placeholder}
          className={`${inputCls} font-mono resize-y pr-6 ${check.error ? '!border-red-800' : ''}`}
        />
        <button
          type="button"
          onClick={() => setHelp((h) => !h)}
          className="absolute right-1.5 top-1.5 text-gray-600 hover:text-cyan-400"
          title="함수 도움말"
        >
          <HelpCircle size={12} />
        </button>
      </div>
      {value?.trim() && (check.error
        ? <ErrorText>{check.error}</ErrorText>
        : <div className="text-[10px] text-gray-500">참조: {[...check.variables, ...check.events.map((e) => `event('${e}')`)].join(', ') || '없음'}</div>)}
      {help && <FunctionHelp allowEvents={allowEvents} knownVariables={knownVariables} knownEvents={knownEvents} />}
    </div>
  );
}

export function validateExpr(src, { knownVariables = [], knownEvents = [], allowEvents = true } = {}) {
  if (!src || !src.trim()) return { error: null, variables: [], events: [] };
  try {
    const c = compile(src, { allowEvents });
    const missingVars = c.variables.filter((v) => !knownVariables.includes(v));
    const missingEvents = c.events.filter((e) => !knownEvents.includes(e));
    const problems = [];
    if (missingVars.length) problems.push(`없는 변수: ${missingVars.join(', ')}`);
    if (missingEvents.length) problems.push(`없는 이벤트: ${missingEvents.join(', ')}`);
    return { error: problems.join(' · ') || null, variables: c.variables, events: c.events };
  } catch (e) {
    return { error: e.message, variables: [], events: [] };
  }
}

function FunctionHelp({ allowEvents, knownVariables, knownEvents }) {
  return (
    <div className="bg-[#0a0a0f] border border-gray-800 rounded p-2 text-[10px] text-gray-400 space-y-1 max-h-48 overflow-auto">
      <div>연산자: <span className="font-mono text-gray-300">+ - * / ^  &gt; &lt; &gt;= &lt;= == !=  and or not</span></div>
      <div className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5">
        {Object.entries(FUNCTIONS)
          .filter(([name]) => allowEvents || name !== 'event')
          .map(([name, f]) => (
            <div key={name} className="contents">
              <span className="font-mono text-cyan-300">{f.sig}</span>
              <span>{f.doc}</span>
            </div>
          ))}
      </div>
      <div>변수: <span className="font-mono text-gray-300">{knownVariables.join(', ') || '(없음)'}</span></div>
      {allowEvents && <div>이벤트: <span className="font-mono text-gray-300">{knownEvents.join(', ') || '(없음)'}</span></div>}
    </div>
  );
}
