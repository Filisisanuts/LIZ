// 费用页面的照片数据（Base64，用于拍照记录费用单据）
var _expPhotoData = null;
// 当前编辑的费用ID（null 表示新建）
var _editExpId = null;

// 获取费用分类列表（从已有记录中提取，没有则返回默认分类）
function getExpCats() {
    var c = {};
    DB.expenses.forEach(function(e) { if (e.category) c[e.category] = 1; });
    return Object.keys(c).length ? Object.keys(c) : ['水费','电费','燃气费','物业费', '工资', '维修费', '其他'];
}

// ------ 费用主页 ------
function rExpense() {
    var cats = getExpCats();
    var h = '';

    // 标签栏
    h += '<div class="tab-bar" id="expTabs">';
    h += '<button class="tab-btn active" onclick="switchExpTab(\'input\')">录入</button>';
    h += '<button class="tab-btn" onclick="switchExpTab(\'detail\')">明细</button>';
    h += '</div>';

    // 录入页
    h += '<div id="expInput">';
    h += '<div class="section-label">录入费用</div>';
    h += '<div class="hrow"><label>日期</label><input class="inp" id="expDate" type="text" readonly placeholder="选择日期" value="' + td() + '" onclick="_dpOpen(\'expDate\')" style="max-width:150px;cursor:pointer">';
    h += '<label>分类</label><select class="inp" id="expCatSel" style="max-width:120px" onchange="toggleCustomInput(this,\'expCatC\')">';
    h += '<option value="">请选择</option>';
    cats.forEach(function(c) { h += '<option>' + c + '</option>'; });
    h += '<option value="__custom">自定义</option></select>';
    h += '<input class="inp" id="expCatC" style="display:none;max-width:120px" placeholder="输入分类">';
    h += '<label>金额</label><input class="inp" id="expAmt" type="number" step="0.01" style="max-width:100px">元</div>';
    h += '<div class="hrow"><label>备注</label><input class="inp" id="expNote"></div>';
    h += '<div class="hrow"><label>凭证</label><input type="file" id="expPhoto" accept="image/*" onchange="handleExpPhoto(event)"></div>';
    h += '<div class="brow"><button class="btn p" onclick="addExp()">添加</button></div>';
    h += '</div>';

    // 明细页：日历
    h += '<div id="expDetail" style="display:none">';
    h += renderExpCalendar();
    h += '</div>';

    setMain('费用', h);
}

// ------ 添加费用记录 ------
// 处理费用凭证照片的输入事件，读取文件并存储Base64数据
function addExp() {
    var amt = parseFloat($id('expAmt').value);
    var cat = getSelVal('expCatSel', 'expCatC');
    if (!amt || !cat) { toast('填分类和金额'); return; }

    upd(function(db) {
        db.expenses.push({
            id: 'e_' + Date.now(),
            date: $id('expDate').value || td(),
            category: cat,
            amount: amt,
            note: $id('expNote').value.trim(),
            photoFile: _expPhotoData || ''
        });
    });

    _expPhotoData = null;
    toast('已添加');
    rExpense();
}

// 处理费用凭证照片的输入事件，读取文件并存储Base64数据
function pickExpPhoto() {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    // 移动端不设置capture属性，让用户选择照片或拍照
    // 只在桌面端使用后置摄像头
    if (window.innerWidth > 768) {
        input.capture = 'environment';
    }
    input.onchange = function(ev) {
        var file = ev.target.files[0];
        if (!file) return;
        processImage(file, 800, function(base64) {
            window._eePhoto = base64;
            var area = $id('eePhotoArea');
            if (area) {
                area.innerHTML = '<div style="position:relative;display:inline-block;margin-bottom:8px">' +
                    '<img src="' + base64 + '" style="max-width:100%;max-height:150px;border-radius:8px;border:1px solid var(--bd)">' +
                    '<button class="btn s d" style="position:absolute;top:4px;right:4px" onclick="window._eePhoto=null;$id(\'eePhotoArea\').innerHTML=\'\';">×</button></div>';
            }
            toast('图片已添加');
        });
    };
    input.click();
}

