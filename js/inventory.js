
// ------ 库存主页 ------

// 库存主页：顶部统计卡片 + 标签栏（库存/明细）+ 库存表格
function rInv(type) {
    var items = DB[INV[type].key] || [];
    var ym = $id('invMonth') ? $id('invMonth').value || curYM() : curYM();
    var unit = type === 'tea' ? (items[0] && items[0].calcMode === 'pack' ? '包' : '克') :
               type === 'other' ? (items[0] && items[0].unit || '个') :
               type === 'cig' ? '包' : type === 'alc' ? '瓶' : '';

    // 统计每个商品的指定月份数据
    var stats = [];
    items.forEach(function(item) {
        var sales = item.sales.filter(function(s) { return s.date.startsWith(ym); });
        var calc = invCalc(item, type, ym);
        var mc = invCalcMon(item, type, ym);
        var cups = 0, pots = 0, qty = 0, expected = 0;
        sales.forEach(function(s) {
            cups += (s.cups || 0); pots += (s.pots || 0); qty += (s.qty || 0);
            if (type === 'tea') expected += (s.cups || 0) * (item.pricePerCup || 0) + (s.pots || 0) * (item.pricePerPot || 0);
            else expected += (s.qty || 0) * (item.pricePerUnit || 0);
        });
        stats.push({
            item: item,
            stock: calc.stock,
            cups: cups,
            pots: pots,
            qty: qty,
            expected: expected,
            actual: mc.actual,
            cost: calc.cost,
            profit: calc.profit
        });
    });

    // 汇总
    var tE = stats.reduce(function(s, st) { return s + st.expected; }, 0);
    var tA = stats.reduce(function(s, st) { return s + st.actual; }, 0);
    var tC = stats.reduce(function(s, st) { return s + st.cost; }, 0);
    var tP = tA - tC;

    var h = '';

    // ===== 标签栏（明细优先） =====
    h += '<div class="cards">';
    h += '<div class="card"><div class="card-l">品类</div><div class="card-v ac">' + items.length + '</div></div>';
    h += '<div class="card"><div class="card-l">应收</div><div class="card-v">' + fmtC(tE) + '</div></div>';
    h += '<div class="card"><div class="card-l">实收</div><div class="card-v gn">' + fmtC(tA) + '</div></div>';
    h += '<div class="card"><div class="card-l">成本</div><div class="card-v rd">' + fmtC(tC) + '</div></div>';
    h += '<div class="card"><div class="card-l">毛利</div><div class="card-v ac">' + fmtC(tP) + '</div></div>';
    h += '<div class="card"><div class="card-l">毛利率</div><div class="card-v">' + (tA > 0 ? fmtP(tP / tA * 100) : '0%') + '</div></div>';
    h += '</div>';

    // ===== 共享月份选择器 =====
    h += '<div class="hrow" style="margin-bottom:10px"><label>月份</label>';
    h += '<button class="btn s" onclick="invCalNav(\'' + type + '\',-1)">◀</button>';
    h += '<input class="inp" id="invMonth" type="text" readonly placeholder="选择月份" value="' + ym + '" onclick="_mpOpen(\'invMonth\')" onchange="invCalPickYM(\'' + type + '\',this.value)" style="max-width:180px;cursor:pointer">';
    h += '<button class="btn s" onclick="invCalNav(\'' + type + '\',1)">▶</button>';
    h += '</div>';

    // ===== 标签栏（明细优先） =====
    h += '<div class="tab-bar" id="invT">';
    h += '<button class="tab-btn active" data-tab="hist" onclick="switchInvT(\'hist\',\'' + type + '\')">明细</button>';
    h += '<button class="tab-btn" data-tab="stock" onclick="switchInvT(\'stock\',\'' + type + '\')">库存</button>';
    h += '</div>';

    // ===== 库存表格（默认隐藏） =====
    h += '<div id="invStock" style="display:none">';
    h += '<div class="brow" style="margin-bottom:14px">';
    h += '<button class="btn" onclick="showAddInv(\'' + type + '\')">+添加</button> ';
    h += '<button class="btn" onclick="invMoveAll(\'' + type + '\',1)">入库</button> ';
    h += '<button class="btn" onclick="invMoveAll(\'' + type + '\',-1)">销售</button>';
    h += '</div>';

    if (items.length) {
        h += '<div class="tw"><table>';

        // ---------- 茗茶 ----------
        if (type === 'tea') {
            h += '<tr><th>品名</th><th>结存</th><th>本月实收</th><th>销售成本</th><th>毛利</th><th>操作</th></tr>';

            stats.forEach(function(st) {
                var unit = st.item.calcMode === 'pack' ? '包' : '克';
                h += '<tr data-inv="' + type + '_' + st.item.id + '">';
                h += '<td style="font-weight:600">' + st.item.name + '</td>';
                h += '<td class="nr">' + st.stock + unit;
                h += ' <button class="btn s" onclick="editOpeningStock(\'' + type + '\',\'' + st.item.id + '\',\'' + ym + '\')" title="修改期初" style="font-size:.6rem;padding:1px 4px">✏️</button></td>';
                h += '<td class="nr" style="color:var(--gn);font-weight:600">' + fmtC(st.actual) + '</td>';
                h += '<td class="nr" style="color:var(--rd);font-weight:600">' + fmtC(st.cost) + '</td>';
                h += '<td class="nr" style="color:' + (st.profit >= 0 ? 'var(--gn)' : 'var(--rd)') + ';font-weight:600">' + fmtC(st.profit) + '</td>';
                h += '<td><button class="btn s" data-act="edit">编</button> ';
                h += '<button class="btn s" onclick="invDetail(\'' + type + '\',\'' + st.item.id + '\')">详</button> ';
                h += '<button class="btn s d" data-act="del">×</button></td></tr>';

                // 次行
                h += '<tr>';
                h += '<td colspan="6" style="padding:4px 10px 8px;border-bottom:1px solid var(--bd-l)">';
                h += '<span style="font-size:.68rem;color:var(--tx-m)">';
                h += '单杯 ¥' + fmt(st.item.pricePerCup || 0) + ' · 单壶 ¥' + fmt(st.item.pricePerPot || 0);
                h += ' · 售 ' + st.cups + '杯+' + st.pots + '壶';
                h += '</span></td></tr>';
            });

        // 合计
        h += '<tr style="background:var(--card-h)">';
        h += '<td style="font-weight:600">合计</td><td></td>';
        h += '<td class="nr" style="font-weight:600;color:var(--gn)">' + fmtC(tA) + '</td>';
        h += '<td class="nr" style="font-weight:600;color:var(--rd)">' + fmtC(tC) + '</td>';
        h += '<td class="nr" style="font-weight:600;color:' + (tP >= 0 ? 'var(--gn)' : 'var(--rd)') + '">' + fmtC(tP) + '</td>';
        h += '<td></td></tr>';

        // ---------- 香烟 ----------
        } else if (type === 'cig') {
            h += '<tr><th>品名</th><th>结存</th><th>销售总额</th><th>销售成本</th><th>毛利</th><th>操作</th></tr>';

            stats.forEach(function(st) {
                var margin = st.actual > 0 ? fmtP(st.profit / st.actual * 100) : '0%';

                // 主行：结存、销售总额、销售成本、毛利
                h += '<tr data-inv="' + type + '_' + st.item.id + '">';
                h += '<td style="font-weight:600">' + st.item.name + '</td>';
                h += '<td class="nr">' + st.stock + '包';
                h += ' <button class="btn s" onclick="editOpeningStock(\'' + type + '\',\'' + st.item.id + '\',\'' + ym + '\')" title="修改期初" style="font-size:.6rem;padding:1px 4px">✏️</button></td>';
                h += '<td class="nr" style="color:var(--gn);font-weight:600">' + fmtC(st.actual) + '</td>';
                h += '<td class="nr" style="color:var(--rd);font-weight:600">' + fmtC(st.cost) + '</td>';
                h += '<td class="nr" style="color:' + (st.profit >= 0 ? 'var(--gn)' : 'var(--rd)') + ';font-weight:600">' + fmtC(st.profit) + '</td>';
                h += '<td><button class="btn s" data-act="edit">编</button> ';
                h += '<button class="btn s" onclick="invDetail(\'' + type + '\',\'' + st.item.id + '\')">详</button> ';
                h += '<button class="btn s d" data-act="del">×</button></td></tr>';

                // 次行：单价、销售数量、毛利率
                h += '<tr>';
                h += '<td colspan="6" style="padding:4px 10px 8px;border-bottom:1px solid var(--bd-l)">';
                h += '<span style="font-size:.68rem;color:var(--tx-m)">';
                h += '单价 ¥' + fmt(st.item.pricePerUnit || 0) + '/包';
                h += ' · 售 ' + st.qty + '包';
                h += ' · 毛利率 ' + margin;
                h += '</span></td></tr>';
            });

            // 合计
            h += '<tr style="background:var(--card-h)">';
            h += '<td style="font-weight:600">合计</td><td></td>';
            h += '<td class="nr" style="font-weight:600;color:var(--gn)">' + fmtC(tA) + '</td>';
            h += '<td class="nr" style="font-weight:600;color:var(--rd)">' + fmtC(tC) + '</td>';
            h += '<td class="nr" style="font-weight:600;color:' + (tP >= 0 ? 'var(--gn)' : 'var(--rd)') + '">' + fmtC(tP) + '</td>';
            h += '<td></td></tr>';

        // ---------- 其他贵重物品 ----------
        } else if (type === 'other') {
            // 按分类分组
            var categories = {};
            stats.forEach(function(st) {
                var cat = st.item.category || '未分类';
                if (!categories[cat]) categories[cat] = [];
                categories[cat].push(st);
            });

            // 先显示表头
            h += '<tr><th>品名</th><th>结存</th><th>销售总额</th><th>销售成本</th><th>毛利</th><th>操作</th></tr>';

            // 按分类显示
            Object.keys(categories).forEach(function(cat) {
                // 分类标题行
                h += '<tr style="background:var(--card-h)"><td colspan="6" style="font-weight:600;color:var(--ac);padding:8px 0;font-size:.82rem">📋 ' + cat + '</td></tr>';

                // 该分类下的商品
                categories[cat].forEach(function(st) {
                    var margin = st.actual > 0 ? fmtP(st.profit / st.actual * 100) : '0%';
                    var unit = st.item.unit || (st.item.calcMode === 'pack' ? '包' : st.item.calcMode === 'gram' ? '克' : '个');

                    // 主行
                    h += '<tr data-inv="' + type + '_' + st.item.id + '">';
                    h += '<td style="font-weight:600">' + st.item.name + '</td>';
                    h += '<td class="nr">' + st.stock + unit;
                    h += ' <button class="btn s" onclick="editOpeningStock(\'' + type + '\',\'' + st.item.id + '\',\'' + ym + '\')" title="修改期初" style="font-size:.6rem;padding:1px 4px">✏️</button></td>';
                    h += '<td class="nr" style="color:var(--gn);font-weight:600">' + fmtC(st.actual) + '</td>';
                    h += '<td class="nr" style="color:var(--rd);font-weight:600">' + fmtC(st.cost) + '</td>';
                    h += '<td class="nr" style="color:' + (st.profit >= 0 ? 'var(--gn)' : 'var(--rd)') + ';font-weight:600">' + fmtC(st.profit) + '</td>';
                    h += '<td><button class="btn s" data-act="edit">编</button> ';
                    h += '<button class="btn s" onclick="invDetail(\'' + type + '\',\'' + st.item.id + '\')">详</button> ';
                    h += '<button class="btn s d" data-act="del">×</button></td></tr>';

                    // 次行
                    h += '<tr>';
                    h += '<td colspan="6" style="padding:4px 10px 8px;border-bottom:1px solid var(--bd-l)">';
                    h += '<span style="font-size:.68rem;color:var(--tx-m)">';
                    h += '单价 ¥' + fmt(st.item.pricePerUnit || 0) + '/' + unit;
                    h += ' · 售 ' + st.qty + unit;
                    h += ' · 毛利率 ' + margin;
                    h += '</span></td></tr>';
                });
            });

            // 合计
            h += '<tr style="background:var(--card-h)">';
            h += '<td style="font-weight:600">合计</td><td></td>';
            h += '<td class="nr" style="font-weight:600;color:var(--gn)">' + fmtC(tA) + '</td>';
            h += '<td class="nr" style="font-weight:600;color:var(--rd)">' + fmtC(tC) + '</td>';
            h += '<td class="nr" style="font-weight:600;color:' + (tP >= 0 ? 'var(--gn)' : 'var(--rd)') + '">' + fmtC(tP) + '</td>';
            h += '<td></td></tr>';

        // ---------- 酒类 ----------
        } else {
            h += '<tr><th>品名</th><th>结存</th><th>销售总额</th><th>销售成本</th><th>毛利</th><th>操作</th></tr>';

            stats.forEach(function(st) {
                var margin = st.actual > 0 ? fmtP(st.profit / st.actual * 100) : '0%';

                // 主行
                h += '<tr data-inv="' + type + '_' + st.item.id + '">';
                h += '<td style="font-weight:600">' + st.item.name + '</td>';
                h += '<td class="nr">' + st.stock + '瓶';
                h += ' <button class="btn s" onclick="editOpeningStock(\'' + type + '\',\'' + st.item.id + '\',\'' + ym + '\')" title="修改期初" style="font-size:.6rem;padding:1px 4px">✏️</button></td>';
                h += '<td class="nr" style="color:var(--gn);font-weight:600">' + fmtC(st.actual) + '</td>';
                h += '<td class="nr" style="color:var(--rd);font-weight:600">' + fmtC(st.cost) + '</td>';
                h += '<td class="nr" style="color:' + (st.profit >= 0 ? 'var(--gn)' : 'var(--rd)') + ';font-weight:600">' + fmtC(st.profit) + '</td>';
                h += '<td><button class="btn s" data-act="edit">编</button> ';
                h += '<button class="btn s" onclick="invDetail(\'' + type + '\',\'' + st.item.id + '\')">详</button> ';
                h += '<button class="btn s d" data-act="del">×</button></td></tr>';

                // 次行
                h += '<tr>';
                h += '<td colspan="6" style="padding:4px 10px 8px;border-bottom:1px solid var(--bd-l)">';
                h += '<span style="font-size:.68rem;color:var(--tx-m)">';
                h += '单价 ¥' + fmt(st.item.pricePerUnit || 0) + '/瓶';
                h += ' · 售 ' + st.qty + '瓶';
                h += ' · 毛利率 ' + margin;
                h += '</span></td></tr>';
            });

            // 合计
            h += '<tr style="background:var(--card-h)">';
            h += '<td style="font-weight:600">合计</td><td></td>';
            h += '<td class="nr" style="font-weight:600;color:var(--gn)">' + fmtC(tA) + '</td>';
            h += '<td class="nr" style="font-weight:600;color:var(--rd)">' + fmtC(tC) + '</td>';
            h += '<td class="nr" style="font-weight:600;color:' + (tP >= 0 ? 'var(--gn)' : 'var(--rd)') + '">' + fmtC(tP) + '</td>';
            h += '<td></td></tr>';
        }

        h += '</table></div>';
    } else {
        h += '<div style="text-align:center;padding:30px;color:var(--tx-m)">暂无</div>';
    }

    h += '</div>';

    // ===== 明细区（默认显示） =====
    h += '<div id="invHist"></div>';

    // 渲染前记住当前 tab
    var lastTab = 'hist';
    var activeTab = document.querySelector('#invT .tab-btn.active');
    if (activeTab) lastTab = activeTab.dataset.tab || 'hist';

    setMain(INV[type].label + '管理', h);
    setTimeout(function() { switchInvT(lastTab, type); }, 100);
}


