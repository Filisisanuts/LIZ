// dash.js - 总览

// ==================== 6. 总览 ====================
function rDash() {
    var ym = curYM();
    var today = new Date();
    var yest = new Date(today);
    yest.setDate(today.getDate() - 1);
    var yd = yest.getFullYear() + '-' + String(yest.getMonth() + 1).padStart(2, '0') + '-' + String(yest.getDate()).padStart(2, '0');
    var ydr = DB.dailyReports.find(function(r) { return r.date === yd; });

    var mr = getMR(ym);
    var mKit = mr.reduce(function(s, r) { return s + (r.revenue.kitchenSales || 0); }, 0);
    var mBar = mr.reduce(function(s, r) { return s + (r.revenue.barSales || 0); }, 0);
    var mDel = mr.reduce(function(s, r) { return s + (r.delivery.total || 0); }, 0);
    var mNet = mr.reduce(function(s, r) { return s + (r.revenue.netSales || 0); }, 0);
    var mPr = mr.reduce(function(s, r) { return s + (r.guest.premiumRoomsToday || 0); }, 0);
    var mGuests = mr.reduce(function(s, r) { return s + (r.guest.count || 0); }, 0);

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

    var alerts = [];
    DB.cigItems.forEach(function(i) {
        var c = invCalc(i, 'cig');
        if (i.restockAlert && c.stock <= i.restockAlert) alerts.push(i.name + ' ' + c.stock + '包');
    });
    DB.alcItems.forEach(function(i) {
        var c = invCalc(i, 'alc');
        if (i.restockAlert && c.stock <= i.restockAlert) alerts.push(i.name + ' ' + c.stock + '瓶');
    });
    (DB.whItems || []).forEach(function(i) {
        if (i.safeStock && i.stock <= i.safeStock) alerts.push(i.name + ' ' + i.stock + i.unit);
    });

    var h = '';

    if (alerts.length) {
        h += '<div class="alert-bar"><b style="color:var(--og)">⚠️ 补货：</b>';
        h += alerts.map(function(a) { return '<span class="badge og">' + a + '</span>'; }).join(' ');
        h += '</div>';
    }

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

    h += '<div class="sec">🛒 采购成本</div>';
    h += '<div class="cards">';
    h += card('本月采购', fmtC(purTotal), 'ac');
    h += card('本月退货', fmtC(retTotal), 'rd');
    h += card('净采购', fmtC(purTotal - retTotal), 'gn');
    h += card('采购天数', purDaysN);
    h += '</div>';

    h += '<div class="sec">📦 贵重物品经营</div>';
    h += '<div class="cards">';
    h += card('茗茶实收', fmtC(mTea));
    h += card('茗茶毛利', fmtC(mTeaP), 'gn');
    h += card('香烟实收', fmtC(mCig));
    h += card('香烟毛利', fmtC(mCigP), 'gn');
    h += card('酒类实收', fmtC(mAlc));
    h += card('酒类毛利', fmtC(mAlcP), 'gn');
    h += '</div>';

    h += '<div class="sec">📈 近7日趋势</div>';
    h += '<div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:14px">';
    h += '<canvas id="dashChart" height="120"></canvas>';
    h += '</div>';

    setMain('总览', h);
    setTimeout(initDashChart, 100);
}

function card(label, value, cls) {
    return '<div class="card"><div class="card-l">' + label + '</div><div class="card-v' + (cls ? ' ' + cls : '') + '">' + value + '</div></div>';
}

function initDashChart() {
    if (typeof Chart === 'undefined') return;

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

    Chart.defaults.color = '#7a7570';
    Chart.defaults.font.family = "'DM Mono','Lexend',monospace";

    new Chart(ctx, {
        type: 'bar',
        data: {
            labels: last7.map(function(d) { return d.label; }),
            datasets: [
                {
                    label: '实收',
                    data: last7.map(function(d) { return d.revenue; }),
                    backgroundColor: 'rgba(201,168,76,.55)',
                    borderColor: '#c9a84c',
                    borderWidth: 1,
                    borderRadius: 4,
                    yAxisID: 'y',
                    order: 2
                },
                {
                    label: '客流',
                    data: last7.map(function(d) { return d.guests; }),
                    type: 'line',
                    borderColor: '#60a5fa',
                    backgroundColor: 'rgba(96,165,250,.08)',
                    fill: true,
                    pointBackgroundColor: '#60a5fa',
                    pointRadius: 4,
                    pointHoverRadius: 7,
                    tension: 0.3,
                    yAxisID: 'y1',
                    order: 1
                }
            ]
        },
        options: {
            maintainAspectRatio: true,
            aspectRatio: 3,
            responsive: true,
            interaction: { mode: 'index', intersect: false },
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
                y: {
                    position: 'left',
                    grid: { color: 'rgba(45,48,65,.3)' },
                    ticks: {
                        callback: function(v) { return v >= 10000 ? (v / 10000).toFixed(1) + '万' : v; }
                    },
                    title: { display: true, text: '实收（元）', color: '#c9a84c', font: { size: 10 } }
                },
                y1: {
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
