/**
 * Card Component
 * Reusable card container with consistent styling
 */
const Card = ({ children, className = '', hover = false, gradient = false }) => {
  const baseClasses = 'bg-[#1a1f2e] border border-gray-700 rounded-lg transition-all';
  const hoverClasses = hover ? 'hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10' : '';
  const gradientClasses = gradient ? 'bg-gradient-to-br from-[#1a1f2e] via-[#1a1f2e] to-blue-900/10' : '';

  return (
    <div className={`${baseClasses} ${hoverClasses} ${gradientClasses} ${className}`}>
      {children}
    </div>
  );
};

export default Card;
