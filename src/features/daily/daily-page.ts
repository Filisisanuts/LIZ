/**
 * Daily Page - 日报页面组件
 *
 * 提供日报的粘贴解析、手动录入、明细查看功能。
 * 当前为简化版本，复用旧系统逻辑。
 */

import { formatCurrency } from '@/shared/format/currency';
import {
  getMonthlyDailyReports,
  getMonthlyStats,
  getPaymentGroups,
  getMonthlyPaymentStats,
  type DailyReport,
} from './daily-service';

// ===== 组件函数 =====

/**
 * 渲染 Daily 页面
 */
export function renderDaily(container: HTMLElement): void {
  let html = '';

  // 标签栏
  html += `
    <div class="view-tabs" id="dT" role="tablist" aria-label="日报视图">
      <button type="button" class="view-tab active" role="tab" aria-selected="true" onclick="switchDT('text')">粘贴</button>
      <button type="button" class="view-tab" role="tab" aria-selected="false" onclick="switchDT('manual')">手动</button>
      <button type="button" class="view-tab" role="tab" aria-selected="false" onclick="switchDT('hist')">明细</button>
    </div>
  `;

  // 粘贴页
  html += `
    <div id="dText">
      <textarea id="dtInput" placeholder="粘贴日报..." style="width: 100%; min-height: 100px; resize: vertical; box-sizing: border-box;"></textarea>
      <div style="margin-top: 0.75rem;">
        <button class="btn-primary" onclick="doParseDaily()">解析</button>
      </div>
      <div id="dailyPreview"></div>
    </div>
  `;

  // 手动页
  html += `
    <div id="dMan" style="display: none;">
      <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem; align-items: center;">
        <label style="font-size: 0.85rem; color: var(--color-text-secondary);">日期</label>
        <input type="text" id="dmDate" readonly style="cursor: pointer;">
      </div>
      <div id="dmFreeList"></div>
      <div id="dmTeaList"></div>
      <div id="dmCigList"></div>
      <div id="dmAlcList"></div>
      <div id="dmOtherList"></div>
      <div id="dmRoomList"></div>
      <div style="display: flex; gap: 0.5rem; margin-top: 0.75rem; align-items: center;">
        <label style="font-size: 0.85rem; color: var(--color-text-secondary);">汇报人</label>
        <input type="text" id="dmReporter" style="max-width: 160px;">
      </div>
      <div style="margin-top: 0.75rem;">
        <button class="btn-primary" onclick="doManualDaily()">保存</button>
      </div>
    </div>
  `;

  // 明细页
  html += `
    <div id="dHist" style="display: none;">
      <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem; align-items: center;">
        <label style="font-size: 0.85rem; color: var(--color-text-secondary);">月份</label>
        <button class="btn-secondary" onclick="dailyCalNav(-1)">◀</button>
        <input type="text" id="dhM" readonly style="max-width: 180px; cursor: pointer;">
        <button class="btn-secondary" onclick="dailyCalNav(1)">▶</button>
      </div>
      <div id="dhArea"></div>
    </div>
  `;

  container.innerHTML = html;

  // 初始化
  initDailyGlobals();
  setTimeout(() => {
    renderDailyHistory();
  }, 100);
}

/**
 * 渲染日报历史列表
 */
