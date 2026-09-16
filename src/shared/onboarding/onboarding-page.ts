/**
 * Onboarding Page - 新手引导页面
 *
 * 首次登录的用户会看到引导页面，帮助设置基础配置。
 */

import {
  isOnboardingCompleted,
  completeOnboarding,
  hasExistingBusinessData,
  saveConfig,
  type AppConfig,
} from '../config/config-manager';
import legacyBridge from '@/legacy/legacy-bridge';

// ===== 类型 =====

interface OnboardingStep {
  id: string;
  title: string;
  description: string;
}

// ===== 常量 =====

const STEPS: OnboardingStep[] = [
  {
    id: 'welcome',
    title: '欢迎使用经营管理系统',
    description: '让我们一起完成基础配置，开始您的经营之旅。',
  },
  {
    id: 'daily-labels',
    title: '日报标签配置',
    description: '设置日报中常用的经营数据标签，如：实收、厨房、吧台等。',
  },
  {
    id: 'purchase-sections',
    title: '采购区域配置',
    description: '设置采购单中的区域，如：厨房、吧台、外场。',
  },
  {
    id: 'expense-categories',
    title: '费用分类配置',
    description: '设置费用记录的分类，如：水费、电费、工资等。',
  },
  {
    id: 'warehouse-categories',
    title: '仓库分类配置',
    description: '设置仓库物品的分类，如：包装、调料、清洁等。',
  },
];

// ===== 状态 =====

let currentStep = 0;
let config: Partial<AppConfig> = {
  dailyLabels: [],
  purchaseSections: [],
  purchaseCategories: {},
  expenseCategories: [],
  warehouseCategories: [],
};

// ===== 组件函数 =====

/**
 * 检查是否需要显示引导
 */
export function shouldShowOnboarding(): boolean {
  return !isOnboardingCompleted() && !hasExistingBusinessData(legacyBridge.getDatabase());
}

/**
 * 渲染引导页面
 */
export function renderOnboarding(container: HTMLElement): void {
  const step = STEPS[currentStep];

  let html = '';

  // 进度条
  html += `
    <div style="margin-bottom: 2rem;">
      <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem; font-size: 0.8rem; color: var(--color-text-secondary);">
        <span>步骤 ${currentStep + 1} / ${STEPS.length}</span>
        <span>${step.title}</span>
      </div>
      <div style="height: 4px; background: var(--color-border); border-radius: 2px; overflow: hidden;">
        <div style="height: 100%; width: ${((currentStep + 1) / STEPS.length) * 100}%; background: var(--color-primary); transition: width 0.3s;"></div>
      </div>
    </div>
  `;

  // 步骤内容
  html += `
    <div style="text-align: center; margin-bottom: 2rem;">
      <h2 style="font-size: 1.5rem; font-weight: 600; margin-bottom: 0.5rem;">${step.title}</h2>
      <p style="color: var(--color-text-secondary);">${step.description}</p>
    </div>
  `;

  // 根据步骤渲染不同内容
  switch (step.id) {
    case 'welcome':
      html += renderWelcomeStep();
      break;
    case 'daily-labels':
      html += renderDailyLabelsStep();
      break;
    case 'purchase-sections':
      html += renderPurchaseSectionsStep();
      break;
    case 'expense-categories':
      html += renderExpenseCategoriesStep();
      break;
    case 'warehouse-categories':
      html += renderWarehouseCategoriesStep();
      break;
  }

  // 按钮
  html += `
    <div style="display: flex; justify-content: space-between; margin-top: 2rem;">
      ${currentStep > 0 ? '<button class="btn-secondary" onclick="onboardingPrev()">上一步</button>' : '<div></div>'}
      ${currentStep < STEPS.length - 1
        ? '<button class="btn-primary" onclick="onboardingNext()">下一步</button>'
        : '<button class="btn-primary" onclick="onboardingComplete()">完成配置</button>'
      }
    </div>
  `;

  container.innerHTML = html;
  initOnboardingGlobals();
}

// ===== 步骤渲染函数 =====

function renderWelcomeStep(): string {
  return `
    <div style="text-align: center; padding: 2rem;">
      <div style="font-size: 4rem; margin-bottom: 1rem;">☕</div>
      <p style="color: var(--color-text-secondary); max-width: 400px; margin: 0 auto;">
        这是您第一次使用系统，让我们一起完成基础配置。<br>
        您可以随时在设置页面修改这些配置。
      </p>
    </div>
  `;
}

