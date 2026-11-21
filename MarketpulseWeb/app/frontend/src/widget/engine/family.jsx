/**
 * 부품 묶음 만들기 — MpChart · MpKpi · MpList 가 같은 틀이다.
 * 종류표(type → 뷰)를 받아 { rows, options: { type } } 로 고르는 부품과 .init(기본 옵션) 을 돌려준다.
 * DataWidget 은 같은 종류표에서 view 이름으로 뷰를 찾는다 — DB 위젯과 화면이 같은 부품을 쓴다.
 */
const NO_QUOTES = {};

export function createFamily(name, views, { defaultType, aliases = {} } = {}) {
  const viewOf = (type) => views[aliases[type] || type];

  function Family({ rows = [], options = {}, quotes = NO_QUOTES, ...props }) {
    const type = options.type || defaultType;
    const View = viewOf(type);
    if (!View) {
      if (import.meta.env?.DEV) console.error(`[${name}] unknown type:`, type);
      return null;
    }
    // DataWidget 밖에서는 실시간 시세가 없다 — 시세를 읽는 뷰(candles · tiles)가 빈 값으로 그리게
    return <View rows={rows} options={options} quotes={quotes} {...props} />;
  }
  Family.displayName = name;
  Family.views = views;
  Family.view = viewOf;

  /** 옵션을 미리 정해 둔 부품 — options 를 또 주면 그 값이 이긴다 */
  Family.init = function init(defaults = {}) {
    function Preset({ options, ...props }) {
      return <Family {...props} options={options ? { ...defaults, ...options } : defaults} />;
    }
    Preset.displayName = `${name}.init`;
    return Preset;
  };
  return Family;
}
