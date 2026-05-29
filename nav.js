// nav.js - 导航、搜索、分类管理

// ==================== 3. 搜索模块 ====================
// 搜索栏开关状态
var _searchOpen = false;
// 搜索防抖定时器
var _searchTimer = null;

// ---------- 切换搜索栏显示/隐藏 ----------
function toggleSearch() {
    _searchOpen = !_searchOpen;
    $id('searchBar').classList.toggle('show', _searchOpen);
    if (_searchOpen) {
        // 展开时自动聚焦输入框
        $id('searchIn').focus();
    } else {
        // 关闭时清空搜索结果
        $id('searchResults').innerHTML = '';
    }
}

// ---------- 搜索防抖（延迟180ms）----------
function scheduleSearch() {
    if (_searchTimer) clearTimeout(_searchTimer);
    _searchTimer = setTimeout(doSearch, 180);
}

// ---------- 执行搜索 ----------
function doSearch() {
    var q = ($id('searchIn').value || '').trim().toLowerCase();
    var el = $id('searchResults');

    if (!q) {
        el.innerHTML = '';
        return;
    }

    var h = '';

    // 搜索日报
    var dr = [];
    DB.dailyReports.forEach(function(r) {
        if (r.date.indexOf(q) >= 0 || (r.reporter || '').toLowerCase().indexOf(q) >= 0) {
            dr.push(r);
        }
    });

    if (dr.length) {
        h += '<div class="sec">日报 (' + dr.length + ')</div>';
        dr.slice(0, 8).forEach(function(r) {
            h += '<div class="item-card" style="cursor:pointer" onclick="goPage(\'daily\')">';
            h += '<span class="name">' + r.date + '</span>';
            h += '<div class="nums"><span>实收<b>' + fmtC(r.revenue.netSales) + '</b></span></div>';
            h += '</div>';
        });
    }

    // 搜索采购
    var pur = [];
    DB.purchases.forEach(function(p) {
        if (p.date.indexOf(q) >= 0) {
            pur.push(p);
            return;
        }
        (p.items || []).forEach(function(item) {
            if ((item.name || '').toLowerCase().indexOf(q) >= 0) {
                pur.push(p);
            }
        });
    });

    var purSeen = {};
    var purUnique = [];
    pur.forEach(function(p) {
        if (!purSeen[p.date]) {
            purSeen[p.date] = true;
            purUnique.push(p);
        }
    });

    if (purUnique.length) {
        h += '<div class="sec">采购 (' + purUnique.length + ')</div>';
        purUnique.slice(0, 8).forEach(function(p) {
            h += '<div class="item-card" style="cursor:pointer" onclick="goPage(\'purchase\')">';
            h += '<span class="name">' + p.date + '</span>';
            h += '<div class="nums"><span>' + (p.items || []).length + '项 · ' + (p.source || '外购') + '</span></div>';
            h += '</div>';
        });
    }

    // 搜索仓库
    var wh = [];
    (DB.whItems || []).forEach(function(item) {
        if ((item.name || '').toLowerCase().indexOf(q) >= 0 || (item.category || '').toLowerCase().indexOf(q) >= 0) {
            wh.push(item);
        }
    });

    if (wh.length) {
        h += '<div class="sec">仓库 (' + wh.length + ')</div>';
        wh.slice(0, 8).forEach(function(item) {
            h += '<div class="item-card" style="cursor:pointer" onclick="goPage(\'wh\')">';
            h += '<span class="name">' + item.name + '</span>';
            h += '<div class="nums"><span>库存<b>' + item.stock + item.unit + '</b></span></div>';
            h += '</div>';
        });
    }

    // 搜索费用
    var exp = [];
    (DB.expenses || []).forEach(function(e) {
        if ((e.desc || '').toLowerCase().indexOf(q) >= 0 ||
            (e.date || '').indexOf(q) >= 0 ||
            (e.category || '').toLowerCase().indexOf(q) >= 0) {
            exp.push(e);
        }
    });

    if (exp.length) {
        h += '<div class="sec">费用 (' + exp.length + ')</div>';
        exp.slice(0, 8).forEach(function(e) {
            h += '<div class="item-card" style="cursor:pointer" onclick="goPage(\'expense\')">';
            h += '<span class="name">' + e.desc + '</span>';
            h += '<div class="nums"><span>' + e.date + ' · <b>¥' + fmtC(e.amount) + '</b></span></div>';
            h += '</div>';
        });
    }

    if (!h) {
        h = '<div style="text-align:center;padding:40px;color:var(--tx-m)">未找到</div>';
    }

    el.innerHTML = h;
}

