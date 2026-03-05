/**
 * SectionHeader Component
 * Consistent section header with icon and title
 */
const SectionHeader = ({ icon: Icon, iconColor = 'text-blue-400', title, subtitle, badge, className = '' }) => {
  return (
    <div className={`flex items-center justify-between mb-4 ${className}`}>
      <div className="flex items-center gap-2">
        {Icon && <Icon className={iconColor} size={20} />}
        <div>
          <h4 className="text-sm font-semibold text-white">{title}</h4>
          {subtitle && <p className="text-xs text-gray-500 mt-0.5">{subtitle}</p>}
        </div>
      </div>
      {badge && (
        <span className="text-xs bg-blue-900/30 text-blue-400 px-3 py-1 rounded-full font-medium">
          {badge}
        </span>
      )}
    </div>
  );
};

export default SectionHeader;
