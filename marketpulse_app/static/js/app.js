/**
 * MarketPulse Dashboard - Main Application
 */

class DashboardApp {
    constructor() {
        this.currentSymbol = 'NVDA';
        this.searchTimeout = null;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadDashboard();
    }

    setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('symbolSearch');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.searchTimeout);
                const value = e.target.value.trim().toUpperCase();

                if (value.length >= 1) {
                    this.searchTimeout = setTimeout(() => {
                        this.changeSymbol(value);
                    }, 500);
                }
            });

            // Keyboard shortcut for search
            document.addEventListener('keydown', (e) => {
                if (e.ctrlKey && e.key === 'k') {
                    e.preventDefault();
                    searchInput.focus();
                }
            });
        }

        // Tab switching
        const tabs = document.querySelectorAll('.tab');
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');

                const tabName = tab.dataset.tab;
                this.switchTab(tabName);
            });
        });

        // Widget refresh buttons
        document.addEventListener('click', (e) => {
            const refreshBtn = e.target.closest('.widget-btn[title="Refresh"]');
            if (refreshBtn) {
                const widget = refreshBtn.closest('.widget');
                if (widget) {
                    const widgetType = widget.dataset.widgetType;
                    this.refreshWidget(widgetType);
                }
            }
        });

        // Widget expand buttons
        document.addEventListener('click', (e) => {
            const expandBtn = e.target.closest('.widget-btn[title="Expand"]');
            if (expandBtn) {
                const widget = expandBtn.closest('.widget');
                if (widget) {
                    widget.classList.toggle('expanded');
                }
            }
        });
    }

    async loadDashboard() {
        try {
            // Update all ticker badges
            this.updateTickerBadges(this.currentSymbol);

            // Load all widgets
            await Promise.all([
                this.refreshWidget('ticker-info'),
                this.refreshWidget('price-chart'),
                this.refreshWidget('company-profile'),
                this.refreshWidget('economic')
            ]);

        } catch (error) {
            console.error('Error loading dashboard:', error);
            this.showError('Failed to load dashboard');
        }
    }

    async changeSymbol(symbol) {
        if (symbol === this.currentSymbol) return;

        this.currentSymbol = symbol;
        this.updateTickerBadges(symbol);

        // Refresh stock-related widgets
        await Promise.all([
            this.refreshWidget('ticker-info'),
            this.refreshWidget('price-chart'),
            this.refreshWidget('company-profile')
        ]);
    }

    updateTickerBadges(symbol) {
        const badges = document.querySelectorAll('.ticker-badge');
        badges.forEach(badge => {
            badge.textContent = symbol;
        });
    }

    async refreshWidget(widgetType) {
        try {
            switch (widgetType) {
                case 'ticker-info':
                    await widgetManager.updateWidget('ticker-info', this.currentSymbol);
                    break;

                case 'price-chart':
                    await widgetManager.updateWidget('price-chart', this.currentSymbol, '1mo');
                    break;

                case 'company-profile':
                    await widgetManager.updateWidget('company-profile', this.currentSymbol);
                    break;

                case 'economic':
                    await widgetManager.updateWidget('economic');
                    break;

                default:
                    console.warn(`Unknown widget type: ${widgetType}`);
            }
        } catch (error) {
            console.error(`Error refreshing widget ${widgetType}:`, error);
        }
    }

    switchTab(tabName) {
        console.log(`Switching to tab: ${tabName}`);
        // Tab switching logic can be implemented here
        // For now, all widgets are visible
    }

    showError(message) {
        console.error(message);
        // Could implement a toast notification system here
    }

    formatNumber(num, decimals = 2) {
        if (num === null || num === undefined) return '-';
        return num.toLocaleString(undefined, {
            minimumFractionDigits: decimals,
            maximumFractionDigits: decimals
        });
    }

    formatCurrency(num, decimals = 2) {
        if (num === null || num === undefined) return '-';
        return '$' + this.formatNumber(num, decimals);
    }

    formatPercent(num, decimals = 2) {
        if (num === null || num === undefined) return '-';
        return this.formatNumber(num, decimals) + '%';
    }

    formatVolume(num) {
        if (num === null || num === undefined) return '-';

        if (num >= 1e9) {
            return (num / 1e9).toFixed(2) + 'B';
        } else if (num >= 1e6) {
            return (num / 1e6).toFixed(2) + 'M';
        } else if (num >= 1e3) {
            return (num / 1e3).toFixed(2) + 'K';
        }

        return num.toString();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.dashboardApp = new DashboardApp();
});

// Cleanup on page unload
window.addEventListener('beforeunload', () => {
    widgetManager.clearAllAutoRefresh();
    chartManager.destroyAllCharts();
});
