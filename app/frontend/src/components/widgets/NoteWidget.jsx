import { useState, useEffect, useCallback, useRef } from 'react';
import { Plus, Pin, Trash2, Save, X, StickyNote } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import { notesAPI } from '../../config/api';

const COLOR_MAP = {
  default: 'border-gray-800',
  blue:    'border-blue-800',
  green:   'border-green-800',
  yellow:  'border-yellow-800',
  red:     'border-red-800',
  purple:  'border-purple-800',
};

const COLORS = Object.keys(COLOR_MAP);

export default function NoteWidget({ onRemove }) {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);

  const fetchNotes = useCallback(async () => {
    try {
      const res = await notesAPI.getAll();
      setNotes(res.data || []);
    } catch { /* silent */ }
    setLoading(false);
  }, []);

  useEffect(() => { fetchNotes(); }, [fetchNotes]);

  const createNote = async () => {
    try {
      const res = await notesAPI.create({ title: '', content: '', color: 'default' });
      if (res.data) {
        setNotes((prev) => [res.data, ...prev]);
        setEditing(res.data.note_id);
      }
    } catch { /* silent */ }
  };

  const updateNote = async (id, updates) => {
    try {
      const res = await notesAPI.update(id, updates);
      if (res.data) {
        setNotes((prev) => prev.map((n) => (n.note_id === id ? res.data : n)));
      }
    } catch { /* silent */ }
  };

  const deleteNote = async (id) => {
    try {
      await notesAPI.delete(id);
      setNotes((prev) => prev.filter((n) => n.note_id !== id));
      if (editing === id) setEditing(null);
    } catch { /* silent */ }
  };

  const togglePin = async (note) => {
    await updateNote(note.note_id, { pinned: !note.pinned });
  };

  return (
    <BaseWidget
      title="Notes"
      icon={StickyNote}
      loading={loading}
      onRefresh={fetchNotes}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
    >
      <div className="flex flex-col h-full min-h-0">
        <div className="flex items-center justify-between px-3 pt-2 pb-1 flex-shrink-0">
          <span className="text-[10px] text-gray-500">{notes.length} notes</span>
          <button
            onClick={createNote}
            className="text-[10px] flex items-center gap-1 text-cyan-400 hover:text-cyan-300"
          >
            <Plus size={12} /> New
          </button>
        </div>

        <div className="flex-1 overflow-auto px-2 pb-2 space-y-1.5">
          {notes.length === 0 ? (
            <div className="text-center text-gray-600 text-[11px] py-8">
              No notes yet. Click "New" to create one.
            </div>
          ) : (
            notes.map((note) =>
              editing === note.note_id ? (
                <NoteEditor
                  key={note.note_id}
                  note={note}
                  onSave={(updates) => {
                    updateNote(note.note_id, updates);
                    setEditing(null);
                  }}
                  onCancel={() => setEditing(null)}
                  onDelete={() => deleteNote(note.note_id)}
                />
              ) : (
                <NoteCard
                  key={note.note_id}
                  note={note}
                  onEdit={() => setEditing(note.note_id)}
                  onPin={() => togglePin(note)}
                  onDelete={() => deleteNote(note.note_id)}
                />
              )
            )
          )}
        </div>
      </div>
    </BaseWidget>
  );
}

function NoteCard({ note, onEdit, onPin, onDelete }) {
  const borderCls = COLOR_MAP[note.color] || COLOR_MAP.default;
  return (
    <div
      onClick={onEdit}
      className={`bg-[#0a0a0f] border-l-2 ${borderCls} rounded p-2.5 cursor-pointer hover:bg-gray-800/30 transition-colors group relative`}
    >
      {note.pinned && (
        <Pin size={10} className="absolute top-2 right-2 text-cyan-500" />
      )}
      <div className="flex items-center gap-2">
        {note.title && (
          <div className="text-[11px] font-semibold text-white truncate">{note.title}</div>
        )}
        {note.ticker_cd && (
          <span className="text-[9px] px-1 py-0.5 bg-gray-800 rounded text-cyan-400 font-mono">{note.ticker_cd}</span>
        )}
      </div>
      {note.content && (
        <div className="text-[10px] text-gray-400 mt-1 line-clamp-2 whitespace-pre-wrap">{note.content}</div>
      )}
      <div className="flex items-center justify-between mt-1.5">
        <span className="text-[9px] text-gray-600">
          {note.updated_at ? new Date(note.updated_at).toLocaleDateString() : ''}
        </span>
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button onClick={(e) => { e.stopPropagation(); onPin(); }} className="text-gray-600 hover:text-cyan-400">
            <Pin size={10} />
          </button>
          <button onClick={(e) => { e.stopPropagation(); onDelete(); }} className="text-gray-600 hover:text-red-400">
            <Trash2 size={10} />
          </button>
        </div>
      </div>
    </div>
  );
}

function NoteEditor({ note, onSave, onCancel, onDelete }) {
  const [title, setTitle] = useState(note.title || '');
  const [content, setContent] = useState(note.content || '');
  const [ticker, setTicker] = useState(note.ticker_cd || '');
  const [color, setColor] = useState(note.color || 'default');
  const contentRef = useRef(null);

  useEffect(() => { contentRef.current?.focus(); }, []);

  const handleSave = () => onSave({ title: title.trim(), content, ticker_cd: ticker.trim() || null, color });

  const inputCls = 'w-full bg-[#0a0a0f] border border-gray-800 rounded px-2 py-1 text-[11px] text-gray-200 outline-none focus:border-cyan-700';

  return (
    <div className="bg-[#0a0a0f] border border-cyan-800/50 rounded p-2.5 space-y-1.5">
      <div className="flex gap-1.5">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Title"
          className={`${inputCls} flex-1`}
        />
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value.toUpperCase())}
          placeholder="TICKER"
          className={`${inputCls} w-[70px] font-mono`}
        />
      </div>
      <textarea
        ref={contentRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        placeholder="Write your note..."
        rows={4}
        className={`${inputCls} resize-none`}
      />
      <div className="flex items-center justify-between">
        <div className="flex gap-1">
          {COLORS.map((c) => (
            <button
              key={c}
              onClick={() => setColor(c)}
              className={`w-4 h-4 rounded-full border-2 ${
                color === c ? 'border-white' : 'border-gray-700'
              }`}
              style={{
                backgroundColor: c === 'default' ? '#374151' : c === 'blue' ? '#1e40af' : c === 'green' ? '#166534' : c === 'yellow' ? '#854d0e' : c === 'red' ? '#991b1b' : '#6b21a8',
              }}
            />
          ))}
        </div>
        <div className="flex gap-1">
          <button onClick={onDelete} className="text-gray-600 hover:text-red-400 p-1">
            <Trash2 size={12} />
          </button>
          <button onClick={onCancel} className="text-gray-500 hover:text-white p-1">
            <X size={12} />
          </button>
          <button onClick={handleSave} className="text-cyan-400 hover:text-cyan-300 p-1">
            <Save size={12} />
          </button>
        </div>
      </div>
    </div>
  );
}