function renderDailyHistory(): void {
  const area = document.getElementById('dhArea');
  if (!area) return;

  const monthInput = document.getElementById('dhM') as HTMLInputElement;
  const ym = monthInput?.value || getCurrentYearMonth();

  const stats = getMonthlyStats(ym);
  const reports = getMonthlyDailyReports(ym);

  let html = '';

  // 月汇总卡片
  if (reports.length > 0) {
    html += '<div class="card-grid" style="margin-bottom: 1rem;">';
    html += `
      <div class="stat-card">
        <div class="stat-card-label">本月实收</div>
        <div class="stat-card-value positive">${formatCurrency(stats.totalNetSales)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">日均实收</div>
        <div class="stat-card-value positive">${formatCurrency(stats.avgDailySales)}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">已报天数</div>
        <div class="stat-card-value">${stats.reportCount}</div>
      </div>
      <div class="stat-card">
        <div class="stat-card-label">总客流</div>
        <div class="stat-card-value">${stats.totalGuests}</div>
      </div>
    `;
    html += '</div>';
  }

  // 日历视图
  const [year, month] = ym.split('-').map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const firstDay = new Date(year, month - 1, 1).getDay();
  const adjustedFirstDay = firstDay === 0 ? 6 : firstDay - 1;

  const reportsMap: Record<number, DailyReport> = {};
  reports.forEach((r) => {
    const day = parseInt(r.date.split('-')[2]);
    reportsMap[day] = r;
  });

  const today = new Date();
  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  const isThisMonth = todayStr.startsWith(ym);

  html += '<div style="display: grid; grid-template-columns: repeat(7, 1fr); gap: 4px; margin-bottom: 1rem;">';

  // 星期标题
  const weekNames = ['一', '二', '三', '四', '五', '六', '日'];
  weekNames.forEach((w) => {
    html += `<div style="text-align: center; font-size: 0.75rem; color: var(--color-text-muted); padding: 0.25rem 0;">${w}</div>`;
  });

  // 空白格
  for (let i = 0; i < adjustedFirstDay; i++) {
    html += '<div></div>';
  }

  // 日期格
  for (let d = 1; d <= daysInMonth; d++) {
    const report = reportsMap[d];
    const isToday = isThisMonth && today.getDate() === d;
    const borderColor = isToday ? 'var(--color-primary)' : 'var(--color-border)';
    const bg = report ? 'var(--color-bg-card)' : 'var(--color-bg-elevated)';

    html += `
      <div style="background: ${bg}; border: 1px solid ${borderColor}; border-radius: var(--radius-md); padding: 0.375rem; min-height: 60px; ${report ? 'cursor: pointer;' : ''}"
           ${report ? `onclick="showDailyModal('${report.date}')"` : ''}>
        <div style="font-size: 0.75rem; font-weight: 600; color: ${isToday ? 'var(--color-primary)' : 'var(--color-text)'};">${d}</div>
        ${report ? `
          <div style="font-family: var(--font-mono); font-size: 0.7rem; color: var(--color-primary); margin-top: 2px;">
            ${formatCurrency(report.revenue.netSales)}
          </div>
          <div style="font-size: 0.65rem; color: var(--color-text-muted);">${report.guest.count}人</div>
        ` : '<div style="font-size: 0.65rem; color: var(--color-text-muted); margin-top: 0.25rem;">-</div>'}
      </div>
    `;
  }

  html += '</div>';

  area.innerHTML = html;
}

// ===== 全局函数绑定 =====

function initDailyGlobals(): void {
  // 切换标签
  (window as any).switchDT = (tab: string) => {
    const textEl = document.getElementById('dText');
    const manEl = document.getElementById('dMan');
    const histEl = document.getElementById('dHist');
    const tabs = document.querySelectorAll('#dT .view-tab');

    tabs.forEach((t) => t.classList.remove('active'));

    if (tab === 'text') {
      textEl?.style.removeProperty('display');
      manEl && (manEl.style.display = 'none');
      histEl && (histEl.style.display = 'none');
      tabs[0]?.classList.add('active');
    } else if (tab === 'manual') {
      textEl && (textEl.style.display = 'none');
      manEl?.style.removeProperty('display');
      histEl && (histEl.style.display = 'none');
      tabs[1]?.classList.add('active');
      initManualForm();
    } else {
      textEl && (textEl.style.display = 'none');
      manEl && (manEl.style.display = 'none');
      histEl?.style.removeProperty('display');
      tabs[2]?.classList.add('active');
      renderDailyHistory();
    }
  };

  // 月份导航
  (window as any).dailyCalNav = (dir: number) => {
    const picker = document.getElementById('dhM') as HTMLInputElement;
    const currentYM = picker?.value || getCurrentYearMonth();
    // @ts-ignore - 旧系统全局函数
    if (typeof window.calendarNav === 'function') {
      // @ts-ignore
      window.calendarNav(dir, currentYM, 'dhM', () => {
        renderDailyHistory();
      });
    }
  };

  // 月份选择
  (window as any).dailyCalPickYM = (val: string) => {
    // @ts-ignore - 旧系统全局函数
    if (typeof window.calendarPickYM === 'function') {
      // @ts-ignore
      window.calendarPickYM(val, () => {
        renderDailyHistory();
      });
    }
  };

  // 解析日报（复用旧系统）
  (window as any).doParseDaily = () => {
    // @ts-ignore - 旧系统全局函数
    if (typeof window.doParseDaily === 'function') {
      // @ts-ignore
      window.doParseDaily();
    }
  };

  // 手动录入（复用旧系统）
  (window as any).doManualDaily = () => {
    // @ts-ignore - 旧系统全局函数
    if (typeof window.doManualDaily === 'function') {
      // @ts-ignore
      window.doManualDaily();
    }
  };

  // 显示日报弹窗（复用旧系统）
  (window as any).showDailyModal = (date: string) => {
    // @ts-ignore - 旧系统全局函数
    if (typeof window.showDailyModal === 'function') {
      // @ts-ignore
      window.showDailyModal(date);
    }
  };
}

function initManualForm(): void {
  const dmDate = document.getElementById('dmDate') as HTMLInputElement | null;
  if (dmDate && !dmDate.value) {
    dmDate.value = getToday();
  }
}

// ===== 辅助函数 =====

function getCurrentYearMonth(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default {
  renderDaily,
};
