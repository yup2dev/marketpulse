/**
 * CopilotPanel — OpenBB Copilot 스타일 우측 AI 채팅 패널.
 *
 * 백엔드 /api/copilot/chat (SSE) 와 대화한다. Claude가 tool-use로
 * 내부 데이터 API를 조회·가공해 답하고, add_widget 도구 사용 시
 * SSE `widget` 이벤트가 오면 window CustomEvent('copilot:add-widget')로
 * DashboardPage에 위젯 추가를 위임한다.
 */
import { useState, useRef, useEffect, useCallback, Fragment } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Sparkles, SendHorizonal, X, Square, Trash2,
  Database, LayoutGrid, Loader2, CheckCircle2, AlertCircle, KeyRound,
} from 'lucide-react';
import { API_BASE, apiClient } from '../../config/api';
import useNavigationStore from '../../store/navigationStore';

// ── 경량 마크다운 렌더러 (외부 의존성 없음: 테이블/코드/볼드/리스트) ─────────
function renderInline(text, keyBase) {
  // `code`, **bold** 만 처리 — 나머지는 그대로
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
  return parts.map((p, i) => {
    if (p.startsWith('`') && p.endsWith('`')) {
      return (
        <code key={`${keyBase}-${i}`} className="px-1 py-0.5 bg-gray-800 rounded text-[11px] text-cyan-300">
          {p.slice(1, -1)}
        </code>
      );
    }
    if (p.startsWith('**') && p.endsWith('**')) {
      return <strong key={`${keyBase}-${i}`} className="text-gray-100">{p.slice(2, -2)}</strong>;
    }
    return <Fragment key={`${keyBase}-${i}`}>{p}</Fragment>;
  });
}

