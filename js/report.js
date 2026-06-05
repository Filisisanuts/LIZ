
// 月度财务报告主页：核心指标 + 子标签导航 + 多维度报表
function rReport() {
    var ym = curYM();

    // 月份选择器
    var h = '<div class="hrow"><label>月份</label>';
    h += '<button class="btn s" onclick="reportCalNav(-1)">◀</button>';
    h += '<input class="inp" id="repM" type="text" readonly placeholder="选择月份" value="' + ym + '" onclick="_mpOpen(\'repM\')" onchange="reportCalPickYM(this.value)" style="max-width:180px;cursor:pointer">';
    h += '<button class="btn s" onclick="reportCalNav(1)">▶</button>';
    h += '</div>';

    var m = $id('repM') ? $id('repM').value || ym : ym;
    var mr = getMR(m);

    // ===== 营收汇总 =====
    var mNet = mr.reduce(function(s, r) { return s + (r.revenue.netSales || 0); }, 0);
    var mGross = mr.reduce(function(s, r) { return s + (r.revenue.grossSales || 0); }, 0);
    var mKit = mr.reduce(function(s, r) { return s + (r.revenue.kitchenSales || 0); }, 0);
    var mBar = mr.reduce(function(s, r) { return s + (r.revenue.barSales || 0); }, 0);
    var mDel = mr.reduce(function(s, r) { return s + (r.delivery.total || 0); }, 0);
    var mCigRev = mr.reduce(function(s, r) { return s + (r.revenue.cigarette.total || 0); }, 0);
    var mOther = mr.reduce(function(s, r) { return s + (r.revenue.other || 0); }, 0);
    var mDiscount = mr.reduce(function(s, r) { return s + (r.revenue.discount || 0); }, 0);
    var mGuests = mr.reduce(function(s, r) { return s + (r.guest.count || 0); }, 0);

    // ===== 支付方式汇总 =====
    var mPos = mr.reduce(function(s, r) { return s + (r.payment.pos || 0); }, 0);
    var mCcb = mr.reduce(function(s, r) { return s + (r.payment.ccbLife || 0); }, 0);
    var mCash = mr.reduce(function(s, r) { return s + (r.payment.cash || 0); }, 0);
    var mMember = mr.reduce(function(s, r) { return s + (r.payment.memberCard || 0); }, 0);
    var mTreat = mr.reduce(function(s, r) { return s + (r.payment.treat || 0); }, 0);
    var mAr = mr.reduce(function(s, r) { return s + (r.payment.ar.total || 0); }, 0);

    // ===== 外卖渠道汇总 =====
    var mDelMeituan = mr.reduce(function(s, r) { return s + (r.delivery.meituan || 0); }, 0);
    var mDelTaobao = mr.reduce(function(s, r) { return s + (r.delivery.taobao || 0); }, 0);
    var mDelJd = mr.reduce(function(s, r) { return s + (r.delivery.jd || 0); }, 0);

    // ===== 库存销售统计 =====
    var teaS = DB.teaItems.map(function(item) {
        var mc = invCalcMon(item, 'tea', m);
        return { item: item, revenue: mc.revenue, cost: mc.cost, profit: mc.revenue - mc.cost };
    });
    var cigS = DB.cigItems.map(function(item) {
        var mc = invCalcMon(item, 'cig', m);
        return { item: item, revenue: mc.revenue, cost: mc.cost, profit: mc.revenue - mc.cost };
    });
    var alcS = DB.alcItems.map(function(item) {
        var mc = invCalcMon(item, 'alc', m);
        return { item: item, revenue: mc.revenue, cost: mc.cost, profit: mc.revenue - mc.cost };
    });

    var teaRev = teaS.reduce(function(s, st) { return s + st.revenue; }, 0);
    var teaCost = teaS.reduce(function(s, st) { return s + st.cost; }, 0);
    var teaProfit = teaRev - teaCost;

    var cigRev = cigS.reduce(function(s, st) { return s + st.revenue; }, 0);
    var cigCost = cigS.reduce(function(s, st) { return s + st.cost; }, 0);
    var cigProfit = cigRev - cigCost;

    var alcRev = alcS.reduce(function(s, st) { return s + st.revenue; }, 0);
    var alcCost = alcS.reduce(function(s, st) { return s + st.cost; }, 0);
    var alcProfit = alcRev - alcCost;

    // ===== 采购汇总 =====
    var mPur = DB.purchases.filter(function(p) { return p.date.startsWith(m); });
    var purTotal = 0, retTotal = 0, purBySec = {};
    mPur.forEach(function(p) {
        p.items.forEach(function(item) {
            var src = item.source || p.source || '外购';
            var sec = item.section || '其他';
            if (src === '退货') {
                retTotal += item.total;
            } else {
                purTotal += item.total;
                if (!purBySec[sec]) purBySec[sec] = 0;
                purBySec[sec] += item.total;
            }
        });
    });
    var netPur = purTotal - retTotal;

    // ===== 费用汇总 =====
    var mExp = DB.expenses.filter(function(e) { return e.date.startsWith(m); });
    var expTotal = mExp.reduce(function(s, e) { return s + e.amount; }, 0);
    var expByCat = {};
    mExp.forEach(function(e) {
        if (!expByCat[e.category]) expByCat[e.category] = 0;
        expByCat[e.category] += e.amount;
    });

    // ===== 分区域成本 =====
    var kitCost = purBySec['厨房'] || 0;
    var barCost = purBySec['吧台'] || 0;
    var outCost = purBySec['外场'] || 0;
    var barNoTea = mBar - teaRev;
    if (barNoTea < 0) barNoTea = mBar;
    var otherCost = netPur - kitCost - barCost - outCost;
    if (otherCost < 0) otherCost = 0;

    // ===== 利润计算 =====
    var grossProfit = mNet - netPur;
    var grossMargin = mNet > 0 ? grossProfit / mNet * 100 : 0;
    var operProfit = grossProfit - expTotal;
    var operMargin = mNet > 0 ? operProfit / mNet * 100 : 0;

    // 分类毛利
    var barGP = barNoTea - barCost;
    var teaGP = teaProfit;
    var cigGP = cigProfit;
    var alcGP = alcProfit;
    var delGP = mDel;
    var kitGP = mKit - kitCost;
    if (kitGP < 0) kitGP = mKit * 0.5;
    var otherGP = mOther - otherCost;
    if (otherGP < 0) otherGP = mOther * 0.5;

    var avgSpend = mGuests > 0 ? mNet / mGuests : 0;
    var daysReported = mr.length || 1;
    var yy = m.split('-')[0];
    var mm = m.split('-')[1];

    // 页面标题
    h += '<div class="sec" style="text-align:center;margin-bottom:4px">';
    h += '<div style="font-size:1.2rem;font-weight:700;color:var(--ac);letter-spacing:.05em">' + (localStorage.getItem('ax_shop_name') || '经营管理') + '</div>';
    h += '<div style="font-size:.78rem;color:var(--tx-m);letter-spacing:.1em">FINANCIAL REPORT · ' + yy + '.' + mm + '</div>';
    h += '</div>';

    // 核心指标卡片
    h += '<div class="cards" style="margin-bottom:20px">';
    h += '<div class="card"><div class="card-l">总流水</div><div class="card-v ac">' + fmtC(mGross) + '</div></div>';
    h += '<div class="card"><div class="card-l">总实收</div><div class="card-v ac">' + fmtC(mNet) + '</div></div>';
    h += '<div class="card"><div class="card-l">总毛利</div><div class="card-v gn">' + fmtC(grossProfit) + '</div></div>';
    h += '<div class="card"><div class="card-l">毛利率</div><div class="card-v gn">' + grossMargin.toFixed(1) + '%</div></div>';
    h += '<div class="card"><div class="card-l">营业利润</div><div class="card-v ' + (operProfit >= 0 ? 'gn' : 'rd') + '">' + fmtC(operProfit) + '</div></div>';
    h += '<div class="card"><div class="card-l">到店人数</div><div class="card-v">' + mGuests + '</div></div>';
    h += '</div>';

    // 子标签导航栏
    h += '<div class="rep-nav" id="repNav" style="display:flex;gap:0;overflow-x:auto;margin-bottom:20px;background:var(--card);border:1px solid var(--bd);border-radius:var(--r);scrollbar-width:none"></div>';
    h += '<div id="repBody"></div>';

    setMain('财务报告', h);

    // 子标签配置
    var tabs = [
        { id: 'profit', label: '利润表' },
        { id: 'revenue', label: '营收总表' },
        { id: 'cost', label: '成本费用' },
        { id: 'catgp', label: '分类毛利' }
    ];
    if (cigRev > 0) tabs.push({ id: 'cig', label: '香烟' });
    if (teaRev > 0) tabs.push({ id: 'tea', label: '茗茶' });
    if (alcRev > 0) tabs.push({ id: 'alc', label: '酒类' });
    tabs.push({ id: 'daily', label: '每日营收' });
    tabs.push({ id: 'guest', label: '客情包厢' });

    // 渲染子标签按钮
    var navH = '';
    tabs.forEach(function(t, i) {
        navH += '<button class="rep-tab' + (i === 0 ? ' active' : '') + '" data-tab="' + t.id + '" ';
        navH += 'style="flex-shrink:0;padding:10px 16px;font-size:.76rem;color:var(--tx-m);';
        navH += 'background:none;border:none;border-bottom:2px solid transparent;';
        navH += 'cursor:pointer;transition:all .2s;white-space:nowrap">';
        navH += t.label + '</button>';
    });
    $id('repNav').innerHTML = navH;

    // 子标签切换逻辑
    function switchRepTab(id) {
        document.querySelectorAll('.rep-tab').forEach(function(b) {
            b.classList.toggle('active', b.dataset.tab === id);
            b.style.color = b.classList.contains('active') ? 'var(--ac)' : 'var(--tx-m)';
            b.style.borderBottomColor = b.classList.contains('active') ? 'var(--ac)' : 'transparent';
        });
        renderRepSection(id);
    }

    document.querySelectorAll('.rep-tab').forEach(function(b) {
        b.onclick = function() { switchRepTab(b.dataset.tab); };
    });

    // 渲染子标签内容（闭包可访问所有汇总变量）
    function renderRepSection(id) {
        var s = $id('repBody');
        if (!s) return;

        // 缓存数据给图表使用
        window._repData = {
            net: mNet, netPur: netPur, gp: grossProfit,
            expTotal: expTotal, op: operProfit,
            kit: mKit, bar: mBar, del: mDel,
            cig: cigRev, alc: alcRev, other: mOther,
            pos: mPos, ccb: mCcb, cash: mCash,
            member: mMember, ar: mAr,
            purBySec: purBySec, expByCat: expByCat,
            kitGP: kitGP, barGP: barGP, teaGP: teaGP,
            delGP: delGP, cigGP: cigGP, alcGP: alcGP,
            barNoTea: barNoTea, tea: teaRev,
            cigS: cigS, teaS: teaS, alcS: alcS,
            mr: mr
        };

        var sh = '';
        if (id === 'profit') {
            sh += renderProfitTable(mNet, mGross, mDiscount, kitCost, barCost, outCost, teaCost, cigCost, alcCost, otherCost, netPur, expTotal, expByCat, grossProfit, grossMargin, operProfit, operMargin);
        } else if (id === 'revenue') {
            sh += renderRevenueSection(mNet, mGross, mDiscount, mKit, mBar, mDel, mCigRev, alcRev, mOther, mPos, mCcb, mCash, mMember, mTreat, mAr, mDelMeituan, mDelTaobao, mDelJd);
        } else if (id === 'cost') {
            sh += renderCostSection(purBySec, netPur, kitCost, barCost, outCost, teaCost, cigCost, alcCost, expByCat, expTotal);
        } else if (id === 'catgp') {
            sh += renderCatGPSection(mKit, mBar, barNoTea, teaRev, mDel, mCigRev, alcRev, kitCost, barCost, teaCost, cigCost, alcCost, kitGP, barGP, teaGP, delGP, cigGP, alcGP);
        } else if (id === 'cig') {
            sh += renderCigSection(cigS, cigRev, cigCost, cigProfit, m);
        } else if (id === 'tea') {
            sh += renderTeaSection(teaS, teaRev, teaCost, teaProfit, m);
        } else if (id === 'alc') {
            sh += renderAlcSection(alcS, alcRev, alcCost, alcProfit, m);
        } else if (id === 'daily') {
            sh += renderDailySection(mr, mNet, mGuests, daysReported);
        } else if (id === 'guest') {
            sh += renderGuestSection(mr, mGuests, m);
        }

        s.innerHTML = sh;
        setTimeout(function() { initRepCharts(id); }, 100);
    }

    // 记住当前 tab，切换月份后保持在原 tab
    var lastRepTab = 'profit';
    var activeRepTab = document.querySelector('.rep-tab.active');
    if (activeRepTab) lastRepTab = activeRepTab.dataset.tab || 'profit';
    setTimeout(function() { switchRepTab(lastRepTab); }, 100);
}

