/**
 * Report Service - 报表数据计算层
 *
 * 负责计算月度财务报表所需的所有数据。
 */

import legacyBridge from '@/legacy/legacy-bridge';

// ===== 类型定义 =====

export interface ReportData {
  yearMonth: string;
  shopName: string;

  // 营收
  revenue: RevenueSummary;

  // 支付方式
  payment: PaymentSummary;

  // 外卖渠道
  delivery: DeliverySummary;

  // 库存销售
  inventory: InventorySalesSummary;

  // 采购
  purchase: PurchaseSummary;

  // 费用
  expense: ExpenseSummary;

  // 利润
  profit: ProfitSummary;
}

export interface RevenueSummary {
  gross: number;
  net: number;
  kitchen: number;
  bar: number;
  delivery: number;
  cigarette: number;
  other: number;
  discount: number;
  guests: number;
  avgSpend: number;
}

export interface PaymentSummary {
  pos: number;
  ccbLife: number;
  cash: number;
  memberCard: number;
  treat: number;
  accountsReceivable: {
    meituan: number;
    douyin: number;
    total: number;
  };
}

export interface DeliverySummary {
  meituan: number;
  taobao: number;
  jd: number;
  total: number;
}

export interface InventorySalesSummary {
  tea: InventoryTypeSummary;
  cig: InventoryTypeSummary;
  alc: InventoryTypeSummary;
  other: InventoryTypeSummary;
}

export interface InventoryTypeSummary {
  items: Array<{
    name: string;
    revenue: number;
    cost: number;
    profit: number;
  }>;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
}

export interface PurchaseSummary {
  total: number;
  returns: number;
  net: number;
  bySection: Record<string, number>;
}

export interface ExpenseSummary {
  total: number;
  byCategory: Record<string, number>;
}

export interface ProfitSummary {
  grossProfit: number;
  grossMargin: number;
  operatingProfit: number;
  operatingMargin: number;
  byCategory: {
    kitchen: number;
    bar: number;
    tea: number;
    cigarette: number;
    alcohol: number;
    delivery: number;
    other: number;
  };
}

// ===== 服务函数 =====

/**
 * 获取完整报表数据
 */
export function getReportData(yearMonth: string): ReportData {
  const db = legacyBridge.getDatabase();
  const shopName = localStorage.getItem('ax_shop_name') || '经营管理';

  const reports = legacyBridge.getMonthlyReports(yearMonth);

  const revenue = calculateRevenue(reports);
  const payment = calculatePayment(reports);
  const delivery = calculateDelivery(reports);
  const inventory = calculateInventorySales(db, yearMonth);
  const purchase = calculatePurchase(db, yearMonth);
  const expense = calculateExpense(db, yearMonth);
  const profit = calculateProfit(revenue, purchase, expense, inventory);

  return {
    yearMonth,
    shopName,
    revenue,
    payment,
    delivery,
    inventory,
    purchase,
    expense,
    profit,
  };
}

// ===== 计算函数 =====

function calculateRevenue(reports: any[]): RevenueSummary {
  let gross = 0;
  let net = 0;
  let kitchen = 0;
  let bar = 0;
  let delivery = 0;
  let cigarette = 0;
  let other = 0;
  let discount = 0;
  let guests = 0;

  reports.forEach((r) => {
    gross += r.revenue?.grossSales || 0;
    net += r.revenue?.netSales || 0;
    kitchen += r.revenue?.kitchenSales || 0;
    bar += r.revenue?.barSales || 0;
    delivery += r.delivery?.total || 0;
    cigarette += r.revenue?.cigarette?.total || 0;
    other += r.revenue?.other || 0;
    discount += r.revenue?.discount || 0;
    guests += r.guest?.count || 0;
  });

  return {
    gross,
    net,
    kitchen,
    bar,
    delivery,
    cigarette,
    other,
    discount,
    guests,
    avgSpend: guests > 0 ? Math.round(net / guests) : 0,
  };
}

