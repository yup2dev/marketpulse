import { logoColor } from './screenerFormat';

export default function LogoCircle({ symbol, size = 28 }) {
  const bg = logoColor(symbol || '');
  const text = (symbol || '??').slice(0, 2).toUpperCase();
  return (
    <div
      className="rounded-full flex items-center justify-center text-white font-bold flex-shrink-0 select-none"
      style={{ width: size, height: size, backgroundColor: bg, fontSize: Math.round(size * 0.36) }}
    >
      {text}
    </div>
  );
}
