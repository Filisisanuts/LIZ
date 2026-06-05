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
// 用户输入时不会每次按键都搜索，等停止输入180ms后才执行
function scheduleSearch() {
    if (_searchTimer) clearTimeout(_searchTimer);
    _searchTimer = setTimeout(doSearch, 180);
}

// ---------- 执行搜索 ----------
// 从 DB 中搜索 4 类数据：日报、采购、仓库、费用
// 按关键词模糊匹配，结果最多显示 8 条
function doSearch() {
    var q = ($id('searchIn').value || '').trim().toLowerCase();
    var el = $id('searchResults');

    // 输入为空则清空结果
    if (!q) {
        el.innerHTML = '';
        return;
    }

    var h = '';

    // ===== 1. 搜索日报 =====
    // 匹配：日期、汇报人
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

    // ===== 2. 搜索采购 =====
    // 匹配：日期、商品名称
    var pur = [];
    DB.purchases.forEach(function(p) {
        // 先匹配日期
        if (p.date.indexOf(q) >= 0) {
            pur.push(p);
            return;
        }
        // 再匹配每一项商品名称
        (p.items || []).forEach(function(item) {
            if ((item.name || '').toLowerCase().indexOf(q) >= 0) {
                pur.push(p);
            }
        });
    });

    // 去重（同一天的采购单只显示一次）
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

    // ===== 3. 搜索仓库 =====
    // 匹配：品名、分类
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

    // ===== 4. 搜索费用 =====
    // 匹配：描述、日期、类别
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

    // ===== 无结果 =====
    if (!h) {
        h = '<div style="text-align:center;padding:40px;color:var(--tx-m)">未找到</div>';
    }

    // 渲染搜索结果
    el.innerHTML = h;
}

