// 首页仪表盘：昨日日报、本月累计营业数据、采购成本、库存经营、近7日趋势图
function rDash() {
    var ym = curYM();
    var today = new Date();
    var yest = new Date(today);
    yest.setDate(today.getDate() - 1);
    var yd = yest.getFullYear() + '-' + String(yest.getMonth() + 1).padStart(2, '0') + '-' + String(yest.getDate()).padStart(2, '0');
    var ydr = DB.dailyReports.find(function(r) { return r.date === yd; });

    // 本月日报统计
    var mr = getMR(ym);
    var mKit = mr.reduce(function(s, r) { return s + (r.revenue.kitchenSales || 0); }, 0);
    var mBar = mr.reduce(function(s, r) { return s + (r.revenue.barSales || 0); }, 0);
    var mDel = mr.reduce(function(s, r) { return s + (r.delivery.total || 0); }, 0);
    var mNet = mr.reduce(function(s, r) { return s + (r.revenue.netSales || 0); }, 0);
    var mPr = mr.reduce(function(s, r) { return s + (r.guest.premiumRoomsToday || 0); }, 0);
    var mGuests = mr.reduce(function(s, r) { return s + (r.guest.count || 0); }, 0);

    // 本月贵重物品经营
    var mTea = DB.teaItems.reduce(function(s, i) { return s + invCalcMon(i, 'tea', ym).revenue; }, 0);
    var mCig = DB.cigItems.reduce(function(s, i) { return s + invCalcMon(i, 'cig', ym).revenue; }, 0);
    var mAlc = DB.alcItems.reduce(function(s, i) { return s + invCalcMon(i, 'alc', ym).revenue; }, 0);

    var mTeaP = DB.teaItems.reduce(function(s, i) {
        var c = invCalcMon(i, 'tea', ym);
        return s + c.revenue - c.cost;
    }, 0);
    var mCigP = DB.cigItems.reduce(function(s, i) {
        var c = invCalcMon(i, 'cig', ym);
        return s + c.revenue - c.cost;
    }, 0);
    var mAlcP = DB.alcItems.reduce(function(s, i) {
        var c = invCalcMon(i, 'alc', ym);
        return s + c.revenue - c.cost;
    }, 0);

    // 本月采购统计
    var mPur = DB.purchases.filter(function(p) { return p.date.startsWith(ym); });
    var purTotal = 0, retTotal = 0, purDays = {};
    mPur.forEach(function(p) {
        purDays[p.date] = 1;
        (p.items || []).forEach(function(item) {
            var src = item.source || p.source || '外购';
            if (src === '退货') retTotal += item.total;
            else purTotal += item.total;
        });
    });
    var purDaysN = Object.keys(purDays).length;

    // 补货预警（当月结存）
    var ym = curYM();
    var alerts = [];
    DB.teaItems.forEach(function(i) {
        var tp = (i.purchases || []).filter(function(p) { return p.date && p.date.startsWith(ym); }).reduce(function(s, p) { return s + (p.qty || 0); }, 0);
        var ts = 0;
        (i.sales || []).filter(function(s) { return s.date && s.date.startsWith(ym); }).forEach(function(s) {
            if (i.calcMode === 'pack') ts += (s.cups || 0) * (i.packsPerCup || 0) + (s.pots || 0) * (i.packsPerPot || 0);
            else ts += (s.cups || 0) * (i.gramsPerCup || 5) + (s.pots || 0) * (i.gramsPerPot || 15);
        });
        var stock = (i.openingStock || 0) + tp - ts;
        if (i.restockAlert && stock <= i.restockAlert) alerts.push(i.name + ' ' + stock + (i.calcMode === 'pack' ? '包' : '克'));
    });
    DB.cigItems.forEach(function(i) {
        var tp = (i.purchases || []).filter(function(p) { return p.date && p.date.startsWith(ym); }).reduce(function(s, p) { return s + (p.qty || 0); }, 0);
        var ts = (i.sales || []).filter(function(s) { return s.date && s.date.startsWith(ym); }).reduce(function(s, r) { return s + (r.qty || 0); }, 0);
        var stock = (i.openingStock || 0) + tp - ts;
        if (i.restockAlert && stock <= i.restockAlert) alerts.push(i.name + ' ' + stock + '包');
    });
    DB.alcItems.forEach(function(i) {
        var tp = (i.purchases || []).filter(function(p) { return p.date && p.date.startsWith(ym); }).reduce(function(s, p) { return s + (p.qty || 0); }, 0);
        var ts = (i.sales || []).filter(function(s) { return s.date && s.date.startsWith(ym); }).reduce(function(s, r) { return s + (r.qty || 0); }, 0);
        var stock = (i.openingStock || 0) + tp - ts;
        if (i.restockAlert && stock <= i.restockAlert) alerts.push(i.name + ' ' + stock + '瓶');
    });
    (DB.otherItems || []).forEach(function(i) {
        var tp = (i.purchases || []).filter(function(p) { return p.date && p.date.startsWith(ym); }).reduce(function(s, p) { return s + (p.qty || 0); }, 0);
        var ts = 0;
        (i.sales || []).filter(function(s) { return s.date && s.date.startsWith(ym); }).forEach(function(s) {
            if (i.calcMode === 'pack') ts += (s.cups || 0) * (i.packsPerCup || 0) + (s.pots || 0) * (i.packsPerPot || 0);
            else if (i.calcMode === 'gram') ts += (s.cups || 0) * (i.gramsPerCup || 1) + (s.pots || 0) * (i.gramsPerPot || 0);
            else ts += (s.qty || 0);
        });
        var stock = (i.openingStock || 0) + tp - ts;
        var unit = i.calcMode === 'pack' ? '包' : i.calcMode === 'gram' ? '克' : '个';
        if (i.restockAlert && stock <= i.restockAlert) alerts.push(i.name + ' ' + stock + unit);
    });
    (DB.whItems || []).forEach(function(i) {
        if (i.safeStock && i.stock <= i.safeStock) alerts.push(i.name + ' ' + i.stock + i.unit);
    });

    // ===== 渲染 =====
    var h = '';

    // 预警条
    if (alerts.length) {
        h += '<div class="alert-bar"><b style="color:var(--og)">⚠️ 补货：</b>';
        h += alerts.map(function(a) { return '<span class="badge og">' + a + '</span>'; }).join(' ');
        h += '</div>';
    }

    // 昨日日报
    h += '<div class="sec">📅 ' + yd + ' 日报</div>';
    if (ydr) {
        h += '<div class="cards">';
        h += card('实收', fmtC(ydr.revenue.netSales), 'ac');
        h += card('厨房', fmtC(ydr.revenue.kitchenSales));
        h += card('吧台', fmtC(ydr.revenue.barSales));
        h += card('外卖', fmtC(ydr.delivery.total), 'gn');
        h += card('人数', ydr.guest.count);
        h += card('500+包厢', ydr.guest.premiumRoomsToday || 0);
        h += '</div>';
    } else {
        h += '<div style="text-align:center;padding:16px;color:var(--tx-m);font-size:.78rem">昨日暂无日报</div>';
    }

    // 本月营业数据
    h += '<div class="sec">📊 营业数据 · ' + (today.getMonth() + 1) + '月累计</div>';
    h += '<div class="cards">';
    h += card('实收', fmtC(mNet), 'ac');
    h += card('厨房', fmtC(mKit));
    h += card('吧台', fmtC(mBar));
    h += card('外卖', fmtC(mDel), 'gn');
    h += card('人数', mGuests);
    h += card('人均', mGuests > 0 ? fmtC(mNet / mGuests) : '-');
    h += card('500+包厢', mPr);
    h += '</div>';

    // 采购成本
    h += '<div class="sec">🛒 采购成本</div>';
    h += '<div class="cards">';
    h += card('本月采购', fmtC(purTotal), 'ac');
    h += card('本月退货', fmtC(retTotal), 'rd');
    h += card('净采购', fmtC(purTotal - retTotal), 'gn');
    h += card('采购天数', purDaysN);
    h += '</div>';

    // 贵重物品经营
    h += '<div class="sec">📦 贵重物品经营</div>';
    h += '<div class="cards">';
    h += card('茗茶实收', fmtC(mTea));
    h += card('茗茶毛利', fmtC(mTeaP), 'gn');
    h += card('香烟实收', fmtC(mCig));
    h += card('香烟毛利', fmtC(mCigP), 'gn');
    h += card('酒类实收', fmtC(mAlc));
    h += card('酒类毛利', fmtC(mAlcP), 'gn');
    h += '</div>';

    // 近7日趋势
    h += '<div class="sec">📈 近7日趋势</div>';
    h += '<div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:14px">';
    h += '<canvas id="dashChart" height="120"></canvas>';
    h += '</div>';

    setMain('总览', h);
    setTimeout(initDashChart, 100);
}

