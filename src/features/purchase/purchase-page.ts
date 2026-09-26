/**
 * Purchase Page - 采购页面组件
 *
 * 提供采购的粘贴解析、手动录入、日历视图、退货功能。
 * 当前为简化版本，复用旧系统逻辑。
 */

import { formatCurrency } from '@/shared/format/currency';
import {
  getMonthlyPurchases,
  getMonthlyPurchaseStats,
  type Purchase,
} from './purchase-service';

// ===== 组件函数 =====

/**
 * 渲染 Purchase 页面
 */
export function renderPurchase(container: HTMLElement): void {
  let html = '';

  // 标签栏
  html += `
    <div class="view-tabs" id="purTabs" role="tablist" aria-label="采购视图">
      <button type="button" class="view-tab active" role="tab" aria-selected="true" onclick="switchPurTab('text')">粘贴</button>
      <button type="button" class="view-tab" role="tab" aria-selected="false" onclick="switchPurTab('manual')">手动</button>
      <button type="button" class="view-tab" role="tab" aria-selected="false" onclick="switchPurTab('ai')">拍照</button>
      <button type="button" class="view-tab" role="tab" aria-selected="false" onclick="switchPurTab('hist')">明细</button>
    </div>
  `;

  // 粘贴页
  html += `
    <div id="purText">
      <textarea id="purInput" placeholder="粘贴采购单..." style="width: 100%; min-height: 100px; resize: vertical; box-sizing: border-box;"></textarea>
      <div style="margin-top: 0.75rem;">
        <button class="btn-primary" onclick="doParsePurchase()">解析</button>
      </div>
      <div id="purPreview"></div>
    </div>
  `;

  // 手动页
  html += `
    <div id="purManual" style="display: none;">
      <div id="purFormArea"></div>
    </div>
  `;

  // 拍照页
  html += `
    <div id="purAI" style="display: none;">
      <div style="text-align: center; padding: 2rem;">
        <p style="color: var(--color-text-muted); margin-bottom: 1rem;">拍照识别采购单</p>
        <input type="file" id="purPhotoInput" accept="image/*" capture="environment" style="display: none;" onchange="handlePurPhoto(event)">
        <button class="btn-primary" onclick="document.getElementById('purPhotoInput').click()">📷 拍照/选择图片</button>
      </div>
      <div id="purAIPreview"></div>
    </div>
  `;

  // 明细页
  html += `
    <div id="purHist" style="display: none;">
      <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem; align-items: center;">
        <label style="font-size: 0.85rem; color: var(--color-text-secondary);">月份</label>
        <button class="btn-secondary" onclick="purCalNav(-1)">◀</button>
        <input type="text" id="purM" readonly style="max-width: 180px; cursor: pointer;">
        <button class="btn-secondary" onclick="purCalNav(1)">▶</button>
      </div>
      <div id="purHistArea"></div>
    </div>
  `;

  container.innerHTML = html;

  // 初始化
  initPurchaseGlobals();
  setTimeout(() => {
    renderPurchaseHistory();
  }, 100);
}

/**
 * 渲染采购历史列表
 */
function renderPurchaseHistory(): void {
  const area = document.getElementById('purHistArea');
  if (!area) return;

  const monthInput = document.getElementById('purM') as HTMLInputElement;
  const ym = monthInput?.value || getCurrentYearMonth();

  const stats = getMonthlyPurchaseStats(ym);
  const purchases = getMonthlyPurchases(ym).sort((a, b) => b.date.localeCompare(a.date));

  let html = '';

  // 统计卡片
  html += '<div class="card-grid" style="margin-bottom: 1rem;">';
  html += `
    <div class="stat-card">
      <div class="stat-card-label">本月采购</div>
      <div class="stat-card-value positive">${formatCurrency(stats.total)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">本月退货</div>
      <div class="stat-card-value negative">${formatCurrency(stats.returns)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">净采购</div>
      <div class="stat-card-value positive">${formatCurrency(stats.net)}</div>
    </div>
    <div class="stat-card">
      <div class="stat-card-label">采购天数</div>
      <div class="stat-card-value">${stats.days}</div>
    </div>
  `;
  html += '</div>';

  // 按日期分组
  const byDate: Record<string, Purchase[]> = {};
  purchases.forEach((p) => {
    if (!byDate[p.date]) byDate[p.date] = [];
    byDate[p.date].push(p);
  });

  if (Object.keys(byDate).length === 0) {
    html += '<div style="text-align: center; padding: 1.5rem; color: var(--color-text-muted);">暂无</div>';
  } else {
    Object.keys(byDate)
      .sort((a, b) => b.localeCompare(a))
      .forEach((date) => {
        const dayPurchases = byDate[date];
        const dayTotal = dayPurchases.reduce((sum, p) => sum + p.total, 0);

        html += `<div style="margin-bottom: 1rem;">`;
        html += `
          <div style="display: flex; align-items: center; justify-content: space-between; padding: 0.5rem 0.75rem; background: var(--color-bg-elevated); border: 1px solid var(--color-border); border-radius: var(--radius-md); margin-bottom: 0.375rem;">
            <span style="font-size: 0.85rem; font-weight: 600;">${date}</span>
            <span style="font-family: var(--font-mono); color: var(--color-primary);">${formatCurrency(dayTotal)}</span>
          </div>
        `;

        dayPurchases.forEach((p) => {
          html += `
            <div style="padding: 0.5rem 0.75rem; border-bottom: 1px solid var(--color-border-light);">
              <div style="display: flex; justify-content: space-between; align-items: center;">
                <span style="font-size: 0.85rem;">${p.source || '外购'} · ${p.items.length}项</span>
                <span style="font-family: var(--font-mono);">${formatCurrency(p.total)}</span>
              </div>
              <div style="display: flex; gap: 0.5rem; margin-top: 0.25rem;">
                <button class="btn-secondary btn-sm" onclick="showPurDetail('${p.id}')">详</button>
                <button class="btn-secondary btn-sm" onclick="editPur('${p.id}')">编</button>
                <button class="btn-secondary btn-sm btn-danger" onclick="delPur('${p.id}')">×</button>
              </div>
            </div>
          `;
        });

        html += '</div>';
      });
  }

  area.innerHTML = html;
}

