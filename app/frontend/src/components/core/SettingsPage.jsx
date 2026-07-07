/**
 * SettingsPage — API 키 관리 (/settings)
 *
 * 키는 백엔드 DB에 암호화 저장되며 내 계정에서만 사용된다(웹에서 관리). FRED·FMP·Polygon
 * 등 key-only 데이터는 서버에서 내 키로 조회한다 → Fetcher 없이도 키 관리/조회 가능.
 * 단, Yahoo 등 일부 소스는 사용자 PC의 Fetcher에서 실행돼야 한다(IP 차단 회피).
 * 그래서 Fetcher 실행 여부를 안내하는 배너를 별도로 표시한다.
 *
 * - 단일 키 provider(fmp/polygon/fred/alphavantage) → { provider, api_key }
 * - 다중 필드 provider(kis: appkey+appsecret)        → { provider, fields }
 */
import { useCallback, useEffect, useState } from 'react';
import {
  KeyRound, Trash2, Save, ExternalLink, RefreshCw, ShieldCheck, Download, Play, Sparkles,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { keysAPI } from '../../config/api';
import useFetcherHealth from '../../hooks/useFetcherHealth';

const FETCHER_DOWNLOAD_URL = 'https://github.com/yup2dev/marketpulse/releases/latest';

const PROVIDERS = [
  {
    id: 'kis',
    label: '한국투자증권 (KIS)',
    desc: '국내주식 실시간 · 1일 랭킹',
    docs: 'https://apiportal.koreainvestment.com',
    fields: [
      { key: 'appkey',    label: 'App Key',    placeholder: 'KIS App Key' },
      { key: 'appsecret', label: 'App Secret', placeholder: 'KIS App Secret' },
    ],
  },
  {
    id: 'fmp', label: 'Financial Modeling Prep', desc: '재무 · 기업 · 애널리스트 데이터',
    docs: 'https://site.financialmodelingprep.com/developer/docs',
    fields: [{ key: 'api_key', label: 'API Key', placeholder: 'FMP API Key' }],
  },
  {
    id: 'polygon', label: 'Polygon.io', desc: '미국 시세 · 뉴스 · 옵션',
    docs: 'https://polygon.io/dashboard/api-keys',
    fields: [{ key: 'api_key', label: 'API Key', placeholder: 'Polygon API Key' }],
  },
  {
    id: 'fred', label: 'FRED', desc: '거시경제 지표 (미 연준)',
    docs: 'https://fred.stlouisfed.org/docs/api/api_key.html',
    fields: [{ key: 'api_key', label: 'API Key', placeholder: 'FRED API Key' }],
  },
  {
    id: 'alphavantage', label: 'Alpha Vantage', desc: '시세 · 환율 · 암호화폐',
    docs: 'https://www.alphavantage.co/support/#api-key',
    fields: [{ key: 'api_key', label: 'API Key', placeholder: 'Alpha Vantage API Key' }],
  },
];

// AI Copilot 채팅용 LLM 키 — 데이터 provider와 동일한 /api/keys 저장소 사용
const AI_PROVIDERS = [
  {
    id: 'gemini', label: 'Google Gemini', desc: 'AI Copilot — 무료 티어 사용 가능 (권장)',
    docs: 'https://aistudio.google.com/apikey',
    fields: [{ key: 'api_key', label: 'API Key', placeholder: 'Gemini API Key (AIza…)' }],
  },
  {
    id: 'anthropic', label: 'Anthropic Claude', desc: 'AI Copilot — 유료, 응답 품질 최상',
    docs: 'https://platform.claude.com/settings/keys',
    fields: [{ key: 'api_key', label: 'API Key', placeholder: 'sk-ant-…' }],
  },
];

export default function SettingsPage() {
  // 키 관리는 백엔드 DB 기반(online=백엔드 도달). Fetcher 상태는 별개(일부 데이터용).
  const { status: fetcherStatus, isTauri, recheck } = useFetcherHealth();
  const fetcherOnline = fetcherStatus === 'online';

  const [online, setOnline]       = useState(true);   // 백엔드 도달 가능 여부
  const [statusMap, setStatusMap] = useState({});   // provider → { configured, masked, fields }
  const [inputs, setInputs]       = useState({});    // provider → { fieldKey: value }
  const [saving, setSaving]       = useState({});    // provider → bool
  const [starting, setStarting]   = useState(false);

  const loadKeys = useCallback(async () => {
    try {
      const res = await keysAPI.list();          // { keys: [...] } — DB 기반, 항상 관리 가능
      setOnline(true);
      const map = {};
      for (const k of (res?.keys || [])) map[k.provider] = k;
      setStatusMap(map);
      return true;
    } catch {
      setOnline(false);   // 백엔드 미도달
      return false;
    }
  }, []);

  useEffect(() => { loadKeys(); }, [loadKeys]);

  const setField = (provider, key, value) =>
    setInputs((prev) => ({ ...prev, [provider]: { ...prev[provider], [key]: value } }));

  const saveProvider = async (p) => {
    const vals = inputs[p.id] || {};
    const filled = p.fields.filter((f) => (vals[f.key] || '').trim());
    if (filled.length === 0) {
      toast.error('값을 입력하세요');
      return;
    }
    // 다중 필드는 모두 채워야 함 (부분 갱신 혼란 방지)
    if (p.fields.length > 1 && filled.length !== p.fields.length) {
      toast.error('모든 필드를 입력하세요');
      return;
    }

    const isSingleKey = p.fields.length === 1 && p.fields[0].key === 'api_key';
    const body = isSingleKey
      ? { provider: p.id, api_key: vals.api_key.trim() }
      : { provider: p.id, fields: Object.fromEntries(p.fields.map((f) => [f.key, (vals[f.key] || '').trim()])) };

    setSaving((s) => ({ ...s, [p.id]: true }));
    try {
      await keysAPI.set(body);
      toast.success(`${p.label} 키 저장 완료`);
      setInputs((prev) => ({ ...prev, [p.id]: {} }));
      await loadKeys();
    } catch (e) {
      toast.error(e?.message || '저장 실패 — Fetcher 연결을 확인하세요');
    } finally {
      setSaving((s) => ({ ...s, [p.id]: false }));
    }
  };

  const deleteProvider = async (p) => {
    if (!window.confirm(`${p.label} 키를 삭제하시겠습니까?`)) return;
    try {
      await keysAPI.delete(p.id);
      toast.success(`${p.label} 키 삭제됨`);
      await loadKeys();
    } catch (e) {
      toast.error(e?.message || '삭제 실패 — 서버 연결을 확인하세요');
    }
  };

  const handleStart = async () => {
    setStarting(true);
    try {
      const invoke = window.__TAURI__?.core?.invoke;
      if (invoke) await invoke('start_fetcher');
      await new Promise((r) => setTimeout(r, 1500));
      for (let i = 0; i < 6; i += 1) {
        if (await recheck()) break;
        await new Promise((r) => setTimeout(r, 1000));
      }
    } catch (e) {
      console.error('[settings] fetcher start failed', e);
    } finally {
      setStarting(false);
    }
  };

  return (
    <div className="px-6 py-6 max-w-3xl mx-auto">
      <div className="flex items-center gap-2 mb-1">
        <KeyRound className="text-cyan-400" size={20} />
        <h1 className="text-xl font-semibold text-white">API 키 관리</h1>
      </div>
      <p className="text-sm mb-6" style={{ color: 'var(--color-text-muted)' }}>
        키는 서버에 암호화되어 저장되며 내 계정에서만 사용됩니다. 등록한 키로 FRED·FMP·Polygon
        등 데이터를 서버에서 조회합니다. (Yahoo 등 일부 소스는 데스크톱 Fetcher 실행이 필요합니다)
      </p>

      {/* Fetcher 상태 배너 — 키 관리는 Fetcher 없이도 되지만, Yahoo 등 일부 데이터는 필요 */}
      {!fetcherOnline && (
        <div className="mb-6 rounded-lg border border-yellow-500/40 bg-yellow-500/10 p-4">
          <div className="flex items-center gap-2 mb-2">
            <span className="w-2 h-2 rounded-full bg-yellow-500" />
            <span className="text-sm font-medium text-yellow-300">
              로컬 Fetcher가 실행되고 있지 않습니다
            </span>
          </div>
          <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
            키 등록·관리는 Fetcher 없이도 가능하지만, Yahoo 등 일부 데이터는 Fetcher 실행이 필요합니다.
          </p>
          <div className="flex items-center gap-2">
            {isTauri ? (
              <button
                onClick={handleStart}
                disabled={starting}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-50 transition-colors"
              >
                {starting ? <RefreshCw size={13} className="animate-spin" /> : <Play size={13} />}
                {starting ? '실행 중…' : 'Fetcher 실행'}
              </button>
            ) : (
              <a
                href={FETCHER_DOWNLOAD_URL}
                target="_blank"
                rel="noreferrer"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-cyan-600 hover:bg-cyan-500 text-white transition-colors"
              >
                <Download size={13} /> Fetcher 다운로드
              </a>
            )}
            <button
              onClick={() => recheck()}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-gray-700 hover:bg-gray-800/50 transition-colors"
              style={{ color: 'var(--color-text-secondary)' }}
            >
              <RefreshCw size={13} /> 새로고침
            </button>
          </div>
        </div>
      )}

      <div className="space-y-3">
        {PROVIDERS.map(renderCard)}
      </div>

      {/* ── AI Copilot 키 ──────────────────────────────────────────────── */}
      <div className="flex items-center gap-2 mt-10 mb-1">
        <Sparkles className="text-cyan-400" size={18} />
        <h2 className="text-lg font-semibold text-white">AI Copilot</h2>
      </div>
      <p className="text-sm mb-4" style={{ color: 'var(--color-text-muted)' }}>
        Copilot 채팅 패널에 사용할 LLM 키입니다. Gemini는 무료 티어로 사용할 수 있습니다.
        둘 다 등록하면 Claude가 우선 사용됩니다.
      </p>
      <div className="space-y-3">
        {AI_PROVIDERS.map(renderCard)}
      </div>
    </div>
  );

  // 데이터 provider와 AI provider 카드 공용 렌더러 (컴포넌트 스코프 state 사용)
  function renderCard(p) {
          const st = statusMap[p.id];
          const configured = !!st?.configured;
          const busy = !!saving[p.id];
          return (
            <div
              key={p.id}
              className="rounded-lg border dark:border-gray-800 border-gray-200 p-4"
              style={{ backgroundColor: 'var(--color-bg-widget)' }}
            >
              <div className="flex items-start justify-between mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-semibold text-white">{p.label}</span>
                    {configured ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-green-400 bg-green-500/10 border border-green-500/40 rounded px-1.5 py-0.5">
                        <ShieldCheck size={11} /> 등록됨 {st.masked}
                      </span>
                    ) : (
                      <span className="text-[11px] text-gray-500 bg-gray-700/30 border border-gray-700 rounded px-1.5 py-0.5">
                        미등록
                      </span>
                    )}
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--color-text-muted)' }}>{p.desc}</p>
                </div>
                <a
                  href={p.docs}
                  target="_blank"
                  rel="noreferrer"
                  className="flex items-center gap-1 text-[11px] text-gray-500 hover:text-cyan-400 transition-colors"
                  title="발급 안내"
                >
                  키 발급 <ExternalLink size={11} />
                </a>
              </div>

              <div className="space-y-2">
                {p.fields.map((f) => (
                  <div key={f.key} className="flex items-center gap-2">
                    {p.fields.length > 1 && (
                      <label className="text-xs w-20 shrink-0" style={{ color: 'var(--color-text-secondary)' }}>
                        {f.label}
                      </label>
                    )}
                    <input
                      type="text"
                      value={(inputs[p.id]?.[f.key]) || ''}
                      onChange={(e) => setField(p.id, f.key, e.target.value)}
                      disabled={busy}
                      placeholder={configured ? '새 값 입력 (변경 시)' : f.placeholder}
                      autoComplete="off"
                      spellCheck={false}
                      className="flex-1 bg-black/30 border border-gray-700 focus:border-cyan-500 rounded-md px-3 py-1.5 text-sm text-gray-100 font-mono outline-none disabled:opacity-50"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-2 mt-3">
                <button
                  onClick={() => saveProvider(p)}
                  disabled={busy}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold bg-cyan-600 hover:bg-cyan-500 text-white disabled:opacity-40 transition-colors"
                >
                  {busy ? <RefreshCw size={13} className="animate-spin" /> : <Save size={13} />}
                  저장
                </button>
                {configured && (
                  <button
                    onClick={() => deleteProvider(p)}
                    disabled={!online || busy}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium border border-gray-700 text-gray-400 hover:border-red-500 hover:text-red-400 disabled:opacity-40 transition-colors"
                  >
                    <Trash2 size={13} /> 삭제
                  </button>
                )}
              </div>
            </div>
          );
  }
}
