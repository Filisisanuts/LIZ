/**
 * Brief Page - 汇报页面组件
 *
 * 提供报告周期选择和生成经营报告的功能。
 * 报告生成逻辑暂时复用旧系统，后续可独立实现。
 */

import legacyBridge from '@/legacy/legacy-bridge';

// ===== 类型 =====

type PeriodType = 'first' | 'second' | 'month' | 'custom';

interface PeriodOption {
  type: PeriodType;
  icon: string;
  label: string;
  description: string;
}

// ===== 常量 =====

const PERIOD_OPTIONS: PeriodOption[] = [
  { type: 'first', icon: '📅', label: '上半月', description: '1-15日' },
  { type: 'second', icon: '📅', label: '下半月', description: '16-月末' },
  { type: 'month', icon: '📊', label: '月度', description: '全月汇总' },
];

// ===== 组件函数 =====

/**
 * 渲染 Brief 页面
 */
export function renderBrief(container: HTMLElement): void {
  const currentYM = legacyBridge.getCurrentYearMonth();

  let html = '';

  // 月份选择器
  html += `
    <div style="display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem;">
      <label style="font-size: 0.85rem; color: var(--color-text-secondary);">月份</label>
      <button class="btn-secondary" onclick="briefCalNav(-1)">◀</button>
      <input
        type="text"
        id="genM"
        value="${currentYM}"
        readonly
        style="max-width: 180px; cursor: pointer;"
        onchange="briefCalPickYM(this.value)"
      >
      <button class="btn-secondary" onclick="briefCalNav(1)">▶</button>
    </div>
  `;

  // 报告周期选择
  html += '<h3 style="margin-bottom: 0.75rem; font-size: 0.9rem; font-weight: 600;">选择报告周期</h3>';
  html += '<div class="card-grid" style="grid-template-columns: repeat(3, 1fr); margin-bottom: 1.25rem;">';

  PERIOD_OPTIONS.forEach((option) => {
    html += `
      <div
        class="stat-card"
        style="cursor: pointer; text-align: center;"
        onclick="doGen('${option.type}')"
      >
        <div style="font-size: 1.2rem; margin-bottom: 0.25rem;">${option.icon}</div>
        <div class="stat-card-value" style="font-size: 0.85rem;">${option.label}</div>
        <div class="stat-card-label">${option.description}</div>
      </div>
    `;
  });

  html += '</div>';

  // 自定义周期
  html += '<h3 style="margin-bottom: 0.75rem; font-size: 0.9rem; font-weight: 600;">自定义周期</h3>';
  html += `
    <div style="display: flex; align-items: center; gap: 0.5rem; flex-wrap: wrap;">
      <label style="font-size: 0.85rem; color: var(--color-text-secondary);">开始</label>
      <input
        type="text"
        id="genStart"
        readonly
        placeholder="选择日期"
        style="max-width: 150px; cursor: pointer;"
      >
      <label style="font-size: 0.85rem; color: var(--color-text-secondary);">结束</label>
      <input
        type="text"
        id="genEnd"
        readonly
        placeholder="选择日期"
        style="max-width: 150px; cursor: pointer;"
      >
      <button class="btn-primary" onclick="doGen('custom')">生成</button>
    </div>
  `;

  container.innerHTML = html;

  // 绑定日期选择器
  initDatePickers();
}

/**
 * 初始化日期选择器
 */
function initDatePickers(): void {
  // 使用旧系统的日期选择器
  const genStart = document.getElementById('genStart');
  const genEnd = document.getElementById('genEnd');

  if (genStart) {
    genStart.addEventListener('click', () => {
      // @ts-ignore - 旧系统全局函数
      if (typeof window._dpOpen === 'function') {
        // @ts-ignore
        window._dpOpen('genStart');
      }
    });
  }

  if (genEnd) {
    genEnd.addEventListener('click', () => {
      // @ts-ignore - 旧系统全局函数
      if (typeof window._dpOpen === 'function') {
        // @ts-ignore
        window._dpOpen('genEnd');
      }
    });
  }
}

// ===== 全局函数绑定 =====

// 这些函数需要绑定到 window 以便 HTML 中的 onclick 调用
export function initBriefGlobals(): void {
  // 月份导航
  (window as any).briefCalNav = (dir: number) => {
    const picker = document.getElementById('genM') as HTMLInputElement;
    const currentYM = picker?.value || legacyBridge.getCurrentYearMonth();
    // @ts-ignore - 旧系统全局函数
    if (typeof window.calendarNav === 'function') {
      // @ts-ignore
      window.calendarNav(dir, currentYM, 'genM', () => {});
    }
  };

  // 月份选择
  (window as any).briefCalPickYM = (val: string) => {
    // @ts-ignore - 旧系统全局函数
    if (typeof window.calendarPickYM === 'function') {
      // @ts-ignore
      window.calendarPickYM(val, () => {});
    }
  };

  // 生成报告（复用旧系统）
  (window as any).doGen = (period: PeriodType) => {
    // @ts-ignore - 旧系统全局函数
    if (typeof window.doGen === 'function') {
      // @ts-ignore
      window.doGen(period);
    }
  };
}

export default {
  renderBrief,
  initBriefGlobals,
};
