/**
 * App State - 最小全局 UI 状态
 *
 * 管理全局 UI 状态，如当前页面、加载状态等。
 * 不存储业务数据，业务数据通过 Legacy Bridge 从旧系统读取。
 */

export interface AppState {
  currentPage: string;
  isLoading: boolean;
  isSidebarOpen: boolean;
  isDarkMode: boolean;
}

type StateListener = (state: AppState) => void;

class AppStateManager {
  private state: AppState = {
    currentPage: 'dash',
    isLoading: false,
    isSidebarOpen: false,
    isDarkMode: false,
  };

  private listeners: Set<StateListener> = new Set();

  /**
   * 获取当前状态
   */
  getState(): Readonly<AppState> {
    return this.state;
  }

  /**
   * 更新状态
   */
  setState(partial: Partial<AppState>): void {
    this.state = { ...this.state, ...partial };
    this.notifyListeners();
  }

  /**
   * 订阅状态变化
   */
  subscribe(listener: StateListener): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * 通知监听器
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this.state));
  }

  /**
   * 切换侧边栏
   */
  toggleSidebar(): void {
    this.setState({ isSidebarOpen: !this.state.isSidebarOpen });
  }

  /**
   * 设置当前页面
   */
  setCurrentPage(page: string): void {
    this.setState({ currentPage: page });
  }

  /**
   * 设置加载状态
   */
  setLoading(loading: boolean): void {
    this.setState({ isLoading: loading });
  }
}

// 创建单例
export const appState = new AppStateManager();

/**
 * 初始化应用状态
 */
export function initAppState(): AppStateManager {
  // 检测深色模式
  const isDarkMode = window.matchMedia('(prefers-color-scheme: dark)').matches;
  appState.setState({ isDarkMode });

  // 监听系统深色模式变化
  window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => {
    appState.setState({ isDarkMode: e.matches });
  });

  return appState;
}

export default appState;
