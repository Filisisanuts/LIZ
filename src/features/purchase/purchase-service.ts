/**
 * Purchase Service - 采购数据服务
 *
 * 负责采购记录的增删改查、解析、统计。
 */

import legacyBridge from '@/legacy/legacy-bridge';

// ===== 类型定义 =====

export interface Purchase {
  id: string;
  date: string;
  source: string;
  items: PurchaseItem[];
  total: number;
}

export interface PurchaseItem {
  name: string;
  section: string;
  category: string;
  qty: number;
  unit: string;
  unitPrice: number;
  total: number;
  source: string;
}

export interface MonthlyPurchaseStats {
  total: number;
  returns: number;
  net: number;
  bySection: Record<string, number>;
  days: number;
}

// ===== 服务函数 =====

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
 * 获取指定日期的采购
 */
export function getDailyPurchases(date: string): Purchase[] {
  return getPurchases().filter((p) => p.date === date);
}

/**
 * 创建采购记录
 */
export function createPurchase(purchase: Omit<Purchase, 'id'>): Purchase {
  const newPurchase: Purchase = {
    id: `pur_${Date.now()}`,
    ...purchase,
  };

  legacyBridge.update((db) => {
    db.purchases.push(newPurchase);
  });

  return newPurchase;
}

/**
 * 更新采购记录
 */
export function updatePurchase(id: string, updates: Partial<Purchase>): void {
  legacyBridge.update((db) => {
    const purchase = db.purchases.find((p: Purchase) => p.id === id);
    if (purchase) {
      Object.assign(purchase, updates);
    }
  });
}

/**
 * 删除采购记录
 */
export function deletePurchase(id: string): void {
  legacyBridge.update((db) => {
    db.purchases = db.purchases.filter((p: Purchase) => p.id !== id);
  });
}

/**
 * 获取月度采购统计
 */
export function getMonthlyPurchaseStats(yearMonth: string): MonthlyPurchaseStats {
  const purchases = getMonthlyPurchases(yearMonth);

  let total = 0;
  let returns = 0;
  const bySection: Record<string, number> = {};
  const days: Record<string, boolean> = {};

  purchases.forEach((p) => {
    days[p.date] = true;
    p.items.forEach((item) => {
      const src = item.source || p.source || '外购';
      if (src === '退货') {
        returns += item.total;
      } else {
        total += item.total;
        const section = item.section || '其他';
        bySection[section] = (bySection[section] || 0) + item.total;
      }
    });
  });

  return {
    total,
    returns,
    net: total - returns,
    bySection,
    days: Object.keys(days).length,
  };
}

/**
 * 查找商品的历史采购单价
 */
export function findPrevPrice(name: string, currentDate: string): { date: string; unitPrice: number } | null {
  let best: { date: string; unitPrice: number } | null = null;

  getPurchases().forEach((p) => {
    if (p.date >= currentDate) return;
    p.items.forEach((item) => {
      if (item.name === name) {
        const up = item.unitPrice || (item.qty > 0 ? Math.round((item.total / item.qty) * 100) / 100 : 0);
        if (up > 0 && (!best || p.date > best.date)) {
          best = { date: p.date, unitPrice: up };
        }
      }
    });
  });

  return best;
}

/**
 * 解析采购单文本
 * 支持 Tab分隔、Markdown表格、空格分隔 三种格式
 */
