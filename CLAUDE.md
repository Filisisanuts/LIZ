每次都要以称呼我为栗子开头
每次我向你提出需求时，都先列出选项让我确认再动手
每次代码改好后，列出所有修改过的文件和改动摘要
反复进行某项操作超过3次时，停下来向我确认方向是否正确

## 工作区说明

**主工作区：** `D:\ax-coffee\LIZ`
- 所有代码修改都在此文件夹进行
- GitHub仓库：https://github.com/Filisisanuts/LIZ

**备份位置：** `D:\ax-coffee`（原文件已移至备份文件夹）

**推送流程：**
```bash
cd D:\ax-coffee\LIZ
git add .
git commit -m "更新说明"
git push
```

## 项目结构

```
├── index.html              主入口（HTML结构 + 引用CSS/JS）
├── login.html              登录/注册页（独立页面，未登录优先跳转）
├── dashboard.html          只读报表页（无需登录，直接查看经营数据）
├── css/
│   └── style.css           全局样式
└── js/                     功能模块（19个）
```

## JS 模块依赖顺序

index.html 中 `<script>` 标签必须严格按以下顺序加载：

1. 基础模块: `config.js` → `utils.js` → `category.js`
2. 核心模块: `search.js` → `nav.js` → `auth.js`
3. 业务模块: `dashboard.js` → `daily.js` → `purchase.js` → `expense.js` → `inventory.js` → `warehouse.js` → `damage.js` → `report.js` → `brief.js` → `settings.js`
4. 同步模块: `sync.js` → `sync-code.js`
5. 初始化: `app.js`（必须最后加载）

## 模块职责

| 模块 | 职责 |
|------|------|
| config.js | 数据库定义、存储键名、导航配置、默认配置、数据迁移、设置同步（_syncSetting/restoreSettings） |
| utils.js | 工具函数（日期、格式化、弹窗、Toast、图片压缩、日期/月份选择器） |
| category.js | 采购分类管理（区域分类、下拉联动、自定义输入） |
| search.js | 全局搜索（日报/采购/仓库/费用，防抖模糊匹配） |
| nav.js | 页面路由 goPage()、侧边栏渲染、悬浮导航栏、页面切换 |
| auth.js | 用户认证（Supabase Auth 登录/注册/登出、登录弹窗、游客模式） |
| dashboard.js | 总览仪表盘（昨日日报、月累计、采购成本、贵重物品、7日趋势图） |
| daily.js | 日报录入（营收、外卖、客流、自由行、备注） |
| purchase.js | 采购管理（手动录入、AI拍照识别、日历视图、退货） |
| expense.js | 费用管理（记录、分类、照片附件） |
| inventory.js | 贵重物品库存（茗茶/香烟/酒类/其他，简单成本计算、入库/销售、结转、退货、明细） |
| warehouse.js | 仓库管理（通用物资库存、安全库存预警） |
| damage.js | 报损管理（记录报损、照片附件） |
| report.js | 报表（利润表、营收分析、成本分析、毛利分析、每日营收、客情包厢、左右布局） |
| brief.js | 汇报生成（AI辅助生成经营汇报文本） |
| settings.js | 设置页（用户账号/资料编辑、店铺信息、主题字体、MiMo配置、云同步、分享报表链接、数据导入导出） |
| sync.js | Supabase 云同步（内置凭证、用户数据+共享行双写、防抖保存） |
| sync-code.js | 离线同步码（生成/导入 Base64 编码数据） |
| app.js | 应用初始化（启动流程、工具栏渲染、认证初始化、店铺名动态显示、Chart.js 加载） |

## 权限控制

- 未登录用户：可浏览所有只读页面，不可录入/修改数据
- 游客模式（`?guest=1`）：可查看但不可编辑，显示提示条，隐藏危险操作按钮
- 已登录用户：完整读写权限
- `upd()` 函数会自动检查登录状态，未登录时弹出登录框
- `requireAuth()` 可在任何写操作前手动调用

## 店铺信息

- 店名、图标、副标题可在设置页编辑，存储在 `DB.settings` 并云端同步
- 动态显示在：页面标题、侧边栏 logo、导航栏标题、登录弹窗、报表抬头、汇报/费用报告页脚
- 未设置时默认显示「经营管理」

## 数据同步

- Supabase 凭证内置在 `sync.js`，无需用户手动配置
- 每次保存数据时同时写入两行：用户自己的行（`用户ID`）+ 共享行（`shop_data`）
- dashboard.html 从共享行 `shop_data` 读取数据，无需登录
- 设置（字体/字号/主题/MiMo配置等）也随 `DB.settings` 云端同步

## 注意事项

- 所有模块共享全局作用域，函数和变量通过 window 直接互访
- 修改模块后无需构建，浏览器直接打开 index.html 即可运行
- 新增模块时需同时在 index.html 中添加 `<script>` 引用，并确保插入到依赖链的正确位置
- 数据存储在 localStorage（键名 `ax_cafe_v8`），云同步和认证走 Supabase
- ⚠️ **修改数据后必须调用 `sbScheduleSave()` 触发云同步**，否则其他设备看不到更新
  - `saveDB(DB)` 只保存到本地
  - `sbScheduleSave()` 触发云同步到Supabase
  - 使用 `upd()` 函数会自动调用两者
- ⚠️ **绝对禁止调用 `saveDB()` 而不传参数**
  - 必须写 `saveDB(DB)`，不能写 `saveDB()`
  - 如果不传参数，`JSON.stringify(undefined)` 会存储 `"undefined"` 字符串
  - 下次页面加载时 `JSON.parse("undefined")` 失败，返回空数据库
  - **会导致所有数据永久丢失！**
- 库存类型共4种：茗茶（tea）、香烟（cig）、酒类（alc）、其他贵重物品（other），other 支持三种计算模式（简单/按克/按包）
- 库存退货在采购中以负数 qty 存储，`invCalc` 会自动扣减结存
- 每月跨月时自动触发期初结转，所有库存商品逐个弹窗确认，可编辑结存数量
- **结存计算方式**：简单公式 `当月期初 + 当月入库 - 当月销售`，直接使用 invCalc() 函数
- **成本计算方式**：简单公式 `销售数量 × 单位成本`
  - 茗茶：`售出杯数×每杯成本 + 售出壶数×每壶成本`
  - 香烟/酒类：`销售数量 × 单位成本`
- 报表页面使用 `.rep-grid` 左右布局（左数据表+右图表），`.rep-grid-wide` 为宽表格比例（1:0.7），768px 以下强制变单栏（flex-direction:column）
- CSS 通过 `style.css?v=版本号` 强制刷新缓存，每次修改 CSS 后递增版本号（如 v=2 → v=3）

## 代码修改后测试流程

每次修改代码后，需要：

1. **在浏览器中手动测试**
   - 打开 `index.html` 或 `login.html` 检查页面加载
   - 测试修改的功能是否正常工作
   - 检查控制台是否有报错

2. **使用自动化测试（可选）**
   ```bash
   # 启动本地服务器
   python -m http.server 8080 &
   
   # 运行测试脚本
   python test_app.py
   ```

3. **测试检查清单**
   - [ ] 页面正常加载，无明显错误
   - [ ] 功能逻辑正确（按钮、表单、计算等）
   - [ ] 样式显示正常（字体、颜色、间距）
   - [ ] 响应式布局在不同屏幕尺寸下正常
   - [ ] localStorage 数据操作正常

4. **确认无误后再提交代码**
   - 所有测试通过后才推送
   - 在 commit message 中说明修改内容
