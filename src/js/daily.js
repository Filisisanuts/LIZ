
// 日报编辑临时数据（用于暂存当前正在编辑的日报内容）
var _pd = null;
var _dailyPendingParse = null;
var _dailyPendingSave = null;
var _dailySavedReport = null;
var _dailySaveMode = '';


// 日报主页
// 两个主视图：录入（解析文本 + 结构化草稿）和明细（历史日报）
function rDaily() {
    var h = '<div class="view-tabs" id="dT" role="tablist" aria-label="日报视图">';
    h += '<button type="button" class="view-tab active" role="tab" aria-selected="true" onclick="switchDT(\'entry\')">录入</button>';
    h += '<button type="button" class="view-tab" role="tab" aria-selected="false" onclick="switchDT(\'hist\')">明细</button>';
    h += '</div>';

    // 粘贴页
    h += '<div id="dText">';
    h += '<textarea id="dtInput" class="inp" placeholder="粘贴日报..." style="width:100%;max-height:120px;resize:vertical;box-sizing:border-box"></textarea>';
    h += '<div class="brow" style="margin:12px 0 20px"><button class="btn p" onclick="requestDailyParse()">解析日报</button><button class="btn" onclick="resetDailyDraft()">清空草稿</button></div>';
    h += '<div id="dailyPreview"></div>';
    h += '</div>';

    // 解析后的结构化录入区
    h += '<div id="dMan" style="display:none">';
    h += '<div class="hrow"><label>日期</label><input class="inp" id="dmDate" type="text" readonly placeholder="选择日期" value="' + td() + '" onclick="_dpOpen(\'dmDate\')" style="cursor:pointer"></div>';
    h += '<div class="section-label">经营数据</div><div id="dmFreeList"></div>';

    // 根据配置显示贵重物品销售区块
    var config = getAppConfig();
    var invTypes = (config && config.inventoryTypes) ? config.inventoryTypes : ['tea', 'cig', 'alc', 'other'];

    if (invTypes.includes('tea') || (DB.teaItems && DB.teaItems.length > 0)) {
        h += '<div class="section-label">茗茶销售</div><div id="dmTeaList"></div>';
    }
    if (invTypes.includes('cig') || (DB.cigItems && DB.cigItems.length > 0)) {
        h += '<div class="section-label">香烟销售</div><div id="dmCigList"></div>';
    }
    if (invTypes.includes('alc') || (DB.alcItems && DB.alcItems.length > 0)) {
        h += '<div class="section-label">酒类销售</div><div id="dmAlcList"></div>';
    }
    if (invTypes.includes('other') || (DB.otherItems && DB.otherItems.length > 0)) {
        h += '<div class="section-label">其他贵重物品</div><div id="dmOtherList"></div>';
    }

    // 根据配置显示包厢预定和汇报人
    var dailyFeatures = (config && config.dailyFeatures) || {};
    if (dailyFeatures.roomEnabled) {
        h += '<div class="section-label">包厢预定</div><div id="dmRoomList"></div>';
    }
    if (dailyFeatures.reporterEnabled) {
        h += '<div class="hrow"><label>汇报人</label><input class="inp" id="dmReporter" style="max-width:160px"></div>';
    }

    h += '<div class="brow"><button class="btn p" onclick="doManualDaily()">保存日报</button></div>';
    h += '</div>';

    // 明细页
    h += '<div id="dHist" style="display:none">';
    h += '<div class="hrow"><label>月份</label>';
    h += '<button class="btn s" onclick="dailyCalNav(-1)">◀</button>';
    h += '<input class="inp" id="dhM" type="text" readonly placeholder="选择月份" value="' + curYM() + '" onclick="_mpOpen(\'dhM\')" onchange="dailyCalPickYM(this.value)" style="max-width:180px;cursor:pointer">';
    h += '<button class="btn s" onclick="dailyCalNav(1)">▶</button>';
    h += '</div>';
    h += '<div id="dhArea"></div>';
    h += '</div>';

    setMain('日报', h);
    if (!_pd) _pd = parseDaily('');
    setTimeout(function() { if (_curPage === 'daily') switchDT('entry'); }, 0);
}

// 渲染日报历史列表
// 日报明细页结算方式筛选器状态
var _dailyPaymentFilter = {
    // 支付方式
    pos: false,
    ccbLife: false,
    cash: false,
    memberCard: false,
    treat: false,
    // 应收账款
    arMeituan: false,
    arDouyin: false,
    arTotal: false,
    // 外卖配送
    delMeituan: false,
    delTaobao: false,
    delJd: false,
    delTotal: false
};
var _dailyPaymentFilterExpanded = false;

// 结算方式分组配置
var _paymentGroups = [
    {
        name: '支付方式',
        items: [
            { key: 'pos', label: 'POS机', path: 'payment.pos' },
            { key: 'ccbLife', label: '建行生活', path: 'payment.ccbLife' },
            { key: 'cash', label: '现金', path: 'payment.cash' },
            { key: 'memberCard', label: '会员卡', path: 'payment.memberCard' },
            { key: 'treat', label: '招待', path: 'payment.treat' }
        ]
    },
    {
        name: '应收账款',
        items: [
            { key: 'arMeituan', label: '美团团购', path: 'payment.ar.meituan' },
            { key: 'arDouyin', label: '抖音团购', path: 'payment.ar.douyin' },
            { key: 'arTotal', label: '应收合计', path: 'payment.ar.total' }
        ]
    },
    {
        name: '外卖配送',
        items: [
            { key: 'delMeituan', label: '美团外卖', path: 'delivery.meituan' },
            { key: 'delTaobao', label: '淘宝闪购', path: 'delivery.taobao' },
            { key: 'delJd', label: '京东外卖', path: 'delivery.jd' },
            { key: 'delTotal', label: '外卖合计', path: 'delivery.total' }
        ]
    }
];

function selectedPaymentFields() {
    return _paymentGroups.reduce(function(items, group) {
        group.items.forEach(function(item) {
            if (_dailyPaymentFilter[item.key]) items.push(item);
        });
        return items;
    }, []);
}

function monthlyPaymentFieldTotal(reports, field) {
    return reports.reduce(function(total, report) {
        var value = field.path.split('.').reduce(function(current, key) {
            return current && current[key] !== undefined ? current[key] : 0;
        }, report);
        return total + (Number(value) || 0);
    }, 0);
}

function selectedPaymentTotal(fields) {
    var keys = fields.map(function(field) { return field.key; });
    return fields.reduce(function(total, field) {
        if (field.key === 'arTotal' && (keys.indexOf('arMeituan') >= 0 || keys.indexOf('arDouyin') >= 0)) return total;
        if (field.key === 'delTotal' && (keys.indexOf('delMeituan') >= 0 || keys.indexOf('delTaobao') >= 0 || keys.indexOf('delJd') >= 0)) return total;
        return total + (Number(field.monthlyTotal) || 0);
    }, 0);
}