// ==================== 利润表 ====================
function renderProfitTable(net, gross, discount, kitC, barC, outC, teaC, cigC, alcC, otherC, netPur, expTotal, expByCat, gp, gm, op, om) {
    var ym = $id('repM') ? $id('repM').value : curYM();
    var yy = ym.split('-')[0];
    var mm = parseInt(ym.split('-')[1]);

    // 利润表数据行
    var rows = [
        { l: '营业收入（实收）', v: net, n: '流水' + fmtC(gross) + ' 减折扣' + fmtC(discount) },
        { l: '减：营业成本', v: netPur, n: '净采购' },
        { l: '  厨房采购', v: kitC, n: '' },
        { l: '  吧台采购', v: barC, n: '' },
        { l: '  外场采购', v: outC, n: '' },
        { l: '  茗茶库存价值', v: teaC, n: '' },
        { l: '  香烟销售成本', v: cigC, n: '' },
        { l: '  酒类库存价值', v: alcC, n: '' }
    ];
    if (otherC > 0) rows.push({ l: '  其他采购', v: otherC, n: '' });
    rows.push({ l: '毛利', v: gp, n: '毛利率 ' + gm.toFixed(1) + '%' });
    rows.push({ l: '减：营业费用', v: expTotal, n: '' });
    Object.keys(expByCat).forEach(function(cat) { rows.push({ l: '  ' + cat, v: expByCat[cat], n: '' }); });
    rows.push({ l: '营业利润', v: op, n: '利润率 ' + om.toFixed(1) + '%' });

    // 标题摘要
    var h = '<div class="sec-head">';
    h += '<h4 style="font-size:.88rem;color:var(--ac);margin-bottom:6px">一、利润表</h4>';
    h += '<div style="font-size:.72rem;color:var(--tx-m);margin-bottom:14px">';
    h += mm + '月实现营收' + fmtC(net) + '元，营业成本' + fmtC(netPur) + '元，';
    h += '毛利' + fmtC(gp) + '元（' + gm.toFixed(1) + '%）。';
    h += '扣除费用' + fmtC(expTotal) + '元后，营业利润' + fmtC(op) + '元，利润率' + om.toFixed(1) + '%。';
    h += '</div></div>';

    // 图表 + 表格左右布局
    h += '<div class="rep-grid">';
    h += '<div class="tw" style="margin-bottom:0"><table>';
    h += '<tr><th>项目</th><th class="nr">金额（元）</th><th>备注</th></tr>';
    rows.forEach(function(r) {
        var isTotal = (r.l === '毛利' || r.l === '营业利润');
        h += '<tr' + (isTotal ? ' style="background:var(--card-h)"' : '') + '>';
        h += '<td' + (isTotal ? ' style="font-weight:600"' : '') + '>' + r.l + '</td>';
        h += '<td class="nr" style="' + (isTotal ? 'font-weight:600;color:' + (r.v >= 0 ? 'var(--gn)' : 'var(--rd)') : '') + '">' + fmtC(r.v) + '</td>';
        h += '<td style="font-size:.72rem;color:var(--tx-m)">' + r.n + '</td></tr>';
    });
    h += '</table></div>';
    h += '<div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:14px">';
    h += '<canvas id="repChart" height="220"></canvas></div>';
    h += '</div>';
    return h;
}

