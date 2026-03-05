/**
 * 보유 종목 테이블
 */
import { TrendingUp, TrendingDown } from 'lucide-react';
import CommonTable from '../common/CommonTable';

const COLUMNS = [
  {
    key: 'ticker_cd',
    header: '종목',
    renderFn: (value) => <span className="font-semibold text-white">{value}</span>,
  },
  {
    key: 'quantity',
    header: '수량',
    align: 'right',
    renderFn: (value) => parseFloat(value).toFixed(8),
  },
  {
    key: 'avg_cost',
    header: '평균 매입가',
    align: 'right',
    formatter: 'currency',
  },
  {
    key: 'current_price',
    header: '현재가',
    align: 'right',
    formatter: 'currency',
  },
  {
    key: 'market_value',
    header: '평가액',
    align: 'right',
    renderFn: (value) => (
      <span className="font-semibold">${parseFloat(value || 0).toFixed(2)}</span>
    ),
  },
  {
    key: 'unrealized_pnl',
    header: '손익',
    align: 'right',
    renderFn: (value) => {
      const pnl = parseFloat(value) || 0;
      const isProfit = pnl >= 0;
      return (
        <div className={`flex items-center justify-end gap-1 font-semibold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
          {isProfit ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
          <span>${Math.abs(pnl).toFixed(2)}</span>
        </div>
      );
    },
  },
  {
    key: 'unrealized_pnl_pct',
    header: '수익률',
    align: 'right',
    formatter: 'percent',
    renderFn: 'greenRed',
  },
];

export default function HoldingsTable({ holdings }) {
  return (
    <CommonTable
      columns={COLUMNS}
      data={holdings || []}
      exportable
      searchable
      pageSize={20}
    />
  );
}
