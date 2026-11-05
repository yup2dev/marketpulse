/**
 * MetricTiles — 핵심 결과 숫자 몇 개를 큰 타일로. kv 위젯의 primary 필드,
 * 요약 카드 등 '한눈에 봐야 하는 값'에 쓴다.
 *
 * items: [{ key, label, value, hint? }]  — value 는 이미 포맷된 문자열이거나 숫자/불리언
 */
function show(v) {
  if (v == null || v === '') return '—';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

export default function MetricTiles({ items }) {
  if (!items?.length) return null;
  return (
    <div className="grid gap-2 p-3 grid-cols-[repeat(auto-fill,minmax(120px,1fr))]">
      {items.map((it) => (
        <div key={it.key} className="rounded border border-gray-800 bg-gray-900/50 px-3 py-2 min-w-0">
          <div className="text-[10px] font-medium text-gray-500 truncate" title={it.hint || it.label}>{it.label}</div>
          <div
            className={`mt-0.5 text-base font-semibold tabular-nums truncate ${
              typeof it.value === 'boolean' ? (it.value ? 'text-green-400' : 'text-red-400') : 'text-white'
            }`}
          >
            {show(it.value)}
          </div>
        </div>
      ))}
    </div>
  );
}