// ==================== 4. 分类管理 ====================

// 获取分类列表
function getPurCats(area) {
    if (!DB.areaCats) {
        DB.areaCats = {
            "厨房": ["调料/粮油", "食材", "茶叶/干货"],
            "吧台": ["饮品", "耗材"],
            "外场": ["清洁", "包装", "设备"]
        };
    }

    if (area && DB.areaCats[area]) {
        return DB.areaCats[area].slice();
    }

    var all = [];
    Object.keys(DB.areaCats).forEach(function(a) {
        DB.areaCats[a].forEach(function(c) {
            if (all.indexOf(c) < 0) all.push(c);
        });
    });

    return all.length ? all : ["调料/粮油", "食材", "茶叶/干货", "清洁", "耗材", "设备", "包装"];
}

// 根据区域重建分类下拉框
function updateCatSelect(selEl, area) {
    var cats = getPurCats(area);

    var html = '<option value="">-</option>';
    cats.forEach(function(c) {
        html += '<option>' + c + '</option>';
    });
    html += '<option value="__custom">自定义</option>';
    html += '<option value="__clear">清除</option>';

    selEl.innerHTML = html;
}

// 采购行区域下拉变化时触发
function purAreaChanged(areaEl, idx) {
    var area = areaEl.value;

    _pmItems[idx].section = area;
    _pmItems[idx].category = '';

    var row = areaEl.closest('tr');
    if (row) {
        var selects = row.querySelectorAll('select');
        if (selects[2]) {
            updateCatSelect(selects[2], area);
        }
    }
}

// 切换自定义输入框的显示/隐藏
function toggleCustomInput(sel, customId) {
    var c = document.getElementById(customId);
    if (sel.value === '__custom') {
        c.style.display = '';
        c.focus();
    } else {
        c.style.display = 'none';
        c.value = '';
    }
}

// 获取下拉框的值（含自定义输入）
function getSelVal(selId, customId) {
    var s = document.getElementById(selId);
    return s.value === '__custom'
        ? (document.getElementById(customId).value.trim() || '')
        : s.value;
}


// ==================== 5. 导航 ====================
var curPage = 'dash';

// 页面路由
function goPage(name) {
    document.querySelectorAll('.toolbar-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.page === name);
    });

    var toolbar = $id('toolbar');
    if (toolbar && toolbar.classList.contains('open')) {
        toolbar.classList.remove('open');
        $id('toolbarMask').classList.remove('open');
        document.body.style.overflow = '';
    }

    var icons = {
        dash: '📊', daily: '📝', purchase: '🛒', expense: '💰',
        damage: '📦', tea: '🍵', cig: '🚬', alc: '🍺', wh: '🏪',
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
        case 'wh':        rWH(); break;
        case 'report':    rReport(); break;
        case 'gen':       rGen(); break;
        case 'settings':  rData(); break;
        default:          rDash(); break;
    }
}

// 侧边栏生成
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

// 刷新当前页面
function renderPage(page) {
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
        'wh': rWH,
        'damage': rDamage,
        'report': rReport,
        'gen': rGen,
        'data': rData
    }[page];
    if (fn) fn();
    updateNav(page);
}

// 更新导航按钮高亮
function updateNav(p) {
    document.querySelectorAll('.nav-item').forEach(function(el) {
        el.classList.toggle('active', el.dataset.page === p);
    });
}

// 设置主内容区
function setMain(t, c) {
    $id('mainContent').innerHTML = '<div class="page-title">' + t + '</div><div class="page active">' + c + '</div>';
    window.scrollTo(0, 0);
}
