// daily.js - 日报

// ==================== 7. 日报 ====================
var _pd = null;

function rDaily() {
    var h = '<div class="tab-bar" id="dT">';
    h += '<button class="tab-btn active" onclick="switchDT(\'text\')">粘贴</button>';
    h += '<button class="tab-btn" onclick="switchDT(\'manual\')">手动</button>';
    h += '<button class="tab-btn" onclick="switchDT(\'hist\')">明细</button>';
    h += '</div>';

    h += '<div id="dText">';
    h += '<textarea id="dtInput" class="inp" placeholder="粘贴日报..." style="width:100%;max-height:120px;resize:vertical;box-sizing:border-box"></textarea>';
    h += '<div class="brow"><button class="btn p" onclick="doParseDaily()">解析</button></div>';
    h += '<div id="dailyPreview"></div>';
    h += '</div>';

    h += '<div id="dMan" style="display:none">';
    h += '<div class="hrow"><label>日期</label><input class="inp" id="dmDate" type="text" readonly placeholder="选择日期" value="' + td() + '" onclick="_dpOpen(\'dmDate\')" style="cursor:pointer"></div>';
    h += '<div class="section-label">经营数据</div><div id="dmFreeList"></div>';
    h += '<div class="section-label">茗茶销售</div><div id="dmTeaList"></div>';
    h += '<div class="section-label">香烟销售</div><div id="dmCigList"></div>';
    h += '<div class="section-label">包厢预定</div><div id="dmRoomList"></div>';
    h += '<div class="hrow"><label>汇报人</label><input class="inp" id="dmReporter" style="max-width:160px"></div>';
    h += '<div class="brow"><button class="btn p" onclick="doManualDaily()">保存</button></div>';
    h += '</div>';

    h += '<div id="dHist" style="display:none">';
    h += '<div class="hrow"><label>月份</label><input class="inp" id="dhM" type="text" readonly placeholder="选择月份" value="' + curYM() + '" onclick="_mpOpen(\'dhM\')" onchange="renderDHist()" style="max-width:180px;cursor:pointer"></div>';
    h += '<div id="dhArea"></div>';
    h += '</div>';

    setMain('日报', h);
    setTimeout(renderDHist, 100);
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

    if (mr.length) {
        var mNet = 0, mGuests = 0;
        mr.forEach(function(r) {
            mNet += r.revenue.netSales || 0;
            mGuests += r.guest.count || 0;
        });

        h += '<div class="cards">';
        h += '<div class="card"><div class="card-l">本月实收</div><div class="card-v ac">' + fmtC(mNet) + '</div></div>';
        h += '<div class="card"><div class="card-l">已报天数</div><div class="card-v">' + mr.length + '</div></div>';
        h += '<div class="card"><div class="card-l">总客流</div><div class="card-v">' + mGuests + '</div></div>';
        h += '</div>';

        h += '<div class="brow" style="margin-bottom:14px"><button class="btn" onclick="showDailyCheckMonth()">📋 校验本月日报</button></div>';
    }

    h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:14px">';
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

        h += '<div style="background:' + bg + ';border:1px solid ' + borderColor + ';border-radius:6px;padding:6px;' + clickable + ';min-height:65px"';
        if (r) h += ' onclick="showDailyModal(\'' + r.date + '\')"';
        h += '>';
        h += '<div style="font-size:.72rem;font-weight:600;color:' + dayColor + '">' + d + '</div>';

        if (r) {
            h += '<div style="font-family:var(--fm);font-size:.7rem;color:var(--ac);margin-top:2px">' + fmtC(r.revenue.netSales) + '</div>';
            h += '<div style="font-size:.6rem;color:var(--tx-m)">' + r.guest.count + '人</div>';
        } else {
            h += '<div style="font-size:.6rem;color:var(--tx-m);margin-top:4px">-</div>';
        }
        h += '</div>';
    }
    h += '</div>';

    el.innerHTML = h;
}

function switchDT(tab) {
    $id('dText').style.display = tab === 'text' ? '' : 'none';
    $id('dMan').style.display = tab === 'manual' ? '' : 'none';
    $id('dHist').style.display = tab === 'hist' ? '' : 'none';
    document.querySelectorAll('#dT .tab-btn').forEach(function(b, i) {
        b.classList.toggle('active', (i === 0 && tab === 'text') || (i === 1 && tab === 'manual') || (i === 2 && tab === 'hist'));
    });
    if (tab === 'manual') { initFreeRows(); initTeaBlock(); initCigBlock(); initRoomBlock(); }
    if (tab === 'hist') renderDHist();
}

