import { useState } from 'react';
import Layout from './components/Layout';
import ProfessionalDashboard from './components/ProfessionalDashboard';
import ImprovedStockDashboard from './components/ImprovedStockDashboard';
import UnifiedBacktest from './components/UnifiedBacktest';
import PortfolioSettings from './components/PortfolioSettings';
import MacroAnalysis from './components/MacroAnalysis';

function App() {
  const [activeView, setActiveView] = useState('professional'); // 'professional', 'stock', 'macro-analysis', 'unified-backtest', or 'portfolio-settings'

  return (
    <Layout activeView={activeView} onNavigate={setActiveView}>
      {activeView === 'professional' && <ProfessionalDashboard />}
      {activeView === 'stock' && <ImprovedStockDashboard />}
      {activeView === 'macro-analysis' && <MacroAnalysis />}
      {activeView === 'unified-backtest' && <UnifiedBacktest />}
      {activeView === 'portfolio-settings' && <PortfolioSettings onNavigate={setActiveView} />}
    </Layout>
  );
}

export default App;
