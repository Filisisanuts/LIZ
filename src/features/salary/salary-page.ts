/**
 * Salary Page - 工资管理页面组件
 *
 * 提供表格化工资录入、导入Excel、查看详情功能。
 */

import { formatCurrency } from '@/shared/format/currency';
import {
  getMonthlySalaryRecords,
  getMonthlySalaryStats,
  getDepartmentSalaryStats,
  batchCreateSalaryRecords,
  clearMonthlySalaryRecords,
  type CreateSalaryInput,
} from './salary-service';

// ===== 状态 =====

let tableData: CreateSalaryInput[] = [];
let currentPeriod = '';

// ===== 组件函数 =====

/**
 * 渲染 Salary 页面
 */
export function renderSalary(container: HTMLElement): void {
  currentPeriod = getCurrentPeriod();

  // 加载已有数据
  const records = getMonthlySalaryRecords(currentPeriod);
  if (records.length > 0) {
    tableData = records.map(r => ({
      period: r.period,
      department: r.department,
      employee: r.employee,
      position: r.position,
      cardNo: r.cardNo,
      baseSalary: r.baseSalary,
      positionSubsidy: r.positionSubsidy,
      overtimeSubsidy: r.overtimeSubsidy,
      allowance: r.allowance,
      fullAttendance: r.fullAttendance,
      seniority: r.seniority,
      commission: r.commission,
      otherSubsidy: r.otherSubsidy,
      performance: r.performance,
      socialInsurance: r.socialInsurance,
      tax: r.tax,
      note: r.note,
    }));
  } else {
    tableData = [createEmptyRow(currentPeriod)];
  }

  let html = '';

  // 月份选择 + 操作按钮
  html += `
    <div style="display: flex; gap: 0.5rem; margin-bottom: 1rem; align-items: center; flex-wrap: wrap;">
      <label style="font-size: 0.85rem; color: var(--color-text-secondary);">月份</label>
      <input type="month" id="salaryPeriod" value="${currentPeriod}" onchange="changeSalaryPeriod(this.value)" style="max-width: 180px;">
      <div style="flex: 1;"></div>
      <button class="btn-secondary" onclick="addSalaryRow()">+ 添加行</button>
      <button class="btn-secondary" onclick="importExcel()">📥 导入 Excel</button>
      <button class="btn-secondary" onclick="importFromImage()">📷 AI 识图</button>
      <button class="btn-primary" onclick="saveSalaryTable()">💾 保存</button>
    </div>
  `;

  // 隐藏的文件输入
  html += '<input type="file" id="salaryExcelInput" accept=".xlsx,.xls" style="display: none;" onchange="handleExcelImport(event)">';
  html += '<input type="file" id="salaryImageInput" accept="image/*" style="display: none;" onchange="handleImageImport(event)">';

  // 统计卡片
  const stats = getMonthlySalaryStats(currentPeriod);
  if (stats.employeeCount > 0) {
    html += `
      <div class="card-grid" style="margin-bottom: 1rem;">
        <div class="stat-card">
          <div class="stat-card-label">员工人数</div>
          <div class="stat-card-value">${stats.employeeCount}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">基本工资</div>
          <div class="stat-card-value">${formatCurrency(stats.totalBase)}</div>
        </div>
        <div class="stat-card">
          <div class="stat-card-label">实发工资</div>
          <div class="stat-card-value positive">${formatCurrency(stats.totalActual)}</div>
        </div>
      </div>
    `;
  }

  // 工资表格
  html += '<div class="data-table" style="overflow-x: auto;"><table id="salaryTable">';
  html += `
    <thead>
      <tr>
        <th>部门</th>
        <th>姓名</th>
        <th>职务</th>
        <th style="text-align: right;">基本工资</th>
        <th style="text-align: right;">职务补贴</th>
        <th style="text-align: right;">加班补贴</th>
        <th style="text-align: right;">津贴</th>
        <th style="text-align: right;">满勤奖</th>
        <th style="text-align: right;">司龄</th>
        <th style="text-align: right;">提成</th>
        <th style="text-align: right;">其他补助</th>
        <th style="text-align: right;">绩效</th>
        <th style="text-align: right;">社保</th>
        <th style="text-align: right;">个税</th>
        <th style="text-align: right;">实发工资</th>
        <th>操作</th>
      </tr>
    </thead>
    <tbody>
  `;

  tableData.forEach((row, index) => {
    const actual = calculateActual(row);
    html += `
      <tr data-index="${index}">
        <td><input type="text" value="${row.department || ''}" onchange="updateSalaryRow(${index}, 'department', this.value)" style="width: 80px;"></td>
        <td><input type="text" value="${row.employee || ''}" onchange="updateSalaryRow(${index}, 'employee', this.value)" style="width: 80px;"></td>
        <td><input type="text" value="${row.position || ''}" onchange="updateSalaryRow(${index}, 'position', this.value)" style="width: 100px;"></td>
        <td><input type="number" value="${row.baseSalary || 0}" onchange="updateSalaryRow(${index}, 'baseSalary', this.value)" style="width: 80px; text-align: right;"></td>
        <td><input type="number" value="${row.positionSubsidy || 0}" onchange="updateSalaryRow(${index}, 'positionSubsidy', this.value)" style="width: 70px; text-align: right;"></td>
        <td><input type="number" value="${row.overtimeSubsidy || 0}" onchange="updateSalaryRow(${index}, 'overtimeSubsidy', this.value)" style="width: 70px; text-align: right;"></td>
        <td><input type="number" value="${row.allowance || 0}" onchange="updateSalaryRow(${index}, 'allowance', this.value)" style="width: 60px; text-align: right;"></td>
        <td><input type="number" value="${row.fullAttendance || 0}" onchange="updateSalaryRow(${index}, 'fullAttendance', this.value)" style="width: 60px; text-align: right;"></td>
        <td><input type="number" value="${row.seniority || 0}" onchange="updateSalaryRow(${index}, 'seniority', this.value)" style="width: 60px; text-align: right;"></td>
        <td><input type="number" value="${row.commission || 0}" onchange="updateSalaryRow(${index}, 'commission', this.value)" style="width: 70px; text-align: right;"></td>
        <td><input type="number" value="${row.otherSubsidy || 0}" onchange="updateSalaryRow(${index}, 'otherSubsidy', this.value)" style="width: 70px; text-align: right;"></td>
        <td><input type="number" value="${row.performance || 0}" onchange="updateSalaryRow(${index}, 'performance', this.value)" style="width: 70px; text-align: right;"></td>
        <td><input type="number" value="${row.socialInsurance || 0}" onchange="updateSalaryRow(${index}, 'socialInsurance', this.value)" style="width: 70px; text-align: right;"></td>
        <td><input type="number" value="${row.tax || 0}" onchange="updateSalaryRow(${index}, 'tax', this.value)" style="width: 70px; text-align: right;"></td>
        <td style="text-align: right; font-weight: 600; font-family: var(--font-mono);">${formatCurrency(actual)}</td>
        <td>
          <button class="btn-secondary btn-sm btn-danger" onclick="removeSalaryRow(${index})">×</button>
        </td>
      </tr>
    `;
  });

  // 合计行
  const totals = calculateTotals(tableData);
  html += `
    <tr style="background: var(--color-bg-elevated); font-weight: 600;">
      <td colspan="3">合计</td>
      <td style="text-align: right;">${formatCurrency(totals.baseSalary)}</td>
      <td style="text-align: right;">${formatCurrency(totals.positionSubsidy)}</td>
      <td style="text-align: right;">${formatCurrency(totals.overtimeSubsidy)}</td>
      <td style="text-align: right;">${formatCurrency(totals.allowance)}</td>
      <td style="text-align: right;">${formatCurrency(totals.fullAttendance)}</td>
      <td style="text-align: right;">${formatCurrency(totals.seniority)}</td>
      <td style="text-align: right;">${formatCurrency(totals.commission)}</td>
      <td style="text-align: right;">${formatCurrency(totals.otherSubsidy)}</td>
      <td style="text-align: right;">${formatCurrency(totals.performance)}</td>
      <td style="text-align: right;">${formatCurrency(totals.socialInsurance)}</td>
      <td style="text-align: right;">${formatCurrency(totals.tax)}</td>
      <td style="text-align: right; color: var(--color-primary);">${formatCurrency(totals.actualSalary)}</td>
      <td></td>
    </tr>
  `;

  html += '</tbody></table></div>';

  container.innerHTML = html;
}

