/**
 * Config Manager - 统一配置管理模块
 *
 * 管理所有可配置的分类、标签等数据。
 * 新用户默认为空，通过引导或设置页添加。
 */

// ===== 类型定义 =====

export interface AppConfig {
  schemaVersion: number;
  updatedAt: number;

  // 功能模块启用状态
  enabledModules: string[];

  // 日报配置
  dailyLabels: string[];
  roomTypes: string[];
  dailyFeatures: {
    roomEnabled: boolean;
    reporterEnabled: boolean;
  };

  // 采购配置
  purchaseSources: string[];
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

interface AppConfigStore {
  getConfigKey(): string;
  getAppConfig(): AppConfig;
  saveAppConfig(config: Partial<AppConfig>): AppConfig;
  migrateAppConfig(): AppConfig;
  hasExistingBusinessData(database: unknown): boolean;
  shouldShowLegacyOnboarding(): boolean;
}

declare global {
  interface Window {
    axConfigStore?: AppConfigStore;
  }
}

function getConfigStore(): AppConfigStore {
  const store = window.axConfigStore;
  if (!store) throw new Error('Unified app config store is not loaded');
  return store;
}

export function hasExistingBusinessData(database: unknown): boolean {
  return getConfigStore().hasExistingBusinessData(database);
}

// ===== 服务函数 =====

/**
 * 获取完整配置
 */
export function getConfig(): AppConfig {
  return getConfigStore().getAppConfig();
}

/**
 * 保存配置
 */
export function saveConfig(config: Partial<AppConfig>): void {
  getConfigStore().saveAppConfig(config);
}

/**
 * 从旧数据迁移配置（首次使用时）
 */
export function migrateFromLegacy(): void {
  getConfigStore().migrateAppConfig();
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

export function getPurchaseSources(): string[] {
  return getConfig().purchaseSources;
}

export function addPurchaseSource(source: string): void {
  const config = getConfig();
  if (!config.purchaseSources.includes(source)) {
    config.purchaseSources.push(source);
    saveConfig(config);
  }
}

export function removePurchaseSource(source: string): void {
  const config = getConfig();
  config.purchaseSources = config.purchaseSources.filter((s) => s !== source);
  saveConfig(config);
}

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
  getPurchaseSources,
  addPurchaseSource,
  removePurchaseSource,
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
