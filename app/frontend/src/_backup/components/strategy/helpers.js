import { FACTOR_BACKEND_EXPANSIONS, PRICE_VAR_OPTIONS } from './constants';

export const parseParams = (raw) => {
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
};

export const makeVarName = (factor) =>
  factor.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');

/** Build variable option list from selected factors + constant price vars.
 *  Key uses varName (not factorId) so two instances of the same factorId
 *  (e.g. ema + ema2) get distinct keys and can be selected independently. */
export function buildVarOptions(selectedFactors) {
  const opts = [];
  for (const sf of selectedFactors) {
    const expansions = FACTOR_BACKEND_EXPANSIONS[sf.factorId];
    if (!expansions) continue;
    for (const exp of expansions) {
      const paramStr = Object.values(sf.params || {}).join(', ');
      opts.push({
        key: `f:${sf.varName}::${exp.back}`,          // varName-based key → unique per instance
        label: paramStr
          ? `${sf.varName} · ${exp.label}(${paramStr})`
          : `${sf.varName} · ${exp.label}`,
        factorDef: { factor: exp.back, params: sf.params || {} },
      });
    }
  }
  return [...opts, ...PRICE_VAR_OPTIONS];
}

/** Convert a condition row to backend-compatible {left, op, right} */
export function toBECond(row, varOptions) {
  const leftOpt  = varOptions.find(o => o.key === row.leftKey)  || varOptions[0];
  let right;
  if (row.rightType === 'value') {
    right = { factor: 'VALUE', value: Number(row.rightValue) };
  } else {
    const rightOpt = varOptions.find(o => o.key === row.rightKey)
      || varOptions.find(o => o.key !== row.leftKey)
      || varOptions[0];
    right = rightOpt?.factorDef || { factor: 'CLOSE', params: {} };
  }
  return {
    left: leftOpt?.factorDef || { factor: 'CLOSE', params: {} },
    op:   row.op,
    right,
  };
}

export const mkCondRow = () => ({
  id:         `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  leftKey:    '',
  op:         'crosses_above',
  rightType:  'factor',
  rightKey:   '',
  rightValue: 0,
});

// ── Backend ↔ UI condition conversion ────────────────────────────────────────

/** Loose params comparison: {period:12} == {period:"12"} */
function paramsMatch(a = {}, b = {}) {
  const ak = Object.keys(a || {});
  const bk = Object.keys(b || {});
  if (ak.length !== bk.length) return false;
  return ak.every(k => String(a[k]) === String(b[k]));
}

/**
 * Convert a backend-format condition {left:{factor,params}, op, right}
 * back to a UI condition row {id, leftKey, op, rightType, rightKey, rightValue}.
 * Used when loading a saved strategy so conditions restore correctly.
 */
export function fromBECond(beCond, varOptions) {
  if (!beCond) return mkCondRow();
  const { left, op, right } = beCond;

  /** Find the varOption best matching a factorDef {factor, params} */
  const findOpt = (fd) => {
    if (!fd?.factor || fd.factor === 'VALUE') return null;
    // 1. Exact match: same factor name AND same params
    const exact = varOptions.find(
      o => o.factorDef?.factor === fd.factor && paramsMatch(o.factorDef?.params, fd.params),
    );
    if (exact) return exact;
    // 2. Fallback: same factor name only (first found)
    return varOptions.find(o => o.factorDef?.factor === fd.factor) || null;
  };

  const leftOpt  = findOpt(left);
  const isValue  = right?.factor === 'VALUE';
  const rightOpt = isValue ? null : findOpt(right);

  return {
    id:         `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    leftKey:    leftOpt?.key  || '',
    op:         op || 'crosses_above',
    rightType:  isValue ? 'value' : 'factor',
    rightKey:   rightOpt?.key || '',
    rightValue: isValue ? (right?.value ?? 0) : 0,
  };
}
