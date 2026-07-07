/**
 * ResearchReportsWidget — 리서치 보고서 (애널리스트/추정치/연간보고서) PDF 임포트·조회.
 *
 * 목록:   /api/data/db/research_reports (db fetcher 게이트웨이)
 * 업로드: POST /api/reports/upload (multipart)
 * 뷰어:   /api/reports/{id}/file 을 인증 fetch → blob URL → iframe
 *         (/api/* 는 Bearer 필수라 iframe이 직접 열 수 없음)
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import {
  FileText, Upload, ArrowLeft, ExternalLink, Trash2, FileType2, AlignLeft,
} from 'lucide-react';
import BaseWidget from './common/BaseWidget';
import { apiClient, API_BASE, dataAPI } from '../../config/api';

const TYPE_STYLES = {
  analyst:   'bg-cyan-900/40 text-cyan-300 border-cyan-800',
  estimates: 'bg-purple-900/40 text-purple-300 border-purple-800',
  annual:    'bg-amber-900/40 text-amber-300 border-amber-800',
};
const TYPE_LABELS = { analyst: 'Analyst', estimates: 'Estimates', annual: 'Annual' };

function authHeaders() {
  const token = localStorage.getItem('access_token');
  return token ? { Authorization: `Bearer ${token}` } : {};
}

function fmtSize(bytes) {
  if (!bytes) return '';
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)}KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)}MB`;
}

export default function ResearchReportsWidget({ symbol, onRemove }) {
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState('all');
  const [symbolOnly, setSymbolOnly] = useState(false);
  const [showUpload, setShowUpload] = useState(false);
  const [viewing, setViewing] = useState(null); // report row being viewed

  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params = { limit: 200 };
      if (typeFilter !== 'all') params.report_type = typeFilter;
      if (symbolOnly && symbol) params.symbol = symbol;
      const res = await dataAPI.fetch('db', 'research_reports', params);
      setReports(res.results || []);
    } catch {
      setReports([]);
    }
    setLoading(false);
  }, [typeFilter, symbolOnly, symbol]);

  useEffect(() => { fetchReports(); }, [fetchReports]);

  const handleDelete = async (e, report) => {
    e.stopPropagation();
    try {
      await apiClient.request(`${API_BASE}/reports/${report.report_id}`, { method: 'DELETE' });
      if (viewing?.report_id === report.report_id) setViewing(null);
      fetchReports();
    } catch { /* 목록 갱신 없이 무시 */ }
  };

  return (
    <BaseWidget
      title="Research Reports"
      icon={FileText}
      loading={loading && !viewing}
      onRefresh={fetchReports}
      onRemove={onRemove}
      showViewToggle={false}
      showPeriodSelector={false}
      source="Imported PDF (local DB)"
      headerExtra={
        <button
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => { setViewing(null); setShowUpload((v) => !v); }}
          className={`flex items-center gap-1 px-2 py-1 text-[11px] rounded border transition-colors ${
            showUpload
              ? 'bg-cyan-900/50 text-cyan-300 border-cyan-800'
              : 'text-gray-400 border-gray-700 hover:text-white hover:bg-gray-800'
          }`}
          title="Import PDF"
        >
          <Upload size={11} />
          Import
        </button>
      }
    >
      {viewing ? (
        <ReportViewer report={viewing} onBack={() => setViewing(null)} />
      ) : (
        <div className="flex flex-col h-full min-h-0">
          {showUpload && (
            <UploadForm
              defaultSymbol={symbol}
              onDone={() => { setShowUpload(false); fetchReports(); }}
            />
          )}

          {/* Filter chips */}
          <div className="flex items-center gap-1 px-3 pt-2 pb-1 flex-shrink-0 flex-wrap">
            {['all', 'analyst', 'estimates', 'annual'].map((t) => (
              <button
                key={t}
                onClick={() => setTypeFilter(t)}
                className={`text-[10px] px-1.5 py-0.5 rounded ${
                  typeFilter === t ? 'bg-cyan-900/50 text-cyan-300' : 'text-gray-500 hover:text-gray-300'
                }`}
              >
                {t === 'all' ? 'All' : TYPE_LABELS[t]}
              </button>
            ))}
            {symbol && (
              <button
                onClick={() => setSymbolOnly((v) => !v)}
                className={`ml-auto text-[10px] px-1.5 py-0.5 rounded border ${
                  symbolOnly
                    ? 'bg-cyan-900/50 text-cyan-300 border-cyan-800'
                    : 'text-gray-500 border-gray-800 hover:text-gray-300'
                }`}
              >
                {symbol} only
              </button>
            )}
          </div>

          {/* Report list */}
          <div className="flex-1 overflow-auto">
            {reports.length === 0 ? (
              <div className="text-center text-gray-500 text-[11px] py-8">
                No reports — click Import to add a PDF
              </div>
            ) : (
              <div className="px-2 pb-2 space-y-1">
                {reports.map((r) => (
                  <div
                    key={r.report_id}
                    onClick={() => setViewing(r)}
                    className="flex items-center gap-3 px-3 py-2 bg-[#0a0a0f] rounded hover:bg-gray-800/30 transition-colors cursor-pointer group"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-[11px] font-medium text-white truncate">{r.title}</span>
                        {r.symbol && (
                          <span className="text-[9px] text-cyan-400 flex-shrink-0">{r.symbol}</span>
                        )}
                      </div>
                      <div className="flex items-center gap-2 mt-0.5 text-[9px] text-gray-500">
                        {r.source && <span>{r.source}</span>}
                        {r.published_date && <span>{r.published_date}</span>}
                        {r.num_pages != null && <span>{r.num_pages}p</span>}
                        {r.file_size != null && <span>{fmtSize(r.file_size)}</span>}
                      </div>
                    </div>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded border font-medium flex-shrink-0 ${
                        TYPE_STYLES[r.report_type] || 'bg-gray-800 text-gray-400 border-gray-700'
                      }`}
                    >
                      {TYPE_LABELS[r.report_type] || r.report_type}
                    </span>
                    <button
                      onClick={(e) => handleDelete(e, r)}
                      className="p-1 text-gray-700 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-all flex-shrink-0"
                      title="Delete report"
                    >
                      <Trash2 size={11} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </BaseWidget>
  );
}

// ── Upload form (collapsible) ────────────────────────────────────────────────
const inputCls =
  'bg-[#0a0a0f] border border-gray-800 rounded px-2 py-1.5 text-xs text-gray-200 ' +
  'outline-none focus:border-cyan-700 w-full';

function UploadForm({ defaultSymbol, onDone }) {
  const fileRef = useRef(null);
  const [fileName, setFileName]   = useState('');
  const [reportType, setReportType] = useState('analyst');
  const [title, setTitle]         = useState('');
  const [sym, setSym]             = useState(defaultSymbol || '');
  const [source, setSource]       = useState('');
  const [pubDate, setPubDate]     = useState('');
  const [busy, setBusy]           = useState(false);
  const [error, setError]         = useState('');

  const submit = async () => {
    const file = fileRef.current?.files?.[0];
    if (!file) { setError('Select a PDF file'); return; }
    setBusy(true);
    setError('');
    const fd = new FormData();
    fd.append('file', file);
    fd.append('report_type', reportType);
    if (title.trim())  fd.append('title', title.trim());
    if (sym.trim())    fd.append('symbol', sym.trim().toUpperCase());
    if (source.trim()) fd.append('source', source.trim());
    if (pubDate)       fd.append('published_date', pubDate);
    try {
      const res = await fetch(`${API_BASE}/reports/upload`, {
        method: 'POST',
        headers: authHeaders(), // Content-Type은 브라우저가 boundary와 함께 설정
        body: fd,
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.detail || `HTTP ${res.status}`);
      }
      onDone?.();
    } catch (e) {
      setError(e.message || 'Upload failed');
    }
    setBusy(false);
  };

  return (
    <div
      className="border-b border-gray-800/60 px-3 py-2 space-y-2 flex-shrink-0"
      onMouseDown={(e) => e.stopPropagation()}
    >
      <div className="grid grid-cols-2 gap-2">
        <button
          onClick={() => fileRef.current?.click()}
          className={`${inputCls} text-left truncate ${fileName ? 'text-gray-200' : 'text-gray-500'}`}
        >
          {fileName || 'Choose PDF…'}
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/pdf,.pdf"
          className="hidden"
          onChange={(e) => setFileName(e.target.files?.[0]?.name || '')}
        />
        <select className={inputCls} value={reportType} onChange={(e) => setReportType(e.target.value)}>
          <option value="analyst">Analyst report</option>
          <option value="estimates">Estimates</option>
          <option value="annual">Annual report</option>
        </select>
        <input
          type="text" placeholder="Title (기본: 파일명)" className={inputCls}
          value={title} onChange={(e) => setTitle(e.target.value)}
        />
        <input
          type="text" placeholder="Symbol" className={inputCls}
          value={sym} onChange={(e) => setSym(e.target.value.toUpperCase())}
        />
        <input
          type="text" placeholder="Source (증권사/10-K 등)" className={inputCls}
          value={source} onChange={(e) => setSource(e.target.value)}
        />
        <input
          type="date" className={inputCls}
          value={pubDate} onChange={(e) => setPubDate(e.target.value)}
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={submit}
          disabled={busy}
          className="px-3 py-1 bg-cyan-600 hover:bg-cyan-500 disabled:bg-gray-700 disabled:text-gray-500 text-white text-[11px] font-semibold rounded transition-colors"
        >
          {busy ? 'Importing…' : 'Import PDF'}
        </button>
        {error && <span className="text-[10px] text-red-400">{error}</span>}
      </div>
    </div>
  );
}

// ── Viewer (PDF iframe / extracted text) ─────────────────────────────────────
function ReportViewer({ report, onBack }) {
  const [tab, setTab] = useState('pdf'); // 'pdf' | 'text'
  const [pdfUrl, setPdfUrl] = useState(null);
  const [text, setText] = useState(null);
  const [error, setError] = useState('');

  // PDF: 인증 fetch → blob URL (iframe은 Authorization 헤더를 못 붙임)
  useEffect(() => {
    let url = null;
    let alive = true;
    setError('');
    fetch(`${API_BASE}/reports/${report.report_id}/file`, { headers: authHeaders() })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.blob();
      })
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setPdfUrl(url);
      })
      .catch((e) => { if (alive) setError(e.message || 'Failed to load PDF'); });
    return () => {
      alive = false;
      if (url) URL.revokeObjectURL(url);
    };
  }, [report.report_id]);

  useEffect(() => {
    if (tab !== 'text' || text !== null) return;
    apiClient.get(`${API_BASE}/reports/${report.report_id}/text`)
      .then((r) => setText(r.text || ''))
      .catch(() => setText(''));
  }, [tab, text, report.report_id]);

  return (
    <div className="flex flex-col h-full min-h-0">
      <div
        className="flex items-center gap-2 px-3 py-1.5 border-b border-gray-800/60 flex-shrink-0"
        onMouseDown={(e) => e.stopPropagation()}
      >
        <button
          onClick={onBack}
          className="p-1 text-gray-500 hover:text-white hover:bg-gray-800 rounded transition-colors"
          title="Back to list"
        >
          <ArrowLeft size={12} />
        </button>
        <span className="text-[11px] font-medium text-white truncate flex-1">{report.title}</span>
        <div className="flex items-center bg-gray-800 rounded p-0.5">
          <button
            onClick={() => setTab('pdf')}
            className={`p-1 rounded ${tab === 'pdf' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            title="PDF"
          >
            <FileType2 size={11} />
          </button>
          <button
            onClick={() => setTab('text')}
            className={`p-1 rounded ${tab === 'text' ? 'bg-gray-700 text-white' : 'text-gray-500 hover:text-gray-300'}`}
            title="Extracted text"
          >
            <AlignLeft size={11} />
          </button>
        </div>
        {pdfUrl && (
          <a
            href={pdfUrl}
            target="_blank"
            rel="noreferrer"
            className="p-1 text-gray-500 hover:text-cyan-400 rounded transition-colors"
            title="Open in new tab"
          >
            <ExternalLink size={11} />
          </a>
        )}
      </div>

      <div className="flex-1 min-h-0">
        {tab === 'pdf' ? (
          error ? (
            <div className="text-center text-red-400 text-[11px] py-8">{error}</div>
          ) : pdfUrl ? (
            <iframe src={pdfUrl} title={report.title} className="w-full h-full border-0 bg-white" />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )
        ) : (
          <pre className="w-full h-full overflow-auto px-3 py-2 text-[11px] text-gray-300 whitespace-pre-wrap font-mono">
            {text === null ? 'Loading…' : text || '(no extracted text)'}
          </pre>
        )}
      </div>
    </div>
  );
}
