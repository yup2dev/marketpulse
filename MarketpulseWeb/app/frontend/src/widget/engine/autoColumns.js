/**
 * autoColumns — 컬럼을 적지 않은 표(MpGrid)의 기본 컬럼.
 *
 * 게이트웨이(/data/{provider}/{model}) 행은 fetcher 표준 모델의 칸이라, 기본 위젯 정의는
 * endpoint + view_type: 'table' 이면 된다. 머리글 · 형식을 바꿀 칸만 fields(COLUMN)로 적는다.
 */
const DATE_KEY = /(^date$|_date$|_utc$|^period(_ending)?$|^datetime$|^timestamp$)/;
export const AUTO_MAX = 12;   // 자동 컬럼은 이만큼만 (나머지는 열 선택으로 켤 수 있게 숨김)

/**
 * 컬럼을 적지 않은 표 — 첫 행들의 칸에서 만든다. 객체 · 배열 칸은 뺀다.
 * 날짜 이름 → date, 숫자 → number(백만 이상이면 compact), 그 밖 → text. 머리글은 칸 이름 (snake → 띄어쓰기).
 */
export function autoColumns(rows) {
  const sample = (rows || []).slice(0, 20);
  const keys = [];
  for (const r of sample) for (const k of Object.keys(r || {})) if (!keys.includes(k) && !k.startsWith('_')) keys.push(k);
  const cols = [];
  for (const k of keys) {
    const vals = sample.map((r) => r?.[k]).filter((v) => v != null && v !== '');
    if (vals.some((v) => typeof v === 'object')) continue;
    const num = vals.length > 0 && vals.every((v) => typeof v === 'number');
    const big = num && vals.some((v) => Math.abs(v) >= 1e6);
    const type = DATE_KEY.test(k) ? 'date' : num ? (big ? 'compact' : 'number') : 'text';
    cols.push({ type, field: k, header: k.replace(/_/g, ' '), hide: cols.length >= AUTO_MAX });
  }
  return cols;
}
