import { Calendar } from 'lucide-react';
import WidgetTable from '../widgets/common/WidgetTable';

const columns = (benchmark) => [
  {
    key: 'year',
    header: '연도',
    sortable: true,
    sortValue: (row) => row.year,
  },
  {
    key: 'return',
    header: '포트폴리오',
    align: 'right',
    sortable: true,
    sortValue: (row) => parseFloat(row.return || 0),
    exportValue: (row) => parseFloat(row.return || 0).toFixed(2) + '%',
    render: (row) => {
      const val = parseFloat(row.return || 0);
      return (
        <span className={`font-semibold ${val >= 0 ? 'text-green-400' : 'text-red-400'}`}>
          {val >= 0 ? '+' : ''}{val.toFixed(2)}%
        </span>
      );
    },
  },
  {
    key: 'benchmark',
    header: benchmark,
    align: 'right',
    sortable: true,
    sortValue: (row) => parseFloat(row.benchmark || 0),
    exportValue: (row) => parseFloat(row.benchmark || 0).toFixed(2) + '%',
    render: (row) => {
      const val = parseFloat(row.benchmark || 0);
      return (
        <span className={val >= 0 ? 'text-green-400/80' : 'text-red-400/80'}>
          {val >= 0 ? '+' : ''}{val.toFixed(2)}%
        </span>
      );
    },
  },
  {
    key: 'alpha',
    header: '알파',
    align: 'right',
    sortable: true,
    sortValue: (row) => parseFloat(row.return || 0) - parseFloat(row.benchmark || 0),
    exportValue: (row) => {
      const alpha = parseFloat(row.return || 0) - parseFloat(row.benchmark || 0);
      return alpha.toFixed(2) + '%';
    },
    render: (row) => {
      const alpha = parseFloat(row.return || 0) - parseFloat(row.benchmark || 0);
      return (
        <span className={`font-semibold ${alpha >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
          {alpha >= 0 ? '+' : ''}{alpha.toFixed(2)}%
        </span>
      );
    },
  },
];

export default function PerformanceTable({ yearlyReturns = [], benchmark = 'SPY' }) {
  return (
    <div className="bg-[#0d0d12] border border-gray-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calendar size={14} className="text-gray-400" />
        <h3 className="text-sm font-semibold text-white">연도별 수익률</h3>
      </div>

      <WidgetTable
        columns={columns(benchmark)}
        data={yearlyReturns.map((row, i) => ({ ...row, _key: row.year ?? i }))}
        emptyMessage="연도별 데이터가 없습니다"
        resizable={true}
        showExport={false}
        size="compact"
        defaultSortKey="year"
        defaultSortDirection="desc"
      />
    </div>
  );
}