// 弹窗编辑费用
function editExp(id) {
    var e = DB.expenses.find(function(item) { return item.id === id; });
    if (!e) return;
    _editExpId = id;

    var cats = getExpCats();
    var h = '<h3>编辑费用</h3>';
    h += '<div class="hrow"><label>日期</label><input class="inp" id="eeDate" type="text" readonly value="' + e.date + '" onclick="_dpOpen(\'eeDate\')" style="max-width:150px;cursor:pointer">';
    h += '<label>分类</label><select class="inp" id="eeCat" style="max-width:120px">';
    cats.forEach(function(c) { h += '<option' + (e.category === c ? ' selected' : '') + '>' + c + '</option>'; });
    h += '</select></div>';
    h += '<div class="hrow"><label>金额</label><input class="inp" id="eeAmt" type="number" step="0.01" value="' + e.amount + '" style="max-width:100px">';
    h += '<label>备注</label><input class="inp" id="eeNote" value="' + (e.note || '') + '"></div>';

    // 图片
    h += '<div class="section-label">附件图片</div>';
    h += '<div id="eePhotoArea">';
    if (e.photoFile) {
        h += '<div style="position:relative;display:inline-block;margin-bottom:8px">';
        h += '<img src="' + e.photoFile + '" style="max-width:100%;max-height:150px;border-radius:8px;border:1px solid var(--bd)">';
        h += '<button class="btn s d" style="position:absolute;top:4px;right:4px" onclick="window._eePhoto=null;$id(\'eePhotoArea\').innerHTML=\'\';">×</button>';
        h += '</div>';
    }
    h += '</div>';
    h += '<div class="brow"><button class="btn" onclick="pickExpPhoto()">📷 拍照/选择图片</button></div>';

    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end"><button class="btn p" onclick="doEditExp()">保存</button>';
    h += '<button class="btn" onclick="backToModal(function(){rExpense()})">取消</button></div>';
    showModal(h);
    window._eePhoto = e.photoFile || null;
}

// 保存编辑的费用
function doEditExp() {
    if (!_editExpId) return;
    upd(function(db) {
        var e = db.expenses.find(function(item) { return item.id === _editExpId; });
        if (!e) return;
        e.date = $id('eeDate').value;
        e.category = $id('eeCat').value;
        e.amount = parseFloat($id('eeAmt').value) || 0;
        e.note = $id('eeNote').value.trim();
        e.photoFile = window._eePhoto || '';
    });
    closeModal();
    _editExpId = null;
    window._eePhoto = null;
    toast('已更新');
    rExpense();
}

// 删除费用
function delExp(id) {
    if (!confirm('删除？')) return;
    upd(function(db) {
        db.expenses = db.expenses.filter(function(e) { return e.id !== id; });
    });
    toast('已删除');
    rExpense();
}

// ------ 费用标签页切换 ------
function switchExpTab(tab){
    document.getElementById('expInput').style.display=tab==='input'?'':'none';
    document.getElementById('expDetail').style.display=tab==='detail'?'':'none';
    var btns=document.querySelectorAll('#expTabs .tab-btn');
    btns[0].className='tab-btn'+(tab==='input'?' active':'');
    btns[1].className='tab-btn'+(tab==='detail'?' active':'');
    if(tab==='detail'){
        document.getElementById('expDetail').innerHTML=renderExpCalendar();
    }
}

