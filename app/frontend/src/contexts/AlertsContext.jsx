/**
 * 알림 데이터 Context
 * 모든 탭에서 알림 데이터 공유
 */
import { createContext, useContext } from 'react';
import { useAlerts } from '../hooks/useAlerts';

const AlertsContext = createContext(null);

export function AlertsProvider({ children }) {
  const alertsData = useAlerts();

  return (
    <AlertsContext.Provider value={alertsData}>
      {children}
    </AlertsContext.Provider>
  );
}

export function useAlertsContext() {
  const context = useContext(AlertsContext);
  if (!context) {
    throw new Error('useAlertsContext must be used within an AlertsProvider');
  }
  return context;
}

export default AlertsContext;
