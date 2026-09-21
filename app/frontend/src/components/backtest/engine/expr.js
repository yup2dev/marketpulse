/**
 * expr — 백테스트 수식 언어 (파서 + 평가기). eval/Function 을 쓰지 않는 안전한 구현.
 *
 *   숫자, 변수 이름(사용자 변수), 함수 호출, 문자열('이벤트명' — event() 인자 전용)
 *   연산자: ^  * /  + -  > < >= <= == !=  not/!  and/&&  or/||  (괄호로 우선순위 조정)
 *
 * 값은 스칼라 또는 길이 n 배열로 원소별 계산(브로드캐스팅). 비교·논리 결과는 1/0.
 */
import * as ind from './indicators';

export class ExprError extends Error {
  constructor(message, pos = null) {
    super(message);
    this.pos = pos;
  }
}

const MAX_WINDOW = 5000;

// ── 함수 정의 (docs 는 편집기 도움말로 노출) ───────────────────────────────────
const win = (v, name, min = 1) => {
  if (Array.isArray(v) || !Number.isInteger(v) || v < min || v > MAX_WINDOW) {
    throw new ExprError(`${name}: 기간은 ${min}~${MAX_WINDOW} 사이 정수여야 합니다`);
  }
  return v;
};
const elementwise = (f) => (args, n) => {
  const [a, b] = args;
  if (!Array.isArray(a) && (b === undefined || !Array.isArray(b))) return f(a, b);
  const out = new Array(n);
  for (let i = 0; i < n; i += 1) out[i] = f(Array.isArray(a) ? a[i] : a, Array.isArray(b) ? b[i] : b);
  return out;
};
const seriesArg = (v, n) => (Array.isArray(v) ? v : new Array(n).fill(v));

