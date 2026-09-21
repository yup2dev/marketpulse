import { X } from 'lucide-react';

/**
 * 차트 헤더 드롭다운의 공통 껍데기 — 위치·테두리·제목·닫기 버튼.
 *
 * 드롭다운 3종(차트 타입/매크로 지표/기술 지표)이 같은 컨테이너와 헤더를 각자
 * 복사해 쓰고 있어서 하나로 모았다. 배경색은 테마 토큰이 hex 값이라 클래스가 아닌
 * 인라인 style 로만 지정한다.
 */
const DropdownShell = ({ title, onClose, tokens, className = '', stickyHeader = false, subtitle, children }) => (
  <div
    className={`absolute top-14 right-4 z-50 border border-gray-700 rounded-lg shadow-2xl py-2 ${className}`}
    style={{ backgroundColor: tokens.bg.tertiary }}
  >
    <div
      className={`px-3 py-2 border-b border-gray-800${stickyHeader ? ' sticky top-0' : ''}`}
      style={stickyHeader ? { backgroundColor: tokens.bg.tertiary } : undefined}
    >
      <div className="flex items-center justify-between">
        <div className="text-sm font-semibold text-white">{title}</div>
        <button onClick={onClose} className="text-gray-400 hover:text-white">
          <X size={14} />
        </button>
      </div>
      {subtitle && <div className="text-xs text-gray-500 mt-1">{subtitle}</div>}
    </div>
    {children}
  </div>
);

export default DropdownShell;