function renderDHist() {
    var el = document.getElementById('dhArea');
    if (!el) return;

    var ym = document.getElementById('dhM') ? document.getElementById('dhM').value : curYM();
    if (!ym) ym = curYM();

    var parts = ym.split('-');
    var year = parseInt(parts[0]);
    var month = parseInt(parts[1]);
    var daysInMonth = new Date(year, month, 0).getDate();
    var firstDay = new Date(year, month - 1, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;

    var reports = {};
    var mr = getMR(ym);
    mr.forEach(function(r) {
        reports[parseInt(r.date.split('-')[2])] = r;
    });

    var todayParts = td().split('-');
    var isThisMonth = td().startsWith(ym);

    var h = '';

    // ★ 第一：月汇总（在月份选择器正下方）
    if (mr.length) {
        var mNet = 0, mGuests = 0;
        mr.forEach(function(r) {
            mNet += r.revenue.netSales || 0;
            mGuests += r.guest.count || 0;
        });
        var mAvgDaily = mr.length > 0 ? Math.round(mNet / mr.length) : 0;

        h += '<div class="cards">';
        h += '<div class="card"><div class="card-l">本月实收</div><div class="card-v ac">' + fmtC(mNet) + '</div></div>';
        h += '<div class="card"><div class="card-l">日均实收</div><div class="card-v ac">' + fmtC(mAvgDaily) + '</div></div>';
        h += '<div class="card"><div class="card-l">已报天数</div><div class="card-v">' + mr.length + '</div></div>';
        h += '<div class="card"><div class="card-l">总客流</div><div class="card-v">' + mGuests + '</div></div>';
        h += '</div>';
    }

    // ★ 第二：结算方式筛选器与本月筛选合计
    var selectedFields = selectedPaymentFields();
    selectedFields.forEach(function(field) {
        field.monthlyTotal = monthlyPaymentFieldTotal(mr, field);
    });
    var selectedTotal = selectedPaymentTotal(selectedFields);
    h += '<section class="payment-filter">';
    h += '<button type="button" class="payment-filter-toggle" aria-expanded="' + _dailyPaymentFilterExpanded + '" onclick="togglePaymentFilterPanel()">';
    h += '<span><strong>结算方式筛选统计</strong><small>已选 ' + selectedFields.length + ' 项 · ' + fmtC(selectedTotal) + '</small></span>';
    h += '<span class="payment-filter-chevron' + (_dailyPaymentFilterExpanded ? ' open' : '') + '" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span></button>';

    if (_dailyPaymentFilterExpanded) {
        h += '<div class="payment-filter-body">';
        if (selectedFields.length) {
            h += '<div class="payment-filter-actions"><span>已选 ' + selectedFields.length + ' 项</span><button type="button" class="btn s" onclick="resetPaymentFilter()">清空</button></div>';
        }
        _paymentGroups.forEach(function(group, groupIndex) {
            h += '<div class="payment-filter-group' + (groupIndex === _paymentGroups.length - 1 ? ' last' : '') + '"><div class="payment-filter-label">' + group.name + '</div>';
            h += '<div class="payment-filter-options" role="group" aria-label="' + group.name + '">';
            group.items.forEach(function(item) {
                var checked = _dailyPaymentFilter[item.key];
                h += '<button type="button" class="payment-filter-chip' + (checked ? ' active' : '') + '" aria-pressed="' + checked + '" onclick="togglePaymentFilter(\'' + item.key + '\',' + !checked + ')">' + item.label + '</button>';
            });
            h += '</div></div>';
        });

        if (selectedFields.length) {
            h += '<div class="payment-filter-summary">';
            h += '<div class="payment-filter-summary-head"><strong>本月筛选合计</strong><span>按当前月份全部日报汇总</span></div>';
            h += '<div class="payment-filter-summary-grid">';
            selectedFields.forEach(function(field) {
                h += '<div class="payment-filter-summary-item"><span>' + field.label + '</span><strong>' + fmtC(field.monthlyTotal) + '</strong></div>';
            });
            h += '</div>';
            h += '<div class="payment-filter-summary-total"><span>已选项目合计</span><strong>' + fmtC(selectedTotal) + '</strong></div>';
            h += '<p class="payment-filter-summary-note">合计自动排除与明细重复的“应收合计 / 外卖合计”。</p>';
            h += '</div>';
        } else {
            h += '<div class="payment-filter-empty">勾选结算方式后，这里显示本月合计。</div>';
        }
        h += '</div>';
    }
    h += '</section>';

    // ★ 第三：日历
    h += '<div class="daily-calendar" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:14px">';
    var weekNames = ['一', '二', '三', '四', '五', '六', '日'];
    weekNames.forEach(function(w) {
        h += '<div style="text-align:center;font-size:.7rem;color:var(--tx-m);padding:4px 0">' + w + '</div>';
    });

    for (var i = 0; i < firstDay; i++) {
        h += '<div></div>';
    }

    for (var d = 1; d <= daysInMonth; d++) {
        var r = reports[d];
        var isToday = isThisMonth && parseInt(todayParts[2]) === d;
        var borderColor = isToday ? 'var(--ac)' : 'var(--bd)';
        var bg = r ? 'var(--card)' : 'var(--card-h)';
        var dayColor = isToday ? 'var(--ac)' : 'var(--tx)';
        var clickable = r ? 'cursor:pointer' : 'cursor:default';

        h += '<div class="daily-calendar-cell" style="background:' + bg + ';border:1px solid ' + borderColor + ';border-radius:6px;padding:6px;' + clickable + ';min-height:65px"';
        if (r) h += ' onclick="showDailyModal(\'' + r.date + '\')"';
        h += '>';
        h += '<div style="font-size:.72rem;font-weight:600;color:' + dayColor + '">' + d + '</div>';

        if (r) {
            // 检查是否有选中的筛选器
            var hasFilter = Object.values(_dailyPaymentFilter).some(function(v) { return v; });

            if (hasFilter) {
                // 有筛选器时，显示选中结算方式的金额
                var filterLines = [];

                // 支付方式
                if (_dailyPaymentFilter.pos && r.payment.pos) filterLines.push('POS: ' + fmtC(r.payment.pos));
                if (_dailyPaymentFilter.ccbLife && r.payment.ccbLife) filterLines.push('建行: ' + fmtC(r.payment.ccbLife));
                if (_dailyPaymentFilter.cash && r.payment.cash) filterLines.push('现金: ' + fmtC(r.payment.cash));
                if (_dailyPaymentFilter.memberCard && r.payment.memberCard) filterLines.push('会员: ' + fmtC(r.payment.memberCard));
                if (_dailyPaymentFilter.treat && r.payment.treat) filterLines.push('招待: ' + fmtC(r.payment.treat));

                // 应收账款
                if (_dailyPaymentFilter.arMeituan && r.payment.ar.meituan) filterLines.push('美团: ' + fmtC(r.payment.ar.meituan));
                if (_dailyPaymentFilter.arDouyin && r.payment.ar.douyin) filterLines.push('抖音: ' + fmtC(r.payment.ar.douyin));
                if (_dailyPaymentFilter.arTotal && r.payment.ar.total) filterLines.push('应收: ' + fmtC(r.payment.ar.total));

                // 外卖配送
                if (_dailyPaymentFilter.delMeituan && r.delivery.meituan) filterLines.push('美团外卖: ' + fmtC(r.delivery.meituan));
                if (_dailyPaymentFilter.delTaobao && r.delivery.taobao) filterLines.push('淘宝: ' + fmtC(r.delivery.taobao));
                if (_dailyPaymentFilter.delJd && r.delivery.jd) filterLines.push('京东: ' + fmtC(r.delivery.jd));
                if (_dailyPaymentFilter.delTotal && r.delivery.total) filterLines.push('外卖: ' + fmtC(r.delivery.total));

                // 显示筛选结果
                if (filterLines.length > 0) {
                    filterLines.forEach(function(line) {
                        h += '<div style="font-family:var(--fm);font-size:.65rem;color:var(--ac);margin-top:1px;line-height:1.2">' + line + '</div>';
                    });
                } else {
                    h += '<div style="font-family:var(--fm);font-size:.7rem;color:var(--tx-m);margin-top:2px">-</div>';
                }
            } else {
                // 无筛选器时，显示实收金额
                h += '<div style="font-family:var(--fm);font-size:.7rem;color:var(--ac);margin-top:2px">' + fmtC(r.revenue.netSales) + '</div>';
            }
            h += '<div style="font-size:.6rem;color:var(--tx-m)">' + r.guest.count + '人</div>';
        } else {
            h += '<div style="font-size:.6rem;color:var(--tx-m);margin-top:4px">-</div>';
        }
        h += '</div>';
    }
    h += '</div>';

    el.innerHTML = h;
}

// 切换结算方式筛选器
function togglePaymentFilter(key, checked) {
    _dailyPaymentFilter[key] = checked;
    renderDHist();
}

// 重置结算方式筛选器
function resetPaymentFilter() {
    Object.keys(_dailyPaymentFilter).forEach(function(key) {
        _dailyPaymentFilter[key] = false;
    });
    renderDHist();
}

// 切换日报主视图。旧参数 text/manual 统一映射到录入态。
function switchDT(tab) {
    if (!$id('dText') || !$id('dHist')) return;
    var entry = tab !== 'hist';
    $id('dText').style.display = entry ? '' : 'none';
    $id('dMan').style.display = 'none';
    $id('dHist').style.display = entry ? 'none' : '';
    document.querySelectorAll('#dT .view-tab').forEach(function(button, index) {
        var active = entry ? index === 0 : index === 1;
        button.classList.toggle('active', active);
        button.setAttribute('aria-selected', String(active));
    });
    if (entry) {
        renderDP();
    }
    if (!entry) renderDHist();
}

function togglePaymentFilterPanel() {
    _dailyPaymentFilterExpanded = !_dailyPaymentFilterExpanded;
    renderDHist();
}

// 日报自定义标签行
// 手动填写日报时，经营数据区域支持自定义标签（如：实收、厨房、外卖等快捷标签）
// 初始化标签行：渲染快捷标签按钮 + 一行空输入框 + 添加按钮
function initFreeRows() {
    var labels = getFreeLabels();
    var html = '<div class="tag-btns">';
    labels.forEach(function(l) {
        html += '<button class="tag-btn" onclick="addFreeRowWithValue(\'' + l + '\')">' + l + '</button>';
    });
    html += '</div>';
    html += '<div id="dmFreeRows">' + freeRowHTML() + '</div>';
    html += '<div style="margin-top:6px"><button class="btn s" onclick="addFreeRow()">+添加</button></div>';
    $id('dmFreeList').innerHTML = html;
}
// 点击快捷标签后，添加一行并填入标签值
function addFreeRowWithValue(label) {
    var d = document.createElement('div');
    d.innerHTML = freeRowHTML();
    var row = d.firstElementChild;
    var inp = row.querySelector('[data-type="fl"]');
    if (inp) inp.value = label;
    $id('dmFreeRows').appendChild(row);
    // 自动聚焦到数值输入框
    var valInp = row.querySelector('[data-type="fv"]');
    if (valInp) valInp.focus();
}
// 生成一行标签行 HTML（标签名 + 数值 + 删除按钮）
function freeRowHTML() {
    return '<div class="hrow free-row">' +
        '<input class="inp" data-type="fl" placeholder="标签" style="flex:1.5">' +
        '<input class="inp" data-type="fv" type="number" step="0.01" value="0" style="flex:1;max-width:140px">' +
        '<button class="btn s d" onclick="this.parentElement.remove()">×</button></div>';
}
// 新增一行空标签行
function addFreeRow() {
    var d = document.createElement('div');
    d.innerHTML = freeRowHTML();
    $id('dmFreeRows').appendChild(d.firstElementChild);
}

// 日报茗茶/香烟销售录入
// 茗茶录入：为每个茶品生成杯/壶输入行，自动计算应收金额
function initTeaBlock() {
    var items = DB.teaItems;
    if (!items.length) { $id('dmTeaList').innerHTML = '<div style="font-size:.74rem;color:var(--tx-m)">先在茗茶管理中添加</div>'; return; }
    var h = '';
    items.forEach(function(item) {
        h += '<div class="tea-sale-row" data-tid="' + item.id + '">';
        h += '<label>' + item.name + '</label>';
        h += '杯:<input class="inp tea-cups" type="number" value="0" style="max-width:50px" oninput="calcTeaExpected(this)"> ';
        h += '壶:<input class="inp tea-pots" type="number" value="0" style="max-width:50px" oninput="calcTeaExpected(this)"> ';
        h += '应收:<input class="inp tea-expected" type="number" step="0.01" value="0" style="max-width:90px;background:var(--card-h)" readonly> ';
        h += '实收:<input class="inp tea-amt" type="number" step="0.01" value="0" style="max-width:90px">';
        h += '</div>';
    });
    $id('dmTeaList').innerHTML = h;
}
// 香烟录入：：为每个香烟生成数量输入行，自动计算应收金额
function initCigBlock() {
    var items = DB.cigItems;
    if (!items.length) { $id('dmCigList').innerHTML = '<div style="font-size:.74rem;color:var(--tx-m)">先在香烟管理中添加</div>'; return; }
    var h = '';
    items.forEach(function(item) {
        h += '<div class="tea-sale-row" data-cid="' + item.id + '">';
        h += '<label>' + item.name + '</label>';
        h += '数量:<input class="inp cig-sqty" type="number" value="0" style="max-width:60px" oninput="calcCigExpected(this)"> ';
        h += '应收:<input class="inp cig-expected" type="number" step="0.01" value="0" style="max-width:80px;background:var(--card-h)" readonly>';
        h += '实收:<input class="inp cig-samt" type="number" step="0.01" value="0" style="max-width:80px">';
        h += '</div>';
    });
    $id('dmCigList').innerHTML = h;
}
// 自动计算应收
//茗茶自动计算应收 = 杯数×杯价 + 壶数×壶价
function calcTeaExpected(el) {
    var row = el.closest('.tea-sale-row');
    if (!row) return;
    var item = DB.teaItems.find(function(t) { return t.id === row.dataset.tid; });
    if (!item) return;
    var cups = parseInt(row.querySelector('.tea-cups').value) || 0;
    var pots = parseInt(row.querySelector('.tea-pots').value) || 0;
    var expected = (cups * (item.pricePerCup || 0) + pots * (item.pricePerPot || 0)).toFixed(2);
    row.querySelector('.tea-expected').value = expected;
    // 实收跟随应收更新（只有实收等于之前的应收时才更新）
    var amtInput = row.querySelector('.tea-amt');
    var prevExpected = row.querySelector('.tea-expected').dataset.prevExpected || '0';
    if (amtInput && parseFloat(amtInput.value) === parseFloat(prevExpected)) {
        amtInput.value = expected;
    }
    row.querySelector('.tea-expected').dataset.prevExpected = expected;
}
// 香烟自动计算应收 = 数量×单价
function calcCigExpected(el) {
    var row = el.closest('.tea-sale-row');
    if (!row) return;
    var item = DB.cigItems.find(function(c) { return c.id === row.dataset.cid; });
    if (!item) return;
    var qty = parseInt(row.querySelector('.cig-sqty').value) || 0;
    var expected = (qty * (item.pricePerUnit || 0)).toFixed(2);
    row.querySelector('.cig-expected').value = expected;
    // 实收跟随应收更新（只有实收等于之前的应收时才更新）
    var amtInput = row.querySelector('.cig-samt');
    var prevExpected = row.querySelector('.cig-expected').dataset.prevExpected || '0';
    if (amtInput && parseFloat(amtInput.value) === parseFloat(prevExpected)) {
        amtInput.value = expected;
    }
    row.querySelector('.cig-expected').dataset.prevExpected = expected;
}
// 酒类录入：为每个酒类生成数量输入行，自动计算应收金额
function initAlcBlock() {
    var items = DB.alcItems;
    if (!items.length) { $id('dmAlcList').innerHTML = '<div style="font-size:.74rem;color:var(--tx-m)">先在酒类管理中添加</div>'; return; }
    var h = '';
    items.forEach(function(item) {
        h += '<div class="tea-sale-row" data-aid="' + item.id + '">';
        h += '<label>' + item.name + '</label>';
        h += '数量:<input class="inp alc-sqty" type="number" value="0" style="max-width:60px" oninput="calcAlcExpected(this)"> ';
        h += '应收:<input class="inp alc-expected" type="number" step="0.01" value="0" style="max-width:80px;background:var(--card-h)" readonly>';
        h += '实收:<input class="inp alc-samt" type="number" step="0.01" value="0" style="max-width:80px">';
        h += '</div>';
    });
    $id('dmAlcList').innerHTML = h;
}
// 酒类自动计算应收 = 数量×单价
function calcAlcExpected(el) {
    var row = el.closest('.tea-sale-row');
    if (!row) return;
    var item = DB.alcItems.find(function(a) { return a.id === row.dataset.aid; });
    if (!item) return;
    var qty = parseInt(row.querySelector('.alc-sqty').value) || 0;
    var expected = (qty * (item.pricePerUnit || 0)).toFixed(2);
    row.querySelector('.alc-expected').value = expected;
    // 实收跟随应收更新（只有实收等于之前的应收时才更新）
    var amtInput = row.querySelector('.alc-samt');
    var prevExpected = row.querySelector('.alc-expected').dataset.prevExpected || '0';
    if (amtInput && parseFloat(amtInput.value) === parseFloat(prevExpected)) {
        amtInput.value = expected;
    }
    row.querySelector('.alc-expected').dataset.prevExpected = expected;
}
// 其他贵重物品录入：为每个物品生成数量输入行，自动计算应收金额
function initOtherBlock() {
    var items = DB.otherItems;
    if (!items.length) { $id('dmOtherList').innerHTML = '<div style="font-size:.74rem;color:var(--tx-m)">先在其他贵重物品管理中添加</div>'; return; }
    var h = '';
    items.forEach(function(item) {
        h += '<div class="tea-sale-row" data-oid="' + item.id + '">';
        h += '<label>' + item.name + '</label>';
        h += '数量:<input class="inp other-sqty" type="number" value="0" style="max-width:60px" oninput="calcOtherExpected(this)"> ';
        h += '应收:<input class="inp other-expected" type="number" step="0.01" value="0" style="max-width:80px;background:var(--card-h)" readonly>';
        h += '实收:<input class="inp other-samt" type="number" step="0.01" value="0" style="max-width:80px">';
        h += '</div>';
    });
    $id('dmOtherList').innerHTML = h;
}
// 其他贵重物品自动计算应收 = 数量×单价
function calcOtherExpected(el) {
    var row = el.closest('.tea-sale-row');
    if (!row) return;
    var item = DB.otherItems.find(function(o) { return o.id === row.dataset.oid; });
    if (!item) return;
    var qty = parseFloat(row.querySelector('.other-sqty').value) || 0;
    var expected = (qty * (item.pricePerUnit || 0)).toFixed(2);
    row.querySelector('.other-expected').value = expected;
    // 实收跟随应收更新（只有实收等于之前的应收时才更新）
    var amtInput = row.querySelector('.other-samt');
    var prevExpected = row.querySelector('.other-expected').dataset.prevExpected || '0';
    if (amtInput && parseFloat(amtInput.value) === parseFloat(prevExpected)) {
        amtInput.value = expected;
    }
    row.querySelector('.other-expected').dataset.prevExpected = expected;
}

// 包厢预定录入
// 从配置中读取包厢类型，不再硬编码
function initRoomBlock() {
    // 获取包厢类型配置
    var roomTypes = [];
    try {
        var config = getAppConfig();
        if (config.roomTypes && config.roomTypes.length > 0) {
            roomTypes = config.roomTypes;
        }
    } catch(e) {}

    var h = '<div id="dmRoomRows">';
    // 如果有配置的包厢类型，显示对应的输入行
    if (roomTypes.length > 0) {
        roomTypes.forEach(function(type) {
            h += roomRowHTML(type, 0, 0);
        });
    }
    h += '</div>';
    h += '<div style="margin-top:6px"><button class="btn s" onclick="addRoomRow()">+添加</button></div>';
    $id('dmRoomList').innerHTML = h;
}

function roomRowHTML(name, today, cum) {
    return '<div class="hrow free-row room-row">' +
        '<input class="inp room-name" placeholder="姓名" style="flex:1.5" value="' + (name || '') + '">' +
        '<input class="inp room-today" type="number" placeholder="今日" style="max-width:60px" value="' + (today || 0) + '">' +
        '<input class="inp room-cum" type="number" placeholder="累计" style="max-width:60px" value="' + (cum || 0) + '">' +
        '<button class="btn s d" onclick="this.parentElement.remove()">×</button></div>';
}

function addRoomRow() {
    var d = document.createElement('div');
    d.innerHTML = roomRowHTML('', 0, 0);
    $id('dmRoomRows').appendChild(d.firstElementChild);
}

// 手动保存日报
// 收集表单数据，支持合并保存和覆盖保存两种模式
// 合并：只更新本次填写的字段，保留已有数据
// 覆盖：用本次数据完全替换
// 收集数据 → 弹窗选择合并/覆盖 → 调用 doSaveManual
function doManualDaily() {
    var date = $id('dmDate').value || td();
    var existing = DB.dailyReports.find(function(d) { return d.date === date; });

    // 收集经营数据
    var freeData = [];
    document.querySelectorAll('#dmFreeList .free-row').forEach(function(row) {
        var lb = row.querySelector('[data-type="fl"]').value.trim();
        var v = parseFloat(row.querySelector('[data-type="fv"]').value) || 0;
        if (lb) freeData.push({ label: lb, value: v });
    });

    // 收集茗茶数据
    var teaData = [];
    document.querySelectorAll('.tea-sale-row[data-tid]').forEach(function(row) {
        var id = row.dataset.tid;
        var cups = parseInt(row.querySelector('.tea-cups').value) || 0;
        var pots = parseInt(row.querySelector('.tea-pots').value) || 0;
        var expected = parseFloat(row.querySelector('.tea-expected').value) || 0;
        var amt = parseFloat(row.querySelector('.tea-amt').value) || 0;
        // 不填实收默认按应收入账
        if (amt === 0 && expected > 0) amt = expected;
        if (cups > 0 || pots > 0 || amt > 0) {
            teaData.push({ id: id, cups: cups, pots: pots, expectedAmount: expected, amount: amt });
        }
    });

    // 收集香烟数据
    var cigData = [];
    document.querySelectorAll('.tea-sale-row[data-cid]').forEach(function(row) {
        var id = row.dataset.cid;
        var qty = parseInt(row.querySelector('.cig-sqty').value) || 0;
        var expected = parseFloat(row.querySelector('.cig-expected').value) || 0;
        var amt = parseFloat(row.querySelector('.cig-samt').value) || 0;
        // 不填实收默认按应收入账
        if (amt === 0 && expected > 0) amt = expected;
        if (qty > 0 || amt > 0) {
            cigData.push({ id: id, qty: qty, expectedAmount: expected, amount: amt });
        }
    });

    // 收集包厢数据
    var roomData = [];
    document.querySelectorAll('.room-row').forEach(function(row) {
        var name = row.querySelector('.room-name').value.trim();
        var today = parseInt(row.querySelector('.room-today').value) || 0;
        var cum = parseInt(row.querySelector('.room-cum').value) || 0;
        if (name) roomData.push({ name: name, today: today, cum: cum });
    });
    var premCum = parseInt($id('dmPremCum') ? $id('dmPremCum').value : 0) || 0;

    if (!freeData.length && !teaData.length && !cigData.length && !roomData.length) {
        toast('请填写数据');
        return;
    }

    if (existing) {
        var h = '<h3>发现 ' + date + ' 已有日报</h3>';
        h += '<p style="font-size:.78rem;color:var(--tx-s);margin-bottom:14px">选择保存方式：</p>';
        h += '<div style="display:flex;gap:10px;flex-wrap:wrap">';
        h += '<button class="btn p" onclick="doSaveManual(\'' + date + '\',\'merge\')">合并</button>';
        h += '<div style="font-size:.72rem;color:var(--tx-m);line-height:1.4">仅更新本次填写的字段<br>保留已有数据不变</div>';
        h += '</div>';
        h += '<div style="margin-top:12px;display:flex;gap:10px">';
        h += '<button class="btn d" onclick="doSaveManual(\'' + date + '\',\'overwrite\')">覆盖</button>';
        h += '<div style="font-size:.72rem;color:var(--tx-m);line-height:1.4">用本次数据完全替换<br>未填写的字段归零</div>';
        h += '</div>';
        h += '<div class="brow" style="margin-top:14px"><button class="btn" onclick="backToModal(function(){rDaily()})">取消</button></div>';
        showModal(h);
    } else {
        doSaveManual(date, 'overwrite');
    }

    window._manualSaveData = { freeData: freeData, teaData: teaData, cigData: cigData, roomData: roomData, premCum: premCum };
}

// 执行保存：收集经营数据、茗茶销售、香烟销售 → 写入DB
function doSaveManual(date, mode) {
    var data = window._manualSaveData;
    if (!data) return;
    var freeData = data.freeData;
    var teaData = data.teaData;
    var cigData = data.cigData;
    var roomData = data.roomData || [];
    var premCum = data.premCum || 0;
    var f = { hasDel: false, hasAR: false };

    upd(function(db) {
        var existing = db.dailyReports.find(function(d) { return d.date === date; });
        var r;

        if (mode === 'merge' && existing) {
            r = existing;
        } else {
            r = {
                date: date,
                revenue: { grossSales: 0, discount: 0, netSales: 0, kitchenSales: 0, barSales: 0, cigarette: { total: 0, items: {} }, other: 0, otherItems: {} },
                payment: { pos: 0, ccbLife: 0, cash: 0, memberCard: 0, ar: { total: 0, meituan: 0, douyin: 0 }, treat: 0 },
                delivery: { total: 0, meituan: 0, taobao: 0, jd: 0 },
                guest: { count: 0, avgSpend: 0, premiumRoomsToday: 0 },
                rooms: [],
                premiumRooms: { today: 0, cum: 0 },
                teaSales: {},
                cigSales: {},
                alcSales: {},
                reporter: ''
            };
        }

        if ($id('dmReporter').value.trim()) r.reporter = $id('dmReporter').value.trim();

        freeData.forEach(function(fd) { matchLabel(fd.label, fd.value, r, f); });
        if (!f.hasDel) r.delivery.total = (r.delivery.meituan || 0) + (r.delivery.taobao || 0) + (r.delivery.jd || 0);
        if (!f.hasAR) r.payment.ar.total = (r.payment.ar.meituan || 0) + (r.payment.ar.douyin || 0);

        teaData.forEach(function(td) {
            var item = db.teaItems.find(function(t) { return t.id === td.id; });
            if (!item) return;
            r.teaSales[td.id] = { cups: td.cups, pots: td.pots, expectedAmount: td.expectedAmount, amount: td.amount };
            if (mode === 'merge') item.sales = item.sales.filter(function(s) { return s.date !== date; });
            item.sales.push({ date: date, cups: td.cups, pots: td.pots, expectedAmount: td.expectedAmount, amount: td.amount });
        });

        cigData.forEach(function(cd) {
            var item = db.cigItems.find(function(c) { return c.id === cd.id; });
            if (!item) return;
            r.cigSales[cd.id] = { qty: cd.qty, expectedAmount: cd.expectedAmount, amount: cd.amount };
            r.revenue.cigarette.total += cd.amount;
            if (mode === 'merge') item.sales = item.sales.filter(function(s) { return s.date !== date; });
            item.sales.push({ date: date, qty: cd.qty, expectedAmount: cd.expectedAmount, amount: cd.amount });
        });

        // 保存包厢数据
        r.rooms = roomData;
        if (roomData.length) {
            var totalToday = roomData.reduce(function(s, rm) { return s + rm.today; }, 0);
            r.guest.premiumRoomsToday = totalToday;
            r.premiumRooms.today = totalToday;
            r.premiumRooms.cum = premCum;
        }

        if (mode === 'merge' && existing) {
            Object.keys(r).forEach(function(k) { if (k === 'date') return; existing[k] = r[k]; });
        } else {
            var idx = db.dailyReports.findIndex(function(d) { return d.date === date; });
            if (idx >= 0) db.dailyReports[idx] = r;
            else db.dailyReports.push(r);
        }
    });

    if (teaData.length) syncInvToDaily('tea', date);
    if (cigData.length) syncInvToDaily('cig', date);

    // 自动校验日报
    var savedReport = DB.dailyReports.find(function(d) { return d.date === date; });
    if (savedReport) autoCheckDaily(savedReport);

    closeModal();
    toast(mode === 'merge' ? '已合并保存' : '已覆盖保存');
    _pmItems = [];
    rDaily();
}

// 解析日报文本
function parseDaily(text) {
    var r = {
        date: td(),
        revenue: { grossSales: 0, discount: 0, netSales: 0, kitchenSales: 0, barSales: 0, cigarette: { total: 0, items: {} }, other: 0, otherItems: {} },
        payment: { pos: 0, ccbLife: 0, cash: 0, memberCard: 0, ar: { total: 0, meituan: 0, douyin: 0 }, treat: 0 },
        delivery: { total: 0, meituan: 0, taobao: 0, jd: 0 },
        guest: { count: 0, avgSpend: 0, premiumRoomsToday: 0 },
        rooms: [],
        premiumRooms: { today: 0, cum: 0 },
        teaSales: {},
        cigSales: {},
        alcSales: {},
        otherSales: {},
        customFields: {},
        reporter: '',
        pending: []
    };

    var dm = text.match(/(\d{4})\s*[年\-\/.]\s*(\d{1,2})\s*[月\-\/.]\s*(\d{1,2})/);
    if (dm) r.date = dm[1] + '-' + String(dm[2]).padStart(2, '0') + '-' + String(dm[3]).padStart(2, '0');

    function getBrackets(s) {
        var m = s.match(/[\uFF08(]([\s\S]+?)[\uFF09)]/);
        return m ? m[1] : '';
    }

    function splitParts(s) {
        return s.replace(/\u3001/g, ',').replace(/\uFF0C/g, ',').replace(/\u3001/g, ',').replace(/\+/g, ',').split(',');
    }

    text.split('\n').forEach(function(l) {
        l = l.trim();
        if (!l) return;
        l = l.replace(/\*\*/g, '').replace(/\uFF1A/g, ':');
        if (/^\d{4}\s*[年\-\/.]\s*\d{1,2}\s*[月\-\/.]\s*\d{1,2}\s*日?$/.test(l)) return;
        if (/月累计|本页合计|^品名/.test(l)) return;

        if (/实收/.test(l) && !/厨房|吧台/.test(l)) { r.revenue.netSales = extN(l); return; }
        if (/厨房/.test(l) && !/月累计/.test(l)) { r.revenue.kitchenSales = extN(l); return; }
        if (/吧台/.test(l) && !/月累计/.test(l)) { r.revenue.barSales = extN(l); return; }
        if (/流水/.test(l)) { r.revenue.grossSales = extN(l); return; }
        if (/折扣/.test(l)) { r.revenue.discount = extN(l); return; }
        if (/其他/.test(l)) { r.revenue.other = extN(l); return; }

        if (/香烟/.test(l)) {
            r.revenue.cigarette.total = extN(l);
            var inner = getBrackets(l);
            if (inner) {
                splitParts(inner).forEach(function(part) {
                    part = part.trim();
                    if (!part) return;
                    var im = part.match(/(.+?)[:：](\d+)/); if (!im) im = part.match(/(.+?)(\d+)/);
                    if (im) {
                        var nm = im[1].trim(), qt = parseInt(im[2]);
                        if (nm && qt > 0) r.revenue.cigarette.items[nm] = qt;
                    }
                });
            }
            return;
        }

        if (/招待/.test(l)) { r.payment.treat = extN(l); return; }
        if (/POS|pos/i.test(l)) { r.payment.pos = extN(l); return; }
        if (/建行/.test(l)) { r.payment.ccbLife = extN(l); return; }
        if (/现金|人民币/.test(l)) { r.payment.cash = extN(l); return; }
        if (/会员/.test(l)) { r.payment.memberCard = extN(l); return; }

        if (/(应收|挂账)/.test(l)) {
            r.payment.ar.total = extN(l);
            var inner = getBrackets(l);
            if (inner) {
                splitParts(inner).forEach(function(part) {
                    var am = extN(part);
                    if (/美团/.test(part)) r.payment.ar.meituan = am;
                    else if (/抖音/.test(part)) r.payment.ar.douyin = am;
                });
            }
            return;
        }

        if (/外卖/.test(l)) {
            r.delivery.total = extN(l);
            var inner = getBrackets(l);
            if (inner) {
                splitParts(inner).forEach(function(part) {
                    var am = extN(part);
                    if (/美团/.test(part)) r.delivery.meituan = am;
                    else if (/淘宝|闪购/.test(part)) r.delivery.taobao = am;
                    else if (/京东/.test(part)) r.delivery.jd = am;
                });
            }
            return;
        }

        if (/人数/.test(l)) { r.guest.count = extN(l); return; }
        if (/人均/.test(l)) { r.guest.avgSpend = extN(l); return; }

        // 包厢预定表头
        if (/包厢预定/.test(l)) return;

        // 包厢预定数据行
        if (/^[\u4e00-\u9fa5]/.test(l) && !/月累计|合计|人数|人均|汇报|流水|实收|厨房|吧台|香烟|其他|招待|POS|建行|现金|会员|应收|外卖/.test(l)) {
            var nums = l.match(/(\d+)\s+(\d+)/);
            var nameMatch = l.match(/^([\u4e00-\u9fa5（）\(\)]+)/);
            if (nums && nameMatch) {
                var today = parseInt(nums[1]);
                var cum = parseInt(nums[2]);
                r.rooms.push({ name: nameMatch[1].trim(), today: today, cum: cum });
                // 同一行可能包含500元包厢个数
                var pm500 = l.match(/个数:?\s*(\d+)/);
                if (pm500 && /500/.test(l)) {
                    r.guest.premiumRoomsToday = parseInt(pm500[1]);
                    r.premiumRooms.today = parseInt(pm500[1]);
                }
                return;
            }
        }

        // 500元包厢累计（独立行）
        if (/累计.*500.*包厢.*个数/.test(l)) {
            var pm = l.match(/个数:?\s*(\d+)/);
            if (pm) r.premiumRooms.cum = parseInt(pm[1]);
            return;
        }

        if (/汇报人/.test(l)) {
            r.reporter = l.replace(/.*汇报人:?\s*/, '').trim();
            return;
        }

        var pair = l.match(/^([^:：]{1,24})[:：]?\s*([-+]?\d[\d,]*(?:\.\d+)?)$/);
        if (pair) {
            var customField = dailyFieldByLabel(pair[1].trim());
            if (customField && !customField.path) {
                r.customFields[customField.id] = parseFloat(pair[2].replace(/,/g, '')) || 0;
                return;
            }
            r.pending.push({
                label: pair[1].trim(),
                value: parseFloat(pair[2].replace(/,/g, '')) || 0,
                raw: l
            });
        }
    });

    if (!r.delivery.total) r.delivery.total = (r.delivery.meituan || 0) + (r.delivery.taobao || 0) + (r.delivery.jd || 0);
    if (!r.payment.ar.total) r.payment.ar.total = (r.payment.ar.meituan || 0) + (r.payment.ar.douyin || 0);
    return r;
}

function resetDailyDraft() {
    _pd = parseDaily('');
    _dailyPendingParse = null;
    _dailyPendingSave = null;
    _dailySavedReport = null;
    _dailySaveMode = '';
    if ($id('dtInput')) $id('dtInput').value = '';
    renderDP();
    toast('已清空解析草稿');
}

function hasDailyDraftContent(report) {
    if (!report) return false;
    if (report.pending && report.pending.length) return true;
    if (report.rooms && report.rooms.length) return true;
    ['teaSales', 'cigSales', 'alcSales', 'otherSales', 'customFields'].some(function(key) {
        var value = report[key] || {};
        if (Object.keys(value).length) return true;
        return false;
    });
    return dailyScalarPaths().some(function(path) {
        var value = getDailyPath(report, path);
        return path !== 'date' && Number(value) !== 0;
    });
}

function requestDailyParse() {
    var text = $id('dtInput').value.trim();
    if (!text) { toast('请粘贴日报'); return; }
    var parsed = parseDaily(text);
    fixCigParsed(text, parsed);
    _pd = parsed;
    _dailyPendingParse = null;
    _dailySavedReport = null;
    _dailySaveMode = '';
    closeModal();
    renderDP();
}

function dailyScalarPaths() {
    return [
        'date', 'revenue.grossSales', 'revenue.discount', 'revenue.netSales',
        'revenue.kitchenSales', 'revenue.barSales', 'revenue.cigarette.total',
        'revenue.other', 'payment.pos', 'payment.ccbLife', 'payment.cash',
        'payment.memberCard', 'payment.treat', 'payment.ar.total',
        'payment.ar.meituan', 'payment.ar.douyin', 'delivery.total',
        'delivery.meituan', 'delivery.taobao', 'delivery.jd', 'guest.count',
        'guest.avgSpend', 'guest.premiumRoomsToday'
    ];
}

function getDailyPath(target, path) {
    return path.split('.').reduce(function(value, key) { return value ? value[key] : undefined; }, target);
}

function setDailyPath(target, path, value) {
    var keys = path.split('.');
    var last = keys.pop();
    var cursor = target;
    keys.forEach(function(key) { if (!cursor[key]) cursor[key] = {}; cursor = cursor[key]; });
    cursor[last] = value;
}

function prepareDailyParse(mode) {
    var text = $id('dtInput').value.trim();
    var parsed = parseDaily(text);
    fixCigParsed(text, parsed);
    if (mode === 'merge' && _dailySavedReport) {
        _pd = JSON.parse(JSON.stringify(_dailySavedReport));
        delete _pd.pending;
    }
    if (mode === 'merge' && _pd) {
        _dailyPendingParse = parsed;
        var conflicts = dailyScalarPaths().map(function(path) {
            return { path: path, current: getDailyPath(_pd, path), next: getDailyPath(parsed, path) };
        }).filter(function(item) { return String(item.current) !== String(item.next); });
        if (!conflicts.length) {
            applyDailyMerge({});
            return;
        }
        var h = '<h3>合并字段冲突</h3><p style="font-size:.76rem;color:var(--tx-m)">逐项选择要保留的值。未列出的字段直接使用新解析值补空。</p>';
        conflicts.forEach(function(item, index) {
            h += '<div class="hrow"><label>' + item.path + '</label><select class="inp" data-daily-conflict="' + item.path + '">';
            h += '<option value="current">现有：' + item.current + '</option><option value="next">新解析：' + item.next + '</option></select></div>';
        });
        h += '<div class="brow"><button class="btn" onclick="closeModal()">取消</button><button class="btn p" onclick="applyDailyMerge()">应用合并</button></div>';
        showModal(h, 620);
        return;
    }
    _pd = parsed;
    _dailySaveMode = _dailySavedReport ? mode : '';
    closeModal();
    renderDP();
}

function applyDailyMerge() {
    if (!_pd || !_dailyPendingParse) return;
    document.querySelectorAll('[data-daily-conflict]').forEach(function(select) {
        var path = select.dataset.dailyConflict;
        var value = select.value === 'next' ? getDailyPath(_dailyPendingParse, path) : getDailyPath(_pd, path);
        setDailyPath(_pd, path, value);
    });
    Object.keys(_dailyPendingParse).forEach(function(key) {
        if (dailyScalarPaths().indexOf(key) >= 0) return;
        if (!_pd[key] && _dailyPendingParse[key]) _pd[key] = _dailyPendingParse[key];
    });
    _pd.pending = (_pd.pending || []).concat(_dailyPendingParse.pending || []);
    _dailyPendingParse = null;
    _dailySaveMode = _dailySavedReport ? 'merge' : '';
    closeModal();
    renderDP();
    toast('已合并解析草稿');
}

function mapDailyPending(index) {
    if (!_pd || !_pd.pending[index]) return;
    var select = document.querySelector('[data-daily-pending="' + index + '"]');
    if (!select || !select.value) return;
    var item = _pd.pending[index];
    setDailyPath(_pd, select.value, item.value);
    _pd.pending.splice(index, 1);
    renderDP();
}

function removeDailyPending(index) {
    if (!_pd || !_pd.pending[index]) return;
    _pd.pending.splice(index, 1);
    renderDP();
}

// 解析香烟数据补丁
function fixCigParsed(text, result) {
    var lines = text.split('\n');
    for (var i = 0; i < lines.length; i++) {
        var l = lines[i];
        if (l.indexOf('香烟') < 0) continue;
        var m = l.match(/[（(]([\s\S]+?)[）)]/);
        if (!m) continue;
        var inner = m[1].replace(/、/g, ',').replace(/，/g, ',');
        inner.split(',').forEach(function(part) {
            part = part.trim();
            if (!part) return;
            // 支持多种格式：
            // 1. 品牌:数量 (如 "金皖:3包")
            // 2. 品牌数量包 (如 "紫徽2包")
            var im = part.match(/(.+?)[：:](\d+)/);
            if (!im) {
                // 尝试匹配"品牌数量包"格式
                im = part.match(/(.+?)(\d+)包/);
            }
            if (im) {
                var nm = im[1].trim(), qt = parseInt(im[2]);
                if (nm && qt >= 0) result.revenue.cigarette.items[nm] = qt;
            }
        });
        return;
    }
}

function dailyFieldGroups(fields) {
    var groups = [];
    fields.filter(function(field) { return field.visible; }).sort(function(a, b) { return a.order - b.order; }).forEach(function(field) {
        var group = groups.find(function(item) { return item.name === field.group; });
        if (!group) {
            group = { name: field.group, fields: [] };
            groups.push(group);
        }
        group.fields.push(field);
    });
    return groups;
}

function dailyFieldValue(report, field) {
    if (field.path) return getDailyPath(report, field.path) || 0;
    if (!report.customFields) report.customFields = {};
    return report.customFields[field.id] || 0;
}

function dailyFieldByLabel(label) {
    return (getAppConfig().dailyFieldDefinitions || []).find(function(field) {
        return field.visible && field.label === String(label || '').trim();
    }) || null;
}

function renderDailyConfiguredFields(report) {
    var fields = (getAppConfig().dailyFieldDefinitions || []).slice();
    var output = '';
    dailyFieldGroups(fields).forEach(function(group) {
        output += '<div class="pv-card"><h4>' + group.name + '</h4>';
        group.fields.forEach(function(field) {
            if (field.type === 'rooms') {
                output += '<div id="dailyRoomsConfigured">';
                if (report.rooms && report.rooms.length) {
                    output += '<table style="width:100%;border-collapse:collapse;font-size:.78rem">';
                    output += '<tr><th style="text-align:left;padding:6px 8px;background:var(--card-h);border-bottom:1px solid var(--bd)">姓名</th><th style="text-align:right;padding:6px 8px;background:var(--card-h);border-bottom:1px solid var(--bd)">今日</th><th style="text-align:right;padding:6px 8px;background:var(--card-h);border-bottom:1px solid var(--bd)">累计</th></tr>';
                    report.rooms.forEach(function(room) {
                        output += '<tr><td style="padding:6px 8px;border-bottom:1px solid var(--bd-l)">' + room.name + '</td>';
                        output += '<td style="padding:6px 8px;border-bottom:1px solid var(--bd-l);text-align:right">' + room.today + '</td>';
                        output += '<td style="padding:6px 8px;border-bottom:1px solid var(--bd-l);text-align:right">' + room.cum + '</td></tr>';
                    });
                    output += '</table>';
                } else {
                    output += '<div style="font-size:.75rem;color:var(--tx-m)">无包厢预定记录</div>';
                }
                output += '</div>';
                return;
            }
            var value = dailyFieldValue(report, field);
            var path = field.path || ('custom.' + field.id);
            output += '<div class="pv-row"><span class="k">' + field.label + '</span>';
            output += '<input class="ed-input" type="number" step="0.01" value="' + value + '"' + (field.readonly ? ' readonly style="background:var(--card-h)"' : '') + ' oninput="setDVal(\'' + path + '\',this.value)" aria-label="' + field.label + '"></div>';
        });
        output += '</div>';
    });
    return output;
}

function calculateDailyFieldStats(reports, fields) {
    var totals = { revenue: 0, cost: 0, payment: 0, receivable: 0, delivery: 0, guest: 0, none: 0 };
    (reports || []).forEach(function(report) {
        (fields || []).forEach(function(field) {
            if (field.type === 'rooms' || field.path) return;
            var value = Number(dailyFieldValue(report, field)) || 0;
            if (totals[field.statistic] === undefined) totals[field.statistic] = 0;
            totals[field.statistic] += value;
        });
    });
    return totals;
}

// 日报预览
function renderDP() {
    var r = _pd;
    if (!r) return;

    var inpRow = function(l, v, pa, ro) {
        return '<div class="pv-row"><span class="k">' + l + '</span>' +
            '<input class="ed-input" type="number" step="0.01" value="' + v + '"' +
            (ro ? ' readonly style="background:var(--card-h)"' : '') +
            ' oninput="setDVal(\'' + pa + '\',this.value)"></div>';
    };

    var h = '';
    if (r.pending && r.pending.length) {
        h += '<div class="pv-card"><h4>待确认字段（' + r.pending.length + '）</h4>';
        h += '<p style="font-size:.72rem;color:var(--tx-m)">映射或删除全部字段后才能保存。</p>';
        r.pending.forEach(function(item, index) {
            h += '<div class="pv-row"><span class="k">' + item.label + '：' + item.value + '</span><span>';
            h += '<select class="inp" data-daily-pending="' + index + '" aria-label="映射待确认字段"><option value="">选择正式字段</option>';
            h += '<option value="revenue.grossSales">流水</option><option value="revenue.netSales">实收</option>';
            h += '<option value="revenue.other">其他收入</option><option value="guest.count">人数</option>';
            h += '<option value="guest.avgSpend">人均</option></select> ';
            h += '<button class="btn s" onclick="mapDailyPending(' + index + ')">映射</button> ';
            h += '<button class="btn s d" onclick="removeDailyPending(' + index + ')">删除</button></span></div>';
        });
        h += '</div>';
    }

    // 日期选择
    h += '<div class="pv-card"><h4>日期</h4>';
    h += '<div class="pv-row"><span class="k">日报日期</span>';
    h += '<input class="ed-input" id="dpDate" type="text" readonly value="' + r.date + '" onclick="_dpOpen(\'dpDate\')" onchange="setDVal(\'date\',this.value)" style="cursor:pointer;width:140px"></div>';
    h += '</div>';

    h += renderDailyConfiguredFields(r);

    // 茗茶销售
    h += '<div class="pv-card"><h4>茗茶销售</h4>';
    DB.teaItems.forEach(function(item) {
        var sv = r.teaSales && r.teaSales[item.id];
        var cups = sv ? sv.cups || 0 : 0;
        var pots = sv ? sv.pots || 0 : 0;
        var expected = cups * (item.pricePerCup || 0) + pots * (item.pricePerPot || 0);
        var amt = sv ? sv.amount || 0 : 0;
        h += '<div class="tea-sale-row" data-tid="' + item.id + '">';
        h += '<label>' + item.name + '</label>';
        h += '杯:<input class="ed-input tea-cups" type="number" value="' + cups + '" style="width:50px" oninput="calcTeaExpected(this)"> ';
        h += '壶:<input class="ed-input tea-pots" type="number" value="' + pots + '" style="width:50px" oninput="calcTeaExpected(this)"> ';
        h += '应收:<input class="ed-input tea-expected" type="number" step="0.01" value="' + expected + '" data-prev-expected="' + expected + '" style="width:80px;background:var(--card-h)" readonly> ';
        h += '实收:<input class="ed-input tea-amt" type="number" step="0.01" value="' + amt + '" style="width:80px">';
        h += '</div>';
    });
    h += '</div>';

    // 香烟销售
    var parsedCig = r.revenue.cigarette.items || {};
    h += '<div class="pv-card"><h4>香烟销售</h4>';
    DB.cigItems.forEach(function(item) {
        var sv = r.cigSales && r.cigSales[item.id];
        var dq = 0, da = 0;
        if (sv) {
            dq = sv.qty || 0;
            da = sv.amount || 0;
        } else {
            // 提取括号内的品牌名
            var bracketMatch = item.name.match(/[（(]([\s\S]+?)[）)]/);
            var itemNameInBracket = bracketMatch ? bracketMatch[1] : item.name;
            var itemNameClean = itemNameInBracket.replace(/黄山|（|）|\(|\)/g, '');

            // 找出所有匹配的解析键名，选择最佳匹配
            var bestMatch = null;
            var bestScore = -1;
            Object.keys(parsedCig).forEach(function(k) {
                if (!parsedCig[k]) return;
                var keyClean = k.replace(/黄山|（|）|\(|\)/g, '');
                // 精确匹配：清理后的名称必须完全相同
                if (itemNameClean === keyClean) {
                    // 完全匹配得分最高
                    var score = 1000 + keyClean.length;
                    if (score > bestScore) {
                        bestMatch = k;
                        bestScore = score;
                    }
                }
                // 模糊匹配：解析键名必须完整包含在品牌名中
                else if (keyClean.length >= 2 && itemNameClean.indexOf(keyClean) === 0) {
                    // 只有当解析键名在品牌名开头时才匹配
                    // 避免"徽商"匹配到"黄徽商新世界"
                    var score = 500 + keyClean.length;
                    if (score > bestScore) {
                        bestMatch = k;
                        bestScore = score;
                    }
                }
            });

            // 如果找到匹配，使用该解析键名的数量
            if (bestMatch) {
                dq = parsedCig[bestMatch];
                da = dq * (item.pricePerUnit || 0);
            }
        }
        h += '<div class="tea-sale-row" data-cid="' + item.id + '">';
        h += '<label>' + item.name + '</label>';
        h += '数量:<input class="ed-input cig-sqty" type="number" value="' + dq + '" style="width:60px" oninput="calcCigExpected(this)"> ';
        h += '应收:<input class="ed-input cig-expected" type="number" step="0.01" value="' + (Math.round(da * 100) / 100) + '" data-prev-expected="' + (Math.round(da * 100) / 100) + '" style="width:80px;background:var(--card-h)" readonly>';
        h += '实收:<input class="ed-input cig-samt" type="number" step="0.01" value="' + (Math.round(da * 100) / 100) + '" style="width:80px">';
        h += '</div>';
    });
    if (!DB.cigItems.length && Object.keys(parsedCig).length) {
        Object.keys(parsedCig).forEach(function(nm) {
            if (parsedCig[nm] > 0) {
                h += '<div style="font-size:.78rem;padding:4px 0;color:var(--ac)">' + nm + ': ' + parsedCig[nm] + '包（请先在香烟管理添加物品）</div>';
            }
        });
    }
    h += '</div>';

    // 酒类销售
    h += '<div class="pv-card"><h4>酒类销售</h4>';
    DB.alcItems.forEach(function(item) {
        var sv = r.alcSales && r.alcSales[item.id];
        var dq = sv ? sv.qty || 0 : 0;
        var da = sv ? sv.amount || 0 : 0;
        h += '<div class="tea-sale-row" data-aid="' + item.id + '">';
        h += '<label>' + item.name + '</label>';
        h += '数量:<input class="ed-input alc-sqty" type="number" value="' + dq + '" style="width:60px" oninput="calcAlcExpected(this)"> ';
        h += '应收:<input class="ed-input alc-expected" type="number" step="0.01" value="' + (Math.round(da * 100) / 100) + '" data-prev-expected="' + (Math.round(da * 100) / 100) + '" style="width:80px;background:var(--card-h)" readonly>';
        h += '实收:<input class="ed-input alc-samt" type="number" step="0.01" value="' + (Math.round(da * 100) / 100) + '" style="width:80px">';
        h += '</div>';
    });
    h += '</div>';

    // 其他贵重物品销售
    h += '<div class="pv-card"><h4>其他贵重物品</h4>';
    DB.otherItems.forEach(function(item) {
        var sv = r.otherSales && r.otherSales[item.id];
        var dq = sv ? sv.qty || 0 : 0;
        var da = sv ? sv.amount || 0 : 0;
        h += '<div class="tea-sale-row" data-oid="' + item.id + '">';
        h += '<label>' + item.name + '</label>';
        h += '数量:<input class="ed-input other-sqty" type="number" value="' + dq + '" style="width:60px" oninput="calcOtherExpected(this)"> ';
        h += '应收:<input class="ed-input other-expected" type="number" step="0.01" value="' + (Math.round(da * 100) / 100) + '" data-prev-expected="' + (Math.round(da * 100) / 100) + '" style="width:80px;background:var(--card-h)" readonly>';
        h += '实收:<input class="ed-input other-samt" type="number" step="0.01" value="' + (Math.round(da * 100) / 100) + '" style="width:80px">';
        h += '</div>';
    });
    h += '</div>';

    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end;gap:10px">';
    h += '<button class="btn p" onclick="saveDaily()">保存</button>';
    h += '</div>';

    $id('dailyPreview').innerHTML = h;
}

// 日报预览输入框变化时更新数据
function setDVal(pa, val) {
    if (pa.indexOf('custom.') === 0) {
        if (!_pd.customFields) _pd.customFields = {};
        _pd.customFields[pa.slice(7)] = parseFloat(val) || 0;
        return;
    }
    var p = pa.split('.'), o = _pd;
    for (var i = 0; i < p.length - 1; i++) o = o[p[i]];
    // 日期字段特殊处理
    if (pa === 'date') {
        o[p[p.length - 1]] = val;
    } else {
        o[p[p.length - 1]] = parseFloat(val) || 0;
    }
    if (pa.indexOf('delivery.') === 0 && pa !== 'delivery.total')
        _pd.delivery.total = (_pd.delivery.meituan || 0) + (_pd.delivery.taobao || 0) + (_pd.delivery.jd || 0);
    if (pa.indexOf('payment.ar.') === 0 && pa !== 'payment.ar.total')
        _pd.payment.ar.total = (_pd.payment.ar.meituan || 0) + (_pd.payment.ar.douyin || 0);
}

// 日报标签匹配：将粘贴文字中的标签（如"流水"、"厨房"、"POS"等）映射到日报数据结构的对应字段
// 没有匹配到的标签归入 otherItems（其他收入明细）
function matchLabel(lb, v, r, f) {
    if (lb.indexOf('流水') >= 0) { r.revenue.grossSales = v; return; }
    if (lb.indexOf('实收') >= 0 && lb.indexOf('厨房') < 0 && lb.indexOf('吧台') < 0) { r.revenue.netSales = v; return; }
    if (lb.indexOf('厨房') >= 0) { r.revenue.kitchenSales = v; return; }
    if (lb.indexOf('吧台') >= 0) { r.revenue.barSales = v; return; }
    if (lb.indexOf('折扣') >= 0) { r.revenue.discount = v; return; }
    if (lb.indexOf('香烟') >= 0) { r.revenue.cigarette.total = v; return; }
    if (lb.indexOf('其他') >= 0) { r.revenue.other = v; return; }
    if (lb.toUpperCase().indexOf('POS') >= 0) { r.payment.pos = v; return; }
    if (lb.indexOf('建行') >= 0) { r.payment.ccbLife = v; return; }
    if (lb.indexOf('现金') >= 0 || lb.indexOf('人民币') >= 0) { r.payment.cash = v; return; }
    if (lb.indexOf('会员') >= 0) { r.payment.memberCard = v; return; }
    if (lb.indexOf('招待') >= 0) { r.payment.treat = v; return; }
    if (lb.indexOf('美团团购') >= 0) { r.payment.ar.meituan = v; return; }
    if (lb.indexOf('抖音团购') >= 0) { r.payment.ar.douyin = v; return; }
    if (lb.indexOf('应收') >= 0) { r.payment.ar.total = v; f.hasAR = true; return; }
    if (lb.indexOf('美团外卖') >= 0) { r.delivery.meituan = v; return; }
    if (lb.indexOf('淘宝') >= 0) { r.delivery.taobao = v; return; }
    if (lb.indexOf('京东') >= 0) { r.delivery.jd = v; return; }
    if (lb.indexOf('外卖') >= 0) { r.delivery.total = v; f.hasDel = true; return; }
    if (lb.indexOf('人数') >= 0) { r.guest.count = v; return; }
    if (lb.indexOf('人均') >= 0) { r.guest.avgSpend = v; return; }
    r.revenue.otherItems[lb] = { qty: 0, amount: v };
}

// 保存日报
function saveDaily(mode) {
    if (!_pd) return;
    if (_pd.pending && _pd.pending.length) {
        toast('请先处理全部待确认字段');
        return;
    }
    var existingReport = (DB.dailyReports || []).find(function(report) { return report.date === _pd.date; });
    if (!existingReport) {
        finalizeDailySave('overwrite');
        return;
    }
    if (!mode) {
        var h = '<h3 style="margin-bottom:10px">' + _pd.date + ' 已有日报</h3>';
        h += '<p style="margin:0 0 22px;color:var(--tx-s);font-size:.78rem;line-height:1.6">请选择本次草稿如何处理已经保存的日报。</p>';
        h += '<div class="brow" style="justify-content:flex-end;flex-wrap:wrap;margin-top:24px;gap:10px">';
        h += '<button class="btn p" onclick="saveDaily(\'merge\')">合并</button>';
        h += '<button class="btn d" onclick="saveDaily(\'overwrite\')">覆盖</button>';
        h += '<button class="btn" onclick="closeModal()">取消</button></div>';
        showModal(h, 520);
        return;
    }
    if (mode === 'merge') {
        openDailySaveMerge(existingReport, _pd);
        return;
    }
    _dailySavedReport = existingReport;
    _dailySaveMode = 'overwrite';
    closeModal();
    finalizeDailySave('overwrite');
}

function openDailySaveMerge(existingReport, nextReport) {
    _dailySavedReport = existingReport;
    _dailyPendingSave = nextReport;
    var conflicts = dailyScalarPaths().map(function(path) {
        return { path: path, current: getDailyPath(existingReport, path), next: getDailyPath(nextReport, path) };
    }).filter(function(item) { return String(item.current) !== String(item.next); });
    if (!conflicts.length) {
        applyDailySaveMerge();
        return;
    }
    var h = '<h3>合并字段冲突</h3><p style="font-size:.76rem;color:var(--tx-m)">逐项选择保留已保存值或本次录入值。</p>';
    conflicts.forEach(function(item) {
        h += '<div class="hrow"><label>' + item.path + '</label><select class="inp" data-daily-save-conflict="' + item.path + '">';
        h += '<option value="current">已保存：' + item.current + '</option><option value="next">本次录入：' + item.next + '</option></select></div>';
    });
    h += '<div class="brow"><button class="btn" onclick="closeModal()">取消</button><button class="btn p" onclick="applyDailySaveMerge()">应用合并</button></div>';
    showModal(h, 620);
}

function applyDailySaveMerge() {
    if (!_dailySavedReport || !_dailyPendingSave) return;
    var merged = JSON.parse(JSON.stringify(_dailySavedReport));
    document.querySelectorAll('[data-daily-save-conflict]').forEach(function(select) {
        var path = select.dataset.dailySaveConflict;
        var value = select.value === 'next' ? getDailyPath(_dailyPendingSave, path) : getDailyPath(_dailySavedReport, path);
        setDailyPath(merged, path, value);
    });
    ['teaSales', 'cigSales', 'alcSales', 'otherSales', 'customFields', 'rooms'].forEach(function(key) {
        var nextValue = _dailyPendingSave[key];
        var hasValue = Array.isArray(nextValue) ? nextValue.length : nextValue && Object.keys(nextValue).length;
        if (hasValue) merged[key] = JSON.parse(JSON.stringify(nextValue));
    });
    merged.pending = [];
    _pd = merged;
    _dailyPendingSave = null;
    _dailySaveMode = 'merge';
    closeModal();
    finalizeDailySave('merge');
}

function finalizeDailySave(mode) {
    if (!_pd) return;
    if (_pd.pending && _pd.pending.length) {
        toast('请先处理全部待确认字段');
        return;
    }
    delete _pd.pending;

    // 检查是否已有该日期的数据
    var existingReport = DB.dailyReports.find(function(d) { return d.date === _pd.date; });
    if (existingReport && !_dailySaveMode) {
        if (!confirm('⚠️ ' + _pd.date + ' 已有日报数据，确定要覆盖吗？\n\n覆盖后原数据将被删除。')) {
            return;
        }
    }

    upd(function(db) {
        var oldReport = db.dailyReports.find(function(d) { return d.date === _pd.date; });

        // 清除旧的茗茶/香烟/酒类/其他销售记录
        if (oldReport) {
            Object.keys(oldReport.teaSales || {}).forEach(function(tid) {
                var item = db.teaItems.find(function(t) { return t.id === tid; });
                if (item) item.sales = item.sales.filter(function(s) { return s.date !== _pd.date; });
            });
            Object.keys(oldReport.cigSales || {}).forEach(function(cid) {
                var item = db.cigItems.find(function(c) { return c.id === cid; });
                if (item) item.sales = item.sales.filter(function(s) { return s.date !== _pd.date; });
            });
            Object.keys(oldReport.alcSales || {}).forEach(function(aid) {
                var item = db.alcItems.find(function(a) { return a.id === aid; });
                if (item) item.sales = item.sales.filter(function(s) { return s.date !== _pd.date; });
            });
            Object.keys(oldReport.otherSales || {}).forEach(function(oid) {
                var item = db.otherItems.find(function(o) { return o.id === oid; });
                if (item) item.sales = item.sales.filter(function(s) { return s.date !== _pd.date; });
            });
        }

        // 茗茶销售
        document.querySelectorAll('.tea-sale-row[data-tid]').forEach(function(row) {
            var id = row.dataset.tid;
            var item = db.teaItems.find(function(t) { return t.id === id; });
            if (!item) return;
            var cups = parseInt(row.querySelector('.tea-cups').value) || 0;
            var pots = parseInt(row.querySelector('.tea-pots').value) || 0;
            var expected = parseFloat(row.querySelector('.tea-expected').value) || 0;
            var amt = parseFloat(row.querySelector('.tea-amt').value) || expected;
            if (cups > 0 || pots > 0 || amt > 0) {
                _pd.teaSales[id] = { cups: cups, pots: pots, expectedAmount: expected, amount: amt };
                // 检查是否已有该日期的记录，有则更新，无则添加
                var existingIdx = item.sales.findIndex(function(s) { return s.date === _pd.date; });
                if (existingIdx >= 0) {
                    item.sales[existingIdx] = { date: _pd.date, cups: cups, pots: pots, expectedAmount: expected, amount: amt };
                } else {
                    item.sales.push({ date: _pd.date, cups: cups, pots: pots, expectedAmount: expected, amount: amt });
                }
            }
        });

        // 香烟销售
        var cigTotal = 0;
        document.querySelectorAll('.tea-sale-row[data-cid]').forEach(function(row) {
            var id = row.dataset.cid;
            var item = db.cigItems.find(function(c) { return c.id === id; });
            if (!item) return;
            var qty = parseInt(row.querySelector('.cig-sqty').value) || 0;
            var expected = parseFloat(row.querySelector('.cig-expected').value) || 0;
            var amt = parseFloat(row.querySelector('.cig-samt').value) || 0;
            // 不填实收默认按应收入账
            if (amt === 0 && expected > 0) amt = expected;
            if (qty > 0 || amt > 0) {
                _pd.cigSales[id] = { qty: qty, expectedAmount: expected, amount: amt };
                // 检查是否已有该日期的记录，有则更新，无则添加
                var existingIdx = item.sales.findIndex(function(s) { return s.date === _pd.date; });
                if (existingIdx >= 0) {
                    item.sales[existingIdx] = { date: _pd.date, qty: qty, expectedAmount: expected, amount: amt };
                } else {
                    item.sales.push({ date: _pd.date, qty: qty, expectedAmount: expected, amount: amt });
                }
                cigTotal += amt;
            }
        });
        if (cigTotal > 0) _pd.revenue.cigarette.total = cigTotal;

        // 酒类销售
        var alcTotal = 0;
        document.querySelectorAll('.tea-sale-row[data-aid]').forEach(function(row) {
            var id = row.dataset.aid;
            var item = db.alcItems.find(function(a) { return a.id === id; });
            if (!item) return;
            var qty = parseInt(row.querySelector('.alc-sqty').value) || 0;
            var expected = parseFloat(row.querySelector('.alc-expected').value) || 0;
            var amt = parseFloat(row.querySelector('.alc-samt').value) || 0;
            if (amt === 0 && expected > 0) amt = expected;
            if (qty > 0 || amt > 0) {
                _pd.alcSales[id] = { qty: qty, expectedAmount: expected, amount: amt };
                // 检查是否已有该日期的记录，有则更新，无则添加
                var existingIdx = item.sales.findIndex(function(s) { return s.date === _pd.date; });
                if (existingIdx >= 0) {
                    item.sales[existingIdx] = { date: _pd.date, qty: qty, expectedAmount: expected, amount: amt };
                } else {
                    item.sales.push({ date: _pd.date, qty: qty, expectedAmount: expected, amount: amt });
                }
                alcTotal += amt;
            }
        });

        // 其他贵重物品销售
        var otherTotal = 0;
        document.querySelectorAll('.tea-sale-row[data-oid]').forEach(function(row) {
            var id = row.dataset.oid;
            var item = db.otherItems.find(function(o) { return o.id === id; });
            if (!item) return;
            var qty = parseFloat(row.querySelector('.other-sqty').value) || 0;
            var expected = parseFloat(row.querySelector('.other-expected').value) || 0;
            var amt = parseFloat(row.querySelector('.other-samt').value) || 0;
            if (amt === 0 && expected > 0) amt = expected;
            if (qty > 0 || amt > 0) {
                _pd.otherSales[id] = { qty: qty, expectedAmount: expected, amount: amt };
                // 检查是否已有该日期的记录，有则更新，无则添加
                var existingIdx = item.sales.findIndex(function(s) { return s.date === _pd.date; });
                if (existingIdx >= 0) {
                    item.sales[existingIdx] = { date: _pd.date, qty: qty, expectedAmount: expected, amount: amt };
                } else {
                    item.sales.push({ date: _pd.date, qty: qty, expectedAmount: expected, amount: amt });
                }
                otherTotal += amt;
            }
        });

        // 保存日报
        var idx = db.dailyReports.findIndex(function(d) { return d.date === _pd.date; });
        if (idx >= 0) db.dailyReports[idx] = _pd;
        else db.dailyReports.push(_pd);
    });

    // 自动校验日报
    var savedReport = DB.dailyReports.find(function(d) { return d.date === _pd.date; });
    if (savedReport) autoCheckDaily(savedReport);

    toast('已保存');
    _pd = null;
    _dailySavedReport = null;
    _dailySaveMode = '';
    rDaily();
}

// ------ 日报详情弹窗 ------
// 日报弹窗（只读模式）
function showDailyModal(date) {
    var r = DB.dailyReports.find(function(d) { return d.date === date; });
    if (!r) { toast('未找到日报'); return; }

    var h = '<h3>' + date + ' 日报</h3>';
    h += '<div style="max-height:60vh;overflow-y:auto;padding-right:4px">';

    // 营收
    h += '<div class="section-label">营收</div>';
    h += '<div class="pv-row"><span class="k">流水</span><span>' + fmtC(r.revenue.grossSales || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">折扣</span><span>' + fmtC(r.revenue.discount || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">实收</span><span style="color:var(--ac);font-weight:600">' + fmtC(r.revenue.netSales || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">厨房</span><span>' + fmtC(r.revenue.kitchenSales || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">吧台</span><span>' + fmtC(r.revenue.barSales || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">香烟</span><span>' + fmtC(r.revenue.cigarette.total || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">其他</span><span>' + fmtC(r.revenue.other || 0) + '</span></div>';

    // 支付
    h += '<div class="section-label">支付</div>';
    h += '<div class="pv-row"><span class="k">POS机</span><span>' + fmtC(r.payment.pos || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">建行生活</span><span>' + fmtC(r.payment.ccbLife || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">现金</span><span>' + fmtC(r.payment.cash || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">会员刷卡</span><span>' + fmtC(r.payment.memberCard || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">招待</span><span>' + fmtC(r.payment.treat || 0) + '</span></div>';

    // 应收
    h += '<div class="section-label">应收账款</div>';
    h += '<div class="pv-row"><span class="k">美团团购</span><span>' + fmtC(r.payment.ar.meituan || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">抖音团购</span><span>' + fmtC(r.payment.ar.douyin || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">合计</span><span style="font-weight:600">' + fmtC(r.payment.ar.total || 0) + '</span></div>';

    // 外卖
    h += '<div class="section-label">外卖</div>';
    h += '<div class="pv-row"><span class="k">美团外卖</span><span>' + fmtC(r.delivery.meituan || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">淘宝</span><span>' + fmtC(r.delivery.taobao || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">京东</span><span>' + fmtC(r.delivery.jd || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">合计</span><span style="font-weight:600">' + fmtC(r.delivery.total || 0) + '</span></div>';

    // 客情
    h += '<div class="section-label">客情</div>';
    h += '<div class="pv-row"><span class="k">人数</span><span>' + (r.guest.count || 0) + '人</span></div>';
    h += '<div class="pv-row"><span class="k">人均</span><span>' + fmtC(r.guest.avgSpend || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">500+包厢</span><span>' + (r.guest.premiumRoomsToday || 0) + '</span></div>';

    // 包厢预定
    if (r.rooms && r.rooms.length) {
        h += '<div class="section-label">包厢预定</div>';
        if (r.premiumRooms && r.premiumRooms.cum) {
            h += '<div class="pv-row"><span class="k">累计500+包厢</span><span style="color:var(--ac);font-weight:600">' + r.premiumRooms.cum + '</span></div>';
        }
        h += '<div class="tw"><table><tr><th>姓名</th><th>今日</th><th>累计</th></tr>';
        r.rooms.forEach(function(room) {
            h += '<tr><td>' + room.name + '</td>';
            h += '<td class="nr">' + (room.today || 0) + '</td>';
            h += '<td class="nr">' + (room.cum || 0) + '</td></tr>';
        });
        h += '</table></div>';
    }


    // 茗茶销售
    if (r.teaSales && Object.keys(r.teaSales).length) {
        h += '<div class="section-label">茗茶销售</div>';
        h += '<div class="tw"><table><tr><th>茶品</th><th>杯</th><th>壶</th><th>金额</th></tr>';
        Object.keys(r.teaSales).forEach(function(id) {
            var s = r.teaSales[id];
            var item = DB.teaItems.find(function(t) { return t.id === id; });
            h += '<tr><td>' + (item ? item.name : id) + '</td>';
            h += '<td class="nr">' + (s.cups || 0) + '</td>';
            h += '<td class="nr">' + (s.pots || 0) + '</td>';
            h += '<td class="nr">' + fmtC(s.amount || 0) + '</td></tr>';
        });
        h += '</table></div>';
    }

    // 香烟销售
    if (r.cigSales && Object.keys(r.cigSales).length) {
        h += '<div class="section-label">香烟销售</div>';
        h += '<div class="tw"><table><tr><th>品牌</th><th>数量</th><th>金额</th></tr>';
        Object.keys(r.cigSales).forEach(function(id) {
            var s = r.cigSales[id];
            var item = DB.cigItems.find(function(c) { return c.id === id; });
            h += '<tr><td>' + (item ? item.name : id) + '</td>';
            h += '<td class="nr">' + (s.qty || 0) + '</td>';
            h += '<td class="nr">' + fmtC(s.amount || 0) + '</td></tr>';
        });
        h += '</table></div>';
    }

    // 酒类销售
    if (r.alcSales && Object.keys(r.alcSales).length) {
        h += '<div class="section-label">酒类销售</div>';
        h += '<div class="tw"><table><tr><th>酒品</th><th>数量</th><th>金额</th></tr>';
        Object.keys(r.alcSales).forEach(function(id) {
            var s = r.alcSales[id];
            var item = DB.alcItems.find(function(a) { return a.id === id; });
            h += '<tr><td>' + (item ? item.name : id) + '</td>';
            h += '<td class="nr">' + (s.qty || 0) + '</td>';
            h += '<td class="nr">' + fmtC(s.amount || 0) + '</td></tr>';
        });
        h += '</table></div>';
    }

    // 其他贵重物品销售
    if (r.otherSales && Object.keys(r.otherSales).length) {
        h += '<div class="section-label">其他贵重物品销售</div>';
        h += '<div class="tw"><table><tr><th>物品</th><th>数量</th><th>金额</th></tr>';
        Object.keys(r.otherSales).forEach(function(id) {
            var s = r.otherSales[id];
            var item = DB.otherItems.find(function(o) { return o.id === id; });
            h += '<tr><td>' + (item ? item.name : id) + '</td>';
            h += '<td class="nr">' + (s.qty || 0) + '</td>';
            h += '<td class="nr">' + fmtC(s.amount || 0) + '</td></tr>';
        });
        h += '</table></div>';
    }

    // 汇报人
    if (r.reporter) {
        h += '<div class="pv-row"><span class="k">汇报人</span><span>' + r.reporter + '</span></div>';
    }

    h += '</div>';

    // 按钮
    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end">';
    h += '<button class="btn p" onclick="editDailyModal(' + sq(date) + ')">修改</button>';
    h += '<button class="btn d" onclick="delDailyFromModal(' + sq(date) + ')">删除</button>';
    h += '<button class="btn" onclick="showDailyCheck(' + sq(date) + ')">校验</button>';
    h += '<button class="btn" onclick="closeModal()">关闭</button>';
    h += '</div>';

    showModal(h, 700);
}
// 日报弹窗（编辑模式）
function editDailyModal(date) {
    var r = DB.dailyReports.find(function(d) { return d.date === date; });
    if (!r) { toast('未找到日报'); return; }

    var h = '<h3>' + date + ' 日报 · 编辑</h3>';
    h += '<div style="max-height:60vh;overflow-y:auto;padding-right:4px">';

    // 营收
    h += '<div class="section-label">营收</div>';
    h += '<div class="hrow"><label>流水</label><input class="inp" id="dm_gross" type="number" step="0.01" value="' + (r.revenue.grossSales || 0) + '"></div>';
    h += '<div class="hrow"><label>折扣</label><input class="inp" id="dm_discount" type="number" step="0.01" value="' + (r.revenue.discount || 0) + '">';
    h += '<label>实收</label><input class="inp" id="dm_net" type="number" step="0.01" value="' + (r.revenue.netSales || 0) + '"></div>';
    h += '<div class="hrow"><label>厨房</label><input class="inp" id="dm_kitchen" type="number" step="0.01" value="' + (r.revenue.kitchenSales || 0) + '">';
    h += '<label>吧台</label><input class="inp" id="dm_bar" type="number" step="0.01" value="' + (r.revenue.barSales || 0) + '"></div>';
    h += '<div class="hrow"><label>香烟</label><input class="inp" id="dm_cig" type="number" step="0.01" value="' + (r.revenue.cigarette.total || 0) + '">';
    h += '<label>其他</label><input class="inp" id="dm_other" type="number" step="0.01" value="' + (r.revenue.other || 0) + '"></div>';

    // 支付
    h += '<div class="section-label">支付</div>';
    h += '<div class="hrow"><label>POS</label><input class="inp" id="dm_pos" type="number" step="0.01" value="' + (r.payment.pos || 0) + '">';
    h += '<label>建行</label><input class="inp" id="dm_ccb" type="number" step="0.01" value="' + (r.payment.ccbLife || 0) + '"></div>';
    h += '<div class="hrow"><label>现金</label><input class="inp" id="dm_cash" type="number" step="0.01" value="' + (r.payment.cash || 0) + '">';
    h += '<label>会员</label><input class="inp" id="dm_member" type="number" step="0.01" value="' + (r.payment.memberCard || 0) + '"></div>';
    h += '<div class="hrow"><label>招待</label><input class="inp" id="dm_treat" type="number" step="0.01" value="' + (r.payment.treat || 0) + '"></div>';

    // 应收
    h += '<div class="section-label">应收</div>';
    h += '<div class="hrow"><label>美团团购</label><input class="inp" id="dm_meituan" type="number" step="0.01" value="' + (r.payment.ar.meituan || 0) + '">';
    h += '<label>抖音团购</label><input class="inp" id="dm_douyin" type="number" step="0.01" value="' + (r.payment.ar.douyin || 0) + '"></div>';

    // 外卖
    h += '<div class="section-label">外卖</div>';
    h += '<div class="hrow"><label>美团外卖</label><input class="inp" id="dm_d_meituan" type="number" step="0.01" value="' + (r.delivery.meituan || 0) + '">';
    h += '<label>淘宝</label><input class="inp" id="dm_d_taobao" type="number" step="0.01" value="' + (r.delivery.taobao || 0) + '"></div>';
    h += '<div class="hrow"><label>京东</label><input class="inp" id="dm_d_jd" type="number" step="0.01" value="' + (r.delivery.jd || 0) + '"></div>';

    // 客情
    h += '<div class="section-label">客情</div>';
    h += '<div class="hrow"><label>人数</label><input class="inp" id="dm_count" type="number" value="' + (r.guest.count || 0) + '">';
    h += '<label>人均</label><input class="inp" id="dm_avg" type="number" step="0.01" value="' + (r.guest.avgSpend || 0) + '">';
    h += '<label>500+包厢</label><input class="inp" id="dm_premium" type="number" value="' + (r.guest.premiumRoomsToday || 0) + '"></div>';

    // 包厢预定
    h += '<div class="section-label">包厢预定</div>';
    if (r.rooms && r.rooms.length) {
        h += '<div id="editRoomRows">';
        r.rooms.forEach(function(room, i) {
            h += '<div class="hrow room-row">';
            h += '<input class="inp room-name" value="' + room.name + '" style="flex:1.5">';
            h += '<input class="inp room-today" type="number" value="' + (room.today || 0) + '" style="max-width:60px">';
            h += '<input class="inp room-cum" type="number" value="' + (room.cum || 0) + '" style="max-width:60px">';
            h += '<button class="btn s d" onclick="this.parentElement.remove()">×</button></div>';
        });
        h += '</div>';
    } else {
        h += '<div id="editRoomRows"></div>';
    }
    h += '<div class="hrow"><label>累计500+</label><input class="inp" id="dm_edit_premCum" type="number" value="' + ((r.premiumRooms && r.premiumRooms.cum) || 0) + '" style="max-width:80px">';
    h += '<button class="btn s" onclick="addEditRoomRow()">+添加</button></div>';

    // 汇报人
    h += '<div class="hrow"><label>汇报人</label><input class="inp" id="dm_reporter" value="' + (r.reporter || '') + '"></div>';

    // 茗茶销售（只读）
    if (r.teaSales && Object.keys(r.teaSales).length) {
        h += '<div class="section-label">茗茶销售（只读）</div>';
        h += '<div class="tw"><table><tr><th>茶品</th><th>杯</th><th>壶</th><th>金额</th></tr>';
        Object.keys(r.teaSales).forEach(function(id) {
            var s = r.teaSales[id];
            var item = DB.teaItems.find(function(t) { return t.id === id; });
            h += '<tr><td>' + (item ? item.name : id) + '</td>';
            h += '<td class="nr">' + (s.cups || 0) + '</td>';
            h += '<td class="nr">' + (s.pots || 0) + '</td>';
            h += '<td class="nr">' + fmtC(s.amount || 0) + '</td></tr>';
        });
        h += '</table></div>';
    }

    // 香烟销售（只读）
    if (r.cigSales && Object.keys(r.cigSales).length) {
        h += '<div class="section-label">香烟销售（只读）</div>';
        h += '<div class="tw"><table><tr><th>品牌</th><th>数量</th><th>金额</th></tr>';
        Object.keys(r.cigSales).forEach(function(id) {
            var s = r.cigSales[id];
            var item = DB.cigItems.find(function(c) { return c.id === id; });
            h += '<tr><td>' + (item ? item.name : id) + '</td>';
            h += '<td class="nr">' + (s.qty || 0) + '</td>';
            h += '<td class="nr">' + fmtC(s.amount || 0) + '</td></tr>';
        });
        h += '</table></div>';
    }

    // 酒类销售（只读）
    if (r.alcSales && Object.keys(r.alcSales).length) {
        h += '<div class="section-label">酒类销售（只读）</div>';
        h += '<div class="tw"><table><tr><th>酒品</th><th>数量</th><th>金额</th></tr>';
        Object.keys(r.alcSales).forEach(function(id) {
            var s = r.alcSales[id];
            var item = DB.alcItems.find(function(a) { return a.id === id; });
            h += '<tr><td>' + (item ? item.name : id) + '</td>';
            h += '<td class="nr">' + (s.qty || 0) + '</td>';
            h += '<td class="nr">' + fmtC(s.amount || 0) + '</td></tr>';
        });
        h += '</table></div>';
    }

    // 其他贵重物品销售（只读）
    if (r.otherSales && Object.keys(r.otherSales).length) {
        h += '<div class="section-label">其他贵重物品销售（只读）</div>';
        h += '<div class="tw"><table><tr><th>物品</th><th>数量</th><th>金额</th></tr>';
        Object.keys(r.otherSales).forEach(function(id) {
            var s = r.otherSales[id];
            var item = DB.otherItems.find(function(o) { return o.id === id; });
            h += '<tr><td>' + (item ? item.name : id) + '</td>';
            h += '<td class="nr">' + (s.qty || 0) + '</td>';
            h += '<td class="nr">' + fmtC(s.amount || 0) + '</td></tr>';
        });
        h += '</table></div>';
    }

    h += '</div>';

    // 按钮
    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end">';
    h += '<button class="btn p" onclick="saveDailyModal(' + sq(date) + ')">保存</button>';
    h += '<button class="btn d" onclick="delDailyFromModal(' + sq(date) + ')">删除</button>';
    h += '<button class="btn" onclick="showDailyModal(' + sq(date) + ')">取消</button>';
    h += '</div>';

    showModal(h, 700);
}

// 保存日报：从弹窗输入框读取所有字段写回 DB
function saveDailyModal(date) {
    upd(function(db) {
        var r = db.dailyReports.find(function(d) { return d.date === date; });
        if (!r) return;

        // 营收
        r.revenue.grossSales = parseFloat($id('dm_gross').value) || 0;
        r.revenue.discount = parseFloat($id('dm_discount').value) || 0;
        r.revenue.netSales = parseFloat($id('dm_net').value) || 0;
        r.revenue.kitchenSales = parseFloat($id('dm_kitchen').value) || 0;
        r.revenue.barSales = parseFloat($id('dm_bar').value) || 0;
        r.revenue.cigarette.total = parseFloat($id('dm_cig').value) || 0;
        r.revenue.other = parseFloat($id('dm_other').value) || 0;

        // 支付
        r.payment.pos = parseFloat($id('dm_pos').value) || 0;
        r.payment.ccbLife = parseFloat($id('dm_ccb').value) || 0;
        r.payment.cash = parseFloat($id('dm_cash').value) || 0;
        r.payment.memberCard = parseFloat($id('dm_member').value) || 0;
        r.payment.treat = parseFloat($id('dm_treat').value) || 0;

        // 应收（自动求和）
        r.payment.ar.meituan = parseFloat($id('dm_meituan').value) || 0;
        r.payment.ar.douyin = parseFloat($id('dm_douyin').value) || 0;
        r.payment.ar.total = r.payment.ar.meituan + r.payment.ar.douyin;

        // 外卖（自动求和）
        r.delivery.meituan = parseFloat($id('dm_d_meituan').value) || 0;
        r.delivery.taobao = parseFloat($id('dm_d_taobao').value) || 0;
        r.delivery.jd = parseFloat($id('dm_d_jd').value) || 0;
        r.delivery.total = r.delivery.meituan + r.delivery.taobao + r.delivery.jd;

        // 客情
        r.guest.count = parseInt($id('dm_count').value) || 0;
        r.guest.avgSpend = parseFloat($id('dm_avg').value) || 0;
        r.guest.premiumRoomsToday = parseInt($id('dm_premium').value) || 0;

        // 包厢预定
        var roomData = [];
        document.querySelectorAll('#editRoomRows .room-row').forEach(function(row) {
            var name = row.querySelector('.room-name').value.trim();
            var today = parseInt(row.querySelector('.room-today').value) || 0;
            var cum = parseInt(row.querySelector('.room-cum').value) || 0;
            if (name) roomData.push({ name: name, today: today, cum: cum });
        });
        r.rooms = roomData;
        var premCum = $id('dm_edit_premCum') ? (parseInt($id('dm_edit_premCum').value) || 0) : 0;
        if (!r.premiumRooms) r.premiumRooms = { today: 0, cum: 0 };
        r.premiumRooms.cum = premCum;
        var totalToday = roomData.reduce(function(s, rm) { return s + rm.today; }, 0);
        r.guest.premiumRoomsToday = totalToday;
        r.premiumRooms.today = totalToday;

        // 汇报人
        r.reporter = $id('dm_reporter').value.trim();
    });

    // 自动校验日报
    var savedReport = DB.dailyReports.find(function(d) { return d.date === date; });
    if (savedReport) autoCheckDaily(savedReport);

    toast('已保存');
    closeModal();
    renderDHist();
}

// 删除日报
function delDailyFromModal(date) {
    if (!confirm('删除 ' + date + ' 的日报？')) return;
    upd(function(db) {
        // 先获取要删除的日报数据，用于同步删除销售记录
        var oldReport = db.dailyReports.find(function(d) { return d.date === date; });
        if (oldReport) {
            // 删除茗茶销售记录
            Object.keys(oldReport.teaSales || {}).forEach(function(tid) {
                var item = db.teaItems.find(function(t) { return t.id === tid; });
                if (item) item.sales = item.sales.filter(function(s) { return s.date !== date; });
            });
            // 删除香烟销售记录
            Object.keys(oldReport.cigSales || {}).forEach(function(cid) {
                var item = db.cigItems.find(function(c) { return c.id === cid; });
                if (item) item.sales = item.sales.filter(function(s) { return s.date !== date; });
            });
            // 删除酒类销售记录
            Object.keys(oldReport.alcSales || {}).forEach(function(aid) {
                var item = db.alcItems.find(function(a) { return a.id === aid; });
                if (item) item.sales = item.sales.filter(function(s) { return s.date !== date; });
            });
            // 删除其他贵重物品销售记录
            Object.keys(oldReport.otherSales || {}).forEach(function(oid) {
                var item = db.otherItems.find(function(o) { return o.id === oid; });
                if (item) item.sales = item.sales.filter(function(s) { return s.date !== date; });
            });
        }
        // 删除日报
        db.dailyReports = db.dailyReports.filter(function(d) { return d.date !== date; });
    });
    toast('已删除');
    closeModal();
    renderDHist();
}

// 添加编辑包厢行
function addEditRoomRow() {
    var d = document.createElement('div');
    d.innerHTML = '<div class="hrow room-row">' +
        '<input class="inp room-name" placeholder="姓名" style="flex:1.5">' +
        '<input class="inp room-today" type="number" placeholder="今日" style="max-width:60px" value="0">' +
        '<input class="inp room-cum" type="number" placeholder="累计" style="max-width:60px" value="0">' +
        '<button class="btn s d" onclick="this.parentElement.remove()">×</button></div>';
    $id('editRoomRows').appendChild(d.firstElementChild);
}

// 库存销售编辑后，同步日报
// 库存销售编辑/删除后，同步日报
function syncInvToDaily(type, date) {
    var items = DB[INV[type].key] || [];

    // ★ 不再创建负数purchase记录（直接通过销售扣减库存）
    // 保留这个函数以便将来同步日报数据到库存

    // ★ 同步日报数据（如果有日报的话）
    var dr = DB.dailyReports.find(function(r) { return r.date === date; });
    if (dr) {
        if (type === 'tea') {
            var newTeaSales = {};
            DB.teaItems.forEach(function(item) {
                var cups = 0, pots = 0, amount = 0, expected = 0;
                item.sales.filter(function(s) { return s.date === date; }).forEach(function(s) {
                    cups += (s.cups || 0);
                    pots += (s.pots || 0);
                    expected += (s.expectedAmount || 0);
                    amount += (s.amount || 0);
                });
                if (cups > 0 || pots > 0 || amount > 0) {
                    newTeaSales[item.id] = { cups: cups, pots: pots, expectedAmount: expected, amount: amount };
                }
            });
            dr.teaSales = newTeaSales;
        }

        if (type === 'cig') {
            var cigTotal = 0;
            var newCigSales = {};
            DB.cigItems.forEach(function(item) {
                var qty = 0, amount = 0;
                item.sales.filter(function(s) { return s.date === date; }).forEach(function(s) {
                    qty += (s.qty || 0);
                    amount += (s.amount || 0);
                });
                if (qty > 0 || amount > 0) {
                    newCigSales[item.id] = { qty: qty, amount: amount };
                }
                cigTotal += amount;
            });
            dr.cigSales = newCigSales;
            if (!dr.revenue.cigarette) dr.revenue.cigarette = { total: 0, items: {} };
            dr.revenue.cigarette.total = cigTotal;
        }

        if (type === 'alc') {
            var newAlcSales = {};
            DB.alcItems.forEach(function(item) {
                var qty = 0, amount = 0;
                item.sales.filter(function(s) { return s.date === date; }).forEach(function(s) {
                    qty += (s.qty || 0);
                    amount += (s.amount || 0);
                });
                if (qty > 0 || amount > 0) {
                    newAlcSales[item.id] = { qty: qty, amount: amount };
                }
            });
            dr.alcSales = newAlcSales;
        }

        if (type === 'other') {
            var newOtherSales = {};
            DB.otherItems.forEach(function(item) {
                var qty = 0, amount = 0;
                item.sales.filter(function(s) { return s.date === date; }).forEach(function(s) {
                    qty += (s.qty || 0);
                    amount += (s.amount || 0);
                });
                if (qty > 0 || amount > 0) {
                    newOtherSales[item.id] = { qty: qty, amount: amount };
                }
            });
            dr.otherSales = newOtherSales;
        }
    }

    saveDB(DB);
}

// ==================== 日报数据校验 ====================
function checkDailyData(r) {
    var issues = [];

    // 1. 流水 - 折扣 = 实收
    var expected = (r.revenue.grossSales || 0) - (r.revenue.discount || 0);
    var actual = r.revenue.netSales || 0;
    if (Math.abs(expected - actual) > 0.01) {
        issues.push('流水-折扣≠实收：' + fmtC(expected) + ' ≠ ' + fmtC(actual) + '（差 ' + fmtC(expected - actual) + '）');
    }

    // 2. 支付渠道合计 = 实收
    var payTotal = (r.payment.pos || 0) + (r.payment.ccbLife || 0) + (r.payment.cash || 0)
        + (r.payment.memberCard || 0) + (r.payment.treat || 0) + (r.payment.ar.total || 0)
        + (r.delivery.total || 0);
    if (Math.abs(payTotal - actual) > 0.01) {
        issues.push('支付渠道合计≠实收：' + fmtC(payTotal) + ' ≠ ' + fmtC(actual) + '（差 ' + fmtC(payTotal - actual) + '）');
    }

    // 3. 应收账款 = 美团团购 + 抖音团购
    var arExpected = (r.payment.ar.meituan || 0) + (r.payment.ar.douyin || 0);
    var arActual = r.payment.ar.total || 0;
    if (Math.abs(arExpected - arActual) > 0.01) {
        issues.push('应收账款≠美团+抖音：' + fmtC(arExpected) + ' ≠ ' + fmtC(arActual) + '（差 ' + fmtC(arExpected - arActual) + '）');
    }

    // 4. 外卖合计 = 美团外卖 + 淘宝 + 京东
    var delExpected = (r.delivery.meituan || 0) + (r.delivery.taobao || 0) + (r.delivery.jd || 0);
    var delActual = r.delivery.total || 0;
    if (Math.abs(delExpected - delActual) > 0.01) {
        issues.push('外卖合计≠美团+淘宝+京东：' + fmtC(delExpected) + ' ≠ ' + fmtC(delActual) + '（差 ' + fmtC(delExpected - delActual) + '）');
    }

    return issues;
}

// 自动校验日报（保存后后台校验，有问题弹窗显示）
function autoCheckDaily(dr) {
    var issues = checkDailyData(dr);
    if (issues.length === 0) return; // 无问题，静默返回

    // 有问题，弹窗显示
    var date = dr.date;
    var h = '<h3>' + date + ' 日报校验异常</h3>';
    h += '<div style="margin-bottom:12px">';
    h += '<div style="font-size:.78rem;color:var(--rd);font-weight:600;margin-bottom:8px">发现 ' + issues.length + ' 项异常：</div>';
    issues.forEach(function(iss, i) {
        h += '<div style="padding:8px 12px;background:var(--rd-b);border:1px solid rgba(199,84,80,.15);border-radius:6px;margin-bottom:6px;font-size:.78rem;color:var(--rd)">';
        h += '<b>' + (i + 1) + '.</b> ' + iss;
        h += '</div>';
    });
    h += '</div>';

    // 显示原始数据参考
    h += '<div style="margin-top:14px;padding:10px;background:var(--card-h);border:1px solid var(--bd);border-radius:6px">';
    h += '<div style="font-size:.72rem;color:var(--tx-m);margin-bottom:6px;font-weight:600">数据参考</div>';
    h += '<div style="font-size:.74rem;color:var(--tx-s);line-height:1.8">';
    h += '流水 <b>' + fmtC(dr.revenue.grossSales || 0) + '</b> − 折扣 <b>' + fmtC(dr.revenue.discount || 0) + '</b> = 实收 <b>' + fmtC(dr.revenue.netSales || 0) + '</b><br>';
    h += 'POS <b>' + fmtC(dr.payment.pos || 0) + '</b> + 建行 <b>' + fmtC(dr.payment.ccbLife || 0) + '</b> + 现金 <b>' + fmtC(dr.payment.cash || 0) + '</b><br>';
    h += '+ 会员 <b>' + fmtC(dr.payment.memberCard || 0) + '</b> + 招待 <b>' + fmtC(dr.payment.treat || 0) + '</b><br>';
    h += '+ 应收 <b>' + fmtC(dr.payment.ar.total || 0) + '</b>（美团 <b>' + fmtC(dr.payment.ar.meituan || 0) + '</b> + 抖音 <b>' + fmtC(dr.payment.ar.douyin || 0) + '</b>）<br>';
    h += '+ 外卖 <b>' + fmtC(dr.delivery.total || 0) + '</b>（美团 <b>' + fmtC(dr.delivery.meituan || 0) + '</b> + 淘宝 <b>' + fmtC(dr.delivery.taobao || 0) + '</b> + 京东 <b>' + fmtC(dr.delivery.jd || 0) + '</b>）';
    h += '</div></div>';

    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end"><button class="btn" onclick="closeModal()">我知道了</button></div>';
    showModal(h, 560);
}

// 校验结果弹窗
function showDailyCheck(date) {
    var dr = DB.dailyReports.find(function(r) { return r.date === date; });
    if (!dr) { toast('找不到日报'); return; }

    var issues = checkDailyData(dr);

    var h = '<h3>' + date + ' 日报校验</h3>';

    if (issues.length === 0) {
        h += '<div style="text-align:center;padding:20px">';
        h += '<div style="font-size:2rem;margin-bottom:8px">✅</div>';
        h += '<div style="font-size:.88rem;font-weight:600;color:var(--gn)">全部校验通过</div>';
        h += '</div>';
    } else {
        h += '<div style="margin-bottom:12px">';
        h += '<div style="font-size:.78rem;color:var(--rd);font-weight:600;margin-bottom:8px">发现 ' + issues.length + ' 项异常：</div>';
        issues.forEach(function(iss, i) {
            h += '<div style="padding:8px 12px;background:var(--rd-b);border:1px solid rgba(199,84,80,.15);border-radius:6px;margin-bottom:6px;font-size:.78rem;color:var(--rd)">';
            h += '<b>' + (i + 1) + '.</b> ' + iss;
            h += '</div>';
        });
        h += '</div>';
    }

    // 显示原始数据参考
    h += '<div style="margin-top:14px;padding:10px;background:var(--card-h);border:1px solid var(--bd);border-radius:6px">';
    h += '<div style="font-size:.72rem;color:var(--tx-m);margin-bottom:6px;font-weight:600">数据参考</div>';
    h += '<div style="font-size:.74rem;color:var(--tx-s);line-height:1.8">';
    h += '流水 <b>' + fmtC(dr.revenue.grossSales || 0) + '</b> − 折扣 <b>' + fmtC(dr.revenue.discount || 0) + '</b> = 实收 <b>' + fmtC(dr.revenue.netSales || 0) + '</b><br>';
    h += 'POS <b>' + fmtC(dr.payment.pos || 0) + '</b> + 建行 <b>' + fmtC(dr.payment.ccbLife || 0) + '</b> + 现金 <b>' + fmtC(dr.payment.cash || 0) + '</b><br>';
    h += '+ 会员 <b>' + fmtC(dr.payment.memberCard || 0) + '</b> + 招待 <b>' + fmtC(dr.payment.treat || 0) + '</b><br>';
    h += '+ 应收 <b>' + fmtC(dr.payment.ar.total || 0) + '</b>（美团 <b>' + fmtC(dr.payment.ar.meituan || 0) + '</b> + 抖音 <b>' + fmtC(dr.payment.ar.douyin || 0) + '</b>）<br>';
    h += '+ 外卖 <b>' + fmtC(dr.delivery.total || 0) + '</b>（美团 <b>' + fmtC(dr.delivery.meituan || 0) + '</b> + 淘宝 <b>' + fmtC(dr.delivery.taobao || 0) + '</b> + 京东 <b>' + fmtC(dr.delivery.jd || 0) + '</b>）';
    h += '</div></div>';

    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end"><button class="btn" onclick="closeModal()">关闭</button></div>';
    showModal(h, 560);
}

// 批量校验整月
function showDailyCheckMonth() {
    var ym = document.getElementById('dhM') ? document.getElementById('dhM').value : curYM();
    if (!ym) ym = curYM();
    var reports = DB.dailyReports.filter(function(r) { return r.date.startsWith(ym); });

    var h = '<h3>' + ym + ' 日报批量校验</h3>';

    if (!reports.length) {
        h += '<div style="text-align:center;padding:20px;color:var(--tx-m);font-size:.78rem">' + ym + ' 暂无日报</div>';
        h += '<div class="brow" style="margin-top:8px;justify-content:flex-end"><button class="btn" onclick="closeModal()">关闭</button></div>';
        showModal(h, 560);
        return;
    }

    var totalIssues = 0;
    h += '<div style="max-height:55vh;overflow-y:auto">';

    reports.sort(function(a, b) { return a.date.localeCompare(b.date); }).forEach(function(r) {
        var issues = checkDailyData(r);
        var d = parseInt(r.date.split('-')[2]);
        if (issues.length === 0) {
            h += '<div style="display:flex;align-items:center;gap:8px;padding:6px 0;font-size:.78rem">';
            h += '<span style="color:var(--gn);font-weight:600">✓</span> ' + d + '日 · 正常';
            h += '</div>';
        } else {
            totalIssues += issues.length;
            h += '<div style="padding:8px 0;border-bottom:1px solid var(--bd-l)">';
            h += '<div style="font-size:.78rem;font-weight:600;color:var(--rd)">⚠ ' + d + '日 · ' + issues.length + '项异常</div>';
            issues.forEach(function(iss) {
                h += '<div style="font-size:.7rem;color:var(--tx-m);padding:2px 0 2px 18px">' + iss + '</div>';
            });
            h += '</div>';
        }
    });

    h += '</div>';

    if (totalIssues === 0) {
        h += '<div style="text-align:center;padding:12px;font-size:.82rem;color:var(--gn);font-weight:600">✅ 全部 ' + reports.length + ' 天校验通过</div>';
    } else {
        h += '<div style="text-align:center;padding:12px;font-size:.82rem;color:var(--rd);font-weight:600">共 ' + reports.length + ' 天，发现 ' + totalIssues + ' 项异常</div>';
    }

    h += '<div class="brow" style="margin-top:8px;justify-content:flex-end"><button class="btn" onclick="closeModal()">关闭</button></div>';
    showModal(h, 560);
}


// 日报月份切换
function dailyCalNav(dir) {
    var picker = document.getElementById('dhM');
    var currentYM = picker ? picker.value : curYM();
    calendarNav(dir, currentYM, 'dhM', function(ym) {
        renderDHist();
    });
}

// 日报月份选择
function dailyCalPickYM(val) {
    calendarPickYM(val, function(ym) {
        renderDHist();
    });
}
