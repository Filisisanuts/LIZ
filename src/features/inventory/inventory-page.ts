/**
 * Inventory Page - 库存页面组件
 *
 * 提供库存管理、入库/销售、明细查看功能。
 * 当前为简化版本，复用旧系统逻辑。
 */

import { formatCurrency, formatPercent } from '@/shared/format/currency';
import {
  type InventoryType,
  INVENTORY_TYPES,
  getInventoryStats,
  getPendingExchanges,
} from './inventory-service';

// ===== 组件函数 =====

/**
 * 渲染 Inventory 页面
 */
export function renderInventory(container: HTMLElement, type: InventoryType): void {
  const config = INVENTORY_TYPES[type];
  const ym = getCurrentYearMonth();

  let html = '';

  // 统计卡片
  const stats = getInventoryStats(type, ym);
  const totalExpected = stats.reduce((sum, s) => sum + s.expected, 0);
  const totalActual = stats.reduce((sum, s) => sum + s.actual, 0);
  const totalCost = stats.reduce((sum, s) => sum + s.cost, 0);
  const totalProfit = totalActual - totalCost;

  html += '<div class="card-grid" style="margin-bottom: 1rem;">';
  html += `
    <div class="stat-card">
      <div class="stat-card-label">品类</div>
      <div class="stat-card-value positive">${stats.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">应收</div>
      <div class="stat-card-value">${formatCurrency(totalExpected)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">实收</div>
      <div class="stat-card-value positive">${formatCurrency(totalActual)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">成本</div>
      <div class="stat-card-value negative">${formatCurrency(totalCost)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">毛利</div>
      <div class="stat-card-value ${totalProfit >= 0 ? 'positive' : 'negative'}">${formatCurrency(totalProfit)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">毛利率</div>
      <div class="stat-card-value">${totalActual > 0 ? formatPercent(totalProfit / totalActual) : '0%'}</div>
    </div>
  `;
  html += '</div>';

  // 兑奖状态提示（仅贵重物品）
  if (type === 'other') {
    const pendingExchanges = getPendingExchanges();
    if (pendingExchanges.length > 0) {
      const totalQty = pendingExchanges.reduce((sum, e) => sum + e.qty, 0);
      const tipText = pendingExchanges.map((e) => `${e.name} ×${e.qty}`).join('、');
      html += `
        <div style="margin-bottom: 0.75rem; padding: 0.5rem 0.75rem; background: #fff3e0; border: 1px solid #ffb74d; border-radius: var(--radius-md); font-size: 0.8rem; color: #e65100;">
          ⚠️ 待兑奖: ${tipText}（共${totalQty}包未向供应商兑奖）
        </div>
      `;
    }
  }

  // 月份选择器
  html += `
    <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem; align-items: center;">
      <label style="font-size: 0.85rem; color: var(--color-text-secondary);">月份</label>
      <button class="btn-secondary" onclick="invCalNav('${type}', -1)">◀</button>
      <input type="text" id="invMonth" readonly value="${ym}" style="max-width: 180px; cursor: pointer;">
      <button class="btn-secondary" onclick="invCalNav('${type}', 1)">▶</button>
    </div>
  `;

  // 标签栏
  html += `
    <div class="tabs" id="invT">
      <button class="tab-item active" onclick="switchInvT('hist', '${type}')">明细</button>
      <button class="tab-item" onclick="switchInvT('stock', '${type}')">库存</button>
    </div>
  `;

  // 库存表格（默认隐藏）
  html += `
    <div id="invStock" style="display: none;">
      <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
        <button class="btn-primary" onclick="showAddInv('${type}')">+添加</button>
        <button class="btn-secondary" onclick="invMoveAll('${type}', 1)">入库</button>
        <button class="btn-secondary" onclick="invMoveAll('${type}', -1)">销售</button>
        ${type === 'other' ? `
          <button class="btn-primary" onclick="showExchangeModal()">🎰兑换</button>
          <button class="btn-secondary" onclick="showExchangeList()">📋兑奖明细</button>
        ` : ''}
      </div>
      <div id="invStockTable"></div>
    </div>
  `;

  // 明细区域
  html += '<div id="invHistArea"></div>';

  container.innerHTML = html;

  // 初始化
  initInventoryGlobals(type);
  renderInventoryStock(type);
  renderInventoryHistory(type);
}

