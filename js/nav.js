// 控制页面导航和切换

// 当前所在页面
var _curPage = 'dash';

// ---------- 渲染导航栏 ----------
// 根据 NAV 配置生成导航按钮，高亮当前页
// ------ 页面路由 ------

function goPage(name) {
    console.log('goPage called:', name);
    _curPage = name;
    localStorage.setItem('ax_lastPage', name);
    document.querySelectorAll('.toolbar-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.page === name);
    });

    // 移动端自动收起侧边栏
    var toolbar = $id('toolbar');
    if (toolbar && toolbar.classList.contains('open')) {
        toolbar.classList.remove('open');
        $id('toolbarMask').classList.remove('open');
        document.body.style.overflow = '';
    }

    var icons = {
        dash: '📊', daily: '📝', purchase: '🛒', expense: '💰',
        damage: '📦', tea: '🍵', cig: '🚬', alc: '🍺', other: '💎', wh: '🏪',
        report: '📈', gen: '📤',  settings: '⚙️'
    };

    switch (name) {
        case 'dash':      rDash(); break;
        case 'daily':     rDaily(); break;
        case 'purchase':  rPurchase(); break;
        case 'expense':   rExpense(); break;
        case 'damage':    rDamage(); break;
        case 'tea':       rInv('tea'); break;
        case 'cig':       rInv('cig'); break;
        case 'alc':       rInv('alc'); break;
        case 'other':     rInv('other'); break;
        case 'wh':        rWH(); break;
        case 'report':    rReport(); break;
        case 'gen':       rGen(); break;
        case 'settings':  rData(); break;
        default:          rDash(); break;
    }
}

// ------ 侧边栏生成 ------

function renderNav() {
    var mainPages = [
        { id: 'dash',     icon: '📊', label: '总览' },
        { id: 'daily',    icon: '📝', label: '日报' },
        { id: 'purchase', icon: '🛒', label: '采购' },
        { id: 'expense',  icon: '💰', label: '费用' },
        { id: 'damage',   icon: '📦', label: '报损' }
    ];
    var invPages = [
        { id: 'tea', icon: '🍵', label: '茗茶' },
        { id: 'cig', icon: '🚬', label: '香烟' },
        { id: 'alc', icon: '🍺', label: '酒类' },
        { id: 'other', icon: '💎', label: '贵重' },
        { id: 'wh',  icon: '🏪', label: '仓库' }
    ];
    var reportPages = [
        { id: 'report', icon: '📈', label: '报告' },
        { id: 'gen',    icon: '📤', label: '汇报' },
    ];
    function renderGroup(pages, containerId) {
        var el = $id(containerId);
        if (!el) return;
        el.innerHTML = pages.map(function(p) {
            return '<button class="toolbar-btn" data-page="' + p.id + '" onclick="goPage(\'' + p.id + '\')" title="' + p.label + '">' +
                '<span class="ticon">' + p.icon + '</span>' +
                '<span class="tlabel">' + p.label + '</span>' +
                '</button>';
        }).join('');
    }

    renderGroup(mainPages, 'toolbarMain');
    renderGroup(invPages, 'toolbarInv');
    renderGroup(reportPages, 'toolbarReport');

    var active = $id('toolbarMain').querySelector('.toolbar-btn');
    if (active) active.classList.add('active');
}

// 切换高亮
function switchNav(btn) {
    document.querySelectorAll('.toolbar-btn').forEach(function(b) {
        b.classList.remove('active');
    });
    btn.classList.add('active');
}

// 更新悬浮导航栏的子标签
function updateFnavTabs(page) {
  var tabs = {
    home:     ['概览', '日报', '采购'],
    tea:      ['库存', '明细'],
    cig:      ['库存', '明细'],
    alc:      ['库存', '明细'],
    report:   ['利润表', '营收', '成本', '毛利']
  };

  var tabList = tabs[page];
  var el = $id('fnavTabs');
  if (!tabList || !tabList.length) { el.innerHTML = ''; return; }

  el.innerHTML = tabList.map(function(t, i) {
    return '<button class="fnav-tab' + (i === 0 ? ' active' : '') + '" onclick="fnavTabClick(this,\'' + page + '\',' + i + ')">' + t + '</button>';
  }).join('');
}

function fnavTabClick(btn, page, idx) {
  $id('fnavTabs').querySelectorAll('.fnav-tab').forEach(function(t) { t.classList.remove('active'); });
  btn.classList.add('active');

  // 如果页面内有子标签栏，同步切换
  var tabBtns = $id('mainContent').querySelectorAll('.tab-bar .tab-btn, .tab-bar button');
  if (tabBtns[idx]) tabBtns[idx].click();
}

// 切换侧边栏展开/收起
function toggleToolbar() {
    var toolbar = $id('toolbar');
    var mask = $id('toolbarMask');
    toolbar.classList.toggle('open');
    mask.classList.toggle('open');
    document.body.style.overflow = toolbar.classList.contains('open') ? 'hidden' : '';
}

// ---------- 刷新当前页面（同步后调用）----------
function renderPage(page) {
    console.log('renderPage called:', page);
    page = page || _curPage || 'dash';
    _curPage = page;
    var fn = {
        'dash': rDash,
        'daily': rDaily,
        'purchase': rPurchase,
        'expense': rExpense,
        'tea': function() { rInv('tea'); },
        'cig': function() { rInv('cig'); },
        'alc': function() { rInv('alc'); },
        'other': function() { rInv('other'); },
        'wh': rWH,
        'damage': rDamage,
        'report': rReport,
        'gen': rGen,
        'data': rData
    }[page];
    if (fn) fn();
    updateNav(page);
}

// ---------- 更新导航按钮高亮 ----------
function updateNav(p) {
    document.querySelectorAll('.nav-item').forEach(function(el) {
        el.classList.toggle('active', el.dataset.page === p);
    });
}

// ---------- 设置主内容区 ----------
// 所有页面渲染时调用，设置标题和内容
function setMain(t, c) {
    $id('mainContent').innerHTML = '<div class="page-title">' + t + '</div><div class="page active">' + c + '</div>';
    window.scrollTo(0, 0);
}


