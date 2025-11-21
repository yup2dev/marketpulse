/**
 * Chart Management
 * Handles creation and updating of all charts
 */

class ChartManager {
    constructor() {
        this.charts = {};
        this.defaultOptions = {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: {
                    display: false
                },
                tooltip: {
                    mode: 'index',
                    intersect: false,
                    backgroundColor: 'rgba(26, 31, 46, 0.95)',
                    titleColor: '#e6edf3',
                    bodyColor: '#e6edf3',
                    borderColor: '#30363d',
                    borderWidth: 1,
                    padding: 12,
                    displayColors: false
                }
            }
        };
    }

    createMiniChart(canvasId, data) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        const chartData = {
            labels: data.map(d => d.date),
            datasets: [{
                data: data.map(d => d.close),
                borderColor: '#26a69a',
                backgroundColor: 'rgba(38, 166, 154, 0.1)',
                fill: true,
                tension: 0.4,
                borderWidth: 2,
                pointRadius: 0,
                pointHoverRadius: 4,
                pointHoverBackgroundColor: '#26a69a'
            }]
        };

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: {
                ...this.defaultOptions,
                scales: {
                    x: {
                        display: false
                    },
                    y: {
                        display: false
                    }
                },
                interaction: {
                    mode: 'index',
                    intersect: false
                }
            }
        });
    }

    createPriceChart(canvasId, data) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        // Calculate colors for each bar
        const colors = data.map(d => d.close >= d.open ? '#26a69a' : '#ef5350');

        const chartData = {
            labels: data.map(d => new Date(d.date).toLocaleDateString()),
            datasets: [
                {
                    label: 'Close Price',
                    data: data.map(d => d.close),
                    type: 'line',
                    borderColor: '#00d9ff',
                    backgroundColor: 'rgba(0, 217, 255, 0.1)',
                    fill: true,
                    tension: 0.1,
                    borderWidth: 2,
                    pointRadius: 0,
                    pointHoverRadius: 6,
                    pointHoverBackgroundColor: '#00d9ff',
                    yAxisID: 'price',
                    order: 0
                },
                {
                    label: 'Volume',
                    data: data.map(d => d.volume),
                    type: 'bar',
                    backgroundColor: colors.map(c => c + '80'),
                    borderColor: colors,
                    borderWidth: 1,
                    yAxisID: 'volume',
                    order: 1
                }
            ]
        };

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: chartData,
            options: {
                ...this.defaultOptions,
                interaction: {
                    mode: 'index',
                    intersect: false
                },
                scales: {
                    x: {
                        grid: {
                            color: '#21262d',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6e7681',
                            maxRotation: 0,
                            autoSkipPadding: 20
                        }
                    },
                    price: {
                        type: 'linear',
                        position: 'right',
                        grid: {
                            color: '#21262d',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6e7681',
                            callback: function(value) {
                                return '$' + value.toFixed(2);
                            }
                        }
                    },
                    volume: {
                        type: 'linear',
                        position: 'left',
                        grid: {
                            display: false
                        },
                        ticks: {
                            color: '#6e7681',
                            callback: function(value) {
                                return (value / 1000000).toFixed(0) + 'M';
                            }
                        },
                        max: Math.max(...data.map(d => d.volume)) * 4
                    }
                }
            }
        });
    }

    createLineChart(canvasId, labels, datasets) {
        const ctx = document.getElementById(canvasId);
        if (!ctx) return;

        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
        }

        this.charts[canvasId] = new Chart(ctx, {
            type: 'line',
            data: {
                labels: labels,
                datasets: datasets
            },
            options: {
                ...this.defaultOptions,
                scales: {
                    x: {
                        grid: {
                            color: '#21262d',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6e7681'
                        }
                    },
                    y: {
                        grid: {
                            color: '#21262d',
                            drawBorder: false
                        },
                        ticks: {
                            color: '#6e7681'
                        }
                    }
                }
            }
        });
    }

    updateChart(canvasId, data) {
        if (!this.charts[canvasId]) return;

        const chart = this.charts[canvasId];
        chart.data.labels = data.labels;
        chart.data.datasets = data.datasets;
        chart.update();
    }

    destroyChart(canvasId) {
        if (this.charts[canvasId]) {
            this.charts[canvasId].destroy();
            delete this.charts[canvasId];
        }
    }

    destroyAllCharts() {
        Object.keys(this.charts).forEach(id => {
            this.destroyChart(id);
        });
    }
}

// Export singleton instance
const chartManager = new ChartManager();
