/**
 * 뉴스 알림 탭 컴포넌트
 */
import { useState } from 'react';
import { useAlertsContext } from '../../contexts/AlertsContext';
import AlertsListView from './AlertsListView';
import CreateAlertModal from './CreateAlertModal';

export default function NewsAlertsTab() {
  const { newsAlerts, toggleAlert, deleteAlert, testAlert, createAlert } = useAlertsContext();
  const [showCreateModal, setShowCreateModal] = useState(false);

  const handleToggle = async (alertId, currentStatus) => {
    await toggleAlert(alertId, currentStatus);
  };

  const handleDelete = async (alertId) => {
    if (!confirm('정말 이 알림을 삭제하시겠습니까?')) return;
    await deleteAlert(alertId);
  };

  const handleTest = async (alertId) => {
    await testAlert(alertId);
  };

  const handleCreate = async (data) => {
    const success = await createAlert(data);
    if (success) {
      setShowCreateModal(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-6">
      <AlertsListView
        alerts={newsAlerts}
        onToggle={handleToggle}
        onDelete={handleDelete}
        onTest={handleTest}
        onCreateClick={() => setShowCreateModal(true)}
        title="뉴스 알림"
        subtitle="중요 뉴스 발생 시 알림을 받으세요"
        emptyMessage="뉴스 알림이 없습니다"
        emptySubMessage="관심 종목의 중요 뉴스를 놓치지 마세요"
      />

      {showCreateModal && (
        <CreateAlertModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
          initialAlertType="news"
        />
      )}
    </div>
  );
}
