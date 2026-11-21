/**
 * MpKpi — 숫자 요약은 이것 하나다. options.type 으로 모양을 고른다.
 *
 *   <MpKpi rows={rows} options={{ type: 'cards', label: 'name', value: 'npv' }} />
 *   const Summary = MpKpi.init({ type: 'stats' });  <Summary rows={rows} />
 *
 * type      모양                                                      옵션 (자세한 것은 views/<이름>View.jsx 머리말)
 *   kpis    '이름 / 큰 값 / 비교 값' 칸을 세로선으로 나눈 한 줄 (기본)  label · value · sub · tone  (lead: true 행 = 로고 + 이름)
 *   stats   '이름 값' 을 세로선으로 나눈 한 줄                         label · value · note · change
 *   cards   이름 / 큰 값 상자 격자 (계산 결과 몇 개)                   label · value · hint · tone · min
 *   tiles   시세 타일 격자 — 추세선 · 이름 · 현재가 · 등락률           symbol · label · series · columns
 *
 * kpis · stats 는 DataWidget 에서 머리줄 없는 한 줄 패널로 그려진다 (뷰의 bare).
 */
import { createFamily } from './family';
import CardsView from './views/CardsView';
import KpisView from './views/KpisView';
import StatsView from './views/StatsView';
import TilesView from './views/TilesView';

export const KPI_VIEWS = { kpis: KpisView, stats: StatsView, cards: CardsView, tiles: TilesView };

const MpKpi = createFamily('MpKpi', KPI_VIEWS, { defaultType: 'kpis' });
export default MpKpi;
