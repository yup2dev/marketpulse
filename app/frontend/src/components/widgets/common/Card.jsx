/**
 * Card Component
 * Reusable card container with consistent styling
 */
import useTheme from '../../../hooks/useTheme';

const Card = ({ children, className = '', hover = false, gradient = false }) => {
  const { isDark, classes } = useTheme();

  const baseClasses = `${classes.widget.container} rounded-lg transition-all`;
  const hoverClasses = hover ? 'hover:border-blue-500/50 hover:shadow-lg hover:shadow-blue-500/10' : '';
  const gradientClasses = gradient
    ? (isDark
      ? 'bg-gradient-to-br from-[#1a1f2e] via-[#1a1f2e] to-blue-900/10'
      : 'bg-gradient-to-br from-white via-white to-blue-50')
    : '';

  return (
    <div className={`${baseClasses} ${hoverClasses} ${gradientClasses} ${className}`}>
      {children}
    </div>
  );
};

export default Card;
