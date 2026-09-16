/**
 * App Shell - 应用壳组件
 *
 * 提供页面基础结构：顶栏、侧边栏、页面容器。
 */

export interface AppShellConfig {
  title?: string;
  showSidebar?: boolean;
}

const defaultConfig: AppShellConfig = {
  title: '经营管理',
  showSidebar: true,
};

/**
 * 创建应用壳
 */
export function createAppShell(config: AppShellConfig = {}): HTMLElement {
  const title = config.title ?? defaultConfig.title ?? '经营管理';
  const showSidebar = config.showSidebar ?? defaultConfig.showSidebar ?? true;

  const shell = document.createElement('div');
  shell.className = 'app-shell';

  // 侧边栏
  if (showSidebar) {
    const sidebar = createSidebar(title);
    shell.appendChild(sidebar);
  }

  // 主内容区
  const mainContent = document.createElement('main');
  mainContent.className = 'main-content';
  mainContent.id = 'mainContent';
  shell.appendChild(mainContent);

  return shell;
}

/**
 * 创建侧边栏
 */
function createSidebar(title: string): HTMLElement {
  const sidebar = document.createElement('aside');
  sidebar.className = 'sidebar';
  sidebar.id = 'sidebar';

  // Logo
  const logo = document.createElement('div');
  logo.className = 'sidebar-logo';
  logo.innerHTML = `
    <div style="font-size: 1.2rem; font-weight: 700; color: var(--color-primary); letter-spacing: 0.04em;">
      ${title}
    </div>
    <div style="font-size: 0.65rem; font-weight: 500; color: var(--color-text-muted); letter-spacing: 0.1em; margin-top: 2px;">
      COFFEE
    </div>
  `;
  sidebar.appendChild(logo);

  // 导航
  const nav = document.createElement('nav');
  nav.className = 'sidebar-nav';
  nav.id = 'sidebarNav';
  sidebar.appendChild(nav);

  return sidebar;
}

/**
 * 渲染侧边栏导航
 */
export function renderSidebarNav(items: NavItem[]): void {
  const nav = document.getElementById('sidebarNav');
  if (!nav) return;

  nav.innerHTML = items
    .map((item) => {
      if (item.separator) {
        return '<div class="sidebar-divider"></div>';
      }
      return `
        <button class="sidebar-nav-item" data-page="${item.id}">
          <span class="sidebar-nav-icon">${item.icon}</span>
          <span class="sidebar-nav-label">${item.label}</span>
        </button>
      `;
    })
    .join('');
}

export interface NavItem {
  id?: string;
  label?: string;
  icon?: string;
  separator?: boolean;
}

export default {
  createAppShell,
  renderSidebarNav,
};
