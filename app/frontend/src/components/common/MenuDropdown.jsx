/**
 * MenuDropdown Component
 * Displays sub-menu items in a dropdown with hover animation
 */
const MenuDropdown = ({ menuItems, onNavigate, position }) => {
  if (!menuItems || menuItems.length === 0) {
    return null;
  }

  return (
    <div
      className="absolute top-full left-0 mt-1 bg-gray-900 border border-gray-700 rounded-lg shadow-xl min-w-[220px] z-50 overflow-hidden animate-fadeIn"
      style={{
        animation: 'fadeIn 0.2s ease-in-out'
      }}
    >
      {menuItems.map((item, index) => (
        <button
          key={item.menu_id}
          onClick={() => onNavigate(item.menu_path)}
          className={`
            w-full px-4 py-3 text-left text-sm text-gray-300
            hover:bg-gray-800 hover:text-white
            transition-colors duration-150
            ${index !== menuItems.length - 1 ? 'border-b border-gray-800' : ''}
          `}
        >
          <span>{item.menu_name}</span>
        </button>
      ))}

      <style jsx>{`
        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(-4px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        .animate-fadeIn {
          animation: fadeIn 0.2s ease-in-out forwards;
        }
      `}</style>
    </div>
  );
};

export default MenuDropdown;
