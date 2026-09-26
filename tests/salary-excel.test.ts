import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const navSource = readFileSync(new URL('../src/js/nav.js', import.meta.url), 'utf8');

const fields = [
  { id: 'employee', label: '姓名', category: 'info', type: 'text', visible: true, order: 0 },
  { id: 'position', label: '职务', category: 'info', type: 'text', visible: true, order: 1 },
  { id: 'bankCard', label: '卡号', category: 'info', type: 'text', visible: true, order: 2 },
  { id: 'baseSalary', label: '基本工资', category: 'earning', calculationGroup: 'base', type: 'number', visible: true, order: 3 },
  { id: 'positionSubsidy', label: '职务补贴', category: 'earning', calculationGroup: 'base', type: 'number', visible: true, order: 4 },
  { id: 'attendanceDays', label: '出勤天数', category: 'info', type: 'number', visible: true, order: 5 },
  { id: 'commission', label: '提成', category: 'earning', calculationGroup: 'direct', type: 'number', visible: true, order: 6 },
  { id: 'socialInsurance', label: '社保', category: 'deduction', calculationGroup: 'preTaxDeduction', type: 'number', visible: true, order: 7 },
  { id: 'tax', label: '个税', category: 'deduction', calculationGroup: 'postTaxDeduction', type: 'number', visible: true, order: 8 },
  { id: 'actualSalary', label: '实发工资', category: 'computed', type: 'number', visible: true, order: 9, formula: 'EARNINGS()-DEDUCTIONS()' },
];

describe('salary Excel two-row headers', () => {
  it('imports employee fields and ignores subtotal rows', () => {
    const context: Record<string, any> = {
      console,
      getAppConfig: () => ({ salaryFieldDefinitions: fields, salaryFieldGroups: [] }),
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(navSource, context);

    const matrix = [
      ['岸香咖啡连锁员工工资表'],
      ['店铺：', '', '', '岸香咖啡'],
      ['序号', '部门', '姓名', '职务', '卡号', '应付基本工资项目', '', '', '', '', '', '应付合计', '出勤天数', '工资基本项目应付', '提成', '其他 \n补助', '绩效工资', '应付小计', '单位代扣个人缴费部分', '应付总计', '代扣代缴项目', '应扣合计', '实发工资'],
      ['', '', '', '', '', '基本工资', '职务补贴', '加班补贴', '津贴', '满勤奖', '司龄工龄', '', '', '', '', '', '', '', '社保', '', '个税'],
      [1, '前厅', '测试员工', '店长', '4015', 5000, 500, 0, 0, 100, 0, 5600, 30, 5419.35, 300, 0, 200, 5919.35, 453, 5466.35, 50, 50, 5416.35],
      ['', '部门小计', '', '', '', 5000],
    ];

    const objects = context.salaryExcelMatrixToObjects(matrix);
    const rows = context.salaryRowsFromExcel(objects);

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      department: '前厅',
      employee: '测试员工',
      position: '店长',
      bankCard: '4015',
      baseSalary: 5000,
      positionSubsidy: 500,
      attendanceDays: 30,
      commission: 300,
      socialInsurance: 453,
      tax: 50,
    });
  });
});
