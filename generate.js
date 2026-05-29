// generate.js - 汇报

// ==================== 14. 汇报 ====================

function rGen() {
    var h = '<div class="hrow"><label>月份</label>';
    h += '<input class="inp" id="genM" type="text" readonly placeholder="选择月份" value="' + curYM() + '" onclick="_mpOpen(\'genM\')" style="max-width:180px;cursor:pointer"></div>';

    h += '<div class="sec">选择报告周期</div>';
    h += '<div class="cards" style="grid-template-columns:repeat(3,1fr);margin-bottom:20px">';
    h += '<div class="card" style="cursor:pointer;text-align:center" onclick="doGen(\'first\')">';
    h += '<div style="font-size:1.2rem;margin-bottom:4px">📅</div>';
    h += '<div class="card-v" style="font-size:.84rem">上半月</div>';
    h += '<div class="card-l">1-15日</div></div>';
    h += '<div class="card" style="cursor:pointer;text-align:center" onclick="doGen(\'second\')">';
    h += '<div style="font-size:1.2rem;margin-bottom:4px">📅</div>';
    h += '<div class="card-v" style="font-size:.84rem">下半月</div>';
    h += '<div class="card-l">16-月末</div></div>';
    h += '<div class="card" style="cursor:pointer;text-align:center" onclick="doGen(\'month\')">';
    h += '<div style="font-size:1.2rem;margin-bottom:4px">📊</div>';
    h += '<div class="card-v" style="font-size:.84rem">月度</div>';
    h += '<div class="card-l">全月汇总</div></div>';
    h += '</div>';

    h += '<div class="sec">自定义周期</div>';
    h += '<div class="hrow">';
    h += '<label>开始</label><input class="inp" id="genStart" type="text" readonly placeholder="选择日期" onclick="_dpOpen(\'genStart\')" style="max-width:150px;cursor:pointer">';
    h += '<label>结束</label><input class="inp" id="genEnd" type="text" readonly placeholder="选择日期" onclick="_dpOpen(\'genEnd\')" style="max-width:150px;cursor:pointer">';
    h += '<button class="btn p" onclick="doGen(\'custom\')">生成</button>';
    h += '</div>';

    setMain('汇报', h);
}

