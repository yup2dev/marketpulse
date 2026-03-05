import { X } from 'lucide-react';
import StockSelector from './StockSelector';

const StockSelectorModal = ({ isOpen, title, onSelect, onClose }) => {
  if (!isOpen) return null;

  const handleBackdropClick = (e) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-[9999]"
      onClick={handleBackdropClick}
    >
      <div className="max-w-3xl w-full mx-4 max-h-[90vh] flex flex-col">
        <div className="bg-[#0d0d0d] rounded-lg border border-gray-700 shadow-2xl flex flex-col max-h-full">
          <div className="flex items-center justify-between p-6 border-b border-gray-800 flex-shrink-0">
            <h3 className="text-xl font-bold text-white">
              {title || 'Select Stock'}
            </h3>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <X size={20} />
            </button>
          </div>
          <div className="p-6 overflow-auto flex-1">
            <StockSelector onSelect={onSelect} />
          </div>
        </div>
      </div>
    </div>
  );
};

export default StockSelectorModal;