// ------ 费用日历 ------
// 处理费用凭证照片的输入事件，读取文件并存储Base64数据
var _expCalYM=curYM(); // 当前显示的年月
// 渲染费用日历视图
function renderExpCalendar(){
    var ym=_expCalYM;
    var year=parseInt(ym.split('-')[0]);
    var month=parseInt(ym.split('-')[1]);

    var monthItems=DB.expenses.filter(function(e){return e.date.startsWith(ym)});
    var monthTotal=monthItems.reduce(function(s,e){return s+e.amount},0);

    var dayData={};
    monthItems.forEach(function(e){
        var day=parseInt(e.date.substring(8,10));
        if(!dayData[day])dayData[day]=0;
        dayData[day]+=e.amount;
    });

    var catTotals={};
    monthItems.forEach(function(e){
        if(!catTotals[e.category])catTotals[e.category]=0;
        catTotals[e.category]+=e.amount;
    });

    var todayDay=parseInt(td().split('-')[2]);
    var isThisMonth=td().startsWith(ym);
    var daysInMonth=new Date(year,month,0).getDate();

    var h='';

    // 1. 月份切换
    h+='<div class="hrow" style="margin-bottom:10px">';
    h+='<button class="btn s" onclick="expCalNav(-1)">◀</button>';
    h+='<input class="inp" id="expCalPicker" type="text" readonly value="'+ym+'" onclick="_mpOpen(\'expCalPicker\')" style="max-width:130px;cursor:pointer;text-align:center;font-weight:700" onchange="expCalPickYM(this.value)">';
    h+='<button class="btn s" onclick="expCalNav(1)">▶</button>';
    h+='<button class="btn s" onclick="showExpPDFDialog()" style="margin-left:auto">📄 导出PDF</button></div>';

    // 2. 本月汇总
    if(monthItems.length){
        h+='<div class="cards">';
        h+='<div class="card"><div class="card-l">本月费用</div><div class="card-v ac">'+fmtC(monthTotal)+'</div></div>';
        h+='<div class="card"><div class="card-l">笔数</div><div class="card-v">'+monthItems.length+'</div></div>';
        h+='<div class="card"><div class="card-l">日均</div><div class="card-v">'+fmtC(monthTotal/daysInMonth)+'</div></div>';
        h+='</div>';

    }

    // 3. 日历网格
    var firstDay=new Date(year,month-1,1).getDay();
    firstDay=firstDay===0?6:firstDay-1;

    h+='<div class="exp-calendar" style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px;margin-bottom:14px">';
    ['一','二','三','四','五','六','日'].forEach(function(w){
        h+='<div style="text-align:center;font-size:.7rem;color:var(--tx-m);padding:4px 0">'+w+'</div>';
    });

    for(var i=0;i<firstDay;i++)h+='<div></div>';

    for(var d=1;d<=daysInMonth;d++){
        var dateStr=ym+'-'+(d<10?'0'+d:d);
        var isToday=isThisMonth&&d===todayDay;
        var has=!!dayData[d];

        h+='<div class="exp-calendar-cell" style="background:'+(has?'var(--card)':'var(--card-h)')+';border:1px solid '+(isToday?'var(--ac)':'var(--bd)')+';border-radius:6px;padding:6px;cursor:'+(has?'pointer':'default')+';min-height:65px"';

        if(has)h+=' onclick="expDayClick(\''+dateStr+'\')"';

        h+='><div style="font-size:.72rem;font-weight:600;color:'+(isToday?'var(--ac)':'var(--tx)')+'">'+d+'</div>';

        if(has){
            h+='<div style="font-family:var(--fm);font-size:.7rem;color:var(--ac);margin-top:2px">¥'+fmtC(dayData[d])+'</div>';
        }else{
            h+='<div style="font-size:.6rem;color:var(--tx-m);margin-top:4px">-</div>';
        }
        h+='</div>';
    }
    h+='</div>';

    // 4. 无数据提示
    if(!monthItems.length){
        h+='<div style="text-align:center;padding:20px;color:var(--tx-m);font-size:.78rem">本月暂无费用记录</div>';
    }

    return h;
}

// 月份导航
function expCalNav(dir) {
    _expCalYM = calendarNav(dir, _expCalYM, 'expCalPicker', function(ym) {
        document.getElementById('expDetail').innerHTML = renderExpCalendar();
    });
}

// 月份选择
function expCalPickYM(val) {
    calendarPickYM(val, function(ym) {
        _expCalYM = ym;
        document.getElementById('expDetail').innerHTML = renderExpCalendar();
    });
}

// 点击日期格子
function expDayClick(dateStr){
    var items=DB.expenses.filter(function(e){return e.date===dateStr});
    if(!items.length){toast('这天没有费用记录');return}
    showExpDayModal(dateStr,items);
}

