import { Inbox } from 'lucide-react';
import BaseWidget from '../common/BaseWidget';

export default function PortfolioEmptyWidget({ title, message, icon: Icon = Inbox, onRemove }) {
  return (
    <BaseWidget
      title={title}
      icon={Icon}
      showViewToggle={false}
      showPeriodSelector={false}
      onRemove={onRemove}
    >
      <div className="flex flex-col items-center justify-center h-full min-h-[160px] gap-2">
        <Inbox size={28} className="text-gray-700" />
        <div className="text-gray-500 text-xs">{message}</div>
      </div>
    </BaseWidget>
  );
}