// ===== 全局函数绑定 =====

function initPurchaseGlobals(): void {
  // 切换标签
  (window as any).switchPurTab = (tab: string) => {
    const textEl = document.getElementById('purText');
    const manualEl = document.getElementById('purManual');
    const aiEl = document.getElementById('purAI');
    const histEl = document.getElementById('purHist');
    const tabs = document.querySelectorAll('#purTabs .view-tab');

    tabs.forEach((t) => t.classList.remove('active'));

    // 隐藏所有
    textEl && (textEl.style.display = 'none');
    manualEl && (manualEl.style.display = 'none');
    aiEl && (aiEl.style.display = 'none');
    histEl && (histEl.style.display = 'none');

    if (tab === 'text') {
      textEl?.style.removeProperty('display');
      tabs[0]?.classList.add('active');
    } else if (tab === 'manual') {
      manualEl?.style.removeProperty('display');
      tabs[1]?.classList.add('active');
      initManualForm();
    } else if (tab === 'ai') {
      aiEl?.style.removeProperty('display');
      tabs[2]?.classList.add('active');
    } else {
      histEl?.style.removeProperty('display');
      tabs[3]?.classList.add('active');
      renderPurchaseHistory();
    }
  };

  // 月份导航
  (window as any).purCalNav = (dir: number) => {
    const picker = document.getElementById('purM') as HTMLInputElement;
    const currentYM = picker?.value || getCurrentYearMonth();
    // @ts-ignore - 旧系统全局函数
    if (typeof window.calendarNav === 'function') {
      // @ts-ignore
      window.calendarNav(dir, currentYM, 'purM', () => {
        renderPurchaseHistory();
      });
    }
  };

  // 解析采购单（复用旧系统）
  (window as any).doParsePurchase = () => {
    // @ts-ignore - 旧系统全局函数
    if (typeof window.doParsePurchase === 'function') {
      // @ts-ignore
      window.doParsePurchase();
    }
  };

  // 手动录入（复用旧系统）
  (window as any).showAddPur = () => {
    // @ts-ignore - 旧系统全局函数
    if (typeof window.showAddPur === 'function') {
      // @ts-ignore
      window.showAddPur();
    }
  };

  // 拍照识别（复用旧系统）
  (window as any).handlePurPhoto = (event: Event) => {
    // @ts-ignore - 旧系统全局函数
    if (typeof window.handlePurPhoto === 'function') {
      // @ts-ignore
      window.handlePurPhoto(event);
    }
  };

  // 查看详情（复用旧系统）
  (window as any).showPurDetail = (id: string) => {
    // @ts-ignore - 旧系统全局函数
    if (typeof window.showPurDetail === 'function') {
      // @ts-ignore
      window.showPurDetail(id);
    }
  };

  // 编辑采购（复用旧系统）
  (window as any).editPur = (id: string) => {
    // @ts-ignore - 旧系统全局函数
    if (typeof window.editPur === 'function') {
      // @ts-ignore
      window.editPur(id);
    }
  };

  // 删除采购（复用旧系统）
  (window as any).delPur = (id: string) => {
    // @ts-ignore - 旧系统全局函数
    if (typeof window.delPur === 'function') {
      // @ts-ignore
      window.delPur(id);
    }
  };
}

function initManualForm(): void {
  // 复用旧系统的手动录入表单
  // @ts-ignore - 旧系统全局函数
  if (typeof window.showAddPur === 'function') {
    // @ts-ignore
    window.showAddPur();
  }
}

// ===== 辅助函数 =====

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export default {
  renderPurchase,
};
