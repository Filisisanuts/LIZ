/**
 * Dashboard Page - 总览页面组件
 *
 * 渲染总览仪表盘，包括昨日日报、本月统计、采购成本、库存经营、补货预警、趋势图。
 */

import { formatCurrency } from '@/shared/format/currency';
import {
  getYesterdayReport,
  getMonthlyStats,
  getPurchaseStats,
  getInventoryStats,
  getRestockAlerts,
  getTrendData,
} from './dashboard-service';
import { initDashboardChart } from './dashboard-charts';

// ===== 类型 =====

interface CardOptions {
  label: string;
  value: string | number;
  className?: string;
}

// ===== 组件函数 =====

/**
 * 创建统计卡片
 */
function createCard({ label, value, className = '' }: CardOptions): string {
  return `
    <div class="stat-card">
      <div class="stat-card-label">${label}</div>
      <div class="stat-card-value ${className}">${value}</div>
    </div>
  `;
}

/**
 * 创建区块标题
 */
function createSectionTitle(icon: string, title: string): string {
  return `<h3 style="margin: 1.5rem 0 0.75rem; font-size: 0.9rem; font-weight: 600;">${icon} ${title}</h3>`;
}

/**
 * 渲染 Dashboard 页面
 */
export function renderDashboard(container: HTMLElement): void {
  const formatCurrencyValue = (n: number) => formatCurrency(n);

  // 获取数据
  const yesterday = getYesterdayReport();
  const monthly = getMonthlyStats();
  const purchases = getPurchaseStats();
  const inventory = getInventoryStats();
  const alerts = getRestockAlerts();
  const trendData = getTrendData();

  // 构建 HTML
  let html = '';

  // 补货预警
  if (alerts.length > 0) {
    html += `
      <div style="background: #fff3e0; border: 1px solid #ffb74d; border-radius: var(--radius-lg); padding: 0.75rem 1rem; margin-bottom: 1rem; font-size: 0.8rem;">
        <strong style="color: #e65100;">⚠️ 补货：</strong>
        ${alerts.map((a) => `<span style="background: #ff9800; color: white; padding: 2px 8px; border-radius: 12px; margin-left: 4px; font-size: 0.75rem;">${a.name} ${a.stock}${a.unit}</span>`).join(' ')}
      </div>
    `;
  }

  // 昨日日报
  html += createSectionTitle('📅', `${yesterday?.date || '昨日'} 日报`);
  if (yesterday) {
    html += '<div class="card-grid">';
    html += createCard({ label: '实收', value: formatCurrencyValue(yesterday.netSales), className: 'positive' });
    html += createCard({ label: '厨房', value: formatCurrencyValue(yesterday.kitchenSales) });
    html += createCard({ label: '吧台', value: formatCurrencyValue(yesterday.barSales) });
    html += createCard({ label: '外卖', value: formatCurrencyValue(yesterday.deliveryTotal), className: 'positive' });
    html += createCard({ label: '人数', value: yesterday.guestCount });
    html += createCard({ label: '500+包厢', value: yesterday.premiumRooms });
    html += '</div>';
  } else {
    html += '<div style="text-align: center; padding: 1rem; color: var(--color-text-muted); font-size: 0.8rem;">昨日暂无日报</div>';
  }

  // 本月营业数据
  const currentMonth = new Date().getMonth() + 1;
  html += createSectionTitle('📊', `营业数据 · ${currentMonth}月累计`);
  html += '<div class="card-grid">';
  html += createCard({ label: '实收', value: formatCurrencyValue(monthly.netSales), className: 'positive' });
  html += createCard({ label: '厨房', value: formatCurrencyValue(monthly.kitchenSales) });
  html += createCard({ label: '吧台', value: formatCurrencyValue(monthly.barSales) });
  html += createCard({ label: '外卖', value: formatCurrencyValue(monthly.deliveryTotal), className: 'positive' });
  html += createCard({ label: '人数', value: monthly.guestCount });
  html += createCard({ label: '人均', value: monthly.guestCount > 0 ? formatCurrencyValue(monthly.avgPerGuest) : '-' });
  html += createCard({ label: '500+包厢', value: monthly.premiumRooms });
  html += '</div>';

  // 采购成本
  html += createSectionTitle('🛒', '采购成本');
  html += '<div class="card-grid">';
  html += createCard({ label: '本月采购', value: formatCurrencyValue(purchases.total), className: 'positive' });
  html += createCard({ label: '本月退货', value: formatCurrencyValue(purchases.returns), className: 'negative' });
  html += createCard({ label: '净采购', value: formatCurrencyValue(purchases.net), className: 'positive' });
  html += createCard({ label: '采购天数', value: purchases.days });
  html += '</div>';

  // 贵重物品经营
  html += createSectionTitle('📦', '贵重物品经营');
  html += '<div class="card-grid">';
  html += createCard({ label: '茗茶实收', value: formatCurrencyValue(inventory.tea.revenue) });
  html += createCard({ label: '茗茶毛利', value: formatCurrencyValue(inventory.tea.profit), className: 'positive' });
  html += createCard({ label: '香烟实收', value: formatCurrencyValue(inventory.cig.revenue) });
  html += createCard({ label: '香烟毛利', value: formatCurrencyValue(inventory.cig.profit), className: 'positive' });
  html += createCard({ label: '酒类实收', value: formatCurrencyValue(inventory.alc.revenue) });
  html += createCard({ label: '酒类毛利', value: formatCurrencyValue(inventory.alc.profit), className: 'positive' });
  html += '</div>';

  // 近7日趋势图
  html += createSectionTitle('📈', '近7日趋势');
  html += `
    <div style="background: var(--color-bg-card); border: 1px solid var(--color-border-light); border-radius: var(--radius-lg); padding: 1rem;">
      <canvas id="dashChart" height="120"></canvas>
    </div>
  `;

  // 渲染到容器
  container.innerHTML = html;

  // 初始化图表
  setTimeout(() => initDashboardChart(trendData), 100);
}

export default {
  renderDashboard,
};
