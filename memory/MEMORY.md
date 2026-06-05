# MarketPulse Project Notes

## Project Structure
- Frontend: `app/frontend/` (React + Vite)
- Common widget components: `app/frontend/src/components/widgets/common/`
  - `BaseWidget.jsx` - Widget wrapper with drag handle, view toggle, period selector
  - `WidgetTable.jsx` - Reusable column-config table (created 2026-02-05)
  - `MetricCard.jsx`, `SectionHeader.jsx`, `WidgetHeader.jsx`, `Card.jsx`

## Design Patterns
- Terminal/dark theme: bg-[#0a0a0f], bg-[#0d0d12], border-gray-800
- Table style: sticky headers with bg-[#0d0d12] z-10, text-gray-400 headers
- Color conventions: cyan=primary, green=positive, red=negative, yellow=warning
- Size variants: compact (text-[11px]) / default (text-xs)
- `tabular-nums` for numeric columns
- `_key` field on data rows for React keys in WidgetTable

## Key Files
- `InstitutionalPortfolios.jsx` - 13F holdings viewer with OverviewTable, HoldingsTable, ActivityTable
  - Uses WidgetTable for HoldingsTable, ActivityTable, and expanded sub-table in OverviewRow
  - OverviewTable keeps custom `<table>` because of expandable rows pattern (OverviewRow renders `<tr>` pairs)
  - Sold positions merged with stocks via normalization (prev_value→value, prev_shares→shares, status='sold', _isSold=true)

## Removed Features (2026-04-22)
- Quant, Strategy, Visualize, and Backtest features were fully removed from both frontend and backend.
- Deleted: `components/quant/`, `components/strategy/`, `components/visualize/`, `_backup/components/{quant,strategy,backtest}/`, `data/factorCatalog.js`, `data/strategyFactors.js`, `quantAPI` in `config/api.js`.
- Deleted backend: `services/quant/`, `services/quant_service.py`, `services/backtest_service.py`, `api/routes/quant.py`, `api/routes/backtest.py`, `index_analyzer/models/quant_strategy*.py`, `scripts/init_quant_*.py`.
- Active routes now: `/`, `/stock`, `/macro`, `/portfolios`, `/alerts` (plus auth).

## Build
- `cd app/frontend && npx vite build` to verify

## Architecture Issues
- [Provider 표준화 문제](project_provider_standardization.md) — provider마다 필드명 불일치, standard_models 미상속 케이스 혼재

## Screener Widget
- 프리셋 10개 (기존 5 + high_roe·HOT, value_deep, profitable, momentum_up·HOT, quality_large)
- FILTER_CATALOG에 beta, volume 추가
- _apply_filters에 pb_ratio, roa, profit_margin_max, roe_max, debt_to_equity, current_ratio, quick_ratio 지원 추가
- HTTP REST 방식 유지 (WebSocket 미사용)
