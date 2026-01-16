import { useState, useEffect } from 'react';

/**
 * A reusable hook to manage a dynamic grid of widgets.
 *
 * @param {string} dashboardId - A unique identifier for the dashboard, used for localStorage keys.
 * @param {Array} [defaultWidgets=[]] - The default set of widgets if none are in storage.
 * @param {Array} [defaultLayout=[]] - The default layout if none is in storage.
 * @returns {object} - The state and handlers for the widget grid.
 */
export const useWidgetGrid = (dashboardId, defaultWidgets = [], defaultLayout = []) => {
  const [widgets, setWidgets] = useState([]);
  const [layout, setLayout] = useState([]);

  const WIDGETS_STORAGE_KEY = `${dashboardId}-widgets`;
  const LAYOUT_STORAGE_KEY = `${dashboardId}-layout`;

  // Load from localStorage or set defaults
  useEffect(() => {
    try {
      const savedWidgets = localStorage.getItem(WIDGETS_STORAGE_KEY);
      const savedLayout = localStorage.getItem(LAYOUT_STORAGE_KEY);

      if (savedWidgets && savedLayout) {
        setWidgets(JSON.parse(savedWidgets));
        setLayout(JSON.parse(savedLayout));
      } else {
        setWidgets(defaultWidgets);
        setLayout(defaultLayout);
      }
    } catch (e) {
      console.error('Error loading dashboard state:', e);
      setWidgets(defaultWidgets);
      setLayout(defaultLayout);
    }
  }, [dashboardId, defaultWidgets, defaultLayout]);

  // Save to localStorage
  useEffect(() => {
    try {
      // Only save if there's something to save to avoid clearing on initial empty state
      if (widgets.length > 0) {
        localStorage.setItem(WIDGETS_STORAGE_KEY, JSON.stringify(widgets));
      }
      if (layout.length > 0) {
        localStorage.setItem(LAYOUT_STORAGE_KEY, JSON.stringify(layout));
      }
    } catch (e) {
      console.error('Error saving dashboard state:', e);
    }
  }, [widgets, layout, dashboardId]);

  const handleAddWidget = (newWidgetConfig) => {
    const newWidget = {
      id: `widget-${Date.now()}`,
      ...newWidgetConfig,
    };

    setWidgets((prev) => [...prev, newWidget]);

    const { defaultSize = { w: 4, h: 4 } } = newWidgetConfig;
    const newLayoutItem = {
      i: newWidget.id,
      x: (widgets.length * defaultSize.w) % 12,
      y: Infinity, // Places item at the bottom
      w: defaultSize.w,
      h: defaultSize.h,
      minW: 3,
      minH: 3,
    };

    setLayout((prev) => [...prev, newLayoutItem]);
  };

  const handleRemoveWidget = (widgetId) => {
    setWidgets((prev) => prev.filter((w) => w.id !== widgetId));
    setLayout((prev) => prev.filter((l) => l.i !== widgetId));
  };

  const handleLayoutChange = (newLayout) => {
    // To prevent widgets from shifting on remove, only update layout
    // if the number of items is the same.
    if (newLayout.length === widgets.length) {
      setLayout(newLayout);
    }
  };

  return {
    widgets,
    layout,
    handleAddWidget,
    handleRemoveWidget,
    handleLayoutChange,
  };
};
