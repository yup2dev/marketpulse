/**
 * AppLayout - Common layout for all authenticated pages
 * Hyperliquid-style header with left-aligned navigation
 * Supports right-click context menu for widget addition on all pages
 */
import { useState, useCallback, useMemo } from 'react';
import {
  TrendingUp, Grid3x3, LayoutDashboard, BarChart3, Briefcase,
  Globe, Bell, LogOut, User, Settings, ChevronDown, FlaskConical, CandlestickChart,
} from 'lucide-react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import useMenus from '../../hooks/useMenus';
import ThemeToggle from '../common/ThemeToggle';
import MenuDropdown from '../common/MenuDropdown';
import WidgetContextMenu from '../common/WidgetContextMenu';
import { GlobalWidgetContext, useGlobalWidgetContext } from '../../contexts/GlobalWidgetContext';
import WorkspaceBar from '../core/WorkspaceBar';

export { useGlobalWidgetContext };

// Menu path to URL route mapping
const ROUTE_MAP = {
  'professional':       '/',
  'stock':              '/stock',
  'macro-analysis':     '/macro',
  'unified-backtest':   '/backtest',
  'portfolio-settings': '/portfolios',
  'alerts':             '/alerts',
  'screener':           '/screener',
  'watchlist':          '/watchlist',
  'quant':              '/quant',
  'strategy':           '/strategy',
};

// Map pathname → workspace screen name
// Note: /, /stock, /macro, /portfolios are handled by TabDashboard (tab-scoped workspaces)
// and don't use the WorkspaceBar.
const SCREEN_MAP = {
  '/backtest':   'backtest',
  '/alerts':     'alerts',
  '/screener':   'screener',
  '/watchlist':  'watchlist',
  '/quant':      'quant',
  '/strategy':   'strategy',
  '/trading':    'trading',
};

