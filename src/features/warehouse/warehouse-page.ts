/**
 * Warehouse Page - 仓库管理页面组件
 *
 * 提供仓库物品列表、出入库操作、分类管理等功能。
 * 当前为简化版本，复用旧系统弹窗逻辑。
 */

import {
  getWarehouseItems,
  getLowStockCount,
  type WarehouseItem,
} from './warehouse-service';

// ===== 组件函数 =====

/**
 * 渲染 Warehouse 页面
 */
export function renderWarehouse(container: HTMLElement): void {
  const items = getWarehouseItems();
  const lowCount = getLowStockCount();

  let html = '';

  // 操作按钮
  html += `
    <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap;">
      <button class="btn-primary" onclick="showAddWH()">+添加</button>
      <button class="btn-secondary" onclick="whMoveAll(1)">入库</button>
      <button class="btn-secondary" onclick="whMoveAll(-1)">出库</button>
      <button class="btn-secondary" onclick="showWHCats()">分类管理</button>
    </div>
  `;

  // 统计卡片
  html += '<div class="card-grid" style="margin-bottom: 1rem;">';
  html += `
    <div class="stat-card">
      <div class="stat-card-label">品类</div>
      <div class="stat-card-value positive">${items.length}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">低库存预警</div>
      <div class="stat-card-value ${lowCount > 0 ? 'negative' : 'positive'}">${lowCount}</div>
    </div>
  `;
  html += '</div>';

  // 物品列表
  if (items.length === 0) {
    html += '<div style="text-align: center; padding: 2rem; color: var(--color-text-muted);">暂无</div>';
  } else {
    // 按分类分组
    const groups: Record<string, WarehouseItem[]> = {};
    items.forEach((item) => {
      const cat = item.category || '未分类';
      if (!groups[cat]) groups[cat] = [];
      groups[cat].push(item);
    });

    // 排序：有低库存的分类在前
    const sortedCats = Object.keys(groups).sort((a, b) => {
      const aLow = groups[a].filter((i) => i.safeStock > 0 && i.stock <= i.safeStock).length;
      const bLow = groups[b].filter((i) => i.safeStock > 0 && i.stock <= i.safeStock).length;
      return bLow - aLow;
    });

    sortedCats.forEach((cat) => {
      const catItems = groups[cat];
      const catLow = catItems.filter((i) => i.safeStock > 0 && i.stock <= i.safeStock).length;

      html += `<div style="margin-bottom: 1rem;">`;

      // 分类标题
      html += `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; background: ${catLow > 0 ? 'rgba(199,84,80,0.06)' : 'var(--color-bg-elevated)'}; border: 1px solid ${catLow > 0 ? 'var(--color-error)' : 'var(--color-border)'}; border-radius: var(--radius-md); margin-bottom: 0.375rem;">
          <span style="font-size: 0.85rem; font-weight: 600; color: ${catLow > 0 ? 'var(--color-error)' : 'var(--color-primary)'};">
            ${cat} <span style="font-size: 0.75rem; color: var(--color-text-muted); font-weight: 400;">${catItems.length}项</span>
          </span>
          ${catLow > 0 ? `<span style="background: var(--color-error); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">${catLow}项低库存</span>` : ''}
        </div>
      `;

      // 物品表格
      html += '<div class="data-table"><table>';
      html += `
        <thead>
          <tr>
            <th>品名</th>
            <th>单位</th>
            <th style="text-align: right;">库存</th>
            <th style="text-align: right;">安全库存</th>
            <th>状态</th>
            <th>操作</th>
          </tr>
        </thead>
        <tbody>
      `;

      catItems
        .sort((a, b) => {
          const aLow = a.safeStock > 0 && a.stock <= a.safeStock ? 0 : 1;
          const bLow = b.safeStock > 0 && b.stock <= b.safeStock ? 0 : 1;
          return aLow - bLow || b.stock - a.stock;
        })
        .forEach((item) => {
          const isLow = item.safeStock > 0 && item.stock <= item.safeStock;
          html += `
            <tr ${isLow ? 'style="background: rgba(199,84,80,0.04);"' : ''}>
              <td>${item.name}</td>
              <td>${item.unit || '-'}</td>
              <td style="text-align: right; font-family: var(--font-mono);">${item.stock}</td>
              <td style="text-align: right; font-family: var(--font-mono);">${item.safeStock || '-'}</td>
              <td>
                ${item.safeStock > 0
                  ? isLow
                    ? '<span style="background: var(--color-error); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">低</span>'
                    : '<span style="background: var(--color-success); color: white; padding: 2px 8px; border-radius: 12px; font-size: 0.75rem;">正常</span>'
                  : '-'}
              </td>
              <td>
                <button class="btn-secondary btn-sm" onclick="showEditWH('${item.id}')">编</button>
                <button class="btn-secondary btn-sm" onclick="whDetail('${item.id}')">详</button>
                <button class="btn-secondary btn-sm btn-danger" onclick="delWH('${item.id}')">×</button>
              </td>
            </tr>
          `;
        });

      html += '</tbody></table></div></div>';
    });
  }

  container.innerHTML = html;
}

// ===== 全局函数绑定 =====

export function initWarehouseGlobals(): void {
  // 这些函数调用旧系统的弹窗逻辑
  const oldFunctions = [
    'showAddWH', 'doAddWH', 'showEditWH', 'doEditWH', 'delWH',
    'whMoveAll', 'doWhMoveAll', 'whDetail', 'showWHCats',
    'addWHCat', 'editWHCat', 'delWHCat', 'moveWHCat', 'doEditWHCat',
    'editWHMove', 'saveWHMove', 'delWHMove',
  ];

  oldFunctions.forEach((fn) => {
    if (typeof (window as any)[fn] === 'function') {
      // 旧系统函数已存在，无需覆盖
    }
  });
}

export default {
  renderWarehouse,
  initWarehouseGlobals,
};
