/**
 * Inventory Service - 库存数据服务
 *
 * 负责库存的增删改查、计算、统计。
 * 支持四种类型：茗茶、香烟、酒类、其他贵重物品。
 */

import legacyBridge from '@/legacy/legacy-bridge';

// ===== 类型定义 =====

export type InventoryType = 'tea' | 'cig' | 'alc' | 'other';

export interface InventoryItem {
  id: string;
  name: string;
  calcMode?: 'gram' | 'pack' | 'simple';
  unit?: string;
  pricePerUnit?: number;
  pricePerCup?: number;
  pricePerPot?: number;
  packsPerCup?: number;
  packsPerPot?: number;
  gramsPerCup?: number;
  gramsPerPot?: number;
  restockAlert?: number;
  category?: string;
  openingStock?: Record<string, number>;
  purchases: Array<{ date: string; qty: number; total: number }>;
  sales: Array<{
    date: string;
    qty?: number;
    cups?: number;
    pots?: number;
    amount: number;
  }>;
}

export interface InventoryCalcResult {
  stock: number;
  cost: number;
  profit: number;
}

export interface MonthlyInventoryCalcResult {
  revenue: number;
  cost: number;
  actual: number;
}

export interface InventoryStats {
  item: InventoryItem;
  stock: number;
  cups: number;
  pots: number;
  qty: number;
  expected: number;
  actual: number;
  cost: number;
  profit: number;
}

export interface InventoryTypeConfig {
  key: string;
  label: string;
  unit: string;
}

// ===== 常量 =====

export const INVENTORY_TYPES: Record<InventoryType, InventoryTypeConfig> = {
  tea: { key: 'teaItems', label: '茗茶', unit: '克' },
  cig: { key: 'cigItems', label: '香烟', unit: '包' },
  alc: { key: 'alcItems', label: '酒类', unit: '瓶' },
  other: { key: 'otherItems', label: '贵重物品', unit: '个' },
};

// ===== 服务函数 =====

/**
 * 获取指定类型的库存列表
 */
export function getInventoryItems(type: InventoryType): InventoryItem[] {
  const db = legacyBridge.getDatabase();
  return db?.[INVENTORY_TYPES[type].key] || [];
}

/**
 * 获取所有库存类型的数据
 */
export function getAllInventoryItems(): Record<InventoryType, InventoryItem[]> {
  return {
    tea: getInventoryItems('tea'),
    cig: getInventoryItems('cig'),
    alc: getInventoryItems('alc'),
    other: getInventoryItems('other'),
  };
}

/**
 * 计算库存（期初结存）
 */
export function calculateInventory(item: InventoryItem, type: InventoryType, yearMonth: string): InventoryCalcResult {
  // @ts-ignore - 旧系统全局函数
  return window.invCalc(item, type, yearMonth);
}

/**
 * 计算月度库存统计
 */
export function calculateMonthlyInventory(item: InventoryItem, type: InventoryType, yearMonth: string): MonthlyInventoryCalcResult {
  // @ts-ignore - 旧系统全局函数
  return window.invCalcMon(item, type, yearMonth);
}

/**
 * 获取库存统计
 */
export function getInventoryStats(type: InventoryType, yearMonth: string): InventoryStats[] {
  const items = getInventoryItems(type);
  const stats: InventoryStats[] = [];

  items.forEach((item) => {
    const sales = item.sales.filter((s) => s.date.startsWith(yearMonth));
    const calc = calculateInventory(item, type, yearMonth);
    const mc = calculateMonthlyInventory(item, type, yearMonth);

    let cups = 0, pots = 0, qty = 0, expected = 0;
    sales.forEach((s) => {
      cups += s.cups || 0;
      pots += s.pots || 0;
      qty += s.qty || 0;
      if (type === 'tea') {
        expected += (s.cups || 0) * (item.pricePerCup || 0) + (s.pots || 0) * (item.pricePerPot || 0);
      } else {
        expected += (s.qty || 0) * (item.pricePerUnit || 0);
      }
    });

    stats.push({
      item,
      stock: calc.stock,
      cups,
      pots,
      qty,
      expected,
      actual: mc.actual,
      cost: calc.cost,
      profit: calc.profit,
    });
  });

  return stats;
}

/**
 * 获取月度汇总
 */
export function getMonthlyInventorySummary(type: InventoryType, yearMonth: string): {
  totalExpected: number;
  totalActual: number;
  totalCost: number;
  totalProfit: number;
  itemCount: number;
} {
  const stats = getInventoryStats(type, yearMonth);

  return {
    totalExpected: stats.reduce((sum, s) => sum + s.expected, 0),
    totalActual: stats.reduce((sum, s) => sum + s.actual, 0),
    totalCost: stats.reduce((sum, s) => sum + s.cost, 0),
    totalProfit: stats.reduce((sum, s) => sum + s.profit, 0),
    itemCount: stats.length,
  };
}

/**
 * 获取待兑奖记录（仅贵重物品）
 */
export function getPendingExchanges(): Array<{ name: string; qty: number }> {
  const db = legacyBridge.getDatabase();
  const records = db?.exchangeRecords || [];
  const pending = records.filter((r: any) => r.status === 'pending');

  const result: Record<string, number> = {};
  pending.forEach((r: any) => {
    result[r.itemName] = (result[r.itemName] || 0) + r.qty;
  });

  return Object.entries(result).map(([name, qty]) => ({ name, qty }));
}

export default {
  INVENTORY_TYPES,
  getInventoryItems,
  getAllInventoryItems,
  calculateInventory,
  calculateMonthlyInventory,
  getInventoryStats,
  getMonthlyInventorySummary,
  getPendingExchanges,
};
