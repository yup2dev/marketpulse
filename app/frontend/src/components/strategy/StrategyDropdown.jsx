import { useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';

const StrategyDropdown = ({ strategies, currentId, onLoad, onDelete }) => {
  const [open, setOpen] = useState(false);
  const active = strategies.find(s => s.id === currentId);

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded border text-[11px] font-medium transition-colors ${
          active
            ? 'bg-cyan-900/30 border-cyan-700/50 text-white'
            : 'bg-gray-800/40 border-gray-700/40 text-gray-400 hover:text-white hover:border-gray-600'
        }`}
      >
        <span className="max-w-[140px] truncate">{active ? active.name : '전략 선택…'}</span>
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <>
          <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
          <div className="absolute top-full left-0 mt-1 z-20 bg-[#0d0d12] border border-gray-700 rounded-lg shadow-xl overflow-hidden min-w-[220px]">
            {strategies.length === 0 ? (
              <div className="px-3 py-4 text-[11px] text-gray-600 italic text-center">저장된 전략 없음</div>
            ) : (
              strategies.map(s => (
                <div
                  key={s.id}
                  className={`flex items-center gap-2 px-3 py-2 cursor-pointer transition-colors group ${
                    s.id === currentId
                      ? 'bg-cyan-900/20 text-white'
                      : 'text-gray-300 hover:bg-gray-800'
                  }`}
                  onClick={() => { onLoad(s); setOpen(false); }}
                >
                  <span className="flex-1 text-[11px] truncate">{s.name}</span>
                  <button
                    onClick={e => { e.stopPropagation(); onDelete(s.id); setOpen(false); }}
                    className="p-0.5 text-gray-700 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                    title="삭제"
                  >
                    <Trash2 size={11} />
                  </button>
                </div>
              ))
            )}
          </div>
        </>
      )}
    </div>
  );
};

export default StrategyDropdown;
