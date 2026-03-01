/**
 * 보유 종목 테이블
 */
import { TrendingUp, TrendingDown } from 'lucide-react';
import WidgetTable from '../widgets/common/WidgetTable';

const COLUMNS = [
  {
    key: 'ticker_cd',
    header: '종목',
    sortable: true,
    sortValue: (row) => row.ticker_cd,
    render: (row) => (
      <span className="font-semibold text-white">{row.ticker_cd}</span>
    ),
  },
  {
    key: 'quantity',
    header: '수량',
    align: 'right',
    sortable: true,
    sortValue: (row) => parseFloat(row.quantity),
    exportValue: (row) => parseFloat(row.quantity).toFixed(8),
    render: (row) => parseFloat(row.quantity).toFixed(8),
  },
  {
    key: 'avg_cost',
    header: '평균 매입가',
    align: 'right',
    sortable: true,
    sortValue: (row) => parseFloat(row.avg_cost || 0),
    exportValue: (row) => '$' + parseFloat(row.avg_cost || 0).toFixed(2),
    render: (row) => '$' + parseFloat(row.avg_cost || 0).toFixed(2),
  },
  {
    key: 'current_price',
    header: '현재가',
    align: 'right',
    sortable: true,
    sortValue: (row) => parseFloat(row.current_price || 0),
    exportValue: (row) => '$' + parseFloat(row.current_price || 0).toFixed(2),
    render: (row) => '$' + parseFloat(row.current_price || 0).toFixed(2),
  },
  {
    key: 'market_value',
    header: '평가액',
    align: 'right',
    sortable: true,
    sortValue: (row) => parseFloat(row.market_value || 0),
    exportValue: (row) => '$' + parseFloat(row.market_value || 0).toFixed(2),
    render: (row) => (
      <span className="font-semibold">
        ${parseFloat(row.market_value || 0).toFixed(2)}
      </span>
    ),
  },
  {
    key: 'unrealized_pnl',
    header: '손익',
    align: 'right',
    sortable: true,
    sortValue: (row) => parseFloat(row.unrealized_pnl),
    exportValue: (row) => {
      const pnl = parseFloat(row.unrealized_pnl) || 0;
      return (pnl >= 0 ? '+$' : '-$') + Math.abs(pnl).toFixed(2);
    },
    render: (row) => {
      const pnl = parseFloat(row.unrealized_pnl) || 0;
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
    sortable: true,
    sortValue: (row) => parseFloat(row.unrealized_pnl_pct),
    exportValue: (row) => {
      const pct = parseFloat(row.unrealized_pnl_pct) || 0;
      return (pct >= 0 ? '+' : '') + pct.toFixed(2) + '%';
    },
    render: (row) => {
      const pct = parseFloat(row.unrealized_pnl_pct) || 0;
      const isProfit = pct >= 0;
      return (
        <span className={`font-semibold ${isProfit ? 'text-green-400' : 'text-red-400'}`}>
          {isProfit ? '+' : ''}{pct.toFixed(2)}%
        </span>
      );
    },
  },
];

export default function HoldingsTable({ holdings }) {
  return (
    <div className="overflow-x-auto">
      <WidgetTable
        columns={COLUMNS}
        data={(holdings || []).map((h, i) => ({ ...h, _key: h.holding_id ?? i }))}
        emptyMessage="보유 중인 종목이 없습니다."
        resizable={true}
        showExport={true}
        exportFilename="holdings"
        defaultSortKey="market_value"
        defaultSortDirection="desc"
      />
    </div>
  );
}