// ==================== 营收总表 ====================
function renderRevenueSection(net, gross, discount, kit, bar, del, cig, alc, other, pos, ccb, cash, member, treat, ar, delMt, delTb, delJd) {
    var total = net || 1;

    var h = '<div class="sec-head">';
    h += '<h4 style="font-size:.88rem;color:var(--ac);margin-bottom:6px">二、营收总表</h4>';
    h += '<div style="font-size:.72rem;color:var(--tx-m);margin-bottom:14px">';
    h += '总流水' + fmtC(gross) + '元，折扣' + fmtC(discount) + '元（' + (gross > 0 ? (discount / gross * 100).toFixed(1) : '0') + '%），实收' + fmtC(net) + '元。';
    h += '厨房' + (net > 0 ? (kit / net * 100).toFixed(1) : '0') + '%、';
    h += '吧台' + (net > 0 ? (bar / net * 100).toFixed(1) : '0') + '%、';
    h += '外卖' + (net > 0 ? (del / net * 100).toFixed(1) : '0') + '%。';
    h += '</div></div>';

    // 左右布局：左表格，右图表
    h += '<div class="rep-grid">';
    h += '<div>';
    // 收入分类表格
    h += '<div class="tw" style="margin-bottom:0"><table><tr><th>收入分类</th><th class="nr">金额（元）</th><th class="nr">占比</th></tr>';
    var items = [['厨房', kit], ['吧台（含茗茶）', bar], ['外卖', del], ['香烟', cig]];
    if (alc > 0) items.push(['酒类', alc]);
    items.push(['其他', other]);
    items.push(['合计', total]);
    items.forEach(function(it) {
        var pct = net > 0 ? (it[1] / total * 100).toFixed(1) : '0';
        var isTotal = it[0] === '合计';
        h += '<tr' + (isTotal ? ' style="background:var(--card-h)"' : '') + '>';
        h += '<td' + (isTotal ? ' style="font-weight:600"' : '') + '>' + it[0] + '</td>';
        h += '<td class="nr"' + (isTotal ? ' style="font-weight:600"' : '') + '>' + fmtC(it[1]) + '</td>';
        h += '<td class="nr">' + pct + '%</td></tr>';
    });
    h += '</table></div>';
    // 支付渠道表格
    h += '<div style="font-size:.82rem;font-weight:600;color:var(--ac);margin:14px 0 6px">支付渠道</div>';
    var payTotal = pos + ccb + cash + member + treat + del + ar;
    h += '<div class="tw" style="margin-bottom:0"><table><tr><th>渠道</th><th class="nr">金额（元）</th><th class="nr">占比</th></tr>';
    var payItems = [['智能POS机', pos], ['建行生活', ccb], ['现金', cash], ['会员刷卡', member], ['招待', treat], ['外卖', del], ['应收账款', ar], ['合计', payTotal]];
    payItems.forEach(function(it) {
        var pct = payTotal > 0 ? (it[1] / payTotal * 100).toFixed(1) : '0';
        var isTotal = it[0] === '合计';
        h += '<tr' + (isTotal ? ' style="background:var(--card-h)"' : '') + '>';
        h += '<td' + (isTotal ? ' style="font-weight:600"' : '') + '>' + it[0] + '</td>';
        h += '<td class="nr"' + (isTotal ? ' style="font-weight:600"' : '') + '>' + fmtC(it[1]) + '</td>';
        h += '<td class="nr">' + pct + '%</td></tr>';
    });
    h += '</table></div>';
    h += '</div>';
    // 右侧图表
    h += '<div><div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:10px;margin-bottom:8px"><canvas id="repChart1" height="150"></canvas></div>';
    h += '<div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:10px"><canvas id="repChart2" height="150"></canvas></div></div>';
    h += '</div>';
    return h;
}

