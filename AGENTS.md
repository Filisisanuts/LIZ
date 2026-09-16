每次都要以称呼我为栗子开头
每次我向你提出需求时，都先列出选项让我确认再动手
每次代码改好后，列出所有修改过的文件和改动摘要
中文回复我

## 项目结构

```
├── index.html              主入口（旧系统 + 新架构兼容）
├── login.html              登录/注册页（独立页面，未登录优先跳转）
├── dashboard.html          只读报表页（无需登录，直接查看经营数据）
├── onboarding.html         新手引导页（首次使用配置）
├── src/
│   ├── css/style.css       全局样式（旧系统）
│   ├── js/                 旧系统 JS 模块（19个）
│   ├── app/                新架构：应用壳、路由、状态
│   ├── features/           新架构：业务模块（9个）
│   ├── shared/             共享工具（配置、格式化、引导）
│   ├── legacy/             旧系统桥接层
│   └── styles/             CSS 分层体系
├── config/                 配置文件
├── docs/                   项目文档
├── tests/                  测试文件
├── package.json            项目配置
├── vite.config.ts          Vite 配置
└── tsconfig.json           TypeScript 配置
```

## 新旧架构并行

当前项目采用新旧并行架构：

### 旧系统（src/js/）
- 19个全局 JS 模块
- 共享全局作用域
- 无需构建，浏览器直接运行

### 新架构（src/app/ + src/features/）
- TypeScript 模块化
- Vite 构建
- 渐进迁移中

## JS 模块依赖顺序（旧系统）

index.html 中 `<script>` 标签必须严格按以下顺序加载：

1. 基础模块: `config.js` → `utils.js` → `category.js`
2. 核心模块: `search.js` → `nav.js` → `auth.js`
3. 业务模块: `dashboard.js` → `daily.js` → `purchase.js` → `expense.js` → `inventory.js` → `warehouse.js` → `damage.js` → `report.js` → `brief.js` → `settings.js`
4. 同步模块: `sync.js` → `sync-code.js`
5. 初始化: `app.js`（必须最后加载）

## 模块职责

### 旧系统模块

| 模块 | 职责 |
|------|------|
| config.js | 数据库定义、存储键名、导航配置、数据迁移 |
| utils.js | 工具函数（日期、格式化、弹窗、图片压缩） |
| nav.js | 页面路由、侧边栏动态生成（根据配置） |
| auth.js | 用户认证（Supabase Auth） |
| daily.js | 日报录入（条件渲染，根据配置显示/隐藏） |
| purchase.js | 采购管理（来源/区域从配置读取） |
| expense.js | 费用管理（分类从配置读取） |
| inventory.js | 贵重物品库存 |
| warehouse.js | 仓库管理（分类从配置读取） |
| report.js | 报表分析 |
| settings.js | 设置页（分类配置管理） |
| app.js | 应用初始化 |

### 新架构模块

| 模块 | 职责 |
|------|------|
| config-manager.ts | 统一配置管理 |
| onboarding-page.ts | 新手引导组件 |
| legacy-bridge.ts | 旧系统桥接 |
| daily-service.ts | 日报数据服务 |
| purchase-service.ts | 采购数据服务 |
| expense-service.ts | 费用数据服务 |
| inventory-service.ts | 库存数据服务 |
| warehouse-service.ts | 仓库数据服务 |
| damage-service.ts | 报损数据服务 |
| report-service.ts | 报表数据服务 |

## 配置系统

### 配置存储
- 键名格式：`ax_app_config_{用户ID}`
- 每个用户独立配置
- 配置跟随账号

### 配置项

| 配置项 | 说明 |
|--------|------|
| enabledModules | 启用的功能模块 |
| dailyLabels | 日报标签 |
| dailyFeatures | 日报功能（包厢预定、汇报人） |
| purchaseSections | 采购区域 |
| purchaseSources | 采购来源 |
| purchaseCategories | 区域-分类映射 |
| expenseCategories | 费用分类 |
| warehouseCategories | 仓库分类 |
| inventoryTypes | 贵重物品类型 |
| customInventoryTypes | 自定义贵重物品 |
| onboardingCompleted | 引导完成状态 |

### 兼容性
- **新用户**：通过引导配置
- **现有用户**：无配置，显示所有模块
- **判断逻辑**：`!config || !config.enabledModules || config.enabledModules.length === 0`

## 侧边栏分组

```
📊 日常经营（总览/日报/采购/费用）
---
💎 贵重物品（根据配置显示）
---
📦 仓库管理（仓库/报损）
---
📈 数据分析（报表/汇报）
---
⚙️ 设置
```

## 权限控制

- 未登录用户：可浏览所有只读页面，不可录入/修改数据
- 游客模式（`?guest=1`）：可查看但不可编辑
- 已登录用户：完整读写权限

## 数据同步

- Supabase 凭证内置，无需用户手动配置
- 每次保存同时写入用户行和共享行
- dashboard.html 从共享行读取，无需登录
- 配置跟随用户账号

## 开发指南

### 启动开发服务器

```bash
npm install
npm run dev
```

访问 http://localhost:5173/

### 构建生产版本

```bash
npm run build
```

### 测试配置

清除配置测试引导流程：
```javascript
localStorage.removeItem('ax_app_config');
location.reload();
```

## 注意事项

- 新旧系统并行运行，通过 Legacy Bridge 桥接
- 新模块使用 TypeScript，旧模块保持 JavaScript
- 修改旧系统模块后无需构建，浏览器直接刷新
- 修改新架构模块后需要重新构建
- 配置变更需要刷新页面才能生效
