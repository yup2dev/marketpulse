/**
 * DashboardContent - Main dashboard content based on URL view parameter
 */
import { useSearchParams } from 'react-router-dom';
import ProfessionalDashboard from '../components/ProfessionalDashboard';
import ImprovedStockDashboard from '../components/ImprovedStockDashboard';
import UnifiedBacktest from '../components/UnifiedBacktest';
import MacroDashboard from '../components/macro/MacroDashboard';

export default function DashboardContent() {
  const [searchParams] = useSearchParams();
  const view = searchParams.get('view') || 'professional';

  return (
    <>
      {view === 'professional' && <ProfessionalDashboard />}
      {view === 'stock' && <ImprovedStockDashboard />}
      {view === 'macro-analysis' && <MacroDashboard />}
      {view === 'unified-backtest' && <UnifiedBacktest />}
    </>
  );
}