// ===== 全局函数绑定 =====

function initSalaryGlobals(): void {
  // 添加行
  (window as any).addSalaryRow = () => {
    tableData.push(createEmptyRow(currentPeriod));
    const container = document.getElementById('mainContent');
    if (container) renderSalary(container);
  };

  // 删除行
  (window as any).removeSalaryRow = (index: number) => {
    tableData.splice(index, 1);
    const container = document.getElementById('mainContent');
    if (container) renderSalary(container);
  };

  // 更新单元格
  (window as any).updateSalaryRow = (index: number, field: string, value: string) => {
    if (!tableData[index]) return;
    const numericFields = ['baseSalary', 'positionSubsidy', 'overtimeSubsidy', 'allowance',
      'fullAttendance', 'seniority', 'commission', 'otherSubsidy', 'performance',
      'socialInsurance', 'tax'];
    if (numericFields.includes(field)) {
      (tableData[index] as any)[field] = parseFloat(value) || 0;
    } else {
      (tableData[index] as any)[field] = value;
    }
  };

  // 切换月份
  (window as any).changeSalaryPeriod = (period: string) => {
    currentPeriod = period;
    tableData = [createEmptyRow(currentPeriod)];
    const container = document.getElementById('mainContent');
    if (container) renderSalary(container);
  };

  // 保存表格
  (window as any).saveSalaryTable = () => {
    const validRows = tableData.filter(r => r.employee && r.baseSalary > 0);
    if (validRows.length === 0) {
      showToast('没有有效数据');
      return;
    }
    validRows.forEach(r => r.period = currentPeriod);
    batchCreateSalaryRecords(validRows);
    showToast(`已保存 ${validRows.length} 条工资记录`);
    const container = document.getElementById('mainContent');
    if (container) renderSalary(container);
  };

  // 导入 Excel
  (window as any).importExcel = () => {
    const input = document.getElementById('salaryExcelInput') as HTMLInputElement;
    if (input) input.click();
  };

  (window as any).handleExcelImport = async (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    try {
      // 动态导入 xlsx 库
      const XLSX = await import('xlsx');
      const reader = new FileReader();
      reader.onload = (e) => {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(sheet);
        parseExcelData(jsonData);
        const container = document.getElementById('mainContent');
        if (container) renderSalary(container);
      };
      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error('Excel import error:', error);
      showToast('导入失败，请安装 xlsx 库');
    }
    input.value = '';
  };

  // AI 识图
  (window as any).importFromImage = () => {
    const input = document.getElementById('salaryImageInput') as HTMLInputElement;
    if (input) input.click();
  };

  (window as any).handleImageImport = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;
    // TODO: 调用 AI 识图 API
    showToast('AI 识图功能开发中');
    input.value = '';
  };
}

