/**
 * Analysis 기관 보유 탭 - Static Grid Layout
 */
import { useStockContext } from './AnalysisDashboard';
import InstitutionalPortfolios from '../InstitutionalPortfolios';

export default function AnalysisInstitutionalTab() {
  const { symbol } = useStockContext();

  return (
    <div className="h-full">
      <div className="grid grid-cols-12 gap-1 h-[calc(100vh-180px)]">
        <div className="col-span-12 min-h-[280px]">
          <InstitutionalPortfolios symbol={symbol} />
        </div>
      </div>
    </div>
  );
}