export const FUNCTIONS = {
  sma:         { sig: 'sma(x, n)',          doc: 'n봉 단순이동평균',                     arity: [2, 2], fn: ([x, w], n) => ind.sma(seriesArg(x, n), win(w, 'sma')) },
  ema:         { sig: 'ema(x, n)',          doc: 'n봉 지수이동평균',                     arity: [2, 2], fn: ([x, w], n) => ind.ema(seriesArg(x, n), win(w, 'ema')) },
  rsi:         { sig: 'rsi(x, n=14)',       doc: 'Wilder RSI (0~100)',                   arity: [1, 2], fn: ([x, w = 14], n) => ind.rsi(seriesArg(x, n), win(w, 'rsi', 2)) },
  std:         { sig: 'std(x, n)',          doc: 'n봉 표준편차',                         arity: [2, 2], fn: ([x, w], n) => ind.std(seriesArg(x, n), win(w, 'std', 2)) },
  zscore:      { sig: 'zscore(x, n)',       doc: 'n봉 평균·표준편차 기준 z-score',       arity: [2, 2], fn: ([x, w], n) => ind.zscore(seriesArg(x, n), win(w, 'zscore', 2)) },
  pct:         { sig: 'pct(x, n=1)',        doc: 'n봉 전 대비 변화율(%)',                arity: [1, 2], fn: ([x, w = 1], n) => ind.pct(seriesArg(x, n), win(w, 'pct')) },
  diff:        { sig: 'diff(x, n=1)',       doc: 'n봉 전 대비 차이',                     arity: [1, 2], fn: ([x, w = 1], n) => ind.diff(seriesArg(x, n), win(w, 'diff')) },
  lag:         { sig: 'lag(x, n=1)',        doc: 'n봉 전 값',                            arity: [1, 2], fn: ([x, w = 1], n) => ind.lag(seriesArg(x, n), win(w, 'lag')) },
  highest:     { sig: 'highest(x, n)',      doc: 'n봉 최고값',                           arity: [2, 2], fn: ([x, w], n) => ind.highest(seriesArg(x, n), win(w, 'highest')) },
  lowest:      { sig: 'lowest(x, n)',       doc: 'n봉 최저값',                           arity: [2, 2], fn: ([x, w], n) => ind.lowest(seriesArg(x, n), win(w, 'lowest')) },
  drawdown:    { sig: 'drawdown(x)',        doc: '누적 최고점 대비 하락률(%)',           arity: [1, 1], fn: ([x], n) => ind.drawdown(seriesArg(x, n)) },
  cross_above: { sig: 'cross_above(a, b)',  doc: 'a가 b를 상향 돌파한 봉 = 1',           arity: [2, 2], fn: ([a, b], n) => ind.crossAbove(seriesArg(a, n), seriesArg(b, n)) },
  cross_below: { sig: 'cross_below(a, b)',  doc: 'a가 b를 하향 돌파한 봉 = 1',           arity: [2, 2], fn: ([a, b], n) => ind.crossBelow(seriesArg(a, n), seriesArg(b, n)) },
  abs:         { sig: 'abs(x)',             doc: '절댓값',                               arity: [1, 1], fn: elementwise((a) => Math.abs(a)) },
  log:         { sig: 'log(x)',             doc: '자연로그',                             arity: [1, 1], fn: elementwise((a) => (a > 0 ? Math.log(a) : NaN)) },
  sqrt:        { sig: 'sqrt(x)',            doc: '제곱근',                               arity: [1, 1], fn: elementwise((a) => (a >= 0 ? Math.sqrt(a) : NaN)) },
  min:         { sig: 'min(a, b)',          doc: '원소별 최솟값',                        arity: [2, 2], fn: elementwise((a, b) => Math.min(a, b)) },
  max:         { sig: 'max(a, b)',          doc: '원소별 최댓값',                        arity: [2, 2], fn: elementwise((a, b) => Math.max(a, b)) },
  if:          { sig: 'if(cond, a, b)',     doc: 'cond 가 참이면 a, 아니면 b',           arity: [3, 3], fn: ([c, a, b], n) => {
    const at = (v, i) => (Array.isArray(v) ? v[i] : v);
    if (![c, a, b].some(Array.isArray)) return Number.isFinite(c) ? (c !== 0 ? a : b) : NaN;
    return Array.from({ length: n }, (_, i) => {
      const cv = at(c, i);
      return Number.isFinite(cv) ? (cv !== 0 ? at(a, i) : at(b, i)) : NaN;
    });
  } },
  event:       { sig: "event('이름')",      doc: '이벤트 발생 봉 = 1 (이벤트 매핑에서 정의)', arity: [1, 1], fn: null },
};

// ── 토크나이저 ────────────────────────────────────────────────────────────────
const TWO_CHAR = ['>=', '<=', '==', '!=', '&&', '||'];
const ONE_CHAR = '+-*/^(),<>!';
const KEYWORD_OPS = { and: '&&', or: '||', not: '!' };