function MarkdownLite({ text }) {
  const lines = text.split('\n');
  const out = [];
  let i = 0;
  let key = 0;

  while (i < lines.length) {
    const line = lines[i];

    // 코드 블록
    if (line.startsWith('```')) {
      const buf = [];
      i += 1;
      while (i < lines.length && !lines[i].startsWith('```')) {
        buf.push(lines[i]);
        i += 1;
      }
      i += 1; // closing ```
      out.push(
        <pre key={key++} className="my-1.5 p-2 bg-gray-900 border border-gray-800 rounded text-[11px] text-gray-300 overflow-x-auto whitespace-pre">
          {buf.join('\n')}
        </pre>,
      );
      continue;
    }

    // 테이블 (| a | b | 형태가 2줄 이상)
    if (line.trim().startsWith('|') && lines[i + 1]?.trim().match(/^\|[\s:-|]+\|$/)) {
      const header = line.split('|').slice(1, -1).map((s) => s.trim());
      i += 2;
      const rows = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        rows.push(lines[i].split('|').slice(1, -1).map((s) => s.trim()));
        i += 1;
      }
      out.push(
        <div key={key++} className="my-1.5 overflow-x-auto">
          <table className="text-[11px] w-full border-collapse">
            <thead>
              <tr>
                {header.map((h, hi) => (
                  <th key={hi} className="text-left px-2 py-1 border-b border-gray-700 text-gray-400 font-medium whitespace-nowrap">
                    {renderInline(h, `th${hi}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={ri} className="border-b border-gray-800/60">
                  {r.map((c, ci) => (
                    <td key={ci} className="px-2 py-1 text-gray-300 whitespace-nowrap">
                      {renderInline(c, `td${ri}-${ci}`)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>,
      );
      continue;
    }

    // 헤딩
    const hm = line.match(/^(#{1,4})\s+(.*)$/);
    if (hm) {
      out.push(
        <div key={key++} className="mt-2 mb-1 text-[12px] font-semibold text-gray-100">
          {renderInline(hm[2], `h${key}`)}
        </div>,
      );
      i += 1;
      continue;
    }

    // 리스트 항목
    const lm = line.match(/^\s*[-*]\s+(.*)$/);
    if (lm) {
      out.push(
        <div key={key++} className="flex gap-1.5 pl-1">
          <span className="text-gray-600 flex-shrink-0">•</span>
          <span>{renderInline(lm[1], `l${key}`)}</span>
        </div>,
      );
      i += 1;
      continue;
    }

    // 일반 텍스트
    if (line.trim() === '') {
      out.push(<div key={key++} className="h-1.5" />);
    } else {
      out.push(<div key={key++}>{renderInline(line, `p${key}`)}</div>);
    }
    i += 1;
  }

  return <div className="text-[12px] leading-relaxed text-gray-300">{out}</div>;
}

// ── SSE 파서: fetch ReadableStream → {event, data} 콜백 ─────────────────────
async function consumeSSE(response, onEvent, signal) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  for (;;) {
    if (signal?.aborted) {
      await reader.cancel().catch(() => {});
      return;
    }
    const { done, value } = await reader.read();
    if (done) return;
    buffer += decoder.decode(value, { stream: true });

    let idx;
    while ((idx = buffer.indexOf('\n\n')) !== -1) {
      const chunk = buffer.slice(0, idx);
      buffer = buffer.slice(idx + 2);
      let event = 'message';
      let data = '';
      for (const ln of chunk.split('\n')) {
        if (ln.startsWith('event:')) event = ln.slice(6).trim();
        else if (ln.startsWith('data:')) data += ln.slice(5).trim();
      }
      if (data) {
        try {
          onEvent(event, JSON.parse(data));
        } catch {
          /* skip malformed */
        }
      }
    }
  }
}

// ── 도구 활동 칩 ─────────────────────────────────────────────────────────────
function ToolChip({ block }) {
  const isWidget = block.tool === 'add_widget';
  const Icon = isWidget ? LayoutGrid : Database;
  return (
    <div className="flex items-center gap-1.5 my-1 px-2 py-1 bg-gray-800/50 border border-gray-800 rounded text-[11px] text-gray-400">
      {block.status === 'running' ? (
        <Loader2 size={11} className="animate-spin text-cyan-400 flex-shrink-0" />
      ) : block.ok === false ? (
        <AlertCircle size={11} className="text-red-400 flex-shrink-0" />
      ) : (
        <CheckCircle2 size={11} className="text-emerald-400 flex-shrink-0" />
      )}
      <Icon size={11} className="text-gray-500 flex-shrink-0" />
      <span className="truncate">{block.label}</span>
    </div>
  );
}

const SUGGESTIONS = [
  'AAPL 최근 실적과 애널리스트 추정치를 요약해줘',
  '미국 인플레이션 추세를 분석하고 관련 위젯을 추가해줘',
  '오늘 상승률 상위 종목을 보여줘',
  '버크셔 해서웨이 13F 포트폴리오 상위 보유 종목은?',
];

const PROVIDER_LABELS = { anthropic: 'Claude', gemini: 'Gemini' };

export default function CopilotPanel({ open, onClose }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [messages, setMessages] = useState([]);   // {role:'user',text} | {role:'assistant',blocks:[...]}
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [status, setStatus] = useState(null);     // {enabled, provider, providers, model} | null=미확인
  const abortRef = useRef(null);
  const scrollRef = useRef(null);
  const inputRef = useRef(null);

  const enabled = status ? !!status.enabled : null;

  // Copilot 활성 여부 — 열 때마다 재확인 (API 키 관리에서 등록 직후 반영되도록)
  useEffect(() => {
    if (!open) return;
    apiClient.get(`${API_BASE}/copilot/status`)
      .then(setStatus)
      .catch(() => setStatus({ enabled: false }));
  }, [open]);

  // 자동 스크롤
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [messages, streaming]);

  useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const stop = useCallback(() => {
    abortRef.current?.abort();
    abortRef.current = null;
    setStreaming(false);
  }, []);

  const send = useCallback(async (textArg) => {
    const text = (textArg ?? input).trim();
    if (!text || streaming) return;
    setInput('');

    const history = [...messages, { role: 'user', text }];
    setMessages([...history, { role: 'assistant', blocks: [] }]);
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    // assistant 마지막 메시지의 blocks를 함수형 업데이트로 조작
    const updateBlocks = (fn) => {
      setMessages((prev) => {
        const next = [...prev];
        const last = { ...next[next.length - 1] };
        last.blocks = fn([...last.blocks]);
        next[next.length - 1] = last;
        return next;
      });
    };
    const appendText = (delta) => {
      updateBlocks((blocks) => {
        const last = blocks[blocks.length - 1];
        if (last?.type === 'text') {
          blocks[blocks.length - 1] = { ...last, text: last.text + delta };
        } else {
          blocks.push({ type: 'text', text: delta });
        }
        return blocks;
      });
    };

    try {
      const res = await fetch(`${API_BASE}/copilot/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...apiClient.getAuthHeaders(),
        },
        signal: controller.signal,
        body: JSON.stringify({
          messages: history.map((m) => ({
            role: m.role,
            content: m.role === 'user'
              ? m.text
              : (m.blocks || []).filter((b) => b.type === 'text').map((b) => b.text).join('') || '(도구 호출)',
          })),
          context: {
            path: location.pathname,
            symbol: useNavigationStore.getState().lastSymbol || null,
          },
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || `HTTP ${res.status}`);
      }

      await consumeSSE(res, (event, data) => {
        if (event === 'text') {
          appendText(data.delta);
        } else if (event === 'tool') {
          const label = data.name === 'add_widget'
            ? `위젯 추가: ${data.input?.widget_type || ''}`
            : data.name === 'create_dataset_widget'
              ? `데이터셋 위젯 생성: ${data.input?.title || ''}`
              : `데이터 조회: ${data.input?.path || data.name}`;
          updateBlocks((blocks) => [...blocks, {
            type: 'tool', tool: data.name, label, status: 'running',
          }]);
        } else if (event === 'tool_result') {
          updateBlocks((blocks) => {
            for (let i = blocks.length - 1; i >= 0; i -= 1) {
              if (blocks[i].type === 'tool' && blocks[i].status === 'running') {
                blocks[i] = { ...blocks[i], status: 'done', ok: data.ok !== false };
                break;
              }
            }
            return blocks;
          });
        } else if (event === 'widget') {
          // DashboardPage가 수신해 현재 pane에 위젯 추가
          window.dispatchEvent(new CustomEvent('copilot:add-widget', { detail: data }));
          updateBlocks((blocks) => {
            for (let i = blocks.length - 1; i >= 0; i -= 1) {
              if (blocks[i].type === 'tool' && blocks[i].status === 'running') {
                blocks[i] = { ...blocks[i], status: 'done', ok: true };
                break;
              }
            }
            return blocks;
          });
        } else if (event === 'error') {
          updateBlocks((blocks) => [...blocks, { type: 'error', text: data.message }]);
        }
      }, controller.signal);
    } catch (e) {
      if (e.name !== 'AbortError') {
        updateBlocks((blocks) => [...blocks, { type: 'error', text: e.message || '요청 실패' }]);
      }
    } finally {
      abortRef.current = null;
      setStreaming(false);
    }
  }, [input, messages, streaming, location.pathname]);

  if (!open) return null;

  return (
    <div
      className="fixed right-0 top-14 bottom-0 w-[400px] z-40 flex flex-col bg-[#0d0d12] border-l border-gray-800 shadow-2xl"
      role="complementary"
      aria-label="AI Copilot"
    >
      {/* ── 헤더 ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-800 flex-shrink-0">
        <div className="flex items-center gap-2">
          <Sparkles size={14} className="text-cyan-400" />
          <span className="text-sm font-semibold text-gray-200">Copilot</span>
          {status?.provider && (
            <span className="px-1.5 py-0.5 text-[10px] text-cyan-300 bg-cyan-900/30 border border-cyan-800/40 rounded">
              {PROVIDER_LABELS[status.provider] || status.provider}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {messages.length > 0 && (
            <button
              onClick={() => { stop(); setMessages([]); }}
              className="p-1.5 text-gray-600 hover:text-gray-300 hover:bg-gray-800 rounded transition-colors"
              title="대화 초기화"
            >
              <Trash2 size={13} />
            </button>
          )}
          <button
            onClick={onClose}
            className="p-1.5 text-gray-500 hover:text-white hover:bg-gray-800 rounded transition-colors"
            title="닫기"
          >
            <X size={14} />
          </button>
        </div>
      </div>

      {/* ── 메시지 목록 ───────────────────────────────────────────────── */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto px-3 py-3 space-y-3">
        {enabled === false && (
          <div className="p-3 bg-amber-900/20 border border-amber-800/40 rounded text-[12px] text-amber-300 leading-relaxed">
            <p className="mb-2">
              Copilot을 사용하려면 LLM API 키가 필요합니다.{' '}
              <strong className="text-amber-200">Google Gemini</strong>는 무료 티어로 사용할 수 있습니다.
            </p>
            <button
              onClick={() => navigate('/settings')}
              className="flex items-center gap-1.5 px-2.5 py-1.5 bg-amber-800/40 hover:bg-amber-800/60 border border-amber-700/50 rounded text-[11px] text-amber-100 transition-colors"
            >
              <KeyRound size={12} />
              API 키 관리에서 등록하기
            </button>
          </div>
        )}

        {messages.length === 0 && enabled !== false && (
          <div className="pt-6">
            <div className="flex flex-col items-center gap-2 mb-5">
              <div className="p-2.5 bg-cyan-900/20 border border-cyan-800/30 rounded-xl">
                <Sparkles size={20} className="text-cyan-400" />
              </div>
              <p className="text-[12px] text-gray-500 text-center leading-relaxed">
                데이터를 조회·가공해 답하고,<br />대시보드에 위젯을 추가해 드립니다.
              </p>
            </div>
            <div className="space-y-1.5">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => send(s)}
                  className="w-full text-left px-2.5 py-2 text-[11px] text-gray-400 bg-gray-800/40 hover:bg-gray-800 hover:text-gray-200 border border-gray-800 rounded transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, mi) => (
          m.role === 'user' ? (
            <div key={mi} className="flex justify-end">
              <div className="max-w-[85%] px-3 py-2 bg-cyan-900/30 border border-cyan-800/30 rounded-lg rounded-br-sm text-[12px] text-gray-200 whitespace-pre-wrap">
                {m.text}
              </div>
            </div>
          ) : (
            <div key={mi} className="max-w-full">
              {(m.blocks || []).map((b, bi) => {
                if (b.type === 'text') return <MarkdownLite key={bi} text={b.text} />;
                if (b.type === 'tool') return <ToolChip key={bi} block={b} />;
                if (b.type === 'error') {
                  return (
                    <div key={bi} className="flex items-start gap-1.5 my-1 px-2 py-1.5 bg-red-900/20 border border-red-800/40 rounded text-[11px] text-red-300">
                      <AlertCircle size={12} className="flex-shrink-0 mt-0.5" />
                      <span>{b.text}</span>
                    </div>
                  );
                }
                return null;
              })}
              {streaming && mi === messages.length - 1 && (
                <div className="flex items-center gap-1.5 mt-1 text-[11px] text-gray-600">
                  <Loader2 size={11} className="animate-spin" />
                  생각 중…
                </div>
              )}
            </div>
          )
        ))}
      </div>

      {/* ── 입력 ─────────────────────────────────────────────────────── */}
      <div className="p-3 border-t border-gray-800 flex-shrink-0">
        <div className="flex items-end gap-2 bg-gray-800/50 border border-gray-700 rounded-lg px-2.5 py-2 focus-within:border-cyan-700 transition-colors">
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                send();
              }
            }}
            placeholder="질문하기… (Enter 전송, Shift+Enter 줄바꿈)"
            rows={Math.min(4, Math.max(1, input.split('\n').length))}
            className="flex-1 bg-transparent text-[12px] text-gray-200 placeholder-gray-600 outline-none resize-none leading-relaxed"
            disabled={enabled === false}
          />
          {streaming ? (
            <button
              onClick={stop}
              className="p-1.5 text-red-400 hover:bg-gray-700 rounded transition-colors flex-shrink-0"
              title="중지"
            >
              <Square size={13} />
            </button>
          ) : (
            <button
              onClick={() => send()}
              disabled={!input.trim() || enabled === false}
              className="p-1.5 text-cyan-400 hover:bg-gray-700 rounded transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex-shrink-0"
              title="전송"
            >
              <SendHorizonal size={13} />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-[10px] text-gray-700 text-center">
          Copilot은 실수할 수 있습니다. 중요한 수치는 원본 데이터로 확인하세요.
        </p>
      </div>
    </div>
  );
}