function doGen(period) {
    var m = ($id('genM') || {}).value || curYM();
    var sd = 1, ed = 31;
    var title = m.replace('-', '年') + '月';

    if (period === 'first') {
        ed = 15;
        title += '上半月';
    } else if (period === 'second') {
        sd = 16;
        title += '下半月';
    } else if (period === 'custom') {
        var startVal = $id('genStart').value;
        var endVal = $id('genEnd').value;
        if (!startVal || !endVal) { toast('请选择起止日期'); return; }
        sd = parseInt(startVal.split('-')[2]);
        ed = parseInt(endVal.split('-')[2]);
        title = startVal.replace(/-/g, '/') + ' - ' + endVal.replace(/-/g, '/');
    } else {
        title += '月度';
    }
    title += '经营报告';

    var mr = getMR(m).filter(function(r) {
        var d = parseInt(r.date.split('-')[2]);
        return d >= sd && d <= ed;
    });

    var days = mr.length || 1;
    var mNet = mr.reduce(function(s, r) { return s + (r.revenue.netSales || 0); }, 0);
    var mGross = mr.reduce(function(s, r) { return s + (r.revenue.grossSales || 0); }, 0);
    var mDiscount = mr.reduce(function(s, r) { return s + (r.revenue.discount || 0); }, 0);
    var mKit = mr.reduce(function(s, r) { return s + (r.revenue.kitchenSales || 0); }, 0);
    var mBar = mr.reduce(function(s, r) { return s + (r.revenue.barSales || 0); }, 0);
    var mDel = mr.reduce(function(s, r) { return s + (r.delivery.total || 0); }, 0);
    var mCig = mr.reduce(function(s, r) { return s + (r.revenue.cigarette.total || 0); }, 0);
    var mOther = mr.reduce(function(s, r) { return s + (r.revenue.other || 0); }, 0);
    var mGuests = mr.reduce(function(s, r) { return s + (r.guest.count || 0); }, 0);
    var mPos = mr.reduce(function(s, r) { return s + (r.payment.pos || 0); }, 0);
    var mCcb = mr.reduce(function(s, r) { return s + (r.payment.ccbLife || 0); }, 0);
    var mCash = mr.reduce(function(s, r) { return s + (r.payment.cash || 0); }, 0);
    var mMember = mr.reduce(function(s, r) { return s + (r.payment.memberCard || 0); }, 0);
    var mTreat = mr.reduce(function(s, r) { return s + (r.payment.treat || 0); }, 0);
    var mAr = mr.reduce(function(s, r) { return s + (r.payment.ar.total || 0); }, 0);
    var mRooms = mr.reduce(function(s, r) { return s + (r.guest.premiumRoomsToday || 0); }, 0);

    var mPur = DB.purchases.filter(function(p) {
        var d = parseInt(p.date.split('-')[2]);
        return p.date.startsWith(m) && d >= sd && d <= ed;
    }).reduce(function(s, p) { return s + p.items.reduce(function(ss, i) { return ss + i.total; }, 0); }, 0);

    var mExp = DB.expenses.filter(function(e) {
        var d = parseInt(e.date.split('-')[2]);
        return e.date.startsWith(m) && d >= sd && d <= ed;
    }).reduce(function(s, e) { return s + e.amount; }, 0);

    var profit = mNet - mPur - mExp;
    var profitRate = mNet > 0 ? (profit / mNet * 100).toFixed(1) : '0';
    var avgNet = mNet / days;
    var avgGuests = mGuests / days;
    var avgSpend = mGuests > 0 ? mNet / mGuests : 0;
    var costRate = mNet > 0 ? (mPur / mNet * 100).toFixed(1) : '0';
    var discountRate = mGross > 0 ? (mDiscount / mGross * 100).toFixed(1) : '0';

    var dailyRows = '';
    var sorted = mr.slice().sort(function(a, b) { return a.date.localeCompare(b.date); });
    sorted.forEach(function(r) {
        var d = parseInt(r.date.split('-')[2]);
        var ppg = r.guest.count > 0 ? (r.revenue.netSales / r.guest.count).toFixed(0) : '-';
        var net = r.revenue.netSales || 0;
        var color = profit >= 0 ? '#3d8b5e' : '#c75450';
        dailyRows += '<tr>';
        dailyRows += '<td>' + d + '日</td>';
        dailyRows += '<td>' + num(r.revenue.grossSales || 0) + '</td>';
        dailyRows += '<td>' + num(r.revenue.discount || 0) + '</td>';
        dailyRows += '<td style="font-weight:600">' + num(net) + '</td>';
        dailyRows += '<td>' + num(r.revenue.kitchenSales || 0) + '</td>';
        dailyRows += '<td>' + num(r.revenue.barSales || 0) + '</td>';
        dailyRows += '<td>' + num(r.delivery.total || 0) + '</td>';
        dailyRows += '<td>' + (r.guest.count || 0) + '</td>';
        dailyRows += '<td>' + ppg + '</td>';
        dailyRows += '</tr>';
    });

    var purBySec = {};
    DB.purchases.filter(function(p) {
        var d = parseInt(p.date.split('-')[2]);
        return p.date.startsWith(m) && d >= sd && d <= ed;
    }).forEach(function(p) {
        p.items.forEach(function(item) {
            var sec = item.section || '其他';
            if (!purBySec[sec]) purBySec[sec] = 0;
            purBySec[sec] += item.total;
        });
    });

    var purRows = '';
    Object.keys(purBySec).sort(function(a, b) { return purBySec[b] - purBySec[a]; }).forEach(function(sec) {
        var pct = mPur > 0 ? (purBySec[sec] / mPur * 100).toFixed(1) : '0';
        purRows += '<tr><td>' + sec + '</td><td>' + num(purBySec[sec]) + '</td><td>' + pct + '%</td></tr>';
    });

    var expByCat = {};
    DB.expenses.filter(function(e) {
        var d = parseInt(e.date.split('-')[2]);
        return e.date.startsWith(m) && d >= sd && d <= ed;
    }).forEach(function(e) {
        if (!expByCat[e.category]) expByCat[e.category] = 0;
        expByCat[e.category] += e.amount;
    });

    var expRows = '';
    Object.keys(expByCat).sort(function(a, b) { return expByCat[b] - expByCat[a]; }).forEach(function(cat) {
        var pct = mExp > 0 ? (expByCat[cat] / mExp * 100).toFixed(1) : '0';
        expRows += '<tr><td>' + cat + '</td><td>' + num(expByCat[cat]) + '</td><td>' + pct + '%</td></tr>';
    });

    var payTotal = mPos + mCcb + mCash + mMember + mTreat + mDel + mAr;
    var payRows = '';
    var payItems = [
        ['智能POS机', mPos], ['建行生活', mCcb], ['现金', mCash],
        ['会员刷卡', mMember], ['招待', mTreat], ['外卖平台', mDel], ['应收账款', mAr]
    ];
    payItems.forEach(function(it) {
        var pct = payTotal > 0 ? (it[1] / payTotal * 100).toFixed(1) : '0';
        payRows += '<tr><td>' + it[0] + '</td><td>' + num(it[1]) + '</td><td>' + pct + '%</td></tr>';
    });

    var revItems = [['厨房', mKit], ['吧台', mBar], ['外卖', mDel], ['香烟', mCig], ['其他', mOther]];
    var revRows = '';
    revItems.forEach(function(it) {
        var pct = mNet > 0 ? (it[1] / mNet * 100).toFixed(1) : '0';
        revRows += '<tr><td>' + it[0] + '</td><td>' + num(it[1]) + '</td><td>' + pct + '%</td></tr>';
    });

    function num(n) {
        n = Math.round((n || 0) * 100) / 100;
        var parts = n.toFixed(2).split('.');
        parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
        return parts.join('.');
    }

    var html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8">';
    html += '<title>' + title + '</title>';
    html += '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;600;700&family=Lexend:wght@300;400;500;600&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">';
    html += '<style>';
    html += '*{margin:0;padding:0;box-sizing:border-box}';
    html += 'body{font-family:"Noto Sans SC",sans-serif;padding:40px;max-width:900px;margin:auto;color:#2c2c2c;line-height:1.8;font-size:13px}';
    html += '@media print{body{padding:20px}.no-print{display:none!important}table{page-break-inside:auto}tr{page-break-inside:avoid}}';
    html += '.header{text-align:center;margin-bottom:30px;padding-bottom:20px;border-bottom:2px solid #b08d57}';
    html += '.header h1{font-family:"Playfair Display",serif;font-size:1.6rem;color:#b08d57;letter-spacing:.05em;margin-bottom:4px}';
    html += '.header .sub{color:#888;font-size:.78rem;letter-spacing:.15em}';
    html += '.header .period{color:#555;font-size:.82rem;margin-top:8px}';
    html += '.metrics{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:28px}';
    html += '.metric{background:#f8f6f0;border:1px solid #e8e2d8;border-radius:8px;padding:14px;text-align:center}';
    html += '.metric .label{font-size:.7rem;color:#888;letter-spacing:.05em}';
    html += '.metric .value{font-family:"Lexend",monospace;font-size:1.2rem;font-weight:600;margin-top:4px}';
    html += '.metric .value.ac{color:#b08d57}.metric .value.gn{color:#3d8b5e}.metric .value.rd{color:#c75450}';
    html += '.section{margin-bottom:24px}';
    html += '.section h2{font-size:.92rem;color:#b08d57;margin-bottom:8px;padding-bottom:6px;border-bottom:1px solid #e8e2d8;letter-spacing:.03em}';
    html += '.section .desc{font-size:.78rem;color:#666;margin-bottom:10px;line-height:1.6}';
    html += 'table{width:100%;border-collapse:collapse;margin-bottom:8px;font-size:.8rem}';
    html += 'th{background:#f0ece4;padding:8px 12px;text-align:left;font-weight:600;color:#666;font-size:.72rem;border-bottom:1px solid #ddd}';
    html += 'td{padding:7px 12px;border-bottom:1px solid #eee;color:#333}';
    html += '.nr{text-align:right;font-family:"Lexend",monospace}';
    html += 'tr.total{background:#f8f6f0;font-weight:600}';
    html += 'tr.total td{border-top:2px solid #b08d57}';
    html += '.footer{text-align:center;color:#aaa;font-size:.68rem;margin-top:40px;padding-top:16px;border-top:1px solid #eee}';
    html += '.print-bar{position:fixed;bottom:20px;right:20px;display:flex;gap:8px;z-index:100}';
    html += '.print-btn{padding:10px 20px;border:none;border-radius:8px;font-size:.82rem;cursor:pointer;font-family:"Noto Sans SC",sans-serif;transition:all .2s}';
    html += '.print-btn.primary{background:#b08d57;color:#fff}';
    html += '.print-btn.secondary{background:#f0ece4;color:#333;border:1px solid #ddd}';
    html += '.print-btn:hover{opacity:.85;transform:translateY(-1px)}';
    html += '@media print{.print-bar{display:none}}';
    html += '</style></head><body>';

    html += '<div class="print-bar no-print">';
    html += '<button class="print-btn secondary" onclick="window.close()">关闭</button>';
    html += '<button class="print-btn primary" onclick="window.print()">打印 / 导出PDF</button>';
    html += '</div>';

    html += '<div class="header">';
    html += '<h1>岸香咖啡 · ' + title + '</h1>';
    html += '<div class="sub">ANSHIANG COFFEE FINANCIAL REPORT</div>';
    html += '<div class="period">' + m.split('-')[0] + '年' + parseInt(m.split('-')[1]) + '月' + sd + '-' + ed + '日 · 共' + days + '天</div>';
    html += '</div>';

    html += '<div class="metrics">';
    html += '<div class="metric"><div class="label">总流水</div><div class="value ac">' + num(mGross) + '</div></div>';
    html += '<div class="metric"><div class="label">总实收</div><div class="value ac">' + num(mNet) + '</div></div>';
    html += '<div class="metric"><div class="label">折扣率</div><div class="value">' + discountRate + '%</div></div>';
    html += '<div class="metric"><div class="label">采购成本</div><div class="value rd">' + num(mPur) + '</div></div>';
    html += '<div class="metric"><div class="label">营业费用</div><div class="value rd">' + num(mExp) + '</div></div>';
    html += '<div class="metric"><div class="label">净利润</div><div class="value ' + (profit >= 0 ? 'gn' : 'rd') + '">' + num(profit) + '</div></div>';
    html += '<div class="metric"><div class="label">利润率</div><div class="value ' + (profit >= 0 ? 'gn' : 'rd') + '">' + profitRate + '%</div></div>';
    html += '<div class="metric"><div class="label">总客流</div><div class="value">' + mGuests + '</div></div>';
    html += '<div class="metric"><div class="label">人均消费</div><div class="value">' + num(avgSpend) + '</div></div>';
    html += '</div>';

    html += '<div class="section">';
    html += '<h2>一、经营概览</h2>';
    html += '<div class="desc">';
    html += '本周期实现流水<strong>' + num(mGross) + '</strong>元，折扣<strong>' + num(mDiscount) + '</strong>元（' + discountRate + '%），';
    html += '实收<strong>' + num(mNet) + '</strong>元。采购成本<strong>' + num(mPur) + '</strong>元（成本率' + costRate + '%），';
    html += '营业费用<strong>' + num(mExp) + '</strong>元。';
    html += '净利润<strong style="color:' + (profit >= 0 ? '#3d8b5e' : '#c75450') + '">' + num(profit) + '</strong>元，利润率' + profitRate + '%。';
    html += '累计到店<strong>' + mGuests + '</strong>人，日均' + avgGuests.toFixed(1) + '人，人均消费' + num(avgSpend) + '元。';
    html += '</div></div>';

    html += '<div class="section">';
    html += '<h2>二、收入结构</h2>';
    html += '<table><tr><th>分类</th><th class="nr">金额（元）</th><th class="nr">占比</th></tr>';
    html += revRows;
    html += '<tr class="total"><td>合计</td><td class="nr">' + num(mNet) + '</td><td class="nr">100%</td></tr>';
    html += '</table></div>';

    html += '<div class="section">';
    html += '<h2>三、支付渠道</h2>';
    html += '<table><tr><th>渠道</th><th class="nr">金额（元）</th><th class="nr">占比</th></tr>';
    html += payRows;
    html += '<tr class="total"><td>合计</td><td class="nr">' + num(payTotal) + '</td><td class="nr">100%</td></tr>';
    html += '</table></div>';

    if (mPur > 0) {
        html += '<div class="section">';
        html += '<h2>四、采购成本</h2>';
        html += '<table><tr><th>归属区域</th><th class="nr">金额（元）</th><th class="nr">占比</th></tr>';
        html += purRows;
        html += '<tr class="total"><td>合计</td><td class="nr">' + num(mPur) + '</td><td class="nr">100%</td></tr>';
        html += '</table></div>';
    }

    if (mExp > 0 && Object.keys(expByCat).length > 0) {
        html += '<div class="section">';
        html += '<h2>' + (mPur > 0 ? '五' : '四') + '、营业费用</h2>';
        html += '<table><tr><th>费用类别</th><th class="nr">金额（元）</th><th class="nr">占比</th></tr>';
        html += expRows;
        html += '<tr class="total"><td>合计</td><td class="nr">' + num(mExp) + '</td><td class="nr">100%</td></tr>';
        html += '</table></div>';
    }

    html += '<div class="section">';
    html += '<h2>每日经营明细</h2>';
    html += '<table><tr><th>日期</th><th class="nr">流水</th><th class="nr">折扣</th><th class="nr">实收</th><th class="nr">厨房</th><th class="nr">吧台</th><th class="nr">外卖</th><th class="nr">客流</th><th class="nr">人均</th></tr>';
    html += dailyRows;
    html += '<tr class="total"><td>合计</td><td class="nr">' + num(mGross) + '</td><td class="nr">' + num(mDiscount) + '</td><td class="nr">' + num(mNet) + '</td><td class="nr">' + num(mKit) + '</td><td class="nr">' + num(mBar) + '</td><td class="nr">' + num(mDel) + '</td><td class="nr">' + mGuests + '</td><td class="nr">' + num(avgSpend) + '</td></tr>';
    html += '</table></div>';

    html += '<div class="footer">';
    html += '岸香咖啡弘皓大厦店 · ' + td() + ' 生成';
    html += '</div>';

    html += '</body></html>';

    var win = window.open('', '_blank');
    if (win) {
        win.document.write(html);
        win.document.close();
        toast('报告已生成，请在新窗口中按 Ctrl+P 打印或导出PDF');
    } else {
        toast('弹窗被拦截，请允许弹窗后重试');
    }
}
