/**
 * Common widget components and utilities
 * Central export point for all shared widget resources
 */

// Components
export { default as WidgetHeader } from './WidgetHeader';
export { default as LoadingSpinner } from './LoadingSpinner';
export { default as EmptyState, ErrorState, NoDataState } from './EmptyState';

// Utilities
export * from '../../../utils/widgetUtils';

// Configuration
export * from './widgetConfig';
