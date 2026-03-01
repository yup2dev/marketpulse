/**
 * 스크리너 결과 테이블
 */
import { Star, TrendingUp, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';
import WidgetTable from '../widgets/common/WidgetTable';

const handleAddToWatchlist = (ticker) => {
  // TODO: Implement add to watchlist
  toast.success(`${ticker}를 관심종목에 추가했습니다`);
};

const COLUMNS = [
  {
    key: 'stk_cd',
    header: '종목코드',
    sortable: true,
    sortValue: (row) => row.stk_cd,
    render: (row) => (
      <span className="font-semibold text-white">{row.stk_cd}</span>
    ),
  },
  {
    key: 'stk_nm',
    header: '종목명',
    sortable: true,
    sortValue: (row) => row.stk_nm || '',
    render: (row) => row.stk_nm || '—',
  },
  {
    key: 'sector',
    header: '섹터',
    sortable: true,
    sortValue: (row) => row.sector || '',
    render: (row) => (
      <span className="text-gray-400">{row.sector || '—'}</span>
    ),
  },
  {
    key: 'close_price',
    header: '현재가',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.close_price ?? -Infinity,
    exportValue: (row) => row.close_price ? '$' + row.close_price.toFixed(2) : '—',
    render: (row) => row.close_price ? `$${row.close_price.toFixed(2)}` : '—',
  },
  {
    key: 'change_rate',
    header: '등락률',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.change_rate ?? -Infinity,
    exportValue: (row) => row.change_rate ? row.change_rate.toFixed(2) + '%' : '—',
    render: (row) => {
      if (row.change_rate == null) return '—';
      const pos = row.change_rate >= 0;
      return (
        <span className={`flex items-center justify-end gap-1 font-medium ${pos ? 'text-green-400' : 'text-red-400'}`}>
          {pos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {row.change_rate.toFixed(2)}%
        </span>
      );
    },
  },
  {
    key: 'market_cap',
    header: '시가총액',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.market_cap ?? -Infinity,
    exportValue: (row) => row.market_cap ? '$' + (row.market_cap / 1e9).toFixed(2) + 'B' : '—',
    render: (row) => row.market_cap ? `$${(row.market_cap / 1e9).toFixed(2)}B` : '—',
  },
  {
    key: 'pe_ratio',
    header: 'PER',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.pe_ratio ?? -Infinity,
    exportValue: (row) => row.pe_ratio ? row.pe_ratio.toFixed(2) : '—',
    render: (row) => row.pe_ratio ? row.pe_ratio.toFixed(2) : '—',
  },
  {
    key: 'roe',
    header: 'ROE',
    align: 'right',
    sortable: true,
    sortValue: (row) => row.roe ?? -Infinity,
    exportValue: (row) => row.roe ? row.roe.toFixed(2) + '%' : '—',
    render: (row) => row.roe ? `${row.roe.toFixed(2)}%` : '—',
  },
  {
    key: '_action',
    header: '액션',
    align: 'center',
    sortable: false,
    filterable: false,
    render: (row) => (
      <button
        onClick={(e) => { e.stopPropagation(); handleAddToWatchlist(row.stk_cd); }}
        className="p-1 hover:bg-yellow-500/10 rounded transition-colors"
        title="관심종목에 추가"
      >
        <Star size={14} className="text-gray-500 hover:text-yellow-400 transition-colors" />
      </button>
    ),
  },
];

export default function ScreenerResults({ results, preset }) {
  return (
    <div className="space-y-4">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">
          검색 결과 ({(results || []).length}개 종목)
        </h2>
        {preset && (
          <p className="text-sm text-gray-400 mt-1">프리셋: {preset.name}</p>
        )}
      </div>

      {/* Results Table */}
      <div className="bg-[#0d0d12] rounded-xl border border-gray-800 overflow-hidden">
        <WidgetTable
          columns={COLUMNS}
          data={(results || []).map((s, i) => ({ ...s, _key: s.stk_cd ?? i }))}
          emptyMessage="검색 결과가 없습니다. 다른 필터 조건으로 다시 시도해보세요."
          resizable={true}
          showExport={true}
          exportFilename="screener-results"
          showFilters={true}
          defaultSortKey="market_cap"
          defaultSortDirection="desc"
        />
      </div>
    </div>
  );
}
