import { RefreshCw } from 'lucide-react';

/**
 * Common loading spinner component
 * Displays a centered loading indicator
 */
const LoadingSpinner = ({
  size = 24,
  color = 'text-blue-500',
  message,
  className = ''
}) => {
  return (
    <div className={`flex flex-col items-center justify-center h-full gap-3 ${className}`}>
      <RefreshCw className={`animate-spin ${color}`} size={size} />
      {message && (
        <p className="text-sm text-gray-400">{message}</p>
      )}
    </div>
  );
};

export default LoadingSpinner;