/**
 * 渲染库存表格
 */
function renderInventoryStock(type: InventoryType): void {
  const tableArea = document.getElementById('invStockTable');
  if (!tableArea) return;

  const ym = (document.getElementById('invMonth') as HTMLInputElement)?.value || getCurrentYearMonth();
  const stats = getInventoryStats(type, ym);
  const config = INVENTORY_TYPES[type];

  if (stats.length === 0) {
    tableArea.innerHTML = '<div style="text-align: center; padding: 1.5rem; color: var(--color-text-muted);">暂无</div>';
    return;
  }

  let html = '<div class="data-table"><table>';
  html += `
    <thead>
      <tr>
        <th>品名</th>
        <th style="text-align: right;">结存</th>
        <th style="text-align: right;">本月实收</th>
        <th style="text-align: right;">销售成本</th>
        <th style="text-align: right;">毛利</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
  `;

  stats.forEach((stat) => {
    const unit = type === 'tea'
      ? (stat.item.calcMode === 'pack' ? '包' : '克')
      : type === 'other'
        ? (stat.item.unit || '个')
        : type === 'cig' ? '包' : '瓶';

    html += `
      <tr>
        <td style="font-weight: 600;">${stat.item.name}</td>
        <td style="text-align: right; font-family: var(--font-mono);">${stat.stock}${unit}</td>
        <td style="text-align: right; font-family: var(--font-mono); color: var(--color-success);">${formatCurrency(stat.actual)}</td>
        <td style="text-align: right; font-family: var(--font-mono); color: var(--color-error);">${formatCurrency(stat.cost)}</td>
        <td style="text-align: right; font-family: var(--font-mono); color: ${stat.profit >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">
          ${formatCurrency(stat.profit)}
        </td>
        <td>
          <button class="btn-secondary btn-sm" onclick="showEditInv('${type}', '${stat.item.id}')">编</button>
          <button class="btn-secondary btn-sm" onclick="invDetail('${type}', '${stat.item.id}')">详</button>
          <button class="btn-secondary btn-sm btn-danger" onclick="delInv('${type}', '${stat.item.id}')">×</button>
        </td>
      </tr>
    `;
  });

  // 合计行
  const totalActual = stats.reduce((sum, s) => sum + s.actual, 0);
  const totalCost = stats.reduce((sum, s) => sum + s.cost, 0);
  const totalProfit = totalActual - totalCost;

  html += `
    <tr style="background: var(--color-bg-elevated);">
      <td style="font-weight: 600;">合计</td>
      <td></td>
      <td style="text-align: right; font-family: var(--font-mono); font-weight: 600; color: var(--color-success);">${formatCurrency(totalActual)}</td>
      <td style="text-align: right; font-family: var(--font-mono); font-weight: 600; color: var(--color-error);">${formatCurrency(totalCost)}</td>
      <td style="text-align: right; font-family: var(--font-mono); font-weight: 600; color: ${totalProfit >= 0 ? 'var(--color-success)' : 'var(--color-error)'};">
        ${formatCurrency(totalProfit)}
      </td>
      <td></td>
    </tr>
  `;

  html += '</tbody></table></div>';
  tableArea.innerHTML = html;
}

/**
 * 渲染库存明细
 */
