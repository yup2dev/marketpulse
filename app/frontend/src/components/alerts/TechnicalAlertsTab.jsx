/**
 * 기술적 알림 탭 컴포넌트
 */
import { useState } from 'react';
import { useAlertsContext } from '../../contexts/AlertsContext';
import AlertsListView from './AlertsListView';
import CreateAlertModal from './CreateAlertModal';

export default function TechnicalAlertsTab() {
  const { technicalAlerts, toggleAlert, deleteAlert, testAlert, createAlert } = useAlertsContext();
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
        alerts={technicalAlerts}
        onToggle={handleToggle}
        onDelete={handleDelete}
        onTest={handleTest}
        onCreateClick={() => setShowCreateModal(true)}
        title="기술적 알림"
        subtitle="기술 지표 조건 충족 시 알림을 받으세요"
        emptyMessage="기술적 알림이 없습니다"
        emptySubMessage="RSI, MACD 등 기술 지표 기반 알림을 설정하세요"
      />

      {showCreateModal && (
        <CreateAlertModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
          initialAlertType="technical"
        />
      )}
    </div>
  );
}
