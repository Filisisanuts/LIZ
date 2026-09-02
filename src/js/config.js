// 存储键名
var STORE = 'ax_cafe_v8';

// 库存类型配置（茗茶/香烟/酒类/其他），提前定义避免引用报错
var INV = {
    tea: { label: '茗茶', key: 'teaItems' },
    cig: { label: '香烟', key: 'cigItems' },
    alc: { label: '酒类', key: 'alcItems' },
    other: { label: '贵重物品', key: 'otherItems' }
};

// 导航配置
var NAV = [
    { id: 'dash',label: '总览',icon: '📊'},
    { id: 'daily',label: '日报',icon: '📝'},
    { id: 'purchase',label: '采购',icon: '🛒'},
    { id: 'expense',label: '费用',icon: '💰'},
    { sep: true },
    { id: 'tea',label: '茗茶',icon: '🍵'},
    { id: 'cig',label: '香烟',icon: '🚬'},
    { id: 'alc',label: '酒类',icon: '🍺'},
    { id: 'other',label: '贵重',icon: '💎'},
    { sep: true },
    { id: 'wh',label: '仓库',icon: '📦'},
    { id: 'damage',label: '报损',icon: '⚠️'},
    { sep: true },
    { id: 'report',label: '报表',icon: '📈'},
    { id: 'gen',label: '汇报',icon: '📄'}
];

// 数据库初始化模板
function initDB() {
    return { dailyReports:[],purchases:[],expenses:[],teaItems:[],cigItems:[],alcItems:[],otherItems:[],areaCats:{},aiHistory:[],whItems:[],damageRecords:[],exchangeRecords:[],settings:{} };
}

// 默认配置
var DEFAULT_CONFIG = {
    github_token:'',github_gist_id:'',
    mimo_endpoint:'https://api.mimo.com/v1/chat/completions',
    mimo_key:'',mimo_model:'mimo-v2.5'
};

function initConfig() {
    if(!localStorage.getItem('ax_mimo_ep')) localStorage.setItem('ax_mimo_ep',DEFAULT_CONFIG.mimo_endpoint);
    if(!localStorage.getItem('ax_mimo_key')) localStorage.setItem('ax_mimo_key',DEFAULT_CONFIG.mimo_key);
    if(!localStorage.getItem('ax_mimo_model')) localStorage.setItem('ax_mimo_model',DEFAULT_CONFIG.mimo_model);
    if(DEFAULT_CONFIG.github_token && !localStorage.getItem('ax_gh_token')) localStorage.setItem('ax_gh_token',DEFAULT_CONFIG.github_token);
    if(DEFAULT_CONFIG.github_gist_id && !localStorage.getItem('ax_gh_gist_id')) localStorage.setItem('ax_gh_gist_id',DEFAULT_CONFIG.github_gist_id);
}

// 数据迁移：区域分类
function migrateAreaCats() {
    if(DB.areaCats && Object.keys(DB.areaCats).length>0) return;
    DB.areaCats={};
    DB.purchases.forEach(function(p){(p.items||[]).forEach(function(item){var area=item.section||'';var cat=item.category||'';if(area&&cat){if(!DB.areaCats[area])DB.areaCats[area]=[];if(DB.areaCats[area].indexOf(cat)<0)DB.areaCats[area].push(cat)}})});
    var defaults={"厨房":["调料/粮油","食材","茶叶/干货"],"吧台":["饮品","耗材"],"外场":["清洁","包装","设备"]};
    Object.keys(defaults).forEach(function(a){if(!DB.areaCats[a]||!DB.areaCats[a].length)DB.areaCats[a]=defaults[a]});
    saveDB(DB);
}

// 数据读写
function loadDB(){try{var d=JSON.parse(localStorage.getItem(STORE));return d&&d.dailyReports?d:initDB()}catch(e){return initDB()}}
function saveDB(d){localStorage.setItem(STORE,JSON.stringify(d))}
var DB=loadDB();

// 通用更新方法：执行回调 → 保存 → 触发云同步（需登录）
function upd(fn){if(typeof requireAuth==='function'&&!requireAuth())return;fn(DB);DB._ts=Date.now();saveDB(DB);sbScheduleSave()}

// 设置同步：同时写 localStorage 和 DB.settings，触发云同步
function _syncSetting(key, val) {
    localStorage.setItem(key, val);
    if (!DB.settings) DB.settings = {};
    DB.settings[key] = val;
    DB._ts = Date.now();
    saveDB(DB);
    sbScheduleSave();
}

// 从 DB.settings 恢复设置到 localStorage（云端数据优先）
function restoreSettings() {
    if (!DB.settings) return;
    var keys = ['ax_mimo_ep','ax_mimo_key','ax_mimo_model','ax_fs','ax_radius','ax_spacing',
        'ax_font_heading','ax_font_body','ax_font_number','ax_theme','ax_fl',
        'ax_shop_name','ax_shop_icon','ax_shop_sub'];
    keys.forEach(function(k) {
        if (DB.settings[k] !== undefined && DB.settings[k] !== null && DB.settings[k] !== '') {
            localStorage.setItem(k, String(DB.settings[k]));
        }
    });
    applyTheme(); applyFonts(); applySpacing();
    var savedFS = localStorage.getItem('ax_fs');
    if (savedFS) document.documentElement.style.fontSize = savedFS + 'px';
    var savedR = localStorage.getItem('ax_radius');
    if (savedR) document.documentElement.style.setProperty('--r', savedR + 'px');
}
