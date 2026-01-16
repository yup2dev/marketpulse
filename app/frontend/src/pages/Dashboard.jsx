/**
 * 대시보드 페이지 (기존 App.jsx 내용을 옮김)
 */
import { useState } from 'react';
import Layout from '../components/Layout';
import ProfessionalDashboard from '../components/ProfessionalDashboard';
import ImprovedStockDashboard from '../components/ImprovedStockDashboard';
import UnifiedBacktest from '../components/UnifiedBacktest';
import PortfolioSettings from '../components/PortfolioSettings';
import AlertsDashboard from '../components/alerts/AlertsDashboard';
import MacroDashboard from '../components/macro/MacroDashboard';

export default function Dashboard() {
  const [activeView, setActiveView] = useState('professional');

  return (
    <Layout activeView={activeView} onNavigate={setActiveView}>
      {activeView === 'professional' && <ProfessionalDashboard />}
      {activeView === 'stock' && <ImprovedStockDashboard />}
      {activeView === 'macro-analysis' && <MacroDashboard />}
      {activeView === 'unified-backtest' && <UnifiedBacktest />}
      {activeView === 'portfolio-settings' && (
        <PortfolioSettings onNavigate={setActiveView} />
      )}
      {activeView === 'alerts' && <AlertsDashboard />}
    </Layout>
  );
}
