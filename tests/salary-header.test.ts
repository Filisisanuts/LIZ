import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const navSource = readFileSync(new URL('../src/js/nav.js', import.meta.url), 'utf8');

function createHeaderContext(config: Record<string, any>) {
  const context: Record<string, any> = {
    console,
    getAppConfig: () => config,
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(navSource, context);
  return context;
}

describe('salary grouped table header', () => {
  const groups = [
    { id: 'info', label: '信息项', order: 0, span: true },
    { id: 'basePay', label: '应付基本工资项目', order: 1, span: false },
    { id: 'direct', label: '提成绩效', order: 2, span: true },
    { id: 'postTax', label: '代扣代缴项目', order: 3, span: false },
    { id: 'actual', label: '实发工资', order: 4, span: true },
  ];
  const fields = [
    { id: 'employee', label: '姓名', category: 'info', group: 'info', type: 'text', visible: true, order: 0 },
    { id: 'baseSalary', label: '基本工资', category: 'earning', group: 'basePay', type: 'number', visible: true, order: 1 },
    { id: 'allowance', label: '津贴', category: 'earning', group: 'basePay', type: 'number', visible: true, order: 2 },
    { id: 'commission', label: '提成', category: 'earning', group: 'direct', type: 'number', visible: true, order: 3 },
    { id: 'tax', label: '个税', category: 'deduction', group: 'postTax', type: 'number', visible: true, order: 4 },
    { id: 'totalDeduction', label: '应扣合计', category: 'computed', group: 'postTax', type: 'number', visible: true, order: 5 },
    { id: 'actualSalary', label: '实发工资', category: 'computed', group: 'actual', type: 'number', visible: true, order: 6 },
  ];

  it('renders a two-row header with colspan groups and rowspan span-fields', () => {
    const context = createHeaderContext({
      salaryFieldGroups: groups,
      salaryFieldDefinitions: fields,
    });
    const html = context.salaryTableHeaderHtml();

    expect(html).toContain('<tr class="salary-group-row">');
    expect(html).toContain('<tr class="salary-field-label-row">');
    // 分组标题行：应付基本工资项目跨 2 列，代扣代缴项目跨 2 列
    expect(html).toContain('<th colspan="2" class="salary-group-header">应付基本工资项目</th>');
    expect(html).toContain('<th colspan="2" class="salary-group-header">代扣代缴项目</th>');
    // span 分组字段与固定列跨两行
    expect(html).toContain('<th rowspan="2" class="salary-span-header nr">提成</th>');
    expect(html).toContain('<th rowspan="2" class="salary-span-header nr">实发工资</th>');
    expect(html).toContain('<th class="salary-name-column" rowspan="2">姓名</th>');
    expect(html).toContain('<th rowspan="2">操作</th>');
    // 字段名出现在第二行
    expect(html).toContain('<th class="nr">基本工资</th>');
    expect(html).toContain('<th class="nr">个税</th>');
  });

  it('treats fields without a group as span cells instead of dropping them', () => {
    const context = createHeaderContext({
      salaryFieldGroups: groups,
      salaryFieldDefinitions: [
        { id: 'employee', label: '姓名', category: 'info', group: 'info', type: 'text', visible: true, order: 0 },
        { id: 'salary_custom_meal', label: '餐补', category: 'earning', group: '', type: 'number', visible: true, order: 1 },
      ],
    });
    const html = context.salaryTableHeaderHtml();
    expect(html).toContain('<th rowspan="2" class="salary-span-header nr">餐补</th>');
    expect(html).not.toContain('salary-field-label-row');
  });
});
