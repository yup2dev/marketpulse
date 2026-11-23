/**
 * 회원가입 페이지 — 로그인(시안 Login.dc.html)의 폼과 같은 모양 · 다크 고정. 가운데 한 칸에 로고와 폼.
 */
import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { AlertTriangle, ArrowRight } from 'lucide-react';
import { notify } from '../../common';
import BrandLogo from '../../common/brand/BrandLogo';
import { BRAND } from '../../common/brand/brand';
import useAuthStore from '../../store/authStore';

const EMAIL = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$/i;
const FIELD = 'w-full h-12 box-border px-3.5 rounded-sm bg-[#111113] text-[#F2F2F0] text-[15px] outline-none border placeholder:text-[#6E7078] focus:border-[#06B6D4] focus:shadow-[0_0_0_3px_rgba(6,182,212,0.28)]';

function Field({ id, label, error, children }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label htmlFor={id} className="text-[13px] font-medium text-[#C9CBD2]">{label}</label>
      {children}
      {error && <span className="text-xs text-[#FF7A85]">{error.message}</span>}
    </div>
  );
}

const border = (err) => (err ? 'border-[#F04452]' : 'border-[#2E2F36]');

export default function Register() {
  const navigate = useNavigate();
  const { register: registerUser, isAuthenticated, isInitializing, isLoading, error, clearError } = useAuthStore();
  const { register, handleSubmit, watch, formState: { errors } } = useForm();
  const password = watch('password');

  useEffect(() => {
    if (!isInitializing && isAuthenticated) navigate('/');
  }, [isAuthenticated, isInitializing, navigate]);

  useEffect(() => () => clearError(), [clearError]);

  const onSubmit = async (data) => {
    const result = await registerUser(data.email, data.username, data.password, data.full_name);
    if (result.success) {
      notify.success('회원가입 성공! 환영합니다.');
      navigate('/');
    }
  };

  return (
    <div className="mp-auth min-h-screen bg-[#0A0A0B] text-[#F2F2F0] text-sm flex flex-col items-center justify-center gap-10 px-4 py-12" style={{ fontFamily: "Inter, 'Noto Sans KR', system-ui, sans-serif" }}>
      <div className="w-full max-w-[380px] flex">
        <Link to="/login" aria-label="MarketPulse 로그인으로" className="flex no-underline"><BrandLogo size="auth" tone="dark" /></Link>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="w-full max-w-[380px] flex flex-col gap-5">
        <div className="flex flex-col gap-2.5">
          <span className="text-[11px] font-semibold tracking-[0.18em] text-[#8A8C95]">SIGN UP</span>
          <h2 className="m-0 text-[28px] font-bold tracking-[-0.6px]">회원가입</h2>
          <p className="m-0 text-sm text-[#A3A5AD]">계정을 만들면 대시보드와 위젯 배치가 저장돼요</p>
        </div>

        {error && (
          <div role="alert" className="flex gap-2.5 items-start px-3.5 py-3 rounded-sm bg-[#2A1417] border border-[#5A2229] text-[#FF9AA2] text-[13px] leading-normal">
            <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" aria-hidden="true" />
            {error}
          </div>
        )}

        <Field id="rg-email" label="이메일" error={errors.email}>
          <input id="rg-email" type="email" autoComplete="email" placeholder="example@email.com" aria-invalid={!!errors.email}
            className={`${FIELD} ${border(errors.email)}`}
            {...register('email', { required: '이메일을 입력해주세요.', pattern: { value: EMAIL, message: '올바른 이메일 형식이 아닙니다.' } })} />
        </Field>
        <Field id="rg-username" label="사용자명" error={errors.username}>
          <input id="rg-username" type="text" autoComplete="username" placeholder="3자 이상" aria-invalid={!!errors.username}
            className={`${FIELD} ${border(errors.username)}`}
            {...register('username', { required: '사용자명을 입력해주세요.', minLength: { value: 3, message: '사용자명은 최소 3자 이상이어야 합니다.' } })} />
        </Field>
        <Field id="rg-name" label="이름 (선택)">
          <input id="rg-name" type="text" autoComplete="name" placeholder="홍길동" className={`${FIELD} ${border(false)}`} {...register('full_name')} />
        </Field>
        <Field id="rg-pw" label="비밀번호" error={errors.password}>
          <input id="rg-pw" type="password" autoComplete="new-password" placeholder="6자 이상" aria-invalid={!!errors.password}
            className={`${FIELD} ${border(errors.password)}`}
            {...register('password', { required: '비밀번호를 입력해주세요.', minLength: { value: 6, message: '비밀번호는 최소 6자 이상이어야 합니다.' } })} />
        </Field>
        <Field id="rg-pw2" label="비밀번호 확인" error={errors.password_confirm}>
          <input id="rg-pw2" type="password" autoComplete="new-password" placeholder="한 번 더" aria-invalid={!!errors.password_confirm}
            className={`${FIELD} ${border(errors.password_confirm)}`}
            {...register('password_confirm', {
              required: '비밀번호 확인을 입력해주세요.',
              validate: (value) => value === password || '비밀번호가 일치하지 않습니다.',
            })} />
        </Field>

        <button
          type="submit" disabled={isLoading}
          className="w-full h-12 rounded-sm text-[15px] font-bold flex items-center justify-center gap-2.5 hover:brightness-110 disabled:opacity-60 disabled:hover:brightness-100"
          style={{ background: BRAND.signalColor, color: '#0E0F12' }}
        >
          {isLoading ? '가입 중…' : '회원가입'}
          <ArrowRight size={16} strokeWidth={2.2} aria-hidden="true" />
        </button>

        <p className="m-0 text-center text-[13px] text-[#A3A5AD]">
          이미 계정이 있으신가요? <Link to="/login" className="font-semibold no-underline text-[#06B6D4] hover:text-white">로그인</Link>
        </p>
      </form>

      <span className="text-[11px] font-semibold tracking-[0.08em] text-[#8A8C95]">© 2026 MARKETPULSE</span>
    </div>
  );
}
