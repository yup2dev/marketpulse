import { Modal } from '..';
import StockSelector from './StockSelector';

const StockSelectorModal = ({ isOpen, title, onSelect, onClose }) => (
  <Modal open={isOpen} onClose={onClose} title={title || 'Select Stock'} width={768} bodyClassName="flex-1 min-h-0 overflow-auto p-6">
    <StockSelector onSelect={onSelect} />
  </Modal>
);

export default StockSelectorModal;