function initFreeRows() {
    var labels = getFreeLabels();
    var html = '<div class="tag-btns">';
    labels.forEach(function(l) {
        html += '<button class="tag-btn" onclick="setLastFree(\'' + l + '\')">' + l + '</button>';
    });
    html += '</div>' + freeRowHTML();
    $id('dmFreeList').innerHTML = html;
}

function setLastFree(label) {
    var rows = document.querySelectorAll('#dmFreeList .free-row');
    if (!rows.length) { addFreeRow(); rows = document.querySelectorAll('#dmFreeList .free-row'); }
    var last = rows[rows.length - 1];
    if (last) {
        var inp = last.querySelector('[data-type="fl"]');
        if (inp && !inp.value) inp.value = label;
    }
}

function freeRowHTML() {
    return '<div class="hrow free-row">' +
        '<input class="inp" data-type="fl" placeholder="标签" style="flex:1.5">' +
        '<input class="inp" data-type="fv" type="number" step="0.01" value="0" style="flex:1;max-width:140px">' +
        '<button class="btn s d" onclick="this.parentElement.remove()">×</button></div>';
}

function addFreeRow() {
    var d = document.createElement('div');
    d.innerHTML = freeRowHTML();
    $id('dmFreeList').appendChild(d.firstElementChild);
}

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

function initCigBlock() {
    var items = DB.cigItems;
    if (!items.length) { $id('dmCigList').innerHTML = '<div style="font-size:.74rem;color:var(--tx-m)">先在香烟管理中添加</div>'; return; }
    var h = '';
    items.forEach(function(item) {
        h += '<div class="tea-sale-row" data-cid="' + item.id + '">';
        h += '<label>' + item.name + '</label>';
        h += '数量:<input class="inp cig-sqty" type="number" value="0" style="max-width:60px" oninput="calcCigExpected(this)"> ';
        h += '金额:<input class="inp cig-samt" type="number" step="0.01" value="0" style="max-width:100px;background:var(--card-h)" readonly>';
        h += '</div>';
    });
    $id('dmCigList').innerHTML = h;
}

function calcTeaExpected(el) {
    var row = el.closest('.tea-sale-row');
    if (!row) return;
    var item = DB.teaItems.find(function(t) { return t.id === row.dataset.tid; });
    if (!item) return;
    var cups = parseInt(row.querySelector('.tea-cups').value) || 0;
    var pots = parseInt(row.querySelector('.tea-pots').value) || 0;
    row.querySelector('.tea-expected').value = (cups * (item.pricePerCup || 0) + pots * (item.pricePerPot || 0)).toFixed(2);
}

function calcCigExpected(el) {
    var row = el.closest('.tea-sale-row');
    if (!row) return;
    var item = DB.cigItems.find(function(c) { return c.id === row.dataset.cid; });
    if (!item) return;
    var qty = parseInt(row.querySelector('.cig-sqty').value) || 0;
    row.querySelector('.cig-samt').value = (qty * (item.pricePerUnit || 0)).toFixed(2);
}

