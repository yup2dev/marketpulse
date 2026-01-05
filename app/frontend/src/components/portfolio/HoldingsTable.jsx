/**
 * 보유 종목 테이블
 */
import { TrendingUp, TrendingDown } from 'lucide-react';

export default function HoldingsTable({ holdings }) {
  if (!holdings || holdings.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">보유 중인 종목이 없습니다.</p>
        <p className="text-sm text-gray-400 mt-2">거래를 추가하여 포트폴리오를 시작하세요.</p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200">
            <th className="text-left py-3 px-4 font-semibold text-gray-700">종목</th>
            <th className="text-right py-3 px-4 font-semibold text-gray-700">수량</th>
            <th className="text-right py-3 px-4 font-semibold text-gray-700">평균 매입가</th>
            <th className="text-right py-3 px-4 font-semibold text-gray-700">현재가</th>
            <th className="text-right py-3 px-4 font-semibold text-gray-700">평가액</th>
            <th className="text-right py-3 px-4 font-semibold text-gray-700">손익</th>
            <th className="text-right py-3 px-4 font-semibold text-gray-700">수익률</th>
          </tr>
        </thead>
        <tbody>
          {holdings.map((holding) => {
            const pnl = parseFloat(holding.unrealized_pnl) || 0;
            const pnlPct = parseFloat(holding.unrealized_pnl_pct) || 0;
            const isProfit = pnl >= 0;

            return (
              <tr
                key={holding.holding_id}
                className="border-b border-gray-100 hover:bg-gray-50 transition-colors"
              >
                <td className="py-3 px-4">
                  <div className="font-semibold text-gray-900">{holding.ticker_cd}</div>
                </td>
                <td className="text-right py-3 px-4 text-gray-900">
                  {parseFloat(holding.quantity).toFixed(8)}
                </td>
                <td className="text-right py-3 px-4 text-gray-900">
                  ${parseFloat(holding.avg_cost || 0).toFixed(2)}
                </td>
                <td className="text-right py-3 px-4 text-gray-900">
                  ${parseFloat(holding.current_price || 0).toFixed(2)}
                </td>
                <td className="text-right py-3 px-4 font-semibold text-gray-900">
                  ${parseFloat(holding.market_value || 0).toFixed(2)}
                </td>
                <td className={`text-right py-3 px-4 font-semibold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                  <div className="flex items-center justify-end gap-1">
                    {isProfit ? <TrendingUp size={16} /> : <TrendingDown size={16} />}
                    <span>${Math.abs(pnl).toFixed(2)}</span>
                  </div>
                </td>
                <td className={`text-right py-3 px-4 font-semibold ${isProfit ? 'text-green-600' : 'text-red-600'}`}>
                  {isProfit ? '+' : ''}{pnlPct.toFixed(2)}%
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