function tokenize(src) {
  const tokens = [];
  const numRe = /\d+(?:\.\d+)?(?:[eE][+-]?\d+)?|\.\d+(?:[eE][+-]?\d+)?/y;
  const idRe = /[A-Za-z_][A-Za-z0-9_]*/y;
  let i = 0;
  while (i < src.length) {
    const ch = src[i];
    if (/\s/.test(ch)) { i += 1; continue; }
    numRe.lastIndex = i;
    const num = numRe.exec(src);
    if (num) {
      tokens.push({ type: 'num', value: Number(num[0]), pos: i });
      i += num[0].length;
      continue;
    }
    idRe.lastIndex = i;
    const id = idRe.exec(src);
    if (id) {
      const word = id[0];
      const lower = word.toLowerCase();
      if (KEYWORD_OPS[lower]) tokens.push({ type: 'op', value: KEYWORD_OPS[lower], pos: i });
      else if (lower === 'true' || lower === 'false') tokens.push({ type: 'num', value: lower === 'true' ? 1 : 0, pos: i });
      else tokens.push({ type: 'id', value: word, pos: i });
      i += word.length;
      continue;
    }
    if (ch === "'" || ch === '"') {
      const end = src.indexOf(ch, i + 1);
      if (end < 0) throw new ExprError('문자열 따옴표가 닫히지 않았습니다', i);
      tokens.push({ type: 'str', value: src.slice(i + 1, end), pos: i });
      i = end + 1;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (TWO_CHAR.includes(two)) { tokens.push({ type: 'op', value: two, pos: i }); i += 2; continue; }
    if (ONE_CHAR.includes(ch)) { tokens.push({ type: 'op', value: ch, pos: i }); i += 1; continue; }
    throw new ExprError(`알 수 없는 문자 '${ch}'`, i);
  }
  return tokens;
}

// ── 파서 (Pratt) ──────────────────────────────────────────────────────────────
const BINARY = {
  '||': { prec: 1 }, '&&': { prec: 2 },
  '>': { prec: 4 }, '<': { prec: 4 }, '>=': { prec: 4 }, '<=': { prec: 4 }, '==': { prec: 4 }, '!=': { prec: 4 },
  '+': { prec: 5 }, '-': { prec: 5 },
  '*': { prec: 6 }, '/': { prec: 6 },
  '^': { prec: 8, right: true },
};
const NOT_PREC = 3;
const NEG_PREC = 7;

export function parse(src) {
  if (!src || !String(src).trim()) throw new ExprError('수식이 비어 있습니다', 0);
  const tokens = tokenize(String(src));
  let p = 0;
  const peek = () => tokens[p];
  const isOp = (t, v) => t && t.type === 'op' && t.value === v;

  function parseExpr(minPrec) {
    let left = parsePrefix();
    for (;;) {
      const t = peek();
      const info = t && t.type === 'op' ? BINARY[t.value] : null;
      if (!info || info.prec < minPrec) break;
      p += 1;
      const right = parseExpr(info.right ? info.prec : info.prec + 1);
      left = { type: 'bin', op: t.value, left, right, pos: t.pos };
    }
    return left;
  }

  function parsePrefix() {
    const t = tokens[p++];
    if (!t) throw new ExprError('수식이 중간에 끝났습니다', src.length);
    if (t.type === 'num') return { type: 'num', value: t.value };
    if (t.type === 'str') return { type: 'str', value: t.value, pos: t.pos };
    if (isOp(t, '-')) return { type: 'unary', op: '-', arg: parseExpr(NEG_PREC), pos: t.pos };
    if (isOp(t, '+')) return parseExpr(NEG_PREC);
    if (isOp(t, '!')) return { type: 'unary', op: '!', arg: parseExpr(NOT_PREC), pos: t.pos };
    if (isOp(t, '(')) {
      const e = parseExpr(0);
      if (!isOp(tokens[p], ')')) throw new ExprError("닫는 괄호 ')'가 필요합니다", tokens[p]?.pos ?? src.length);
      p += 1;
      return e;
    }
    if (t.type === 'id') {
      if (isOp(peek(), '(')) {
        p += 1;
        const args = [];
        if (!isOp(peek(), ')')) {
          for (;;) {
            args.push(parseExpr(0));
            if (isOp(peek(), ',')) { p += 1; continue; }
            break;
          }
        }
        if (!isOp(tokens[p], ')')) throw new ExprError(`${t.value}(...) 의 닫는 괄호가 필요합니다`, tokens[p]?.pos ?? src.length);
        p += 1;
        return { type: 'call', name: t.value.toLowerCase(), args, pos: t.pos };
      }
      return { type: 'id', name: t.value, pos: t.pos };
    }
    throw new ExprError(`예상치 못한 '${t.value}'`, t.pos);
  }

  const ast = parseExpr(0);
  if (p < tokens.length) throw new ExprError(`예상치 못한 '${tokens[p].value}'`, tokens[p].pos);
  return ast;
}

/** 파싱 + 정적 검사. 참조하는 변수·이벤트 이름을 돌려준다. */
export function compile(src, { allowEvents = true } = {}) {
  const ast = parse(src);
  const variables = new Set();
  const events = new Set();
  const walk = (node) => {
    switch (node.type) {
      case 'num':
        return;
      case 'str':
        throw new ExprError("문자열은 event('이름') 안에서만 쓸 수 있습니다", node.pos);
      case 'id':
        if (FUNCTIONS[node.name.toLowerCase()]) throw new ExprError(`${node.name} 은(는) 함수입니다 — ${FUNCTIONS[node.name.toLowerCase()].sig}`, node.pos);
        variables.add(node.name);
        return;
      case 'unary':
        walk(node.arg);
        return;
      case 'bin':
        walk(node.left);
        walk(node.right);
        return;
      case 'call': {
        const def = FUNCTIONS[node.name];
        if (!def) throw new ExprError(`알 수 없는 함수 '${node.name}'`, node.pos);
        const [lo, hi] = def.arity;
        if (node.args.length < lo || node.args.length > hi) {
          throw new ExprError(`${def.sig}: 인자 개수가 맞지 않습니다`, node.pos);
        }
        if (node.name === 'event') {
          if (!allowEvents) throw new ExprError('이 수식에서는 event()를 쓸 수 없습니다', node.pos);
          if (node.args[0].type !== 'str') throw new ExprError("event('이름') 형태로 이벤트 이름을 따옴표로 감싸세요", node.pos);
          events.add(node.args[0].value);
          return;
        }
        node.args.forEach(walk);
        return;
      }
      default:
        throw new ExprError('지원하지 않는 식입니다', node.pos);
    }
  };
  walk(ast);
  return { ast, variables: [...variables], events: [...events] };
}

// ── 평가 ──────────────────────────────────────────────────────────────────────
const cmp = (f) => (a, b) => (Number.isFinite(a) && Number.isFinite(b) ? (f(a, b) ? 1 : 0) : NaN);
const BIN_FN = {
  '+': (a, b) => a + b,
  '-': (a, b) => a - b,
  '*': (a, b) => a * b,
  '/': (a, b) => (b === 0 ? NaN : a / b),
  '^': (a, b) => a ** b,
  '>': cmp((a, b) => a > b),
  '<': cmp((a, b) => a < b),
  '>=': cmp((a, b) => a >= b),
  '<=': cmp((a, b) => a <= b),
  '==': cmp((a, b) => a === b),
  '!=': cmp((a, b) => a !== b),
  '&&': (a, b) => (ind.truthy(a) && ind.truthy(b) ? 1 : 0),
  '||': (a, b) => (ind.truthy(a) || ind.truthy(b) ? 1 : 0),
};

/**
 * env: { n, variable(name) → number[], event(name) → number[] }
 * 결과는 스칼라 또는 number[] — 시계열이 필요하면 asSeries() 로 펼친다.
 */
export function evaluate(ast, env) {
  const { n } = env;
  const ev = (node) => {
    switch (node.type) {
      case 'num':
        return node.value;
      case 'id': {
        const v = env.variable(node.name);
        if (!v) throw new ExprError(`알 수 없는 변수 '${node.name}'`, node.pos);
        return v;
      }
      case 'unary': {
        const a = ev(node.arg);
        const f = node.op === '-' ? (x) => -x : (x) => (Number.isFinite(x) ? (x === 0 ? 1 : 0) : NaN);
        return Array.isArray(a) ? a.map(f) : f(a);
      }
      case 'bin': {
        const a = ev(node.left);
        const b = ev(node.right);
        const f = BIN_FN[node.op];
        if (!Array.isArray(a) && !Array.isArray(b)) return f(a, b);
        const out = new Array(n);
        for (let i = 0; i < n; i += 1) out[i] = f(Array.isArray(a) ? a[i] : a, Array.isArray(b) ? b[i] : b);
        return out;
      }
      case 'call': {
        if (node.name === 'event') {
          const mask = env.event?.(node.args[0].value);
          if (!mask) throw new ExprError(`알 수 없는 이벤트 '${node.args[0].value}'`, node.pos);
          return mask;
        }
        return FUNCTIONS[node.name].fn(node.args.map(ev), n);
      }
      default:
        throw new ExprError('지원하지 않는 식입니다', node.pos);
    }
  };
  return ev(ast);
}

export const asSeries = (v, n) => (Array.isArray(v) ? v : new Array(n).fill(v));
