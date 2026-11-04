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

      setMenus(mergeWithAppMenus(data.results || []));
    } catch (err) {
      console.error('Error fetching menus:', err);
      setError(err.message);

      // API 실패 시 코드에 정의된 화면 목록만으로 그린다
      setMenus(APP_MENUS);
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
 * 헤더에 띄울 화면 목록 — 메뉴 집합의 기준.
 * 실제로 열 수 있는 화면은 App.jsx 라우트 + AppLayout ROUTE_MAP 이 정하므로, DB 메뉴 테이블에
 * 행이 빠져 있어도(운영 DB엔 5개뿐) 화면이 헤더에서 사라지지 않도록 여기를 기준으로 삼는다.
 * 하위 메뉴(children)는 AppLayout이 각 화면의 탭 정의(urlWidgetMap categories)로 생성한다.
 */
const APP_MENUS = [
  { menu_id: 'dashboard', menu_name: 'Dashboard', menu_icon: 'Grid3x3',           menu_path: 'professional',       display_seq: 1, children: [] },
  { menu_id: 'analysis',  menu_name: 'Analysis',  menu_icon: 'LayoutDashboard',   menu_path: 'stock',              display_seq: 2, children: [] },
  { menu_id: 'macro',     menu_name: 'Macro',     menu_icon: 'Globe',             menu_path: 'macro-analysis',     display_seq: 3, children: [] },
  { menu_id: 'calendar',  menu_name: 'Calendar',  menu_icon: 'CalendarDays',      menu_path: 'calendar',           display_seq: 4, children: [] },
  { menu_id: 'portfolio', menu_name: 'Portfolio', menu_icon: 'Briefcase',         menu_path: 'portfolio-settings', display_seq: 5, children: [] },
  { menu_id: 'screener',  menu_name: 'Screener',  menu_icon: 'SlidersHorizontal', menu_path: 'screener',           display_seq: 6, children: [] },
  { menu_id: 'quantlib',  menu_name: 'QuantLib',  menu_icon: 'Sigma',             menu_path: 'quantlib',           display_seq: 7, children: [] },
  { menu_id: 'backtest',  menu_name: 'Backtest',  menu_icon: 'LineChart',         menu_path: 'backtest',           display_seq: 8, children: [] },
];

/**
 * DB 메뉴는 APP_MENUS 에 있는 화면의 이름·아이콘만 덮어쓴다(menu_path 기준).
 * 라우트가 없는 DB 메뉴(alerts 등)는 눌러도 갈 곳이 없으므로 버린다.
 * 순서는 APP_MENUS 를 따른다 — DB display_seq 는 빠진 행 때문에 듬성듬성해 섞으면 어긋난다.
 */
const mergeWithAppMenus = (rows) => {
  const byPath = new Map(rows.map(m => [m.menu_path, m]));
  return APP_MENUS.map((base) => {
    const db = byPath.get(base.menu_path);
    return db
      ? { ...base, menu_name: db.menu_name || base.menu_name, menu_icon: db.menu_icon || base.menu_icon }
      : base;
  });
};

export default useMenus;
