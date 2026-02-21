/**
 * Common Header Component - Hyperliquid Style
 * Shared header for all pages
 */
import { useState } from 'react';
import {
  TrendingUp, Grid3x3, LayoutDashboard, BarChart3, Briefcase,
  Globe, Bell, LogOut, User, Settings, ChevronDown
} from 'lucide-react';
import { useNavigate, useLocation } from 'react-router-dom';
import toast from 'react-hot-toast';
import useAuthStore from '../../store/authStore';
import useMenus from '../../hooks/useMenus';
import ThemeToggle from './ThemeToggle';
import MenuDropdown from './MenuDropdown';

// Menu path to page route mapping
const PAGE_ROUTES = {
  'portfolio-settings': '/portfolios',
  'alerts': '/alerts',
};

// View paths (stay on dashboard)
const VIEW_PATHS = ['professional', 'stock', 'macro-analysis', 'unified-backtest'];

const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logout } = useAuthStore();
  const { menus, loading: menusLoading } = useMenus();
  const [hoveredMenu, setHoveredMenu] = useState(null);

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

  // Handle navigation
  const handleMenuNavigate = (menuPath) => {
    const [basePath] = menuPath.split('?');

    // Check if this is a page route
    if (PAGE_ROUTES[basePath]) {
      navigate(PAGE_ROUTES[basePath]);
      return;
    }

    // Otherwise navigate to dashboard with view
    if (VIEW_PATHS.includes(basePath)) {
      navigate(`/?view=${basePath}`);
    } else {
      navigate('/');
    }
  };

  // Check if menu is active
  const isMenuActive = (menuPath) => {
    const [basePath] = menuPath.split('?');

    // Check page routes
    if (PAGE_ROUTES[basePath]) {
      return location.pathname === PAGE_ROUTES[basePath];
    }

    // Check view params for dashboard
    if (location.pathname === '/') {
      const params = new URLSearchParams(location.search);
      const currentView = params.get('view') || 'professional';
      return basePath === currentView;
    }

    return false;
  };

  return (
    <header className="border-b border-gray-800 sticky top-0 z-40 bg-[#0d0d0d]">
      <div className="max-w-[1800px] mx-auto px-6">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <div
            className="flex items-center gap-3 cursor-pointer"
            onClick={() => navigate('/')}
          >
            <div className="bg-gradient-to-r from-cyan-500 to-blue-500 p-1.5 rounded-lg">
              <TrendingUp className="text-white" size={20} />
            </div>
            <span className="text-lg font-semibold text-white tracking-tight">MarketPulse</span>
          </div>

          {/* Navigation */}
          <nav className="flex items-center gap-1">
            {menusLoading ? (
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className="h-8 w-20 bg-gray-800 rounded animate-pulse" />
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
            <ThemeToggle />

            <button className="p-2 rounded-lg text-gray-400 hover:text-white hover:bg-gray-800 transition-colors">
              <Settings size={18} />
            </button>

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
  );
};

export default Header;
