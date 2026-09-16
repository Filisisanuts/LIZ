/**
 * Config Manager - 统一配置管理模块
 *
 * 管理所有可配置的分类、标签等数据。
 * 新用户默认为空，通过引导或设置页添加。
 */

import legacyBridge from '@/legacy/legacy-bridge';

// ===== 类型定义 =====

export interface AppConfig {
  // 功能模块启用状态
  enabledModules: string[];

  // 日报配置
  dailyLabels: string[];
  roomTypes: string[];

  // 采购配置
  purchaseSections: string[];
  purchaseCategories: Record<string, string[]>; // 区域 -> 分类

  // 费用配置
  expenseCategories: string[];

  // 仓库配置
  warehouseCategories: string[];

  // 贵重物品配置
  inventoryTypes: string[];
  customInventoryTypes: string[];

  // 引导状态
  onboardingCompleted: boolean;
}

// ===== 默认配置（新用户为空） =====

const DEFAULT_CONFIG: AppConfig = {
  enabledModules: [],
  dailyLabels: [],
  roomTypes: [],
  purchaseSections: [],
  purchaseCategories: {},
  expenseCategories: [],
  warehouseCategories: [],
  inventoryTypes: [],
  customInventoryTypes: [],
  onboardingCompleted: false,
};

// ===== 存储键名 =====

const CONFIG_KEY = 'ax_app_config';

// ===== 服务函数 =====

/**
 * 获取完整配置
 */
