/**
 * Dashboard Service - 数据计算层
 *
 * 负责从 Legacy Bridge 读取数据并计算 Dashboard 所需的统计值。
 */

import legacyBridge from '@/legacy/legacy-bridge';

// ===== 类型定义 =====

export interface DailyReportSummary {
  date: string;
  netSales: number;
  kitchenSales: number;
  barSales: number;
  deliveryTotal: number;
  guestCount: number;
  premiumRooms: number;
}

export interface MonthlyStats {
  netSales: number;
  kitchenSales: number;
  barSales: number;
  deliveryTotal: number;
  guestCount: number;
  premiumRooms: number;
  avgPerGuest: number;
}

export interface PurchaseStats {
  total: number;
  returns: number;
  net: number;
  days: number;
}

export interface InventoryStats {
  tea: { revenue: number; profit: number };
  cig: { revenue: number; profit: number };
  alc: { revenue: number; profit: number };
}

export interface RestockAlert {
  name: string;
  stock: number;
  unit: string;
}

export interface TrendData {
  label: string;
  revenue: number;
  guests: number;
}

// ===== 服务函数 =====

/**
 * 获取昨日日报
 */
export function getYesterdayReport(): DailyReportSummary | null {
  const db = legacyBridge.getDatabase();
  if (!db?.dailyReports) return null;

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const yd = formatDate(yesterday);

  const report = db.dailyReports.find((r: any) => r.date === yd);
  if (!report) return null;

  return {
    date: yd,
    netSales: report.revenue?.netSales || 0,
    kitchenSales: report.revenue?.kitchenSales || 0,
    barSales: report.revenue?.barSales || 0,
    deliveryTotal: report.delivery?.total || 0,
    guestCount: report.guest?.count || 0,
    premiumRooms: report.guest?.premiumRoomsToday || 0,
  };
}

/**
 * 获取本月统计
 */
export function getMonthlyStats(): MonthlyStats {
  const ym = legacyBridge.getCurrentYearMonth();
  const reports = legacyBridge.getMonthlyReports(ym);

  let netSales = 0;
  let kitchenSales = 0;
  let barSales = 0;
  let deliveryTotal = 0;
  let guestCount = 0;
  let premiumRooms = 0;

  reports.forEach((r: any) => {
    netSales += r.revenue?.netSales || 0;
    kitchenSales += r.revenue?.kitchenSales || 0;
    barSales += r.revenue?.barSales || 0;
    deliveryTotal += r.delivery?.total || 0;
    guestCount += r.guest?.count || 0;
    premiumRooms += r.guest?.premiumRoomsToday || 0;
  });

  return {
    netSales,
    kitchenSales,
    barSales,
    deliveryTotal,
    guestCount,
    premiumRooms,
    avgPerGuest: guestCount > 0 ? Math.round(netSales / guestCount) : 0,
  };
}

/**
 * 获取采购统计
 */
export function getPurchaseStats(): PurchaseStats {
  const ym = legacyBridge.getCurrentYearMonth();
  const db = legacyBridge.getDatabase();
  const purchases = (db?.purchases || []).filter((p: any) => p.date.startsWith(ym));

  let total = 0;
  let returns = 0;
  const days: Record<string, boolean> = {};

  purchases.forEach((p: any) => {
    days[p.date] = true;
    (p.items || []).forEach((item: any) => {
      const src = item.source || p.source || '外购';
      if (src === '退货') {
        returns += item.total;
      } else {
        total += item.total;
      }
    });
  });

  return {
    total,
    returns,
    net: total - returns,
    days: Object.keys(days).length,
  };
}

/**
 * 获取贵重物品经营统计
 */
