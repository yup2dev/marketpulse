import React from 'react';
import { Calendar } from 'lucide-react';

const PerformanceTable = ({ yearlyReturns = [], benchmark = 'SPY' }) => {
  if (yearlyReturns.length === 0) {
    return (
      <div className="bg-[#0d0d12] border border-gray-800 rounded-xl p-5">
        <div className="flex items-center gap-2 mb-3">
          <Calendar size={14} className="text-gray-500" />
          <h3 className="text-sm font-semibold text-white">연도별 수익률</h3>
        </div>
        <p className="text-center text-gray-600 text-xs py-6">연도별 데이터가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="bg-[#0d0d12] border border-gray-800 rounded-xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <Calendar size={14} className="text-gray-400" />
        <h3 className="text-sm font-semibold text-white">연도별 수익률</h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">연도</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">포트폴리오</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">{benchmark}</th>
              <th className="text-right py-2.5 px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">알파</th>
            </tr>
          </thead>
          <tbody>
            {yearlyReturns.map((row, idx) => {
              const port = parseFloat(row.return || 0);
              const bench = parseFloat(row.benchmark || 0);
              const alpha = port - bench;

              return (
                <tr
                  key={row.year || idx}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="py-2.5 px-3 font-medium text-gray-300">{row.year}</td>
                  <td className={`py-2.5 px-3 text-right font-semibold ${port >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {port >= 0 ? '+' : ''}{port.toFixed(2)}%
                  </td>
                  <td className={`py-2.5 px-3 text-right ${bench >= 0 ? 'text-green-400/80' : 'text-red-400/80'}`}>
                    {bench >= 0 ? '+' : ''}{bench.toFixed(2)}%
                  </td>
                  <td className={`py-2.5 px-3 text-right font-semibold ${alpha >= 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                    {alpha >= 0 ? '+' : ''}{alpha.toFixed(2)}%
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default PerformanceTable;
