import { useState } from 'react';
import ProfessionalDashboard from './components/ProfessionalDashboard';
import ImprovedStockDashboard from './components/ImprovedStockDashboard';
import { LayoutDashboard, Grid3x3 } from 'lucide-react';

function App() {
  const [activeView, setActiveView] = useState('professional'); // 'professional' or 'stock'

  return (
    <div className="relative">
      {/* View Switcher - Fixed at top right */}
      <div className="fixed top-20 right-6 z-50 flex gap-2 bg-[#1a1a1a] p-1 rounded-lg border border-gray-800 shadow-lg">
        <button
          onClick={() => setActiveView('professional')}
          className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
            activeView === 'professional'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
          title="Professional Dashboard"
        >
          <Grid3x3 size={18} />
          <span className="text-sm font-medium">Dashboard</span>
        </button>
        <button
          onClick={() => setActiveView('stock')}
          className={`flex items-center gap-2 px-3 py-2 rounded transition-colors ${
            activeView === 'stock'
              ? 'bg-blue-600 text-white'
              : 'text-gray-400 hover:text-white hover:bg-gray-800'
          }`}
          title="Stock Analysis"
        >
          <LayoutDashboard size={18} />
          <span className="text-sm font-medium">Analysis</span>
        </button>
      </div>

      {/* Main Content */}
      {activeView === 'professional' ? <ProfessionalDashboard /> : <ImprovedStockDashboard />}
    </div>
  );
}

export default App;
