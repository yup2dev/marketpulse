/**
 * 거래 내역 테이블
 */
import WidgetTable from '../widgets/common/WidgetTable';

const TYPE_INFO = {
  buy:      { text: '매수', cls: 'bg-green-500/20 text-green-400 border border-green-500/30' },
  sell:     { text: '매도', cls: 'bg-red-500/20   text-red-400   border border-red-500/30'   },
  dividend: { text: '배당', cls: 'bg-blue-500/20  text-blue-400  border border-blue-500/30'  },
};

const getTypeInfo = (type) =>
  TYPE_INFO[type] || { text: type, cls: 'bg-gray-500/20 text-gray-400 border border-gray-500/30' };

const COLUMNS = [
  {
    key: 'transaction_date',
    header: '일시',
    sortable: true,
    sortValue: (row) => row.transaction_date,
    exportValue: (row) =>
      new Date(row.transaction_date).toLocaleString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      }),
    render: (row) =>
      new Date(row.transaction_date).toLocaleString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      }),
  },
  {
    key: 'transaction_type',
    header: '유형',
    sortable: true,
    sortValue: (row) => row.transaction_type,
    exportValue: (row) => getTypeInfo(row.transaction_type).text,
    render: (row) => {
      const { text, cls } = getTypeInfo(row.transaction_type);
      return (
        <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${cls}`}>
          {text}
        </span>
      );
    },
  },
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
    key: 'price',
    header: '가격',
    align: 'right',
    sortable: true,
    sortValue: (row) => parseFloat(row.price),
    exportValue: (row) => '$' + parseFloat(row.price).toFixed(2),
    render: (row) => '$' + parseFloat(row.price).toFixed(2),
  },
  {
    key: 'commission',
    header: '수수료',
    align: 'right',
    sortable: true,
    sortValue: (row) => parseFloat(row.commission || 0),
    exportValue: (row) => '$' + parseFloat(row.commission || 0).toFixed(2),
    render: (row) => (
      <span className="text-gray-400">
        ${parseFloat(row.commission || 0).toFixed(2)}
      </span>
    ),
  },
  {
    key: 'total_amount',
    header: '총액',
    align: 'right',
    sortable: true,
    sortValue: (row) => parseFloat(row.total_amount),
    exportValue: (row) => '$' + parseFloat(row.total_amount).toFixed(2),
    render: (row) => (
      <span className="font-semibold">
        ${parseFloat(row.total_amount).toFixed(2)}
      </span>
    ),
  },
  {
    key: 'notes',
    header: '메모',
    render: (row) => (
      <span className="text-gray-400 text-xs truncate max-w-[140px] block">
        {row.notes || '—'}
      </span>
    ),
    exportValue: (row) => row.notes || '',
  },
];

export default function TransactionsTable({ transactions }) {
  return (
    <div className="overflow-x-auto">
      <WidgetTable
        columns={COLUMNS}
        data={(transactions || []).map((t, i) => ({ ...t, _key: t.transaction_id ?? i }))}
        emptyMessage="거래 내역이 없습니다."
        resizable={true}
        showExport={true}
        exportFilename="transactions"
        defaultSortKey="transaction_date"
        defaultSortDirection="desc"
        showFilters={true}
      />
    </div>
  );
}