// ===== 辅助函数 =====

function createEmptyRow(period: string): CreateSalaryInput {
  return {
    period,
    department: '',
    employee: '',
    position: '',
    baseSalary: 0,
    positionSubsidy: 0,
    overtimeSubsidy: 0,
    allowance: 0,
    fullAttendance: 0,
    seniority: 0,
    commission: 0,
    otherSubsidy: 0,
    performance: 0,
    socialInsurance: 0,
    tax: 0,
  };
}

function calculateActual(row: CreateSalaryInput): number {
  const base = (row.baseSalary || 0) + (row.positionSubsidy || 0) +
    (row.overtimeSubsidy || 0) + (row.allowance || 0) +
    (row.fullAttendance || 0) + (row.seniority || 0);
  const subtotal = base + (row.commission || 0) +
    (row.otherSubsidy || 0) + (row.performance || 0);
  const deduction = (row.socialInsurance || 0) + (row.tax || 0);
  return subtotal - deduction;
}

function calculateTotals(rows: CreateSalaryInput[]) {
  const totals = {
    baseSalary: 0,
    positionSubsidy: 0,
    overtimeSubsidy: 0,
    allowance: 0,
    fullAttendance: 0,
    seniority: 0,
    commission: 0,
    otherSubsidy: 0,
    performance: 0,
    socialInsurance: 0,
    tax: 0,
    actualSalary: 0,
  };

  rows.forEach(r => {
    totals.baseSalary += r.baseSalary || 0;
    totals.positionSubsidy += r.positionSubsidy || 0;
    totals.overtimeSubsidy += r.overtimeSubsidy || 0;
    totals.allowance += r.allowance || 0;
    totals.fullAttendance += r.fullAttendance || 0;
    totals.seniority += r.seniority || 0;
    totals.commission += r.commission || 0;
    totals.otherSubsidy += r.otherSubsidy || 0;
    totals.performance += r.performance || 0;
    totals.socialInsurance += r.socialInsurance || 0;
    totals.tax += r.tax || 0;
    totals.actualSalary += calculateActual(r);
  });

  return totals;
}

function parseExcelData(jsonData: any[]): void {
  tableData = jsonData.map(row => ({
    period: currentPeriod,
    department: row['部门'] || row['department'] || '',
    employee: row['姓名'] || row['employee'] || '',
    position: row['职务'] || row['position'] || '',
    cardNo: row['卡号'] || row['cardNo'] || '',
    baseSalary: parseFloat(row['基本工资'] || row['baseSalary']) || 0,
    positionSubsidy: parseFloat(row['职务补贴'] || row['positionSubsidy']) || 0,
    overtimeSubsidy: parseFloat(row['加班补贴'] || row['overtimeSubsidy']) || 0,
    allowance: parseFloat(row['津贴'] || row['allowance']) || 0,
    fullAttendance: parseFloat(row['满勤奖'] || row['fullAttendance']) || 0,
    seniority: parseFloat(row['司龄工龄'] || row['seniority']) || 0,
    commission: parseFloat(row['提成'] || row['commission']) || 0,
    otherSubsidy: parseFloat(row['其他补助'] || row['otherSubsidy']) || 0,
    performance: parseFloat(row['绩效工资'] || row['performance']) || 0,
    socialInsurance: parseFloat(row['社保'] || row['socialInsurance']) || 0,
    tax: parseFloat(row['个税'] || row['tax']) || 0,
    note: row['备注'] || row['note'] || '',
  }));

  showToast(`已导入 ${tableData.length} 条记录`);
}

function getCurrentPeriod(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function showToast(msg: string): void {
  // @ts-ignore
  if (typeof window.toast === 'function') {
    // @ts-ignore
    window.toast(msg);
  } else {
    alert(msg);
  }
}

// 初始化全局函数
initSalaryGlobals();

export default {
  renderSalary,
};
