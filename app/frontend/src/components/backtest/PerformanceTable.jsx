import React from 'react';
import { CARD_CLASSES } from '../../styles/designTokens';

/**
 * PerformanceTable - Yearly returns comparison table
 */
const PerformanceTable = ({ yearlyReturns = [], className = '' }) => {
  if (yearlyReturns.length === 0) {
    return (
      <div className={`${CARD_CLASSES.default} ${className}`}>
        <h3 className="text-lg font-semibold text-white mb-4">Yearly Returns</h3>
        <p className="text-center text-gray-500 py-8">No yearly data available</p>
      </div>
    );
  }

  return (
    <div className={`${CARD_CLASSES.default} ${className}`}>
      <h3 className="text-lg font-semibold text-white mb-4">Yearly Returns</h3>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-800">
              <th className="text-left py-3 px-4 text-sm font-semibold text-gray-400">Year</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Portfolio</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Benchmark</th>
              <th className="text-right py-3 px-4 text-sm font-semibold text-gray-400">Alpha</th>
            </tr>
          </thead>
          <tbody>
            {yearlyReturns.map((row, index) => {
              const portfolioReturn = parseFloat(row.return || 0);
              const benchmarkReturn = parseFloat(row.benchmark || 0);
              const alpha = portfolioReturn - benchmarkReturn;

              return (
                <tr
                  key={row.year || index}
                  className="border-b border-gray-800/50 hover:bg-gray-800/30 transition-colors"
                >
                  <td className="py-3 px-4 font-medium text-white">{row.year}</td>
                  <td className={`py-3 px-4 text-right font-semibold ${
                    portfolioReturn >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {portfolioReturn >= 0 ? '+' : ''}{portfolioReturn.toFixed(2)}%
                  </td>
                  <td className={`py-3 px-4 text-right font-medium ${
                    benchmarkReturn >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {benchmarkReturn >= 0 ? '+' : ''}{benchmarkReturn.toFixed(2)}%
                  </td>
                  <td className={`py-3 px-4 text-right font-semibold ${
                    alpha >= 0 ? 'text-green-400' : 'text-red-400'
                  }`}>
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