// ==================== 成本费用明细 ====================
function renderCostSection(purBySec, netPur, kitC, barC, outC, teaC, cigC, alcC, expByCat, expTotal) {
    var total = netPur + expTotal;

    var h = '<div class="sec-head">';
    h += '<h4 style="font-size:.88rem;color:var(--ac);margin-bottom:6px">三、成本费用明细</h4>';
    h += '<div style="font-size:.72rem;color:var(--tx-m);margin-bottom:14px">';
    h += '采购总成本' + fmtC(netPur) + '元，费用' + fmtC(expTotal) + '元，合计' + fmtC(total) + '元。';
    h += '</div></div>';

    h += '<div class="rep-grid">';
    h += '<div class="tw" style="margin-bottom:0"><table><tr><th>费用归属</th><th class="nr">金额（元）</th><th class="nr">占比</th></tr>';
    var items = [['厨房采购', kitC], ['吧台采购', barC], ['外场采购', outC], ['茗茶成本', teaC], ['香烟成本', cigC]];
    if (alcC > 0) items.push(['酒类成本', alcC]);
    Object.keys(expByCat).forEach(function(cat) { items.push([cat, expByCat[cat]]); });
    items.push(['合计', total]);
    items.forEach(function(it) {
        var pct = total > 0 ? (it[1] / total * 100).toFixed(1) : '0';
        var isTotal = it[0] === '合计';
        h += '<tr' + (isTotal ? ' style="background:var(--card-h)"' : '') + '>';
        h += '<td' + (isTotal ? ' style="font-weight:600"' : '') + '>' + it[0] + '</td>';
        h += '<td class="nr"' + (isTotal ? ' style="font-weight:600"' : '') + '>' + fmtC(it[1]) + '</td>';
        h += '<td class="nr">' + pct + '%</td></tr>';
    });
    h += '</table></div>';
    h += '<div><div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:10px;margin-bottom:8px"><canvas id="repChart" height="150"></canvas></div>';
    h += '<div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:10px"><canvas id="repChart2" height="150"></canvas></div></div>';
    h += '</div>';
    return h;
}

// ==================== 分类毛利分析 ====================
function renderCatGPSection(kit, bar, barNoTea, tea, del, cig, alc, kitC, barC, teaC, cigC, alcC, kitGP, barGP, teaGP, delGP, cigGP, alcGP) {
    var totalRev = kit + bar + del + cig + alc;
    var totalGP = kitGP + barGP + teaGP + delGP + cigGP + alcGP;

    var h = '<div class="sec-head">';
    h += '<h4 style="font-size:.88rem;color:var(--ac);margin-bottom:6px">四、分类毛利分析</h4>';
    h += '<div style="font-size:.72rem;color:var(--tx-m);margin-bottom:14px">';
    h += '厨房毛利' + fmtC(kitGP) + '元，吧台' + fmtC(barGP) + '元，茗茶' + fmtC(teaGP) + '元（最高），';
    h += '外卖' + fmtC(delGP) + '元，香烟' + fmtC(cigGP) + '元。总毛利' + fmtC(totalGP) + '元。';
    h += '</div></div>';

    h += '<div class="rep-grid">';
    h += '<div class="tw" style="margin-bottom:0"><table><tr><th>类别</th><th class="nr">收入</th><th class="nr">成本</th><th class="nr">毛利</th><th class="nr">毛利率</th></tr>';
    var items = [['厨房', kit, kitC, kitGP], ['吧台（不含茗茶）', barNoTea, barC, barGP], ['茗茶', tea, teaC, teaGP], ['外卖', del, 0, delGP], ['香烟', cig, cigC, cigGP]];
    if (alc > 0) items.push(['酒类', alc, alcC, alcGP]);
    items.push(['合计', totalRev, totalRev - totalGP, totalGP]);
    items.forEach(function(it) {
        var margin = it[1] > 0 ? (it[3] / it[1] * 100).toFixed(1) : '0';
        var isTotal = it[0] === '合计';
        h += '<tr' + (isTotal ? ' style="background:var(--card-h)"' : '') + '>';
        h += '<td' + (isTotal ? ' style="font-weight:600"' : '') + '>' + it[0] + '</td>';
        h += '<td class="nr">' + fmtC(it[1]) + '</td>';
        h += '<td class="nr">' + fmtC(it[2]) + '</td>';
        h += '<td class="nr" style="color:' + (it[3] >= 0 ? 'var(--gn)' : 'var(--rd)') + ';font-weight:600">' + fmtC(it[3]) + '</td>';
        h += '<td class="nr">' + margin + '%</td></tr>';
    });
    h += '</table></div>';
    h += '<div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:14px">';
    h += '<canvas id="repChart" height="280"></canvas></div>';
    h += '</div>';
    return h;
}

