/**
 * AlertsWidget — Alert management with create, toggle, history.
 *
 * Features:
 *   - Active alerts list with toggle on/off
 *   - Create new alert form
 *   - Alert trigger history timeline (uses TimelineList)
 */
import { useState, useEffect, useCallback } from 'react';
import { Bell, BellOff, Plus, Trash2, X, History, Zap, AlertTriangle } from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import TimelineList, { Badge, formatTimeAgo } from './common/TimelineList';
import { alertAPI } from '../../config/api';

const ALERT_TYPES = [
  { value: 'price',     label: 'Price' },
  { value: 'technical', label: 'Technical' },
  { value: 'news',      label: 'News' },
];

const CONDITION_TYPES = [
  { value: 'above',          label: 'Above' },
  { value: 'below',          label: 'Below' },
  { value: 'percent_change', label: '% Change' },
];

function CreateAlertForm({ onSubmit, onCancel }) {
  const [form, setForm] = useState({
    alert_type: 'price',
    ticker_cd: '',
    condition_type: 'above',
    threshold_value: '',
    message: '',
  });

  const set = (k, v) => setForm(prev => ({ ...prev, [k]: v }));

  const handleSubmit = () => {
    if (!form.ticker_cd || !form.threshold_value) return;
    onSubmit({
      ...form,
      ticker_cd: form.ticker_cd.toUpperCase(),
      threshold_value: Number(form.threshold_value),
    });
  };

  return (
    <div className="px-3 py-2 border-b border-gray-800 bg-[#0a0a0f] space-y-2">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-medium text-gray-300">New Alert</span>
        <button onClick={onCancel} className="p-0.5 text-gray-500 hover:text-gray-300">
          <X size={12} />
        </button>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div>
          <label className="text-[10px] text-gray-500 block mb-0.5">Type</label>
          <select
            value={form.alert_type}
            onChange={e => set('alert_type', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[11px] text-white outline-none focus:border-cyan-500"
          >
            {ALERT_TYPES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-0.5">Ticker</label>
          <input
            value={form.ticker_cd}
            onChange={e => set('ticker_cd', e.target.value)}
            placeholder="AAPL"
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[11px] text-white outline-none focus:border-cyan-500 uppercase"
          />
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-0.5">Condition</label>
          <select
            value={form.condition_type}
            onChange={e => set('condition_type', e.target.value)}
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[11px] text-white outline-none focus:border-cyan-500"
          >
            {CONDITION_TYPES.map(c => <option key={c.value} value={c.value}>{c.label}</option>)}
          </select>
        </div>
        <div>
          <label className="text-[10px] text-gray-500 block mb-0.5">Threshold</label>
          <input
            type="number"
            value={form.threshold_value}
            onChange={e => set('threshold_value', e.target.value)}
            placeholder="150.00"
            step="0.01"
            className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[11px] text-white outline-none focus:border-cyan-500 tabular-nums"
          />
        </div>
      </div>
      <input
        value={form.message}
        onChange={e => set('message', e.target.value)}
        placeholder="Note (optional)"
        className="w-full bg-gray-800 border border-gray-700 rounded px-2 py-1 text-[11px] text-white outline-none focus:border-cyan-500"
      />
      <button
        onClick={handleSubmit}
        disabled={!form.ticker_cd || !form.threshold_value}
        className="w-full flex items-center justify-center gap-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-xs font-medium rounded transition-colors"
      >
        <Zap size={11} /> Create Alert
      </button>
    </div>
  );
}

function AlertCard({ alert, onToggle, onDelete }) {
  const isActive = alert.is_active;
  const condLabel = CONDITION_TYPES.find(c => c.value === alert.condition_type)?.label || alert.condition_type;

  return (
    <div className={`flex items-center gap-3 px-3 py-2.5 border-b border-gray-800/50 group transition-colors ${
      isActive ? 'hover:bg-gray-800/30' : 'opacity-50 hover:opacity-70'
    }`}>
      <button
        onClick={() => onToggle(alert.alert_id)}
        className={`p-1.5 rounded transition-colors ${
          isActive
            ? 'text-cyan-400 bg-cyan-500/10 hover:bg-cyan-500/20'
            : 'text-gray-600 bg-gray-800 hover:bg-gray-700'
        }`}
        title={isActive ? 'Disable' : 'Enable'}
      >
        {isActive ? <Bell size={12} /> : <BellOff size={12} />}
      </button>

      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-white">{alert.ticker_cd || '—'}</span>
          <Badge type={alert.alert_type === 'price' ? 'info' : alert.alert_type === 'news' ? 'warning' : 'neutral'}>
            {alert.alert_type}
          </Badge>
        </div>
        <div className="text-[10px] text-gray-500 mt-0.5">
          {condLabel} <span className="text-gray-300 tabular-nums font-medium">{alert.threshold_value}</span>
          {alert.message && <span className="ml-2 text-gray-600">— {alert.message}</span>}
        </div>
      </div>

      <div className="text-right flex-shrink-0">
        {alert.trigger_count > 0 && (
          <div className="text-[10px] text-gray-500">
            Triggered <span className="text-gray-300 tabular-nums">{alert.trigger_count}x</span>
          </div>
        )}
        {alert.last_triggered && (
          <div className="text-[9px] text-gray-600">{formatTimeAgo(alert.last_triggered)}</div>
        )}
      </div>

      <button
        onClick={() => onDelete(alert.alert_id)}
        className="p-1 text-gray-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all"
        title="Delete"
      >
        <Trash2 size={11} />
      </button>
    </div>
  );
}

export default function AlertsWidget({ onRemove }) {
  const [alerts, setAlerts] = useState([]);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [tab, setTab] = useState('active'); // 'active' | 'history'

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const res = await alertAPI.getAll();
      setAlerts(res || []);
    } catch {
      setAlerts([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchHistory = useCallback(async () => {
    try {
      const res = await alertAPI.getHistory();
      setHistory(res.history || []);
    } catch {
      setHistory([]);
    }
  }, []);

  useEffect(() => { fetchAlerts(); fetchHistory(); }, [fetchAlerts, fetchHistory]);

  const handleCreate = async (data) => {
    try {
      const alert = await alertAPI.create(data);
      setAlerts(prev => [alert, ...prev]);
      setCreating(false);
    } catch { /* ignore */ }
  };

  const handleToggle = async (id) => {
    try {
      const updated = await alertAPI.toggle(id);
      setAlerts(prev => prev.map(a => a.alert_id === id ? updated : a));
    } catch { /* ignore */ }
  };

  const handleDelete = async (id) => {
    try {
      await alertAPI.delete(id);
      setAlerts(prev => prev.filter(a => a.alert_id !== id));
    } catch { /* ignore */ }
  };

  const activeCount = alerts.filter(a => a.is_active).length;

  return (
    <BaseWidget
      title="Alerts"
      subtitle={`${activeCount} active`}
      icon={Bell}
      onRemove={onRemove}
      onRefresh={() => { fetchAlerts(); fetchHistory(); }}
      showViewToggle={false}
      showPeriodSelector={false}
    >
      <div className="flex flex-col h-full min-h-0">
        {/* Tab bar + add button */}
        <div className="flex items-center px-3 py-1.5 border-b border-gray-800 bg-[#0a0a0f] flex-shrink-0">
          <div className="flex gap-3 flex-1">
            {[
              { id: 'active', label: 'Active', count: alerts.length },
              { id: 'history', label: 'History', count: history.length },
            ].map(t => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`text-[11px] font-medium pb-1 transition-colors ${
                  tab === t.id
                    ? 'text-white border-b border-cyan-400'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t.label}
                {t.count > 0 && (
                  <span className="ml-1 text-[9px] text-gray-600">({t.count})</span>
                )}
              </button>
            ))}
          </div>
          {tab === 'active' && !creating && (
            <button
              onClick={() => setCreating(true)}
              className="flex items-center gap-1 px-2 py-0.5 text-[10px] text-cyan-400 hover:bg-cyan-500/10 rounded transition-colors"
            >
              <Plus size={10} /> New
            </button>
          )}
        </div>

        {/* Create form */}
        {creating && tab === 'active' && (
          <CreateAlertForm onSubmit={handleCreate} onCancel={() => setCreating(false)} />
        )}

        {/* Content */}
        <div className="flex-1 overflow-auto min-h-0">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="w-5 h-5 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          ) : tab === 'active' ? (
            alerts.length > 0 ? (
              alerts.map(a => (
                <AlertCard
                  key={a.alert_id}
                  alert={a}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                />
              ))
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-gray-500 text-xs gap-2 px-4">
                <AlertTriangle size={20} className="text-gray-700" />
                <p>No alerts configured</p>
                <button
                  onClick={() => setCreating(true)}
                  className="flex items-center gap-1 px-3 py-1.5 bg-cyan-600 hover:bg-cyan-500 text-white text-xs rounded transition-colors"
                >
                  <Plus size={12} /> Create Alert
                </button>
              </div>
            )
          ) : (
            <TimelineList
              items={history}
              emptyMessage="No alert history"
              renderItem={(item) => ({
                title: `${item.ticker_cd || '—'} — ${item.alert_type} alert triggered`,
                subtitle: item.message || `Threshold: ${item.threshold_value}`,
                timestamp: item.triggered_at || item.created_at,
                badge: (
                  <Badge type={item.alert_type === 'price' ? 'info' : 'warning'}>
                    {item.alert_type}
                  </Badge>
                ),
                icon: <Zap size={12} />,
              })}
            />
          )}
        </div>
      </div>
    </BaseWidget>
  );
}
