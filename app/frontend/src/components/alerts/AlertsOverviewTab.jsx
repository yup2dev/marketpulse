/**
 * 알림 개요 탭 - Static Grid Layout
 */
import AlertStatisticsWidget from '../widgets/AlertStatisticsWidget';
import RecentTriggersWidget from '../widgets/RecentTriggersWidget';
import ActiveAlertsWidget from '../widgets/ActiveAlertsWidget';

export default function AlertsOverviewTab() {
  return (
    <div className="h-full">
      <div className="grid grid-cols-12 gap-1 h-[calc(100vh-180px)]">
        {/* Top Left - Alert Statistics */}
        <div className="col-span-4 min-h-[280px]">
          <AlertStatisticsWidget />
        </div>

        {/* Top Right - Recent Triggers */}
        <div className="col-span-8 min-h-[280px]">
          <RecentTriggersWidget />
        </div>

        {/* Bottom - Active Alerts */}
        <div className="col-span-12 min-h-[280px]">
          <ActiveAlertsWidget />
        </div>
      </div>
    </div>
  );
}