// ==================== 香烟报表 ====================
function renderCigSection(stats, rev, cost, profit, ym) {
    var totalSold = stats.reduce(function(s, st) {
        return s + st.item.sales.filter(function(ss) { return ss.date.startsWith(ym); }).reduce(function(a, ss) { return a + (ss.qty || 0); }, 0);
    }, 0);

    var h = '<div class="sec-head">';
    h += '<h4 style="font-size:.88rem;color:var(--ac);margin-bottom:6px">五、香烟进销存及毛利</h4>';
    h += '<div style="font-size:.72rem;color:var(--tx-m);margin-bottom:14px">';
    h += '本月销售' + totalSold + '包，销售额' + fmtC(rev) + '元，成本' + fmtC(cost) + '元，';
    h += '毛利' + fmtC(profit) + '元（' + (rev > 0 ? (profit / rev * 100).toFixed(1) : '0') + '%）。';
    h += '</div></div>';

    h += '<div class="rep-grid">';
    h += '<div class="tw" style="margin-bottom:0"><table>';
    h += '<tr><th>品名</th><th class="nr">期初</th><th class="nr">入库</th><th class="nr">销售</th><th class="nr">结存</th><th class="nr">销售额</th><th class="nr">成本</th><th class="nr">毛利</th><th class="nr">毛利率</th></tr>';

    stats.forEach(function(st) {
        var item = st.item;
        var c = invCalc(item, 'cig');
        var purch = 0, sold = 0;
        item.purchases.filter(function(p) { return p.date.startsWith(ym); }).forEach(function(p) {
            if (p.qty > 0) purch += p.qty; else sold += Math.abs(p.qty);
        });
        item.sales.filter(function(s) { return s.date.startsWith(ym); }).forEach(function(s) { sold += s.qty || 0; });
        var opening = parseInt(item.openingStock || 0);
        var margin = st.revenue > 0 ? (st.profit / st.revenue * 100).toFixed(1) : '0';

        h += '<tr><td>' + item.name + '</td>';
        h += '<td class="nr">' + opening + '</td>';
        h += '<td class="nr">' + purch + '</td>';
        h += '<td class="nr">' + sold + '</td>';
        h += '<td class="nr">' + c.stock + '</td>';
        h += '<td class="nr">' + fmtC(st.revenue) + '</td>';
        h += '<td class="nr">' + fmtC(st.cost) + '</td>';
        h += '<td class="nr" style="color:' + (st.profit >= 0 ? 'var(--gn)' : 'var(--rd)') + '">' + fmtC(st.profit) + '</td>';
        h += '<td class="nr">' + margin + '%</td></tr>';
    });

    h += '<tr style="background:var(--card-h)"><td style="font-weight:600">合计</td><td></td><td></td><td></td><td></td>';
    h += '<td class="nr" style="font-weight:600">' + fmtC(rev) + '</td>';
    h += '<td class="nr" style="font-weight:600">' + fmtC(cost) + '</td>';
    h += '<td class="nr" style="font-weight:600;color:' + (profit >= 0 ? 'var(--gn)' : 'var(--rd)') + '">' + fmtC(profit) + '</td>';
    h += '<td class="nr" style="font-weight:600">' + (rev > 0 ? (profit / rev * 100).toFixed(1) : '0') + '%</td></tr>';
    h += '</table></div>';
    h += '<div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:14px">';
    h += '<canvas id="repChart" height="220"></canvas></div>';
    h += '</div>';
    return h;
}

// ==================== 茗茶报表 ====================
function renderTeaSection(stats, rev, cost, profit, ym) {
    var totalCups = 0, totalPots = 0;
    stats.forEach(function(st) {
        st.item.sales.filter(function(s) { return s.date.startsWith(ym); }).forEach(function(s) {
            totalCups += (s.cups || 0); totalPots += (s.pots || 0);
        });
    });

    var h = '<div class="sec-head">';
    h += '<h4 style="font-size:.88rem;color:var(--ac);margin-bottom:6px">六、茗茶进销存及毛利</h4>';
    h += '<div style="font-size:.72rem;color:var(--tx-m);margin-bottom:14px">';
    h += '本月销售' + totalCups + '杯+' + totalPots + '壶，实收' + fmtC(rev) + '元，';
    h += '库存价值' + fmtC(cost) + '元，毛利' + fmtC(profit) + '元（' + (rev > 0 ? (profit / rev * 100).toFixed(1) : '0') + '%）。';
    h += '</div></div>';

    h += '<div class="rep-grid">';
    h += '<div class="tw" style="margin-bottom:0"><table><tr><th>茶品</th><th class="nr">杯</th><th class="nr">壶</th><th class="nr">实收</th><th class="nr">成本</th><th class="nr">毛利</th><th class="nr">毛利率</th></tr>';
    stats.forEach(function(st) {
        var cups = 0, pots = 0;
        st.item.sales.filter(function(s) { return s.date.startsWith(ym); }).forEach(function(s) { cups += (s.cups || 0); pots += (s.pots || 0); });
        var margin = st.revenue > 0 ? (st.profit / st.revenue * 100).toFixed(1) : '0';
        h += '<tr><td>' + st.item.name + '</td>';
        h += '<td class="nr">' + cups + '</td><td class="nr">' + pots + '</td>';
        h += '<td class="nr">' + fmtC(st.revenue) + '</td><td class="nr">' + fmtC(st.cost) + '</td>';
        h += '<td class="nr" style="color:' + (st.profit >= 0 ? 'var(--gn)' : 'var(--rd)') + '">' + fmtC(st.profit) + '</td>';
        h += '<td class="nr">' + margin + '%</td></tr>';
    });
    h += '<tr style="background:var(--card-h)"><td style="font-weight:600">合计</td>';
    h += '<td class="nr" style="font-weight:600">' + totalCups + '</td>';
    h += '<td class="nr" style="font-weight:600">' + totalPots + '</td>';
    h += '<td class="nr" style="font-weight:600">' + fmtC(rev) + '</td>';
    h += '<td class="nr" style="font-weight:600">' + fmtC(cost) + '</td>';
    h += '<td class="nr" style="font-weight:600;color:' + (profit >= 0 ? 'var(--gn)' : 'var(--rd)') + '">' + fmtC(profit) + '</td>';
    h += '<td class="nr" style="font-weight:600">' + (rev > 0 ? (profit / rev * 100).toFixed(1) : '0') + '%</td></tr>';
    h += '</table></div>';
    h += '<div><div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:10px;margin-bottom:8px"><canvas id="repChart1" height="150"></canvas></div>';
    h += '<div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:10px"><canvas id="repChart2" height="150"></canvas></div></div>';
    h += '</div>';
    return h;
}

