import { PRICE_VAR_OPTIONS } from './constants';
import { getBackendExpansions } from '../../data/factorCatalog';

export const parseParams = (raw) => {
  try { return JSON.parse(raw || '{}'); } catch { return {}; }
};

export const makeVarName = (factor) =>
  factor.name.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/_+$/, '');

/** Build variable option list from selected factors + constant price vars.
 *  Key uses varName (not factorId) so two instances of the same factorId
 *  (e.g. ema + ema2) get distinct keys and can be selected independently. */
export function buildVarOptions(selectedFactors) {
  const backends = getBackendExpansions();
  const opts = [];
  for (const sf of selectedFactors) {
    const expansions = backends[sf.factorId];
    if (!expansions) continue;
    for (const exp of expansions) {
      const paramStr = Object.values(sf.params || {}).join(', ');
      opts.push({
        key: `f:${sf.varName}::${exp.back}`,
        label: paramStr
          ? `${sf.varName} · ${exp.label}(${paramStr})`
          : `${sf.varName} · ${exp.label}`,
        factorDef: { factor: exp.back, params: sf.params || {} },
      });
    }
  }
  return [...opts, ...PRICE_VAR_OPTIONS];
}

/**
 * Build a {varName → factorDef} map for the formula evaluator.
 * The first expansion of each selectedFactor is exposed under its varName,
 * so `ema1`, `rsi1`, `macd1` etc. can be referenced in formulas.
 * Price names (close, high, low, open, volume) are always available.
 */
export function buildFormulaVariables(selectedFactors) {
  const backends = getBackendExpansions();
  const variables = {};
  for (const sf of selectedFactors) {
    const expansions = backends[sf.factorId];
    if (!expansions || expansions.length === 0) continue;
    variables[sf.varName] = { factor: expansions[0].back, params: sf.params || {} };
    for (const exp of expansions) {
      variables[`${sf.varName}_${exp.back.toLowerCase()}`] = {
        factor: exp.back,
        params: sf.params || {},
      };
    }
  }
  return variables;
}

/** Convert a condition row to backend-compatible {left, op, right} */
export function toBECond(row, varOptions, selectedFactors = []) {
  const leftOpt   = varOptions.find(o => o.key === row.leftKey)  || varOptions[0];
  const formulaVars = buildFormulaVariables(selectedFactors);

  const makeLeft = () => {
    if (row.leftType === 'formula') {
      return {
        factor:     'FORMULA',
        expression: (row.leftFormula || '').trim(),
        variables:  formulaVars,
      };
    }
    return leftOpt?.factorDef || { factor: 'CLOSE', params: {} };
  };

  let right;
  if (row.rightType === 'value') {
    right = { factor: 'VALUE', value: Number(row.rightValue) };
  } else if (row.rightType === 'formula') {
    right = {
      factor:     'FORMULA',
      expression: (row.rightFormula || '').trim(),
      variables:  formulaVars,
    };
  } else {
    const rightOpt = varOptions.find(o => o.key === row.rightKey)
      || varOptions.find(o => o.key !== row.leftKey)
      || varOptions[0];
    right = rightOpt?.factorDef || { factor: 'CLOSE', params: {} };
  }

  return {
    left: makeLeft(),
    op:   row.op,
    right,
  };
}

export const mkCondRow = () => ({
  id:          `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
  leftType:    'factor',
  leftKey:     '',
  leftFormula: '',
  op:          'crosses_above',
  rightType:   'factor',
  rightKey:    '',
  rightValue:  0,
  rightFormula: '',
});

// ── Backend ↔ UI condition conversion ────────────────────────────────────────

function paramsMatch(a = {}, b = {}) {
  const ak = Object.keys(a || {});
  const bk = Object.keys(b || {});
  if (ak.length !== bk.length) return false;
  return ak.every(k => String(a[k]) === String(b[k]));
}

export function fromBECond(beCond, varOptions) {
  if (!beCond) return mkCondRow();
  const { left, op, right } = beCond;

  const findOpt = (fd) => {
    if (!fd?.factor || fd.factor === 'VALUE' || fd.factor === 'FORMULA') return null;
    const exact = varOptions.find(
      o => o.factorDef?.factor === fd.factor && paramsMatch(o.factorDef?.params, fd.params),
    );
    if (exact) return exact;
    return varOptions.find(o => o.factorDef?.factor === fd.factor) || null;
  };

  const leftIsFormula  = left?.factor  === 'FORMULA';
  const rightIsFormula = right?.factor === 'FORMULA';
  const rightIsValue   = right?.factor === 'VALUE';

  const leftOpt  = leftIsFormula  ? null : findOpt(left);
  const rightOpt = (rightIsFormula || rightIsValue) ? null : findOpt(right);

  return {
    id:           `c_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    leftType:     leftIsFormula ? 'formula' : 'factor',
    leftKey:      leftOpt?.key  || '',
    leftFormula:  leftIsFormula ? (left?.expression || '') : '',
    op:           op || 'crosses_above',
    rightType:    rightIsFormula ? 'formula' : (rightIsValue ? 'value' : 'factor'),
    rightKey:     rightOpt?.key || '',
    rightValue:   rightIsValue ? (right?.value ?? 0) : 0,
    rightFormula: rightIsFormula ? (right?.expression || '') : '',
  };
}