export function getConfig(): AppConfig {
  try {
    const saved = localStorage.getItem(CONFIG_KEY);
    if (saved) {
      return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
    }
  } catch (e) {
    console.error('Failed to load config:', e);
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * 保存配置
 */
export function saveConfig(config: Partial<AppConfig>): void {
  const current = getConfig();
  const updated = { ...current, ...config };
  localStorage.setItem(CONFIG_KEY, JSON.stringify(updated));

  // 同步到 DB.settings
  legacyBridge.update((db) => {
    if (!db.settings) db.settings = {};
    db.settings[CONFIG_KEY] = updated;
  });
}

/**
 * 从旧数据迁移配置（首次使用时）
 */
export function migrateFromLegacy(): void {
  const config = getConfig();

  // 如果已有配置，跳过迁移
  if (config.onboardingCompleted) return;

  // 迁移日报标签
  if (config.dailyLabels.length === 0) {
    try {
      const oldLabels = JSON.parse(localStorage.getItem('ax_fl') || '[]');
      if (oldLabels.length > 0) {
        config.dailyLabels = oldLabels;
      }
    } catch (e) {}
  }

  // 迁移采购区域/分类
  if (config.purchaseSections.length === 0) {
    const db = legacyBridge.getDatabase();
    if (db?.areaCats && Object.keys(db.areaCats).length > 0) {
      config.purchaseSections = Object.keys(db.areaCats);
      config.purchaseCategories = db.areaCats;
    }
  }

  // 迁移仓库分类
  if (config.warehouseCategories.length === 0) {
    const db = legacyBridge.getDatabase();
    if (db?.whCats && db.whCats.length > 0) {
      config.warehouseCategories = db.whCats;
    }
  }

  // 迁移费用分类（从已有记录提取）
  if (config.expenseCategories.length === 0) {
    const db = legacyBridge.getDatabase();
    if (db?.expenses) {
      const cats = new Set<string>();
      db.expenses.forEach((e: any) => {
        if (e.category) cats.add(e.category);
      });
      if (cats.size > 0) {
        config.expenseCategories = Array.from(cats);
      }
    }
  }

  // 迁移包厢类型
  if (config.roomTypes.length === 0) {
    config.roomTypes = ['普通包厢', '500+包厢'];
  }

  saveConfig(config);
}

// ===== 日报配置 =====

export function getDailyLabels(): string[] {
  return getConfig().dailyLabels;
}

export function addDailyLabel(label: string): void {
  const config = getConfig();
  if (!config.dailyLabels.includes(label)) {
    config.dailyLabels.push(label);
    saveConfig(config);
  }
}

export function removeDailyLabel(label: string): void {
  const config = getConfig();
  config.dailyLabels = config.dailyLabels.filter((l) => l !== label);
  saveConfig(config);
}

export function getRoomTypes(): string[] {
  return getConfig().roomTypes;
}

export function addRoomType(type: string): void {
  const config = getConfig();
  if (!config.roomTypes.includes(type)) {
    config.roomTypes.push(type);
    saveConfig(config);
  }
}

export function removeRoomType(type: string): void {
  const config = getConfig();
  config.roomTypes = config.roomTypes.filter((t) => t !== type);
  saveConfig(config);
}

// ===== 采购配置 =====

export function getPurchaseSections(): string[] {
  return getConfig().purchaseSections;
}

export function addPurchaseSection(section: string): void {
  const config = getConfig();
  if (!config.purchaseSections.includes(section)) {
    config.purchaseSections.push(section);
    config.purchaseCategories[section] = [];
    saveConfig(config);
  }
}

export function removePurchaseSection(section: string): void {
  const config = getConfig();
  config.purchaseSections = config.purchaseSections.filter((s) => s !== section);
  delete config.purchaseCategories[section];
  saveConfig(config);
}

export function getPurchaseCategories(section?: string): string[] | Record<string, string[]> {
  const config = getConfig();
  if (section) {
    return config.purchaseCategories[section] || [];
  }
  return config.purchaseCategories;
}

export function addPurchaseCategory(section: string, category: string): void {
  const config = getConfig();
  if (!config.purchaseCategories[section]) {
    config.purchaseCategories[section] = [];
  }
  if (!config.purchaseCategories[section].includes(category)) {
    config.purchaseCategories[section].push(category);
    saveConfig(config);
  }
}

export function removePurchaseCategory(section: string, category: string): void {
  const config = getConfig();
  if (config.purchaseCategories[section]) {
    config.purchaseCategories[section] = config.purchaseCategories[section].filter(
      (c) => c !== category
    );
    saveConfig(config);
  }
}

// ===== 费用配置 =====

export function getExpenseCategories(): string[] {
  return getConfig().expenseCategories;
}

export function addExpenseCategory(category: string): void {
  const config = getConfig();
  if (!config.expenseCategories.includes(category)) {
    config.expenseCategories.push(category);
    saveConfig(config);
  }
}

export function removeExpenseCategory(category: string): void {
  const config = getConfig();
  config.expenseCategories = config.expenseCategories.filter((c) => c !== category);
  saveConfig(config);
}

// ===== 仓库配置 =====

export function getWarehouseCategories(): string[] {
  return getConfig().warehouseCategories;
}

export function addWarehouseCategory(category: string): void {
  const config = getConfig();
  if (!config.warehouseCategories.includes(category)) {
    config.warehouseCategories.push(category);
    saveConfig(config);
  }
}

export function removeWarehouseCategory(category: string): void {
  const config = getConfig();
  config.warehouseCategories = config.warehouseCategories.filter((c) => c !== category);
  saveConfig(config);
}

// ===== 引导状态 =====

export function isOnboardingCompleted(): boolean {
  return getConfig().onboardingCompleted;
}

export function completeOnboarding(): void {
  saveConfig({ onboardingCompleted: true });
}

export default {
  getConfig,
  saveConfig,
  migrateFromLegacy,
  getDailyLabels,
  addDailyLabel,
  removeDailyLabel,
  getRoomTypes,
  addRoomType,
  removeRoomType,
  getPurchaseSections,
  addPurchaseSection,
  removePurchaseSection,
  getPurchaseCategories,
  addPurchaseCategory,
  removePurchaseCategory,
  getExpenseCategories,
  addExpenseCategory,
  removeExpenseCategory,
  getWarehouseCategories,
  addWarehouseCategory,
  removeWarehouseCategory,
  isOnboardingCompleted,
  completeOnboarding,
};
