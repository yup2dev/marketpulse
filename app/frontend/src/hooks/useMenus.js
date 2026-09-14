import { useState, useEffect } from 'react';
import { API_BASE } from '../config/api';

/**
 * Custom hook to fetch and manage menu data from API
 * Provides hierarchical menu structure with caching
 */
export const useMenus = () => {
  const [menus, setMenus] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    fetchMenus();
  }, []);

  const fetchMenus = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch hierarchical menu structure
      const response = await fetch(`${API_BASE}/menu/hierarchy?pkg_type=MARKETPULSE`);

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const data = await response.json();
      setMenus(data.filter(m => m.menu_path !== 'alerts' && m.menu_path !== 'screener'));
    } catch (err) {
      console.error('Error fetching menus:', err);
      setError(err.message);

      // Fallback to hardcoded menus if API fails
      setMenus(getFallbackMenus());
    } finally {
      setLoading(false);
    }
  };

  const refresh = () => {
    fetchMenus();
  };

  return { menus, loading, error, refresh };
};

/**
 * Fallback menu structure if API is unavailable.
 * 하위 메뉴(children)는 AppLayout이 각 화면의 탭 정의(urlWidgetMap categories)로 생성한다.
 */
const getFallbackMenus = () => [
  { menu_id: 'dashboard', menu_name: 'Dashboard', menu_icon: 'Grid3x3',           menu_path: 'professional',       display_seq: 1, children: [] },
  { menu_id: 'analysis',  menu_name: 'Analysis',  menu_icon: 'LayoutDashboard',   menu_path: 'stock',              display_seq: 2, children: [] },
  { menu_id: 'macro',     menu_name: 'Macro',     menu_icon: 'Globe',             menu_path: 'macro-analysis',     display_seq: 3, children: [] },
  { menu_id: 'calendar',  menu_name: 'Calendar',  menu_icon: 'CalendarDays',      menu_path: 'calendar',           display_seq: 4, children: [] },
  { menu_id: 'portfolio', menu_name: 'Portfolio', menu_icon: 'Briefcase',         menu_path: 'portfolio-settings', display_seq: 5, children: [] },
  { menu_id: 'screener',  menu_name: 'Screener',  menu_icon: 'SlidersHorizontal', menu_path: 'screener',           display_seq: 6, children: [] },
  { menu_id: 'backtest',  menu_name: 'Backtest',  menu_icon: 'LineChart',         menu_path: 'backtest',           display_seq: 7, children: [] },
];

export default useMenus;
