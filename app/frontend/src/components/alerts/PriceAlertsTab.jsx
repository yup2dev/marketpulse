/**
 * 가격 알림 탭 컴포넌트 - WidgetDashboard 기반 동적 레이아웃
 */
import { useState } from 'react';
import { useAlertsContext } from '../../contexts/AlertsContext';
import WidgetDashboard from '../WidgetDashboard';
import CreateAlertModal from './CreateAlertModal';

// 사용 가능한 위젯 목록
const AVAILABLE_WIDGETS = [
  { id: 'alerts-list', name: '가격 알림 목록', description: '가격 알림 리스트', defaultSize: { w: 12, h: 12 } },
];

// 기본 위젯 구성
const DEFAULT_WIDGETS = [
  { id: 'price-alerts-list-1', type: 'alerts-list' },
];

// 기본 레이아웃
const DEFAULT_LAYOUT = [
  { i: 'price-alerts-list-1', x: 0, y: 0, w: 12, h: 12, minW: 6, minH: 6 },
];

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

  // 알림 목록 위젯에 전달할 props를 포함한 위젯 구성
  const widgetsWithProps = DEFAULT_WIDGETS.map(widget => ({
    ...widget,
    alerts: priceAlerts,
    onToggle: handleToggle,
    onDelete: handleDelete,
    onTest: handleTest,
    onCreateClick: () => setShowCreateModal(true),
    title: '가격 알림',
    subtitle: '특정 가격 도달 시 알림을 받으세요',
    emptyMessage: '가격 알림이 없습니다',
    emptySubMessage: '목표 가격에 도달하면 알림을 받을 수 있습니다',
  }));

  return (
    <>
      <WidgetDashboard
        dashboardId="price-alerts-dashboard"
        title="가격 알림"
        subtitle="가격 기반 알림 관리"
        availableWidgets={AVAILABLE_WIDGETS}
        defaultWidgets={widgetsWithProps}
        defaultLayout={DEFAULT_LAYOUT}
      />

      {showCreateModal && (
        <CreateAlertModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
          initialAlertType="price"
        />
      )}
    </>
  );
}
