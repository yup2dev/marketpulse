import { AlertCircle, Database, Inbox } from 'lucide-react';

/**
 * Common empty state component
 * Displays a message when there's no data to show
 */
const EmptyState = ({
  icon: Icon = Inbox,
  iconSize = 48,
  iconColor = 'text-gray-600',
  title = 'No data available',
  message,
  action,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center h-full gap-3 p-6 ${className}`}>
      <Icon size={iconSize} className={iconColor} />
      <div className="text-center">
        <h4 className="text-gray-300 font-medium mb-1">{title}</h4>
        {message && (
          <p className="text-sm text-gray-500">{message}</p>
        )}
      </div>
      {action && (
        <div className="mt-2">
          {action}
        </div>
      )}
    </div>
  );
};

/**
 * Error state variant
 */
export const ErrorState = ({ message, onRetry }) => (
  <EmptyState
    icon={AlertCircle}
    iconColor="text-red-500"
    title="Error loading data"
    message={message || 'Something went wrong. Please try again.'}
    action={
      onRetry && (
        <button
          onClick={onRetry}
          className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded text-sm transition-colors"
        >
          Retry
        </button>
      )
    }
  />
);

/**
 * No data state variant
 */
export const NoDataState = ({ message }) => (
  <EmptyState
    icon={Database}
    iconColor="text-gray-600"
    title="No data available"
    message={message || 'No information to display'}
  />
);

export default EmptyState;