function initRoomBlock() {
    var h = '<div id="dmRoomRows">';
    h += roomRowHTML('李海燕', 0, 0);
    h += roomRowHTML('文心月', 0, 0);
    h += roomRowHTML('李海榕', 0, 0);
    h += roomRowHTML('蒯祯', 0, 0);
    h += '</div>';
    h += '<div style="margin-top:6px"><button class="btn s" onclick="addRoomRow()">+添加</button></div>';
    h += '<div class="hrow" style="margin-top:8px"><label>累计500+包厢</label><input class="inp" id="dmPremCum" type="number" value="0" style="max-width:80px"></div>';
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

function doManualDaily() {
    var date = $id('dmDate').value || td();
    var existing = DB.dailyReports.find(function(d) { return d.date === date; });

    var freeData = [];
    document.querySelectorAll('#dmFreeList .free-row').forEach(function(row) {
        var lb = row.querySelector('[data-type="fl"]').value.trim();
        var v = parseFloat(row.querySelector('[data-type="fv"]').value) || 0;
        if (lb) freeData.push({ label: lb, value: v });
    });

    var teaData = [];
    document.querySelectorAll('.tea-sale-row[data-tid]').forEach(function(row) {
        var id = row.dataset.tid;
        var cups = parseInt(row.querySelector('.tea-cups').value) || 0;
        var pots = parseInt(row.querySelector('.tea-pots').value) || 0;
        var expected = parseFloat(row.querySelector('.tea-expected').value) || 0;
        var amt = parseFloat(row.querySelector('.tea-amt').value) || 0;
        if (cups > 0 || pots > 0 || amt > 0) {
            teaData.push({ id: id, cups: cups, pots: pots, expectedAmount: expected, amount: amt });
        }
    });

    var cigData = [];
    document.querySelectorAll('.tea-sale-row[data-cid]').forEach(function(row) {
        var id = row.dataset.cid;
        var qty = parseInt(row.querySelector('.cig-sqty').value) || 0;
        var amt = parseFloat(row.querySelector('.cig-samt').value) || 0;
        if (qty > 0 || amt > 0) {
            cigData.push({ id: id, qty: qty, amount: amt });
        }
    });

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
        h += '<div class="brow" style="margin-top:14px"><button class="btn" onclick="closeModal()">取消</button></div>';
        showModal(h);
    } else {
        doSaveManual(date, 'overwrite');
    }

    window._manualSaveData = { freeData: freeData, teaData: teaData, cigData: cigData, roomData: roomData, premCum: premCum };
}

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
            r.cigSales[cd.id] = { qty: cd.qty, amount: cd.amount };
            r.revenue.cigarette.total += cd.amount;
            if (mode === 'merge') item.sales = item.sales.filter(function(s) { return s.date !== date; });
            item.sales.push({ date: date, qty: cd.qty, amount: cd.amount });
        });

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

    closeModal();
    toast(mode === 'merge' ? '已合并保存' : '已覆盖保存');
    _pmItems = [];
    rDaily();
}

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
        reporter: ''
    };

    var dm = text.match(/(\d{4})\s*[年\-\/.]\s*(\d{1,2})\s*[月\-\/.]\s*(\d{1,2})/);
    if (dm) r.date = dm[1] + '-' + String(dm[2]).padStart(2, '0') + '-' + String(dm[3]).padStart(2, '0');

    function getBrackets(s) {
        var m = s.match(/[（(]([\s\S]+?)[）)]/);
        return m ? m[1] : '';
    }

    function splitParts(s) {
        return s.replace(/、/g, ',').replace(/，/g, ',').replace(/、/g, ',').replace(/\+/g, ',').split(',');
    }

    text.split('\n').forEach(function(l) {
        l = l.trim();
        if (!l) return;
        l = l.replace(/\*\*/g, '').replace(/：/g, ':');
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
                    var im = part.match(/(.+?)[:：](\d+)/);
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

        if (/包厢预定/.test(l)) return;

        if (/^[一-龥]/.test(l) && !/月累计|合计|人数|人均|汇报|流水|实收|厨房|吧台|香烟|其他|招待|POS|建行|现金|会员|应收|外卖/.test(l)) {
            var nums = l.match(/(\d+)\s+(\d+)/);
            var nameMatch = l.match(/^([一-龥（）\(\)]+)/);
            if (nums && nameMatch) {
                var today = parseInt(nums[1]);
                var cum = parseInt(nums[2]);
                r.rooms.push({ name: nameMatch[1].trim(), today: today, cum: cum });
                var pm500 = l.match(/个数:?\s*(\d+)/);
                if (pm500 && /500/.test(l)) {
                    r.guest.premiumRoomsToday = parseInt(pm500[1]);
                    r.premiumRooms.today = parseInt(pm500[1]);
                }
                return;
            }
        }

        if (/累计.*500.*包厢.*个数/.test(l)) {
            var pm = l.match(/个数:?\s*(\d+)/);
            if (pm) r.premiumRooms.cum = parseInt(pm[1]);
            return;
        }

        if (/汇报人/.test(l)) {
            r.reporter = l.replace(/.*汇报人:?\s*/, '').trim();
            return;
        }
    });

    if (!r.delivery.total) r.delivery.total = (r.delivery.meituan || 0) + (r.delivery.taobao || 0) + (r.delivery.jd || 0);
    if (!r.payment.ar.total) r.payment.ar.total = (r.payment.ar.meituan || 0) + (r.payment.ar.douyin || 0);
    return r;
}

function doParseDaily() {
    var text = $id('dtInput').value.trim();
    if (!text) { toast('请粘贴日报'); return; }
    _pd = parseDaily(text);
    fixCigParsed(text, _pd);
    renderDP();
}

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
            var im = part.match(/(.+?)[：:](\d+)/);
            if (im) {
                var nm = im[1].trim(), qt = parseInt(im[2]);
                if (nm && qt > 0) result.revenue.cigarette.items[nm] = qt;
            }
        });
        return;
    }
}

