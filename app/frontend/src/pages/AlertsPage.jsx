/**
 * 알림 관리 페이지
 */
import AlertsManager from '../components/alerts/AlertsManager';

export default function AlertsPage() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-gray-100 p-6">
      <div className="max-w-7xl mx-auto">
        <AlertsManager />
      </div>
    </div>
  );
}
