/**
 * 连接旧系统图标字典，供渐进迁移中的 TypeScript 页面复用。
 */
export type IconName =
  | 'dashboard' | 'notebook' | 'basket' | 'receipt' | 'wallet'
  | 'leaf' | 'package' | 'wine' | 'gem' | 'warehouse' | 'alert'
  | 'chart' | 'trend' | 'calendar' | 'calendarRange' | 'fileDownload' | 'tag'
  | 'send' | 'sliders' | 'menu' | 'user' | 'cloudCheck';

declare global {
  interface Window {
    axIcon?: (name: IconName, className?: string) => string;
  }
}

export function renderIcon(name: IconName, className = ''): string {
  return window.axIcon ? window.axIcon(name, className) : '';
}
