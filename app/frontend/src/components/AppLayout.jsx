/**
 * AppLayout - Common layout for all authenticated pages
 * Hyperliquid-style header with left-aligned navigation
 * Supports right-click context menu for widget addition on all pages
 */
import { useState, useCallback, createContext, useContext } from 'react';
import {
  TrendingUp, Grid3x3, LayoutDashboard, BarChart3, Briefcase,
  Globe, Bell, LogOut, User, Settings, ChevronDown
} from 'lucide-react';
import { useNavigate, useLocation, Outlet } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import useMenus from '../hooks/useMenus';
import ThemeToggle from './ThemeToggle';
import MenuDropdown from './MenuDropdown';
import WidgetContextMenu from './common/WidgetContextMenu';

// Global widget context for page-level widget management
export const GlobalWidgetContext = createContext(null);

export const useGlobalWidgetContext = () => {
  return useContext(GlobalWidgetContext);
};

// Menu path to page route mapping
const PAGE_ROUTES = {
  'portfolio-settings': '/portfolios',
  'alerts': '/alerts',
};

// Dashboard view paths
const DASHBOARD_VIEWS = ['professional', 'stock', 'macro-analysis', 'unified-backtest'];

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

  // Get current view from URL
  const getCurrentView = () => {
    if (location.pathname === '/') {
      const params = new URLSearchParams(location.search);
      return params.get('view') || 'professional';
    }
    return null;
  };

  // Handle menu navigation
  const handleMenuNavigate = (menuPath) => {
    const [basePath, queryString] = menuPath.split('?');

    // Page routes (Portfolio, Alerts, etc.)
    if (PAGE_ROUTES[basePath]) {
      if (queryString) {
        navigate(`${PAGE_ROUTES[basePath]}?${queryString}`);
      } else {
        navigate(PAGE_ROUTES[basePath]);
      }
      return;
    }

    // Dashboard views
    if (DASHBOARD_VIEWS.includes(basePath)) {
      if (queryString) {
        navigate(`/?view=${basePath}&${queryString}`);
      } else {
        navigate(basePath === 'professional' ? '/' : `/?view=${basePath}`);
      }
      return;
    }

    // Default: navigate to dashboard
    navigate('/');
  };

  // Check if menu is active
  const isMenuActive = (menuPath) => {
    const [basePath, queryString] = menuPath.split('?');

    // Check page routes
    if (PAGE_ROUTES[basePath]) {
      if (location.pathname !== PAGE_ROUTES[basePath]) return false;

      // If there's a query string, check if tab matches
      if (queryString) {
        const menuParams = new URLSearchParams(queryString);
        const currentParams = new URLSearchParams(location.search);
        const menuTab = menuParams.get('tab');
        const currentTab = currentParams.get('tab');
        return menuTab === currentTab;
      }

      // No query string means it's active if we're on that page without a tab
      const currentParams = new URLSearchParams(location.search);
      return !currentParams.get('tab');
    }

    // Check dashboard views
    if (location.pathname === '/') {
      const currentView = getCurrentView();
      return basePath === currentView;
    }

    return false;
  };

  // Context value for child pages
  const contextValue = {
    registerWidgets,
    unregisterWidgets,
  };

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
                })
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

      {/* Main Content - with top padding for fixed header */}
      <main className="flex-1 pt-14">
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