const AppLayout = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { menus, loading: menusLoading } = useMenus();
  const [hoveredMenu, setHoveredMenu] = useState(null);

  // Context menu state for widget addition
  const [contextMenu, setContextMenu] = useState(null);
  const [availableWidgets, setAvailableWidgets] = useState([]);
  const [addWidgetCallback, setAddWidgetCallback] = useState(null);

  // Register widgets for current page
  const registerWidgets = useCallback((widgets, onAddWidget) => {
    setAvailableWidgets(widgets || []);
    setAddWidgetCallback(() => onAddWidget);
  }, []);

  // Unregister widgets when page unmounts
  const unregisterWidgets = useCallback(() => {
    setAvailableWidgets([]);
    setAddWidgetCallback(null);
  }, []);

  // Handle right-click context menu
  const handleContextMenu = useCallback((e) => {
    // Only show if widgets are registered and callback is available
    if (availableWidgets.length === 0 || !addWidgetCallback) return;

    // Don't show menu if clicking on interactive elements
    const target = e.target;
    const isInteractive = target.closest('button, a, input, select, textarea, [role="button"], .no-context-menu, .react-grid-item');

    if (!isInteractive) {
      e.preventDefault();
      setContextMenu({ x: e.clientX, y: e.clientY });
    }
  }, [availableWidgets, addWidgetCallback]);

  // Handle widget selection
  const handleSelectWidget = useCallback((widget) => {
    if (addWidgetCallback) {
      addWidgetCallback(widget);
    }
    setContextMenu(null);
  }, [addWidgetCallback]);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
    navigate('/login');
  };

  // Icon mapping
  const iconMap = {
    'Grid3x3': Grid3x3,
    'LayoutDashboard': LayoutDashboard,
    'Globe': Globe,
    'BarChart3': BarChart3,
    'Briefcase': Briefcase,
    'Bell': Bell,
  };

  const getIcon = (iconName) => {
    const IconComponent = iconMap[iconName];
    return IconComponent ? <IconComponent size={16} /> : null;
  };

  // Handle menu navigation
  const handleMenuNavigate = (menuPath) => {
    const [basePath, queryString] = menuPath.split('?');
    const route = ROUTE_MAP[basePath] ?? '/';
    navigate(queryString ? `${route}?${queryString}` : route);
  };

  // Check if menu is active based on pathname
  const isMenuActive = (menuPath) => {
    const [basePath, queryString] = menuPath.split('?');
    const route = ROUTE_MAP[basePath];
    if (!route) return false;

    if (location.pathname !== route) return false;

    // If the menu item has a query string (e.g. ?tab=...), check tab match
    if (queryString) {
      const menuParams = new URLSearchParams(queryString);
      const currentParams = new URLSearchParams(location.search);
      return menuParams.get('tab') === currentParams.get('tab');
    }

    return true;
  };

  // Context value for child pages - memoized to prevent unnecessary re-renders
  const contextValue = useMemo(() => ({
    registerWidgets,
    unregisterWidgets,
  }), [registerWidgets, unregisterWidgets]);

  const currentScreen = SCREEN_MAP[location.pathname] || null;

  return (
    <GlobalWidgetContext.Provider value={contextValue}>
    <div className="min-h-screen flex flex-col bg-[#0d0d0d]" onContextMenu={handleContextMenu}>
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

            {/* Left-aligned Navigation */}
            <nav className="flex items-center gap-0.5 flex-1">
              {menusLoading ? (
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4, 5].map((i) => (
                    <div key={i} className="h-8 w-20 bg-gray-800/50 rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                <>
                {menus.map((menu) => {
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
                          isActive
                            ? 'text-cyan-400'
                            : 'text-gray-400 hover:text-white'
                        }`}
                      >
                        <span>{menu.menu_name}</span>
                        {menu.children?.length > 0 && (
                          <ChevronDown size={14} className={isActive ? 'text-cyan-400' : 'text-gray-500'} />
                        )}
                      </button>

                      {/* Dropdown */}
                      {hoveredMenu === menu.menu_id && menu.children?.length > 0 && (
                        <div className="absolute top-full left-0 mt-1 py-2 bg-[#0d0d12] border border-gray-800 rounded-lg shadow-xl min-w-[180px] z-50">
                          {menu.children.map((child) => (
                            <button
                              key={child.menu_id}
                              onClick={() => {
                                handleMenuNavigate(child.menu_path);
                                setHoveredMenu(null);
                              }}
                              className="w-full text-left px-4 py-2 text-sm text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors"
                            >
                              {child.menu_name}
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}

                {/* Static: Strategy Lab */}
                <button
                  onClick={() => navigate('/strategy')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                    location.pathname === '/strategy'
                      ? 'text-cyan-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <FlaskConical size={14} />
                  <span>Strategy</span>
                </button>

                {/* Static: Trading Terminal */}
                <button
                  onClick={() => navigate('/trading')}
                  className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium transition-colors ${
                    location.pathname === '/trading'
                      ? 'text-cyan-400'
                      : 'text-gray-400 hover:text-white'
                  }`}
                >
                  <CandlestickChart size={14} />
                  <span>Trading</span>
                </button>
                </>
              )}
            </nav>

            {/* Right Section */}
            <div className="flex items-center gap-1">
              <ThemeToggle />

              <button className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800/50 transition-colors">
                <Settings size={16} />
              </button>

              {/* User */}
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

      {/* WorkspaceBar — below the fixed header */}
      {currentScreen && (
        <div className="fixed top-14 left-0 right-0 z-40">
          <WorkspaceBar screen={currentScreen} />
        </div>
      )}

      {/* Main Content - with top padding for fixed header (56px) + workspace bar (32px) */}
      <main className={`flex-1 ${currentScreen ? 'pt-[88px]' : 'pt-14'}`}>
        <Outlet />
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-800 bg-[#0d0d0d]">
        <div className="px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-1.5 h-1.5 rounded-full bg-green-500"></div>
              <span className="text-xs text-gray-500">Online</span>
            </div>
            <div className="flex items-center gap-6 text-xs text-gray-500">
              <span>© 2025 MarketPulse</span>
              <a href="#" className="hover:text-gray-300 transition-colors">Docs</a>
              <a href="#" className="hover:text-gray-300 transition-colors">Support</a>
              <a href="#" className="hover:text-gray-300 transition-colors">Terms</a>
              <a href="#" className="hover:text-gray-300 transition-colors">Privacy</a>
            </div>
          </div>
        </div>
      </footer>

      {/* Global Context Menu for Widget Addition */}
      {contextMenu && availableWidgets.length > 0 && (
        <WidgetContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
          availableWidgets={availableWidgets}
          onSelect={handleSelectWidget}
        />
      )}
    </div>
    </GlobalWidgetContext.Provider>
  );
};

export default AppLayout;
