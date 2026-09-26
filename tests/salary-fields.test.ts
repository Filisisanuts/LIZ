import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const navSource = readFileSync(new URL('../src/js/nav.js', import.meta.url), 'utf8');

describe('custom salary field calculations', () => {
  it('adds earning fields and subtracts deduction fields even when hidden', () => {
    const config = {
      salaryFieldDefinitions: [
        { id: 'employee', label: '姓名', category: 'info', type: 'text', visible: true, order: 0 },
        { id: 'baseSalary', label: '基本工资', category: 'earning', type: 'number', visible: true, order: 1 },
        { id: 'socialInsurance', label: '社保', category: 'deduction', type: 'number', visible: true, order: 2 },
        { id: 'salary_custom_bonus', label: '奖金', category: 'earning', type: 'number', visible: true, order: 3 },
        { id: 'salary_custom_penalty', label: '罚款', category: 'deduction', type: 'number', visible: false, order: 4 },
        { id: 'actualSalary', label: '实发工资', category: 'computed', type: 'number', visible: true, order: 5 },
      ],
    };
    const context: Record<string, any> = {
      console,
      getAppConfig: () => config,
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(navSource, context);

    const row = {
      baseSalary: 5000,
      socialInsurance: 300,
      salary_custom_bonus: 800,
      salary_custom_penalty: 100,
    };

    expect(context.calcSalaryActual(row)).toBe(5400);
    expect(context.calcSalaryTotals([row])).toMatchObject({
      baseSalary: 5000,
      salary_custom_bonus: 800,
      socialInsurance: 300,
      salary_custom_penalty: 100,
      actualSalary: 5400,
    });
  });

  it('defaults missing legacy attendance to 31 but preserves an explicit zero', () => {
    const config = {
      salaryFieldDefinitions: [
        { id: 'employee', label: '姓名', category: 'info', type: 'text', visible: true, order: 0 },
        { id: 'attendanceDays', label: '出勤天数', category: 'info', type: 'number', visible: true, order: 1 },
        { id: 'actualSalary', label: '实发工资', category: 'computed', type: 'number', visible: true, order: 2 },
      ],
    };
    const context: Record<string, any> = { console, getAppConfig: () => config };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(navSource, context);

    expect(context.normalizeSalaryRow({ employee: '旧员工' }).attendanceDays).toBe(31);
    expect(context.normalizeSalaryRow({ employee: '零出勤', attendanceDays: 0 }).attendanceDays).toBe(0);
  });
});
