/**
 * 스크리너 결과 테이블
 */
import { Star, TrendingUp, TrendingDown } from 'lucide-react';
import toast from 'react-hot-toast';
import CommonTable from '../common/CommonTable';

const handleAddToWatchlist = (ticker) => {
  // TODO: Implement add to watchlist
  toast.success(`${ticker}를 관심종목에 추가했습니다`);
};

const COLUMNS = [
  {
    key: 'stk_cd',
    header: '종목코드',
    renderFn: (value) => <span className="font-semibold text-white">{value}</span>,
  },
  {
    key: 'stk_nm',
    header: '종목명',
  },
  {
    key: 'sector',
    header: '섹터',
    renderFn: (value) => <span className="text-gray-400">{value || '—'}</span>,
  },
  {
    key: 'close_price',
    header: '현재가',
    align: 'right',
    formatter: 'currency',
  },
  {
    key: 'change_rate',
    header: '등락률',
    align: 'right',
    formatter: 'percent',
    renderFn: (value) => {
      if (value == null) return '—';
      const pos = value >= 0;
      return (
        <span className={`flex items-center justify-end gap-1 font-medium ${pos ? 'text-green-400' : 'text-red-400'}`}>
          {pos ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          {Number(value).toFixed(2)}%
        </span>
      );
    },
  },
  {
    key: 'market_cap',
    header: '시가총액',
    align: 'right',
    formatter: 'magnitude',
  },
  {
    key: 'pe_ratio',
    header: 'PER',
    align: 'right',
    formatter: 'number',
  },
  {
    key: 'roe',
    header: 'ROE',
    align: 'right',
    formatter: 'percent',
  },
  {
    key: '_action',
    header: '액션',
    align: 'center',
    sortable: false,
    accessorFn: (row) => row.stk_cd,
    renderFn: (value) => (
      <button
        onClick={(e) => { e.stopPropagation(); handleAddToWatchlist(value); }}
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
      <div>
        <h2 className="text-xl font-bold text-white">
          검색 결과 ({(results || []).length}개 종목)
        </h2>
        {preset && (
          <p className="text-sm text-gray-400 mt-1">프리셋: {preset.name}</p>
        )}
      </div>

      <div className="bg-[#0d0d12] rounded-xl border border-gray-800 overflow-hidden">
        <CommonTable
          columns={COLUMNS}
          data={results || []}
          exportable
          searchable
          pageSize={20}
        />
      </div>
    </div>
  );
}
