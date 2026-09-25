/**
 * Expense Service - 费用数据服务
 *
 * 负责费用记录的增删改查操作。
 */

import legacyBridge from '@/legacy/legacy-bridge';
import { getConfig } from '@/shared/config/config-manager';

// ===== 类型定义 =====

export interface Expense {
  id: string;
  date: string;
  category: string;
  amount: number;
  note: string;
  photoFile: string;
}

export interface CreateExpenseInput {
  date: string;
  category: string;
  amount: number;
  note: string;
  photoFile?: string;
}

// ===== 服务函数 =====

/**
 * 获取所有费用记录
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
 * 获取费用分类列表
 * 从配置管理模块读取
 */
export function getExpenseCategories(): string[] {
  const configured = getConfig().expenseCategories;
  if (configured.length > 0) return configured;

  // 从已有记录提取
  const categories: Record<string, boolean> = {};
  getExpenses().forEach((e) => {
    if (e.category) categories[e.category] = true;
  });
  return Object.keys(categories);
}

/**
 * 创建费用记录
 */
export function createExpense(input: CreateExpenseInput): Expense {
  const expense: Expense = {
    id: `e_${Date.now()}`,
    date: input.date,
    category: input.category,
    amount: input.amount,
    note: input.note,
    photoFile: input.photoFile || '',
  };

  legacyBridge.update((db) => {
    db.expenses.push(expense);
  });

  return expense;
}

/**
 * 更新费用记录
 */
export function updateExpense(id: string, updates: Partial<CreateExpenseInput>): void {
  legacyBridge.update((db) => {
    const expense = db.expenses.find((e: Expense) => e.id === id);
    if (expense) {
      Object.assign(expense, updates);
    }
  });
}

/**
 * 删除费用记录
 */
export function deleteExpense(id: string): void {
  legacyBridge.update((db) => {
    db.expenses = db.expenses.filter((e: Expense) => e.id !== id);
  });
}

/**
 * 获取月度费用汇总
 */
export function getMonthlyExpenseSummary(yearMonth: string): {
  total: number;
  byCategory: Record<string, number>;
} {
  const expenses = getMonthlyExpenses(yearMonth);
  let total = 0;
  const byCategory: Record<string, number> = {};

  expenses.forEach((e) => {
    total += e.amount;
    byCategory[e.category] = (byCategory[e.category] || 0) + e.amount;
  });

  return { total, byCategory };
}

export default {
  getExpenses,
  getMonthlyExpenses,
  getExpenseCategories,
  createExpense,
  updateExpense,
  deleteExpense,
  getMonthlyExpenseSummary,
};
