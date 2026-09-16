/**
 * Salary Service - 工资数据服务
 *
 * 负责工资记录的增删改查和统计。
 */

import legacyBridge from '@/legacy/legacy-bridge';

// ===== 类型定义 =====

export interface SalaryRecord {
  id: string;
  date: string;           // 日期
  period: string;         // 所属月份 YYYY-MM
  department: string;     // 部门
  employee: string;       // 员工姓名
  position: string;       // 职务
  cardNo: string;         // 卡号

  // 基本工资项目
  baseSalary: number;     // 基本工资
  positionSubsidy: number; // 职务补贴
  overtimeSubsidy: number; // 加班补贴
  allowance: number;      // 津贴
  fullAttendance: number; // 满勤奖
  seniority: number;      // 司龄工龄

  // 计算得出
  baseTotal: number;      // 应付合计（基本工资项目之和）

  // 其他工资项目
  commission: number;     // 提成
  otherSubsidy: number;   // 其他补助
  performance: number;    // 绩效工资

  // 计算得出
  subtotal: number;       // 应付小计

  // 扣款项目
  socialInsurance: number; // 社保
  tax: number;            // 个税

  // 计算得出
  totalDeduction: number; // 应扣合计
  actualSalary: number;   // 实发工资

  note: string;           // 备注
}

export interface CreateSalaryInput {
  date?: string;
  period: string;
  department: string;
  employee: string;
  position: string;
  cardNo?: string;

  baseSalary: number;
  positionSubsidy?: number;
  overtimeSubsidy?: number;
  allowance?: number;
  fullAttendance?: number;
  seniority?: number;

  commission?: number;
  otherSubsidy?: number;
  performance?: number;

  socialInsurance?: number;
  tax?: number;

  note?: string;
}

export interface MonthlySalaryStats {
  employeeCount: number;
  totalBase: number;
  totalCommission: number;
  totalPerformance: number;
  totalActual: number;
}

export interface DepartmentSalary {
  department: string;
  records: SalaryRecord[];
  subtotal: number;
}

// ===== 辅助函数 =====

/**
 * 计算工资各项合计
 */
export function calculateSalary(input: CreateSalaryInput): {
  baseTotal: number;
  subtotal: number;
  totalDeduction: number;
  actualSalary: number;
} {
  const baseTotal = (input.baseSalary || 0) + (input.positionSubsidy || 0) +
    (input.overtimeSubsidy || 0) + (input.allowance || 0) +
    (input.fullAttendance || 0) + (input.seniority || 0);

  const subtotal = baseTotal + (input.commission || 0) +
    (input.otherSubsidy || 0) + (input.performance || 0);

  const totalDeduction = (input.socialInsurance || 0) + (input.tax || 0);

  const actualSalary = subtotal - totalDeduction;

  return { baseTotal, subtotal, totalDeduction, actualSalary };
}

// ===== 服务函数 =====

/**
 * 获取所有工资记录
 */
export function getSalaryRecords(): SalaryRecord[] {
  const db = legacyBridge.getDatabase();
  return db?.salaryRecords || [];
}

/**
 * 获取指定月份的工资记录
 */
export function getMonthlySalaryRecords(period: string): SalaryRecord[] {
  return getSalaryRecords().filter((r) => r.period === period);
}

/**
 * 批量创建工资记录
 */
export function batchCreateSalaryRecords(inputs: CreateSalaryInput[]): SalaryRecord[] {
  const records: SalaryRecord[] = [];
  const today = getToday();

  inputs.forEach((input) => {
    const calc = calculateSalary(input);
    const record: SalaryRecord = {
      id: `sal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      date: input.date || today,
      period: input.period,
      department: input.department,
      employee: input.employee,
      position: input.position,
      cardNo: input.cardNo || '',
      baseSalary: input.baseSalary || 0,
      positionSubsidy: input.positionSubsidy || 0,
      overtimeSubsidy: input.overtimeSubsidy || 0,
      allowance: input.allowance || 0,
      fullAttendance: input.fullAttendance || 0,
      seniority: input.seniority || 0,
      baseTotal: calc.baseTotal,
      commission: input.commission || 0,
      otherSubsidy: input.otherSubsidy || 0,
      performance: input.performance || 0,
      subtotal: calc.subtotal,
      socialInsurance: input.socialInsurance || 0,
      tax: input.tax || 0,
      totalDeduction: calc.totalDeduction,
      actualSalary: calc.actualSalary,
      note: input.note || '',
    };
    records.push(record);
  });

  legacyBridge.update((db) => {
    if (!db.salaryRecords) db.salaryRecords = [];
    // 删除该月份的旧记录，重新保存
    db.salaryRecords = db.salaryRecords.filter((r: SalaryRecord) => r.period !== inputs[0]?.period);
    db.salaryRecords.push(...records);
  });

  return records;
}

/**
 * 创建单条工资记录
 */
export function createSalaryRecord(input: CreateSalaryInput): SalaryRecord {
  const records = batchCreateSalaryRecords([input]);
  return records[0];
}

/**
 * 删除工资记录
 */
export function deleteSalaryRecord(id: string): void {
  legacyBridge.update((db) => {
    db.salaryRecords = (db.salaryRecords || []).filter((r: SalaryRecord) => r.id !== id);
  });
}

/**
 * 清空指定月份的工资记录
 */
export function clearMonthlySalaryRecords(period: string): void {
  legacyBridge.update((db) => {
    db.salaryRecords = (db.salaryRecords || []).filter((r: SalaryRecord) => r.period !== period);
  });
}

/**
 * 获取月度工资统计
 */
export function getMonthlySalaryStats(period: string): MonthlySalaryStats {
  const records = getMonthlySalaryRecords(period);

  const employees = new Set<string>();
  let totalBase = 0;
  let totalCommission = 0;
  let totalPerformance = 0;
  let totalActual = 0;

  records.forEach((r) => {
    employees.add(r.employee);
    totalBase += r.baseTotal;
    totalCommission += r.commission;
    totalPerformance += r.performance;
    totalActual += r.actualSalary;
  });

  return {
    employeeCount: employees.size,
    totalBase,
    totalCommission,
    totalPerformance,
    totalActual,
  };
}

/**
 * 获取按部门分组的工资统计
 */
export function getDepartmentSalaryStats(period: string): DepartmentSalary[] {
  const records = getMonthlySalaryRecords(period);
  const deptMap: Record<string, SalaryRecord[]> = {};

  records.forEach((r) => {
    const dept = r.department || '未分类';
    if (!deptMap[dept]) deptMap[dept] = [];
    deptMap[dept].push(r);
  });

  return Object.entries(deptMap).map(([department, recs]) => ({
    department,
    records: recs,
    subtotal: recs.reduce((sum, r) => sum + r.actualSalary, 0),
  }));
}

/**
 * 获取部门列表
 */
export function getDepartmentList(): string[] {
  const records = getSalaryRecords();
  const departments = new Set<string>();
  records.forEach((r) => departments.add(r.department));
  return Array.from(departments);
}

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default {
  getSalaryRecords,
  getMonthlySalaryRecords,
  batchCreateSalaryRecords,
  createSalaryRecord,
  deleteSalaryRecord,
  clearMonthlySalaryRecords,
  getMonthlySalaryStats,
  getDepartmentSalaryStats,
  getDepartmentList,
  calculateSalary,
};
