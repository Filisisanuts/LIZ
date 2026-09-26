import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const navSource = readFileSync(new URL('../src/js/nav.js', import.meta.url), 'utf8');

function createContext(fields: Array<Record<string, any>>) {
  const config = { salaryFieldDefinitions: fields };
  const context: Record<string, any> = { console, getAppConfig: () => config };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(navSource, context);
  return context;
}

const computedFields = [
  { id: 'employee', label: '姓名', category: 'info', group: 'info', type: 'text', visible: true, order: 0 },
  { id: 'baseSalary', label: '基本工资', category: 'earning', group: 'basePay', calculationGroup: 'base', type: 'number', visible: true, order: 1 },
  { id: 'commission', label: '提成', category: 'earning', group: 'direct', calculationGroup: 'direct', type: 'number', visible: true, order: 2 },
  { id: 'attendanceDays', label: '出勤天数', category: 'info', group: 'basePay', type: 'number', visible: true, order: 3 },
  { id: 'socialInsurance', label: '社保', category: 'deduction', group: 'preTax', calculationGroup: 'preTaxDeduction', type: 'number', visible: true, order: 4 },
  { id: 'tax', label: '个税', category: 'deduction', group: 'postTax', calculationGroup: 'postTaxDeduction', type: 'number', visible: true, order: 5 },
  { id: 'basePayTotal', label: '应付合计', category: 'computed', group: 'basePay', type: 'number', visible: true, order: 6, formula: 'BASE()' },
  { id: 'basePayProrated', label: '工资基本项目应付', category: 'computed', group: 'basePay', type: 'number', visible: true, order: 7, formula: '{basePayTotal}/31*{attendanceDays}' },
  { id: 'payableSubtotal', label: '应付小计', category: 'computed', group: 'subtotal', type: 'number', visible: true, order: 8, formula: '{basePayProrated}+DIRECT()' },
  { id: 'payableTotal', label: '应付总计', category: 'computed', group: 'total', type: 'number', visible: true, order: 9, formula: '{payableSubtotal}-PRE_TAX()' },
  { id: 'totalDeduction', label: '应扣合计', category: 'computed', group: 'postTax', type: 'number', visible: true, order: 10, formula: 'POST_TAX()' },
  { id: 'actualSalary', label: '实发工资', category: 'computed', group: 'actual', type: 'number', visible: true, order: 11, formula: '{payableTotal}-{totalDeduction}' },
];

describe('salary formula engine', () => {
  it('evaluates default-style formulas to the same result as the built-in chain', () => {
    const ctx = createContext(computedFields);
    const row = {
      baseSalary: 5000,
      commission: 800,
      attendanceDays: 31,
      socialInsurance: 300,
      tax: 100,
    };
    expect(ctx.salaryCalculatedValue(row, 'basePayTotal')).toBe(5000);
    expect(ctx.salaryCalculatedValue(row, 'basePayProrated')).toBe(5000);
    expect(ctx.salaryCalculatedValue(row, 'payableSubtotal')).toBe(5800);
    expect(ctx.salaryCalculatedValue(row, 'payableTotal')).toBe(5500);
    expect(ctx.salaryCalculatedValue(row, 'totalDeduction')).toBe(100);
    expect(ctx.salaryCalculatedValue(row, 'actualSalary')).toBe(5400);
    expect(ctx.calcSalaryActual(row)).toBe(5400);
  });

  it('supports functions, parentheses and rounding', () => {
    const ctx = createContext([
      ...computedFields,
      { id: 'bonus', label: '奖金', category: 'earning', group: 'direct', calculationGroup: 'direct', type: 'number', visible: true, order: 11 },
      { id: 'calc1', label: '测试计算', category: 'computed', group: 'actual', type: 'number', visible: true, order: 12, formula: 'ROUND((EARNINGS()+DEDUCTIONS())*0.1, 2)' },
    ]);
    const row = { baseSalary: 1000, commission: 500, bonus: 50, socialInsurance: 100, tax: 0, attendanceDays: 31 };
    // EARNINGS=1000+500+50=1550, DEDUCTIONS=100 → 1650*0.1=165
    expect(ctx.salaryCalculatedValue(row, 'calc1')).toBe(165);
  });

  it('keeps an explicit zero attendance value instead of treating it as full attendance', () => {
    const ctx = createContext(computedFields);
    const row = { baseSalary: 5000, attendanceDays: 0, socialInsurance: 0, tax: 0 };
    expect(ctx.salaryCalculatedValue(row, 'basePayProrated')).toBe(0);
    expect(ctx.calcSalaryActual(row)).toBe(0);
  });

  it('materializes computed and legacy summary fields before saving', () => {
    const ctx = createContext(computedFields);
    const row: Record<string, number> = {
      baseSalary: 5000,
      commission: 800,
      attendanceDays: 31,
      socialInsurance: 300,
      tax: 100,
    };
    ctx.applySalaryCalculations(row);
    expect(row).toMatchObject({
      basePayTotal: 5000,
      payableSubtotal: 5800,
      payableTotal: 5500,
      totalDeduction: 100,
      actualSalary: 5400,
      baseTotal: 5000,
      subtotal: 5800,
    });
  });

  it('rejects syntax errors with a Chinese message', () => {
    const ctx = createContext([
      ...computedFields,
      { id: 'bad', label: '坏公式', category: 'computed', group: 'actual', type: 'number', visible: true, order: 12, formula: '{baseSalary}+' },
    ]);
    expect(() => ctx.parseSalaryFormula('{baseSalary}+')).toThrow(/公式意外结束|缺少/);
    expect(() => ctx.parseSalaryFormula('{不存在}')).not.toThrow(); // 解析期不查字段，求值期查
    const warnings: string[] = [];
    ctx.console = { warn: (m: string) => warnings.push(m), log() {}, error() {} };
    // 求值失败回退旧逻辑（无 calculation → 行值/0），不抛出
    const value = ctx.salaryCalculatedValue({ baseSalary: 100 }, 'bad');
    expect(typeof value).toBe('number');
  });

  it('detects circular references and falls back without throwing', () => {
    const ctx = createContext([
      { id: 'a', label: 'A', category: 'computed', group: 'actual', type: 'number', visible: true, order: 0, formula: '{b}+1' },
      { id: 'b', label: 'B', category: 'computed', group: 'actual', type: 'number', visible: true, order: 1, formula: '{a}+1' },
    ]);
    expect(() => ctx.salaryCalculatedValue({}, 'a')).not.toThrow();
  });

  it('converts field id refs to labels for display and back for storage', () => {
    const ctx = createContext(computedFields);
    expect(ctx.salaryFormulaToDisplay('{payableTotal}-{totalDeduction}')).toBe('{应付总计}-{应扣合计}');
    expect(ctx.salaryFormulaToStorage('{应付总计}-{应扣合计}')).toBe('{payableTotal}-{totalDeduction}');
    expect(ctx.salaryFormulaToStorage('{应付总计}-{个税}')).toBe('{payableTotal}-{tax}');
    expect(() => ctx.salaryFormulaToStorage('{没有这个字段}')).toThrow(/未知字段/);
  });

  it('rejects unknown functions and invalid characters at parse time', () => {
    const ctx = createContext(computedFields);
    expect(() => ctx.parseSalaryFormula('HACK(1)')).toThrow(/未知函数/);
    expect(() => ctx.parseSalaryFormula('1 ? 2')).toThrow(/无法识别的字符/);
    expect(() => ctx.parseSalaryFormula('SUM(1, 2) * {baseSalary}')).not.toThrow();
  });
});