export function parsePurchaseText(text: string): Omit<Purchase, 'id'> {
  const dm = text.match(/(\d{4})[-\/.年]\s*(\d{1,2})[-\/.月]\s*(\d{1,2})/);
  const isAx = /岸香.*贸易|贸易.*岸香/.test(text);

  const result: Omit<Purchase, 'id'> = {
    date: getToday(),
    items: [],
    source: isAx ? '岸香贸易' : '外购',
    total: 0,
  };

  if (dm) {
    result.date = `${dm[1]}-${String(dm[2]).padStart(2, '0')}-${String(dm[3]).padStart(2, '0')}`;
  }

  const skipRe = /合计|本页|当日|区域汇总|以下是|好的|已删除|不录入/;
  let curSection = '';

  text.split('\n').forEach((raw) => {
    let l = raw.trim();
    if (!l) return;

    // 去掉行首emoji和特殊符号
    l = l.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\s*/u, '');
    l = l.replace(/^\*\*/g, '');
    l = l.replace(/^📌\s*/, '');
    l = l.replace(/^>\s*/g, '');

    // 检测区域标题
    const secMatch = l.match(/^(?:#{1,3}\s*)?(厨房|吧台|外场)(?:\s*[·•\-]|$)/);
    if (secMatch) {
      curSection = secMatch[1];
      return;
    }

    // 跳过非数据行
    if (skipRe.test(l)) return;
    if (/^#{1,6}\s/.test(l)) return;
    if (/^[-—]{3,}$/.test(l)) return;
    if (/^品名/.test(l)) return;

    // Tab分隔行
    if (l.indexOf('\t') >= 0) {
      const cells = l.split('\t').map((s) => s.trim());
      if (cells.length >= 4) {
        const item = parseTabRow(cells, curSection, result.source);
        if (item) result.items.push(item);
      }
      return;
    }

    // Markdown表格行
    if (/^\|/.test(l)) {
      l = l.replace(/^\|/, '').replace(/\|\s*$/, '');
      const cells = l.split('|').map((s) => s.trim());
      if (cells.length > 0 && /^[:\-—]+$/.test(cells[0])) return;

      if (cells.length >= 4) {
        const item = parseTabRow(cells, curSection, result.source);
        if (item) result.items.push(item);
      }
      return;
    }

    // 空格分隔行
    const parts = l.split(/\s{2,}/);
    if (parts.length >= 3) {
      const item = parseSpaceRow(parts, curSection, result.source);
      if (item) result.items.push(item);
    }
  });

  // 计算总金额
  result.total = result.items.reduce((sum, item) => sum + item.total, 0);

  return result;
}

// ===== 辅助函数 =====

function parseTabRow(cells: string[], section: string, defaultSource: string): PurchaseItem | null {
  const name = cells[0];
  if (name.length < 1 || !/[\u4e00-\u9fa5a-zA-Z]/.test(name)) return null;

  let qty = 0, unit = '', unitPrice = 0, total = 0, cat = '';

  if (cells.length >= 6) {
    const q1 = parseQty(cells[2]);
    qty = q1.qty;
    unit = q1.unit;
    const upParts = cells[3].replace(/,/g, '').split('/');
    unitPrice = parseFloat(upParts[0]) || 0;
    if (!unit && upParts[1]) unit = upParts[1].trim();
    total = parseFloat(cells[4].replace(/,/g, '').replace(/\*+$/, '')) || 0;
    cat = cells[5] || '';
  } else if (cells.length >= 5) {
    const q2 = parseQty(cells[1]);
    qty = q2.qty;
    unit = q2.unit;
    const upParts2 = cells[2].replace(/,/g, '').split('/');
    unitPrice = parseFloat(upParts2[0]) || 0;
    if (!unit && upParts2[1]) unit = upParts2[1].trim();
    total = parseFloat(cells[3].replace(/,/g, '').replace(/\*+$/, '')) || 0;
    cat = cells[4] || '';
  } else {
    const q3 = parseQty(cells[1]);
    qty = q3.qty;
    unit = q3.unit;
    const upParts3 = cells[2].replace(/,/g, '').split('/');
    unitPrice = parseFloat(upParts3[0]) || 0;
    if (!unit && upParts3[1]) unit = upParts3[1].trim();
    total = parseFloat(cells[3].replace(/,/g, '').replace(/\*+$/, '')) || 0;
  }

  if (!unitPrice && total > 0 && qty > 0) unitPrice = Math.round((total / qty) * 100) / 100;
  if (qty > 0 && total > 0) {
    return {
      name,
      section,
      category: cat,
      qty,
      unit,
      unitPrice,
      total,
      source: defaultSource,
    };
  }

  return null;
}

function parseSpaceRow(parts: string[], section: string, defaultSource: string): PurchaseItem | null {
  if (parts.length < 3) return null;

  const name = parts[0];
  if (name.length < 1 || !/[\u4e00-\u9fa5a-zA-Z]/.test(name)) return null;

  const q = parseQty(parts[1]);
  const total = parseFloat(parts[parts.length - 1].replace(/,/g, '')) || 0;

  if (q.qty > 0 && total > 0) {
    const unitPrice = Math.round((total / q.qty) * 100) / 100;
    return {
      name,
      section,
      category: '',
      qty: q.qty,
      unit: q.unit,
      unitPrice,
      total,
      source: defaultSource,
    };
  }

  return null;
}

function parseQty(s: string): { qty: number; unit: string } {
  const m = s.match(/([\d.]+)\s*(.*)/);
  return {
    qty: m ? parseFloat(m[1]) : 0,
    unit: m ? (m[2] || '').trim() : '',
  };
}

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default {
  getPurchases,
  getMonthlyPurchases,
  getDailyPurchases,
  createPurchase,
  updatePurchase,
  deletePurchase,
  getMonthlyPurchaseStats,
  findPrevPrice,
  parsePurchaseText,
};
