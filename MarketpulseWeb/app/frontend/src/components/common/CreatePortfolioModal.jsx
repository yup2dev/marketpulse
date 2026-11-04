import { useState } from 'react';
import { X, FolderPlus } from 'lucide-react';

const CURRENCIES = [
  { value: 'USD', label: 'USD — US Dollar' },
  { value: 'KRW', label: 'KRW — Korean Won' },
  { value: 'EUR', label: 'EUR — Euro' },
  { value: 'JPY', label: 'JPY — Japanese Yen' },
  { value: 'GBP', label: 'GBP — British Pound' },
];

const BENCHMARKS = [
  { value: '',    label: 'None' },
  { value: 'SPY', label: 'SPY (S&P 500)' },
  { value: 'QQQ', label: 'QQQ (NASDAQ 100)' },
  { value: 'DIA', label: 'DIA (Dow Jones)' },
  { value: 'IWM', label: 'IWM (Russell 2000)' },
  { value: 'VTI', label: 'VTI (Total Stock Market)' },
];

const inputCls =
  'w-full bg-[#0a0a0f] border border-gray-800 rounded px-3 py-2 text-xs text-gray-200 ' +
  'outline-none focus:border-cyan-700 placeholder-gray-600';

export default function CreatePortfolioModal({ open, onClose, onCreate }) {
  const [name,        setName]        = useState('');
  const [description, setDescription] = useState('');
  const [currency,    setCurrency]    = useState('USD');
  const [benchmark,   setBenchmark]   = useState('');
  const [submitting,  setSubmitting]  = useState(false);
  const [error,       setError]       = useState(null);

  if (!open) return null;

  const reset = () => {
    setName(''); setDescription(''); setCurrency('USD'); setBenchmark('');
    setError(null); setSubmitting(false);
  };

  const close = () => { reset(); onClose?.(); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim() || name.trim().length < 2) {
      setError('Name must be at least 2 characters');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      await onCreate({
        name: name.trim(),
        description: description.trim() || null,
        currency,
        benchmark: benchmark || null,
      });
      reset();
    } catch (err) {
      setError(err?.detail || err?.message || 'Failed to create portfolio');
    } finally {
      setSubmitting(false);
    }
  };

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) close();
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999] p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-[#0d0d12] rounded-lg border border-gray-800 shadow-2xl w-full max-w-md flex flex-col">
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            <FolderPlus size={14} className="text-cyan-400" />
            <h3 className="text-sm font-medium text-white">New Portfolio</h3>
          </div>
          <button
            onClick={close}
            className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
          >
            <X size={14} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">
          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wide text-gray-500">Name *</label>
            <input
              type="text"
              autoFocus
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Growth Stocks"
              className={inputCls}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[10px] uppercase tracking-wide text-gray-500">Description</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Optional notes about this portfolio"
              className={`${inputCls} resize-none`}
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide text-gray-500">Currency *</label>
              <select
                value={currency}
                onChange={(e) => setCurrency(e.target.value)}
                className={inputCls}
              >
                {CURRENCIES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[10px] uppercase tracking-wide text-gray-500">Benchmark</label>
              <select
                value={benchmark}
                onChange={(e) => setBenchmark(e.target.value)}
                className={inputCls}
              >
                {BENCHMARKS.map(b => <option key={b.value} value={b.value}>{b.label}</option>)}
              </select>
            </div>
          </div>

          {error && (
            <div className="text-[11px] text-red-400 bg-red-500/10 border border-red-500/30 rounded px-2 py-1.5">
              {error}
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-gray-800">
            <button
              type="button"
              onClick={close}
              className="px-3 py-1.5 text-xs text-gray-400 hover:text-white hover:bg-gray-800 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-semibold rounded transition-colors"
            >
              <FolderPlus size={11} />
              {submitting ? 'Creating…' : 'Create'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
