/**
 * WorkspaceBar — thin 32px bar below the header.
 * Shows current workspace, workspace switcher dropdown, New, Save buttons.
 */
import { useState, useRef, useEffect } from 'react';
import { ChevronDown, Plus, Save, Star, Trash2 } from 'lucide-react';
import useWorkspace from '../../hooks/useWorkspace';

export default function WorkspaceBar({ screen }) {
  const {
    workspace, workspaces, isDirty, isLoading,
    saveLayout, createWorkspace, deleteWorkspace,
    setActive, setDefault,
  } = useWorkspace(screen);

  const [dropdownOpen, setDropdownOpen]   = useState(false);
  const [newNameInput, setNewNameInput]   = useState('');
  const [showNewInput, setShowNewInput]   = useState(false);
  const [saving, setSaving]               = useState(false);
  const inputRef = useRef(null);

  useEffect(() => {
    if (showNewInput) inputRef.current?.focus();
  }, [showNewInput]);

  const handleSave = async () => {
    setSaving(true);
    // DashboardGrid will call saveLayout via markDirty → trigger here reads current layout
    // For now, just call saveLayout with empty arrays (DashboardGrid passes its own layout)
    await saveLayout(workspace?.layout || [], workspace?.widgets || []);
    setSaving(false);
  };

  const handleCreate = async () => {
    const name = newNameInput.trim();
    if (!name) return;
    await createWorkspace(name);
    setNewNameInput('');
    setShowNewInput(false);
    setDropdownOpen(false);
  };

  if (!screen || isLoading && !workspace) {
    return (
      <div className="h-8 bg-[#0d0d12] border-b border-gray-800/50 flex items-center px-4">
        <div className="h-3 w-32 bg-gray-800 rounded animate-pulse" />
      </div>
    );
  }

  return (
    <div className="h-8 bg-[#0d0d12] border-b border-gray-800/50 flex items-center px-4 gap-2 z-40">
      {/* Workspace selector */}
      <div className="relative">
        <button
          onClick={() => setDropdownOpen(o => !o)}
          className="flex items-center gap-1.5 px-2 py-0.5 rounded text-xs text-gray-300 hover:text-white hover:bg-gray-800 transition-colors"
        >
          {workspace?.is_default && <Star size={10} className="text-yellow-500 fill-yellow-500" />}
          <span className="font-medium max-w-[160px] truncate">{workspace?.name || 'Default'}</span>
          <ChevronDown size={12} className="text-gray-500" />
        </button>

        {dropdownOpen && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
            <div className="absolute top-full left-0 mt-1 bg-[#0d0d12] border border-gray-700 rounded-lg shadow-xl min-w-[200px] z-50 py-1">
              {workspaces.map(ws => (
                <div
                  key={ws.id}
                  className={`flex items-center gap-2 px-3 py-1.5 cursor-pointer hover:bg-gray-800 transition-colors group ${
                    ws.id === workspace?.id ? 'text-cyan-400' : 'text-gray-300'
                  }`}
                  onClick={() => { setActive(ws.id); setDropdownOpen(false); }}
                >
                  {ws.is_default && <Star size={10} className="text-yellow-500 fill-yellow-500 flex-shrink-0" />}
                  <span className="text-xs flex-1 truncate">{ws.name}</span>
                  {/* Actions — only shown on hover, not for the active workspace */}
                  {ws.id !== workspace?.id && (
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100">
                      <button
                        onClick={(e) => { e.stopPropagation(); setDefault(ws.id); }}
                        title="Set as default"
                        className="p-0.5 hover:text-yellow-400"
                      >
                        <Star size={10} />
                      </button>
                      <button
                        onClick={(e) => { e.stopPropagation(); deleteWorkspace(ws.id); setDropdownOpen(false); }}
                        title="Delete"
                        className="p-0.5 hover:text-red-400"
                      >
                        <Trash2 size={10} />
                      </button>
                    </div>
                  )}
                </div>
              ))}

              <div className="border-t border-gray-800 mt-1 pt-1">
                {showNewInput ? (
                  <div className="flex items-center gap-1 px-3 py-1">
                    <input
                      ref={inputRef}
                      value={newNameInput}
                      onChange={e => setNewNameInput(e.target.value)}
                      onKeyDown={e => {
                        if (e.key === 'Enter') handleCreate();
                        if (e.key === 'Escape') { setShowNewInput(false); setNewNameInput(''); }
                      }}
                      placeholder="Workspace name…"
                      className="flex-1 bg-gray-800 text-white text-xs px-2 py-1 rounded outline-none border border-gray-600 focus:border-cyan-500"
                    />
                    <button
                      onClick={handleCreate}
                      className="text-xs text-cyan-400 hover:text-cyan-300 px-1"
                    >
                      Add
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowNewInput(true)}
                    className="w-full flex items-center gap-1.5 px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                  >
                    <Plus size={12} />
                    New workspace
                  </button>
                )}
              </div>
            </div>
          </>
        )}
      </div>

      {/* New workspace quick button */}
      {!showNewInput && (
        <button
          onClick={() => { setDropdownOpen(true); setShowNewInput(true); }}
          className="flex items-center gap-1 px-1.5 py-0.5 rounded text-xs text-gray-500 hover:text-gray-300 hover:bg-gray-800 transition-colors"
          title="New workspace"
        >
          <Plus size={12} />
        </button>
      )}

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving || !isDirty}
        className={`flex items-center gap-1 px-2 py-0.5 rounded text-xs transition-colors ${
          isDirty
            ? 'text-cyan-400 hover:text-cyan-300 hover:bg-gray-800'
            : 'text-gray-600 cursor-default'
        }`}
        title="Save layout"
      >
        <Save size={12} />
        {isDirty && <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 inline-block" />}
      </button>
    </div>
  );
}
