/**
 * Report Page - 财务报表页面组件
 *
 * 渲染月度财务报表，包括核心指标、子标签导航、多维度报表。
 */

import { formatCurrency, formatPercent } from '@/shared/format/currency';
import { getReportData, type ReportData } from './report-service';

// ===== 类型 =====

type TabId = 'profit' | 'revenue' | 'cost' | 'catgp' | 'cig' | 'tea' | 'alc' | 'daily' | 'guest' | 'purchase';

interface Tab {
  id: TabId;
  label: string;
}

// ===== 组件函数 =====

/**
 * 创建统计卡片
 */
function createCard(label: string, value: string | number, className: string = ''): string {
  return `
    <div class="stat-card">
      <div class="stat-card-label">${label}</div>
      <div class="stat-card-value ${className}">${value}</div>
    </div>
  `;
}

/**
 * 渲染 Report 页面
 */
export function renderReport(container: HTMLElement, yearMonth?: string): void {
  const ym = yearMonth || new URLSearchParams(window.location.search).get('month') || getCurrentYearMonth();
  const data = getReportData(ym);

  // 构建 HTML
  let html = '';

  // 页面标题
  const [year, month] = ym.split('-');
  html += `
    <div style="text-align: center; margin-bottom: 1rem;">
      <div style="font-size: 1.2rem; font-weight: 700; color: var(--color-primary); letter-spacing: 0.05em;">
        ${data.shopName}
      </div>
      <div style="font-size: 0.8rem; color: var(--color-text-muted); letter-spacing: 0.1em;">
        FINANCIAL REPORT · ${year}.${month}
      </div>
    </div>
  `;

  // 核心指标卡片
  html += '<div class="card-grid" style="margin-bottom: 1.25rem;">';
  html += createCard('总流水', formatCurrency(data.revenue.gross), 'positive');
  html += createCard('总实收', formatCurrency(data.revenue.net), 'positive');
  html += createCard('总毛利', formatCurrency(data.profit.grossProfit), 'positive');
  html += createCard('毛利率', formatPercent(data.profit.grossMargin / 100), 'positive');
  html += createCard('营业利润', formatCurrency(data.profit.operatingProfit), data.profit.operatingProfit >= 0 ? 'positive' : 'negative');
  html += createCard('到店人数', data.revenue.guests);
  html += '</div>';

  // 子标签导航栏
  const tabs = getTabs(data);
  html += `
    <div class="tabs" id="reportTabs">
      ${tabs.map((t, i) => `
        <button class="tab-item ${i === 0 ? 'active' : ''}" data-tab="${t.id}">
          ${t.label}
        </button>
      `).join('')}
    </div>
  `;

  // 报表内容容器
  html += '<div id="reportContent"></div>';

  // 渲染到容器
  container.innerHTML = html;

  // 初始化标签切换
  initTabSwitching(container, data, tabs);
}

/**
 * 获取可用标签
 */
function getTabs(data: ReportData): Tab[] {
  const tabs: Tab[] = [
    { id: 'profit', label: '利润表' },
    { id: 'revenue', label: '营收总表' },
    { id: 'cost', label: '成本费用' },
    { id: 'catgp', label: '分类毛利' },
  ];

  if (data.inventory.cig.totalRevenue > 0) tabs.push({ id: 'cig', label: '香烟' });
  if (data.inventory.tea.totalRevenue > 0) tabs.push({ id: 'tea', label: '茗茶' });
  if (data.inventory.alc.totalRevenue > 0) tabs.push({ id: 'alc', label: '酒类' });

  tabs.push({ id: 'daily', label: '每日营收' });
  tabs.push({ id: 'guest', label: '客情包厢' });
  tabs.push({ id: 'purchase', label: '采购明细' });

  return tabs;
}

/**
 * 初始化标签切换
 */
function initTabSwitching(container: HTMLElement, data: ReportData, tabs: Tab[]): void {
  const tabsContainer = container.querySelector('#reportTabs');
  const contentContainer = container.querySelector('#reportContent');

  if (!tabsContainer || !contentContainer) return;

  // 渲染第一个标签
  renderTabContent(contentContainer as HTMLElement, tabs[0].id, data);

  // 绑定点击事件
  tabsContainer.addEventListener('click', (e) => {
    const target = e.target as HTMLElement;
    if (target.classList.contains('tab-item')) {
      const tabId = target.getAttribute('data-tab') as TabId;

      // 更新激活状态
      tabsContainer.querySelectorAll('.tab-item').forEach((t) => {
        t.classList.toggle('active', t === target);
      });

      // 渲染内容
      renderTabContent(contentContainer as HTMLElement, tabId, data);
    }
  });
}

