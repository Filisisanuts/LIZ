/**
 * Dashboard Charts - 图表组件
 *
 * 使用 Chart.js 渲染近7日趋势图。
 */

import type { TrendData } from './dashboard-service';

// Chart.js 类型声明
declare const Chart: any;

let chartInstance: any = null;

/**
 * 初始化 Dashboard 图表
 */
export function initDashboardChart(data: TrendData[]): void {
  // Chart.js 未加载则跳过
  if (typeof Chart === 'undefined') {
    console.warn('Chart.js not loaded, skipping chart initialization');
    return;
  }

  // 销毁旧实例
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }

  const ctx = document.getElementById('dashChart');
  if (!ctx) return;

  // Chart.js 全局样式
  Chart.defaults.color = '#7a7570';
  Chart.defaults.font.family = "'DM Mono','Lexend',monospace";

  // 创建图表
  chartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: data.map((d) => d.label),
      datasets: [
        {
          label: '实收',
          data: data.map((d) => d.revenue),
          backgroundColor: 'rgba(201,168,76,.55)',
          borderColor: '#c9a84c',
          borderWidth: 1,
          borderRadius: 4,
          yAxisID: 'y',
          order: 2,
        },
        {
          label: '客流',
          data: data.map((d) => d.guests),
          type: 'line',
          borderColor: '#60a5fa',
          backgroundColor: 'rgba(96,165,250,.08)',
          fill: true,
          pointBackgroundColor: '#60a5fa',
          pointRadius: 4,
          pointHoverRadius: 7,
          tension: 0.3,
          yAxisID: 'y1',
          order: 1,
        },
      ],
    },
    options: {
      maintainAspectRatio: true,
      aspectRatio: 2,
      responsive: true,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: {
          position: 'bottom',
          labels: { padding: 16, usePointStyle: true, font: { size: 11 } },
        },
        tooltip: {
          backgroundColor: '#1e2130',
          borderColor: '#2d3041',
          borderWidth: 1,
          padding: 12,
          cornerRadius: 6,
          callbacks: {
            title: (items: any[]) => items[0].label,
            label: (ctx: any) => {
              if (ctx.dataset.label === '实收') {
                return ` 实收: ${ctx.raw.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}元`;
              }
              return ` 客流: ${ctx.raw}人`;
            },
          },
        },
      },
      scales: {
        y: {
          position: 'left',
          grid: { color: 'rgba(45,48,65,.3)' },
          ticks: {
            callback: (v: number) => (v >= 10000 ? `${(v / 10000).toFixed(1)}万` : v),
          },
          title: { display: true, text: '实收（元）', color: '#c9a84c', font: { size: 10 } },
        },
        y1: {
          position: 'right',
          grid: { drawOnChartArea: false },
          min: 0,
          title: { display: true, text: '客流（人）', color: '#60a5fa', font: { size: 10 } },
        },
        x: {
          grid: { display: false },
        },
      },
    },
  });
}

/**
 * 销毁图表实例
 */
export function destroyDashboardChart(): void {
  if (chartInstance) {
    chartInstance.destroy();
    chartInstance = null;
  }
}

export default {
  initDashboardChart,
  destroyDashboardChart,
};
