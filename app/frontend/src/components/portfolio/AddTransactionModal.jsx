/**
 * AddTransactionModal - Add buy/sell/dividend transaction (dark theme)
 */
import { useState } from 'react';
import { X, TrendingUp, TrendingDown, DollarSign } from 'lucide-react';
import SymbolAutocomplete from '../common/SymbolAutocomplete';

const TYPE_OPTIONS = [
  { id: 'buy',      label: 'Buy',      icon: TrendingUp,   color: 'text-green-400', activeBg: 'bg-green-500/20 border-green-500/50' },
  { id: 'sell',     label: 'Sell',     icon: TrendingDown, color: 'text-red-400',   activeBg: 'bg-red-500/20 border-red-500/50' },
  { id: 'dividend', label: 'Dividend', icon: DollarSign,   color: 'text-cyan-400',  activeBg: 'bg-cyan-500/20 border-cyan-500/50' },
];

const Field = ({ label, children }) => (
  <div>
    <label className="block text-xs text-gray-400 mb-1">{label}</label>
    {children}
  </div>
);

const Input = ({ ...props }) => (
  <input
    {...props}
    className="w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors"
  />
);

export default function AddTransactionModal({ onClose, onAdd }) {
  const [form, setForm] = useState({
    transaction_type: 'buy',
    ticker_cd: '',
    quantity: '',
    price: '',
    commission: '',
    tax: '',
    transaction_date: new Date().toISOString().slice(0, 16),
    notes: '',
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const upd = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  const computeTotal = () => {
    const qty = parseFloat(form.quantity) || 0;
    const price = parseFloat(form.price) || 0;
    const comm = parseFloat(form.commission) || 0;
    const tax = parseFloat(form.tax) || 0;
    if (!qty || !price) return null;
    if (form.transaction_type === 'buy')  return qty * price + comm + tax;
    if (form.transaction_type === 'sell') return qty * price - comm - tax;
    return qty * price;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.ticker_cd.trim() || !form.quantity || !form.price) return;
    setIsSubmitting(true);
    try {
      await onAdd({
        ticker_cd:        form.ticker_cd.toUpperCase().trim(),
        transaction_type: form.transaction_type,
        quantity:         parseFloat(form.quantity),
        price:            parseFloat(form.price),
        commission:       parseFloat(form.commission) || 0,
        tax:              parseFloat(form.tax) || 0,
        transaction_date: new Date(form.transaction_date).toISOString(),
        notes:            form.notes || null,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const total = computeTotal();
  const fmt = (v) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#0d0d12] border border-gray-700 rounded-lg w-full max-w-md mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <h2 className="text-sm font-semibold text-white">Add Transaction</h2>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-white rounded transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">

          {/* Transaction type selector */}
          <Field label="Type">
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = form.transaction_type === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => upd('transaction_type', opt.id)}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded border text-xs font-medium transition-colors ${
                      active ? opt.activeBg + ' ' + opt.color : 'border-gray-700 text-gray-400 hover:border-gray-600 hover:text-gray-300'
                    }`}
                  >
                    <Icon size={12} />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </Field>

          {/* Symbol */}
          <Field label="Symbol *">
            <SymbolAutocomplete
              value={form.ticker_cd}
              onChange={(sym) => upd('ticker_cd', sym)}
              placeholder="AAPL"
              required
            />
          </Field>

          {/* Qty + Price */}
          <div className="grid grid-cols-2 gap-3">
            <Field label="Quantity *">
              <Input
                type="number" step="any" min="0"
                value={form.quantity}
                onChange={(e) => upd('quantity', e.target.value)}
                placeholder="100"
                required
              />
            </Field>
            <Field label={form.transaction_type === 'dividend' ? 'Per-Share Dividend *' : 'Price (USD) *'}>
              <Input
                type="number" step="any" min="0"
                value={form.price}
                onChange={(e) => upd('price', e.target.value)}
                placeholder="150.00"
                required
              />
            </Field>
          </div>

          {/* Commission + Tax */}
          {form.transaction_type !== 'dividend' && (
            <div className="grid grid-cols-2 gap-3">
              <Field label="Commission">
                <Input type="number" step="any" min="0" value={form.commission} onChange={(e) => upd('commission', e.target.value)} placeholder="0.00" />
              </Field>
              <Field label="Tax">
                <Input type="number" step="any" min="0" value={form.tax} onChange={(e) => upd('tax', e.target.value)} placeholder="0.00" />
              </Field>
            </div>
          )}

          {/* Date */}
          <Field label="Date & Time *">
            <Input
              type="datetime-local"
              value={form.transaction_date}
              onChange={(e) => upd('transaction_date', e.target.value)}
              required
              style={{ colorScheme: 'dark' }}
            />
          </Field>

          {/* Notes */}
          <Field label="Notes">
            <Input
              type="text"
              value={form.notes}
              onChange={(e) => upd('notes', e.target.value)}
              placeholder="Optional note..."
            />
          </Field>

          {/* Total preview */}
          {total !== null && (
            <div className="flex items-center justify-between bg-gray-800/60 rounded px-3 py-2">
              <span className="text-xs text-gray-400">Estimated Total</span>
              <span className={`text-sm font-semibold tabular-nums ${form.transaction_type === 'buy' ? 'text-red-400' : 'text-green-400'}`}>
                {form.transaction_type === 'buy' ? '-' : '+'}{fmt(total)}
              </span>
            </div>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2 text-sm text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 rounded transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex-1 py-2 text-sm font-medium text-white bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors"
            >
              {isSubmitting ? 'Adding...' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
