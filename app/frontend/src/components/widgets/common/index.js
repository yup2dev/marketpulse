/**
 * Common widget components and utilities
 * Central export point for all shared widget resources
 */

// Components
export { default as WidgetHeader } from './WidgetHeader';
export { default as BaseWidget, PERIOD_OPTIONS } from './BaseWidget';

// Utilities
export * from '../../../utils/widgetUtils';
export * from '../../../utils/exportUtils';

// Configuration
export * from './widgetConfig';