export function getInventoryStats(): InventoryStats {
  const ym = legacyBridge.getCurrentYearMonth();
  const db = legacyBridge.getDatabase();

  // 茗茶
  let teaRevenue = 0;
  let teaProfit = 0;
  (db?.teaItems || []).forEach((item: any) => {
    const stat = legacyBridge.calculateMonthlyInventory(item, 'tea', ym);
    teaRevenue += stat.revenue;
    teaProfit += stat.revenue - stat.cost;
  });

  // 香烟
  let cigRevenue = 0;
  let cigProfit = 0;
  (db?.cigItems || []).forEach((item: any) => {
    const stat = legacyBridge.calculateMonthlyInventory(item, 'cig', ym);
    cigRevenue += stat.revenue;
    cigProfit += stat.revenue - stat.cost;
  });

  // 酒类
  let alcRevenue = 0;
  let alcProfit = 0;
  (db?.alcItems || []).forEach((item: any) => {
    const stat = legacyBridge.calculateMonthlyInventory(item, 'alc', ym);
    alcRevenue += stat.revenue;
    alcProfit += stat.revenue - stat.cost;
  });

  return {
    tea: { revenue: teaRevenue, profit: teaProfit },
    cig: { revenue: cigRevenue, profit: cigProfit },
    alc: { revenue: alcRevenue, profit: alcProfit },
  };
}

/**
 * 获取补货预警
 */
export function getRestockAlerts(): RestockAlert[] {
  const ym = legacyBridge.getCurrentYearMonth();
  const db = legacyBridge.getDatabase();
  const alerts: RestockAlert[] = [];

  // 茗茶
  (db?.teaItems || []).forEach((item: any) => {
    const stock = calculateStock(item, 'tea', ym);
    if (item.restockAlert && stock <= item.restockAlert) {
      const unit = item.calcMode === 'pack' ? '包' : '克';
      alerts.push({ name: item.name, stock, unit });
    }
  });

  // 香烟
  (db?.cigItems || []).forEach((item: any) => {
    const stock = calculateStock(item, 'cig', ym);
    if (item.restockAlert && stock <= item.restockAlert) {
      alerts.push({ name: item.name, stock, unit: '包' });
    }
  });

  // 酒类
  (db?.alcItems || []).forEach((item: any) => {
    const stock = calculateStock(item, 'alc', ym);
    if (item.restockAlert && stock <= item.restockAlert) {
      alerts.push({ name: item.name, stock, unit: '瓶' });
    }
  });

  // 贵重物品
  (db?.otherItems || []).forEach((item: any) => {
    const stock = calculateStock(item, 'other', ym);
    const unit = item.calcMode === 'pack' ? '包' : item.calcMode === 'gram' ? '克' : '个';
    if (item.restockAlert && stock <= item.restockAlert) {
      alerts.push({ name: item.name, stock, unit });
    }
  });

  // 仓库
  (db?.whItems || []).forEach((item: any) => {
    if (item.safeStock && item.stock <= item.safeStock) {
      alerts.push({ name: item.name, stock: item.stock, unit: item.unit });
    }
  });

  return alerts;
}

/**
 * 获取近7日趋势数据
 */
export function getTrendData(): TrendData[] {
  const db = legacyBridge.getDatabase();
  const result: TrendData[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const ds = formatDate(d);
    const report = db?.dailyReports?.find((r: any) => r.date === ds);

    result.push({
      label: `${d.getMonth() + 1}/${d.getDate()}`,
      revenue: report?.revenue?.netSales || 0,
      guests: report?.guest?.count || 0,
    });
  }

  return result;
}

// ===== 辅助函数 =====

function formatDate(d: Date): string {
  return (
    d.getFullYear() +
    '-' +
    String(d.getMonth() + 1).padStart(2, '0') +
    '-' +
    String(d.getDate()).padStart(2, '0')
  );
}

function calculateStock(item: any, type: string, ym: string): number {
  const purchases = (item.purchases || [])
    .filter((p: any) => p.date?.startsWith(ym))
    .reduce((s: number, p: any) => s + (p.qty || 0), 0);

  let sold = 0;
  (item.sales || [])
    .filter((s: any) => s.date?.startsWith(ym))
    .forEach((s: any) => {
      if (type === 'tea' || (type === 'other' && item.calcMode === 'pack')) {
        sold += (s.cups || 0) * (item.packsPerCup || 0) + (s.pots || 0) * (item.packsPerPot || 0);
      } else if (type === 'other' && item.calcMode === 'gram') {
        sold += (s.cups || 0) * (item.gramsPerCup || 1) + (s.pots || 0) * (item.gramsPerPot || 0);
      } else {
        sold += s.qty || 0;
      }
    });

  return (item.openingStock || 0) + purchases - sold;
}

export default {
  getYesterdayReport,
  getMonthlyStats,
  getPurchaseStats,
  getInventoryStats,
  getRestockAlerts,
  getTrendData,
};