function calculatePayment(reports: any[]): PaymentSummary {
  let pos = 0;
  let ccbLife = 0;
  let cash = 0;
  let memberCard = 0;
  let treat = 0;
  let arMeituan = 0;
  let arDouyin = 0;

  reports.forEach((r) => {
    pos += r.payment?.pos || 0;
    ccbLife += r.payment?.ccbLife || 0;
    cash += r.payment?.cash || 0;
    memberCard += r.payment?.memberCard || 0;
    treat += r.payment?.treat || 0;
    arMeituan += r.payment?.ar?.meituan || 0;
    arDouyin += r.payment?.ar?.douyin || 0;
  });

  return {
    pos,
    ccbLife,
    cash,
    memberCard,
    treat,
    accountsReceivable: {
      meituan: arMeituan,
      douyin: arDouyin,
      total: arMeituan + arDouyin,
    },
  };
}

function calculateDelivery(reports: any[]): DeliverySummary {
  let meituan = 0;
  let taobao = 0;
  let jd = 0;

  reports.forEach((r) => {
    meituan += r.delivery?.meituan || 0;
    taobao += r.delivery?.taobao || 0;
    jd += r.delivery?.jd || 0;
  });

  return {
    meituan,
    taobao,
    jd,
    total: meituan + taobao + jd,
  };
}

function calculateInventorySales(db: any, ym: string): InventorySalesSummary {
  const tea = calculateTypeSales(db?.teaItems || [], 'tea', ym);
  const cig = calculateTypeSales(db?.cigItems || [], 'cig', ym);
  const alc = calculateTypeSales(db?.alcItems || [], 'alc', ym);
  const other = calculateTypeSales(db?.otherItems || [], 'other', ym);

  return { tea, cig, alc, other };
}

function calculateTypeSales(items: any[], type: string, ym: string): InventoryTypeSummary {
  const result = items.map((item) => {
    const stat = legacyBridge.calculateMonthlyInventory(item, type, ym);
    return {
      name: item.name,
      revenue: stat.revenue,
      cost: stat.cost,
      profit: stat.revenue - stat.cost,
    };
  });

  return {
    items: result,
    totalRevenue: result.reduce((s, r) => s + r.revenue, 0),
    totalCost: result.reduce((s, r) => s + r.cost, 0),
    totalProfit: result.reduce((s, r) => s + r.profit, 0),
  };
}

function calculatePurchase(db: any, ym: string): PurchaseSummary {
  const purchases = (db?.purchases || []).filter((p: any) => p.date.startsWith(ym));

  let total = 0;
  let returns = 0;
  const bySection: Record<string, number> = {};

  purchases.forEach((p: any) => {
    (p.items || []).forEach((item: any) => {
      const src = item.source || p.source || '外购';
      const section = item.section || '其他';

      if (src === '退货') {
        returns += item.total;
      } else {
        total += item.total;
        bySection[section] = (bySection[section] || 0) + item.total;
      }
    });
  });

  return {
    total,
    returns,
    net: total - returns,
    bySection,
  };
}

function calculateExpense(db: any, ym: string): ExpenseSummary {
  const expenses = (db?.expenses || []).filter((e: any) => e.date.startsWith(ym));

  let total = 0;
  const byCategory: Record<string, number> = {};

  expenses.forEach((e: any) => {
    total += e.amount;
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  });

  return {
    total,
    byCategory,
  };
}

function calculateProfit(
  revenue: RevenueSummary,
  purchase: PurchaseSummary,
  expense: ExpenseSummary,
  inventory: InventorySalesSummary
): ProfitSummary {
  const grossProfit = revenue.net - purchase.net;
  const grossMargin = revenue.net > 0 ? (grossProfit / revenue.net) * 100 : 0;
  const operatingProfit = grossProfit - expense.total;
  const operatingMargin = revenue.net > 0 ? (operatingProfit / revenue.net) * 100 : 0;

  // 分类毛利计算
  const barNoTea = Math.max(revenue.bar - inventory.tea.totalRevenue, 0);
  const barCost = purchase.bySection['吧台'] || 0;
  const kitCost = purchase.bySection['厨房'] || 0;

  return {
    grossProfit,
    grossMargin,
    operatingProfit,
    operatingMargin,
    byCategory: {
      kitchen: revenue.kitchen - kitCost,
      bar: barNoTea - barCost,
      tea: inventory.tea.totalProfit,
      cigarette: inventory.cig.totalProfit,
      alcohol: inventory.alc.totalProfit,
      delivery: revenue.delivery,
      other: revenue.other,
    },
  };
}

export default {
  getReportData,
};
