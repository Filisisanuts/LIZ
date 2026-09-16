/**
 * Daily Service - 日报数据服务
 *
 * 负责日报的增删改查和统计计算。
 */

import legacyBridge from '@/legacy/legacy-bridge';

// ===== 类型定义 =====

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
    premiumRoomsToday: number;
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

export interface MonthlyStats {
  totalNetSales: number;
  totalGuests: number;
  avgDailySales: number;
  reportCount: number;
}

// ===== 服务函数 =====

/**
 * 获取所有日报
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
 * 获取指定日期的日报
 */
export function getDailyReport(date: string): DailyReport | undefined {
  return getDailyReports().find((r) => r.date === date);
}

/**
 * 创建或更新日报
 */
export function saveDailyReport(report: DailyReport): void {
  legacyBridge.update((db) => {
    const existingIndex = db.dailyReports.findIndex((r: DailyReport) => r.date === report.date);
    if (existingIndex >= 0) {
      db.dailyReports[existingIndex] = report;
    } else {
      db.dailyReports.push(report);
    }
  });
}

/**
 * 删除日报
 */
export function deleteDailyReport(date: string): void {
  legacyBridge.update((db) => {
    db.dailyReports = db.dailyReports.filter((r: DailyReport) => r.date !== date);
  });
}

/**
 * 获取月度统计
 */
export function getMonthlyStats(yearMonth: string): MonthlyStats {
  const reports = getMonthlyDailyReports(yearMonth);

  let totalNetSales = 0;
  let totalGuests = 0;

  reports.forEach((r) => {
    totalNetSales += r.revenue?.netSales || 0;
    totalGuests += r.guest?.count || 0;
  });

  return {
    totalNetSales,
    totalGuests,
    avgDailySales: reports.length > 0 ? Math.round(totalNetSales / reports.length) : 0,
    reportCount: reports.length,
  };
}

/**
 * 获取月度支付方式统计
 */
export function getMonthlyPaymentStats(yearMonth: string): {
  pos: number;
  ccbLife: number;
  cash: number;
  memberCard: number;
  treat: number;
  arMeituan: number;
  arDouyin: number;
  arTotal: number;
  delMeituan: number;
  delTaobao: number;
  delJd: number;
  delTotal: number;
} {
  const reports = getMonthlyDailyReports(yearMonth);

  let pos = 0, ccbLife = 0, cash = 0, memberCard = 0, treat = 0;
  let arMeituan = 0, arDouyin = 0, arTotal = 0;
  let delMeituan = 0, delTaobao = 0, delJd = 0, delTotal = 0;

  reports.forEach((r) => {
    pos += r.payment?.pos || 0;
    ccbLife += r.payment?.ccbLife || 0;
    cash += r.payment?.cash || 0;
    memberCard += r.payment?.memberCard || 0;
    treat += r.payment?.treat || 0;
    arMeituan += r.payment?.ar?.meituan || 0;
    arDouyin += r.payment?.ar?.douyin || 0;
    arTotal += r.payment?.ar?.total || 0;
    delMeituan += r.delivery?.meituan || 0;
    delTaobao += r.delivery?.taobao || 0;
    delJd += r.delivery?.jd || 0;
    delTotal += r.delivery?.total || 0;
  });

  return {
    pos, ccbLife, cash, memberCard, treat,
    arMeituan, arDouyin, arTotal,
    delMeituan, delTaobao, delJd, delTotal,
  };
}

/**
 * 获取支付方式分组配置
 */
export function getPaymentGroups(): Array<{
  name: string;
  items: Array<{ key: string; label: string }>;
}> {
  return [
    {
      name: '支付方式',
      items: [
        { key: 'pos', label: 'POS机' },
        { key: 'ccbLife', label: '建行生活' },
        { key: 'cash', label: '现金' },
        { key: 'memberCard', label: '会员卡' },
        { key: 'treat', label: '招待' },
      ],
    },
    {
      name: '应收账款',
      items: [
        { key: 'arMeituan', label: '美团团购' },
        { key: 'arDouyin', label: '抖音团购' },
        { key: 'arTotal', label: '应收合计' },
      ],
    },
    {
      name: '外卖配送',
      items: [
        { key: 'delMeituan', label: '美团外卖' },
        { key: 'delTaobao', label: '淘宝闪购' },
        { key: 'delJd', label: '京东外卖' },
        { key: 'delTotal', label: '外卖合计' },
      ],
    },
  ];
}

/**
 * 创建空日报模板
 */
export function createEmptyDailyReport(date: string): DailyReport {
  return {
    date,
    revenue: {
      netSales: 0,
      grossSales: 0,
      kitchenSales: 0,
      barSales: 0,
      cigarette: { total: 0 },
      other: 0,
      discount: 0,
    },
    guest: {
      count: 0,
      vip: 0,
      room: 0,
      premiumRoomsToday: 0,
    },
    payment: {
      pos: 0,
      ccbLife: 0,
      cash: 0,
      memberCard: 0,
      treat: 0,
      ar: {
        meituan: 0,
        douyin: 0,
        total: 0,
      },
    },
    delivery: {
      meituan: 0,
      taobao: 0,
      jd: 0,
      total: 0,
    },
    reporter: '',
    note: '',
  };
}

export default {
  getDailyReports,
  getMonthlyDailyReports,
  getDailyReport,
  saveDailyReport,
  deleteDailyReport,
  getMonthlyStats,
  getMonthlyPaymentStats,
  getPaymentGroups,
  createEmptyDailyReport,
};
