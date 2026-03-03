/**
 * 거래 내역 테이블
 */
import CommonTable from '../common/CommonTable';

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
    formatter: 'date',
    renderFn: (value) =>
      value ? new Date(value).toLocaleString('ko-KR', {
        year: 'numeric', month: '2-digit', day: '2-digit',
        hour: '2-digit', minute: '2-digit',
      }) : '—',
  },
  {
    key: 'transaction_type',
    header: '유형',
    renderFn: (value) => {
      const { text, cls } = getTypeInfo(value);
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
    renderFn: (value) => <span className="font-semibold text-white">{value}</span>,
  },
  {
    key: 'quantity',
    header: '수량',
    align: 'right',
    renderFn: (value) => parseFloat(value).toFixed(8),
  },
  {
    key: 'price',
    header: '가격',
    align: 'right',
    formatter: 'currency',
  },
  {
    key: 'commission',
    header: '수수료',
    align: 'right',
    renderFn: (value) => (
      <span className="text-gray-400">${parseFloat(value || 0).toFixed(2)}</span>
    ),
  },
  {
    key: 'total_amount',
    header: '총액',
    align: 'right',
    renderFn: (value) => (
      <span className="font-semibold">${parseFloat(value).toFixed(2)}</span>
    ),
  },
  {
    key: 'notes',
    header: '메모',
    renderFn: (value) => (
      <span className="text-gray-400 text-xs truncate max-w-[140px] block">
        {value || '—'}
      </span>
    ),
  },
];

export default function TransactionsTable({ transactions }) {
  return (
    <CommonTable
      columns={COLUMNS}
      data={transactions || []}
      exportable
      searchable
      pageSize={20}
    />
  );
}
