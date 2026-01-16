import { BarChart3 } from 'lucide-react';
import { WidgetHeader, WIDGET_STYLES, WIDGET_ICON_COLORS } from '../common';
import RegimeDashboard from '../../macro/RegimeDashboard';

const RegimeWidget = ({ onRemove }) => {
  return (
    <div className={WIDGET_STYLES.container}>
      <WidgetHeader
        icon={BarChart3}
        iconColor={WIDGET_ICON_COLORS.financial}
        title="Economic Regime"
        onRemove={onRemove}
      />
      <div className={`${WIDGET_STYLES.content} p-0`}>
        <RegimeDashboard />
      </div>
    </div>
  );
};

export default RegimeWidget;