/**
 * 渲染标签内容
 */
function renderTabContent(container: HTMLElement, tabId: TabId, data: ReportData): void {
  switch (tabId) {
    case 'profit':
      renderProfitTable(container, data);
      break;
    case 'revenue':
      renderRevenueTable(container, data);
      break;
    case 'cost':
      renderCostTable(container, data);
      break;
    case 'catgp':
      renderCategoryProfit(container, data);
      break;
    default:
      container.innerHTML = '<div style="padding: 1rem; color: var(--color-text-muted);">功能开发中...</div>';
  }
}

/**
 * 渲染利润表
 */
function renderProfitTable(container: HTMLElement, data: ReportData): void {
  const { revenue, purchase, expense, profit } = data;

  container.innerHTML = `
    <div class="data-table" style="margin-top: 1rem;">
      <table>
        <thead>
          <tr>
            <th>项目</th>
            <th style="text-align: right;">金额</th>
            <th style="text-align: right;">占比</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>总实收</strong></td>
            <td style="text-align: right; font-family: var(--font-mono);">${formatCurrency(revenue.net)}</td>
            <td style="text-align: right;">100%</td>
          </tr>
          <tr>
            <td>减：采购成本</td>
            <td style="text-align: right; font-family: var(--font-mono); color: var(--color-error);">-${formatCurrency(purchase.net)}</td>
            <td style="text-align: right;">${formatPercent(purchase.net / revenue.net)}</td>
          </tr>
          <tr style="background: var(--color-bg-elevated);">
            <td><strong>毛利</strong></td>
            <td style="text-align: right; font-family: var(--font-mono); color: var(--color-success);"><strong>${formatCurrency(profit.grossProfit)}</strong></td>
            <td style="text-align: right; color: var(--color-success);"><strong>${formatPercent(profit.grossMargin / 100)}</strong></td>
          </tr>
          <tr>
            <td>减：营业费用</td>
            <td style="text-align: right; font-family: var(--font-mono); color: var(--color-error);">-${formatCurrency(expense.total)}</td>
            <td style="text-align: right;">${formatPercent(expense.total / revenue.net)}</td>
          </tr>
          <tr style="background: var(--color-bg-elevated);">
            <td><strong>营业利润</strong></td>
            <td style="text-align: right; font-family: var(--font-mono); color: ${profit.operatingProfit >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">
              <strong>${formatCurrency(profit.operatingProfit)}</strong>
            </td>
            <td style="text-align: right; color: ${profit.operatingMargin >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">
              <strong>${formatPercent(profit.operatingMargin / 100)}</strong>
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

/**
 * 渲染营收总表
 */
function renderRevenueTable(container: HTMLElement, data: ReportData): void {
  const { revenue, payment, delivery } = data;

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; margin-top: 1rem;">
      <!-- 营收构成 -->
      <div class="data-table">
        <table>
          <thead>
            <tr><th colspan="2">营收构成</th></tr>
          </thead>
          <tbody>
            <tr><td>厨房营收</td><td style="text-align: right; font-family: var(--font-mono);">${formatCurrency(revenue.kitchen)}</td></tr>
            <tr><td>吧台营收</td><td style="text-align: right; font-family: var(--font-mono);">${formatCurrency(revenue.bar)}</td></tr>
            <tr><td>外卖营收</td><td style="text-align: right; font-family: var(--font-mono);">${formatCurrency(revenue.delivery)}</td></tr>
            <tr><td>香烟营收</td><td style="text-align: right; font-family: var(--font-mono);">${formatCurrency(revenue.cigarette)}</td></tr>
            <tr><td>其他营收</td><td style="text-align: right; font-family: var(--font-mono);">${formatCurrency(revenue.other)}</td></tr>
            <tr><td>优惠折扣</td><td style="text-align: right; font-family: var(--font-mono); color: var(--color-error);">-${formatCurrency(revenue.discount)}</td></tr>
          </tbody>
        </table>
      </div>

      <!-- 支付方式 -->
      <div class="data-table">
        <table>
          <thead>
            <tr><th colspan="2">支付方式</th></tr>
          </thead>
          <tbody>
            <tr><td>POS机</td><td style="text-align: right; font-family: var(--font-mono);">${formatCurrency(payment.pos)}</td></tr>
            <tr><td>建行生活</td><td style="text-align: right; font-family: var(--font-mono);">${formatCurrency(payment.ccbLife)}</td></tr>
            <tr><td>现金</td><td style="text-align: right; font-family: var(--font-mono);">${formatCurrency(payment.cash)}</td></tr>
            <tr><td>会员卡</td><td style="text-align: right; font-family: var(--font-mono);">${formatCurrency(payment.memberCard)}</td></tr>
            <tr><td>招待</td><td style="text-align: right; font-family: var(--font-mono);">${formatCurrency(payment.treat)}</td></tr>
            <tr><td>应收账款</td><td style="text-align: right; font-family: var(--font-mono);">${formatCurrency(payment.accountsReceivable.total)}</td></tr>
          </tbody>
        </table>
      </div>

      <!-- 外卖渠道 -->
      <div class="data-table">
        <table>
          <thead>
            <tr><th colspan="2">外卖渠道</th></tr>
          </thead>
          <tbody>
            <tr><td>美团外卖</td><td style="text-align: right; font-family: var(--font-mono);">${formatCurrency(delivery.meituan)}</td></tr>
            <tr><td>淘宝闪购</td><td style="text-align: right; font-family: var(--font-mono);">${formatCurrency(delivery.taobao)}</td></tr>
            <tr><td>京东外卖</td><td style="text-align: right; font-family: var(--font-mono);">${formatCurrency(delivery.jd)}</td></tr>
            <tr style="background: var(--color-bg-elevated);"><td><strong>外卖合计</strong></td><td style="text-align: right; font-family: var(--font-mono);"><strong>${formatCurrency(delivery.total)}</strong></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * 渲染成本费用表
 */
function renderCostTable(container: HTMLElement, data: ReportData): void {
  const { purchase, expense } = data;

  container.innerHTML = `
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 1rem; margin-top: 1rem;">
      <!-- 采购成本 -->
      <div class="data-table">
        <table>
          <thead>
            <tr><th colspan="2">采购成本</th></tr>
          </thead>
          <tbody>
            ${Object.entries(purchase.bySection).map(([section, amount]) => `
              <tr><td>${section}</td><td style="text-align: right; font-family: var(--font-mono);">${formatCurrency(amount)}</td></tr>
            `).join('')}
            <tr><td>退货</td><td style="text-align: right; font-family: var(--font-mono); color: var(--color-success);">+${formatCurrency(purchase.returns)}</td></tr>
            <tr style="background: var(--color-bg-elevated);"><td><strong>净采购</strong></td><td style="text-align: right; font-family: var(--font-mono);"><strong>${formatCurrency(purchase.net)}</strong></td></tr>
          </tbody>
        </table>
      </div>

      <!-- 营业费用 -->
      <div class="data-table">
        <table>
          <thead>
            <tr><th colspan="2">营业费用</th></tr>
          </thead>
          <tbody>
            ${Object.entries(expense.byCategory).map(([category, amount]) => `
              <tr><td>${category}</td><td style="text-align: right; font-family: var(--font-mono);">${formatCurrency(amount)}</td></tr>
            `).join('')}
            <tr style="background: var(--color-bg-elevated);"><td><strong>费用合计</strong></td><td style="text-align: right; font-family: var(--font-mono);"><strong>${formatCurrency(expense.total)}</strong></td></tr>
          </tbody>
        </table>
      </div>
    </div>
  `;
}

/**
 * 渲染分类毛利
 */
function renderCategoryProfit(container: HTMLElement, data: ReportData): void {
  const { profit } = data;

  container.innerHTML = `
    <div class="data-table" style="margin-top: 1rem;">
      <table>
        <thead>
          <tr>
            <th>分类</th>
            <th style="text-align: right;">毛利</th>
          </tr>
        </thead>
        <tbody>
          ${Object.entries(profit.byCategory).map(([category, amount]) => `
            <tr>
              <td>${getCategoryLabel(category)}</td>
              <td style="text-align: right; font-family: var(--font-mono); color: ${amount >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">
                ${formatCurrency(amount)}
              </td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    </div>
  `;
}

function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    kitchen: '厨房',
    bar: '吧台',
    tea: '茗茶',
    cigarette: '香烟',
    alcohol: '酒类',
    delivery: '外卖',
    other: '其他',
  };
  return labels[category] || category;
}

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default {
  renderReport,
};