function renderDP() {
    var r = _pd;
    if (!r) return;

    var inpRow = function(l, v, pa, ro) {
        return '<div class="pv-row"><span class="k">' + l + '</span>' +
            '<input class="ed-input" type="number" step="0.01" value="' + v + '"' +
            (ro ? ' readonly style="background:var(--card-h)"' : '') +
            ' oninput="setDVal(\'' + pa + '\',this.value)"></div>';
    };

    var h = '<div class="pv-card"><h4>营收</h4>';
    h += inpRow('流水', r.revenue.grossSales, 'revenue.grossSales');
    h += inpRow('折扣', r.revenue.discount, 'revenue.discount');
    h += inpRow('实收', r.revenue.netSales, 'revenue.netSales');
    h += inpRow('厨房', r.revenue.kitchenSales, 'revenue.kitchenSales');
    h += inpRow('吧台', r.revenue.barSales, 'revenue.barSales');
    h += inpRow('香烟', r.revenue.cigarette.total, 'revenue.cigarette.total');
    h += inpRow('其他', r.revenue.other, 'revenue.other');
    h += '</div>';

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
        h += '应收:<input class="ed-input tea-expected" type="number" step="0.01" value="' + expected + '" style="width:80px;background:var(--card-h)" readonly> ';
        h += '实收:<input class="ed-input tea-amt" type="number" step="0.01" value="' + amt + '" style="width:80px">';
        h += '</div>';
    });
    h += '</div>';

    var parsedCig = r.revenue.cigarette.items || {};
    h += '<div class="pv-card"><h4>香烟销售</h4>';
    DB.cigItems.forEach(function(item) {
        var sv = r.cigSales && r.cigSales[item.id];
        var dq = 0, da = 0;
        if (sv) {
            dq = sv.qty || 0;
            da = sv.amount || 0;
        } else {
            Object.keys(parsedCig).forEach(function(k) {
                if (!parsedCig[k]) return;
                if (item.name.indexOf(k) >= 0 || k.indexOf(item.name) >= 0) {
                    dq = parsedCig[k];
                    da = dq * (item.pricePerUnit || 0);
                }
            });
        }
        h += '<div class="tea-sale-row" data-cid="' + item.id + '">';
        h += '<label>' + item.name + '</label>';
        h += '数量:<input class="ed-input cig-sqty" type="number" value="' + dq + '" style="width:60px" oninput="calcCigExpected(this)"> ';
        h += '金额:<input class="ed-input cig-samt" type="number" step="0.01" value="' + (Math.round(da * 100) / 100) + '" style="width:100px;background:var(--card-h)" readonly>';
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

    h += '<div class="pv-card"><h4>支付</h4>';
    h += inpRow('POS', r.payment.pos, 'payment.pos');
    h += inpRow('建行', r.payment.ccbLife, 'payment.ccbLife');
    h += inpRow('现金', r.payment.cash, 'payment.cash');
    h += inpRow('会员', r.payment.memberCard, 'payment.memberCard');
    h += inpRow('招待', r.payment.treat, 'payment.treat');
    h += '</div>';

    h += '<div class="pv-card"><h4>应收</h4>';
    h += inpRow('合计', r.payment.ar.total, 'payment.ar.total', true);
    h += inpRow('美团团购', r.payment.ar.meituan, 'payment.ar.meituan');
    h += inpRow('抖音团购', r.payment.ar.douyin, 'payment.ar.douyin');
    h += '</div>';

    h += '<div class="pv-card"><h4>外卖</h4>';
    h += inpRow('合计', r.delivery.total, 'delivery.total', true);
    h += inpRow('美团', r.delivery.meituan, 'delivery.meituan');
    h += inpRow('淘宝', r.delivery.taobao, 'delivery.taobao');
    h += inpRow('京东', r.delivery.jd, 'delivery.jd');
    h += '</div>';

    h += '<div class="pv-card"><h4>客情</h4>';
    h += inpRow('人数', r.guest.count, 'guest.count');
    h += inpRow('人均', r.guest.avgSpend, 'guest.avgSpend');
    h += inpRow('500+包厢', r.guest.premiumRoomsToday, 'guest.premiumRoomsToday');
    h += '</div>';

    if (r.rooms && r.rooms.length) {
        h += '<div class="pv-card"><h4>包厢预定</h4>';
        h += '<table style="width:100%;border-collapse:collapse;font-size:.78rem">';
        h += '<tr><th style="text-align:left;padding:6px 8px;background:var(--card-h);border-bottom:1px solid var(--bd)">姓名</th>';
        h += '<th style="text-align:right;padding:6px 8px;background:var(--card-h);border-bottom:1px solid var(--bd)">今日</th>';
        h += '<th style="text-align:right;padding:6px 8px;background:var(--card-h);border-bottom:1px solid var(--bd)">累计</th></tr>';
        r.rooms.forEach(function(room) {
            h += '<tr><td style="padding:6px 8px;border-bottom:1px solid var(--bd-l)">' + room.name + '</td>';
            h += '<td style="padding:6px 8px;border-bottom:1px solid var(--bd-l);text-align:right">' + room.today + '</td>';
            h += '<td style="padding:6px 8px;border-bottom:1px solid var(--bd-l);text-align:right">' + room.cum + '</td></tr>';
        });
        h += '</table></div>';
    }

    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end;gap:10px">';
    h += '<button class="btn p" onclick="saveDaily()">保存</button>';
    h += '<button class="btn" onclick="_pd=null;$id(\'dailyPreview\').innerHTML=\'\'">取消</button>';
    h += '</div>';

    $id('dailyPreview').innerHTML = h;
}

function setDVal(pa, val) {
    var p = pa.split('.'), o = _pd;
    for (var i = 0; i < p.length - 1; i++) o = o[p[i]];
    o[p[p.length - 1]] = parseFloat(val) || 0;
    if (pa.indexOf('delivery.') === 0 && pa !== 'delivery.total')
        _pd.delivery.total = (_pd.delivery.meituan || 0) + (_pd.delivery.taobao || 0) + (_pd.delivery.jd || 0);
    if (pa.indexOf('payment.ar.') === 0 && pa !== 'payment.ar.total')
        _pd.payment.ar.total = (_pd.payment.ar.meituan || 0) + (_pd.payment.ar.douyin || 0);
}

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

function saveDaily() {
    if (!_pd) return;

    upd(function(db) {
        var oldReport = db.dailyReports.find(function(d) { return d.date === _pd.date; });

        if (oldReport) {
            Object.keys(oldReport.teaSales || {}).forEach(function(tid) {
                var item = db.teaItems.find(function(t) { return t.id === tid; });
                if (item) item.sales = item.sales.filter(function(s) { return s.date !== _pd.date; });
            });
            Object.keys(oldReport.cigSales || {}).forEach(function(cid) {
                var item = db.cigItems.find(function(c) { return c.id === cid; });
                if (item) item.sales = item.sales.filter(function(s) { return s.date !== _pd.date; });
            });
        }

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
                item.sales.push({ date: _pd.date, cups: cups, pots: pots, expectedAmount: expected, amount: amt });
            }
        });

        var cigTotal = 0;
        document.querySelectorAll('.tea-sale-row[data-cid]').forEach(function(row) {
            var id = row.dataset.cid;
            var item = db.cigItems.find(function(c) { return c.id === id; });
            if (!item) return;
            var qty = parseInt(row.querySelector('.cig-sqty').value) || 0;
            var amt = parseFloat(row.querySelector('.cig-samt').value) || 0;
            if (qty > 0 || amt > 0) {
                _pd.cigSales[id] = { qty: qty, amount: amt };
                item.sales.push({ date: _pd.date, qty: qty, amount: amt });
                cigTotal += amt;
            }
        });
        if (cigTotal > 0) _pd.revenue.cigarette.total = cigTotal;

        var idx = db.dailyReports.findIndex(function(d) { return d.date === _pd.date; });
        if (idx >= 0) db.dailyReports[idx] = _pd;
        else db.dailyReports.push(_pd);
    });

    toast('已保存');
    _pd = null;
    rDaily();
}

