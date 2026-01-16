/**
 * A simple skeleton loader component for various UI elements.
 */
import React from 'react';

const SkeletonLoader = ({ variant = 'text', count = 1, className = '' }) => {
  const renderTextSkeleton = () => (
    <div className={`animate-pulse bg-gray-700 rounded h-4 w-full mb-2 ${className}`}></div>
  );

  const renderCardSkeleton = () => (
    <div className={`animate-pulse bg-gray-800 rounded-lg p-6 h-32 ${className}`}></div>
  );

  const renderChartSkeleton = () => (
    <div className={`animate-pulse bg-gray-800 rounded-lg h-full w-full ${className}`}></div>
  );

  switch (variant) {
    case 'card':
      return Array.from({ length: count }).map((_, i) => (
        <div key={i} className="mb-4 last:mb-0">
          {renderCardSkeleton()}
        </div>
      ));
    case 'chart':
      return renderChartSkeleton();
    case 'text':
    default:
      return Array.from({ length: count }).map((_, i) => (
        <div key={i}>{renderTextSkeleton()}</div>
      ));
  }
};

export default SkeletonLoader;
