import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../src/js/nav.js', import.meta.url), 'utf8');

function harness() {
  let reads = 0;
  const config = { salaryFieldDefinitions: [
    { id: 'employee', type: 'text', category: 'info', order: 0 },
    { id: 'baseSalary', type: 'number', category: 'earning', calculationGroup: 'base', order: 1 },
    { id: 'actualSalary', type: 'number', category: 'computed', formula: '{baseSalary}+7', order: 2 },
  ] };
  const ctx: any = {
    console, document: { addEventListener() {}, querySelectorAll: () => [] },
    CSS: { escape: (s: string) => s }, $id: () => null,
    getAppConfig: () => { reads++; return config; },
  };
  ctx.window = ctx;
  vm.createContext(ctx);
  vm.runInContext(source, ctx);
  ctx.salaryDepartments = () => ['前厅'];
  ctx._salaryPeriod = '2026-10';
  ctx._salaryTableData = [
    { id: 'a', department: '前厅', baseSalary: 3000 },
    { id: 'b', department: '前厅', baseSalary: 4000 },
  ];
  return { ctx, config, reads: () => reads };
}

describe('salary input calculation cache', () => {
  it('reuses unaffected rows and invalidates all rows after formula changes', () => {
    const { ctx, config, reads } = harness();
    ctx.updateSalarySummaries();
    const other = ctx._salarySummaryRows.get(ctx._salaryTableData[1]);
    const before = reads();
    ctx.updateSalaryRow('a', 'baseSalary', '3500');
    expect(reads() - before).toBe(2);
    expect(ctx._salarySummaryRows.get(ctx._salaryTableData[1])).toBe(other);
    expect(ctx._salarySummaryRows.get(ctx._salaryTableData[0]).actualSalary).toBe(3507);
    expect(ctx._salaryDrafts['2026-10'][0].baseSalary).toBe(3500);
    config.salaryFieldDefinitions[2].formula = '{baseSalary}+9';
    ctx.updateSalaryRow('a', 'baseSalary', '3600');
    expect(ctx._salarySummaryRows.get(ctx._salaryTableData[1]).actualSalary).toBe(4009);
    expect(ctx._salarySummaryRows.get(ctx._salaryTableData[0]).actualSalary).toBe(3609);
  });

  it('releases a failed calculation snapshot and keeps month drafts separate', () => {
    const { ctx } = harness();
    expect(() => ctx.withSalaryCalculationFields(() => { throw new Error('stop'); })).toThrow('stop');
    expect(ctx._salaryCalculationFields).toBeNull();
    ctx.updateSalaryRow('a', 'baseSalary', '3500');
    ctx._salaryPeriod = '2026-11';
    ctx._salaryTableData = ctx.cloneSalaryRows(ctx._salaryTableData);
    ctx.updateSalarySummaries();
    ctx.updateSalaryRow('a', 'baseSalary', '5000');
    expect(ctx._salaryDrafts['2026-10'][0].baseSalary).toBe(3500);
    expect(ctx._salaryDrafts['2026-11'][0].baseSalary).toBe(5000);
  });
});
