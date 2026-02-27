import { FACTOR_BACKEND_EXPANSIONS, PRICE_VAR_OPTIONS } from './constants';

export const parseParams = (raw) => {
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
};

export const makeVarName = (factor) =>
  factor.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');

/** Build variable option list from selected factors + constant price vars */
export function buildVarOptions(selectedFactors) {
  const opts = [];
  for (const sf of selectedFactors) {
    const expansions = FACTOR_BACKEND_EXPANSIONS[sf.factorId];
    if (!expansions) continue;
    for (const exp of expansions) {
      const paramStr = Object.values(sf.params || {}).join(', ');
      opts.push({
        key: `f:${sf.factorId}::${exp.back}`,
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
