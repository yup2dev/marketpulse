import { useState } from 'react';
import {
  TrendingUp, Grid3x3, LayoutDashboard, BarChart3, Briefcase,
  Globe, Bell, LogOut, User, Settings, ChevronDown
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../store/authStore';
import useTheme from '../hooks/useTheme';
import ThemeToggle from './ThemeToggle';
import useMenus from '../hooks/useMenus';
import MenuDropdown from './MenuDropdown';

// Routes that should navigate to actual pages instead of changing view
const PAGE_ROUTES = {
  'portfolio-settings': '/portfolios',
  'alerts': '/alerts',
};

const Layout = ({ children, activeView, onNavigate }) => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { classes } = useTheme();
  const { menus, loading: menusLoading } = useMenus();
  const [hoveredMenu, setHoveredMenu] = useState(null);

  const handleLogout = async () => {
    await logout();
    toast.success('Logged out successfully');
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
    return IconComponent ? <IconComponent size={16} /> : null;
  };

  // Handle navigation - supports both page routes and view changes
  const handleMenuNavigate = (menuPath) => {
    // Extract base path and query string
    const [basePath, queryString] = menuPath.split('?');

    // Check if this menu should navigate to a page route
    if (PAGE_ROUTES[basePath]) {
      navigate(PAGE_ROUTES[basePath]);
      return;
    }

    // Otherwise, change view within dashboard
    onNavigate(basePath);

    // If there's a query string, update URL
    if (queryString) {
      const searchParams = new URLSearchParams(queryString);
      navigate(`?${searchParams.toString()}`);
    }
  };

  // Check if current route is a page route
  const isPageRoute = Object.values(PAGE_ROUTES).includes(location.pathname);

  return (
    <div className="min-h-screen flex flex-col bg-[#0d0d0d]">
      {/* Header - Hyperliquid Style */}
      <header className="border-b border-gray-800 sticky top-0 z-40 bg-[#0d0d0d]">
        <div className="max-w-[1800px] mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            {/* Logo */}
            <div
              className="flex items-center gap-3 cursor-pointer"
              onClick={() => {
                navigate('/');
                onNavigate('professional');
              }}
            >
              <div className="bg-gradient-to-r from-cyan-500 to-blue-500 p-1.5 rounded-lg">
                <TrendingUp className="text-white" size={20} />
              </div>
              <span className="text-lg font-semibold text-white tracking-tight">MarketPulse</span>
            </div>

            {/* Navigation */}
            <nav className="flex items-center gap-1">
              {menusLoading ? (
                // Loading state
                <div className="flex items-center gap-1">
                  {[1, 2, 3, 4].map((i) => (
                    <div key={i} className="h-8 w-20 bg-gray-800 rounded animate-pulse" />
                  ))}
                </div>
              ) : (
                // Render dynamic menus
                menus.map((menu) => {
                  const isActive = activeView === menu.menu_path ||
                    (PAGE_ROUTES[menu.menu_path] && location.pathname === PAGE_ROUTES[menu.menu_path]);

                  return (
                    <div
                      key={menu.menu_id}
                      className="relative"
                      onMouseEnter={() => menu.children?.length > 0 && setHoveredMenu(menu.menu_id)}
                      onMouseLeave={() => setHoveredMenu(null)}
                    >
                      <button
                        onClick={() => handleMenuNavigate(menu.menu_path)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                          isActive
                            ? 'text-white bg-gray-800'
                            : 'text-gray-400 hover:text-white hover:bg-gray-800/50'
                        }`}
                      >
                        {getIcon(menu.menu_icon)}
                        <span>{menu.menu_name}</span>
                        {menu.children?.length > 0 && (
                          <ChevronDown size={14} className="text-gray-500" />
                        )}
                      </button>

                      {/* Dropdown for sub-menus */}
                      {hoveredMenu === menu.menu_id && menu.children?.length > 0 && (
                        <MenuDropdown
                          menuItems={menu.children}
                          onNavigate={handleMenuNavigate}
                        />
                      )}
                    </div>
                  );
                })
              )}
            </nav>

            {/* Right Section */}
            <div className="flex items-center gap-2">
              {/* Theme Toggle */}
              <ThemeToggle />

              {/* Settings */}
              <button className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
                <Settings size={18} />
              </button>

              {/* User Menu */}
              <div className="flex items-center gap-2 ml-2 pl-3 border-l border-gray-800">
                <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-gray-800/50">
                  <div className="w-6 h-6 rounded-full bg-gradient-to-r from-cyan-500 to-blue-500 flex items-center justify-center">
                    <User size={14} className="text-white" />
                  </div>
                  <span className="text-sm text-gray-300">{user?.username || user?.email?.split('@')[0]}</span>
                </div>

                <button
                  onClick={handleLogout}
                  className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors"
                  title="Logout"
                >
                  <LogOut size={18} />
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

      {/* Footer - Minimal */}
      <footer className="border-t border-gray-800 bg-[#0d0d0d]">
        <div className="max-w-[1800px] mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
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
    </div>
  );
};

export default Layout;
