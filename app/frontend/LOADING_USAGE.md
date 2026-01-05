# 전역 로딩 처리 사용 가이드

전체 화면 로딩 오버레이를 사용하는 방법입니다.

## 1. 기본 설정

전역 로딩은 이미 `main.jsx`에 설정되어 있습니다.

## 2. 사용 방법

### 방법 1: useLoading Hook 직접 사용

컴포넌트에서 직접 로딩 상태를 제어할 수 있습니다.

```jsx
import { useLoading } from '../contexts/LoadingContext';

function MyComponent() {
  const { showLoading, hideLoading } = useLoading();

  const handleFetchData = async () => {
    showLoading('데이터를 불러오는 중...');

    try {
      const response = await fetch('/api/data');
      const data = await response.json();
      // 데이터 처리
    } catch (error) {
      console.error(error);
    } finally {
      hideLoading();
    }
  };

  return (
    <button onClick={handleFetchData}>데이터 가져오기</button>
  );
}
```

### 방법 2: useApiWithGlobalLoading Hook 사용

API 호출 시 자동으로 전역 로딩을 표시합니다.

```jsx
import { useApiWithGlobalLoading } from '../hooks/useApiWithGlobalLoading';

function MyComponent() {
  // useGlobalLoading: true로 설정하면 전역 로딩 표시
  const { data, loading, error } = useApiWithGlobalLoading(
    '/api/endpoint',
    {
      useGlobalLoading: true,
      loadingMessage: '사용자 데이터를 불러오는 중...'
    }
  );

  if (error) return <div>Error: {error}</div>;

  return <div>{data && JSON.stringify(data)}</div>;
}
```

### 방법 3: useApiMutationWithGlobalLoading Hook 사용

POST/PUT/DELETE 요청 시 전역 로딩을 표시합니다.

```jsx
import { useApiMutationWithGlobalLoading } from '../hooks/useApiWithGlobalLoading';

function MyComponent() {
  const { mutate, loading, error } = useApiMutationWithGlobalLoading({
    useGlobalLoading: true,
    loadingMessage: '저장 중...'
  });

  const handleSubmit = async (formData) => {
    try {
      const result = await mutate('/api/save', formData);
      console.log('Success:', result);
    } catch (error) {
      console.error('Failed:', error);
    }
  };

  return (
    <button onClick={() => handleSubmit({ name: 'test' })}>
      저장하기
    </button>
  );
}
```

## 3. 여러 개의 동시 로딩 처리

내부적으로 로딩 카운터를 사용하므로, 여러 개의 API 호출이 동시에 진행되어도 안전합니다.

```jsx
function MyComponent() {
  const { showLoading, hideLoading } = useLoading();

  const loadMultipleData = async () => {
    // 첫 번째 요청
    showLoading('데이터 1 불러오는 중...');
    fetch1().finally(() => hideLoading());

    // 두 번째 요청
    showLoading('데이터 2 불러오는 중...');
    fetch2().finally(() => hideLoading());

    // 모든 요청이 완료되면 자동으로 로딩이 사라집니다
  };
}
```

## 4. 커스터마이징

### 로딩 메시지 변경

```jsx
showLoading('포트폴리오 분석 중...');
```

### 로딩 오버레이 스타일 수정

`src/components/common/GlobalLoadingOverlay.jsx` 파일을 수정하여 스타일을 변경할 수 있습니다.

## 5. 주의사항

1. **반드시 hideLoading 호출**: `showLoading`을 호출한 후에는 반드시 `hideLoading`을 호출해야 합니다.
2. **try-finally 사용 권장**: 에러가 발생해도 로딩이 사라지도록 `finally` 블록에서 `hideLoading`을 호출하세요.
3. **기존 useApi와 병행 가능**: 기존 `useApi` hook은 그대로 사용 가능하며, 전역 로딩이 필요한 경우에만 `useApiWithGlobalLoading`을 사용하세요.

## 6. 예제: 실제 사용 케이스

### 백테스트 실행 시

```jsx
function BacktestComponent() {
  const { showLoading, hideLoading } = useLoading();

  const runBacktest = async (config) => {
    showLoading('백테스트를 실행하는 중입니다... 잠시만 기다려주세요.');

    try {
      const response = await apiClient.post('/api/backtest/run', config);
      // 결과 처리
    } catch (error) {
      console.error('Backtest failed:', error);
    } finally {
      hideLoading();
    }
  };

  return <button onClick={() => runBacktest(config)}>백테스트 실행</button>;
}
```

### 대시보드 초기 데이터 로딩

```jsx
function Dashboard() {
  const { data, loading, error } = useApiWithGlobalLoading(
    '/api/dashboard/data',
    {
      useGlobalLoading: true,
      loadingMessage: '대시보드 데이터를 불러오는 중...'
    }
  );

  return <div>{/* 대시보드 렌더링 */}</div>;
}
```
