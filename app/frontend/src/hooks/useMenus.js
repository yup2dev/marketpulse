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
      setMenus(data);
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
 * Fallback menu structure if API is unavailable
 * Mirrors the database structure for consistency
 */
const getFallbackMenus = () => [
  {
    menu_id: 'dashboard',
    menu_name: 'Dashboard',
    menu_icon: 'Grid3x3',
    menu_path: 'professional',
    display_seq: 1,
    children: []
  },
  {
    menu_id: 'analysis',
    menu_name: 'Analysis',
    menu_icon: 'LayoutDashboard',
    menu_path: 'stock',
    display_seq: 2,
    children: [
      {
        menu_id: 'analysis-overview',
        menu_name: 'Overview',
        menu_path: 'stock?tab=overview',
        display_seq: 1
      },
      {
        menu_id: 'analysis-financials',
        menu_name: 'Financials',
        menu_path: 'stock?tab=financials',
        display_seq: 2
      },
      {
        menu_id: 'analysis-institutional',
        menu_name: 'Institutional Holdings',
        menu_path: 'stock?tab=institutional-holdings',
        display_seq: 3
      }
    ]
  },
  {
    menu_id: 'macro',
    menu_name: 'Macro',
    menu_icon: 'Globe',
    menu_path: 'macro-analysis',
    display_seq: 3,
    children: [
      {
        menu_id: 'macro-overview',
        menu_name: 'Overview',
        menu_path: 'macro-analysis?tab=overview',
        display_seq: 1
      },
      {
        menu_id: 'macro-regime',
        menu_name: 'Economic Regime',
        menu_path: 'macro-analysis?tab=regime',
        display_seq: 2
      },
      {
        menu_id: 'macro-fed',
        menu_name: 'Fed Policy',
        menu_path: 'macro-analysis?tab=fed-policy',
        display_seq: 3
      },
      {
        menu_id: 'macro-yield',
        menu_name: 'Yield Curve',
        menu_path: 'macro-analysis?tab=yield-curve',
        display_seq: 4
      },
      {
        menu_id: 'macro-inflation',
        menu_name: 'Inflation',
        menu_path: 'macro-analysis?tab=inflation',
        display_seq: 5
      },
      {
        menu_id: 'macro-labor',
        menu_name: 'Labor Market',
        menu_path: 'macro-analysis?tab=labor',
        display_seq: 6
      }
    ]
  },
  {
    menu_id: 'backtest',
    menu_name: 'Backtest',
    menu_icon: 'BarChart3',
    menu_path: 'unified-backtest',
    display_seq: 4,
    children: []
  },
  {
    menu_id: 'portfolio',
    menu_name: 'Portfolio',
    menu_icon: 'Briefcase',
    menu_path: 'portfolio-settings',
    display_seq: 5,
    children: []
  },
  {
    menu_id: 'alerts',
    menu_name: 'Alerts',
    menu_icon: 'Bell',
    menu_path: 'alerts',
    display_seq: 6,
    children: []
  }
];

export default useMenus;
