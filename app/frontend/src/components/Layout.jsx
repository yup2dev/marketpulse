import { TrendingUp } from 'lucide-react';

const Layout = ({ children }) => {
  return (
    <div className="min-h-screen bg-[#0d0d0d] flex flex-col">
      {/* Header */}
      <header className="bg-[#1a1a1a] border-b border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-blue-600 p-2 rounded-lg">
                <TrendingUp className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">MarketPulse</h1>
                <p className="text-xs text-gray-400">Real-time Stock Analytics</p>
              </div>
            </div>
            <nav className="flex items-center gap-6">
              <a href="#dashboard" className="text-gray-300 hover:text-white transition-colors text-sm">
                Dashboard
              </a>
              <a href="#markets" className="text-gray-300 hover:text-white transition-colors text-sm">
                Markets
              </a>
              <a href="#portfolio" className="text-gray-300 hover:text-white transition-colors text-sm">
                Portfolio
              </a>
              <a href="#watchlist" className="text-gray-300 hover:text-white transition-colors text-sm">
                Watchlist
              </a>
            </nav>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className="bg-[#1a1a1a] border-t border-gray-800 mt-auto">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="grid grid-cols-4 gap-8 mb-6">
            <div>
              <h3 className="text-white font-semibold mb-3">MarketPulse</h3>
              <p className="text-gray-400 text-sm">
                Professional-grade stock market analytics and portfolio management platform.
              </p>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-3">Products</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Stock Screener</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Market Data</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Financial Reports</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">API Access</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-3">Resources</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Documentation</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Tutorials</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Blog</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Community</a></li>
              </ul>
            </div>
            <div>
              <h3 className="text-white font-semibold mb-3">Company</h3>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">About Us</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Careers</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Contact</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Privacy Policy</a></li>
              </ul>
            </div>
          </div>
          <div className="pt-6 border-t border-gray-800 flex items-center justify-between">
            <p className="text-gray-400 text-sm">
              © 2025 MarketPulse. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Terms</a>
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Privacy</a>
              <a href="#" className="text-gray-400 hover:text-white text-sm transition-colors">Cookies</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default Layout;