function showDailyModal(date) {
    var r = DB.dailyReports.find(function(d) { return d.date === date; });
    if (!r) { toast('未找到日报'); return; }

    var h = '<h3>' + date + ' 日报</h3>';
    h += '<div style="max-height:60vh;overflow-y:auto;padding-right:4px">';

    h += '<div class="section-label">营收</div>';
    h += '<div class="pv-row"><span class="k">流水</span><span>' + fmtC(r.revenue.grossSales || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">折扣</span><span>' + fmtC(r.revenue.discount || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">实收</span><span style="color:var(--ac);font-weight:600">' + fmtC(r.revenue.netSales || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">厨房</span><span>' + fmtC(r.revenue.kitchenSales || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">吧台</span><span>' + fmtC(r.revenue.barSales || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">香烟</span><span>' + fmtC(r.revenue.cigarette.total || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">其他</span><span>' + fmtC(r.revenue.other || 0) + '</span></div>';

    h += '<div class="section-label">支付</div>';
    h += '<div class="pv-row"><span class="k">POS机</span><span>' + fmtC(r.payment.pos || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">建行生活</span><span>' + fmtC(r.payment.ccbLife || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">现金</span><span>' + fmtC(r.payment.cash || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">会员刷卡</span><span>' + fmtC(r.payment.memberCard || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">招待</span><span>' + fmtC(r.payment.treat || 0) + '</span></div>';

    h += '<div class="section-label">应收账款</div>';
    h += '<div class="pv-row"><span class="k">美团团购</span><span>' + fmtC(r.payment.ar.meituan || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">抖音团购</span><span>' + fmtC(r.payment.ar.douyin || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">合计</span><span style="font-weight:600">' + fmtC(r.payment.ar.total || 0) + '</span></div>';

    h += '<div class="section-label">外卖</div>';
    h += '<div class="pv-row"><span class="k">美团外卖</span><span>' + fmtC(r.delivery.meituan || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">淘宝</span><span>' + fmtC(r.delivery.taobao || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">京东</span><span>' + fmtC(r.delivery.jd || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">合计</span><span style="font-weight:600">' + fmtC(r.delivery.total || 0) + '</span></div>';

    h += '<div class="section-label">客情</div>';
    h += '<div class="pv-row"><span class="k">人数</span><span>' + (r.guest.count || 0) + '人</span></div>';
    h += '<div class="pv-row"><span class="k">人均</span><span>' + fmtC(r.guest.avgSpend || 0) + '</span></div>';
    h += '<div class="pv-row"><span class="k">500+包厢</span><span>' + (r.guest.premiumRoomsToday || 0) + '</span></div>';

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

    if (r.reporter) {
        h += '<div class="pv-row"><span class="k">汇报人</span><span>' + r.reporter + '</span></div>';
    }

    h += '</div>';

    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end">';
    h += '<button class="btn p" onclick="editDailyModal(' + sq(date) + ')">修改</button>';
    h += '<button class="btn d" onclick="delDailyFromModal(' + sq(date) + ')">删除</button>';
    h += '<button class="btn" onclick="showDailyCheck(' + sq(date) + ')">校验</button>';
    h += '<button class="btn" onclick="closeModal()">关闭</button>';
    h += '</div>';

    showModal(h, 700);
}

function editDailyModal(date) {
    var r = DB.dailyReports.find(function(d) { return d.date === date; });
    if (!r) { toast('未找到日报'); return; }

    var h = '<h3>' + date + ' 日报 · 编辑</h3>';
    h += '<div style="max-height:60vh;overflow-y:auto;padding-right:4px">';

    h += '<div class="section-label">营收</div>';
    h += '<div class="hrow"><label>流水</label><input class="inp" id="dm_gross" type="number" step="0.01" value="' + (r.revenue.grossSales || 0) + '"></div>';
    h += '<div class="hrow"><label>折扣</label><input class="inp" id="dm_discount" type="number" step="0.01" value="' + (r.revenue.discount || 0) + '">';
    h += '<label>实收</label><input class="inp" id="dm_net" type="number" step="0.01" value="' + (r.revenue.netSales || 0) + '"></div>';
    h += '<div class="hrow"><label>厨房</label><input class="inp" id="dm_kitchen" type="number" step="0.01" value="' + (r.revenue.kitchenSales || 0) + '">';
    h += '<label>吧台</label><input class="inp" id="dm_bar" type="number" step="0.01" value="' + (r.revenue.barSales || 0) + '"></div>';
    h += '<div class="hrow"><label>香烟</label><input class="inp" id="dm_cig" type="number" step="0.01" value="' + (r.revenue.cigarette.total || 0) + '">';
    h += '<label>其他</label><input class="inp" id="dm_other" type="number" step="0.01" value="' + (r.revenue.other || 0) + '"></div>';

    h += '<div class="section-label">支付</div>';
    h += '<div class="hrow"><label>POS</label><input class="inp" id="dm_pos" type="number" step="0.01" value="' + (r.payment.pos || 0) + '">';
    h += '<label>建行</label><input class="inp" id="dm_ccb" type="number" step="0.01" value="' + (r.payment.ccbLife || 0) + '"></div>';
    h += '<div class="hrow"><label>现金</label><input class="inp" id="dm_cash" type="number" step="0.01" value="' + (r.payment.cash || 0) + '">';
    h += '<label>会员</label><input class="inp" id="dm_member" type="number" step="0.01" value="' + (r.payment.memberCard || 0) + '"></div>';
    h += '<div class="hrow"><label>招待</label><input class="inp" id="dm_treat" type="number" step="0.01" value="' + (r.payment.treat || 0) + '"></div>';

    h += '<div class="section-label">应收</div>';
    h += '<div class="hrow"><label>美团团购</label><input class="inp" id="dm_meituan" type="number" step="0.01" value="' + (r.payment.ar.meituan || 0) + '">';
    h += '<label>抖音团购</label><input class="inp" id="dm_douyin" type="number" step="0.01" value="' + (r.payment.ar.douyin || 0) + '"></div>';

    h += '<div class="section-label">外卖</div>';
    h += '<div class="hrow"><label>美团外卖</label><input class="inp" id="dm_d_meituan" type="number" step="0.01" value="' + (r.delivery.meituan || 0) + '">';
    h += '<label>淘宝</label><input class="inp" id="dm_d_taobao" type="number" step="0.01" value="' + (r.delivery.taobao || 0) + '"></div>';
    h += '<div class="hrow"><label>京东</label><input class="inp" id="dm_d_jd" type="number" step="0.01" value="' + (r.delivery.jd || 0) + '"></div>';

    h += '<div class="section-label">客情</div>';
    h += '<div class="hrow"><label>人数</label><input class="inp" id="dm_count" type="number" value="' + (r.guest.count || 0) + '">';
    h += '<label>人均</label><input class="inp" id="dm_avg" type="number" step="0.01" value="' + (r.guest.avgSpend || 0) + '">';
    h += '<label>500+包厢</label><input class="inp" id="dm_premium" type="number" value="' + (r.guest.premiumRoomsToday || 0) + '"></div>';

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

    h += '<div class="hrow"><label>汇报人</label><input class="inp" id="dm_reporter" value="' + (r.reporter || '') + '"></div>';

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

    h += '</div>';

    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end">';
    h += '<button class="btn p" onclick="saveDailyModal(' + sq(date) + ')">保存</button>';
    h += '<button class="btn d" onclick="delDailyFromModal(' + sq(date) + ')">删除</button>';
    h += '<button class="btn" onclick="showDailyModal(' + sq(date) + ')">取消</button>';
    h += '</div>';

    showModal(h, 700);
}

function saveDailyModal(date) {
    upd(function(db) {
        var r = db.dailyReports.find(function(d) { return d.date === date; });
        if (!r) return;

        r.revenue.grossSales = parseFloat($id('dm_gross').value) || 0;
        r.revenue.discount = parseFloat($id('dm_discount').value) || 0;
        r.revenue.netSales = parseFloat($id('dm_net').value) || 0;
        r.revenue.kitchenSales = parseFloat($id('dm_kitchen').value) || 0;
        r.revenue.barSales = parseFloat($id('dm_bar').value) || 0;
        r.revenue.cigarette.total = parseFloat($id('dm_cig').value) || 0;
        r.revenue.other = parseFloat($id('dm_other').value) || 0;

        r.payment.pos = parseFloat($id('dm_pos').value) || 0;
        r.payment.ccbLife = parseFloat($id('dm_ccb').value) || 0;
        r.payment.cash = parseFloat($id('dm_cash').value) || 0;
        r.payment.memberCard = parseFloat($id('dm_member').value) || 0;
        r.payment.treat = parseFloat($id('dm_treat').value) || 0;

        r.payment.ar.meituan = parseFloat($id('dm_meituan').value) || 0;
        r.payment.ar.douyin = parseFloat($id('dm_douyin').value) || 0;
        r.payment.ar.total = r.payment.ar.meituan + r.payment.ar.douyin;

        r.delivery.meituan = parseFloat($id('dm_d_meituan').value) || 0;
        r.delivery.taobao = parseFloat($id('dm_d_taobao').value) || 0;
        r.delivery.jd = parseFloat($id('dm_d_jd').value) || 0;
        r.delivery.total = r.delivery.meituan + r.delivery.taobao + r.delivery.jd;

        r.guest.count = parseInt($id('dm_count').value) || 0;
        r.guest.avgSpend = parseFloat($id('dm_avg').value) || 0;
        r.guest.premiumRoomsToday = parseInt($id('dm_premium').value) || 0;

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

        r.reporter = $id('dm_reporter').value.trim();
    });

    toast('已保存');
    closeModal();
    renderDHist();
}

function delDailyFromModal(date) {
    if (!confirm('删除 ' + date + ' 的日报？')) return;
    upd(function(db) {
        db.dailyReports = db.dailyReports.filter(function(d) { return d.date !== date; });
    });
    toast('已删除');
    closeModal();
    renderDHist();
}

function addEditRoomRow() {
    var d = document.createElement('div');
    d.innerHTML = '<div class="hrow room-row">' +
        '<input class="inp room-name" placeholder="姓名" style="flex:1.5">' +
        '<input class="inp room-today" type="number" placeholder="今日" style="max-width:60px" value="0">' +
        '<input class="inp room-cum" type="number" placeholder="累计" style="max-width:60px" value="0">' +
        '<button class="btn s d" onclick="this.parentElement.remove()">×</button></div>';
    $id('editRoomRows').appendChild(d.firstElementChild);
}

function syncInvToDaily(type, date) {
    var items = DB[INV[type].key] || [];

    items.forEach(function(item) {
        item.purchases = (item.purchases || []).filter(function(p) {
            return !(p.date === date && p.qty < 0);
        });

        var sales = item.sales.filter(function(s) { return s.date === date; });
        if (type === 'tea') {
            var cups = 0, pots = 0, amount = 0, expected = 0;
            sales.forEach(function(s) {
                cups += (s.cups || 0);
                pots += (s.pots || 0);
                amount += (s.amount || 0);
                expected += (s.expectedAmount || 0);
            });
            var gramUsed = cups * (item.gramsPerCup || 0) + pots * (item.gramsPerPot || 0);
            if (gramUsed > 0) {
                item.purchases.push({ date: date, qty: -gramUsed, source: '日报' });
            }
        } else {
            var qty = 0, amount = 0;
            sales.forEach(function(s) {
                qty += (s.qty || 0);
                amount += (s.amount || 0);
            });
            if (qty > 0) {
                item.purchases.push({ date: date, qty: -qty, source: '日报' });
            }
        }
    });

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
    }

    saveDB();
}

// ==================== 日报数据校验 ====================
function checkDailyData(r) {
    var issues = [];

    var expected = (r.revenue.grossSales || 0) - (r.revenue.discount || 0);
    var actual = r.revenue.netSales || 0;
    if (Math.abs(expected - actual) > 0.01) {
        issues.push('流水-折扣≠实收：' + fmtC(expected) + ' ≠ ' + fmtC(actual) + '（差 ' + fmtC(expected - actual) + '）');
    }

    var payTotal = (r.payment.pos || 0) + (r.payment.ccbLife || 0) + (r.payment.cash || 0)
        + (r.payment.memberCard || 0) + (r.payment.treat || 0) + (r.payment.ar.total || 0)
        + (r.delivery.total || 0);
    if (Math.abs(payTotal - actual) > 0.01) {
        issues.push('支付渠道合计≠实收：' + fmtC(payTotal) + ' ≠ ' + fmtC(actual) + '（差 ' + fmtC(payTotal - actual) + '）');
    }

    var arExpected = (r.payment.ar.meituan || 0) + (r.payment.ar.douyin || 0);
    var arActual = r.payment.ar.total || 0;
    if (Math.abs(arExpected - arActual) > 0.01) {
        issues.push('应收账款≠美团+抖音：' + fmtC(arExpected) + ' ≠ ' + fmtC(arActual) + '（差 ' + fmtC(arExpected - arActual) + '）');
    }

    var delExpected = (r.delivery.meituan || 0) + (r.delivery.taobao || 0) + (r.delivery.jd || 0);
    var delActual = r.delivery.total || 0;
    if (Math.abs(delExpected - delActual) > 0.01) {
        issues.push('外卖合计≠美团+淘宝+京东：' + fmtC(delExpected) + ' ≠ ' + fmtC(delActual) + '（差 ' + fmtC(delExpected - delActual) + '）');
    }

    return issues;
}

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

function showDailyCheckMonth() {
    var ym = curYM();
    var reports = DB.dailyReports.filter(function(r) { return r.date.startsWith(ym); });
    if (!reports.length) { toast('本月暂无日报'); return; }

    var totalIssues = 0;
    var h = '<h3>' + ym + ' 日报批量校验</h3>';
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
