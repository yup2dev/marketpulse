/**
 * ExampleProviderView — provider별 위젯 body override 템플릿.
 *
 * 실제 model에는 연결돼 있지 않다(registry/providerViews.js의 PROVIDER_VIEWS는 빈 상태).
 * 새 provider 전용 뷰를 만들 때 이 파일을 복사해 출발점으로 쓴다.
 *
 * prop 계약은 registry/providerViews.js 상단 주석 참고:
 *   { response, rows, provider, symbol, period, loading, error }
 *
 * 규칙:
 *   - 이 컴포넌트는 위젯 **body만** 렌더한다(컨테이너를 채움). header/provider 셀렉터/refresh는
 *     UniversalWidget이 소유하므로 여기서 다시 그리지 않는다.
 *   - 다크테마 컨벤션: bg-[#0d0d12] 카드, border-gray-800, text-cyan-400 액센트.
 */
export default function ExampleProviderView({
  response,
  rows,
  provider,
  symbol,
  period,
  loading,
  error,
}) {
  if (error) {
    return (
      <div className="flex items-center justify-center h-full text-red-400 text-xs p-4">
        {error}
      </div>
    );
  }

  return (
    <div className="h-full overflow-auto p-3 text-xs text-gray-300">
      <div className="mb-3 flex items-center gap-2">
        <span className="rounded bg-cyan-500/10 px-2 py-0.5 font-mono text-cyan-400">
          {provider}
        </span>
        <span className="text-gray-500">provider 전용 뷰 (예시 템플릿)</span>
      </div>

      <dl className="grid grid-cols-2 gap-2">
        <div className="rounded border border-gray-800 bg-[#0d0d12] p-2">
          <dt className="text-gray-500">symbol</dt>
          <dd className="font-mono text-gray-200">{symbol || '—'}</dd>
        </div>
        <div className="rounded border border-gray-800 bg-[#0d0d12] p-2">
          <dt className="text-gray-500">period</dt>
          <dd className="font-mono text-gray-200">{period || '—'}</dd>
        </div>
        <div className="rounded border border-gray-800 bg-[#0d0d12] p-2">
          <dt className="text-gray-500">rows</dt>
          <dd className="font-mono text-gray-200">
            {loading ? '…' : (Array.isArray(rows) ? rows.length : 0)} items
          </dd>
        </div>
        <div className="rounded border border-gray-800 bg-[#0d0d12] p-2">
          <dt className="text-gray-500">response keys</dt>
          <dd className="font-mono text-gray-200">
            {response && typeof response === 'object'
              ? Object.keys(response).join(', ') || '—'
              : '—'}
          </dd>
        </div>
      </dl>

      <p className="mt-3 text-gray-600">
        이 자리에 <code className="text-cyan-400">response</code>를 가공한 전용 UI를 그린다.
      </p>
    </div>
  );
}