// 某天费用弹窗
function showExpDayModal(date, items) {
    var total = items.reduce(function(s, e) { return s + e.amount; }, 0);
    var dateLabel = date.substring(5).replace('-', '/') || date;

    var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
    h += '<h3 style="margin:0">' + dateLabel + ' 费用明细</h3>';
    h += '<div style="display:flex;align-items:center;gap:8px">';
    h += '<span style="font-size:.95rem;font-weight:700;color:var(--ac)">¥' + fmtC(total) + '</span>';
    h += '</div></div>';

    var catTotals = {};
    items.forEach(function(e) {
        if (!catTotals[e.category]) catTotals[e.category] = 0;
        catTotals[e.category] += e.amount;
    });
    h += '<div style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px">';
    Object.keys(catTotals).forEach(function(cat) {
        h += '<span class="badge">' + cat + ' ' + fmtC(catTotals[cat]) + '</span>';
    });
    h += '</div>';

    h += '<div style="max-height:50vh;overflow-y:auto;padding-right:4px">';
    items.forEach(function(e) {
        h += '<div style="display:flex;justify-content:space-between;align-items:flex-start;padding:8px 10px;margin-bottom:6px;background:var(--card-h);border:1px solid var(--bd);border-radius:8px">';
        h += '<div style="flex:1;min-width:0">';
        h += '<div style="font-size:.84rem;font-weight:600">' + e.category + '</div>';
        if (e.note) h += '<div style="font-size:.72rem;color:var(--tx-m);margin-top:2px">' + e.note + '</div>';
        if (e.photoFile) {
            h += '<div style="margin-top:4px;cursor:pointer" onclick="toggleExpPhoto(\'' + e.id + '\')">';
            h += '<img src="' + e.photoFile + '" style="max-width:80px;max-height:50px;border-radius:4px;border:1px solid var(--bd)">';
            h += '</div>';
            h += '<div id="expPhoto_' + e.id + '" style="display:none;margin-top:6px">';
            h += '<img src="' + e.photoFile + '" style="max-width:100%;max-height:300px;border-radius:8px;border:1px solid var(--bd)">';
            h += '</div>';
        }
        h += '</div>';
        h += '<div style="display:flex;align-items:center;gap:6px;flex-shrink:0;margin-left:8px">';
        h += '<span style="font-size:.88rem;font-weight:700;color:var(--ac)">¥' + fmtC(e.amount) + '</span>';
        h += '<button class="btn s" onclick="editExpFromCal(\'' + e.id + '\',\'' + date + '\')">编</button>';
        h += '<button class="btn s d" onclick="delExpFromCal(\'' + e.id + '\',\'' + date + '\')">删</button>';
        h += '</div></div>';
    });
    h += '</div>';

    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end"><button class="btn" onclick="closeModal()">关闭</button></div>';
    showModal(h, 550);
}

