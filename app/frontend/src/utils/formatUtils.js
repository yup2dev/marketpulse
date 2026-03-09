/**
 * formatUtils.js — MarketPulse 전역 포맷 유틸리티 (OpenBB style)
 *
 * 모든 포맷 함수는 이 파일에서만 정의한다.
 * 다른 파일에서 동일 로직을 재정의하지 않는다.
 */

import { createElement as h } from 'react';

// ── 통화 ──────────────────────────────────────────────────────────────────────

export const fmtUSD = (v, dec = 2) => {
  if (v == null) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency', currency: 'USD',
    minimumFractionDigits: dec, maximumFractionDigits: dec,
  }).format(v);
};

export const fmtKRW = (v) => {
  if (v == null) return '₩0';
  return new Intl.NumberFormat('ko-KR', {
    style: 'currency', currency: 'KRW', maximumFractionDigits: 0,
  }).format(Math.round(v));
};

// ── 퍼센트 ────────────────────────────────────────────────────────────────────

export const fmtPercent = (v, dec = 2) => {
  if (v == null) return '0.00%';
  return `${v >= 0 ? '+' : ''}${v.toFixed(dec)}%`;
};

// posNeg: widgetConfigs에서 사용 (JSX 반환)
export const posNeg = (v) =>
  v == null
    ? h('span', { className: 'text-gray-500' }, '-')
    : h('span', { className: v >= 0 ? 'text-green-500' : 'text-red-500' },
        `${v >= 0 ? '+' : ''}${(v * 100).toFixed(1)}%`);

export const gray = (v) =>
  v == null
    ? h('span', { className: 'text-gray-500' }, '-')
    : h('span', { className: 'text-gray-300' }, v);

// ── 수치 크기 ─────────────────────────────────────────────────────────────────

export const fmtMagnitude = (value) => {
  if (value == null) return '-';
  const abs  = Math.abs(value);
  const sign = value < 0 ? '-' : '';
  if (abs >= 1e12) return `${sign}$${(abs / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `${sign}$${(abs / 1e9).toFixed(2)}B`;
  if (abs >= 1e6)  return `${sign}$${(abs / 1e6).toFixed(2)}M`;
  if (abs >= 1e3)  return `${sign}$${(abs / 1e3).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
};

export const fmtNum = (value) => {
  if (value == null) return '-';
  const abs = Math.abs(value);
  if (abs >= 1e12) return `${(value / 1e12).toFixed(2)}T`;
  if (abs >= 1e9)  return `${(value / 1e9).toFixed(2)}B`;
  if (abs >= 1e6)  return `${(value / 1e6).toFixed(2)}M`;
  if (abs >= 1e3)  return `${(value / 1e3).toFixed(1)}K`;
  return value.toLocaleString();
};

// ── 날짜 ──────────────────────────────────────────────────────────────────────

export const fmtDate = (s) => {
  if (!s) return '-';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('en-US', { year: '2-digit', month: 'short', day: 'numeric' });
};

export const fmtDateShort = (s) => {
  if (!s) return '-';
  const d = new Date(s);
  return isNaN(d) ? s : d.toLocaleDateString('en-US', { year: '2-digit', month: 'short' });
};

// ── 파일명 (export용) ──────────────────────────────────────────────────────────

export const makeExportFilename = (title = 'export', symbol = '') => {
  const slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/-$/, '');
  const sym  = symbol ? `_${symbol.toUpperCase()}` : '';
  const date = new Date().toISOString().slice(0, 10);
  return `${slug}${sym}_${date}`;
};

// ── 하위 호환 별칭 (기존 코드가 참조하는 이름 유지) ───────────────────────────

export const formatCurrency = fmtUSD;
export const formatKRW      = fmtKRW;
export const formatPercent  = fmtPercent;
