/**
 * Analysis 기관 보유 탭
 */
import { Building2 } from 'lucide-react';
import { useStockContext } from './AnalysisDashboard';
import InstitutionalPortfolios from '../InstitutionalPortfolios';

export default function AnalysisInstitutionalTab() {
  const { symbol } = useStockContext();

  return (
    <div className="max-w-7xl mx-auto px-6">
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center gap-3">
          <Building2 className="text-purple-500" size={28} />
          <div>
            <h2 className="text-xl font-bold text-white">기관 보유 현황</h2>
            <p className="text-gray-400 text-sm mt-0.5">{symbol} - 기관 투자자 포트폴리오 분석</p>
          </div>
        </div>

        {/* Institutional Holdings Component */}
        <InstitutionalPortfolios symbol={symbol} />
      </div>
    </div>
  );
}
