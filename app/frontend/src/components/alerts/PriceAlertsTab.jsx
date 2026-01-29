/**
 * 가격 알림 탭 컴포넌트 - Static Grid Layout
 */
import { useState } from 'react';
import { useAlertsContext } from '../../contexts/AlertsContext';
import AlertsListView from './AlertsListView';
import CreateAlertModal from './CreateAlertModal';

export default function PriceAlertsTab() {
  const { priceAlerts, toggleAlert, deleteAlert, testAlert, createAlert } = useAlertsContext();
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
    <div className="h-full">
      <div className="grid grid-cols-12 gap-1 h-[calc(100vh-180px)]">
        <div className="col-span-12 min-h-[280px]">
          <AlertsListView
            alerts={priceAlerts}
            onToggle={handleToggle}
            onDelete={handleDelete}
            onTest={handleTest}
            onCreateClick={() => setShowCreateModal(true)}
            title="가격 알림"
            subtitle="특정 가격 도달 시 알림을 받으세요"
            emptyMessage="가격 알림이 없습니다"
            emptySubMessage="목표 가격에 도달하면 알림을 받을 수 있습니다"
          />
        </div>
      </div>

      {showCreateModal && (
        <CreateAlertModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
          initialAlertType="price"
        />
      )}
    </div>
  );
}