// ==================== 酒类报表 ====================
function renderAlcSection(stats, rev, cost, profit, ym) {
    var totalQty = 0;
    stats.forEach(function(st) {
        st.item.sales.filter(function(s) { return s.date.startsWith(ym); }).forEach(function(s) { totalQty += (s.qty || 0); });
    });

    var h = '<div class="sec-head">';
    h += '<h4 style="font-size:.88rem;color:var(--ac);margin-bottom:6px">七、酒类进销存及毛利</h4>';
    h += '<div style="font-size:.72rem;color:var(--tx-m);margin-bottom:14px">';
    h += '本月销售' + totalQty + '瓶，销售额' + fmtC(rev) + '元，成本' + fmtC(cost) + '元，';
    h += '毛利' + fmtC(profit) + '元（' + (rev > 0 ? (profit / rev * 100).toFixed(1) : '0') + '%）。';
    h += '</div></div>';

    h += '<div class="rep-grid">';
    h += '<div class="tw" style="margin-bottom:0"><table>';
    h += '<tr><th>品名</th><th class="nr">期初</th><th class="nr">入库</th><th class="nr">销售</th><th class="nr">结存</th><th class="nr">销售额</th><th class="nr">成本</th><th class="nr">毛利</th><th class="nr">毛利率</th></tr>';

    stats.forEach(function(st) {
        var item = st.item;
        var c = invCalc(item, 'alc');
        var purch = 0, sold = 0;
        item.purchases.filter(function(p) { return p.date.startsWith(ym); }).forEach(function(p) {
            if (p.qty > 0) purch += p.qty; else sold += Math.abs(p.qty);
        });
        item.sales.filter(function(s) { return s.date.startsWith(ym); }).forEach(function(s) { sold += s.qty || 0; });
        var margin = st.revenue > 0 ? (st.profit / st.revenue * 100).toFixed(1) : '0';

        h += '<tr><td>' + item.name + '</td>';
        h += '<td class="nr">' + parseInt(item.openingStock || 0) + '</td>';
        h += '<td class="nr">' + purch + '</td>';
        h += '<td class="nr">' + sold + '</td>';
        h += '<td class="nr">' + c.stock + '</td>';
        h += '<td class="nr">' + fmtC(st.revenue) + '</td>';
        h += '<td class="nr">' + fmtC(st.cost) + '</td>';
        h += '<td class="nr" style="color:' + (st.profit >= 0 ? 'var(--gn)' : 'var(--rd)') + '">' + fmtC(st.profit) + '</td>';
        h += '<td class="nr">' + margin + '%</td></tr>';
    });

    h += '<tr style="background:var(--card-h)"><td style="font-weight:600">合计</td><td></td><td></td><td></td><td></td>';
    h += '<td class="nr" style="font-weight:600">' + fmtC(rev) + '</td>';
    h += '<td class="nr" style="font-weight:600">' + fmtC(cost) + '</td>';
    h += '<td class="nr" style="font-weight:600;color:' + (profit >= 0 ? 'var(--gn)' : 'var(--rd)') + '">' + fmtC(profit) + '</td>';
    h += '<td class="nr" style="font-weight:600">' + (rev > 0 ? (profit / rev * 100).toFixed(1) : '0') + '%</td></tr>';
    h += '</table></div>';
    h += '<div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:14px">';
    h += '<canvas id="repChart" height="200"></canvas></div>';
    h += '</div>';
    return h;
}

// ==================== 每日营收 ====================
function renderDailySection(mr, net, guests, days) {
    var avgNet = days > 0 ? net / days : 0;
    var avgGuests = days > 0 ? guests / days : 0;

    var h = '<div class="sec-head">';
    h += '<h4 style="font-size:.88rem;color:var(--ac);margin-bottom:6px">八、每日营收速览</h4>';
    h += '<div style="font-size:.72rem;color:var(--tx-m);margin-bottom:14px">';
    h += '日均实收' + fmtC(avgNet) + '元，日均客流' + avgGuests.toFixed(1) + '人，月均人均' + (guests > 0 ? (net / guests).toFixed(2) : '0') + '元。';
    h += '</div></div>';

    h += '<div class="rep-grid rep-grid-wide">';
    h += '<div class="tw" style="margin-bottom:0"><table><tr><th>日期</th><th class="nr">流水</th><th class="nr">折扣</th><th class="nr">实收</th><th class="nr">人数</th><th class="nr">人均</th></tr>';
    var sorted = mr.slice().sort(function(a, b) { return a.date.localeCompare(b.date); });
    sorted.forEach(function(r) {
        var d = parseInt(r.date.split('-')[2]);
        var ppg = r.guest.count > 0 ? (r.revenue.netSales / r.guest.count).toFixed(2) : '-';
        h += '<tr><td>' + d + '日</td>';
        h += '<td class="nr">' + fmtC(r.revenue.grossSales || 0) + '</td>';
        h += '<td class="nr">' + fmtC(r.revenue.discount || 0) + '</td>';
        h += '<td class="nr">' + fmtC(r.revenue.netSales || 0) + '</td>';
        h += '<td class="nr">' + (r.guest.count || 0) + '</td>';
        h += '<td class="nr">' + ppg + '</td></tr>';
    });
    h += '<tr style="background:var(--card-h)"><td style="font-weight:600">合计</td>';
    h += '<td class="nr" style="font-weight:600">' + fmtC(mr.reduce(function(s, r) { return s + (r.revenue.grossSales || 0); }, 0)) + '</td>';
    h += '<td class="nr" style="font-weight:600">' + fmtC(mr.reduce(function(s, r) { return s + (r.revenue.discount || 0); }, 0)) + '</td>';
    h += '<td class="nr" style="font-weight:600">' + fmtC(net) + '</td>';
    h += '<td class="nr" style="font-weight:600">' + guests + '</td>';
    h += '<td class="nr" style="font-weight:600">' + (guests > 0 ? (net / guests).toFixed(2) : '-') + '</td></tr>';
    h += '</table></div>';
    h += '<div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:14px">';
    h += '<canvas id="repChart" height="280"></canvas></div>';
    h += '</div>';
    return h;
}

