// inventory.js - 贵重物品库存管理

// ==================== 10. 贵重物品库存管理 ====================

function rInv(type) {
    var items = DB[INV[type].key] || [];
    var ym = curYM();
    var unit = type === 'cig' ? '包' : type === 'alc' ? '瓶' : '';

    var stats = [];
    items.forEach(function(item) {
        var sales = item.sales.filter(function(s) { return s.date.startsWith(ym); });
        var c = invCalc(item, type);
        var mc = invCalcMon(item, type, ym);
        var cups = 0, pots = 0, qty = 0, expected = 0;
        sales.forEach(function(s) {
            cups += (s.cups || 0); pots += (s.pots || 0); qty += (s.qty || 0);
            if (type === 'tea') expected += (s.cups || 0) * (item.pricePerCup || 0) + (s.pots || 0) * (item.pricePerPot || 0);
            else expected += (s.qty || 0) * (item.pricePerUnit || 0);
        });
        var fifo = calcFIFOMonthlyCost(item, type, ym);
        stats.push({
            item: item,
            stock: fifo.remainQty,
            cups: cups,
            pots: pots,
            qty: qty,
            expected: expected,
            actual: mc.actual,
            cost: fifo.cost,
            profit: mc.actual - fifo.cost,
            fifo: fifo
        });
    });

    var tE = stats.reduce(function(s, st) { return s + st.expected; }, 0);
    var tA = stats.reduce(function(s, st) { return s + st.actual; }, 0);
    var tC = stats.reduce(function(s, st) { return s + st.cost; }, 0);
    var tP = tA - tC;
    var tFifoValue = stats.reduce(function(s, st) { return s + st.fifo.remainValue; }, 0);

    var h = '';

    h += '<div class="cards">';
    h += '<div class="card"><div class="card-l">品类</div><div class="card-v ac">' + items.length + '</div></div>';
    h += '<div class="card"><div class="card-l">应收</div><div class="card-v">' + fmtC(tE) + '</div></div>';
    h += '<div class="card"><div class="card-l">实收</div><div class="card-v gn">' + fmtC(tA) + '</div></div>';
    h += '<div class="card"><div class="card-l">成本</div><div class="card-v rd">' + fmtC(tC) + '</div></div>';
    h += '<div class="card"><div class="card-l">毛利</div><div class="card-v ac">' + fmtC(tP) + '</div></div>';
    h += '<div class="card"><div class="card-l">毛利率</div><div class="card-v">' + (tA > 0 ? fmtP(tP / tA * 100) : '0%') + '</div></div>';
    h += '</div>';

    h += '<div class="tab-bar" id="invT">';
    h += '<button class="tab-btn active" data-tab="hist" onclick="switchInvT(\'hist\',\'' + type + '\')">明细</button>';
    h += '<button class="tab-btn" data-tab="stock" onclick="switchInvT(\'stock\',\'' + type + '\')">库存</button>';
    h += '</div>';

    h += '<div id="invStock" style="display:none">';
    h += '<div class="brow" style="margin-bottom:14px">';
    h += '<button class="btn" onclick="showAddInv(\'' + type + '\')">+添加</button> ';
    h += '<button class="btn" onclick="invMoveAll(\'' + type + '\',1)">入库</button> ';
    h += '<button class="btn" onclick="invMoveAll(\'' + type + '\',-1)">销售</button>';
    h += '</div>';

    if (items.length) {
        h += '<div class="tw"><table>';

        if (type === 'tea') {
            h += '<tr><th>品名</th><th>结存</th><th>本月实收</th><th>销售成本</th><th>毛利</th><th>操作</th></tr>';
            stats.forEach(function(st) {
                h += '<tr data-inv="' + type + '_' + st.item.id + '">';
                h += '<td style="font-weight:600">' + st.item.name + '</td>';
                h += '<td class="nr">' + st.stock + '克</td>';
                h += '<td class="nr" style="color:var(--gn);font-weight:600">' + fmtC(st.actual) + '</td>';
                h += '<td class="nr" style="color:var(--rd);font-weight:600">' + fmtC(st.cost) + '</td>';
                h += '<td class="nr" style="color:' + (st.profit >= 0 ? 'var(--gn)' : 'var(--rd)') + ';font-weight:600">' + fmtC(st.profit) + '</td>';
                h += '<td><button class="btn s" data-act="edit">编</button> ';
                h += '<button class="btn s" onclick="invDetail(\'' + type + '\',\'' + st.item.id + '\')">详</button> ';
                h += '<button class="btn s d" data-act="del">×</button></td></tr>';
                h += '<tr>';
                h += '<td colspan="6" style="padding:4px 10px 8px;border-bottom:1px solid var(--bd-l)">';
                h += '<span style="font-size:.68rem;color:var(--tx-m)">';
                h += '单杯 ¥' + fmt(st.item.pricePerCup || 0) + ' · 单壶 ¥' + fmt(st.item.pricePerPot || 0);
                h += ' · 售 ' + st.cups + '杯+' + st.pots + '壶';
                h += ' · 库存价值 ¥' + fmtC(st.fifo.remainValue);
                h += '</span></td></tr>';
            });
            h += '<tr style="background:var(--card-h)">';
            h += '<td style="font-weight:600">合计</td><td></td>';
            h += '<td class="nr" style="font-weight:600;color:var(--rd)">' + fmtC(tC) + '</td>';
            h += '<td class="nr" style="font-weight:600;color:var(--gn)">' + fmtC(tA) + '</td>';
            h += '<td class="nr" style="font-weight:600;color:' + (tP >= 0 ? 'var(--gn)' : 'var(--rd)') + '">' + fmtC(tP) + '</td>';
            h += '<td></td></tr>';
        } else if (type === 'cig') {
            h += '<tr><th>品名</th><th>结存</th><th>销售总额</th><th>销售成本</th><th>毛利</th><th>操作</th></tr>';
            stats.forEach(function(st) {
                var margin = st.actual > 0 ? fmtP(st.profit / st.actual * 100) : '0%';
                h += '<tr data-inv="' + type + '_' + st.item.id + '">';
                h += '<td style="font-weight:600">' + st.item.name + '</td>';
                h += '<td class="nr">' + st.stock + '包</td>';
                h += '<td class="nr" style="color:var(--gn);font-weight:600">' + fmtC(st.actual) + '</td>';
                h += '<td class="nr" style="color:var(--rd);font-weight:600">' + fmtC(st.cost) + '</td>';
                h += '<td class="nr" style="color:' + (st.profit >= 0 ? 'var(--gn)' : 'var(--rd)') + ';font-weight:600">' + fmtC(st.profit) + '</td>';
                h += '<td><button class="btn s" data-act="edit">编</button> ';
                h += '<button class="btn s" onclick="invDetail(\'' + type + '\',\'' + st.item.id + '\')">详</button> ';
                h += '<button class="btn s d" data-act="del">×</button></td></tr>';
                h += '<tr>';
                h += '<td colspan="6" style="padding:4px 10px 8px;border-bottom:1px solid var(--bd-l)">';
                h += '<span style="font-size:.68rem;color:var(--tx-m)">';
                h += '单价 ¥' + fmt(st.item.pricePerUnit || 0) + '/包';
                h += ' · 售 ' + st.qty + '包';
                h += ' · 毛利率 ' + margin;
                h += '</span></td></tr>';
            });
            h += '<tr style="background:var(--card-h)">';
            h += '<td style="font-weight:600">合计</td><td></td>';
            h += '<td class="nr" style="font-weight:600;color:var(--gn)">' + fmtC(tA) + '</td>';
            h += '<td class="nr" style="font-weight:600;color:var(--rd)">' + fmtC(tC) + '</td>';
            h += '<td class="nr" style="font-weight:600;color:' + (tP >= 0 ? 'var(--gn)' : 'var(--rd)') + '">' + fmtC(tP) + '</td>';
            h += '<td></td></tr>';
        } else {
            h += '<tr><th>品名</th><th>结存</th><th>销售总额</th><th>销售成本</th><th>毛利</th><th>操作</th></tr>';
            stats.forEach(function(st) {
                var margin = st.actual > 0 ? fmtP(st.profit / st.actual * 100) : '0%';
                h += '<tr data-inv="' + type + '_' + st.item.id + '">';
                h += '<td style="font-weight:600">' + st.item.name + '</td>';
                h += '<td class="nr">' + st.stock + '瓶</td>';
                h += '<td class="nr" style="color:var(--gn);font-weight:600">' + fmtC(st.actual) + '</td>';
                h += '<td class="nr" style="color:var(--rd);font-weight:600">' + fmtC(st.cost) + '</td>';
                h += '<td class="nr" style="color:' + (st.profit >= 0 ? 'var(--gn)' : 'var(--rd)') + ';font-weight:600">' + fmtC(st.profit) + '</td>';
                h += '<td><button class="btn s" data-act="edit">编</button> ';
                h += '<button class="btn s" onclick="invDetail(\'' + type + '\',\'' + st.item.id + '\')">详</button> ';
                h += '<button class="btn s d" data-act="del">×</button></td></tr>';
                h += '<tr>';
                h += '<td colspan="6" style="padding:4px 10px 8px;border-bottom:1px solid var(--bd-l)">';
                h += '<span style="font-size:.68rem;color:var(--tx-m)">';
                h += '单价 ¥' + fmt(st.item.pricePerUnit || 0) + '/瓶';
                h += ' · 售 ' + st.qty + '瓶';
                h += ' · 毛利率 ' + margin;
                h += '</span></td></tr>';
            });
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

    h += '<div id="invHist"></div>';

    setMain(INV[type].label + '管理', h);
    setTimeout(function() { switchInvT('hist', type); }, 100);
}

function switchInvT(tab, type) {
    document.querySelectorAll('#invT .tab-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.tab === tab);
    });
    $id('invStock').style.display = tab === 'stock' ? '' : 'none';
    $id('invHist').style.display = tab === 'hist' ? '' : 'none';
    if (tab === 'hist') renderInvHist(type);
}

function renderInvHist(type) {
    var el = $id('invHist');
    if (!el) return;
    var ym = curYM();
    var items = DB[INV[type].key] || [];
    var unit = type === 'cig' ? '包' : type === 'alc' ? '瓶' : '';
    var mEl = $id('invHistM');
    if (mEl) ym = mEl.value || ym;

    var year = parseInt(ym.split('-')[0]);
    var month = parseInt(ym.split('-')[1]);
    var daysInMonth = new Date(year, month, 0).getDate();
    var firstDay = new Date(year, month - 1, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;
    var todayStr = td();
    var todayDay = parseInt(todayStr.split('-')[2]);
    var isThisMonth = todayStr.startsWith(ym);

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
    h += '<div class="hrow"><label>月份</label><input class="inp" id="invHistM" type="text" readonly placeholder="选择月份" value="' + ym + '" onclick="_mpOpen(\'invHistM\')" onchange="renderInvHist(\'' + type + '\')" style="max-width:180px;cursor:pointer"></div>';

    h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-top:14px">';
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

        h += '<div style="background:' + bg + ';border:' + border + ';border-radius:6px;padding:5px 4px;min-height:52px;cursor:' + (has ? 'pointer' : 'default') + '"';
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

function showInvDayModal(type, date) {
    var items = DB[INV[type].key] || [];
    var unit = type === 'cig' ? '包' : type === 'alc' ? '瓶' : '克';
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
        h += '<div style="flex:1;min-width:0">';
        h += '<div style="font-size:.84rem;font-weight:600">' + r.item.name + '</div>';
        if (type === 'tea') {
            h += '<div style="font-size:.72rem;color:var(--tx-m);margin-top:2px">' + (r.sale.cups || 0) + '杯 · ' + (r.sale.pots || 0) + '壶</div>';
        } else {
            h += '<div style="font-size:.72rem;color:var(--tx-m);margin-top:2px">' + (r.sale.qty || 0) + unit + '</div>';
        }
        h += '</div>';
        h += '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0">';
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

function delInvSaleConfirm(type, itemId, si, date) {
    var item = DB[INV[type].key].find(function(i) { return i.id === itemId; });
    if (!item || !item.sales[si]) return;
    var s = item.sales[si];
    var desc = type === 'tea'
        ? (s.cups || 0) + '杯+' + (s.pots || 0) + '壶 ¥' + fmtC(s.amount || 0)
        : (s.qty || 0) + (type === 'cig' ? '包' : '瓶') + ' ¥' + fmtC(s.amount || 0);

    if (!confirm('删除 ' + item.name + ' 的销售记录？\n' + desc)) return;

    item.sales.splice(si, 1);
    saveDB();
    syncInvToDaily(type, date);

    toast('已删除');
    closeModal();
    rInv(type);
    setTimeout(function() { showInvDayModal(type, date); }, 150);
}

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

    h += '<div class="hrow"><label>金额</label><input class="inp" id="esi_amount" type="number" step="0.01" value="' + (s.amount || 0) + '" style="max-width:120px"></div>';

    h += '<div class="brow" style="margin-top:14px;justify-content:flex-end">';
    h += '<button class="btn p" onclick="saveEditInvSale(\'' + type + '\',\'' + itemId + '\',' + si + ')">保存</button>';
    h += '<button class="btn" onclick="closeModal()">取消</button>';
    h += '</div>';

    showModal(h, 450);
}

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

    item.sales[si].amount = parseFloat($id('esi_amount').value) || 0;
    saveDB();
    syncInvToDaily(type, oldDate);
    if (oldDate !== newDate) syncInvToDaily(type, newDate);

    toast('已保存');
    closeModal();
    rInv(type);
    setTimeout(function() { showInvDayModal(type, newDate); }, 150);
}

function invDetail(type, itemId) {
    var item = DB[INV[type].key].find(function(i) { return i.id === itemId; });
    if (!item) return;
    var unit = type === 'cig' ? '包' : type === 'alc' ? '瓶' : '';
    var ym = curYM();

    var h = '<h3 style="margin:0 0 10px">' + item.name + ' · 进销存</h3>';

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

function buildRecords(item, type, ym) {
    var allRecords = [];

    var manualNotes = {};
    (item.purchases || []).forEach(function(p) {
        if (p.qty < 0 && p.source !== '日报' && p.date.startsWith(ym)) {
            manualNotes[p.date] = p.reason || p.source || '手动';
        }
    });

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

    h += '<tr style="background:var(--card-h)"><td style="font-weight:600">合计</td>';
    if (type === 'tea') h += '<td colspan="2" class="nr" style="font-weight:600">' + totalQty + '</td>';
    else h += '<td class="nr" style="font-weight:600">' + totalQty + unit + '</td>';
    h += '<td class="nr" style="font-weight:600">' + fmtC(totalExp) + '</td>';
    h += '<td class="nr" style="font-weight:600;color:var(--gn)">' + fmtC(totalAmt) + '</td></tr>';
    h += '</table></div>';
    return h;
}

function renderBuyDetail(item, type, ym, unit) {
    var h = '<div class="hrow"><label>月份</label><input class="inp" id="detBuyM" type="text" readonly placeholder="选择月份" value="' + ym + '" onclick="_mpOpen(\'detBuyM\')" onchange="detBuyRefresh(\'' + type + '\',\'' + item.id + '\')" style="max-width:180px;cursor:pointer"></div>';

    var moves = [];
    try { moves = (item.purchases || []).filter(function(p) { return p.date && p.date.startsWith(ym); }); } catch (e) {}
    var sales = [];
    try { sales = (item.sales || []).filter(function(s) { return s.date && s.date.startsWith(ym); }); } catch (e) {}

    var u = unit;
    if (type === 'tea' && item.calcMode === 'pack') u = '包';
    else if (type === 'tea') u = '克';

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

function editInvRow(type, itemId, rowType, idx, unit) {
    var item = DB[INV[type].key].find(function(i) { return i.id === itemId; });
    if (!item) return;

    if (rowType === 'move') {
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

function calcEditTeaExp(itemId) {
    var item = DB.teaItems.find(function(i) { return i.id === itemId; });
    if (!item) return;
    var cups = parseInt($id('eir_cups').value) || 0;
    var pots = parseInt($id('eir_pots').value) || 0;
    $id('eir_exp').value = (cups * (item.pricePerCup || 0) + pots * (item.pricePerPot || 0)).toFixed(2);
}

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
    refreshDetBuy(type, itemId);
}

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

function syncDailyTeaSales(db, date, itemId, cups, pots, amt) {
    db.dailyReports.forEach(function(dr) {
        if (dr.date !== date) return;
        if (dr.teaSales && dr.teaSales[itemId]) {
            dr.teaSales[itemId] = { cups: cups, pots: pots, amount: amt };
        }
    });
}

function refreshDetBuy(type, itemId) {
    var item = DB[INV[type].key].find(function(i) { return i.id === itemId; });
    if (!item) return;
    var unit = type === 'tea' ? '克' : type === 'cig' ? '包' : '瓶';
    var ym = curYM();
    if ($id('detBuyM')) ym = $id('detBuyM').value || ym;
    $id('detBuyArea').innerHTML = renderBuyDetail(item, type, ym, unit);
}

function detRefresh(type, itemId) {
    var item = DB[INV[type].key].find(function(i) { return i.id === itemId; });
    if (!item) return;
    var unit = type === 'cig' ? '包' : type === 'alc' ? '瓶' : '';
    var ym = $id('detM').value || curYM();
    $id('detSaleArea').innerHTML = renderSaleDetail(item, type, ym, unit);
}

function detBuyRefresh(type, itemId) {
    var item = DB[INV[type].key].find(function(i) { return i.id === itemId; });
    if (!item) return;
    var unit = type === 'cig' ? '包' : type === 'alc' ? '瓶' : '';
    var ym = $id('detBuyM').value || curYM();
    $id('detBuyArea').innerHTML = renderBuyDetail(item, type, ym, unit);
}

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

function updateMvF(type, dir) {
    var itemId = $id('mvItem').value;
    var item = DB[INV[type].key].find(function(i) { return i.id === itemId; });
    if (!item) return;
    var h = '';

    if (type === 'tea') {
        var mode = item.calcMode || 'gram';
        if (dir > 0) {
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
            h += '<div class="hrow"><label>数量</label><input class="inp" id="mvQty" type="number" value="0" style="max-width:60px" oninput="calcMvCigAmt()"> 包 ';
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

function calcMvTeaAmt() {
    var itemId = $id('mvItem').value;
    var item = DB.teaItems.find(function(i) { return i.id === itemId; });
    if (!item) return;
    var cups = parseInt($id('mvCups').value) || 0;
    var pots = parseInt($id('mvPots').value) || 0;
    $id('mvExpected').value = (cups * (item.pricePerCup || 0) + pots * (item.pricePerPot || 0)).toFixed(2);
}

function calcMvCigAmt() {
    var itemId = $id('mvItem').value;
    var item = DB.cigItems.find(function(i) { return i.id === itemId; });
    if (!item) return;
    var qty = parseInt($id('mvQty').value) || 0;
    $id('mvAmount').value = (qty * (item.pricePerUnit || 0)).toFixed(2);
}

function calcMvAlcAmt() {
    var itemId = $id('mvItem').value;
    var item = DB.alcItems.find(function(i) { return i.id === itemId; });
    if (!item) return;
    var qty = parseInt($id('mvQty').value) || 0;
    $id('mvAmount').value = (qty * (item.pricePerUnit || 0)).toFixed(2);
}

function doInvMoveAll(type, dir) {
    var itemId = $id('mvItem').value;
    if (!itemId) { toast('选物品'); return; }
    doInvMove(type, itemId, dir);
}

function doInvMove(type, id, dir) {
    var date = $id('mvDate').value || td();
    var cfg = INV[type];

    if (dir > 0) {
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

            syncInvToDaily(type, date);

            closeModal();
            toast('销售 ' + cups + '杯' + pots + '壶 应收:' + expected.toFixed(2) + ' 实收:' + amount.toFixed(2));
        } else if (type === 'cig') {
            var qty = parseInt($id('mvQty').value) || 0;
            var amount = parseFloat($id('mvAmount').value) || 0;
            if (qty <= 0) { toast('填数量'); return; }
            upd(function(db) {
                var it = db[cfg.key].find(function(i) { return i.id === id; });
                if (!it) return;
                it.sales.push({ date: date, qty: qty, amount: amount });
            });

            syncInvToDaily(type, date);

            closeModal();
            toast('销售 ' + qty + '包 ' + amount.toFixed(2) + '元');
        } else {
            var qty = parseInt($id('mvQty').value) || 0;
            var amount = parseFloat($id('mvAmount').value) || 0;
            if (qty <= 0) { toast('填数量'); return; }
            upd(function(db) {
                var it = db[cfg.key].find(function(i) { return i.id === id; });
                if (!it) return;
                it.sales.push({ date: date, qty: qty, amount: amount });
            });

            syncInvToDaily(type, date);

            closeModal();
            toast('销售 ' + qty + '瓶 ' + amount.toFixed(2) + '元');
        }
    }
    rInv(type);
}

function toggleTeaMode() {
    var m = $id('ai_mode').value;
    var g = $id('teaGram'), p = $id('teaPack');
    if (g) g.style.display = m === 'gram' ? '' : 'none';
    if (p) p.style.display = m === 'pack' ? '' : 'none';
}

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

function calcFIFOMonthlyCost(item, type, ym) {
    var queue = [];
    var unit = type === 'tea' ? '克' : type === 'cig' ? '包' : '瓶';

    var openingQty = item.openingStock || 0;
    var openingUnitCost = 0;
    if (type === 'tea') {
        openingUnitCost = item.costPerGram || 0;
    } else {
        openingUnitCost = item.costPerUnit || (openingQty > 0 ? (item.openingCost || 0) / openingQty : 0);
    }
    if (openingQty > 0) {
        queue.push({ qty: openingQty, unitCost: openingUnitCost });
    }

    var allEvents = [];

    (item.purchases || []).forEach(function(p) {
        if (p.qty > 0) {
            var uc = p.cost ? p.cost / p.qty : openingUnitCost;
            allEvents.push({ date: p.date, type: 'in', qty: p.qty, unitCost: uc });
        }
    });

    (item.sales || []).forEach(function(s) {
        var consumeQty = 0;
        if (type === 'tea') {
            consumeQty = (s.cups || 0) * (item.gramsPerCup || 0) + (s.pots || 0) * (item.gramsPerPot || 0);
        } else {
            consumeQty = s.qty || 0;
        }
        if (consumeQty > 0) {
            allEvents.push({ date: s.date, type: 'out', qty: consumeQty, saleAmount: s.amount || 0 });
        }
    });

    allEvents.sort(function(a, b) {
        if (a.date !== b.date) return a.date.localeCompare(b.date);
        return a.type === 'in' ? -1 : 1;
    });

    var monthCost = 0, monthRevenue = 0, monthConsume = 0;

    allEvents.forEach(function(ev) {
        if (ev.type === 'in') {
            queue.push({ qty: ev.qty, unitCost: ev.unitCost });
        } else {
            var remaining = ev.qty;
            var saleCost = 0;
            while (remaining > 0 && queue.length > 0) {
                if (queue[0].qty <= remaining) {
                    saleCost += queue[0].qty * queue[0].unitCost;
                    remaining -= queue[0].qty;
                    queue.shift();
                } else {
                    saleCost += remaining * queue[0].unitCost;
                    queue[0].qty -= remaining;
                    remaining = 0;
                }
            }
            if (ev.date.startsWith(ym)) {
                monthCost += saleCost;
                monthRevenue += ev.saleAmount;
                monthConsume += ev.qty;
            }
        }
    });

    var remainQty = 0, remainValue = 0;
    queue.forEach(function(e) {
        remainQty += e.qty;
        remainValue += e.qty * e.unitCost;
    });

    return {
        cost: Math.round(monthCost * 100) / 100,
        revenue: monthRevenue,
        profit: Math.round((monthRevenue - monthCost) * 100) / 100,
        consume: Math.round(monthConsume * 100) / 100,
        remainQty: Math.round(remainQty * 100) / 100,
        remainValue: Math.round(remainValue * 100) / 100
    };
}

function showAddInv(type, itemId) {
    var item = null;
    if (itemId) item = DB[INV[type].key].find(function(i) { return i.id === itemId; });
    var isEdit = !!item;

    var h = '<h3>' + (isEdit ? '编辑' : '添加') + ' ' + INV[type].label + '</h3>';
    if (type === 'tea') {
        var mode = (isEdit ? item.calcMode : '') || 'gram';
        h += '<div class="section-label">基本信息</div>';
        h += '<div class="hrow"><label>茶品名称</label><input class="inp" id="ai_name" style="flex:2" value="' + (isEdit ? item.name.replace(/"/g, '&quot;') : '') + '">';
        h += '<label>计算方式</label><select class="inp" id="ai_mode" style="max-width:80px" onchange="toggleTeaMode()">';
        h += '<option value="gram"' + (mode === 'gram' ? ' selected' : '') + '>克</option>';
        h += '<option value="pack"' + (mode === 'pack' ? ' selected' : '') + '>包</option></select></div>';

        h += '<div id="teaGram"' + (mode !== 'gram' ? ' style="display:none"' : '') + '>';
        h += '<div class="section-label">成本(按克)</div>';
        h += '<div class="hrow"><label>成本/克</label><input class="inp" id="ai_costPerGram" type="number" step="0.001" style="max-width:100px" value="' + (isEdit ? (item.costPerGram || 0) : '') + '">元';
        h += ' <span style="font-size:.72rem;color:var(--tx-m)">或 期初:</span><input class="inp" id="ai_os_g" type="number" step="0.1" placeholder="克" style="max-width:70px" value="' + (isEdit ? item.openingStock || 0 : '') + '"><input class="inp" id="ai_ov_g" type="number" step="0.01" placeholder="元" style="max-width:70px"><button class="btn s" onclick="autoCalcCost(\'gram\')">自动算</button></div>';
        h += '<div class="section-label">定价</div>';
        h += '<div class="hrow"><label>克/杯</label><input class="inp" id="ai_gpc" type="number" step="0.1" style="max-width:50px" value="' + (isEdit ? (item.gramsPerCup || 5) : 5) + '">';
        h += '<label>售价/杯</label><input class="inp" id="ai_ppc" type="number" step="0.01" style="max-width:80px" value="' + (isEdit ? (item.pricePerCup || 0) : '') + '">元';
        h += ' <label>克/壶</label><input class="inp" id="ai_gpp" type="number" step="0.1" style="max-width:50px" value="' + (isEdit ? (item.gramsPerPot || 15) : 15) + '">';
        h += '<label>售价/壶</label><input class="inp" id="ai_ppp" type="number" step="0.01" style="max-width:80px" value="' + (isEdit ? (item.pricePerPot || 0) : '') + '">元</div>';
        h += '<div class="section-label">库存</div>';
        h += '<div class="hrow"><label>期初库存</label><input class="inp" id="ai_os_g2" type="number" style="max-width:80px" value="' + (isEdit ? item.openingStock || 0 : 0) + '">克';
        h += ' <label>补货提醒</label><input class="inp" id="ai_ra_g" type="number" style="max-width:80px" value="' + (isEdit ? item.restockAlert || 0 : 0) + '">克<span style="font-size:.72rem;color:var(--tx-m)">(0=不提醒)</span></div>';
        h += '<div style="font-size:.72rem;color:var(--tx-s);margin-bottom:8px">采购换算: 1斤=500克</div>';
        h += '</div>';

        h += '<div id="teaPack"' + (mode !== 'pack' ? ' style="display:none"' : '') + '>';
        h += '<div class="section-label">成本(按包)</div>';
        var gpk = isEdit ? (item.gramsPerPack || 250) : 250;
        h += '<div class="hrow"><label>克/包</label><input class="inp" id="ai_gpk" type="number" step="1" style="max-width:80px" value="' + gpk + '">';
        h += '<label>成本/包</label><input class="inp" id="ai_cpp" type="number" step="0.01" style="max-width:100px" value="' + (isEdit ? (item.costPerPack || 0) : '') + '">元';
        h += ' <span style="font-size:.72rem;color:var(--tx-m)">或 期初:</span><input class="inp" id="ai_os_p" type="number" step="1" placeholder="包" style="max-width:70px" value="' + (isEdit ? item.openingStock || 0 : '') + '"><input class="inp" id="ai_ov_p" type="number" step="0.01" placeholder="元" style="max-width:70px"><button class="btn s" onclick="autoCalcCost(\'pack\')">自动算</button></div>';
        h += '<div class="section-label">定价</div>';
        h += '<div class="hrow"><label>包/杯</label><input class="inp" id="ai_ppcup" type="number" step="1" style="max-width:50px" value="' + (isEdit ? (item.packsPerCup || 1) : 1) + '">';
        h += '<label>售价/杯</label><input class="inp" id="ai_ppc2" type="number" step="0.01" style="max-width:80px" value="' + (isEdit ? (item.pricePerCup || 0) : '') + '">元';
        h += ' <label>包/壶</label><input class="inp" id="ai_pppot" type="number" step="1" style="max-width:50px" value="' + (isEdit ? (item.packsPerPot || 2) : 2) + '">';
        h += '<label>售价/壶</label><input class="inp" id="ai_ppp2" type="number" step="0.01" style="max-width:80px" value="' + (isEdit ? (item.pricePerPot || 0) : '') + '">元</div>';
        h += '<div class="section-label">库存</div>';
        h += '<div class="hrow"><label>期初库存</label><input class="inp" id="ai_os_p2" type="number" style="max-width:80px" value="' + (isEdit ? item.openingStock || 0 : 0) + '">包';
        h += ' <label>补货提醒</label><input class="inp" id="ai_ra_p" type="number" style="max-width:80px" value="' + (isEdit ? item.restockAlert || 0 : 0) + '">包<span style="font-size:.72rem;color:var(--tx-m)">(0=不提醒)</span></div>';
        h += '<div style="font-size:.72rem;color:var(--tx-s);margin-bottom:8px">采购换算: 1斤=500克 ÷ ' + gpk + '克/包 ≈ ' + Math.floor(500 / gpk) + '包</div>';
        h += '</div>';
    } else if (type === 'cig') {
        h += '<div class="section-label">基本信息</div>';
        h += '<div class="hrow"><label>品牌</label><input class="inp" id="ai_name" style="flex:2" value="' + (isEdit ? item.name.replace(/"/g, '&quot;') : '') + '">';
        h += '<label>成本/包</label><input class="inp" id="ai_costPerUnit" type="number" step="0.01" style="max-width:100px" value="' + (isEdit ? (item.costPerUnit || 0) : '') + '">元';
        h += ' <label>售价/包</label><input class="inp" id="ai_pricePerUnit" type="number" step="0.01" style="max-width:100px" value="' + (isEdit ? (item.pricePerUnit || 0) : '') + '">元</div>';
        h += '<div class="section-label">库存</div>';
        h += '<div class="hrow"><label>期初库存</label><input class="inp" id="ai_os" type="number" style="max-width:80px" value="' + (isEdit ? item.openingStock || 0 : 0) + '">包';
        h += ' <label>期初单价</label><input class="inp" id="ai_openCost" type="number" step="0.01" style="max-width:100px" value="' + (isEdit ? (item.openingUnitCost || 0) : '') + '">元/包';
        h += ' <label>补货提醒</label><input class="inp" id="ai_ra" type="number" style="max-width:80px" value="' + (isEdit ? item.restockAlert || 10 : 10) + '">包<span style="font-size:.72rem;color:var(--tx-m)">(0=不提醒)</span></div>';
        h += '<div class="section-label">采购</div>';
        h += '<div class="hrow"><label>采购单位</label><select class="inp" id="ai_pu" style="max-width:80px"><option' + ((isEdit ? item.purchaseUnit : '条') === '条' ? ' selected' : '') + '>条</option></select>';
        h += '<span style="font-size:.74rem;color:var(--tx-s)">1条 = <input class="inp" id="ai_cr" type="number" style="width:50px;display:inline-block;padding:3px 6px" value="' + (isEdit ? (item.purchaseConvRatio || 10) : 10) + '"> 包</span></div>';
    } else {
        h += '<div class="section-label">基本信息</div>';
        h += '<div class="hrow"><label>品名</label><input class="inp" id="ai_name" style="flex:2" value="' + (isEdit ? item.name.replace(/"/g, '&quot;') : '') + '">';
        h += '<label>成本/瓶</label><input class="inp" id="ai_costPerUnit" type="number" step="0.01" style="max-width:100px" value="' + (isEdit ? (item.costPerUnit || 0) : '') + '">元';
        h += ' <label>售价/瓶</label><input class="inp" id="ai_pricePerUnit" type="number" step="0.01" style="max-width:100px" value="' + (isEdit ? (item.pricePerUnit || 0) : '') + '">元</div>';
        h += '<div class="section-label">库存</div>';
        h += '<div class="hrow"><label>期初库存</label><input class="inp" id="ai_os" type="number" style="max-width:80px" value="' + (isEdit ? item.openingStock || 0 : 0) + '">瓶';
        h += ' <label>期初单价</label><input class="inp" id="ai_openCost" type="number" step="0.01" style="max-width:100px" value="' + (isEdit ? (item.openingUnitCost || 0) : '') + '">元/瓶';
        h += ' <label>补货提醒</label><input class="inp" id="ai_ra" type="number" style="max-width:80px" value="' + (isEdit ? item.restockAlert || 10 : 10) + '">瓶<span style="font-size:.72rem;color:var(--tx-m)">(0=不提醒)</span></div>';
        h += '<div class="section-label">采购</div>';
        h += '<div class="hrow"><label>采购单位</label><select class="inp" id="ai_pu" style="max-width:80px"><option' + ((isEdit ? item.purchaseUnit : '箱') === '箱' ? ' selected' : '') + '>箱</option></select>';
        h += '<span style="font-size:.74rem;color:var(--tx-s)">1箱 = <input class="inp" id="ai_cr" type="number" style="width:50px;display:inline-block;padding:3px 6px" value="' + (isEdit ? (item.purchaseConvRatio || 12) : 12) + '"> 瓶</span></div>';
    }

    h += '<div class="brow" style="margin-top:16px;justify-content:flex-end"><button class="btn p" onclick="doAddInv(\'' + type + '\'' + (isEdit ? ',\'' + itemId + '\'' : '') + ')">' + (isEdit ? '保存修改' : '添加') + '</button>';
    h += '<button class="btn" onclick="closeModal()">取消</button></div>';
    showModal(h);
}

function doAddInv(type, itemId) {
    var cfg = INV[type];
    var name = ($id('ai_name').value || '').trim();
    if (!name) { toast('填名称'); return; }

    if (type === 'tea') {
        var mode = $id('ai_mode').value;
        if (itemId) {
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
            upd(function(db) { db[cfg.key].push(item); });
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
            upd(function(db) { db[cfg.key].push(item); });
            toast('已添加');
        }
    }
    closeModal();
    rInv(type);
}

// 表格行操作事件委托
document.addEventListener('click', function(e) {
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
});

function invCalc(item, type) {
    var tp = item.purchases.filter(function(p) { return p.qty > 0; }).reduce(function(s, p) { return s + p.qty; }, 0);

    if (type === 'tea') {
        var tc = item.sales.reduce(function(s, r) { return s + (r.cups || 0); }, 0);
        var tp2 = item.sales.reduce(function(s, r) { return s + (r.pots || 0); }, 0);
        var rev = item.sales.reduce(function(s, r) { return s + r.amount; }, 0);

        var cost, stock;
        if (item.calcMode === 'pack') {
            cost = (tc * (item.packsPerCup || 0) + tp2 * (item.packsPerPot || 0))
                 * (item.costPerPack || 0);
            stock = (item.openingStock || 0) + tp;
        } else {
            cost = tc * (item.gramsPerCup || 0) * (item.costPerGram || 0)
                 + tp2 * (item.gramsPerPot || 0) * (item.costPerGram || 0);
            stock = (item.openingStock || 0) + tp;
        }

        return {
            stock: stock,
            revenue: rev,
            cost: cost,
            profit: rev - cost,
            margin: rev > 0 ? (rev - cost) / rev * 100 : 0
        };
    }

    var ts = item.sales.reduce(function(s, r) { return s + (r.qty || 0); }, 0);
    var rev = item.sales.reduce(function(s, r) { return s + r.amount; }, 0);
    var cost = ts * (item.costPerUnit || 0);

    return {
        stock: (item.openingStock || 0) + tp - ts,
        revenue: rev,
        cost: cost,
        profit: rev - cost,
        margin: rev > 0 ? (rev - cost) / rev * 100 : 0
    };
}

function invCalcMon(item, type, ym) {
    var sales = item.sales.filter(function(s) { return s.date && s.date.startsWith(ym); });
    var revenue = 0, cost = 0;

    if (type === 'tea') {
        sales.forEach(function(s) {
            revenue += (s.amount || 0);
            cost += ((s.cups || 0) * (item.gramsPerCup || 5)
                   + (s.pots || 0) * (item.gramsPerPot || 15))
                   * (item.costPerGram || 0);
        });
    } else {
        sales.forEach(function(s) {
            revenue += (s.amount || 0);
            cost += (s.qty || 0) * (item.costPerUnit || 0);
        });
    }

    return {
        revenue: revenue,
        cost: cost,
        actual: revenue
    };
}