// 查看费用凭证照片
function toggleExpPhoto(id) {
    var el = document.getElementById('expPhoto_' + id);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// 从弹窗编辑
function editExpFromCal(id,date){
    backToModal(function(){
        editExp(id);
    });
}

// 从弹窗删除
function delExpFromCal(id,date){
    if(!confirm('确认删除这笔费用？'))return;
    upd(function(db){db.expenses=db.expenses.filter(function(e){return e.id!==id})});
    toast('已删除');
    closeModal();
    // 刷新弹窗
    var items=DB.expenses.filter(function(e){return e.date===date});
    if(items.length){
        showExpDayModal(date,items);
    }else{
        // 刷新日历
        document.getElementById('expDetail').innerHTML=renderExpCalendar();
    }
}

// 导出费用PDF的日期选择弹窗
function showExpPDFDialog() {
    var ym = _expCalYM || curYM();
    var daysInMonth = new Date(parseInt(ym.split('-')[0]), parseInt(ym.split('-')[1]), 0).getDate();
    var h = '<h3>导出费用PDF</h3>';
    h += '<div class="hrow"><label>开始</label><input class="inp" id="pdfStart" type="text" readonly value="' + ym + '-01" onclick="_dpOpen(\'pdfStart\')" style="max-width:150px;cursor:pointer">';
    h += '<label>结束</label><input class="inp" id="pdfEnd" type="text" readonly value="' + ym + '-' + String(daysInMonth).padStart(2,'0') + '" onclick="_dpOpen(\'pdfEnd\')" style="max-width:150px;cursor:pointer"></div>';
    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end">';
    h += '<button class="btn p" onclick="previewExpPDF()">预览</button>';
    h += '<button class="btn" onclick="backToModal(function(){rExpense()})">取消</button></div>';
    showModal(h, 500);
}

// 预览费用PDF的内容（在弹窗中展示，提供打印按钮）
function previewExpPDF() {
    var startDate = $id('pdfStart').value;
    var endDate = $id('pdfEnd').value;
    if (!startDate || !endDate) { toast('请选择起止日期'); return; }
    if (startDate > endDate) { var t = startDate; startDate = endDate; endDate = t; }

    var items = DB.expenses.filter(function(e) { return e.date >= startDate && e.date <= endDate; });
    items.sort(function(a, b) { return a.date.localeCompare(b.date); });
    if (!items.length) { toast('该时间段无费用记录'); return; }

    var total = items.reduce(function(s, e) { return s + e.amount; }, 0);
    var startLabel = startDate.replace(/-/g, '/');
    var endLabel = endDate.replace(/-/g, '/');
    window._expPDFItems = items;
    window._expPDFTotal = total;
    window._expPDFStart = startLabel;
    window._expPDFEnd = endLabel;

    var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px">';
    h += '<h3 style="margin:0">费用报告 · ' + startLabel + ' — ' + endLabel + '</h3>';
    h += '<div style="display:flex;gap:6px">';
    h += '<button class="btn p" onclick="printExpPDF()">打印 / 导出PDF</button>';
    h += '<button class="btn" onclick="showExpPDFDialog()">返回</button></div></div>';

    h += '<div style="background:#fff;border:1px solid var(--bd);border-radius:8px;padding:16px;max-height:65vh;overflow-y:auto">';
    h += '<table style="width:100%;border-collapse:collapse;font-size:.78rem">';
    h += '<tr><th style="text-align:left;padding:8px;background:var(--card-h);border-bottom:1px solid var(--bd)">日期</th>';
    h += '<th style="text-align:left;padding:8px;background:var(--card-h);border-bottom:1px solid var(--bd)">分类/备注</th>';
    h += '<th style="text-align:right;padding:8px;background:var(--card-h);border-bottom:1px solid var(--bd)">金额</th>';
    h += '<th style="text-align:center;padding:8px;background:var(--card-h);border-bottom:1px solid var(--bd)">图片</th></tr>';

    items.forEach(function(e) {
        var dateLabel = e.date.substring(5).replace('-', '/');
        // 主行
        h += '<tr>';
        h += '<td style="padding:8px;border-bottom:1px solid var(--bd-l);white-space:nowrap">' + dateLabel + '</td>';
        h += '<td style="padding:8px;border-bottom:1px solid var(--bd-l)">' + e.category + (e.note ? ' · ' + e.note : '') + '</td>';
        h += '<td style="padding:8px;border-bottom:1px solid var(--bd-l);text-align:right;font-family:var(--fm);font-weight:600">¥' + fmtC(e.amount) + '</td>';
        h += '<td style="padding:8px;border-bottom:1px solid var(--bd-l);text-align:center">';
        if (e.photoFile) {
            h += '<img src="' + e.photoFile + '" style="max-width:60px;max-height:40px;border-radius:4px;border:1px solid var(--bd);cursor:pointer" onclick="toggleExpPhoto(\'' + e.id + '\')">';
        } else {
            h += '<span style="font-size:.65rem;color:var(--tx-s)">-</span>';
        }
        h += '</td></tr>';
        // 大图行（默认隐藏）
        if (e.photoFile) {
            h += '<tr id="expPhoto_' + e.id + '" style="display:none"><td colspan="4" style="padding:8px 8px 12px;border-bottom:1px solid var(--bd-l);text-align:center">';
            h += '<img src="' + e.photoFile + '" style="max-width:100%;max-height:300px;border-radius:8px;border:1px solid var(--bd)" onclick="toggleExpPhoto(\'' + e.id + '\')">';
            h += '</td></tr>';
        }
    });

    h += '<tr style="background:var(--card-h);font-weight:600"><td colspan="2" style="padding:8px">合计</td>';
    h += '<td style="padding:8px;text-align:right;font-family:var(--fm)">¥' + fmtC(total) + '</td><td></td></tr>';
    h += '</table></div>';

    showModal(h, 750);
}

// 打印费用PDF（在新窗口中生成适合打印的HTML）
function printExpPDF() {
    var items = window._expPDFItems;
    var total = window._expPDFTotal;
    var startLabel = window._expPDFStart;
    var endLabel = window._expPDFEnd;
    if (!items) { toast('请先预览'); return; }

    var rows = '';
    items.forEach(function(e) {
        var dateLabel = e.date.substring(5).replace('-', '/');
        rows += '<tr>';
        rows += '<td>' + dateLabel + '</td>';
        rows += '<td>' + e.category + (e.note ? ' · ' + e.note : '') + '</td>';
        rows += '<td class="nr">¥' + fmtC(e.amount) + '</td>';
        rows += '<td style="text-align:center">';
        if (e.photoFile) rows += '<img src="' + e.photoFile + '" style="max-width:60px;max-height:40px;border-radius:4px;border:1px solid #ddd">';
        else rows += '-';
        rows += '</td></tr>';
    });

    var html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>费用报告</title>';
    html += '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;600;700&family=Lexend:wght@300;400;500;600&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">';
    html += '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Noto Sans SC",sans-serif;padding:40px;max-width:800px;margin:auto;color:#2c2c2c;line-height:1.8;font-size:13px}';
    html += '@media print{body{padding:20px}tr{page-break-inside:avoid}img{max-width:50px!important}}';
    html += '.header{text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #b08d57}';
    html += '.header h1{font-family:"Playfair Display",serif;font-size:1.4rem;color:#b08d57}.header .sub{color:#888;font-size:.78rem;letter-spacing:.15em}.header .period{color:#555;font-size:.82rem;margin-top:8px}';
    html += 'table{width:100%;border-collapse:collapse;font-size:.82rem;margin-bottom:8px}';
    html += 'th{background:#f0ece4;padding:8px 12px;text-align:left;font-weight:600;color:#666;font-size:.72rem;border-bottom:1px solid #ddd}';
    html += 'td{padding:8px 12px;border-bottom:1px solid #eee;color:#333}';
    html += '.nr{text-align:right;font-family:"Lexend",monospace}tr.total{background:#f8f6f0;font-weight:600}tr.total td{border-top:2px solid #b08d57}';
    html += '.footer{text-align:center;color:#aaa;font-size:.68rem;margin-top:30px;padding-top:12px;border-top:1px solid #eee}';
    html += '.print-bar{position:fixed;bottom:20px;right:20px;display:flex;gap:8px;z-index:100}';
    html += '.print-btn{padding:10px 20px;border:none;border-radius:8px;font-size:.82rem;cursor:pointer;transition:all .2s}';
    html += '.print-btn.primary{background:#b08d57;color:#fff}.print-btn.secondary{background:#f0ece4;color:#333;border:1px solid #ddd}';
    html += '.print-btn:hover{opacity:.85}@media print{.print-bar{display:none}}</style></head><body>';

    html += '<div class="print-bar no-print"><button class="print-btn secondary" onclick="window.close()">关闭</button>';
    html += '<button class="print-btn primary" onclick="window.print()">打印 / 导出PDF</button></div>';

    html += '<div class="header"><h1>' + (localStorage.getItem('ax_shop_name') || '经营管理') + ' · 费用报告</h1>';
    html += '<div class="sub">ANSHIANG COFFEE EXPENSE REPORT</div>';
    html += '<div class="period">' + startLabel + ' — ' + endLabel + '</div></div>';

    html += '<table><tr><th>日期</th><th>分类/备注</th><th class="nr">金额</th><th style="text-align:center">图片</th></tr>';
    html += rows;
    html += '<tr class="total"><td colspan="2">合计</td><td class="nr">¥' + fmtC(total) + '</td><td></td></tr></table>';

    html += '<div class="footer">' + (localStorage.getItem('ax_shop_name') || '经营管理') + ' · ' + td() + ' 生成</div></body></html>';

    var win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); setTimeout(function(){win.print();},500); }
    else toast('弹窗被拦截');
}