// ==================== 客情包厢 ====================
function renderGuestSection(mr, guests, ym) {
    var h = '<div class="sec-head">';
    h += '<h4 style="font-size:.88rem;color:var(--ac);margin-bottom:6px">九、客情与包厢</h4>';
    h += '<div style="font-size:.72rem;color:var(--tx-m);margin-bottom:14px">';
    h += '累计到店' + guests + '人，日均' + (mr.length > 0 ? (guests / mr.length).toFixed(1) : '0') + '人。';
    h += '500元以上包厢累计' + mr.reduce(function(s, r) { return s + (r.guest.premiumRoomsToday || 0); }, 0) + '个。';
    h += '</div></div>';

    h += '<div class="rep-grid rep-grid-wide">';
    h += '<div class="tw" style="margin-bottom:0"><table><tr><th>日期</th><th class="nr">客流</th><th class="nr">人均</th><th class="nr">500+包厢</th></tr>';
    var sorted = mr.slice().sort(function(a, b) { return a.date.localeCompare(b.date); });
    sorted.forEach(function(r) {
        var d = parseInt(r.date.split('-')[2]);
        var ppg = r.guest.count > 0 ? (r.revenue.netSales / r.guest.count).toFixed(2) : '-';
        h += '<tr><td>' + d + '日</td>';
        h += '<td class="nr">' + (r.guest.count || 0) + '</td>';
        h += '<td class="nr">' + ppg + '</td>';
        h += '<td class="nr">' + (r.guest.premiumRoomsToday || 0) + '</td></tr>';
    });
    h += '<tr style="background:var(--card-h)"><td style="font-weight:600">合计</td>';
    h += '<td class="nr" style="font-weight:600">' + guests + '</td>';
    h += '<td class="nr" style="font-weight:600">' + (guests > 0 ? (mr.reduce(function(s, r) { return s + (r.revenue.netSales || 0); }, 0) / guests).toFixed(2) : '-') + '</td>';
    h += '<td class="nr" style="font-weight:600">' + mr.reduce(function(s, r) { return s + (r.guest.premiumRoomsToday || 0); }, 0) + '</td></tr>';
    h += '</table></div>';
    h += '<div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:14px">';
    h += '<canvas id="repChart" height="280"></canvas></div>';
    h += '</div>';
    return h;
}

