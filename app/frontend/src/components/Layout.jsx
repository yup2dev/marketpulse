import { useState } from 'react';
import { TrendingUp, Grid3x3, LayoutDashboard, BarChart3, Briefcase, Globe, Bell, LogOut, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import useTheme from '../hooks/useTheme';
import ThemeToggle from './ThemeToggle';
import useMenus from '../hooks/useMenus';
import MenuDropdown from './MenuDropdown';

const Layout = ({ children, activeView, onNavigate }) => {
  const navigate = useNavigate();
  const { user, logout } = useAuthStore();
  const { classes } = useTheme();
  const { menus, loading: menusLoading } = useMenus();
  const [hoveredMenu, setHoveredMenu] = useState(null);

  const handleLogout = async () => {
    await logout();
    toast.success('로그아웃되었습니다.');
    navigate('/login');
  };

  // Icon mapping from string to component
  const iconMap = {
    'Grid3x3': Grid3x3,
    'LayoutDashboard': LayoutDashboard,
    'Globe': Globe,
    'BarChart3': BarChart3,
    'Briefcase': Briefcase,
    'Bell': Bell,
  };

  // Get icon component from string
  const getIcon = (iconName) => {
    const IconComponent = iconMap[iconName];
    return IconComponent ? <IconComponent size={18} /> : null;
  };

  // Handle navigation - supports both direct paths and query params
  const handleMenuNavigate = (menuPath) => {
    // Extract base path and query string
    const [basePath, queryString] = menuPath.split('?');

    // Call onNavigate with base path
    onNavigate(basePath);

    // If there's a query string, update URL
    if (queryString) {
      const searchParams = new URLSearchParams(queryString);
      navigate(`?${searchParams.toString()}`);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      {/* Header */}
      <header className={`${classes.layout.header} border-b sticky top-0 z-40`}>
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-2 rounded-lg">
                <TrendingUp className="text-white" size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-bold text-white">MarketPulse</h1>
                <p className="text-xs text-gray-400">Real-time Stock Analytics</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <nav className="flex items-center gap-2">
                {menusLoading ? (
                  // Loading state - show skeleton
                  <div className="flex items-center gap-2">
                    {[1, 2, 3, 4].map((i) => (
                      <div key={i} className="h-9 w-24 bg-gray-800 rounded-lg animate-pulse" />
                    ))}
                  </div>
                ) : (
                  // Render dynamic menus from DB
                  menus.map((menu) => (
                    <div
                      key={menu.menu_id}
                      className="relative"
                      onMouseEnter={() => menu.children && menu.children.length > 0 && setHoveredMenu(menu.menu_id)}
                      onMouseLeave={() => setHoveredMenu(null)}
                    >
                      <button
                        onClick={() => handleMenuNavigate(menu.menu_path)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-all ${
                          activeView === menu.menu_path
                            ? 'bg-gradient-to-r from-blue-600 to-purple-600 text-white shadow-lg shadow-blue-500/20'
                            : 'text-gray-300 hover:text-white hover:bg-gray-800'
                        }`}
                      >
                        {getIcon(menu.menu_icon)}
                        <span className="text-sm font-medium">{menu.menu_name}</span>
                      </button>

                      {/* Dropdown for sub-menus */}
                      {hoveredMenu === menu.menu_id && menu.children && menu.children.length > 0 && (
                        <MenuDropdown
                          menuItems={menu.children}
                          onNavigate={handleMenuNavigate}
                        />
                      )}
                    </div>
                  ))
                )}
              </nav>

            {/* User Menu */}
            <div className="flex items-center gap-3 ml-4 pl-4 border-l border-gray-700">
              <div className="flex items-center gap-2 text-gray-300">
                <User size={18} />
                <span className="text-sm">{user?.username || user?.email}</span>
              </div>

              {/* Theme Toggle */}
              <ThemeToggle />

              <button
                onClick={handleLogout}
                className="flex items-center gap-2 px-3 py-2 rounded-lg text-gray-300 hover:text-white hover:bg-gray-800 transition-all"
                title="로그아웃"
              >
                <LogOut size={18} />
                <span className="text-sm font-medium">로그아웃</span>
              </button>
            </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>

      {/* Footer */}
      <footer className={`${classes.layout.footer} border-t mt-auto`}>
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
