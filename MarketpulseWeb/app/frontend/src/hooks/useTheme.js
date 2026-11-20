/**
 * useTheme — 지금 테마와 바꾸는 함수.
 *
 * 색은 index.css 의 CSS 변수(--mp-* · --mpc-* · --color-*)가 단일 기준이다. 테마 전환은
 * themeStore 가 <html> 에 dark/light 클래스를 붙여서 한다. JS 로 색을 칠하는 차트는
 * lib/plotly/Plot 의 readColors() 로 그 변수 값을 읽는다.
 */
import useThemeStore from '../store/themeStore';

const useTheme = () => {
  const { theme, setTheme, toggleTheme } = useThemeStore();
  return { theme, setTheme, toggleTheme, isDark: theme === 'dark', isLight: theme === 'light' };
};

export default useTheme;