function renderInventoryHistory(type: InventoryType): void {
  const histArea = document.getElementById('invHistArea');
  if (!histArea) return;

  const ym = (document.getElementById('invMonth') as HTMLInputElement)?.value || getCurrentYearMonth();
  const stats = getInventoryStats(type, ym);

  let html = '';

  stats.forEach((stat) => {
    const unit = type === 'tea'
      ? (stat.item.calcMode === 'pack' ? '包' : '克')
      : type === 'other'
        ? (stat.item.unit || '个')
        : type === 'cig' ? '包' : '瓶';

    html += `
      <div style="background: var(--color-bg-card); border: 1px solid var(--color-border-light); border-radius: var(--radius-lg); padding: 1rem; margin-bottom: 0.75rem;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
          <span style="font-weight: 600;">${stat.item.name}</span>
          <span style="font-family: var(--font-mono); color: var(--color-primary);">${stat.stock}${unit}</span>
        </div>
        <div style="display: flex; gap: 1rem; font-size: 0.8rem; color: var(--color-text-secondary);">
          <span>售 ${stat.cups}杯+${stat.pots}壶</span>
          <span>实收 ${formatCurrency(stat.actual)}</span>
          <span>成本 ${formatCurrency(stat.cost)}</span>
        </div>
      </div>
    `;
  });

  if (stats.length === 0) {
    html = '<div style="text-align: center; padding: 1.5rem; color: var(--color-text-muted);">暂无</div>';
  }

  histArea.innerHTML = html;
}

// ===== 全局函数绑定 =====

function initInventoryGlobals(type: InventoryType): void {
  // 切换标签
  (window as any).switchInvT = (tab: string, invType: InventoryType) => {
    const stockEl = document.getElementById('invStock');
    const histArea = document.getElementById('invHistArea');
    const tabs = document.querySelectorAll('#invT .tab-item');

    tabs.forEach((t) => t.classList.remove('active'));

    if (tab === 'stock') {
      stockEl?.style.removeProperty('display');
      histArea && (histArea.style.display = 'none');
      tabs[1]?.classList.add('active');
      renderInventoryStock(invType);
    } else {
      stockEl && (stockEl.style.display = 'none');
      histArea?.style.removeProperty('display');
      tabs[0]?.classList.add('active');
      renderInventoryHistory(invType);
    }
  };

  // 月份导航
  (window as any).invCalNav = (invType: InventoryType, dir: number) => {
    const picker = document.getElementById('invMonth') as HTMLInputElement;
    const currentYM = picker?.value || getCurrentYearMonth();
    // @ts-ignore - 旧系统全局函数
    if (typeof window.calendarNav === 'function') {
      // @ts-ignore
      window.calendarNav(dir, currentYM, 'invMonth', () => {
        renderInventoryStock(invType);
        renderInventoryHistory(invType);
      });
    }
  };

  // 添加库存（复用旧系统）
  (window as any).showAddInv = (invType: InventoryType) => {
    // @ts-ignore - 旧系统全局函数
    if (typeof window.showAddInv === 'function') {
      // @ts-ignore
      window.showAddInv(invType);
    }
  };

  // 编辑库存（复用旧系统）
  (window as any).showEditInv = (invType: InventoryType, id: string) => {
    // @ts-ignore - 旧系统全局函数
    if (typeof window.showEditInv === 'function') {
      // @ts-ignore
      window.showEditInv(invType, id);
    }
  };

  // 删除库存（复用旧系统）
  (window as any).delInv = (invType: InventoryType, id: string) => {
    // @ts-ignore - 旧系统全局函数
    if (typeof window.delInv === 'function') {
      // @ts-ignore
      window.delInv(invType, id);
    }
  };

  // 入库/销售（复用旧系统）
  (window as any).invMoveAll = (invType: InventoryType, dir: number) => {
    // @ts-ignore - 旧系统全局函数
    if (typeof window.invMoveAll === 'function') {
      // @ts-ignore
      window.invMoveAll(invType, dir);
    }
  };

  // 查看明细（复用旧系统）
  (window as any).invDetail = (invType: InventoryType, id: string) => {
    // @ts-ignore - 旧系统全局函数
    if (typeof window.invDetail === 'function') {
      // @ts-ignore
      window.invDetail(invType, id);
    }
  };

  // 兑奖（复用旧系统）
  (window as any).showExchangeModal = () => {
    // @ts-ignore - 旧系统全局函数
    if (typeof window.showExchangeModal === 'function') {
      // @ts-ignore
      window.showExchangeModal();
    }
  };

  (window as any).showExchangeList = () => {
    // @ts-ignore - 旧系统全局函数
    if (typeof window.showExchangeList === 'function') {
      // @ts-ignore
      window.showExchangeList();
    }
  };
}

// ===== 辅助函数 =====

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default {
  renderInventory,
};