// 卡片快捷生成 
// 快速生成数据卡片 HTML，用于总览页的各个统计区块
// cls 可选值：'ac'(金色)、'gn'(绿色)、'rd'(红色)、'og'(橙色)
function card(label, value, cls) {
    return '<div class="card"><div class="card-l">' + label + '</div><div class="card-v' + (cls ? ' ' + cls : '') + '">' + value + '</div></div>';
}

// 总览页面图表
// 渲染近7日趋势图：柱状图（实收）+ 折线图（客流），双Y轴
var _dashChart = null;
function initDashChart() {
    // Chart.js 未加载则跳过
    if (typeof Chart === 'undefined') return;

    // 销毁旧实例，防止 Canvas reuse 报错
    if (_dashChart) { _dashChart.destroy(); _dashChart = null; }

    // 获取近7天的日报数据
    var last7 = [];
    for (var i = 6; i >= 0; i--) {
        var d = new Date();
        d.setDate(d.getDate() - i);
        var ds = d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
        var dr2 = DB.dailyReports.find(function(r) { return r.date === ds; });
        last7.push({
            label: (d.getMonth() + 1) + '/' + d.getDate(),
            revenue: dr2 ? dr2.revenue.netSales || 0 : 0,
            guests: dr2 ? dr2.guest.count || 0 : 0
        });
    }

    var ctx = document.getElementById('dashChart');
    if (!ctx) return;

    // Chart.js 全局样式
    Chart.defaults.color = '#7a7570';
    Chart.defaults.font.family = "'DM Mono','Lexend',monospace";

    // 创建图表
    _dashChart = new Chart(ctx, {
        type: 'bar',
        data: {
            labels: last7.map(function(d) { return d.label; }),
            datasets: [
                {
                    label: '实收',                          // 柱状图：每日实收金额
                    data: last7.map(function(d) { return d.revenue; }),
                    backgroundColor: 'rgba(201,168,76,.55)', // 金色半透明
                    borderColor: '#c9a84c',
                    borderWidth: 1,
                    borderRadius: 4,
                    yAxisID: 'y',                            // 左Y轴
                    order: 2
                },
                {
                    label: '客流',                          // 折线图：每日客流人数
                    data: last7.map(function(d) { return d.guests; }),
                    type: 'line',
                    borderColor: '#60a5fa',                  // 蓝色
                    backgroundColor: 'rgba(96,165,250,.08)',
                    fill: true,
                    pointBackgroundColor: '#60a5fa',
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    tension: 0.3,
                    yAxisID: 'y1',                           // 右Y轴
                    order: 1
                }
            ]
        },
        options: {
            maintainAspectRatio: true,
            aspectRatio: 2,
            responsive: true,
            interaction: { mode: 'index', intersect: false },  // 悬停时同时显示两个数据
            plugins: {
                legend: {
                    position: 'bottom',
                    labels: { padding: 16, usePointStyle: true, font: { size: 11 } }
                },
                tooltip: {
                    backgroundColor: '#1e2130',
                    borderColor: '#2d3041',
                    borderWidth: 1,
                    padding: 12,
                    cornerRadius: 6,
                    callbacks: {
                        title: function(items) { return items[0].label; },
                        label: function(ctx) {
                            if (ctx.dataset.label === '实收')
                                return ' 实收: ' + ctx.raw.toLocaleString('zh-CN', { minimumFractionDigits: 0, maximumFractionDigits: 0 }) + '元';
                            return ' 客流: ' + ctx.raw + '人';
                        }
                    }
                }
            },
            scales: {
                y: {                                         // 左Y轴：实收金额
                    position: 'left',
                    grid: { color: 'rgba(45,48,65,.3)' },
                    ticks: {
                        callback: function(v) { return v >= 10000 ? (v / 10000).toFixed(1) + '万' : v; }
                    },
                    title: { display: true, text: '实收（元）', color: '#c9a84c', font: { size: 10 } }
                },
                y1: {                                        // 右Y轴：客流人数
                    position: 'right',
                    grid: { drawOnChartArea: false },
                    min: 0,
                    title: { display: true, text: '客流（人）', color: '#60a5fa', font: { size: 10 } }
                },
                x: {
                    grid: { display: false }
                }
            }
        }
    });
}