// 执行导出费用PDF的操作
function doExportExpPDF() {
    var startDate = $id('pdfStart').value;
    var endDate = $id('pdfEnd').value;
    if (!startDate || !endDate) { toast('请选择起止日期'); return; }
    if (startDate > endDate) { var t = startDate; startDate = endDate; endDate = t; }

    var items = DB.expenses.filter(function(e) { return e.date >= startDate && e.date <= endDate; });
    items.sort(function(a, b) { return a.date.localeCompare(b.date); });
    if (!items.length) { toast('该时间段无费用记录'); return; }

    closeModal();
    var total = items.reduce(function(s, e) { return s + e.amount; }, 0);
    var days = {};
    items.forEach(function(e) {
        if (!days[e.date]) days[e.date] = [];
        days[e.date].push(e);
    });
    var dateCount = Object.keys(days).length;

    // 分类汇总
    var catTotals = {};
    items.forEach(function(e) {
        if (!catTotals[e.category]) catTotals[e.category] = 0;
        catTotals[e.category] += e.amount;
    });

    // 每日明细行
    var dailyRows = '';
    var dateKeys = Object.keys(days).sort();
    var idx = 0;
    dateKeys.forEach(function(date) {
        var dayItems = days[date];
        var dayTotal = dayItems.reduce(function(s, e) { return s + e.amount; }, 0);
        var dateLabel = date.substring(5).replace('-', '/');

        dailyRows += '<tr style="background:#f8f6f0"><td colspan="4" style="font-weight:700;color:#b08d57;padding:8px 10px">' + dateLabel + '  <span style="font-family:Lexend,monospace;color:#555">¥' + fmtC(dayTotal) + '</span></td></tr>';

        dayItems.forEach(function(e) {
            idx++;
            dailyRows += '<tr><td style="padding-left:24px">' + idx + '</td>';
            dailyRows += '<td>' + e.category + '</td>';
            dailyRows += '<td class="nr">¥' + fmtC(e.amount) + '</td>';
            dailyRows += '<td>' + (e.note || '-') + '</td></tr>';
        });
    });

    // 分类行
    var catRows = '';
    Object.keys(catTotals).sort(function(a, b) { return catTotals[b] - catTotals[a]; }).forEach(function(cat) {
        catRows += '<tr><td>' + cat + '</td><td class="nr">¥' + fmtC(catTotals[cat]) + '</td>';
        catRows += '<td class="nr">' + (total > 0 ? (catTotals[cat] / total * 100).toFixed(1) : 0) + '%</td></tr>';
    });

    var startLabel = startDate.replace(/-/g, '/');
    var endLabel = endDate.replace(/-/g, '/');

    var html = '<!DOCTYPE html><html lang="zh-CN"><head><meta charset="UTF-8"><title>费用报告 - ' + startLabel + ' 至 ' + endLabel + '</title>';
    html += '<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+SC:wght@300;400;600;700&family=Lexend:wght@300;400;500;600&family=Playfair+Display:wght@400;700&display=swap" rel="stylesheet">';
    html += '<style>*{margin:0;padding:0;box-sizing:border-box}body{font-family:"Noto Sans SC",sans-serif;padding:40px;max-width:800px;margin:auto;color:#2c2c2c;line-height:1.8;font-size:13px}';
    html += '@media print{body{padding:20px}.no-print{display:none!important}tr{page-break-inside:avoid}}';
    html += '.header{text-align:center;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #b08d57}';
    html += '.header h1{font-family:"Playfair Display",serif;font-size:1.4rem;color:#b08d57}.header .sub{color:#888;font-size:.78rem;letter-spacing:.15em}.header .period{color:#555;font-size:.82rem;margin-top:8px}';
    html += '.metrics{display:grid;grid-template-columns:repeat(4,1fr);gap:12px;margin-bottom:24px}';
    html += '.metric{background:#f8f6f0;border:1px solid #e8e2d8;border-radius:8px;padding:12px;text-align:center}.metric .label{font-size:.7rem;color:#888}.metric .value{font-family:"Lexend",monospace;font-size:1.05rem;font-weight:600;margin-top:4px;color:#b08d57}';
    html += '.section{margin-bottom:20px}.section h2{font-size:.9rem;color:#b08d57;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #e8e2d8}';
    html += 'table{width:100%;border-collapse:collapse;font-size:.8rem;margin-bottom:8px}th{background:#f0ece4;padding:7px 10px;text-align:left;font-weight:600;color:#666;font-size:.72rem;border-bottom:1px solid #ddd}td{padding:6px 10px;border-bottom:1px solid #eee;color:#333}';
    html += '.nr{text-align:right;font-family:"Lexend",monospace}tr.total{background:#f8f6f0;font-weight:600}tr.total td{border-top:2px solid #b08d57}';
    html += '.footer{text-align:center;color:#aaa;font-size:.68rem;margin-top:30px;padding-top:12px;border-top:1px solid #eee}';
    html += '.print-bar{position:fixed;bottom:20px;right:20px;display:flex;gap:8px;z-index:100}';
    html += '.print-btn{padding:10px 20px;border:none;border-radius:8px;font-size:.82rem;cursor:pointer;transition:all .2s}.print-btn.primary{background:#b08d57;color:#fff}.print-btn.secondary{background:#f0ece4;color:#333;border:1px solid #ddd}';
    html += '.print-btn:hover{opacity:.85}@media print{.print-bar{display:none}}</style></head><body>';

    html += '<div class="print-bar no-print"><button class="print-btn secondary" onclick="window.close()">关闭</button><button class="print-btn primary" onclick="window.print()">打印 / 导出PDF</button></div>';

    html += '<div class="header"><h1>' + (localStorage.getItem('ax_shop_name') || '经营管理') + ' · 费用报告</h1>';
    html += '<div class="sub">ANSHIANG COFFEE EXPENSE REPORT</div>';
    html += '<div class="period">' + startLabel + ' — ' + endLabel + '</div></div>';

    html += '<div class="metrics">';
    html += '<div class="metric"><div class="label">合计费用</div><div class="value">¥' + fmtC(total) + '</div></div>';
    html += '<div class="metric"><div class="label">总笔数</div><div class="value">' + items.length + '</div></div>';
    html += '<div class="metric"><div class="label">天数</div><div class="value">' + dateCount + '</div></div>';
    html += '<div class="metric"><div class="label">日均</div><div class="value">¥' + fmtC(total / dateCount) + '</div></div>';
    html += '</div>';

    // 费用分类汇总
    html += '<div class="section"><h2>费用分类汇总</h2>';
    html += '<table><tr><th>分类</th><th class="nr">金额</th><th class="nr">占比</th></tr>';
    html += catRows;
    html += '<tr class="total"><td>合计</td><td class="nr">¥' + fmtC(total) + '</td><td class="nr">100%</td></tr></table></div>';

    // 每日明细
    html += '<div class="section"><h2>每日费用明细</h2>';
    html += '<table><tr><th>序号</th><th>分类</th><th class="nr">金额</th><th>备注</th></tr>';
    html += dailyRows;
    html += '<tr class="total"><td colspan="2">合计</td><td class="nr">¥' + fmtC(total) + '</td><td></td></tr></table></div>';

    html += '<div class="footer">' + (localStorage.getItem('ax_shop_name') || '经营管理') + ' · ' + td() + ' 生成</div></body></html>';

    var win = window.open('', '_blank');
    if (win) { win.document.write(html); win.document.close(); toast('费用报告已生成，按 Ctrl+P 打印'); }
    else toast('弹窗被拦截');
}


