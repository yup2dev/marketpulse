/** notify 알림을 그린다 — App 에 한 번만 올린다. 색은 테마 토큰이라 라이트/다크를 따라간다 */
import { Toaster } from 'react-hot-toast';

export default function NotifyHost() {
  return (
    <Toaster
      position="top-right"
      toastOptions={{
        duration: 3000,
        style: {
          background: 'var(--mp-raised)',
          color: 'var(--mp-text)',
          border: '1px solid var(--mp-tile-line)',
          fontSize: 13,
        },
        success: { duration: 3000, iconTheme: { primary: '#22c55e', secondary: '#fff' } },
        error:   { duration: 4000, iconTheme: { primary: '#ef4444', secondary: '#fff' } },
      }}
    />
  );
}
