/**
 * Ax-Coffee Vite 入口
 *
 * 这是新架构的入口文件，开发时通过 Vite 启动，
 * 构建后生成 dist/ 目录供生产部署。
 *
 * 当前阶段：与旧系统并行运行，通过 Legacy Bridge 桥接。
 */

// 样式
import './styles/tokens.css';
import './styles/base.css';
import './styles/layout.css';
import './styles/utilities.css';

// 应用壳
import { createAppShell, renderSidebarNav } from './app/app-shell';
import { router } from './app/router';
import { initAppState } from './app/app-state';

// 引导
import { shouldShowOnboarding, renderOnboarding } from './shared/onboarding/onboarding-page';
import { migrateFromLegacy } from './shared/config/config-manager';

// 页面 - 只读
import { renderDashboard } from './features/dashboard/dashboard-page';
import { renderReport } from './features/report/report-page';
import { renderBrief, initBriefGlobals } from './features/brief/brief-page';

// 页面 - 简单表单
import { renderDamage, initDamageGlobals } from './features/damage/damage-page';
import { renderWarehouse, initWarehouseGlobals } from './features/warehouse/warehouse-page';
import { renderExpense, initExpenseGlobals } from './features/expense/expense-page';

// 页面 - 复杂业务
import { renderDaily } from './features/daily/daily-page';
import { renderPurchase } from './features/purchase/purchase-page';
import { renderInventory } from './features/inventory/inventory-page';

// 导航配置
const NAV_ITEMS = [
  { id: 'dash', label: '总览', icon: '📊' },
  { id: 'daily', label: '日报', icon: '📝' },
  { id: 'purchase', label: '采购', icon: '🛒' },
  { id: 'expense', label: '费用', icon: '💰' },
  { separator: true },
  { id: 'tea', label: '茗茶', icon: '🍵' },
  { id: 'cig', label: '香烟', icon: '🚬' },
  { id: 'alc', label: '酒类', icon: '🍺' },
  { id: 'other', label: '贵重', icon: '💎' },
  { separator: true },
  { id: 'wh', label: '仓库', icon: '📦' },
  { id: 'damage', label: '报损', icon: '⚠️' },
  { separator: true },
  { id: 'report', label: '报表', icon: '📈' },
  { id: 'gen', label: '汇报', icon: '📄' },
];

// 已迁移的页面路由
const MIGRATED_ROUTES: Record<string, () => void> = {
  dash: () => renderDashboard,
  report: () => renderReport,
  gen: () => renderBrief,
  damage: () => renderDamage,
  wh: () => renderWarehouse,
  expense: () => renderExpense,
};

// 应用初始化
async function initApp() {
  console.log('Ax-Coffee 新架构初始化中...');

  // 初始化应用状态
  initAppState();

  // 迁移旧配置
  migrateFromLegacy();

  // 初始化已迁移页面的全局函数
  initBriefGlobals();
  initDamageGlobals();
  initWarehouseGlobals();
  initExpenseGlobals();

  // 创建应用壳（仅在新架构页面使用）
  const mainContent = document.getElementById('mainContent');
  if (mainContent && mainContent.dataset.arch === 'new') {
    const shell = createAppShell();
    mainContent.parentNode?.replaceChild(shell, mainContent);

    // 渲染侧边栏导航
    renderSidebarNav(NAV_ITEMS);

    // 配置路由
    router
      .on('/onboarding', () => {
        const container = document.getElementById('mainContent');
        if (container) renderOnboarding(container);
      })
      .on('/dash', () => {
        const container = document.getElementById('mainContent');
        if (container) renderDashboard(container);
      })
      .on('/report', () => {
        const container = document.getElementById('mainContent');
        if (container) renderReport(container);
      })
      .on('/gen', () => {
        const container = document.getElementById('mainContent');
        if (container) renderBrief(container);
      })
      .on('/damage', () => {
        const container = document.getElementById('mainContent');
        if (container) renderDamage(container);
      })
      .on('/wh', () => {
        const container = document.getElementById('mainContent');
        if (container) renderWarehouse(container);
      })
      .on('/expense', () => {
        const container = document.getElementById('mainContent');
        if (container) renderExpense(container);
      })
      .on('/daily', () => {
        const container = document.getElementById('mainContent');
        if (container) renderDaily(container);
      })
      .on('/purchase', () => {
        const container = document.getElementById('mainContent');
        if (container) renderPurchase(container);
      })
      .on('/tea', () => {
        const container = document.getElementById('mainContent');
        if (container) renderInventory(container, 'tea');
      })
      .on('/cig', () => {
        const container = document.getElementById('mainContent');
        if (container) renderInventory(container, 'cig');
      })
      .on('/alc', () => {
        const container = document.getElementById('mainContent');
        if (container) renderInventory(container, 'alc');
      })
      .on('/other', () => {
        const container = document.getElementById('mainContent');
        if (container) renderInventory(container, 'other');
      })
      .fallback(() => {
        // 检查是否需要显示引导
        if (shouldShowOnboarding()) {
          window.location.hash = '/onboarding';
          const container = document.getElementById('mainContent');
          if (container) renderOnboarding(container);
          return;
        }

        // 对于未迁移的页面，回退到旧系统
        const hash = window.location.hash.slice(1) || 'dash';
        // @ts-ignore - 旧系统全局函数
        if (typeof window.goPage === 'function') {
          // @ts-ignore
          window.goPage(hash);
        }
      })
      .start();
  }

  console.log('Ax-Coffee 新架构初始化完成');
}

// 等待 DOM 加载完成
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}
