import { GitMerge } from 'lucide-react';
import { WidgetHeader, WIDGET_STYLES, WIDGET_ICON_COLORS } from '../common';
import YieldCurveChart from '../../macro/YieldCurveChart';

const YieldCurveWidget = ({ onRemove }) => {
  return (
    <div className={WIDGET_STYLES.container}>
      <WidgetHeader
        icon={GitMerge}
        iconColor={WIDGET_ICON_COLORS.blue}
        title="Yield Curve"
        onRemove={onRemove}
      />
      <div className={`${WIDGET_STYLES.content} p-0`}>
        {/* The YieldCurveChart component is self-contained and fetches its own data */}
        <YieldCurveChart />
      </div>
    </div>
  );
};

export default YieldCurveWidget;
