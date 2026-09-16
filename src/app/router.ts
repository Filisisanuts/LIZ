/**
 * Router - 简单的 Hash 路由
 *
 * 基于 URL hash 实现页面切换，与旧系统的 goPage 兼容。
 */

export type RouteHandler = () => void | Promise<void>;

export interface Route {
  path: string;
  handler: RouteHandler;
}

class Router {
  private routes: Map<string, RouteHandler> = new Map();
  private currentRoute: string = '';
  private fallbackHandler: RouteHandler | null = null;

  constructor() {
    // 监听 hash 变化
    window.addEventListener('hashchange', () => this.handleRoute());
  }

  /**
   * 注册路由
   */
  on(path: string, handler: RouteHandler): this {
    this.routes.set(path, handler);
    return this;
  }

  /**
   * 设置默认路由（当路径不匹配时）
   */
  fallback(handler: RouteHandler): this {
    this.fallbackHandler = handler;
    return this;
  }

  /**
   * 导航到指定路径
   */
  navigate(path: string): void {
    window.location.hash = path;
  }

  /**
   * 获取当前路由
   */
  getCurrentRoute(): string {
    return this.currentRoute;
  }

  /**
   * 处理路由变化
   */
  private handleRoute(): void {
    const hash = window.location.hash.slice(1) || '/';
    const path = hash.startsWith('/') ? hash : `/${hash}`;

    this.currentRoute = path;

    const handler = this.routes.get(path);
    if (handler) {
      handler();
    } else if (this.fallbackHandler) {
      this.fallbackHandler();
    }

    // 更新侧边栏激活状态
    this.updateActiveNav(path);
  }

  /**
   * 更新侧边栏激活状态
   */
  private updateActiveNav(path: string): void {
    const navItems = document.querySelectorAll('.sidebar-nav-item');
    navItems.forEach((item) => {
      const page = item.getAttribute('data-page');
      if (page) {
        const isActive = path === `/${page}` || path.startsWith(`/${page}/`);
        item.classList.toggle('active', isActive);
      }
    });
  }

  /**
   * 启动路由
   */
  start(): void {
    this.handleRoute();
  }
}

// 创建单例
export const router = new Router();

/**
 * 初始化路由
 */
export function initRouter(): Router {
  return router;
}

export default router;