function renderDailyLabelsStep(): string {
  const labels = config.dailyLabels || [];

  return `
    <div style="max-width: 500px; margin: 0 auto;">
      <div style="margin-bottom: 1rem;">
        <label style="font-size: 0.85rem; color: var(--color-text-secondary);">添加标签</label>
        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
          <input type="text" id="onboardNewLabel" placeholder="输入标签名称" style="flex: 1;">
          <button class="btn-secondary" onclick="onboardAddLabel()">添加</button>
        </div>
      </div>
      <div style="margin-bottom: 1rem;">
        <label style="font-size: 0.85rem; color: var(--color-text-secondary);">快速添加</label>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
          ${['实收', '厨房', '吧台', '外卖', '人数', '人均消费', '500+包厢'].map(l => `
            <button class="btn-secondary btn-sm" onclick="onboardQuickAddLabel('${l}')" ${labels.includes(l) ? 'disabled' : ''}>${l}</button>
          `).join('')}
        </div>
      </div>
      <div>
        <label style="font-size: 0.85rem; color: var(--color-text-secondary);">已选标签</label>
        <div id="onboardLabelsList" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; min-height: 40px;">
          ${labels.map(l => `
            <span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: var(--color-bg-elevated); border-radius: var(--radius-md); font-size: 0.8rem;">
              ${l}
              <button onclick="onboardRemoveLabel('${l}')" style="background: none; border: none; color: var(--color-text-muted); cursor: pointer;">×</button>
            </span>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderPurchaseSectionsStep(): string {
  const sections = config.purchaseSections || [];

  return `
    <div style="max-width: 500px; margin: 0 auto;">
      <div style="margin-bottom: 1rem;">
        <label style="font-size: 0.85rem; color: var(--color-text-secondary);">添加区域</label>
        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
          <input type="text" id="onboardNewSection" placeholder="输入区域名称" style="flex: 1;">
          <button class="btn-secondary" onclick="onboardAddSection()">添加</button>
        </div>
      </div>
      <div style="margin-bottom: 1rem;">
        <label style="font-size: 0.85rem; color: var(--color-text-secondary);">快速添加</label>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
          ${['厨房', '吧台', '外场'].map(s => `
            <button class="btn-secondary btn-sm" onclick="onboardQuickAddSection('${s}')" ${sections.includes(s) ? 'disabled' : ''}>${s}</button>
          `).join('')}
        </div>
      </div>
      <div>
        <label style="font-size: 0.85rem; color: var(--color-text-secondary);">已选区域</label>
        <div id="onboardSectionsList" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; min-height: 40px;">
          ${sections.map(s => `
            <span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: var(--color-bg-elevated); border-radius: var(--radius-md); font-size: 0.8rem;">
              ${s}
              <button onclick="onboardRemoveSection('${s}')" style="background: none; border: none; color: var(--color-text-muted); cursor: pointer;">×</button>
            </span>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderExpenseCategoriesStep(): string {
  const categories = config.expenseCategories || [];

  return `
    <div style="max-width: 500px; margin: 0 auto;">
      <div style="margin-bottom: 1rem;">
        <label style="font-size: 0.85rem; color: var(--color-text-secondary);">添加分类</label>
        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
          <input type="text" id="onboardNewExpCat" placeholder="输入分类名称" style="flex: 1;">
          <button class="btn-secondary" onclick="onboardAddExpCat()">添加</button>
        </div>
      </div>
      <div style="margin-bottom: 1rem;">
        <label style="font-size: 0.85rem; color: var(--color-text-secondary);">快速添加</label>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
          ${['水费', '电费', '燃气费', '物业费', '工资', '维修费', '其他'].map(c => `
            <button class="btn-secondary btn-sm" onclick="onboardQuickAddExpCat('${c}')" ${categories.includes(c) ? 'disabled' : ''}>${c}</button>
          `).join('')}
        </div>
      </div>
      <div>
        <label style="font-size: 0.85rem; color: var(--color-text-secondary);">已选分类</label>
        <div id="onboardExpCatsList" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; min-height: 40px;">
          ${categories.map(c => `
            <span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: var(--color-bg-elevated); border-radius: var(--radius-md); font-size: 0.8rem;">
              ${c}
              <button onclick="onboardRemoveExpCat('${c}')" style="background: none; border: none; color: var(--color-text-muted); cursor: pointer;">×</button>
            </span>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

function renderWarehouseCategoriesStep(): string {
  const categories = config.warehouseCategories || [];

  return `
    <div style="max-width: 500px; margin: 0 auto;">
      <div style="margin-bottom: 1rem;">
        <label style="font-size: 0.85rem; color: var(--color-text-secondary);">添加分类</label>
        <div style="display: flex; gap: 0.5rem; margin-top: 0.5rem;">
          <input type="text" id="onboardNewWhCat" placeholder="输入分类名称" style="flex: 1;">
          <button class="btn-secondary" onclick="onboardAddWhCat()">添加</button>
        </div>
      </div>
      <div style="margin-bottom: 1rem;">
        <label style="font-size: 0.85rem; color: var(--color-text-secondary);">快速添加</label>
        <div style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem;">
          ${['包装', '调料', '清洁', '耗材', '设备', '其他'].map(c => `
            <button class="btn-secondary btn-sm" onclick="onboardQuickAddWhCat('${c}')" ${categories.includes(c) ? 'disabled' : ''}>${c}</button>
          `).join('')}
        </div>
      </div>
      <div>
        <label style="font-size: 0.85rem; color: var(--color-text-secondary);">已选分类</label>
        <div id="onboardWhCatsList" style="display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: 0.5rem; min-height: 40px;">
          ${categories.map(c => `
            <span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: var(--color-bg-elevated); border-radius: var(--radius-md); font-size: 0.8rem;">
              ${c}
              <button onclick="onboardRemoveWhCat('${c}')" style="background: none; border: none; color: var(--color-text-muted); cursor: pointer;">×</button>
            </span>
          `).join('')}
        </div>
      </div>
    </div>
  `;
}

// ===== 全局函数绑定 =====

function initOnboardingGlobals(): void {
  // 导航
  (window as any).onboardingPrev = () => {
    if (currentStep > 0) {
      saveCurrentStep();
      currentStep--;
      const container = document.getElementById('mainContent');
      if (container) renderOnboarding(container);
    }
  };

  (window as any).onboardingNext = () => {
    if (currentStep < STEPS.length - 1) {
      saveCurrentStep();
      currentStep++;
      const container = document.getElementById('mainContent');
      if (container) renderOnboarding(container);
    }
  };

  (window as any).onboardingComplete = () => {
    saveCurrentStep();
    completeOnboarding();
    saveConfig(config);
    // 跳转到主页
    window.location.hash = '/dash';
    window.location.reload();
  };

  // 日报标签操作
  (window as any).onboardAddLabel = () => {
    const input = document.getElementById('onboardNewLabel') as HTMLInputElement;
    if (input?.value.trim()) {
      addLabel(input.value.trim());
      input.value = '';
      refreshLabelsList();
    }
  };

  (window as any).onboardQuickAddLabel = (label: string) => {
    addLabel(label);
    refreshLabelsList();
  };

  (window as any).onboardRemoveLabel = (label: string) => {
    config.dailyLabels = (config.dailyLabels || []).filter((l) => l !== label);
    refreshLabelsList();
  };

  // 采购区域操作
  (window as any).onboardAddSection = () => {
    const input = document.getElementById('onboardNewSection') as HTMLInputElement;
    if (input?.value.trim()) {
      addSection(input.value.trim());
      input.value = '';
      refreshSectionsList();
    }
  };

  (window as any).onboardQuickAddSection = (section: string) => {
    addSection(section);
    refreshSectionsList();
  };

  (window as any).onboardRemoveSection = (section: string) => {
    config.purchaseSections = (config.purchaseSections || []).filter((s) => s !== section);
    delete config.purchaseCategories?.[section];
    refreshSectionsList();
  };

  // 费用分类操作
  (window as any).onboardAddExpCat = () => {
    const input = document.getElementById('onboardNewExpCat') as HTMLInputElement;
    if (input?.value.trim()) {
      addExpCat(input.value.trim());
      input.value = '';
      refreshExpCatsList();
    }
  };

  (window as any).onboardQuickAddExpCat = (cat: string) => {
    addExpCat(cat);
    refreshExpCatsList();
  };

  (window as any).onboardRemoveExpCat = (cat: string) => {
    config.expenseCategories = (config.expenseCategories || []).filter((c) => c !== cat);
    refreshExpCatsList();
  };

  // 仓库分类操作
  (window as any).onboardAddWhCat = () => {
    const input = document.getElementById('onboardNewWhCat') as HTMLInputElement;
    if (input?.value.trim()) {
      addWhCat(input.value.trim());
      input.value = '';
      refreshWhCatsList();
    }
  };

  (window as any).onboardQuickAddWhCat = (cat: string) => {
    addWhCat(cat);
    refreshWhCatsList();
  };

  (window as any).onboardRemoveWhCat = (cat: string) => {
    config.warehouseCategories = (config.warehouseCategories || []).filter((c) => c !== cat);
    refreshWhCatsList();
  };
}

// ===== 辅助函数 =====

function saveCurrentStep(): void {
  // 保存当前步骤的配置
  const step = STEPS[currentStep];
  switch (step.id) {
    case 'daily-labels':
      // 已经在操作时实时更新
      break;
    case 'purchase-sections':
      // 已经在操作时实时更新
      break;
    case 'expense-categories':
      // 已经在操作时实时更新
      break;
    case 'warehouse-categories':
      // 已经在操作时实时更新
      break;
  }
}

function addLabel(label: string): void {
  if (!config.dailyLabels) config.dailyLabels = [];
  if (!config.dailyLabels.includes(label)) {
    config.dailyLabels.push(label);
  }
}

function addSection(section: string): void {
  if (!config.purchaseSections) config.purchaseSections = [];
  if (!config.purchaseSections.includes(section)) {
    config.purchaseSections.push(section);
    if (!config.purchaseCategories) config.purchaseCategories = {};
    config.purchaseCategories[section] = [];
  }
}

function addExpCat(cat: string): void {
  if (!config.expenseCategories) config.expenseCategories = [];
  if (!config.expenseCategories.includes(cat)) {
    config.expenseCategories.push(cat);
  }
}

function addWhCat(cat: string): void {
  if (!config.warehouseCategories) config.warehouseCategories = [];
  if (!config.warehouseCategories.includes(cat)) {
    config.warehouseCategories.push(cat);
  }
}

function refreshLabelsList(): void {
  const container = document.getElementById('onboardLabelsList');
  if (container) {
    container.innerHTML = (config.dailyLabels || []).map(l => `
      <span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: var(--color-bg-elevated); border-radius: var(--radius-md); font-size: 0.8rem;">
        ${l}
        <button onclick="onboardRemoveLabel('${l}')" style="background: none; border: none; color: var(--color-text-muted); cursor: pointer;">×</button>
      </span>
    `).join('');
  }
  // 更新快速添加按钮状态
  document.querySelectorAll('[onclick^="onboardQuickAddLabel"]').forEach((btn) => {
    const label = (btn as HTMLElement).getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
    if (label) {
      (btn as HTMLButtonElement).disabled = (config.dailyLabels || []).includes(label);
    }
  });
}

function refreshSectionsList(): void {
  const container = document.getElementById('onboardSectionsList');
  if (container) {
    container.innerHTML = (config.purchaseSections || []).map(s => `
      <span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: var(--color-bg-elevated); border-radius: var(--radius-md); font-size: 0.8rem;">
        ${s}
        <button onclick="onboardRemoveSection('${s}')" style="background: none; border: none; color: var(--color-text-muted); cursor: pointer;">×</button>
      </span>
    `).join('');
  }
  document.querySelectorAll('[onclick^="onboardQuickAddSection"]').forEach((btn) => {
    const section = (btn as HTMLElement).getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
    if (section) {
      (btn as HTMLButtonElement).disabled = (config.purchaseSections || []).includes(section);
    }
  });
}

function refreshExpCatsList(): void {
  const container = document.getElementById('onboardExpCatsList');
  if (container) {
    container.innerHTML = (config.expenseCategories || []).map(c => `
      <span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: var(--color-bg-elevated); border-radius: var(--radius-md); font-size: 0.8rem;">
        ${c}
        <button onclick="onboardRemoveExpCat('${c}')" style="background: none; border: none; color: var(--color-text-muted); cursor: pointer;">×</button>
      </span>
    `).join('');
  }
  document.querySelectorAll('[onclick^="onboardQuickAddExpCat"]').forEach((btn) => {
    const cat = (btn as HTMLElement).getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
    if (cat) {
      (btn as HTMLButtonElement).disabled = (config.expenseCategories || []).includes(cat);
    }
  });
}

function refreshWhCatsList(): void {
  const container = document.getElementById('onboardWhCatsList');
  if (container) {
    container.innerHTML = (config.warehouseCategories || []).map(c => `
      <span style="display: inline-flex; align-items: center; gap: 4px; padding: 4px 8px; background: var(--color-bg-elevated); border-radius: var(--radius-md); font-size: 0.8rem;">
        ${c}
        <button onclick="onboardRemoveWhCat('${c}')" style="background: none; border: none; color: var(--color-text-muted); cursor: pointer;">×</button>
      </span>
    `).join('');
  }
  document.querySelectorAll('[onclick^="onboardQuickAddWhCat"]').forEach((btn) => {
    const cat = (btn as HTMLElement).getAttribute('onclick')?.match(/'([^']+)'/)?.[1];
    if (cat) {
      (btn as HTMLButtonElement).disabled = (config.warehouseCategories || []).includes(cat);
    }
  });
}

export default {
  shouldShowOnboarding,
  renderOnboarding,
};
