/**
 * AddTransactionModal
 * - Add 모드: 종목·날짜 입력 시 해당일 시가/종가/고가/저가 자동 조회
 * - Edit 모드: 기존 거래 데이터 불러와 수정, 수정 후 가격 재조회 가능
 */
import { useState, useEffect, useRef } from 'react';
import { X, TrendingUp, TrendingDown, DollarSign, Loader2, Zap, Pencil } from 'lucide-react';
import SymbolAutocomplete from '../common/SymbolAutocomplete';
import { portfolioAPI } from '../../config/api';

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

const Input = (props) => (
  <input
    {...props}
    className={`w-full bg-gray-800 border border-gray-700 rounded px-3 py-2 text-sm text-white placeholder-gray-500 focus:outline-none focus:border-cyan-500 transition-colors ${props.className || ''}`}
  />
);

const fmt = (v) => v != null
  ? new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 2 }).format(v)
  : '—';

// Convert ISO datetime string to local datetime-local input value
const toDatetimeLocal = (iso) => {
  if (!iso) return new Date().toISOString().slice(0, 16);
  try {
    return new Date(iso).toISOString().slice(0, 16);
  } catch {
    return iso.slice(0, 16);
  }
};

export default function AddTransactionModal({
  onClose,
  onAdd,
  onEdit,             // called in edit mode with (transactionId, data)
  initialValues,      // existing transaction object for edit mode
  isEditing = false,
}) {
  const initForm = () => ({
    transaction_type: initialValues?.transaction_type ?? 'buy',
    ticker_cd:        initialValues?.ticker_cd        ?? '',
    quantity:         initialValues?.quantity != null  ? String(initialValues.quantity) : '',
    price:            initialValues?.price != null     ? String(initialValues.price)    : '',
    commission:       initialValues?.commission != null ? String(initialValues.commission) : '',
    tax:              initialValues?.tax != null        ? String(initialValues.tax)       : '',
    transaction_date: toDatetimeLocal(initialValues?.transaction_date),
    notes:            initialValues?.notes ?? '',
  });

  const [form, setForm] = useState(initForm);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ─── Price auto-fetch state ────────────────────────────────────────────────
  const [fetchedQuote, setFetchedQuote] = useState(null);
  const [isFetchingPrice, setIsFetchingPrice] = useState(false);
  const [fetchError, setFetchError] = useState(null);
  const [priceSource, setPriceSource] = useState(null);   // 'open'|'high'|'low'|'close'|null
  const debounceRef = useRef(null);

  const upd = (key, val) => setForm((prev) => ({ ...prev, [key]: val }));

  // ─── Auto-fetch when ticker + date change (debounced) ─────────────────────
  useEffect(() => {
    const ticker = form.ticker_cd.trim().toUpperCase();
    const date   = form.transaction_date.slice(0, 10);

    if (!ticker || !date || form.transaction_type === 'dividend') {
      setFetchedQuote(null);
      setFetchError(null);
      return;
    }

    clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(async () => {
      setIsFetchingPrice(true);
      setFetchError(null);
      try {
        const quote = await portfolioAPI.getPriceAtDate(ticker, date);
        setFetchedQuote(quote);
        // Auto-fill close price only when price field is empty (add mode or user cleared it)
        if (!form.price && quote.close != null) {
          upd('price', String(quote.close));
          setPriceSource('close');
        }
      } catch (e) {
        setFetchedQuote(null);
        setFetchError(e.detail || '가격 조회 실패');
      } finally {
        setIsFetchingPrice(false);
      }
    }, 700);

    return () => clearTimeout(debounceRef.current);
  }, [form.ticker_cd, form.transaction_date.slice(0, 10), form.transaction_type]);

  const applyPrice = (source) => {
    if (!fetchedQuote) return;
    const prices = { open: fetchedQuote.open, high: fetchedQuote.high, low: fetchedQuote.low, close: fetchedQuote.close };
    upd('price', prices[source] != null ? String(prices[source]) : '');
    setPriceSource(source);
  };

  // ─── Total preview ─────────────────────────────────────────────────────────
  const computeTotal = () => {
    const qty   = parseFloat(form.quantity)   || 0;
    const price = parseFloat(form.price)      || 0;
    const comm  = parseFloat(form.commission) || 0;
    const tax   = parseFloat(form.tax)        || 0;
    if (!qty || !price) return null;
    if (form.transaction_type === 'buy')  return qty * price + comm + tax;
    if (form.transaction_type === 'sell') return qty * price - comm - tax;
    return qty * price;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.ticker_cd.trim() || !form.quantity || !form.price) return;
    setIsSubmitting(true);
    const payload = {
      ticker_cd:        form.ticker_cd.toUpperCase().trim(),
      transaction_type: form.transaction_type,
      quantity:         parseFloat(form.quantity),
      price:            parseFloat(form.price),
      commission:       parseFloat(form.commission) || 0,
      tax:              parseFloat(form.tax)        || 0,
      transaction_date: new Date(form.transaction_date).toISOString(),
      notes:            form.notes || null,
    };
    try {
      if (isEditing && onEdit) {
        await onEdit(initialValues.transaction_id, payload);
      } else {
        await onAdd(payload);
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const total = computeTotal();
  const priceLabels = { open: '시가', high: '고가', low: '저가', close: '종가' };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm" onClick={onClose}>
      <div
        className="bg-[#0d0d12] border border-gray-700 rounded-lg w-full max-w-md mx-4 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800">
          <div className="flex items-center gap-2">
            {isEditing && <Pencil size={13} className="text-yellow-400" />}
            <h2 className="text-sm font-semibold text-white">
              {isEditing ? 'Edit Transaction' : 'Add Transaction'}
            </h2>
          </div>
          <button onClick={onClose} className="p-1 text-gray-500 hover:text-white rounded transition-colors">
            <X size={16} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-3">

          {/* Transaction type */}
          <Field label="Type">
            <div className="grid grid-cols-3 gap-2">
              {TYPE_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = form.transaction_type === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => { upd('transaction_type', opt.id); setFetchedQuote(null); setPriceSource(null); }}
                    className={`flex items-center justify-center gap-1.5 py-2 rounded border text-xs font-medium transition-colors ${
                      active ? `${opt.activeBg} ${opt.color}` : 'border-gray-700 text-gray-400 hover:border-gray-600'
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
              onChange={(sym) => { upd('ticker_cd', sym); setFetchedQuote(null); setPriceSource(null); }}
              placeholder="AAPL"
              required
            />
          </Field>

          {/* Date */}
          <Field label="Date & Time *">
            <Input
              type="datetime-local"
              value={form.transaction_date}
              onChange={(e) => { upd('transaction_date', e.target.value); setPriceSource(null); }}
              required
              style={{ colorScheme: 'dark' }}
            />
          </Field>

          {/* ── Price lookup panel (buy/sell only) ────────────────────────── */}
          {form.transaction_type !== 'dividend' && (
            <div className="rounded-lg border border-gray-700/60 bg-gray-900/40 p-3 space-y-2">
              <div className="flex items-center gap-2">
                <Zap size={11} className="text-cyan-500 flex-shrink-0" />
                <span className="text-[11px] text-gray-400">
                  {isFetchingPrice
                    ? '가격 조회 중...'
                    : fetchedQuote
                    ? `${fetchedQuote.date} 기준 가격 — 클릭하여 적용`
                    : '종목·날짜를 입력하면 가격이 자동 조회됩니다'}
                </span>
                {isFetchingPrice && <Loader2 size={11} className="animate-spin text-cyan-500 flex-shrink-0" />}
              </div>

              {fetchError && (
                <p className="text-[11px] text-yellow-600">{fetchError} — 수동 입력해 주세요</p>
              )}

              {fetchedQuote && (
                <div className="grid grid-cols-4 gap-1.5">
                  {(['open', 'high', 'low', 'close']).map((k) => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => applyPrice(k)}
                      className={`flex flex-col items-center py-1.5 px-1 rounded border text-center transition-colors ${
                        priceSource === k
                          ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-300'
                          : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-gray-200'
                      }`}
                    >
                      <span className="text-[10px] text-gray-500 mb-0.5">{priceLabels[k]}</span>
                      <span className="text-[11px] font-medium tabular-nums">
                        {fetchedQuote[k] != null ? `$${fetchedQuote[k].toFixed(2)}` : '—'}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

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
            <Field label={
              form.transaction_type === 'dividend'
                ? 'Per-Share Dividend *'
                : priceSource ? `Price (${priceLabels[priceSource]}) *` : 'Price (USD) *'
            }>
              <div className="relative">
                <Input
                  type="number" step="any" min="0"
                  value={form.price}
                  onChange={(e) => { upd('price', e.target.value); setPriceSource(null); }}
                  placeholder="150.00"
                  required
                  className={priceSource ? 'border-cyan-700/50 pr-14' : ''}
                />
                {priceSource && (
                  <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] px-1.5 py-0.5 bg-cyan-900/60 text-cyan-400 rounded pointer-events-none">
                    auto
                  </span>
                )}
              </div>
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

          {/* Notes */}
          <Field label="Notes">
            <Input type="text" value={form.notes} onChange={(e) => upd('notes', e.target.value)} placeholder="Optional note..." />
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
              disabled={isSubmitting || !form.ticker_cd || !form.quantity || !form.price}
              className={`flex-1 py-2 text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed rounded transition-colors ${
                isEditing
                  ? 'bg-yellow-600 hover:bg-yellow-500'
                  : 'bg-cyan-600 hover:bg-cyan-500'
              }`}
            >
              {isSubmitting
                ? isEditing ? 'Saving...' : 'Adding...'
                : isEditing ? 'Save Changes' : 'Add Transaction'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
