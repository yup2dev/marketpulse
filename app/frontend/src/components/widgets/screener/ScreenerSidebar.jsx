import { Plus, Trash2 } from 'lucide-react';

export default function Sidebar({ presets, saved, activeId, onSelectPreset, onSelectSaved, onDeleteSaved, onNewScreen }) {
  return (
    <div className="flex flex-col w-52 flex-shrink-0 border-r border-gray-800/60 overflow-y-auto">
      {/* 내가 만든 */}
      <div className="px-2 pt-3 pb-2">
        <div className="px-1 mb-2 text-[10px] uppercase tracking-widest text-gray-600 font-semibold">내가 만든</div>
        <button onClick={onNewScreen}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-cyan-400
            border border-dashed border-cyan-800/50 hover:bg-cyan-500/5 hover:border-cyan-600/60 transition-colors">
          <Plus size={12} />
          직접 만들기
        </button>
        <div className="mt-1 space-y-0.5">
          {saved.map((s) => (
            <SidebarItem key={s.screener_id} label={s.name}
              active={activeId === s.screener_id}
              onClick={() => onSelectSaved(s)}
              onDelete={() => onDeleteSaved(s.screener_id)} />
          ))}
        </div>
      </div>

      <div className="mx-3 my-1 border-t border-gray-800/60" />

      {/* 프리셋 */}
      <div className="px-2 pb-3">
        <div className="px-1 mb-2 text-[10px] uppercase tracking-widest text-gray-600 font-semibold">프리셋</div>
        <div className="space-y-0.5">
          {presets.map((p) => (
            <PresetSidebarItem key={p.preset_id} preset={p}
              active={activeId === p.preset_id}
              onClick={() => onSelectPreset(p)} />
          ))}
          {!presets.length && <p className="text-[10px] text-gray-700 px-2 py-2">프리셋 없음</p>}
        </div>
      </div>
    </div>
  );
}

function SidebarItem({ label, active, onClick, onDelete, badge }) {
  return (
    <div onClick={onClick}
      className={`group flex items-center gap-1 px-2 py-2 rounded-lg cursor-pointer transition-colors ${
        active ? 'bg-cyan-500/10 border border-cyan-500/15' : 'border border-transparent hover:bg-white/5'
      }`}>
      <div className="flex-1 min-w-0">
        <span className={`text-xs font-medium truncate flex items-center gap-1.5 ${active ? 'text-white' : 'text-gray-400'}`}>
          {label}
          {badge && (
            <span className="text-[9px] px-1 py-0.5 rounded bg-orange-500/20 text-orange-400 font-semibold">{badge}</span>
          )}
        </span>
      </div>
      {onDelete && (
        <button onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="p-0.5 text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0">
          <Trash2 size={10} />
        </button>
      )}
    </div>
  );
}

// ── PresetSidebarItem (설명 포함 카드형) ──────────────────────────────────────

function PresetSidebarItem({ preset, active, onClick }) {
  return (
    <div
      onClick={onClick}
      className={`px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
        active
          ? 'bg-cyan-500/10 border border-cyan-500/15'
          : 'border border-transparent hover:bg-white/5'
      }`}
    >
      <div className="flex items-center gap-1.5 min-w-0">
        <span className={`text-xs font-medium truncate flex-1 ${active ? 'text-white' : 'text-gray-300'}`}>
          {preset.name}
        </span>
        {preset.is_hot && (
          <span className="text-[9px] px-1 py-0.5 rounded bg-orange-500/20 text-orange-400 font-semibold flex-shrink-0">
            HOT
          </span>
        )}
      </div>
      {preset.description && (
        <p className="text-[10px] text-gray-600 mt-0.5 leading-snug overflow-hidden"
           style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
          {preset.description}
        </p>
      )}
    </div>
  );
}
