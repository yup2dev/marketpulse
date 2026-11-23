/**
 * BrandLogo — MarketPulse 로고 (시안 Logo.dc.html 의 PICK '상승 계단' + 넓은 대문자 워드마크).
 *
 * 규칙 (로고 보드): 48 그리드 · 모든 모서리 직각 · 시그널 색은 강조 칸 한 곳에만 · 최소 마크 16px.
 *   잉크     #F2F2F0 (다크) / #0E0F12 (라이트)
 *   시그널   #06B6D4 (다크) / #0891B2 (라이트)
 *   크기     헤더 = 마크 20 + 워드마크 14 · 로그인 = 마크 28 + 워드마크 19
 * 색은 CSS 변수(--mp-brand-ink · --mp-brand-signal, index.css)라 테마를 따른다. 다크 고정 화면은 tone="dark".
 * 파비콘(public/favicon.svg)은 같은 마크를 잉크 타일(모서리 20%) 위에 올린 것이다.
 */

import { BRAND } from './brand';

const TONES = {
  theme: { ink: 'var(--mp-brand-ink)', signal: 'var(--mp-brand-signal)' },
  dark: { ink: '#F2F2F0', signal: '#06B6D4' },
};

const SIZES = {
  header: { mark: 20, text: 14, gap: 10 },
  auth: { mark: 28, text: 19, gap: 12 },
};

/** 마크만 */
export function BrandMark({ size = 20, tone = 'theme', title }) {
  const c = TONES[tone] || TONES.theme;
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" role={title ? 'img' : undefined} aria-label={title} aria-hidden={title ? undefined : true} className="flex-shrink-0">
      <path d={BRAND.ink} fill={c.ink} />
      <path d={BRAND.signal} fill={c.signal} />
    </svg>
  );
}

/** 마크 + 워드마크 */
export default function BrandLogo({ size = 'header', tone = 'theme' }) {
  const s = SIZES[size] || SIZES.header;
  const c = TONES[tone] || TONES.theme;
  return (
    <span className="inline-flex items-center" style={{ gap: s.gap }}>
      <BrandMark size={s.mark} tone={tone} />
      <span
        className="leading-none whitespace-nowrap"
        style={{ fontFamily: 'Archivo, sans-serif', fontStretch: '118%', fontWeight: 800, letterSpacing: '0.01em', fontSize: s.text, color: c.ink }}
      >
        MARKETPULSE
      </span>
    </span>
  );
}
