/**
 * MpList — 목록은 이것 하나다 (열을 맞춰 비교하는 것은 MpGrid). options.type 으로 모양을 고른다.
 *
 *   <MpList rows={news} options={{ type: 'list', time: 'time', title: 'title', href: 'url' }} />
 *   const NewsList = MpList.init({ type: 'articles', title: 'title', summary: 'summary' });
 *
 * type        모양                                                옵션 (자세한 것은 views/<이름>View.jsx 머리말)
 *   list      한 줄 목록 — 시각 · 제목 · 꼬리표 / 값 (기본)        time · title · sub · href · tag · tagSymbol · value · valueMuted · dot
 *   articles  기사 — 발행처 · 시각 · 감성 / 제목 / 요약 / 관련 종목  source · time · title · summary · href · tags · sentiment
 *   kv        이름 · 값 목록 (넓으면 여러 열)                       label · value · columns
 */
import { createFamily } from './family';
import ArticlesView from './views/ArticlesView';
import KvView from './views/KvView';
import ListView from './views/ListView';

export const LIST_VIEWS = { list: ListView, articles: ArticlesView, kv: KvView };

const MpList = createFamily('MpList', LIST_VIEWS, { defaultType: 'list' });
export default MpList;
