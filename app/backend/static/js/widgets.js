/**
 * Widget Management
 * Handles widget lifecycle and updates
 */

class WidgetManager {
    constructor() {
        this.widgets = new Map();
        this.updateIntervals = new Map();
    }

    registerWidget(widgetType, updateFn, refreshInterval = null) {
        this.widgets.set(widgetType, updateFn);

        if (refreshInterval) {
            this.setAutoRefresh(widgetType, refreshInterval);
        }
    }

    async updateWidget(widgetType, ...args) {
        const updateFn = this.widgets.get(widgetType);
        if (!updateFn) {
            console.error(`Widget type ${widgetType} not registered`);
            return;
        }

        try {
            await updateFn(...args);
        } catch (error) {
            console.error(`Error updating widget ${widgetType}:`, error);
            this.showWidgetError(widgetType, error.message);
        }
    }

    setAutoRefresh(widgetType, interval) {
        this.clearAutoRefresh(widgetType);

        const intervalId = setInterval(() => {
            this.updateWidget(widgetType);
        }, interval);

        this.updateIntervals.set(widgetType, intervalId);
    }

    clearAutoRefresh(widgetType) {
        const intervalId = this.updateIntervals.get(widgetType);
        if (intervalId) {
            clearInterval(intervalId);
            this.updateIntervals.delete(widgetType);
        }
    }

    clearAllAutoRefresh() {
        this.updateIntervals.forEach((intervalId, widgetType) => {
            this.clearAutoRefresh(widgetType);
        });
    }

    showWidgetLoading(widgetType) {
        const widget = document.querySelector(`[data-widget-type="${widgetType}"]`);
        if (!widget) return;

        const content = widget.querySelector('.widget-content');
        if (content) {
            content.innerHTML = '<div class="loading">Loading...</div>';
        }
    }

    showWidgetError(widgetType, message) {
        const widget = document.querySelector(`[data-widget-type="${widgetType}"]`);
        if (!widget) return;

        const content = widget.querySelector('.widget-content');
        if (content) {
            content.innerHTML = `<div class="error">Error: ${message}</div>`;
        }
    }
}

// Widget update functions
async function updateTickerInfo(symbol) {
    try {
        const response = await fetch(`/api/stock/quote/${symbol}`);
        if (!response.ok) throw new Error('Failed to fetch quote');

        const quote = await response.json();

        // Update ticker details
        const details = document.getElementById('tickerDetails');
        if (details) {
            const changeClass = quote.change >= 0 ? 'positive' : 'negative';
            const changeArrow = quote.change >= 0 ? '↑' : '↓';

            details.innerHTML = `
                <div class="price-info">
                    <div class="label">Price</div>
                    <div class="value price">$${quote.price.toFixed(2)}</div>
                </div>
                <div class="change-info">
                    <div class="label">Day's Change</div>
                    <div class="value ${changeClass}">
                        <span class="change-arrow">${changeArrow}</span>
                        <span>${Math.abs(quote.change).toFixed(2)} (${quote.change_percent.toFixed(2)}%)</span>
                    </div>
                </div>
                <div class="volume-info">
                    <div class="label">Volume</div>
                    <div class="value">${(quote.volume / 1000000).toFixed(3)} M</div>
                </div>
            `;
        }

        // Update mini chart
        const historyResponse = await fetch(`/api/stock/history/${symbol}?period=5d`);
        if (historyResponse.ok) {
            const historyData = await historyResponse.json();
            chartManager.createMiniChart('miniChart', historyData.data);
        }

    } catch (error) {
        console.error('Error updating ticker info:', error);
    }
}

async function updatePriceChart(symbol, period = '1mo') {
    try {
        const response = await fetch(`/api/stock/history/${symbol}?period=${period}`);
        if (!response.ok) throw new Error('Failed to fetch price history');

        const data = await response.json();
        chartManager.createPriceChart('priceChart', data.data);

    } catch (error) {
        console.error('Error updating price chart:', error);
    }
}

async function updateCompanyProfile(symbol) {
    try {
        const response = await fetch(`/api/stock/info/${symbol}`);
        if (!response.ok) throw new Error('Failed to fetch company info');

        const info = await response.json();

        const profileContent = document.getElementById('profileContent');
        if (profileContent) {
            profileContent.innerHTML = `
                <div class="profile-header">
                    <h3>${info.name || symbol}</h3>
                    <p class="profile-address">${info.address || ''}</p>
                    ${info.website ? `<a href="${info.website}" target="_blank" class="profile-link">${info.website}</a>` : ''}
                </div>
                <div class="profile-meta">
                    ${info.sector ? `
                    <div class="meta-item">
                        <span class="label">Sector:</span>
                        <span class="value">${info.sector}</span>
                    </div>` : ''}
                    ${info.industry ? `
                    <div class="meta-item">
                        <span class="label">Industry:</span>
                        <span class="value">${info.industry}</span>
                    </div>` : ''}
                    ${info.employees ? `
                    <div class="meta-item">
                        <span class="label">Employees:</span>
                        <span class="value">${info.employees.toLocaleString()}</span>
                    </div>` : ''}
                </div>
                ${info.description ? `
                <div class="profile-description">
                    <h4>Description</h4>
                    <p>${info.description.substring(0, 300)}...</p>
                </div>` : ''}
            `;
        }

    } catch (error) {
        console.error('Error updating company profile:', error);
    }
}

async function updateEconomicIndicators() {
    try {
        const response = await fetch('/api/economic/indicators');
        if (!response.ok) throw new Error('Failed to fetch economic indicators');

        const indicators = await response.json();

        const container = document.getElementById('economicIndicators');
        if (container) {
            const cards = [];

            if (indicators.gdp) {
                cards.push(`
                    <div class="indicator-card">
                        <div class="indicator-label">GDP</div>
                        <div class="indicator-value">${indicators.gdp.value.toLocaleString()} ${indicators.gdp.unit || ''}</div>
                    </div>
                `);
            }

            if (indicators.unemployment) {
                cards.push(`
                    <div class="indicator-card">
                        <div class="indicator-label">Unemployment</div>
                        <div class="indicator-value">${indicators.unemployment.value}%</div>
                    </div>
                `);
            }

            if (indicators.cpi) {
                cards.push(`
                    <div class="indicator-card">
                        <div class="indicator-label">CPI</div>
                        <div class="indicator-value">${indicators.cpi.value}</div>
                    </div>
                `);
            }

            if (indicators.interest_rate) {
                cards.push(`
                    <div class="indicator-card">
                        <div class="indicator-label">Interest Rate</div>
                        <div class="indicator-value">${indicators.interest_rate.value}%</div>
                    </div>
                `);
            }

            container.innerHTML = cards.join('');
        }

    } catch (error) {
        console.error('Error updating economic indicators:', error);
    }
}

// Export singleton instance
const widgetManager = new WidgetManager();

// Register widgets
widgetManager.registerWidget('ticker-info', updateTickerInfo);
widgetManager.registerWidget('price-chart', updatePriceChart);
widgetManager.registerWidget('company-profile', updateCompanyProfile);
widgetManager.registerWidget('economic', updateEconomicIndicators);