// 切换库存标签页（库存/明细）
function switchInvT(tab, type) {
    document.querySelectorAll('#invT .tab-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    $id('invStock').style.display = tab === 'stock' ? '' : 'none';
    $id('invHist').style.display = tab === 'hist' ? '' : 'none';
    if (tab === 'hist') renderInvHist(type);
}

// ------ 库存明细日历 ------

// 渲染库存销售明细日历
function renderInvHist(type) {
    var el = $id('invHist');
    if (!el) return;
    // 读取共享月份选择器
    var ym = $id('invMonth') ? $id('invMonth').value || curYM() : curYM();
    var items = DB[INV[type].key] || [];
    var unit = type === 'tea' ? (items[0] && items[0].calcMode === 'pack' ? '包' : '克') :
               type === 'other' ? (items[0] && items[0].unit || '个') :
               type === 'cig' ? '包' : type === 'alc' ? '瓶' : '';

    var year = parseInt(ym.split('-')[0]);
    var month = parseInt(ym.split('-')[1]);
    var daysInMonth = new Date(year, month, 0).getDate();
    var firstDay = new Date(year, month - 1, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;
    var todayStr = td();
    var todayDay = parseInt(todayStr.split('-')[2]);
    var isThisMonth = todayStr.startsWith(ym);

    // 按日期汇总销售金额
    var dayTotals = {};
    items.forEach(function(item) {
        item.sales.forEach(function(s) {
            if (!s.date || !s.date.startsWith(ym)) return;
            var day = parseInt(s.date.substring(8, 10));
            if (!dayTotals[day]) dayTotals[day] = 0;
            dayTotals[day] += s.amount || 0;
        });
    });

    var monthTotal = Object.values(dayTotals).reduce(function(s, v) { return s + v; }, 0);

    var h = '';

    // 日历网格
    h += '<div class="inv-calendar" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:14px">';
    ['一', '二', '三', '四', '五', '六', '日'].forEach(function(w) {
        h += '<div style="text-align:center;font-size:.7rem;color:var(--tx-m);padding:4px 0">' + w + '</div>';
    });

    for (var i = 0; i < firstDay; i++) h += '<div></div>';

    for (var d = 1; d <= daysInMonth; d++) {
        var dateStr = ym + '-' + (d < 10 ? '0' + d : d);
        var has = !!dayTotals[d];
        var isToday = isThisMonth && d === todayDay;
        var bg = has ? 'var(--card)' : 'var(--card-h)';
        var border = isToday ? '2px solid var(--ac)' : '1px solid var(--bd)';

        h += '<div class="inv-calendar-cell" style="background:' + bg + ';border:' + border + ';border-radius:6px;padding:5px 4px;min-height:52px;cursor:' + (has ? 'pointer' : 'default') + '"';
        if (has) h += ' onclick="showInvDayModal(\'' + type + '\',\'' + dateStr + '\')"';
        h += '><div style="font-size:.7rem;font-weight:600;color:' + (isToday ? 'var(--ac)' : 'var(--tx)') + '">' + d + '</div>';
        if (has) {
            h += '<div style="font-family:var(--fm);font-size:.65rem;color:var(--ac);margin-top:2px">';
            if (dayTotals[d] >= 10000) h += (dayTotals[d] / 10000).toFixed(1) + '万';
            else if (dayTotals[d] >= 1000) h += (dayTotals[d] / 1000).toFixed(1) + 'k';
            else h += '¥' + dayTotals[d].toFixed(0);
            h += '</div>';
        }
        h += '</div>';
    }
    h += '</div>';

    if (!monthTotal) h += '<div style="text-align:center;padding:20px;color:var(--tx-m);font-size:.78rem">本月暂无销售记录</div>';
    el.innerHTML = h;
}

// 日销售详情弹窗
function showInvDayModal(type, date) {
    var items = DB[INV[type].key] || [];
    var unit = type === 'tea' ? (items[0] && items[0].calcMode === 'pack' ? '包' : '克') :
               type === 'other' ? (items[0] && items[0].unit || '个') :
               type === 'cig' ? '包' : type === 'alc' ? '瓶' : '克';
    var records = [];
    items.forEach(function(item) {
        item.sales.forEach(function(s, si) {
            if (s.date === date) records.push({ item: item, sale: s, si: si });
        });
    });
    if (!records.length) { toast('这天没有销售记录'); return; }

    var total = records.reduce(function(s, r) { return s + (r.sale.amount || 0); }, 0);
    var dateLabel = date.substring(5).replace('-', '/');

    var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
    h += '<h3 style="margin:0">' + dateLabel + ' ' + INV[type].label + '销售</h3>';
    h += '<span style="font-size:.95rem;font-weight:700;color:var(--ac)">¥' + fmtC(total) + '</span></div>';

    h += '<div style="max-height:50vh;overflow-y:auto;padding-right:4px">';
    records.forEach(function(r) {
        h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;margin-bottom:6px;background:var(--card-h);border:1px solid var(--bd);border-radius:8px">';

        // 左侧：品名和数量
        h += '<div style="flex:1;min-width:0">';
        h += '<div style="font-size:.84rem;font-weight:600">' + r.item.name + '</div>';
        if (type === 'tea') {
            h += '<div style="font-size:.72rem;color:var(--tx-m);margin-top:2px">' + (r.sale.cups || 0) + '杯 · ' + (r.sale.pots || 0) + '壶</div>';
        } else {
            h += '<div style="font-size:.72rem;color:var(--tx-m);margin-top:2px">' + (r.sale.qty || 0) + unit + '</div>';
        }
        h += '</div>';

        // 右侧：应收 + 实收 + 编辑/删除按钮
        h += '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">';
        var expected = r.sale.expectedAmount || ((r.sale.qty || 0) * (r.item.pricePerUnit || 0));
        if (type === 'tea') expected = r.sale.expectedAmount || ((r.sale.cups || 0) * (r.item.pricePerCup || 0) + (r.sale.pots || 0) * (r.item.pricePerPot || 0));
        h += '<span style="font-size:.76rem;color:var(--tx-m)">应收 ¥' + fmtC(expected) + '</span>';
        h += '<span style="font-size:.88rem;font-weight:700;color:var(--ac)">¥' + fmtC(r.sale.amount || 0) + '</span>';
        h += '<button class="btn s" onclick="closeModal();editInvSale(\'' + type + '\',\'' + r.item.id + '\',' + r.si + ')">编</button>';
        h += '<button class="btn s d" onclick="delInvSaleConfirm(\'' + type + '\',\'' + r.item.id + '\',' + r.si + ',\'' + date + '\')">删</button>';
        h += '</div>';

        h += '</div>';
    });
    h += '</div>';

    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end"><button class="btn" onclick="closeModal()">关闭</button></div>';
    showModal(h, 550);
}

// 删除销售记录（带确认）
function delInvSaleConfirm(type, itemId, si, date) {
    var item = DB[INV[type].key].find(function(i) { return i.id === itemId; });
    if (!item || !item.sales[si]) return;
    var s = item.sales[si];
    var desc = type === 'tea'
        ? (s.cups || 0) + '杯+' + (s.pots || 0) + '壶 ¥' + fmtC(s.amount || 0)
        : (s.qty || 0) + (type === 'cig' ? '包' : '瓶') + ' ¥' + fmtC(s.amount || 0);

    if (!confirm('删除 ' + item.name + ' 的销售记录？\n' + desc)) return;

    item.sales.splice(si, 1);
    saveDB(DB);
    syncInvToDaily(type, date);

    toast('已删除');

    // ★ 先刷新库存页面，再打开明细弹窗
    closeModal();
    rInv(type);
    setTimeout(function() { showInvDayModal(type, date); }, 150);
}

// 编辑销售记录
function editInvSale(type, itemId, si) {
    var item = DB[INV[type].key].find(function(i) { return i.id === itemId; });
    if (!item || !item.sales[si]) return;
    var s = item.sales[si];

    var h = '<h3>编辑销售 · ' + item.name + '</h3>';

    h += '<div class="hrow"><label>日期</label><input class="inp" id="esi_date" type="text" readonly placeholder="选择日期" value="' + s.date + '" onclick="_dpOpen(\'esi_date\')" style="max-width:160px;cursor:pointer"></div>';

    if (type === 'tea') {
        h += '<div class="hrow"><label>杯数</label><input class="inp" id="esi_cups" type="number" value="' + (s.cups || 0) + '" style="max-width:80px">';
        h += '<label>壶数</label><input class="inp" id="esi_pots" type="number" value="' + (s.pots || 0) + '" style="max-width:80px"></div>';
    } else {
        h += '<div class="hrow"><label>数量</label><input class="inp" id="esi_qty" type="number" step="0.01" value="' + (s.qty || 0) + '" style="max-width:80px"></div>';
    }

    h += '<div class="hrow"><label>应收</label><input class="inp" id="esi_expected" type="number" step="0.01" value="' + (s.expectedAmount || 0) + '" style="max-width:90px;background:var(--card-h)" readonly">';
    h += '实收:<input class="inp" id="esi_amount" type="number" step="0.01" value="' + (s.amount || 0) + '" style="max-width:90px"></div>';

    h += '<div class="brow" style="margin-top:14px;justify-content:flex-end">';
    h += '<button class="btn p" onclick="saveEditInvSale(\'' + type + '\',\'' + itemId + '\',' + si + ')">保存</button>';
    h += '<button class="btn" onclick="backToModal(function(){rInv(' + type + ')})">取消</button>';
    h += '</div>';

    showModal(h, 450);
}

// 保存编辑后的销售记录
function saveEditInvSale(type, itemId, si) {
    var item = DB[INV[type].key].find(function(i) { return i.id === itemId; });
    if (!item || !item.sales[si]) return;

    var oldDate = item.sales[si].date;
    var newDate = $id('esi_date').value;
    item.sales[si].date = newDate;

    if (type === 'tea') {
        item.sales[si].cups = parseInt($id('esi_cups').value) || 0;
        item.sales[si].pots = parseInt($id('esi_pots').value) || 0;
    } else {
        item.sales[si].qty = parseFloat($id('esi_qty').value) || 0;
    }

    item.sales[si].expectedAmount = parseFloat($id('esi_expected').value) || 0;
    item.sales[si].amount = parseFloat($id('esi_amount').value) || 0;
    saveDB(DB);
    syncInvToDaily(type, oldDate);
    if (oldDate !== newDate) syncInvToDaily(type, newDate);

    toast('已保存');

    // ★ 先刷新库存页面，再打开明细弹窗
    closeModal();
    rInv(type);
    setTimeout(function() { showInvDayModal(type, newDate); }, 150);
}


// ------ 库存详情 ------

// 修改指定月份的期初库存（只影响当月，不影响后续月份）
function editOpeningStock(type, itemId, ym) {
    var item = DB[INV[type].key].find(function(i) { return i.id === itemId; });
    if (!item) return;
    var currentOS = getOpeningStock(item, ym);
    var unit = type === 'tea' ? (item.calcMode === 'pack' ? '包' : '克') :
               type === 'other' ? (item.unit || '个') :
               type === 'cig' ? '包' : type === 'alc' ? '瓶' : '个';
    var isCurMonth = ym === curYM();

    var h = '<div style="max-width:360px;margin:0 auto">';
    h += '<h3 style="margin-bottom:12px;color:var(--ac)">修改期初库存</h3>';
    h += '<div style="font-size:.78rem;color:var(--tx-s);margin-bottom:14px">' + item.name + ' · ' + ym + (isCurMonth ? '（当月）' : '（历史月份）') + '</div>';
    h += '<div class="hrow"><label>期初库存</label>';
    h += '<input class="inp" id="editOS" type="number" step="0.1" value="' + currentOS + '" style="width:120px;text-align:right;font-family:var(--fm)">';
    h += '<span style="font-size:.82rem;color:var(--tx-m)">' + unit + '</span></div>';
    if (!isCurMonth) {
        h += '<div style="font-size:.68rem;color:var(--tx-m);margin-top:8px">仅修改 ' + ym + ' 的期初，不影响其他月份</div>';
    }
    h += '<div class="brow" style="margin-top:14px;justify-content:flex-end">';
    h += '<button class="btn" onclick="closeModal()">取消</button>';
    h += '<button class="btn p" onclick="saveOpeningStock(\'' + type + '\',\'' + itemId + '\',\'' + ym + '\')">保存</button>';
    h += '</div></div>';
    showModal(h, 380);
}

function saveOpeningStock(type, itemId, ym) {
    var item = DB[INV[type].key].find(function(i) { return i.id === itemId; });
    if (!item) return;
    var val = parseFloat(document.getElementById('editOS').value) || 0;
    if (ym === curYM()) {
        // 当月：直接修改 openingStock
        item.openingStock = val;
    } else {
        // 历史月份：只修改快照，不影响当前openingStock
        if (!item.monthStock) item.monthStock = {};
        item.monthStock[ym] = val;
    }
    saveDB(DB);
    closeModal();
    rInv(type);
    toast('期初已更新');
}

// 单个商品的进销存详情弹窗（按日期展示销售+出入库记录）
function invDetail(type, itemId) {
    var item = DB[INV[type].key].find(function(i) { return i.id === itemId; });
    if (!item) return;
    var unit = type === 'tea' ? (item.calcMode === 'pack' ? '包' : '克') :
               type === 'other' ? (item.unit || '个') :
               type === 'cig' ? '包' : type === 'alc' ? '瓶' : '';
    var ym = document.getElementById('invMonth') ? document.getElementById('invMonth').value : curYM();
    if (!ym) ym = curYM();

    var h = '<h3 style="margin:0 0 10px">' + item.name + ' · 进销存</h3>';

    // 汇总
    var allRecords = buildRecords(item, type, ym);
    var totalIn = 0, totalOut = 0;
    allRecords.forEach(function(r) {
        if (r.kind === 'sale') totalOut += r.actual;
        else if (r.data.qty >= 0) totalIn += r.data.cost || 0;
        else totalOut += r.data.cost || 0;
    });

    h += '<div style="display:flex;gap:8px;margin-bottom:10px">';
    h += '<div style="flex:1;padding:8px;background:var(--card-h);border:1px solid var(--bd);border-radius:6px;text-align:center">';
    h += '<div style="font-size:.65rem;color:var(--tx-s)">销售</div>';
    h += '<div style="font-size:.82rem;font-weight:700;color:var(--ac)">¥' + fmtC(totalOut) + '</div></div>';
    h += '<div style="flex:1;padding:8px;background:var(--card-h);border:1px solid var(--bd);border-radius:6px;text-align:center">';
    h += '<div style="font-size:.65rem;color:var(--tx-s)">入库</div>';
    h += '<div style="font-size:.82rem;font-weight:700;color:var(--gn)">¥' + fmtC(totalIn) + '</div></div>';
    h += '</div>';

    // 按日期分组的记录列表
    h += '<div style="max-height:55vh;overflow-y:auto;padding-right:4px">';

    if (!allRecords.length) {
        h += '<div style="font-size:.74rem;color:var(--tx-m);padding:8px 0">本月暂无记录</div>';
    } else {
        var curDate = '';
        allRecords.forEach(function(r) {
            if (r.date !== curDate) {
                curDate = r.date;
                h += '<div style="font-size:.72rem;font-weight:700;color:var(--ac);margin:8px 0 4px">' + r.date.substring(5).replace('-', '/') + '</div>';
            }
            h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:6px 10px;margin-bottom:4px;background:var(--card-h);border:1px solid var(--bd-l);border-radius:6px">';
            h += '<div style="flex:1;min-width:0">';
            h += '<span style="font-size:.72rem;font-weight:600;padding:1px 4px;border-radius:3px;background:' + (r.kind === 'sale' ? 'var(--ac)' : 'var(--gn)') + ';color:#fff;margin-right:4px">' + (r.kind === 'sale' ? '售' : '入') + '</span>';
            h += '<span style="font-size:.6rem;color:var(--tx-m);background:var(--card);border:1px solid var(--bd-l);border-radius:3px;padding:1px 4px;margin-right:4px">' + (r.source || '') + '</span>';
            if (r.kind === 'sale') {
                if (type === 'tea') h += '<span style="font-size:.72rem;color:var(--tx-m)">' + (r.data.cups || 0) + '杯 · ' + (r.data.pots || 0) + '壶</span>';
                else h += '<span style="font-size:.72rem;color:var(--tx-m)">' + (r.data.qty || 0) + unit + '</span>';
            } else {
                h += '<span style="font-size:.72rem;color:var(--tx-m)">' + Math.abs(r.data.qty || 0) + unit + '</span>';
            }
            h += '</div>';
            h += '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">';
            h += '<span style="font-size:.82rem;font-weight:700;color:' + (r.kind === 'sale' ? 'var(--ac)' : 'var(--gn)') + '">¥' + fmtC(r.kind === 'sale' ? r.actual : Math.abs(r.data.cost || 0)) + '</span>';
            h += '<button class="btn s" style="font-size:.65rem;padding:2px 8px" onclick="editInvRow(\'' + type + '\',\'' + item.id + '\',\'' + r.kind + '\',' + r.idx + ',\'' + unit + '\')">编</button>';
            h += '<button class="btn s d" style="font-size:.65rem;padding:2px 8px" onclick="delInvRow(\'' + type + '\',\'' + item.id + '\',\'' + r.kind + '\',' + r.idx + ')">删</button>';
            h += '</div></div>';
        });
    }

    h += '</div>';
    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end"><button class="btn" onclick="closeModal()">关闭</button></div>';
    showModal(h, 550);
}


// 构建进销存记录列表（销售+出入库按日期排序）
function buildRecords(item, type, ym) {
    var allRecords = [];

    // 查找对应日期的手动出库备注
    var manualNotes = {};
    (item.purchases || []).forEach(function(p) {
        if (p.qty < 0 && p.source !== '日报' && p.date.startsWith(ym)) {
            manualNotes[p.date] = p.reason || p.source || '手动';
        }
    });

    // 销售记录
    item.sales.forEach(function(s, idx) {
        if (!s.date.startsWith(ym)) return;
        var expected = 0;
        if (type === 'tea') {
            expected = (s.cups || 0) * (item.pricePerCup || 0) + (s.pots || 0) * (item.pricePerPot || 0);
        } else {
            expected = (s.qty || 0) * (item.pricePerUnit || 0);
        }
        var source = manualNotes[s.date] || '日报';
        allRecords.push({ date: s.date, kind: 'sale', idx: idx, data: s, source: source, expected: expected, actual: s.amount || 0 });
    });

    // 出入库记录（入库 + 无sales对应的手动出库）
    var saleDates = {};
    item.sales.forEach(function(s) { if (s.date.startsWith(ym)) saleDates[s.date] = true; });

    (item.purchases || []).forEach(function(m, idx) {
        if (!m.date.startsWith(ym)) return;
        if (m.source === '日报') return;
        if (m.qty >= 0) {
            allRecords.push({ date: m.date, kind: 'move', idx: idx, data: m, source: m.source || '', expected: 0, actual: m.cost || 0 });
        } else if (!saleDates[m.date]) {
            allRecords.push({ date: m.date, kind: 'sale', idx: idx, data: { qty: Math.abs(m.qty), amount: 0 }, source: m.reason || m.source || '手动', expected: 0, actual: 0 });
        }
    });

    allRecords.sort(function(a, b) { return a.date.localeCompare(b.date); });
    return allRecords;
}


// ------ 销售/出入库明细表格 ------

// 渲染销售明细表格（用于详情弹窗中的销售标签）
function renderSaleDetail(item, type, ym, unit) {
    var h = '<div class="hrow"><label>月份</label><input class="inp" id="detM" type="text" readonly placeholder="选择月份" value="' + ym + '" onclick="_mpOpen(\'detM\')" onchange="detRefresh(\'' + type + '\',\'' + item.id + '\')" style="max-width:180px;cursor:pointer"></div>';

    var sales = [];
    try { sales = (item.sales || []).filter(function(s) { return s.date && s.date.startsWith(ym); }); } catch (e) {}

    if (!sales.length) {
        h += '<div style="text-align:center;padding:20px;color:var(--tx-m)">本月暂无销售</div>';
        return h;
    }

    var totalQty = 0, totalExp = 0, totalAmt = 0;
    h += '<div class="tw"><table><tr><th>日期</th>';
    if (type === 'tea') h += '<th>杯</th><th>壶</th><th>应收</th><th>实收</th>';
    else h += '<th>数量</th><th>应收</th><th>实收</th>';
    h += '</tr>';

    sales.forEach(function(s) {
        h += '<tr><td>' + s.date + '</td>';
        if (type === 'tea') {
            var cups = s.cups || 0, pots = s.pots || 0;
            var exp = s.expectedAmount || (cups * (item.pricePerCup || 0) + pots * (item.pricePerPot || 0));
            var amt = s.amount || 0;
            h += '<td class="nr">' + cups + '</td><td class="nr">' + pots + '</td>';
            h += '<td class="nr">' + fmtC(exp) + '</td><td class="nr" style="color:var(--gn)">' + fmtC(amt) + '</td>';
            totalQty += cups + pots;
        } else {
            var qty = s.qty || 0;
            var exp = qty * (item.pricePerUnit || 0);
            var amt = s.amount || 0;
            h += '<td class="nr">' + qty + unit + '</td>';
            h += '<td class="nr">' + fmtC(exp) + '</td><td class="nr" style="color:var(--gn)">' + fmtC(amt) + '</td>';
            totalQty += qty;
        }
        totalExp += exp; totalAmt += amt;
        h += '</tr>';
    });

    // 合计行
    h += '<tr style="background:var(--card-h)"><td style="font-weight:600">合计</td>';
    if (type === 'tea') h += '<td colspan="2" class="nr" style="font-weight:600">' + totalQty + '</td>';
    else h += '<td class="nr" style="font-weight:600">' + totalQty + unit + '</td>';
    h += '<td class="nr" style="font-weight:600">' + fmtC(totalExp) + '</td>';
    h += '<td class="nr" style="font-weight:600;color:var(--gn)">' + fmtC(totalAmt) + '</td></tr>';
    h += '</table></div>';
    return h;
}

// 渲染出入库明细表格（入库/出库/销售混合）
function renderBuyDetail(item, type, ym, unit) {
    var h = '<div class="hrow"><label>月份</label><input class="inp" id="detBuyM" type="text" readonly placeholder="选择月份" value="' + ym + '" onclick="_mpOpen(\'detBuyM\')" onchange="detBuyRefresh(\'' + type + '\',\'' + item.id + '\')" style="max-width:180px;cursor:pointer"></div>';

    var moves = [];
    try { moves = (item.purchases || []).filter(function(p) { return p.date && p.date.startsWith(ym); }); } catch (e) {}
    var sales = [];
    try { sales = (item.sales || []).filter(function(s) { return s.date && s.date.startsWith(ym); }); } catch (e) {}

    // 统一单位
    var u = unit;
    if (type === 'tea' && item.calcMode === 'pack') u = '包';
    else if (type === 'tea') u = '克';
    else if (type === 'other') u = item.unit || '个';

    // 合并出入库+销售记录
    var allRows = [];
    moves.forEach(function(m) {
        allRows.push({ date: m.date, type: m.qty >= 0 ? '入库' : '出库', qty: Math.abs(m.qty), reason: m.source || '-', cost: m.cost || 0, amount: 0, rowType: 'move', ref: item.purchases.indexOf(m) });
    });
    sales.forEach(function(s) {
        var qty = 0, exp = 0;
        if (type === 'tea') {
            var cups = s.cups || 0, pots = s.pots || 0;
            var mode = item.calcMode || 'gram';
            if (mode === 'pack') qty = Math.round((cups * (item.packsPerCup || 1) + pots * (item.packsPerPot || 2)) * 100) / 100;
            else qty = Math.round((cups * (item.gramsPerCup || 5) + pots * (item.gramsPerPot || 15)) * 100) / 100;
            exp = s.expectedAmount || (cups * (item.pricePerCup || 0) + pots * (item.pricePerPot || 0));
        } else {
            qty = s.qty || 0;
            exp = qty * (item.pricePerUnit || 0);
        }
        allRows.push({ date: s.date, type: '销售', qty: qty, reason: '销售', cost: 0, expected: exp, amount: s.amount || 0, rowType: 'sale', ref: item.sales.indexOf(s) });
    });

    allRows.sort(function(a, b) { return a.date.localeCompare(b.date); });

    if (!allRows.length) {
        h += '<div style="text-align:center;padding:20px;color:var(--tx-m)">本月暂无出入库</div>';
        return h;
    }

    var totalIn = 0, totalOut = 0, totalSale = 0, totalExp = 0, totalAmt = 0;
    h += '<div class="tw"><table><tr><th>日期</th><th>类型</th><th>数量</th><th>来源</th><th>应收</th><th>实收</th><th>操作</th></tr>';

    allRows.forEach(function(r) {
        var color = r.type === '入库' ? 'gn' : r.type === '销售' ? 'og' : 'rd';
        h += '<tr><td>' + r.date + '</td>';
        h += '<td><span class="badge ' + color + '">' + r.type + '</span></td>';
        h += '<td class="nr">' + r.qty + u + '</td>';
        h += '<td style="font-size:.72rem">' + r.reason + '</td>';
        if (r.type === '销售') {
            h += '<td class="nr">' + fmtC(r.expected || 0) + '</td>';
            h += '<td class="nr" style="color:var(--gn)">' + fmtC(r.amount || 0) + '</td>';
        } else {
            h += '<td class="nr">' + (r.cost ? fmtC(r.cost) : '-') + '</td>';
            h += '<td class="nr">-</td>';
        }
        h += '<td><button class="btn s" onclick="editInvRow(\'' + type + '\',\'' + item.id + '\',\'' + r.rowType + '\',' + r.ref + ',\'' + u + '\')">编</button> ';
        h += '<button class="btn s d" onclick="delInvRow(\'' + type + '\',\'' + item.id + '\',\'' + r.rowType + '\',' + r.ref + ')">×</button></td></tr>';

        if (r.type === '入库') totalIn += r.qty;
        else if (r.type === '出库') totalOut += r.qty;
        else if (r.type === '销售') { totalSale += r.qty; totalExp += (r.expected || 0); totalAmt += (r.amount || 0); }
    });

    h += '<tr style="background:var(--card-h)"><td style="font-weight:600">合计</td><td></td>';
    h += '<td class="nr" style="font-weight:600">入:' + Math.round(totalIn * 100) / 100 + ' 出:' + Math.round(totalOut * 100) / 100 + ' 销:' + Math.round(totalSale * 100) / 100 + u + '</td>';
    h += '<td></td><td class="nr" style="font-weight:600">' + fmtC(totalExp) + '</td>';
    h += '<td class="nr" style="font-weight:600;color:var(--gn)">' + fmtC(totalAmt) + '</td><td></td></tr>';
    h += '</table></div>';
    return h;
}

// ------ 编辑/删除记录 ------

// 弹窗编辑出入库或销售记录
function editInvRow(type, itemId, rowType, idx, unit) {
    var item = DB[INV[type].key].find(function(i) { return i.id === itemId; });
    if (!item) return;

    if (rowType === 'move') {
        // 编辑出入库
        var m = item.purchases[idx];
        if (!m) return;
        var h = '<h3>编辑出入库</h3>';
        h += '<div class="hrow"><label>日期</label><input class="inp" id="eir_date" type="text" readonly placeholder="选择日期" value="' + m.date + '" onclick="_dpOpen(\'eir_date\')" style="max-width:150px;cursor:pointer">';
        h += '<label>类型</label><select class="inp" id="eir_dir" style="max-width:80px">';
        h += '<option' + (m.qty >= 0 ? ' selected' : '') + '>入库</option>';
        h += '<option' + (m.qty < 0 ? ' selected' : '') + '>出库</option></select></div>';
        h += '<div class="hrow"><label>数量</label><input class="inp" id="eir_qty" type="number" step="any" style="max-width:100px" value="' + Math.abs(m.qty) + '">' + unit + '</div>';
        h += '<div class="hrow"><label>来源</label><input class="inp" id="eir_src" value="' + (m.source || '') + '" style="max-width:160px">';
        h += '<label>单价</label><input class="inp" id="eir_cost" type="number" step="0.01" value="' + (m.cost || 0) + '" style="max-width:100px">元</div>';
        h += '<div class="brow" style="margin-top:14px;justify-content:flex-end"><button class="btn p" onclick="doEditInvMove(\'' + type + '\',\'' + itemId + '\',' + idx + ')">保存</button>';
        h += '<button class="btn" onclick="closeModal()">取消</button></div>';
        showModal(h);
    } else {
        // 编辑销售
        var s = item.sales[idx];
        if (!s) return;
        var h = '<h3>编辑销售</h3>';
        h += '<div class="hrow"><label>日期</label><input class="inp" id="eir_sdate" type="text" readonly placeholder="选择日期" value="' + s.date + '" onclick="_dpOpen(\'eir_sdate\')" style="max-width:150px;cursor:pointer"></div>';

        if (type === 'tea') {
            var exp = s.expectedAmount || ((s.cups || 0) * (item.pricePerCup || 0) + (s.pots || 0) * (item.pricePerPot || 0));
            h += '<div class="hrow"><label>杯</label><input class="inp" id="eir_cups" type="number" style="max-width:70px" value="' + (s.cups || 0) + '" oninput="calcEditTeaExp(\'' + itemId + '\')">';
            h += ' 壶:<input class="inp" id="eir_pots" type="number" style="max-width:70px" value="' + (s.pots || 0) + '" oninput="calcEditTeaExp(\'' + itemId + '\')">';
            h += ' 应收:<input class="inp" id="eir_exp" type="number" step="0.01" style="max-width:90px;background:var(--card-h)" readonly value="' + exp + '"></div>';
        } else {
            var exp2 = (s.qty || 0) * (item.pricePerUnit || 0);
            h += '<div class="hrow"><label>数量</label><input class="inp" id="eir_sqty" type="number" style="max-width:100px" value="' + (s.qty || 0) + '">' + unit;
            h += ' 应收:<input class="inp" id="eir_exp" type="number" step="0.01" style="max-width:90px;background:var(--card-h)" readonly value="' + exp2 + '"></div>';
        }
        h += '<div class="hrow"><label>实收</label><input class="inp" id="eir_samt" type="number" step="0.01" style="max-width:100px" value="' + (s.amount || 0) + '">元</div>';
        h += '<div class="brow" style="margin-top:14px;justify-content:flex-end"><button class="btn p" onclick="doEditInvSale(\'' + type + '\',\'' + itemId + '\',' + idx + ')">保存</button>';
        h += '<button class="btn" onclick="closeModal()">取消</button></div>';
        showModal(h);
    }
}

// 编辑销售时自动计算应收金额（茗茶）
function calcEditTeaExp(itemId) {
    var item = DB.teaItems.find(function(i) { return i.id === itemId; });
    if (!item) return;
    var cups = parseInt($id('eir_cups').value) || 0;
    var pots = parseInt($id('eir_pots').value) || 0;
    $id('eir_exp').value = (cups * (item.pricePerCup || 0) + pots * (item.pricePerPot || 0)).toFixed(2);
}

// 保存编辑的出入库记录
function doEditInvMove(type, itemId, idx) {
    var item = DB[INV[type].key].find(function(i) { return i.id === itemId; });
    if (!item || !item.purchases[idx]) return;
    var qty = parseFloat($id('eir_qty').value) || 0;
    var dir = $id('eir_dir').value === '入库' ? 1 : -1;
    upd(function(db) {
        var it = db[INV[type].key].find(function(i) { return i.id === itemId; });
        if (it && it.purchases[idx]) {
            it.purchases[idx].qty = qty * dir;
            it.purchases[idx].date = $id('eir_date').value || td();
            it.purchases[idx].source = $id('eir_src').value.trim();
            var cost = parseFloat($id('eir_cost').value);
            if (cost > 0) it.purchases[idx].cost = cost;
        }
    });
    closeModal();
    toast('已更新');
    refreshDetBuy(type, itemId);
}

// 保存编辑的销售记录（同步更新日报）
function doEditInvSale(type, itemId, idx) {
    var item = DB[INV[type].key].find(function(i) { return i.id === itemId; });
    if (!item || !item.sales[idx]) return;
    var date = $id('eir_sdate').value || td();
    var expected = parseFloat($id('eir_exp').value) || 0;
    var amount = parseFloat($id('eir_samt').value) || expected;

    if (type === 'tea') {
        var cups = parseInt($id('eir_cups').value) || 0;
        var pots = parseInt($id('eir_pots').value) || 0;
        upd(function(db) {
            var it = db[INV[type].key].find(function(i) { return i.id === itemId; });
            if (!it) return;
            it.sales[idx] = { date: date, cups: cups, pots: pots, expectedAmount: expected, amount: amount };
            syncDailyTeaSales(db, date, itemId, cups, pots, amount);
        });
    } else if (type === 'alc') {
        var qty = parseInt($id('eir_sqty').value) || 0;
        upd(function(db) {
            var it = db[INV[type].key].find(function(i) { return i.id === itemId; });
            if (!it) return;
            it.sales[idx] = { date: date, qty: qty, amount: amount };
            syncDailyAlcSales(db, date, itemId, qty, amount);
        });
    } else if (type === 'other') {
        var qty = parseFloat($id('eir_sqty').value) || 0;
        upd(function(db) {
            var it = db[INV[type].key].find(function(i) { return i.id === itemId; });
            if (!it) return;
            it.sales[idx] = { date: date, qty: qty, amount: amount };
            syncDailyOtherSales(db, date, itemId, qty, amount);
        });
    } else {
        var qty = parseInt($id('eir_sqty').value) || 0;
        upd(function(db) {
            var it = db[INV[type].key].find(function(i) { return i.id === itemId; });
            if (!it) return;
            it.sales[idx] = { date: date, qty: qty, amount: amount };
            syncDailyCigSales(db, date, itemId, qty, amount);
        });
    }
    closeModal();
    toast('已更新');
    detRefresh(type, itemId);
}

// 删除出入库或销售记录
function delInvRow(type, itemId, rowType, idx) {
    var item = DB[INV[type].key].find(function(i) { return i.id === itemId; });
    if (!item) return;
    if (!confirm('删除此条记录？')) return;

    if (rowType === 'move') {
        upd(function(db) {
            var it = db[INV[type].key].find(function(i) { return i.id === itemId; });
            if (it) it.purchases.splice(idx, 1);
        });
        toast('已删除');
    } else {
        var sale = item.sales[idx];
        upd(function(db) {
            var it = db[INV[type].key].find(function(i) { return i.id === itemId; });
            if (!it) return;
            it.sales.splice(idx, 1);
            if (sale) {
                var date = sale.date;
                db.dailyReports.forEach(function(dr) {
                    if (dr.date !== date) return;
                    if (type === 'tea' && dr.teaSales && dr.teaSales[itemId]) delete dr.teaSales[itemId];
                    if (type === 'cig' && dr.cigSales && dr.cigSales[itemId]) delete dr.cigSales[itemId];
                });
            }
        });
        toast('已删除');
    }
    refreshDetBuy(type, itemId);
}

// ------ 日报同步 ------

// 同步香烟销售数据到日报
function syncDailyCigSales(db, date, itemId, qty, amt) {
    db.dailyReports.forEach(function(dr) {
        if (dr.date !== date) return;
        if (dr.cigSales && dr.cigSales[itemId]) {
            dr.cigSales[itemId] = { qty: qty, amount: amt };
            var total = 0;
            Object.keys(dr.cigSales).forEach(function(k) { total += dr.cigSales[k].amount || 0; });
            dr.revenue.cigarette.total = total;
        }
    });
}

// 同步茗茶销售数据到日报
function syncDailyTeaSales(db, date, itemId, cups, pots, amt) {
    db.dailyReports.forEach(function(dr) {
        if (dr.date !== date) return;
        if (dr.teaSales && dr.teaSales[itemId]) {
            dr.teaSales[itemId] = { cups: cups, pots: pots, amount: amt };
        }
    });
}

// 同步酒类销售数据到日报
function syncDailyAlcSales(db, date, itemId, qty, amt) {
    db.dailyReports.forEach(function(dr) {
        if (dr.date !== date) return;
        if (dr.alcSales && dr.alcSales[itemId]) {
            dr.alcSales[itemId] = { qty: qty, amount: amt };
        }
    });
}

// 同步其他贵重物品销售数据到日报
function syncDailyOtherSales(db, date, itemId, qty, amt) {
    db.dailyReports.forEach(function(dr) {
        if (dr.date !== date) return;
        if (dr.otherSales && dr.otherSales[itemId]) {
            dr.otherSales[itemId] = { qty: qty, amount: amt };
        }
    });
}

// ------ 详情弹窗刷新 ------

// 刷新出入库明细区域
function refreshDetBuy(type, itemId) {
    var item = DB[INV[type].key].find(function(i) { return i.id === itemId; });
    if (!item) return;
    var unit = type === 'tea' ? '克' : type === 'cig' ? '包' : '瓶';
    var ym = curYM();
    if ($id('detBuyM')) ym = $id('detBuyM').value || ym;
    $id('detBuyArea').innerHTML = renderBuyDetail(item, type, ym, unit);
}

// 销售明细月份变化时刷新
function detRefresh(type, itemId) {
    var item = DB[INV[type].key].find(function(i) { return i.id === itemId; });
    if (!item) return;
    var unit = type === 'tea' ? (item.calcMode === 'pack' ? '包' : '克') :
               type === 'other' ? (item.unit || '个') :
               type === 'cig' ? '包' : type === 'alc' ? '瓶' : '';
    var ym = $id('detM').value || curYM();
    $id('detSaleArea').innerHTML = renderSaleDetail(item, type, ym, unit);
}

// 出入库明细月份变化时刷新
function detBuyRefresh(type, itemId) {
    var item = DB[INV[type].key].find(function(i) { return i.id === itemId; });
    if (!item) return;
    var unit = type === 'tea' ? (item.calcMode === 'pack' ? '包' : '克') :
               type === 'other' ? (item.unit || '个') :
               type === 'cig' ? '包' : type === 'alc' ? '瓶' : '';
    var ym = $id('detBuyM').value || curYM();
    $id('detBuyArea').innerHTML = renderBuyDetail(item, type, ym, unit);
}

// ------ 入库/销售操作 ------

// 批量入库/销售弹窗（选择物品+填写数量）
function invMoveAll(type, dir) {
    var items = DB[INV[type].key] || [];
    if (!items.length) { toast('请先添加'); return; }
    var title = dir > 0 ? '入库' : '销售';

    var h = '<h3>' + title + '</h3>';
    h += '<div class="hrow"><label>物品</label><select class="inp" id="mvItem" style="max-width:200px">';
    items.forEach(function(item) { h += '<option value="' + item.id + '">' + item.name + '</option>'; });
    h += '</select></div>';
    h += '<div class="hrow"><label>日期</label><input class="inp" id="mvDate" type="text" readonly placeholder="选择日期" value="' + td() + '" onclick="_dpOpen(\'mvDate\')" style="max-width:150px;cursor:pointer"></div>';
    h += '<div id="mvFields"></div>';
    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end"><button class="btn p" onclick="doInvMoveAll(\'' + type + '\',' + dir + ')">' + title + '</button>';
    h += '<button class="btn" onclick="closeModal()">取消</button></div>';
    showModal(h);
    updateMvF(type, dir);
    $id('mvItem').onchange = function() { updateMvF(type, dir); };
}

// 根据选择的物品类型更新入库/销售表单字段
function updateMvF(type, dir) {
    var itemId = $id('mvItem').value;
    var item = DB[INV[type].key].find(function(i) { return i.id === itemId; });
    if (!item) return;
    var h = '';

    if (type === 'tea') {
        var mode = item.calcMode || 'gram';
        if (dir > 0) {
            // 茗茶入库
            if (mode === 'gram') {
                h += '<div class="hrow"><label>数量</label><input class="inp" id="mvQty" type="number" step="any" style="max-width:120px">';
                h += '<select class="inp" id="mvUnit" style="max-width:80px"><option value="克">克</option><option value="斤">斤</option></select>';
                h += '<label>来源</label><input class="inp" id="mvReason" style="max-width:150px"></div>';
                h += '<div class="hrow"><label>进货价</label><input class="inp" id="mvCost" type="number" step="0.01" style="max-width:100px">元</div>';
            } else {
                h += '<div class="hrow"><label>数量</label><input class="inp" id="mvQty" type="number" step="any" style="max-width:120px">包 ';
                h += '<label>来源</label><input class="inp" id="mvReason" style="max-width:150px"></div>';
                h += '<div class="hrow"><label>进货价</label><input class="inp" id="mvCost" type="number" step="0.01" style="max-width:100px">元</div>';
                h += '<input type="hidden" id="mvUnit" value="包">';
            }
        } else {
            // 茗茶销售
            h += '<div class="hrow"><label>杯</label><input class="inp" id="mvCups" type="number" value="0" style="max-width:50px" oninput="calcMvTeaAmt()"> ';
            h += '壶:<input class="inp" id="mvPots" type="number" value="0" style="max-width:50px" oninput="calcMvTeaAmt()"> ';
            h += '应收:<input class="inp" id="mvExpected" type="number" step="0.01" value="0" style="max-width:90px;background:var(--card-h)" readonly> ';
            h += '实收:<input class="inp" id="mvAmount" type="number" step="0.01" value="0" style="max-width:90px"></div>';
            h += '<div class="hrow"><label>原因</label><input class="inp" id="mvReason" style="max-width:150px" value="销售"></div>';
        }
    } else if (type === 'cig') {
        if (dir > 0) {
            h += '<div class="hrow"><label>数量</label><input class="inp" id="mvQty" type="number" step="any" style="max-width:120px">';
            h += '<select class="inp" id="mvUnit" style="max-width:80px"><option value="条">条</option><option value="包">包</option></select>';
            h += '<label>来源</label><input class="inp" id="mvReason" style="max-width:150px"></div>';
            h += '<div class="hrow"><label>进货价</label><input class="inp" id="mvCost" type="number" step="0.01" style="max-width:100px">元</div>';
        } else {
            h += '<div class="hrow"><label>数量</label><input class="inp" id="mvQty" type="number" value="0" style="max-width:60px" oninput="calcMvCigAmt()"> 包 </div>';
            h += '<div class="hrow"><label>应收</label><input class="inp" id="mvExpected" type="number" step="0.01" value="0" style="max-width:90px;background:var(--card-h)" readonly>';
            h += '实收:<input class="inp" id="mvAmount" type="number" step="0.01" value="0" style="max-width:90px"></div>';
            h += '<div class="hrow"><label>原因</label><input class="inp" id="mvReason" style="max-width:150px" value="销售"></div>';
        }
    } else if (type === 'other') {
        var itemUnit = item.unit || '个';
        if (dir > 0) {
            h += '<div class="hrow"><label>数量</label><input class="inp" id="mvQty" type="number" step="any" style="max-width:120px">';
            h += '<input class="inp" id="mvUnit" type="text" value="' + itemUnit + '" style="max-width:80px" readonly>';
            h += '<label>来源</label><input class="inp" id="mvReason" style="max-width:150px"></div>';
            h += '<div class="hrow"><label>进货价</label><input class="inp" id="mvCost" type="number" step="0.01" style="max-width:100px">元</div>';
        } else {
            h += '<div class="hrow"><label>数量</label><input class="inp" id="mvQty" type="number" value="0" style="max-width:60px" oninput="calcMvOtherAmt()"> ' + itemUnit + ' ';
            h += '金额:<input class="inp" id="mvAmount" type="number" step="0.01" value="0" style="max-width:100px;background:var(--card-h)" readonly></div>';
            h += '<div class="hrow"><label>原因</label><input class="inp" id="mvReason" style="max-width:150px" value="销售"></div>';
        }
    } else {
        if (dir > 0) {
            h += '<div class="hrow"><label>数量</label><input class="inp" id="mvQty" type="number" step="any" style="max-width:120px">';
            h += '<select class="inp" id="mvUnit" style="max-width:80px"><option value="箱">箱</option><option value="瓶">瓶</option></select>';
            h += '<label>来源</label><input class="inp" id="mvReason" style="max-width:150px"></div>';
            h += '<div class="hrow"><label>进货价</label><input class="inp" id="mvCost" type="number" step="0.01" style="max-width:100px">元</div>';
        } else {
            h += '<div class="hrow"><label>数量</label><input class="inp" id="mvQty" type="number" value="0" style="max-width:60px" oninput="calcMvAlcAmt()"> 瓶 ';
            h += '金额:<input class="inp" id="mvAmount" type="number" step="0.01" value="0" style="max-width:100px;background:var(--card-h)" readonly></div>';
            h += '<div class="hrow"><label>原因</label><input class="inp" id="mvReason" style="max-width:150px" value="销售"></div>';
        }
    }

    $id('mvFields').innerHTML = h;
}

// 销售时自动计算茗茶应收金额
function calcMvTeaAmt() {
    var itemId = $id('mvItem').value;
    var item = DB.teaItems.find(function(i) { return i.id === itemId; });
    if (!item) return;
    var cups = parseInt($id('mvCups').value) || 0;
    var pots = parseInt($id('mvPots').value) || 0;
    $id('mvExpected').value = (cups * (item.pricePerCup || 0) + pots * (item.pricePerPot || 0)).toFixed(2);
}

// 销售时自动计算香烟金额
function calcMvCigAmt() {
    var itemId = $id('mvItem').value;
    var item = DB.cigItems.find(function(i) { return i.id === itemId; });
    if (!item) return;
    var qty = parseInt($id('mvQty').value) || 0;
    var expected = (qty * (item.pricePerUnit || 0)).toFixed(2);
    $id('mvExpected').value = expected;
    // 实收跟随应收更新（只有实收等于之前的应收时才更新）
    var amtInput = $id('mvAmount');
    var prevExpected = amtInput.dataset.prevExpected || '0';
    if (parseFloat(amtInput.value) === parseFloat(prevExpected)) {
        amtInput.value = expected;
    }
    amtInput.dataset.prevExpected = expected;
}

// 销售时自动计算酒类金额
function calcMvAlcAmt() {
    var itemId = $id('mvItem').value;
    var item = DB.alcItems.find(function(i) { return i.id === itemId; });
    if (!item) return;
    var qty = parseInt($id('mvQty').value) || 0;
    $id('mvAmount').value = (qty * (item.pricePerUnit || 0)).toFixed(2);
}

// 销售时自动计算其他贵重物品金额
function calcMvOtherAmt() {
    var itemId = $id('mvItem').value;
    var item = DB.otherItems.find(function(i) { return i.id === itemId; });
    if (!item) return;
    var qty = parseInt($id('mvQty').value) || 0;
    $id('mvAmount').value = (qty * (item.pricePerUnit || 0)).toFixed(2);
}

// 执行批量入库/销售（委托给 doInvMove）
function doInvMoveAll(type, dir) {
    var itemId = $id('mvItem').value;
    if (!itemId) { toast('选物品'); return; }
    doInvMove(type, itemId, dir);
}

// 执行单个物品的入库或销售操作
function doInvMove(type, id, dir) {
    var date = $id('mvDate').value || td();
    var cfg = INV[type];

    if (dir > 0) {
        // 入库
        var qty = parseFloat($id('mvQty').value);
        var unit = $id('mvUnit').value;
        if (isNaN(qty) || qty <= 0) { toast('填数量'); return; }

        var stockQty = qty;
        if (type === 'tea') {
            var it = DB[cfg.key].find(function(i) { return i.id === id; });
            if (it && it.calcMode === 'pack') { stockQty = qty; }
            else { if (unit === '斤') stockQty = qty * 500; }
        } else if (type === 'cig') {
            var it = DB[cfg.key].find(function(i) { return i.id === id; });
            if (unit === '条') stockQty = qty * (it ? it.purchaseConvRatio || 10 : 10);
        } else {
            var it = DB[cfg.key].find(function(i) { return i.id === id; });
            if (unit === '箱') stockQty = qty * (it ? it.purchaseConvRatio || 12 : 12);
        }
        stockQty = Math.round(stockQty * 100) / 100;

        var entry = { date: date, qty: stockQty, source: $id('mvReason').value || '' };
        var cost = parseFloat($id('mvCost').value);
        if (cost > 0) entry.cost = cost;

        upd(function(db) {
            var it = db[cfg.key].find(function(i) { return i.id === id; });
            if (!it) return;
            it.purchases.push(entry);
        });
        closeModal();
        toast('入库 ' + qty + unit);
    } else {
        // 销售
        var reason = $id('mvReason').value || '';

        if (type === 'tea') {
            var it = DB[cfg.key].find(function(i) { return i.id === id; });
            if (!it) return;
            var cups = parseInt($id('mvCups').value) || 0;
            var pots = parseInt($id('mvPots').value) || 0;
            var expected = parseFloat($id('mvExpected').value) || 0;
            var amount = parseFloat($id('mvAmount').value) || expected;
            var mode = it.calcMode || 'gram';
            var stockUsed = 0;
            if (mode === 'pack') stockUsed = cups * (it.packsPerCup || 1) + pots * (it.packsPerPot || 2);
            else stockUsed = cups * (it.gramsPerCup || 5) + pots * (it.gramsPerPot || 15);
            stockUsed = Math.round(stockUsed * 100) / 100;

            upd(function(db) {
                var it2 = db[cfg.key].find(function(i) { return i.id === id; });
                if (!it2) return;
                it2.sales.push({ date: date, cups: cups, pots: pots, expectedAmount: expected, amount: amount });
            });

            // ★ 同步日报
            syncInvToDaily(type, date);

            closeModal();
            toast('销售 ' + cups + '杯' + pots + '壶 应收:' + expected.toFixed(2) + ' 实收:' + amount.toFixed(2));
        } else if (type === 'cig') {
            var qty = parseInt($id('mvQty').value) || 0;
            var expected = parseFloat($id('mvExpected').value) || 0;
            var amount = parseFloat($id('mvAmount').value) || expected;
            if (qty <= 0) { toast('填数量'); return; }
            upd(function(db) {
                var it = db[cfg.key].find(function(i) { return i.id === id; });
                if (!it) return;
                it.sales.push({ date: date, qty: qty, expectedAmount: expected, amount: amount });
            });

            // ★ 同步日报
            syncInvToDaily(type, date);

            closeModal();
            toast('销售 ' + qty + (item.unit || '包') + ' 应收:' + expected.toFixed(2) + ' 实收:' + amount.toFixed(2));
        } else {
            var qty = parseInt($id('mvQty').value) || 0;
            var amount = parseFloat($id('mvAmount').value) || 0;
            if (qty <= 0) { toast('填数量'); return; }
            upd(function(db) {
                var it = db[cfg.key].find(function(i) { return i.id === id; });
                if (!it) return;
                it.sales.push({ date: date, qty: qty, amount: amount });
            });

            // ★ 同步日报
            syncInvToDaily(type, date);

            closeModal();
            var itemUnit = DB[cfg.key].find(function(i) { return i.id === id; });
            toast('销售 ' + qty + (itemUnit ? (itemUnit.unit || '个') : '个') + ' ' + amount.toFixed(2) + '元');
        }
    }
    rInv(type);
}

// ------ 添加/编辑库存商品 ------

// 切换茗茶计算模式（克/包）
function toggleTeaMode() {
    var m = $id('ai_mode').value;
    var g = $id('teaGram'), p = $id('teaPack');
    if (g) g.style.display = m === 'gram' ? '' : 'none';
    if (p) p.style.display = m === 'pack' ? '' : 'none';
}

function toggleOtherMode() {
    var m = $id('ai_otherMode').value;
    var s = $id('otherSimple'), g = $id('otherGram'), p = $id('otherPack');
    if (s) s.style.display = m === 'simple' ? '' : 'none';
    if (g) g.style.display = m === 'gram' ? '' : 'none';
    if (p) p.style.display = m === 'pack' ? '' : 'none';
}

// 自动计算成本/克 或 成本/包
function autoCalcCost(mode) {
    if (mode === 'gram') {
        var os = parseFloat($id('ai_os_g').value) || 0;
        var ov = parseFloat($id('ai_ov_g').value) || 0;
        if (os > 0 && ov > 0) $id('ai_costPerGram').value = (Math.round(ov / os * 1000) / 1000).toFixed(3);
    } else {
        var os = parseFloat($id('ai_os_p').value) || 0;
        var ov = parseFloat($id('ai_ov_p').value) || 0;
        if (os > 0 && ov > 0) $id('ai_cpp').value = (Math.round(ov / os * 100) / 100).toFixed(2);
    }
}

// FIFO 月度销售成本（通用：茗茶/香烟/酒类）

// 弹窗添加/编辑库存商品（茗茶支持克/包两种模式）
function showAddInv(type, itemId) {
    var item = null;
    if (itemId) item = DB[INV[type].key].find(function(i) { return i.id === itemId; });
    var isEdit = !!item;
    // 获取当前选中的月份
    var ym = document.getElementById('invMonth') ? document.getElementById('invMonth').value : curYM();
    if (!ym) ym = curYM();
    // 获取该月份的期初库存
    var currentOS = isEdit ? getOpeningStock(item, ym) : 0;

    var h = '<h3>' + (isEdit ? '编辑' : '添加') + ' ' + INV[type].label + '</h3>';
    // 茶叶
    if (type === 'tea') {
        var mode = (isEdit ? item.calcMode : '') || 'gram';
        h += '<div class="section-label">基本信息</div>';
        h += '<div class="hrow"><label>茶品名称</label><input class="inp" id="ai_name" style="flex:2" value="' + (isEdit ? item.name.replace(/"/g, '&quot;') : '') + '">';
        h += '<label>计算方式</label><select class="inp" id="ai_mode" style="max-width:80px" onchange="toggleTeaMode()">';
        h += '<option value="gram"' + (mode === 'gram' ? ' selected' : '') + '>克</option>';
        h += '<option value="pack"' + (mode === 'pack' ? ' selected' : '') + '>包</option></select></div>';

        // 克模式
        h += '<div id="teaGram"' + (mode !== 'gram' ? ' style="display:none"' : '') + '>';
        h += '<div class="section-label">成本(按克)</div>';
        h += '<div class="hrow"><label>成本/克</label><input class="inp" id="ai_costPerGram" type="number" step="0.001" style="max-width:100px" value="' + (isEdit ? (item.costPerGram || 0) : '') + '">元';
        h += ' <span style="font-size:.72rem;color:var(--tx-m)">或 期初:</span><input class="inp" id="ai_os_g" type="number" step="0.1" placeholder="克" style="max-width:70px" value="' + (isEdit ? currentOS : '') + '"><input class="inp" id="ai_ov_g" type="number" step="0.01" placeholder="元" style="max-width:70px"><button class="btn s" onclick="autoCalcCost(\'gram\')">自动算</button></div>';
        h += '<div class="section-label">定价</div>';
        h += '<div class="hrow"><label>克/杯</label><input class="inp" id="ai_gpc" type="number" step="0.1" style="max-width:50px" value="' + (isEdit ? (item.gramsPerCup || 5) : 5) + '">';
        h += '<label>售价/杯</label><input class="inp" id="ai_ppc" type="number" step="0.01" style="max-width:80px" value="' + (isEdit ? (item.pricePerCup || 0) : '') + '">元';
        h += ' <label>克/壶</label><input class="inp" id="ai_gpp" type="number" step="0.1" style="max-width:50px" value="' + (isEdit ? (item.gramsPerPot || 15) : 15) + '">';
        h += '<label>售价/壶</label><input class="inp" id="ai_ppp" type="number" step="0.01" style="max-width:80px" value="' + (isEdit ? (item.pricePerPot || 0) : '') + '">元</div>';
        h += '<div class="section-label">库存</div>';
        h += '<div class="hrow"><label>期初库存</label><input class="inp" id="ai_os_g2" type="number" style="max-width:80px" value="' + (isEdit ? currentOS : 0) + '">克';
        h += ' <label>补货提醒</label><input class="inp" id="ai_ra_g" type="number" style="max-width:80px" value="' + (isEdit ? item.restockAlert || 0 : 0) + '">克<span style="font-size:.72rem;color:var(--tx-m)">(0=不提醒)</span></div>';
        h += '<div style="font-size:.72rem;color:var(--tx-s);margin-bottom:8px">采购换算: 1斤=500克</div>';
        h += '</div>';

        // 包模式
        h += '<div id="teaPack"' + (mode !== 'pack' ? ' style="display:none"' : '') + '>';
        h += '<div class="section-label">成本(按包)</div>';
        var gpk = isEdit ? (item.gramsPerPack || 250) : 250;
        h += '<div class="hrow"><label>克/包</label><input class="inp" id="ai_gpk" type="number" step="1" style="max-width:80px" value="' + gpk + '">';
        h += '<label>成本/包</label><input class="inp" id="ai_cpp" type="number" step="0.01" style="max-width:100px" value="' + (isEdit ? (item.costPerPack || 0) : '') + '">元';
        h += ' <span style="font-size:.72rem;color:var(--tx-m)">或 期初:</span><input class="inp" id="ai_os_p" type="number" step="1" placeholder="包" style="max-width:70px" value="' + (isEdit ? currentOS : '') + '"><input class="inp" id="ai_ov_p" type="number" step="0.01" placeholder="元" style="max-width:70px"><button class="btn s" onclick="autoCalcCost(\'pack\')">自动算</button></div>';
        h += '<div class="section-label">定价</div>';
        h += '<div class="hrow"><label>包/杯</label><input class="inp" id="ai_ppcup" type="number" step="1" style="max-width:50px" value="' + (isEdit ? (item.packsPerCup || 1) : 1) + '">';
        h += '<label>售价/杯</label><input class="inp" id="ai_ppc2" type="number" step="0.01" style="max-width:80px" value="' + (isEdit ? (item.pricePerCup || 0) : '') + '">元';
        h += ' <label>包/壶</label><input class="inp" id="ai_pppot" type="number" step="1" style="max-width:50px" value="' + (isEdit ? (item.packsPerPot || 2) : 2) + '">';
        h += '<label>售价/壶</label><input class="inp" id="ai_ppp2" type="number" step="0.01" style="max-width:80px" value="' + (isEdit ? (item.pricePerPot || 0) : '') + '">元</div>';
        h += '<div class="section-label">库存</div>';
        h += '<div class="hrow"><label>期初库存</label><input class="inp" id="ai_os_p2" type="number" style="max-width:80px" value="' + (isEdit ? currentOS : 0) + '">包';
        h += ' <label>补货提醒</label><input class="inp" id="ai_ra_p" type="number" style="max-width:80px" value="' + (isEdit ? item.restockAlert || 0 : 0) + '">包<span style="font-size:.72rem;color:var(--tx-m)">(0=不提醒)</span></div>';
        h += '<div style="font-size:.72rem;color:var(--tx-s);margin-bottom:8px">采购换算: 1斤=500克 ÷ ' + gpk + '克/包 ≈ ' + Math.floor(500 / gpk) + '包</div>';
        h += '</div>';
    // 其他贵重物品（可选计算方式）
    } else if (type === 'other') {
        var oMode = (isEdit ? item.calcMode : '') || 'simple';
        h += '<div class="section-label">基本信息</div>';
        h += '<div class="hrow"><label>品名</label><input class="inp" id="ai_name" style="flex:2" value="' + (isEdit ? item.name.replace(/"/g, '&quot;') : '') + '">';
        h += '<label>分类</label><input class="inp" id="ai_category" list="otherCatDL" style="max-width:120px" value="' + (isEdit ? (item.category || '') : '') + '">';
        h += '<datalist id="otherCatDL">';
        var allCats = getPurCats();
        allCats.forEach(function(c) { h += '<option value="' + c + '">'; });
        h += '</datalist></div>';
        h += '<div class="hrow"><label>单位</label><input class="inp" id="ai_unit" style="max-width:80px" value="' + (isEdit ? (item.unit || '个') : '个') + '">';
        h += '<label>计算方式</label><select class="inp" id="ai_otherMode" style="max-width:100px" onchange="toggleOtherMode()">';
        h += '<option value="simple"' + (oMode === 'simple' ? ' selected' : '') + '>简单模式</option>';
        h += '<option value="gram"' + (oMode === 'gram' ? ' selected' : '') + '>按克消耗</option>';
        h += '<option value="pack"' + (oMode === 'pack' ? ' selected' : '') + '>按包消耗</option></select></div>';
        h += '<div class="hrow"><label>匹配关键词</label><input class="inp" id="ai_matchKeyword" style="flex:2" value="' + (isEdit ? (item.matchKeyword || '').replace(/"/g, '&quot;') : '') + '">';
        h += '<span style="font-size:.72rem;color:var(--tx-m)">采购单名称包含此关键词时自动匹配</span></div>';

        // 简单模式（同香烟/酒类）
        h += '<div id="otherSimple"' + (oMode !== 'simple' ? ' style="display:none"' : '') + '>';
        h += '<div class="hrow"><label>成本/个</label><input class="inp" id="ai_costPerUnit" type="number" step="0.01" style="max-width:100px" value="' + (isEdit ? (item.costPerUnit || 0) : '') + '">元';
        h += ' <label>售价/个</label><input class="inp" id="ai_pricePerUnit" type="number" step="0.01" style="max-width:100px" value="' + (isEdit ? (item.pricePerUnit || 0) : '') + '">元</div>';
        h += '<div class="section-label">库存</div>';
        h += '<div class="hrow"><label>期初库存</label><input class="inp" id="ai_os" type="number" style="max-width:80px" value="' + (isEdit ? currentOS : 0) + '">个';
        h += ' <label>期初单价</label><input class="inp" id="ai_openCost" type="number" step="0.01" style="max-width:100px" value="' + (isEdit ? (item.openingUnitCost || 0) : '') + '">元/个';
        h += ' <label>补货提醒</label><input class="inp" id="ai_ra" type="number" style="max-width:80px" value="' + (isEdit ? (item.restockAlert || 0) : 0) + '">个<span style="font-size:.72rem;color:var(--tx-m)">(0=不提醒)</span></div>';
        h += '</div>';

        // 按克消耗模式（同茗茶克模式）
        h += '<div id="otherGram"' + (oMode !== 'gram' ? ' style="display:none"' : '') + '>';
        h += '<div class="section-label">成本(按克)</div>';
        h += '<div class="hrow"><label>成本/克</label><input class="inp" id="ai_costPerGram" type="number" step="0.001" style="max-width:100px" value="' + (isEdit ? (item.costPerGram || 0) : '') + '">元';
        h += ' <span style="font-size:.72rem;color:var(--tx-m)">或 期初:</span><input class="inp" id="ai_os_g" type="number" step="0.1" placeholder="克" style="max-width:70px" value="' + (isEdit ? currentOS : '') + '"><input class="inp" id="ai_ov_g" type="number" step="0.01" placeholder="元" style="max-width:70px"><button class="btn s" onclick="autoCalcCost(\'gram\')">自动算</button></div>';
        h += '<div class="section-label">消耗换算</div>';
        h += '<div class="hrow"><label>克/次</label><input class="inp" id="ai_gpc" type="number" step="0.1" style="max-width:50px" value="' + (isEdit ? (item.gramsPerCup || 1) : 1) + '">';
        h += '<label>售价/次</label><input class="inp" id="ai_ppc" type="number" step="0.01" style="max-width:80px" value="' + (isEdit ? (item.pricePerCup || 0) : '') + '">元</div>';
        h += '<div class="section-label">库存</div>';
        h += '<div class="hrow"><label>期初库存</label><input class="inp" id="ai_os_g2" type="number" style="max-width:80px" value="' + (isEdit ? currentOS : 0) + '">克';
        h += ' <label>补货提醒</label><input class="inp" id="ai_ra_g" type="number" style="max-width:80px" value="' + (isEdit ? (item.restockAlert || 0) : 0) + '">克<span style="font-size:.72rem;color:var(--tx-m)">(0=不提醒)</span></div>';
        h += '</div>';

        // 按包消耗模式（同茗茶包模式）
        h += '<div id="otherPack"' + (oMode !== 'pack' ? ' style="display:none"' : '') + '>';
        h += '<div class="section-label">成本(按包)</div>';
        var ogpk = isEdit ? (item.gramsPerPack || 250) : 250;
        h += '<div class="hrow"><label>克/包</label><input class="inp" id="ai_gpk" type="number" step="1" style="max-width:80px" value="' + ogpk + '">';
        h += '<label>成本/包</label><input class="inp" id="ai_cpp" type="number" step="0.01" style="max-width:100px" value="' + (isEdit ? (item.costPerPack || 0) : '') + '">元';
        h += ' <span style="font-size:.72rem;color:var(--tx-m)">或 期初:</span><input class="inp" id="ai_os_p" type="number" step="1" placeholder="包" style="max-width:70px" value="' + (isEdit ? currentOS : '') + '"><input class="inp" id="ai_ov_p" type="number" step="0.01" placeholder="元" style="max-width:70px"><button class="btn s" onclick="autoCalcCost(\'pack\')">自动算</button></div>';
        h += '<div class="section-label">消耗换算</div>';
        h += '<div class="hrow"><label>包/次</label><input class="inp" id="ai_ppcup" type="number" step="1" style="max-width:50px" value="' + (isEdit ? (item.packsPerCup || 1) : 1) + '">';
        h += '<label>售价/次</label><input class="inp" id="ai_ppc2" type="number" step="0.01" style="max-width:80px" value="' + (isEdit ? (item.pricePerCup || 0) : '') + '">元</div>';
        h += '<div class="section-label">库存</div>';
        h += '<div class="hrow"><label>期初库存</label><input class="inp" id="ai_os_p2" type="number" style="max-width:80px" value="' + (isEdit ? currentOS : 0) + '">包';
        h += ' <label>补货提醒</label><input class="inp" id="ai_ra_p" type="number" style="max-width:80px" value="' + (isEdit ? (item.restockAlert || 0) : 0) + '">包<span style="font-size:.72rem;color:var(--tx-m)">(0=不提醒)</span></div>';
        h += '</div>';
    // 香烟
    } else if (type === 'cig') {
        h += '<div class="section-label">基本信息</div>';
        h += '<div class="hrow"><label>品牌</label><input class="inp" id="ai_name" style="flex:2" value="' + (isEdit ? item.name.replace(/"/g, '&quot;') : '') + '">';
        h += '<label>成本/包</label><input class="inp" id="ai_costPerUnit" type="number" step="0.01" style="max-width:100px" value="' + (isEdit ? (item.costPerUnit || 0) : '') + '">元';
        h += ' <label>售价/包</label><input class="inp" id="ai_pricePerUnit" type="number" step="0.01" style="max-width:100px" value="' + (isEdit ? (item.pricePerUnit || 0) : '') + '">元</div>';
        h += '<div class="hrow"><label>匹配关键词</label><input class="inp" id="ai_matchKeyword" style="flex:2" value="' + (isEdit ? (item.matchKeyword || '').replace(/"/g, '&quot;') : '') + '">';
        h += '<span style="font-size:.72rem;color:var(--tx-m)">采购单名称包含此关键词时自动匹配</span></div>';
        h += '<div class="section-label">库存</div>';
        h += '<div class="hrow"><label>期初库存</label><input class="inp" id="ai_os" type="number" style="max-width:80px" value="' + (isEdit ? currentOS : 0) + '">包';
        h += ' <label>期初单价</label><input class="inp" id="ai_openCost" type="number" step="0.01" style="max-width:100px" value="' + (isEdit ? (item.openingUnitCost || 0) : '') + '">元/包';
        h += ' <label>补货提醒</label><input class="inp" id="ai_ra" type="number" style="max-width:80px" value="' + (isEdit ? (item.restockAlert || 10) : 10) + '">包<span style="font-size:.72rem;color:var(--tx-m)">(0=不提醒)</span></div>';
        h += '<div class="section-label">采购</div>';
        h += '<div class="hrow"><label>采购单位</label><select class="inp" id="ai_pu" style="max-width:80px"><option' + ((isEdit ? item.purchaseUnit : '条') === '条' ? ' selected' : '') + '>条</option></select>';
        h += '<span style="font-size:.74rem;color:var(--tx-s)">1条 = <input class="inp" id="ai_cr" type="number" style="width:50px;display:inline-block;padding:3px 6px" value="' + (isEdit ? (item.purchaseConvRatio || 10) : 10) + '"> 包</span></div>';
    // 酒类
    } else {
        h += '<div class="section-label">基本信息</div>';
        h += '<div class="hrow"><label>品名</label><input class="inp" id="ai_name" style="flex:2" value="' + (isEdit ? item.name.replace(/"/g, '&quot;') : '') + '">';
        h += '<label>成本/瓶</label><input class="inp" id="ai_costPerUnit" type="number" step="0.01" style="max-width:100px" value="' + (isEdit ? (item.costPerUnit || 0) : '') + '">元';
        h += ' <label>售价/瓶</label><input class="inp" id="ai_pricePerUnit" type="number" step="0.01" style="max-width:100px" value="' + (isEdit ? (item.pricePerUnit || 0) : '') + '">元</div>';
        h += '<div class="hrow"><label>匹配关键词</label><input class="inp" id="ai_matchKeyword" style="flex:2" value="' + (isEdit ? (item.matchKeyword || '').replace(/"/g, '&quot;') : '') + '">';
        h += '<span style="font-size:.72rem;color:var(--tx-m)">采购单名称包含此关键词时自动匹配</span></div>';
        h += '<div class="section-label">库存</div>';
        h += '<div class="hrow"><label>期初库存</label><input class="inp" id="ai_os" type="number" style="max-width:80px" value="' + (isEdit ? currentOS : 0) + '">瓶';
        h += ' <label>期初单价</label><input class="inp" id="ai_openCost" type="number" step="0.01" style="max-width:100px" value="' + (isEdit ? (item.openingUnitCost || 0) : '') + '">元/瓶';
        h += ' <label>补货提醒</label><input class="inp" id="ai_ra" type="number" style="max-width:80px" value="' + (isEdit ? (item.restockAlert || 10) : 10) + '">瓶<span style="font-size:.72rem;color:var(--tx-m)">(0=不提醒)</span></div>';
        h += '<div class="section-label">采购</div>';
        h += '<div class="hrow"><label>采购单位</label><select class="inp" id="ai_pu" style="max-width:80px"><option' + ((isEdit ? item.purchaseUnit : '箱') === '箱' ? ' selected' : '') + '>箱</option></select>';
        h += '<span style="font-size:.74rem;color:var(--tx-s)">1箱 = <input class="inp" id="ai_cr" type="number" style="width:50px;display:inline-block;padding:3px 6px" value="' + (isEdit ? (item.purchaseConvRatio || 12) : 12) + '"> 瓶</span></div>';
    } 

    h += '<div class="brow" style="margin-top:16px;justify-content:flex-end"><button class="btn p" onclick="doAddInv(\'' + type + '\'' + (isEdit ? ',\'' + itemId + '\'' : '') + ')">' + (isEdit ? '保存修改' : '添加') + '</button>';
    h += '<button class="btn" onclick="closeModal()">取消</button></div>';
    showModal(h);
}

// 保存库存商品（新建或编辑）
function doAddInv(type, itemId) {
    var cfg = INV[type];
    var name = ($id('ai_name').value || '').trim();
    console.log('doAddInv: type=' + type + ', itemId=' + itemId + ', name=' + name);
    if (!name) { toast('填名称'); return; }

    if (type === 'tea') {
        var mode = $id('ai_mode').value;
        if (itemId) {
            // 编辑
            upd(function(db) {
                var it = db[cfg.key].find(function(i) { return i.id === itemId; });
                if (!it) return;
                it.name = name; it.calcMode = mode;
                if (mode === 'gram') {
                    it.costPerGram = parseFloat($id('ai_costPerGram').value) || 0;
                    it.gramsPerCup = parseFloat($id('ai_gpc').value) || 5;
                    it.gramsPerPot = parseFloat($id('ai_gpp').value) || 15;
                    it.pricePerCup = parseFloat($id('ai_ppc').value) || 0;
                    it.pricePerPot = parseFloat($id('ai_ppp').value) || 0;
                    it.openingStock = parseFloat($id('ai_os_g2').value) || 0;
                    it.restockAlert = parseInt($id('ai_ra_g').value) || 0;
                } else {
                    it.gramsPerPack = parseFloat($id('ai_gpk').value) || 250;
                    it.costPerPack = parseFloat($id('ai_cpp').value) || 0;
                    it.packsPerCup = parseFloat($id('ai_ppcup').value) || 1;
                    it.packsPerPot = parseFloat($id('ai_pppot').value) || 2;
                    it.pricePerCup = parseFloat($id('ai_ppc2').value) || 0;
                    it.pricePerPot = parseFloat($id('ai_ppp2').value) || 0;
                    it.openingStock = parseFloat($id('ai_os_p2').value) || 0;
                    it.restockAlert = parseInt($id('ai_ra_p').value) || 0;
                }
            });
            toast('已更新');
        } else {
            // 新建
            var item = { id: type + '_' + Date.now(), name: name, calcMode: mode, sales: [], purchases: [] };
            if (mode === 'gram') {
                item.costPerGram = parseFloat($id('ai_costPerGram').value) || 0;
                item.gramsPerCup = parseFloat($id('ai_gpc').value) || 5;
                item.gramsPerPot = parseFloat($id('ai_gpp').value) || 15;
                item.pricePerCup = parseFloat($id('ai_ppc').value) || 0;
                item.pricePerPot = parseFloat($id('ai_ppp').value) || 0;
                item.openingStock = parseFloat($id('ai_os_g2').value) || 0;
                item.restockAlert = parseInt($id('ai_ra_g').value) || 0;
            } else {
                item.gramsPerPack = parseFloat($id('ai_gpk').value) || 250;
                item.costPerPack = parseFloat($id('ai_cpp').value) || 0;
                item.packsPerCup = parseFloat($id('ai_ppcup').value) || 1;
                item.packsPerPot = parseFloat($id('ai_pppot').value) || 2;
                item.pricePerCup = parseFloat($id('ai_ppc2').value) || 0;
                item.pricePerPot = parseFloat($id('ai_ppp2').value) || 0;
                item.openingStock = parseFloat($id('ai_os_p2').value) || 0;
                item.restockAlert = parseInt($id('ai_ra_p').value) || 0;
            }
            upd(function(db) {
                if (!db[cfg.key]) db[cfg.key] = [];
                db[cfg.key].push(item);
            });
            toast('已添加');
        }
    } else if (type === 'other') {
        var oMode = $id('ai_otherMode').value;
        if (itemId) {
            upd(function(db) {
                var it = db[cfg.key].find(function(i) { return i.id === itemId; });
                if (!it) return;
                it.name = name; it.calcMode = oMode === 'simple' ? '' : oMode;
                it.category = $id('ai_category').value || '';
                it.unit = $id('ai_unit').value || '个';
                var mk = $id('ai_matchKeyword'); if (mk) it.matchKeyword = mk.value.trim();
                if (oMode === 'simple') {
                    it.costPerUnit = parseFloat($id('ai_costPerUnit').value) || 0;
                    it.pricePerUnit = parseFloat($id('ai_pricePerUnit').value) || 0;
                    it.openingStock = parseFloat($id('ai_os').value) || 0;
                    it.openingUnitCost = parseFloat($id('ai_openCost').value) || 0;
                    it.restockAlert = parseInt($id('ai_ra').value) || 0;
                } else if (oMode === 'gram') {
                    it.costPerGram = parseFloat($id('ai_costPerGram').value) || 0;
                    it.gramsPerCup = parseFloat($id('ai_gpc').value) || 1;
                    it.pricePerCup = parseFloat($id('ai_ppc').value) || 0;
                    it.openingStock = parseFloat($id('ai_os_g2').value) || 0;
                    it.restockAlert = parseInt($id('ai_ra_g').value) || 0;
                } else {
                    it.gramsPerPack = parseFloat($id('ai_gpk').value) || 250;
                    it.costPerPack = parseFloat($id('ai_cpp').value) || 0;
                    it.packsPerCup = parseFloat($id('ai_ppcup').value) || 1;
                    it.pricePerCup = parseFloat($id('ai_ppc2').value) || 0;
                    it.openingStock = parseFloat($id('ai_os_p2').value) || 0;
                    it.restockAlert = parseInt($id('ai_ra_p').value) || 0;
                }
            });
            toast('已更新');
        } else {
            var item = { id: type + '_' + Date.now(), name: name, calcMode: oMode === 'simple' ? '' : oMode, category: $id('ai_category').value || '', unit: $id('ai_unit').value || '个', sales: [], purchases: [] };
            var mk = $id('ai_matchKeyword');
            item.matchKeyword = mk ? mk.value.trim() : '';
            if (oMode === 'simple') {
                item.costPerUnit = parseFloat($id('ai_costPerUnit').value) || 0;
                item.pricePerUnit = parseFloat($id('ai_pricePerUnit').value) || 0;
                item.openingStock = parseFloat($id('ai_os').value) || 0;
                item.openingUnitCost = parseFloat($id('ai_openCost').value) || 0;
                item.restockAlert = parseInt($id('ai_ra').value) || 0;
            } else if (oMode === 'gram') {
                item.costPerGram = parseFloat($id('ai_costPerGram').value) || 0;
                item.gramsPerCup = parseFloat($id('ai_gpc').value) || 1;
                item.pricePerCup = parseFloat($id('ai_ppc').value) || 0;
                item.openingStock = parseFloat($id('ai_os_g2').value) || 0;
                item.restockAlert = parseInt($id('ai_ra_g').value) || 0;
            } else {
                item.gramsPerPack = parseFloat($id('ai_gpk').value) || 250;
                item.costPerPack = parseFloat($id('ai_cpp').value) || 0;
                item.packsPerCup = parseFloat($id('ai_ppcup').value) || 1;
                item.pricePerCup = parseFloat($id('ai_ppc2').value) || 0;
                item.openingStock = parseFloat($id('ai_os_p2').value) || 0;
                item.restockAlert = parseInt($id('ai_ra_p').value) || 0;
            }
            upd(function(db) {
                if (!db[cfg.key]) db[cfg.key] = [];
                db[cfg.key].push(item);
            });
            toast('已添加');
        }
    } else {
        if (itemId) {
            upd(function(db) {
                var it = db[cfg.key].find(function(i) { return i.id === itemId; });
                if (!it) return;
                it.name = name;
                it.costPerUnit = parseFloat($id('ai_costPerUnit').value) || 0;
                it.pricePerUnit = parseFloat($id('ai_pricePerUnit').value) || 0;
                it.openingStock = parseFloat($id('ai_os').value) || 0;
                it.restockAlert = parseInt($id('ai_ra').value) || 0;
                var pu = $id('ai_pu'); if (pu) it.purchaseUnit = pu.value;
                var cr = $id('ai_cr'); if (cr) it.purchaseConvRatio = parseInt(cr.value) || 10;
                var mk = $id('ai_matchKeyword'); if (mk) it.matchKeyword = mk.value.trim();
            });
            toast('已更新');
        } else {
            var item = {
                id: type + '_' + Date.now(), name: name,
                costPerUnit: parseFloat($id('ai_costPerUnit').value) || 0,
                pricePerUnit: parseFloat($id('ai_pricePerUnit').value) || 0,
                openingStock: parseFloat($id('ai_os').value) || 0,
                restockAlert: parseInt($id('ai_ra').value) || 0,
                sales: [], purchases: []
            };
            var pu = $id('ai_pu');
            item.purchaseUnit = pu ? pu.value : (type === 'cig' ? '条' : '箱');
            var cr = $id('ai_cr');
            item.purchaseConvRatio = cr ? parseInt(cr.value) || 10 : (type === 'cig' ? 10 : 12);
            var mk = $id('ai_matchKeyword');
            item.matchKeyword = mk ? mk.value.trim() : '';
            upd(function(db) {
                if (!db[cfg.key]) db[cfg.key] = [];
                db[cfg.key].push(item);
            });
            toast('已添加');
        }
    }
    closeModal();
    rInv(type);
}

// ------ 表格行操作事件委托 ------

// 通过事件委托处理库存表格中的编辑/删除按钮（避免内联 onclick）
// 支持移动端触摸事件
function handleInvAction(e) {
    // 如果点击的是保存按钮，直接返回，不阻止保存操作
    if (e.target.closest('.btn.p') && e.target.textContent.includes('保存')) return;

    var card = e.target.closest('[data-inv]');
    if (!card) return;
    var parts = card.dataset.inv.split('_');
    var type = parts[0];
    var id = parts.slice(1).join('_');

    if (e.target.closest('[data-act="del"]')) {
        if (!confirm('确认删除？')) return;
        DB[INV[type].key] = DB[INV[type].key].filter(function(i) { return i.id !== id; });
        DB._ts = Date.now();
        saveDB(DB);
        sbScheduleSave();
        toast('已删除');
        rInv(type);
    } else if (e.target.closest('[data-act="edit"]')) {
        showAddInv(type, id);
    }
}
document.addEventListener('click', handleInvAction);
document.addEventListener('touchend', function(e) {
    // 延迟执行，避免与click事件重复
    setTimeout(function() { handleInvAction(e); }, 100);
});

// 获取指定月份的期初库存
function getOpeningStock(item, ym) {
    // 当月：用当前 openingStock
    if (ym === curYM()) return item.openingStock || 0;
    // 历史月份：从月度快照读取
    if (item.monthStock && item.monthStock[ym] !== undefined) return item.monthStock[ym];
    // 没有快照则用当前 openingStock（不精确，但兜底）
    return item.openingStock || 0;
}

// 单个商品进销存计算（指定月份）
function invCalc(item, type, ym) {
    ym = ym || curYM();
    var os = getOpeningStock(item, ym);
    // 当月入库数量（采购为正，退货为负）
    var tp = (item.purchases || []).filter(function(p) { return p.date && p.date.startsWith(ym); }).reduce(function(s, p) { return s + (p.qty || 0); }, 0);

    // ===== 茗茶/贵重物品（有消耗换算）=====
    if (type === 'tea' || (type === 'other' && item.calcMode)) {
        var salesCur = (item.sales || []).filter(function(s) { return s.date && s.date.startsWith(ym); });
        var tc = salesCur.reduce(function(s, r) { return s + (r.cups || 0); }, 0);
        var tp2 = salesCur.reduce(function(s, r) { return s + (r.pots || 0); }, 0);
        var rev = salesCur.reduce(function(s, r) { return s + r.amount; }, 0);

        var cost, stock;
        if (item.calcMode === 'pack') {
            var soldPacks = tc * (item.packsPerCup || 0) + tp2 * (item.packsPerPot || 0);
            cost = soldPacks * (item.costPerPack || 0);
            stock = Math.round((os + tp - soldPacks) * 100) / 100;
        } else {
            var soldGrams = tc * (item.gramsPerCup || 0) + tp2 * (item.gramsPerPot || 0);
            cost = soldGrams * (item.costPerGram || 0);
            stock = Math.round((os + tp - soldGrams) * 100) / 100;
        }

        return {
            stock: stock,
            revenue: rev,
            cost: cost,
            profit: rev - cost,
            margin: rev > 0 ? (rev - cost) / rev * 100 : 0
        };
    }

    // ===== 香烟/酒类/简单模式贵重物品 =====
    var salesCur = (item.sales || []).filter(function(s) { return s.date && s.date.startsWith(ym); });
    var ts = salesCur.reduce(function(s, r) { return s + (r.qty || 0); }, 0);
    var rev = salesCur.reduce(function(s, r) { return s + r.amount; }, 0);
    var cost = ts * (item.costPerUnit || 0);

    return {
        stock: Math.round((os + tp - ts) * 100) / 100,
        revenue: rev,
        cost: cost,
        profit: rev - cost,
        margin: rev > 0 ? (rev - cost) / rev * 100 : 0
    };
}

// 月度进销存计算
function invCalcMon(item, type, ym) {
    // 筛选出该月份的销售记录
    var sales = item.sales.filter(function(s) { return s.date && s.date.startsWith(ym); });
    var revenue = 0, cost = 0;

    if (type === 'tea') {
        // 茗茶：按杯/壶计算成本
        sales.forEach(function(s) {
            revenue += (s.amount || 0);
            cost += ((s.cups || 0) * (item.gramsPerCup || 5)
                   + (s.pots || 0) * (item.gramsPerPot || 15))
                   * (item.costPerGram || 0);
        });
    } else {
        // 香烟/酒类：按数量计算成本
        sales.forEach(function(s) {
            revenue += (s.amount || 0);
            cost += (s.qty || 0) * (item.costPerUnit || 0);
        });
    }

    return {
        revenue: revenue,  // 本月营收
        cost: cost,        // 本月成本
        actual: revenue    // 实收（目前等于营收）
    };
}

// ==================== 月度期初结转 ====================
function rolloverInventory() {
    var nowYM = curYM();
    if (!DB.settings) DB.settings = {};
    var lastROL = DB.settings._lastRollover || '';

    console.log('rolloverInventory: 当月=' + nowYM + ', 上次结转=' + lastROL);

    // 已经结转过当月，跳过
    if (lastROL === nowYM) {
        console.log('rolloverInventory: 已结转当月，跳过');
        return;
    }

    var types = ['tea', 'cig', 'alc', 'other'];
    var rolloverItems = [];

    types.forEach(function(type) {
        var key = INV[type].key;
        (DB[key] || []).forEach(function(item) {
            // 计算上月结存：使用上月的实际期初（快照），而不是当前openingStock
            var lastYM = (function() {
                var d = new Date();
                d.setMonth(d.getMonth() - 1);
                return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
            })();
            var lastOpeningStock = getOpeningStock(item, lastYM);
            var totalPurchases = (item.purchases || []).filter(function(p) { return p.date && p.date.startsWith(lastYM); }).reduce(function(s, p) { return s + (p.qty || 0); }, 0);
            var totalSalesQty = 0;
            var unit = type === 'tea' ? (item.calcMode === 'pack' ? '包' : '克') :
                       type === 'other' ? (item.unit || (item.calcMode === 'pack' ? '包' : item.calcMode === 'gram' ? '克' : '个')) :
                       (type === 'cig' ? '包' : '瓶');
            (item.sales || []).forEach(function(s) {
                if (s.date && s.date.startsWith(lastYM)) {
                    if (type === 'tea' || (type === 'other' && item.calcMode)) {
                        if ((item.calcMode || 'gram') === 'pack') {
                            totalSalesQty += ((s.cups || 0) * (item.packsPerCup || 0) + (s.pots || 0) * (item.packsPerPot || 0));
                        } else {
                            totalSalesQty += ((s.cups || 0) * (item.gramsPerCup || 5) + (s.pots || 0) * (item.gramsPerPot || 15));
                        }
                    } else {
                        totalSalesQty += (s.qty || 0);
                    }
                }
            });
            var closingStock = lastOpeningStock + totalPurchases - totalSalesQty;
            if (closingStock < 0) closingStock = 0;

            rolloverItems.push({ item: item, type: type, closing: closingStock, label: INV[type].label, unit: unit });
        });
    });

    if (rolloverItems.length === 0) return;

    // 按类别分组
    var groups = {};
    var groupOrder = ['tea', 'cig', 'alc', 'other'];
    rolloverItems.forEach(function(r) {
        if (!groups[r.type]) groups[r.type] = [];
        groups[r.type].push(r);
    });

    window._rolloverGroups = [];
    groupOrder.forEach(function(type) {
        if (groups[type] && groups[type].length > 0) {
            window._rolloverGroups.push({ type: type, label: INV[type].label, items: groups[type] });
        }
    });
    window._rolloverGroupIdx = 0;
    window._lastRolloverYM = nowYM;
    showNextRolloverGroup();
}

// 按类别分组弹窗
function showNextRolloverGroup() {
    var groups = window._rolloverGroups || [];
    var idx = window._rolloverGroupIdx || 0;

    // 全部处理完
    if (idx >= groups.length) {
        DB.settings._lastRollover = window._lastRolloverYM;
        saveDB(DB);
        sbScheduleSave(); // 触发云同步
        window._rolloverGroups = null;
        window._rolloverGroupIdx = null;
        toast('期初结转完成');
        return;
    }

    var group = groups[idx];
    var h = '<div style="max-width:420px;margin:0 auto">';
    h += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">';
    h += '<h3 style="margin:0;color:var(--ac)">' + group.label + ' 期初结转</h3>';
    h += '<span style="font-size:.72rem;color:var(--tx-m)">' + (idx + 1) + '/' + groups.length + '</span></div>';

    group.items.forEach(function(r, i) {
        h += '<div style="display:flex;align-items:center;gap:8px;padding:10px 0;border-bottom:1px solid var(--bd-l)">';
        h += '<span style="flex:1;font-size:.82rem">' + r.item.name + '</span>';
        h += '<input class="inp" id="rol_' + i + '" type="number" step="0.1" value="' + r.closing + '" style="width:80px;text-align:right;font-family:var(--fm)">';
        h += '<span style="font-size:.72rem;color:var(--tx-m)">' + r.unit + '</span>';
        h += '</div>';
    });

    h += '<div class="brow" style="margin-top:16px;justify-content:flex-end;gap:6px">';
    h += '<button class="btn" onclick="skipRolloverGroup()">跳过本类</button>';
    h += '<button class="btn p" onclick="confirmRolloverGroup()">确认结转</button>';
    h += '</div></div>';
    showModal(h, 440);
}

function confirmRolloverGroup() {
    var groups = window._rolloverGroups || [];
    var idx = window._rolloverGroupIdx || 0;
    var group = groups[idx];
    // 计算上月（结转前的月份）
    var prevYM = (function() {
        var d = new Date();
        d.setMonth(d.getMonth() - 1);
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0');
    })();
    console.log('confirmRolloverGroup: 处理' + group.label + ', 上月=' + prevYM + ', 商品数=' + group.items.length);
    group.items.forEach(function(r, i) {
        var input = document.getElementById('rol_' + i);
        var newVal = input ? (parseFloat(input.value) || 0) : r.closing;
        console.log('  ' + r.item.name + ': 旧期初=' + r.item.openingStock + ', 新期初=' + newVal);

        // 验证r.item是否是DB中item的引用
        var dbItem = DB[INV[group.type].key].find(function(it) { return it.id === r.item.id; });
        console.log('    DB中item的openingStock: ' + (dbItem ? dbItem.openingStock : '未找到'));

        // 保存上月快照（结转前的结存）
        if (!r.item.monthStock) r.item.monthStock = {};
        r.item.monthStock[prevYM] = r.closing;
        r.item.openingStock = newVal;

        // 同时更新DB中的item
        if (dbItem) {
            dbItem.openingStock = newVal;
            console.log('    已更新DB中item的openingStock为: ' + newVal);
        }
    });
    saveDB(DB);
    sbScheduleSave(); // 触发云同步
    console.log('confirmRolloverGroup: 已保存到数据库');

    // 验证保存是否成功
    var testItem = DB[INV[group.type].key].find(function(it) { return it.id === group.items[0].item.id; });
    if (testItem) {
        console.log('保存后验证: ' + testItem.name + ' 的openingStock = ' + testItem.openingStock);
    }

    window._rolloverGroupIdx = idx + 1;
    closeModal();
    showNextRolloverGroup();
}

function skipRolloverGroup() {
    window._rolloverGroupIdx = (window._rolloverGroupIdx || 0) + 1;
    closeModal();
    showNextRolloverGroup();
}


// 库存月份切换
function invCalNav(type, dir) {
    var picker = document.getElementById('invMonth');
    var currentYM = picker ? picker.value : curYM();
    calendarNav(dir, currentYM, 'invMonth', function(ym) {
        rInv(type);
    });
}

// 库存月份选择
function invCalPickYM(type, val) {
    calendarPickYM(val, function(ym) {
        rInv(type);
    });
}
