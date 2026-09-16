/**
 * Currency Format - 货币格式化工具
 *
 * 提供统一的货币格式化函数。
 */

/**
 * 格式化货币数值
 *
 * @param value - 数值
 * @param options - 配置选项
 * @returns 格式化后的字符串
 */
export function formatCurrency(
  value: number,
  options: {
    symbol?: string;
    decimals?: boolean;
    locale?: string;
  } = {}
): string {
  const { symbol = '¥', decimals = false, locale = 'zh-CN' } = options;

  const formatted = new Intl.NumberFormat(locale, {
    minimumFractionDigits: decimals ? 2 : 0,
    maximumFractionDigits: decimals ? 2 : 0,
  }).format(value);

  return `${symbol}${formatted}`;
}

/**
 * 格式化百分比
 *
 * @param value - 数值（如 0.85 表示 85%）
 * @param decimals - 小数位数
 * @returns 格式化后的字符串
 */
export function formatPercent(value: number, decimals: number = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * 格式化数字（带千分位）
 *
 * @param value - 数值
 * @param decimals - 小数位数
 * @returns 格式化后的字符串
 */
export function formatNumber(value: number, decimals: number = 0): string {
  return new Intl.NumberFormat('zh-CN', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(value);
}

export default {
  formatCurrency,
  formatPercent,
  formatNumber,
};