// ==================== 图表初始化 ====================
function initRepCharts(id) {
    if (typeof Chart === 'undefined') return;

    var bgc = ['rgba(201,168,76,.7)', 'rgba(52,211,153,.7)', 'rgba(96,165,250,.7)', 'rgba(167,139,250,.7)', 'rgba(251,146,60,.7)', 'rgba(45,212,191,.7)', 'rgba(248,113,113,.7)'];
    Chart.defaults.color = '#7a7570';
    Chart.defaults.font.family = "'DM Mono',monospace";
    Chart.defaults.plugins.tooltip.backgroundColor = '#1e2130';
    Chart.defaults.plugins.tooltip.borderColor = '#2d3041';
    Chart.defaults.plugins.tooltip.borderWidth = 1;
    Chart.defaults.plugins.tooltip.padding = 10;
    Chart.defaults.plugins.tooltip.cornerRadius = 6;

    var D = window._repData || {};

    var _repCharts = {};
    function AC(el, type, data, opt) {
        var c = document.getElementById(el);
        if (!c) return;
        if (_repCharts[el]) { _repCharts[el].destroy(); }
        _repCharts[el] = new Chart(c, { type: type, data: data, options: opt });
    }

    // 利润表柱状图
    if (id === 'profit') {
        AC('repChart', 'bar', {
            labels: ['营业收入', '营业成本', '毛利', '营业费用', '营业利润'],
            datasets: [{ data: [D.net || 0, D.netPur || 0, D.gp || 0, D.expTotal || 0, D.op || 0], backgroundColor: ['#34d399', '#f87171', '#c9a84c', '#f87171', '#34d399'], borderRadius: 4 }]
        }, { responsive: true, maintainAspectRatio: true, aspectRatio: 3, plugins: { legend: { display: false } }, scales: { y: { grid: { color: 'rgba(45,48,65,.3)' }, ticks: { callback: function(v) { return (v / 10000).toFixed(1) + '万'; } } }, x: { grid: { display: false } } } });
    }

    // 营收总表双饼图
    else if (id === 'revenue') {
        AC('repChart1', 'doughnut', {
            labels: ['厨房', '吧台', '外卖', '香烟', '其他'],
            datasets: [{ data: [D.kit || 0, D.bar || 0, D.del || 0, D.cig || 0, D.other || 0], backgroundColor: bgc, borderWidth: 0, hoverOffset: 6 }]
        }, { responsive: true, maintainAspectRatio: true, aspectRatio: 1.5, cutout: '58%', plugins: { title: { display: true, text: '收入分类', font: { size: 12 } }, legend: { position: 'bottom', labels: { font: { size: 9 }, padding: 8 } } } });
        AC('repChart2', 'doughnut', {
            labels: ['POS机', '建行', '现金', '会员', '外卖', '应收'],
            datasets: [{ data: [D.pos || 0, D.ccb || 0, D.cash || 0, D.member || 0, D.del || 0, D.ar || 0], backgroundColor: bgc, borderWidth: 0, hoverOffset: 6 }]
        }, { responsive: true, maintainAspectRatio: true, aspectRatio: 1.5, cutout: '58%', plugins: { title: { display: true, text: '支付渠道', font: { size: 12 } }, legend: { position: 'bottom', labels: { font: { size: 9 }, padding: 8 } } } });
    }

    // 成本费用图表
    else if (id === 'cost') {
        var purItems = [];
        Object.keys(D.purBySec || {}).forEach(function(k) { purItems.push([k, D.purBySec[k]]); });
        var expItems = [];
        Object.keys(D.expByCat || {}).forEach(function(k) { expItems.push([k, D.expByCat[k]]); });
        AC('repChart', 'bar', {
            labels: purItems.map(function(i) { return i[0]; }),
            datasets: [{ data: purItems.map(function(i) { return i[1]; }), backgroundColor: bgc, borderRadius: 4 }]
        }, { indexAxis: 'y', responsive: true, maintainAspectRatio: true, aspectRatio: 2, plugins: { title: { display: true, text: '采购成本', font: { size: 12 } }, legend: { display: false } }, scales: { x: { grid: { color: 'rgba(45,48,65,.3)' } }, y: { grid: { display: false } } } });
        if (expItems.length) {
            AC('repChart2', 'doughnut', {
                labels: expItems.map(function(i) { return i[0]; }),
                datasets: [{ data: expItems.map(function(i) { return i[1]; }), backgroundColor: bgc, borderWidth: 0 }]
            }, { responsive: true, maintainAspectRatio: true, aspectRatio: 1.5, cutout: '55%', plugins: { title: { display: true, text: '费用构成', font: { size: 12 } }, legend: { position: 'bottom', labels: { font: { size: 9 }, padding: 8 } } } });
        }
    }

    // 分类毛利图表
    else if (id === 'catgp') {
        AC('repChart', 'bar', {
            labels: ['厨房', '吧台', '茗茶', '外卖', '香烟', '酒类'],
            datasets: [
                { label: '收入', data: [D.kit || 0, D.barNoTea || 0, D.tea || 0, D.del || 0, D.cig || 0, D.alc || 0], backgroundColor: 'rgba(201,168,76,.25)', borderColor: '#c9a84c', borderWidth: 1, borderRadius: 4 },
                { label: '毛利', data: [D.kitGP || 0, D.barGP || 0, D.teaGP || 0, D.delGP || 0, D.cigGP || 0, D.alcGP || 0], backgroundColor: 'rgba(52,211,153,.6)', borderColor: '#34d399', borderWidth: 1, borderRadius: 4 }
            ]
        }, { responsive: true, maintainAspectRatio: true, aspectRatio: 2.5, scales: { y: { grid: { color: 'rgba(45,48,65,.3)' }, ticks: { callback: function(v) { return (v / 10000).toFixed(1) + '万'; } } }, x: { grid: { display: false } } } });
    }

    // 香烟/酒类图表
    else if (id === 'cig' || id === 'alc') {
        var stats = id === 'cig' ? D.cigS : D.alcS;
        if (stats && stats.length) {
            AC('repChart', 'bar', {
                labels: stats.map(function(s) { return s.item.name; }),
                datasets: [
                    { label: '销售额', data: stats.map(function(s) { return s.revenue; }), backgroundColor: 'rgba(201,168,76,.7)', borderRadius: 4 },
                    { label: '成本', data: stats.map(function(s) { return s.cost; }), backgroundColor: 'rgba(248,113,113,.5)', borderRadius: 4 },
                    { label: '毛利', data: stats.map(function(s) { return s.profit; }), backgroundColor: 'rgba(52,211,153,.6)', borderRadius: 4 }
                ]
            }, { responsive: true, maintainAspectRatio: true, aspectRatio: 2.5, scales: { y: { grid: { color: 'rgba(45,48,65,.3)' } }, x: { grid: { display: false } } } });
        }
    }

    // 茗茶图表
    else if (id === 'tea') {
        var stats = D.teaS;
        if (stats && stats.length) {
            AC('repChart1', 'bar', {
                labels: stats.map(function(s) { return s.item.name; }),
                datasets: [{ label: '实收', data: stats.map(function(s) { return s.revenue; }), backgroundColor: 'rgba(201,168,76,.6)', borderRadius: 4 }]
            }, { indexAxis: 'y', responsive: true, maintainAspectRatio: true, aspectRatio: 2, plugins: { title: { display: true, text: '茗茶销售额', font: { size: 12 } }, legend: { display: false } }, scales: { x: { grid: { color: 'rgba(45,48,65,.3)' } }, y: { grid: { display: false } } } });
            AC('repChart2', 'doughnut', {
                labels: stats.map(function(s) { return s.item.name; }),
                datasets: [{ data: stats.map(function(s) { return s.cost; }), backgroundColor: bgc, borderWidth: 0 }]
            }, { responsive: true, maintainAspectRatio: true, aspectRatio: 1.5, cutout: '55%', plugins: { title: { display: true, text: '成本占比', font: { size: 12 } }, legend: { position: 'bottom', labels: { font: { size: 9 }, padding: 8 } } } });
        }
    }

    // 每日营收/客情图表
    else if (id === 'daily' || id === 'guest') {
        var sorted = (D.mr || []).slice().sort(function(a, b) { return a.date.localeCompare(b.date); });
        var labels = sorted.map(function(r) { return parseInt(r.date.split('-')[2]) + '日'; });
        var dRev = sorted.map(function(r) { return r.revenue.netSales || 0; });
        var dPpl = sorted.map(function(r) { return r.guest.count || 0; });
        var dRoom = sorted.map(function(r) { return r.guest.premiumRoomsToday || 0; });

        if (id === 'daily') {
            AC('repChart', 'bar', {
                labels: labels,
                datasets: [
                    { type: 'line', label: '实收', data: dRev, borderColor: '#c9a84c', backgroundColor: 'rgba(201,168,76,.08)', fill: true, pointRadius: 3, tension: 0.3, yAxisID: 'y' },
                    { label: '客流', data: dPpl, backgroundColor: 'rgba(96,165,250,.4)', borderRadius: 3, yAxisID: 'y1' }
                ]
            }, { responsive: true, maintainAspectRatio: true, aspectRatio: 2.5, interaction: { mode: 'index', intersect: false }, scales: { y: { position: 'left', grid: { color: 'rgba(45,48,65,.3)' }, title: { display: true, text: '实收', color: '#c9a84c', font: { size: 10 } }, ticks: { callback: function(v) { return (v / 10000).toFixed(1) + '万'; } } }, y1: { position: 'right', grid: { drawOnChartArea: false }, title: { display: true, text: '客流', color: '#60a5fa', font: { size: 10 } }, min: 0 }, x: { grid: { display: false }, ticks: { font: { size: 9 } } } } });
        } else {
            AC('repChart', 'bar', {
                labels: labels,
                datasets: [
                    { label: '客流', data: dPpl, backgroundColor: 'rgba(96,165,250,.6)', borderRadius: 3 },
                    { label: '包厢', data: dRoom, backgroundColor: 'rgba(201,168,76,.6)', borderRadius: 3 }
                ]
            }, { responsive: true, maintainAspectRatio: true, aspectRatio: 2.5, scales: { y: { grid: { color: 'rgba(45,48,65,.3)' } }, x: { grid: { display: false }, ticks: { font: { size: 9 } } } } });
        }
    }
}



// 报告月份切换
function reportCalNav(dir) {
    var picker = document.getElementById('repM');
    var currentYM = picker ? picker.value : curYM();
    calendarNav(dir, currentYM, 'repM', function(ym) {
        rReport();
    });
}

// 报告月份选择
function reportCalPickYM(val) {
    calendarPickYM(val, function(ym) {
        rReport();
    });
}
