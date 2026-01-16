import WidgetDashboard from '../components/WidgetDashboard';

// Define the widgets available for the macro dashboard
const availableMacroWidgets = [
  {
    id: 'yield-curve',
    name: 'Yield Curve',
    description: 'Displays the US Treasury yield curve and key spreads.',
    defaultSize: { w: 8, h: 8 },
  },
  // We will add more macro widgets here, like Regime, Fed Policy, etc.
];

// Optional: Define a default layout for the macro dashboard
const defaultMacroLayout = [
    { i: 'yield-curve-default', x: 0, y: 0, w: 8, h: 8 }
];

const defaultMacroWidgets = [
    { id: 'yield-curve-default', type: 'yield-curve' }
];

export default function MacroAnalysisPage() {
  return (
    <WidgetDashboard
      dashboardId="macro-analysis"
      title="Macro Economic Analysis"
      subtitle="Your customizable dashboard for macroeconomic indicators."
      availableWidgets={availableMacroWidgets}
      defaultLayout={defaultMacroLayout}
      defaultWidgets={defaultMacroWidgets}
    />
  );
}
