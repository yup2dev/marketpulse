import { useState, useEffect } from 'react';
import { API_BASE, apiClient } from '../config/api';

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

      // apiClient 를 쓴다 — 생 fetch 는 Authorization 헤더가 없어 인증 게이트에서 401이
      // 나고, 그 401이 아래 catch 로 흘러 **항상 폴백 메뉴로 조용히 대체**됐다.
      // (게이트가 deny-by-default 로 바뀐 뒤 계속 이 상태였다.)
      const data = await apiClient.get(`${API_BASE}/menu/hierarchy?pkg_type=MARKETPULSE`);

      const rows = data.results || [];
      setMenus(rows.filter(m => m.menu_path !== 'alerts' && m.menu_path !== 'screener'));
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
