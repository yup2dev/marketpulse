import { useState, useCallback, useRef, useEffect } from 'react';

/**
 * useChartZoom - Custom hook for chart zoom/pan functionality
 * Handles mouse wheel zoom and drag-to-pan interactions
 *
 * @param {Object} options
 * @param {number} options.minRange - Minimum visible range percentage (default: 5)
 * @param {number} options.maxRange - Maximum visible range percentage (default: 100)
 * @param {number} options.zoomIntensity - Zoom speed factor (default: 0.1)
 * @returns {Object} Zoom state and handlers
 */
const useChartZoom = ({
  minRange = 5,
  maxRange = 100,
  zoomIntensity = 0.1,
} = {}) => {
  // Visible range as percentage (0-100)
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 100 });

  // Refs for drag functionality
  const chartContainerRef = useRef(null);
  const isDragging = useRef(false);
  const dragStartX = useRef(0);
  const dragStartRange = useRef({ start: 0, end: 100 });

  // Reset visible range to show all data
  const resetZoom = useCallback(() => {
    setVisibleRange({ start: 0, end: 100 });
  }, []);

  // Handle mouse wheel for zoom
  const handleWheel = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();

    const delta = e.deltaY > 0 ? 1 : -1; // zoom out or in

    setVisibleRange(prev => {
      const range = prev.end - prev.start;

      // Calculate new range
      const zoomAmount = range * zoomIntensity * delta;
      let newRange = Math.max(minRange, Math.min(maxRange, range + zoomAmount));

      // Get mouse position ratio within container
      const rect = chartContainerRef.current?.getBoundingClientRect();
      const mouseRatio = rect ? (e.clientX - rect.left) / rect.width : 0.5;

      // Adjust start/end based on mouse position (zoom towards cursor)
      const rangeDiff = newRange - range;
      let newStart = prev.start - rangeDiff * mouseRatio;
      let newEnd = prev.end + rangeDiff * (1 - mouseRatio);

      // Clamp values to valid range
      if (newStart < 0) {
        newEnd = Math.min(maxRange, newEnd - newStart);
        newStart = 0;
      }
      if (newEnd > maxRange) {
        newStart = Math.max(0, newStart - (newEnd - maxRange));
        newEnd = maxRange;
      }

      return {
        start: Math.max(0, newStart),
        end: Math.min(maxRange, newEnd)
      };
    });
  }, [minRange, maxRange, zoomIntensity]);

  // Handle mouse down for pan start
  const handleMouseDown = useCallback((e) => {
    if (e.button !== 0) return; // only left click
    isDragging.current = true;
    dragStartX.current = e.clientX;
    dragStartRange.current = { ...visibleRange };
    e.preventDefault();
  }, [visibleRange]);

  // Handle mouse move for panning
  const handleMouseMove = useCallback((e) => {
    if (!isDragging.current) return;

    const rect = chartContainerRef.current?.getBoundingClientRect();
    if (!rect) return;

    const deltaX = e.clientX - dragStartX.current;
    const deltaPercent = (deltaX / rect.width) * (dragStartRange.current.end - dragStartRange.current.start);

    setVisibleRange(() => {
      let newStart = dragStartRange.current.start - deltaPercent;
      let newEnd = dragStartRange.current.end - deltaPercent;

      // Clamp values
      if (newStart < 0) {
        newEnd = newEnd - newStart;
        newStart = 0;
      }
      if (newEnd > maxRange) {
        newStart = newStart - (newEnd - maxRange);
        newEnd = maxRange;
      }

      return {
        start: Math.max(0, newStart),
        end: Math.min(maxRange, newEnd)
      };
    });
  }, [maxRange]);

  // Handle mouse up for pan end
  const handleMouseUp = useCallback(() => {
    isDragging.current = false;
  }, []);

  // Add global mouse event listeners for drag
  useEffect(() => {
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [handleMouseMove, handleMouseUp]);

  // Add wheel event listener with passive: false to prevent page scroll
  useEffect(() => {
    const container = chartContainerRef.current;
    if (!container) return;

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => {
      container.removeEventListener('wheel', handleWheel);
    };
  }, [handleWheel]);

  // Slice data based on visible range
  const sliceDataByRange = useCallback((data) => {
    if (!data || data.length === 0) return data;

    const totalLen = data.length;
    const startIdx = Math.floor((visibleRange.start / 100) * totalLen);
    const endIdx = Math.ceil((visibleRange.end / 100) * totalLen);

    return data.slice(startIdx, endIdx);
  }, [visibleRange]);

  // Check if currently zoomed in
  const isZoomed = visibleRange.start > 0 || visibleRange.end < 100;

  // Get current zoom level as percentage
  const zoomLevel = 100 / (visibleRange.end - visibleRange.start);

  return {
    // State
    visibleRange,
    setVisibleRange,
    isZoomed,
    zoomLevel,

    // Refs
    chartContainerRef,

    // Handlers
    handleMouseDown,
    resetZoom,

    // Utilities
    sliceDataByRange,
  };
};

export default useChartZoom;
