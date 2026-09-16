/**
 * Legacy Data Adapter - 旧数据格式适配器
 *
 * 将旧系统的 localStorage 数据转换为新系统的类型化格式。
 * 随着迁移完成，此文件将逐步删除。
 */

import { legacyBridge } from './legacy-bridge';

// ===== 新系统类型定义 =====

export interface DailyReport {
  date: string;
  revenue: {
    netSales: number;
    grossSales: number;
    kitchenSales: number;
    barSales: number;
    cigarette: { total: number };
    other: number;
    discount: number;
  };
  guest: {
    count: number;
    vip: number;
    room: number;
  };
  payment: {
    pos: number;
    ccbLife: number;
    cash: number;
    memberCard: number;
    treat: number;
    ar: {
      meituan: number;
      douyin: number;
      total: number;
    };
  };
  delivery: {
    meituan: number;
    taobao: number;
    jd: number;
    total: number;
  };
  reporter?: string;
  note?: string;
}

export interface Purchase {
  id: string;
  date: string;
  source: string;
  items: PurchaseItem[];
  total: number;
}

export interface PurchaseItem {
  name: string;
  qty: number;
  unit: string;
  total: number;
  section: string;
  category: string;
  unitPrice: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  pricePerUnit: number;
  openingStock: Record<string, number>;
  purchases: Array<{ date: string; qty: number; total: number }>;
  sales: Array<{ date: string; qty: number; amount: number }>;
}

export interface TeaItem extends InventoryItem {
  calcMode: 'gram' | 'pack';
  pricePerCup: number;
  pricePerPot: number;
  sales: Array<{
    date: string;
    cups: number;
    pots: number;
    qty: number;
    amount: number;
  }>;
}

export interface Expense {
  id: string;
  date: string;
  amount: number;
  category: string;
  note?: string;
  photo?: string | null;
}

export interface DamageRecord {
  id: string;
  date: string;
  item: string;
  qty: number;
  unit?: string;
  reason: string;
  amount: number;
  photo?: string | null;
}

// ===== 适配器函数 =====

/**
 * 获取所有日报数据
 */
export function getDailyReports(): DailyReport[] {
  const db = legacyBridge.getDatabase();
  return db?.dailyReports || [];
}

/**
 * 获取指定月份的日报
 */
export function getMonthlyDailyReports(yearMonth: string): DailyReport[] {
  return getDailyReports().filter((r) => r.date.startsWith(yearMonth));
}

/**
 * 获取所有采购记录
 */
export function getPurchases(): Purchase[] {
  const db = legacyBridge.getDatabase();
  return db?.purchases || [];
}

/**
 * 获取指定月份的采购
 */
export function getMonthlyPurchases(yearMonth: string): Purchase[] {
  return getPurchases().filter((p) => p.date.startsWith(yearMonth));
}

/**
 * 获取茗茶库存
 */
export function getTeaItems(): TeaItem[] {
  const db = legacyBridge.getDatabase();
  return db?.teaItems || [];
}

/**
 * 获取香烟库存
 */
export function getCigItems(): InventoryItem[] {
  const db = legacyBridge.getDatabase();
  return db?.cigItems || [];
}

/**
 * 获取酒类库存
 */
export function getAlcItems(): InventoryItem[] {
  const db = legacyBridge.getDatabase();
  return db?.alcItems || [];
}

/**
 * 获取贵重物品库存
 */
export function getOtherItems(): InventoryItem[] {
  const db = legacyBridge.getDatabase();
  return db?.otherItems || [];
}

/**
 * 获取所有费用
 */
export function getExpenses(): Expense[] {
  const db = legacyBridge.getDatabase();
  return db?.expenses || [];
}

/**
 * 获取指定月份的费用
 */
export function getMonthlyExpenses(yearMonth: string): Expense[] {
  return getExpenses().filter((e) => e.date.startsWith(yearMonth));
}

/**
 * 获取报损记录
 */
export function getDamageRecords(): DamageRecord[] {
  const db = legacyBridge.getDatabase();
  return db?.damageRecords || [];
}

/**
 * 获取指定月份的报损
 */
export function getMonthlyDamageRecords(yearMonth: string): DamageRecord[] {
  return getDamageRecords().filter((d) => d.date.startsWith(yearMonth));
}

export default {
  getDailyReports,
  getMonthlyDailyReports,
  getPurchases,
  getMonthlyPurchases,
  getTeaItems,
  getCigItems,
  getAlcItems,
  getOtherItems,
  getExpenses,
  getMonthlyExpenses,
  getDamageRecords,
  getMonthlyDamageRecords,
};
