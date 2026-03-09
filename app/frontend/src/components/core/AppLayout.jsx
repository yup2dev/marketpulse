/**
 * AppLayout - Common layout for all authenticated pages
 * Hyperliquid-style header with left-aligned navigation
 */
import { useState, useCallback, useMemo } from 'react';
import {
  TrendingUp, LayoutDashboard, BarChart3, Briefcase,
  Globe, LogOut, Settings, ChevronDown,
} from 'lucide-react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import useMenus from '../../hooks/useMenus';
import ThemeToggle from '../common/ThemeToggle';
import { GlobalWidgetContext } from '../../contexts/GlobalWidgetContext';

// Menu path to URL route mapping
const ROUTE_MAP = {
  'professional':       '/',
  'stock':              '/stock',
  'macro-analysis':     '/macro',
  'portfolio-settings': '/portfolios',
};

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { menus, loading: menusLoading } = useMenus();
  const [hoveredMenu, setHoveredMenu] = useState(null);

  const registerWidgets = useCallback(() => {}, []);
  const unregisterWidgets = useCallback(() => {}, []);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  const handleMenuNavigate = (menuPath) => {
    const [basePath, queryString] = menuPath.split('?');
    const route = ROUTE_MAP[basePath] ?? '/';
    navigate(queryString ? `${route}?${queryString}` : route);
  };

  const isMenuActive = (menuPath) => {
    const [basePath] = menuPath.split('?');
    const route = ROUTE_MAP[basePath];
    return !!route && location.pathname === route;
  };

  const contextValue = useMemo(() => ({ registerWidgets, unregisterWidgets }), [registerWidgets, unregisterWidgets]);

  return (
    <GlobalWidgetContext.Provider value={contextValue}>
    <div className="min-h-screen flex flex-col bg-[#0d0d0d]">
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b border-gray-800 bg-[#0d0d0d]">
        <div className="px-6">
          <div className="flex items-center h-14">
            {/* Logo */}
            <div
              className="flex items-center gap-2.5 cursor-pointer mr-8"
              onClick={() => navigate('/')}
            >
              <div className="bg-gradient-to-r from-cyan-500 to-blue-500 p-1.5 rounded-lg">
                <TrendingUp className="text-white" size={18} />
              </div>
              <span className="text-base font-semibold text-white tracking-tight">MarketPulse</span>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-0.5 flex-1">
              {menusLoading ? (
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-8 w-20 bg-gray-800/50 rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                menus.map((menu) => {
                  const isActive = isMenuActive(menu.menu_path);
                  return (
                    <div
                      key={menu.menu_id}
                      className="relative"
                      onMouseEnter={() => menu.children?.length > 0 && setHoveredMenu(menu.menu_id)}
                      onMouseLeave={() => setHoveredMenu(null)}
                    >
                      <button
                        onClick={() => handleMenuNavigate(menu.menu_path)}
                        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                          isActive ? 'text-cyan-400' : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <span>{menu.menu_name}</span>
                        {menu.children?.length > 0 && (
                          <ChevronDown size={14} className={isActive ? 'text-cyan-400' : 'text-gray-500'} />
                        )}
                      </button>

                      {hoveredMenu === menu.menu_id && menu.children?.length > 0 && (
                        <div className="absolute top-full left-0 mt-1 py-2 bg-[#0d0d12] border border-gray-800 rounded-lg shadow-xl min-w-[180px] z-50">
                          {menu.children.map((child) => (
                            <button
                              key={child.menu_id}
                              onClick={() => { handleMenuNavigate(child.menu_path); setHoveredMenu(null); }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
                            >
                              {child.menu_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </nav>

            {/* Right Section */}
            <div className="flex items-center gap-1">
              <ThemeToggle />
              <button className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors">
                <Settings size={16} />
              </button>
              <div className="flex items-center gap-1.5 ml-2 pl-3 border-l border-gray-800">
                <div className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-800/50 cursor-pointer transition-colors">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
                    <span className="text-xs font-medium text-white">
                      {(user?.username || user?.email || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm text-gray-300 hidden sm:inline">
                    {user?.username || user?.email?.split('@')[0]}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
                  title="Logout"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 pt-14">
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-[#0d0d0d]">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-xs text-gray-500">Online</span>
            </div>
            <span className="text-xs text-gray-500">© 2025 MarketPulse</span>
          </div>
        </div>
      </footer>
    </div>
    </GlobalWidgetContext.Provider>
  );
};

export default AppLayout;
