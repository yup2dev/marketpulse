/**
 * AppLayout - Common layout for all authenticated pages
 * Hyperliquid-style header with left-aligned navigation
 */
import { useState, useCallback, useMemo, useEffect } from 'react';
import {
  TrendingUp, LayoutDashboard, BarChart3, Briefcase,
  Globe, LogOut, Settings, ChevronDown, Search, Sparkles,
} from 'lucide-react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import useMenus from '../../hooks/useMenus';
import ThemeToggle from '../common/ThemeToggle';
import { GlobalWidgetContext } from '../../contexts/GlobalWidgetContext';
import { WidgetSyncProvider } from '../../contexts/WidgetSyncContext';
import CommandPalette from '../common/CommandPalette';
import FetcherStatus from './FetcherStatus';
import CopilotPanel from '../copilot/CopilotPanel';

// Menu path to URL route mapping
const ROUTE_MAP = {
  'professional':       '/',
  'stock':              '/stock',
  'macro-analysis':     '/macro',
  'portfolio-settings': '/portfolios',
  'screener':           '/screener',
  'quantlib':           '/quantlib',
  'backtest':           '/backtest',
  'calendar':           '/calendar',
};

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { menus, loading: menusLoading } = useMenus();
  const [hoveredMenu, setHoveredMenu] = useState(null);
  const [cmdOpen, setCmdOpen] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(
    () => localStorage.getItem('copilot-open') === '1',
  );

  const toggleCopilot = useCallback(() => {
    setCopilotOpen((v) => {
      localStorage.setItem('copilot-open', v ? '0' : '1');
      return !v;
    });
  }, []);

  // Ctrl+K → 커맨드 팔레트 토글
  useEffect(() => {
    const handler = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        setCmdOpen(v => !v);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, []);

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
    <div className="min-h-screen flex flex-col" style={{ backgroundColor: 'var(--color-bg-primary)' }}>
      {/* Fixed Header */}
      <header className="fixed top-0 left-0 right-0 z-50 border-b dark:border-gray-800 border-gray-200" style={{ backgroundColor: 'var(--color-header-bg)' }}>
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
                          isActive ? 'text-cyan-400' : 'hover:text-white dark:hover:text-white'
                        }`}
                        style={!isActive ? { color: 'var(--color-text-secondary)' } : {}}
                      >
                        <span>{menu.menu_name}</span>
                        {menu.children?.length > 0 && (
                          <ChevronDown size={14} className={isActive ? 'text-cyan-400' : 'text-gray-500'} />
                        )}
                      </button>

                      {hoveredMenu === menu.menu_id && menu.children?.length > 0 && (
                        <div className="absolute top-full left-0 mt-1 py-2 rounded-lg shadow-xl min-w-[180px] z-50 dark:border-gray-800 border-gray-200 border" style={{ backgroundColor: 'var(--color-bg-widget)' }}>
                          {menu.children.map((child) => (
                            <button
                              key={child.menu_id}
                              onClick={() => { handleMenuNavigate(child.menu_path); setHoveredMenu(null); }}
                              className="w-full text-left px-4 py-2 text-sm hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                            style={{ color: 'var(--color-text-secondary)' }}
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
              {/* Command palette trigger */}
              <button
                onClick={() => setCmdOpen(true)}
                className="flex items-center gap-2 px-3 py-1.5 bg-gray-800/50 hover:bg-gray-800 border border-gray-700/50 rounded-lg text-gray-400 hover:text-white transition-colors"
                title="Command Palette (Ctrl+K)"
              >
                <Search size={13} />
                <span className="text-xs hidden md:inline">Search…</span>
                <kbd className="text-[10px] text-gray-600 border border-gray-700 rounded px-1 hidden md:inline">⌃K</kbd>
              </button>
              {/* AI Copilot 토글 */}
              <button
                onClick={toggleCopilot}
                title="AI Copilot"
                className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors ${
                  copilotOpen ? 'text-cyan-400' : ''
                }`}
                style={copilotOpen ? {} : { color: 'var(--color-text-secondary)' }}
              >
                <Sparkles size={16} />
              </button>
              <FetcherStatus />
              <ThemeToggle />
              <button
                onClick={() => navigate('/settings')}
                title="API 키 설정"
                className={`p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors ${
                  location.pathname === '/settings' ? 'text-cyan-400' : ''
                }`}
                style={location.pathname === '/settings' ? {} : { color: 'var(--color-text-secondary)' }}
              >
                <Settings size={16} />
              </button>
              <div className="flex items-center gap-1.5 ml-2 pl-3 border-l dark:border-gray-800 border-gray-200">
                <div className="flex items-center gap-2 px-2 py-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 cursor-pointer transition-colors">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
                    <span className="text-xs font-medium text-white">
                      {(user?.username || user?.email || 'U')[0].toUpperCase()}
                    </span>
                  </div>
                  <span className="text-sm hidden sm:inline" style={{ color: 'var(--color-text-secondary)' }}>
                    {user?.username || user?.email?.split('@')[0]}
                  </span>
                </div>
                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800/50 transition-colors"
                  style={{ color: 'var(--color-text-secondary)' }}
                  title="Logout"
                >
                  <LogOut size={16} />
                </button>
              </div>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content — Copilot 열림 시 우측 400px 도킹 공간 확보 */}
      <main
        className="flex-1 pt-14 transition-[margin] duration-200"
        style={copilotOpen ? { marginRight: 400 } : undefined}
      >
        <WidgetSyncProvider>
          <Outlet />
        </WidgetSyncProvider>
      </main>

      {/* Footer */}
      <footer className="border-t dark:border-gray-800 border-gray-200" style={{ backgroundColor: 'var(--color-header-bg)' }}>
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500" />
              <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Online</span>
            </div>
            <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>© 2025 MarketPulse</span>
          </div>
        </div>
      </footer>
    </div>
      <CommandPalette open={cmdOpen} onClose={() => setCmdOpen(false)} />
      <CopilotPanel open={copilotOpen} onClose={toggleCopilot} />
    </GlobalWidgetContext.Provider>
  );
};

export default AppLayout;
