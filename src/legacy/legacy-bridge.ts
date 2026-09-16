/**
 * Legacy Bridge - 旧系统桥接层
 *
 * 新模块通过此桥接层访问旧系统的数据和功能，
 * 不直接操作 window.DB 或调用全局函数。
 *
 * 随着迁移完成，此文件将逐步删除。
 */

// 旧系统全局类型声明
declare global {
  interface Window {
    DB: any;
    loadDB: () => any;
    saveDB: (db: any) => void;
    goPage: (page: string) => void;
    showAddPur: () => void;
    upd: (fn: (db: any) => void) => void;
    fmtC: (n: number) => string;
    fmt: (n: number) => string;
    fmtP: (n: number) => string;
    td: () => string;
    curYM: () => string;
    getMR: (ym: string) => any[];
    invCalc: (item: any, type: string, ym: string) => any;
    invCalcMon: (item: any, type: string, ym: string) => any;
  }
}

/**
 * Legacy Bridge 提供对旧系统的类型安全访问
 */
export const legacyBridge = {
  /**
   * 获取当前数据库实例
   */
  getDatabase(): any {
    return window.DB;
  },

  /**
   * 保存数据库
   */
  saveDatabase(db: any): void {
    window.saveDB(db);
  },

  /**
   * 执行更新操作（自动保存和同步）
   */
  update(fn: (db: any) => void): void {
    window.upd(fn);
  },

  /**
   * 导航到指定页面
   */
  navigateToPage(page: string): void {
    window.goPage(page);
  },

  /**
   * 打开采购编辑器
   */
  openPurchaseEditor(): void {
    window.showAddPur();
  },

  /**
   * 获取今日日期
   */
  getToday(): string {
    return window.td();
  },

  /**
   * 获取当前年月
   */
  getCurrentYearMonth(): string {
    return window.curYM();
  },

  /**
   * 获取月度报告
   */
  getMonthlyReports(yearMonth: string): any[] {
    return window.getMR(yearMonth);
  },

  /**
   * 格式化货币
   */
  formatCurrency(n: number): string {
    return window.fmtC(n);
  },

  /**
   * 格式化数字
   */
  formatNumber(n: number): string {
    return window.fmt(n);
  },

  /**
   * 格式化百分比
   */
  formatPercent(n: number): string {
    return window.fmtP(n);
  },

  /**
   * 计算库存（期初结存）
   */
  calculateInventory(item: any, type: string, yearMonth: string): any {
    return window.invCalc(item, type, yearMonth);
  },

  /**
   * 计算月度库存统计
   */
  calculateMonthlyInventory(item: any, type: string, yearMonth: string): any {
    return window.invCalcMon(item, type, yearMonth);
  },
};

export default legacyBridge;
