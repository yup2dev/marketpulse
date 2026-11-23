/**
 * 로그인 페이지 (시안 Login.dc.html) — 왼쪽 소개 슬라이드 · 오른쪽 로그인 폼. 다크 고정.
 *
 * 인증은 그대로 authStore.login. 아래 줄의 서버 상태는 /health 를 한 번 물어본 결과다 (인증 없이 열려 있다).
 * 시안의 '비밀번호 찾기'는 아직 기능이 없어 넣지 않았다.
 */
import { useEffect, useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { AlertTriangle, ArrowRight, Eye, EyeOff } from 'lucide-react';
import { API_BASE_URL } from '../../common/api/base';
import useAuthStore from '../../store/authStore';
import BrandLogo from '../../common/brand/BrandLogo';
import { BRAND } from '../../common/brand/brand';
import LoginShowcase from './LoginShowcase';

const ACCENT = BRAND.signalColor;
const ON_ACCENT = '#0E0F12';
const EMAIL = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;

function Brand() {
  return (
    <Link to="/login" aria-label="MarketPulse 홈" className="flex no-underline self-start">
      <BrandLogo size="auth" tone="dark" />
    </Link>
  );
}

function useServerStatus() {
  const [ok, setOk] = useState(null);
  useEffect(() => {
    let alive = true;
    fetch(`${API_BASE_URL}/health`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => alive && setOk(j?.status === 'healthy'))
      .catch(() => alive && setOk(false));
    return () => { alive = false; };
  }, []);
  return ok;
}

const FIELD = 'w-full h-12 box-border px-3.5 rounded-sm bg-[#111113] text-[#F2F2F0] text-[15px] outline-none border placeholder:text-[#6E7078] focus:border-[#06B6D4] focus:shadow-[0_0_0_3px_rgba(6,182,212,0.28)]';

export default function Login() {
  const navigate = useNavigate();
  const { login, isAuthenticated, isInitializing, isLoading, error, clearError } = useAuthStore();
  const { register, handleSubmit, formState: { errors } } = useForm();
  const [showPw, setShowPw] = useState(false);
  const server = useServerStatus();

  useEffect(() => {
    // 인증 확인 완료 후 이미 로그인된 경우 대시보드로
    if (!isInitializing && isAuthenticated) navigate('/');
  }, [isAuthenticated, isInitializing, navigate]);

  useEffect(() => () => clearError(), [clearError]);

  const onSubmit = async (data) => {
    const result = await login(data.email, data.password);
    if (result.success) navigate('/');
  };

  return (
    <div className="mp-auth min-h-screen bg-[#0A0A0B] text-[#F2F2F0] text-sm tabular-nums flex flex-wrap" style={{ fontFamily: "Inter, 'Noto Sans KR', system-ui, sans-serif" }}>
      <style>{'.mp-nav{width:36px;height:36px;flex-shrink:0;border:1px solid #2E2F36;border-radius:2px;background:transparent;color:#C9CBD2;display:flex;align-items:center;justify-content:center;padding:0;cursor:pointer}.mp-nav:hover{background:#141518;color:#fff}'}</style>

      {/* 폰 폭에서는 소개 슬라이드를 빼고 로그인부터 — 로고만 폼 위에 */}
      <aside className="hidden md:flex flex-[1_1_620px] min-w-0 box-border px-14 py-10 flex-col justify-between gap-8">
        <Brand />
        <LoginShowcase accent={ACCENT} />
        <div className="flex justify-between gap-4 text-[11px] font-semibold tracking-[0.08em] text-[#8A8C95]">
          <span>© 2026 MARKETPULSE</span>
          <span className="flex items-center gap-2">
            <span className="w-1.5 h-1.5" style={{ background: server == null ? '#55575F' : server ? '#3FC27A' : '#F5A623' }} />
            {server == null ? 'CHECKING · 서버 확인 중' : server ? 'SYSTEMS NORMAL · 서버 정상' : 'DEGRADED · 서버 응답 없음'}
          </span>
        </div>
      </aside>

      <main className="w-full md:w-auto md:flex-[1_1_420px] min-w-0 box-border px-4 py-10 md:px-6 md:py-12 flex flex-col items-center justify-center gap-10 md:border-l border-[#16171A]">
        <div className="md:hidden w-full max-w-[380px] flex"><Brand /></div>
        <form onSubmit={handleSubmit(onSubmit)} noValidate className="w-full max-w-[380px] flex flex-col gap-5">
          <div className="flex flex-col gap-2.5">
            <span className="text-[11px] font-semibold tracking-[0.18em] text-[#8A8C95]">SIGN IN</span>
            <h2 className="m-0 text-[28px] font-bold tracking-[-0.6px]">로그인</h2>
            <p className="m-0 text-sm text-[#A3A5AD]">내 대시보드와 위젯 배치를 그대로 이어서 볼 수 있어요</p>
          </div>

          {error && (
            <div role="alert" className="flex gap-2.5 items-start px-3.5 py-3 rounded-sm bg-[#2A1417] border border-[#5A2229] text-[#FF9AA2] text-[13px] leading-normal">
              <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
              {error}
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <label htmlFor="lg-email" className="text-[13px] font-medium text-[#C9CBD2]">이메일</label>
            <input
              id="lg-email" type="email" autoComplete="email" placeholder="example@email.com"
              aria-invalid={!!errors.email}
              className={`${FIELD} ${errors.email ? 'border-[#F04452]' : 'border-[#2E2F36]'}`}
              {...register('email', {
                required: '이메일을 입력해주세요.',
                pattern: { value: EMAIL, message: '올바른 이메일 형식이 아닙니다.' },
              })}
            />
            {errors.email && <span className="text-xs text-[#FF7A85]">{errors.email.message}</span>}
          </div>

          <div className="flex flex-col gap-1.5">
            <label htmlFor="lg-pw" className="text-[13px] font-medium text-[#C9CBD2]">비밀번호</label>
            <div className="relative">
              <input
                id="lg-pw" type={showPw ? 'text' : 'password'} autoComplete="current-password" placeholder="6자 이상"
                aria-invalid={!!errors.password}
                className={`${FIELD} pr-12 ${errors.password ? 'border-[#F04452]' : 'border-[#2E2F36]'}`}
                {...register('password', {
                  required: '비밀번호를 입력해주세요.',
                  minLength: { value: 6, message: '비밀번호는 최소 6자 이상이어야 합니다.' },
                })}
              />
              <button
                type="button" onClick={() => setShowPw((v) => !v)} aria-label={showPw ? '비밀번호 숨기기' : '비밀번호 보기'}
                className="absolute right-1 top-1 w-10 h-10 rounded-sm bg-transparent text-[#8E9099] flex items-center justify-center hover:bg-[#1A1B1F] hover:text-[#F2F2F0]"
              >
                {showPw ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
              </button>
            </div>
            {errors.password && <span className="text-xs text-[#FF7A85]">{errors.password.message}</span>}
          </div>

          <button
            type="submit" disabled={isLoading}
            className="w-full h-12 rounded-sm text-[15px] font-bold flex items-center justify-center gap-2.5 hover:brightness-110 disabled:opacity-60 disabled:hover:brightness-100"
            style={{ background: ACCENT, color: ON_ACCENT }}
          >
            {isLoading ? '로그인 중…' : '로그인'}
            <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
          </button>

          <div className="flex items-center gap-3 text-[10px] font-semibold tracking-[0.16em] text-[#6E7078]">
            <span className="flex-1 h-px bg-[#1F2025]" />OR<span className="flex-1 h-px bg-[#1F2025]" />
          </div>

          <Link
            to="/register"
            className="w-full h-12 box-border border border-[#2E2F36] rounded-sm flex items-center justify-center text-sm font-medium text-[#E6E6E8] no-underline hover:bg-[#141518]"
          >
            회원가입
          </Link>
        </form>
      </main>
    </div>
  );
}
