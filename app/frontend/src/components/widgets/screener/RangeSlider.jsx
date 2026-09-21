export default function RangeSlider({ min: rMin, max: rMax, valueMin, valueMax, onChange }) {
  const range = rMax - rMin || 1;
  const left  = Math.max(0, Math.min(100, ((valueMin ?? rMin) - rMin) / range * 100));
  const right = Math.max(0, Math.min(100, ((valueMax ?? rMax) - rMin) / range * 100));
  return (
    <div className="relative h-1 bg-gray-700 rounded-full mx-1 mt-3 mb-5">
      <div className="absolute h-full bg-cyan-500 rounded-full"
        style={{ left: `${left}%`, width: `${Math.max(0, right - left)}%` }} />
      <input type="range" min={rMin} max={rMax} step={(rMax - rMin) / 200}
        value={valueMin ?? rMin}
        onChange={(e) => onChange('min', Number(e.target.value))}
        className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" style={{ zIndex: 2 }} />
      <input type="range" min={rMin} max={rMax} step={(rMax - rMin) / 200}
        value={valueMax ?? rMax}
        onChange={(e) => onChange('max', Number(e.target.value))}
        className="absolute inset-0 w-full opacity-0 cursor-pointer h-full" style={{ zIndex: 3 }} />
      <div className="absolute w-3.5 h-3.5 bg-white rounded-full border-2 border-cyan-500 -top-[5px] -translate-x-1/2 pointer-events-none shadow"
        style={{ left: `${left}%` }} />
      <div className="absolute w-3.5 h-3.5 bg-white rounded-full border-2 border-cyan-500 -top-[5px] -translate-x-1/2 pointer-events-none shadow"
        style={{ left: `${right}%` }} />
      <div className="absolute top-4 w-full flex justify-between text-[10px] text-gray-500 pointer-events-none">
        <span>{rMin}</span>
        <span>{rMax}</span>
      </div>
    </div>
  );
}
