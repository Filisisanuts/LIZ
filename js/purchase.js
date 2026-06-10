// ---------- 全局变量 ----------
// 当前编辑的采购单商品列表
var _pmItems = [];
// 当前编辑的采购单 ID（null 表示新建）
var _editPurId = null;
// 百度OCR配置（与MiMo视觉API互为备选）
var _baiduToken = '', _baiduTokenTime = 0;
var _baiduAK = localStorage.getItem('ax_baidu_ak') || '';
var _baiduSK = localStorage.getItem('ax_baidu_sk') || '';
// 采购明细页折叠状态缓存
var _pfFolds = {};

// ==================== 工具函数 ====================

// 解析采购单中的数量单元格（如 "件"、"斤"）
function parseQty(s) {
    var m = s.match(/([\d.]+)\s*(.*)/);
    return { qty: m ? parseFloat(m[1]) : 0, unit: m ? (m[2] || '').trim() : '' };
}

// 解析"数量×规格"格式（如 "2×500g" → { qty: 2, unit: "500g" }）
function parseQU(cell) {
    var clean = cell.replace(/$$[^)]*$$/g, '').trim();
    var parts = clean.split(/[×*]/);
    var qm = parts[0].match(/([\d.]+)/);
    var q = 0, u = '';
    if (qm) {
        q = parseFloat(qm[1]);
        u = parts[0].replace(/[\d.]+/, '').trim();
    }
    return { qty: q, unit: u };
}

// 获取采购行的单价（优先用 unitPrice，没有则用总价÷数量算出）
function getItemUp(item) {
    return item.unitPrice || (item.qty > 0 ? Math.round(item.total / item.qty * 100) / 100 : 0);
}

// 查找商品的历史采购单价（用于价格对比）
// 返回 { date, unitPrice } 或 null
function findPrevPrice(name, currentDate) {
    var best = null;
    DB.purchases.forEach(function(p) {
        if (p.date >= currentDate) return;
        (p.items || []).forEach(function(i) {
            if (i.name === name) {
                var up = getItemUp(i);
                if (up > 0 && (!best || p.date > best.date)) {
                    best = { date: p.date, unitPrice: up };
                }
            }
        });
    });
    return best;
}

// ------ 粘贴解析 ------

// 粘贴解析核心：解析采购单/出库单文字，提取商品信息
// 支持 Tab分隔、Markdown表格、空格分隔 三种格式
// 自动检测区域标题（厨房/吧台/外场）
function parsePurchase(text) {
    var dm = text.match(/(\d{4})[-\/.年]\s*(\d{1,2})[-\/.月]\s*(\d{1,2})/);
    var isAx = /岸香.*贸易|贸易.*岸香/.test(text);

    var r = { date: td(), items: [], source: '岸香贸易' };
    if (dm) r.date = dm[1] + '-' + String(dm[2]).padStart(2, '0') + '-' + String(dm[3]).padStart(2, '0');
    if (isAx) r.source = '岸香贸易';

    var skipRe = /合计|本页|当日|区域汇总|以下是|好的|已删除|不录入/;
    var curSection = '';

    // 解析每一行
    text.split('\n').forEach(function(raw) {
        var l = raw.trim();
        if (!l) return;

        // 去掉行首emoji和特殊符号
        l = l.replace(/^[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]\s*/u, '');
        l = l.replace(/^\*\*/g, '');
        l = l.replace(/^📌\s*/, '');
        l = l.replace(/^>\s*/g, '');

        // 检测区域标题（厨房/吧台/外场）
        var secMatch = l.match(/^(?:#{1,3}\s*)?(厨房|吧台|外场)(?:\s*[·•\-]|$)/);
        if (secMatch) { curSection = secMatch[1]; return; }

        // 跳过非数据行
        if (skipRe.test(l)) return;
        if (/^#{1,6}\s/.test(l)) return;
        if (/^[-—]{3,}$/.test(l)) return;
        if (/^品名/.test(l)) return;

        // ---- Tab分隔行 ----
        if (l.indexOf('\t') >= 0) {
            var cells = l.split('\t').map(function(s) { return s.trim(); });
            if (cells.length >= 4) {
                var name = cells[0];
                if (name.length < 1 || !/[\u4e00-\u9fa5a-zA-Z]/.test(name)) return;

                var qty = 0, unit = '', unitPrice = 0, total = 0, cat = '';

                if (cells.length >= 6) {
                    var q1 = parseQty(cells[2]); qty = q1.qty; unit = q1.unit;
                    var upParts = cells[3].replace(/,/g, '').split('/');
                    unitPrice = parseFloat(upParts[0]) || 0;
                    if (!unit && upParts[1]) unit = upParts[1].trim();
                    total = parseFloat(cells[4].replace(/,/g, '').replace(/\*+$/, '')) || 0;
                    cat = cells[5] || '';
                } else if (cells.length >= 5) {
                    var q2 = parseQty(cells[1]); qty = q2.qty; unit = q2.unit;
                    var upParts2 = cells[2].replace(/,/g, '').split('/');
                    unitPrice = parseFloat(upParts2[0]) || 0;
                    if (!unit && upParts2[1]) unit = upParts2[1].trim();
                    total = parseFloat(cells[3].replace(/,/g, '').replace(/\*+$/, '')) || 0;
                    cat = cells[4] || '';
                } else {
                    var q3 = parseQty(cells[1]); qty = q3.qty; unit = q3.unit;
                    var upParts3 = cells[2].replace(/,/g, '').split('/');
                    unitPrice = parseFloat(upParts3[0]) || 0;
                    if (!unit && upParts3[1]) unit = upParts3[1].trim();
                    total = parseFloat(cells[3].replace(/,/g, '').replace(/\*+$/, '')) || 0;
                }

                if (!unitPrice && total > 0 && qty > 0) unitPrice = Math.round(total / qty * 100) / 100;
                if (qty > 0 && total > 0) {
                    r.items.push({ name: name, section: curSection, category: cat, qty: qty, unit: unit, unitPrice: unitPrice, total: total, source: r.source });
                }
            }
            return;
        }

        // ---- Markdown表格行 ----
        if (/^\|/.test(l)) {
            l = l.replace(/^\|/, '').replace(/\|\s*$/, '');
            var cells = l.split('|').map(function(s) { return s.trim(); });
            if (cells.length > 0 && /^[:\-—]+$/.test(cells[0])) return;

            if (cells.length >= 4) {
                var name = cells[0];
                if (name.length < 1 || !/[\u4e00-\u9fa5a-zA-Z]/.test(name)) return;

                var qty = 0, unit = '', unitPrice = 0, total = 0, cat = '';

                if (cells.length >= 6) {
                    var q1 = parseQty(cells[2]); qty = q1.qty; unit = q1.unit;
                    var upParts = cells[3].replace(/,/g, '').split('/');
                    unitPrice = parseFloat(upParts[0]) || 0;
                    if (!unit && upParts[1]) unit = upParts[1].trim();
                    total = parseFloat(cells[4].replace(/,/g, '').replace(/\*+$/, '')) || 0;
                    cat = cells[5] || '';
                } else if (cells.length >= 5) {
                    var q2 = parseQty(cells[1]); qty = q2.qty; unit = q2.unit;
                    var upParts2 = cells[2].replace(/,/g, '').split('/');
                    unitPrice = parseFloat(upParts2[0]) || 0;
                    if (!unit && upParts2[1]) unit = upParts2[1].trim();
                    total = parseFloat(cells[3].replace(/,/g, '').replace(/\*+$/, '')) || 0;
                    cat = cells[4] || '';
                } else {
                    var q3 = parseQty(cells[1]); qty = q3.qty; unit = q3.unit;
                    var upParts3 = cells[2].replace(/,/g, '').split('/');
                    unitPrice = parseFloat(upParts3[0]) || 0;
                    if (!unit && upParts3[1]) unit = upParts3[1].trim();
                    total = parseFloat(cells[3].replace(/,/g, '').replace(/\*+$/, '')) || 0;
                }

                if (!unitPrice && total > 0 && qty > 0) unitPrice = Math.round(total / qty * 100) / 100;
                if (qty > 0 && total > 0) {
                    r.items.push({ name: name, section: curSection, category: cat, qty: qty, unit: unit, unitPrice: unitPrice, total: total, source: r.source });
                }
            }
            return;
        }

        // ---- 空格分隔行 ----
        var m = l.match(/^(.+)\s+(\d+\.?\d*\S*)\s+(\d+\.?\d*\S*)\s+(\d+\.?\d*)\s*$/);
        if (!m) return;

        var name = m[1].trim();
        if (name.length < 1 || !/[\u4e00-\u9fa5a-zA-Z]/.test(name)) return;

        var qm = m[2].match(/([\d.]+)\s*(.*)/);
        var qty = qm ? parseFloat(qm[1]) : 0;
        var unit = qm ? (qm[2] || '').trim() : '';

        var upParts = m[3].replace(/,/g, '').split('/');
        var unitPrice = parseFloat(upParts[0]) || 0;
        if (!unit && upParts[1]) unit = upParts[1].trim();

        var total = parseFloat(m[4].replace(/,/g, '')) || 0;

        if (!unitPrice && total > 0 && qty > 0) unitPrice = Math.round(total / qty * 100) / 100;
        if (qty > 0 && total > 0) {
            r.items.push({ name: name, section: curSection, category: '', qty: qty, unit: unit, unitPrice: unitPrice, total: total, source: r.source });
        }
    });

    // 数量校正：如果单价×数量≠总价，用总价÷单价反推数量
    r.items.forEach(function(item) {
        if (item.total > 0 && item.unitPrice > 0) {
            var eq = Math.round(item.total / item.unitPrice);
            if (eq > 0 && eq !== item.qty) item.qty = eq;
        }
    });

    return r;
}

// 粘贴解析入口：调用 parsePurchase 解析文字 → 填入手动录入表单
function doParsePur() {
    var text = $id('ptInput').value.trim();
    if (!text) { toast('请先粘贴采购单文字'); return; }

    var result = parsePurchase(text);
    if (!result.items.length) { toast('未识别到物品，请检查文字格式'); return; }

    // 转换为统一格式
    _pmItems = result.items.map(function(item) {
        var qty = parseFloat(item.qty) || 0;
        var total = parseFloat(item.total) || 0;
        var unitPrice = parseFloat(item.unitPrice) || 0;
        if (!unitPrice && total > 0 && qty > 0) unitPrice = Math.round(total / qty * 100) / 100;
        return {
            name: fixBrackets(item.name || ''),
            section: item.section || '',
            category: '',
            qty: qty,
            unit: item.unit || '',
            unitPrice: unitPrice,
            total: total,
            source: result.source || '岸香贸易'
        };
    });

    // 切换到手动标签页，填入日期和来源
    switchPT('manual');
    setTimeout(function() {
        if ($id('pmDate')) $id('pmDate').value = result.date;
        if ($id('pmSrc')) $id('pmSrc').value = '岸香贸易';
        renderPML();
        toast('已识别 ' + _pmItems.length + ' 项物品');
    }, 100);
}

// ------ 采购主页 ------

// 采购主页：三个标签页（粘贴/手动/明细）
function rPurchase() {
    var secs = ['厨房', '吧台', '外场'];
    var cats = getPurCats();
    var h = '';

    // 标签栏
    h += '<div class="tab-bar" id="pT">';
    h += '<button class="tab-btn active" onclick="switchPT(\'text\')">粘贴</button>';
    h += '<button class="tab-btn" onclick="switchPT(\'manual\')">手动</button>';
    h += '<button class="tab-btn" onclick="switchPT(\'hist\')">明细</button>';
    h += '</div>';

    // 粘贴页
    h += '<div id="pText">';
    h += '<textarea id="ptInput" class="inp" placeholder="粘贴采购单文字...&#10;支持出库单、送货单等格式"></textarea>';
    h += '<div class="brow" style="display:flex;gap:8px;flex-wrap:wrap">';
    h += '<button class="btn p" onclick="doParsePur()">本地解析</button>';
    h += '<button class="btn p" onclick="doAIParse()">AI图片识别</button>';
    h += '</div></div>';

    // 手动录入页
    h += '<div id="pMan" style="display:none">';

    // 日期和来源
    h += '<div class="hrow">';
    h += '<label>日期</label><input class="inp" id="pmDate" type="text" readonly placeholder="选择日期" value="' + td() + '" onclick="_dpOpen(\'pmDate\')" style="max-width:150px;cursor:pointer">';
    h += '<label>来源</label><select class="inp" id="pmSrc" style="max-width:120px">';
    h += '<option>岸香贸易</option><option>外购</option></select>';
    h += '</div>';

    // 区域和分类
    h += '<div class="hrow">';
    h += '<label>区域</label>';
    h += '<select class="inp" id="pmSec" style="max-width:110px" onchange="pmSecChanged(this)">';
    h += '<option value="">请选择</option>';
    secs.forEach(function(s) { h += '<option>' + s + '</option>'; });
    h += '<option value="__custom">自定义</option>';
    h += '</select>';
    h += '<input class="inp" id="pmSecC" style="display:none;max-width:110px" placeholder="输入区域">';
    h += '<label>分类</label>';
    h += '<select class="inp" id="pmCat" style="max-width:130px" onchange="toggleCustomInput(this,\'pmCatC\')">';
    h += '<option value="">请先选区域</option>';
    h += '</select>';
    h += '<input class="inp" id="pmCatC" style="display:none;max-width:130px" placeholder="输入分类">';
    h += '<button class="btn s" onclick="manageCats()">管理</button>';
    h += '</div>';

    // 品名、数量、单位、单价、总价、添加按钮
    h += '<div class="hrow">';
    h += '<label>品名</label><input class="inp" id="pmName" style="flex:1.5">';
    h += '<label>数量</label><input class="inp" id="pmQty" type="number" step="0.01" style="max-width:55px" oninput="calcUnitPrice()">';
    h += '<input class="inp" id="pmUnit" placeholder="单位" style="max-width:52px">';
    h += '<label>单价</label><input class="inp" id="pmUnitPrice" type="number" step="0.01" style="max-width:80px" oninput="calcTotal()">';
    h += '<label>总价</label><input class="inp" id="pmTotal" type="number" step="0.01" style="max-width:90px">';
    h += '<button class="btn" onclick="addPurItem()">+添加</button>';
    h += '</div>';

    // 物品列表
    h += '<div id="pmList"></div>';

    // 保存按钮
    h += '<div class="brow" style="margin-top:10px">';
    h += '<button class="btn p" onclick="saveMPur()">保存</button>';
    h += '</div>';
    h += '</div>';

    // 明细页
    h += '<div id="pHist" style="display:none">';
    h += '<div class="hrow"><label>月份</label>';
    h += '<button class="btn s" onclick="purchaseCalNav(-1)">◀</button>';
    h += '<input class="inp" id="pHistM" type="text" readonly placeholder="选择月份" value="' + curYM() + '" onclick="_mpOpen(\'pHistM\')" onchange="purchaseCalPickYM(this.value)" style="max-width:180px;cursor:pointer">';
    h += '<button class="btn s" onclick="purchaseCalNav(1)">▶</button>';
    h += '</div>';
    h += '<div id="pHistArea"></div>';
    h += '</div>';

    setMain('采购', h);
    setTimeout(renderPHist, 100);
}

// 切换采购标签页（粘贴/手动/明细）
function switchPT(t) {
    var tabs = ['text', 'manual', 'hist'];
    document.querySelectorAll('#pT .tab-btn').forEach(function(b, i) {
        b.classList.toggle('active', tabs[i] === t);
    });
    ['pText', 'pMan', 'pHist'].forEach(function(id, i) {
        var el = $id(id);
        if (el) el.style.display = tabs[i] === t ? '' : 'none';
    });
    if (t === 'manual' && _pmItems.length === 0 && !_editPurId) _pmItems = [];
    renderPML();
    if (t === 'hist') setTimeout(renderPHist, 50);
}

// ------ 手动录入表单交互 ------

// 采购主页面的区域下拉变化：更新分类下拉选项
function pmSecChanged(sel) {
    var area = sel.value;
    var catSel = $id('pmCat');
    var customInput = $id('pmSecC');

    if (area === '__custom') {
        customInput.style.display = '';
        sel.style.display = 'none';
        return;
    }

    customInput.style.display = 'none';
    var cats = getPurCats(area);
    var html = '<option value="">请选择</option>';
    cats.forEach(function(c) { html += '<option>' + c + '</option>'; });
    html += '<option value="__custom">自定义</option>';
    catSel.innerHTML = html;
    $id('pmCatC').style.display = 'none';
}

// 批量填充时区域下拉变化：更新分类下拉选项
function batchSecChanged(sel) {
    var area = sel.value;
    var catSel = $id('pmBatchCat');
    if (!catSel) return;

    if (!area) {
        catSel.innerHTML = '<option value="">请先选区域</option>';
        return;
    }

    var cats = getPurCats(area);
    var html = '<option value="">不填充</option>';
    cats.forEach(function(c) { html += '<option>' + c + '</option>'; });
    catSel.innerHTML = html;
}

// 批量填充手动录入表格中所有行的来源/区域/分类
function batchFillAll() {
    var src = ($id('pmBatchSrc') || {}).value || '';
    var sec = ($id('pmBatchSec') || {}).value || '';
    var cat = ($id('pmBatchCat') || {}).value || '';
    if (!src && !sec && !cat) { toast('请选择要填充的值'); return; }

    _pmItems.forEach(function(item) {
        if (src) item.source = src;
        if (sec) item.section = sec;
        if (cat) item.category = cat;
    });

    renderPML();
    toast('已填充全部');
}

// 手动录入表格：强制覆盖所有行的指定字段
function batchSetField(field, value) {
    if (!value) return;
    _pmItems.forEach(function(item) { item[field] = value; });
    renderPML();
    toast('已填充');
}

// 自动计算单价：总价 ÷ 数量
function calcUnitPrice() {
    var q = parseFloat($id('pmQty').value);
    var t = parseFloat($id('pmTotal').value);
    if (q > 0 && t > 0) $id('pmUnitPrice').value = (Math.round(t / q * 100) / 100).toFixed(2);
}

// 自动计算总价：数量 × 单价
function calcTotal() {
    var q = parseFloat($id('pmQty').value);
    var up = parseFloat($id('pmUnitPrice').value);
    if (q > 0 && up > 0) $id('pmTotal').value = (Math.round(q * up * 100) / 100).toFixed(2);
}

// 添加单个物品到采购列表
// 填完品名、数量、单价/总价后点"添加"，自动清空输入框并聚焦品名
function addPurItem() {
    var n = $id('pmName').value.trim();
    if (!n) { toast('填品名'); return; }

    var q = parseFloat($id('pmQty').value) || 0;
    var t = parseFloat($id('pmTotal').value) || 0;
    var up = parseFloat($id('pmUnitPrice').value) || 0;

    if (!up && q > 0 && t > 0) up = Math.round(t / q * 100) / 100;

    var sec = getSelVal('pmSec', 'pmSecC');
    var cat = getSelVal('pmCat', 'pmCatC');

    _pmItems.push({
        name: fixBrackets(n), section: sec, category: cat,
        qty: q, unit: $id('pmUnit').value.trim(),
        unitPrice: up, total: t, source: $id('pmSrc').value
    });

    // 聚焦品名并选中文本，方便连续输入
    $id('pmName').focus();
    $id('pmName').select();
    $id('pmQty').value = '';
    $id('pmTotal').value = '';
    $id('pmUnitPrice').value = '';
    $id('pmUnit').value = '';

    renderPML();
}

// ------ 手动录入表格渲染 ------

// 重建表格行中的下拉框（区域或分类）
// 自动选中当前值，不在预设中则追加选中项
function rebuildSel(sel, field, value) {
    var presets = field === 'section' ? ['厨房', '吧台', '外场'] : getPurCats();
    var html = '<option value="">-</option>';
    presets.forEach(function(o) { html += '<option' + (o === value ? ' selected' : '') + '>' + o + '</option>'; });
    if (value && presets.indexOf(value) < 0) html += '<option selected>' + value + '</option>';
    html += '<option value="__custom">自定义</option><option value="__clear">清除</option>';
    sel.innerHTML = html;
}

// 渲染采购物品列表表格：批量填充区域 + 可编辑物品行 + 合计
function renderPML() {
    var el = $id('pmList');
    if (!el) return;

    var secs = ['厨房', '吧台', '外场'];
    var srcs = ['岸香贸易', '外购'];
    var h = '';

    // 批量填充区域
    if (_pmItems.length > 0) {
        h += '<div style="margin-bottom:10px;padding:10px;background:var(--card-h);border:1px solid var(--bd);border-radius:var(--r)">';
        h += '<div style="font-size:.7rem;color:var(--ac);margin-bottom:6px">批量填充:</div>';

        h += '<div class="hrow"><label>来源</label>';
        h += '<select class="inp" id="pmBatchSrc" style="max-width:110px"><option value="">不填充</option>';
        srcs.forEach(function(s) { h += '<option>' + s + '</option>'; });
        h += '</select></div>';

        h += '<div class="hrow"><label>区域</label>';
        h += '<select class="inp" id="pmBatchSec" style="max-width:110px" onchange="batchSecChanged(this)"><option value="">不填充</option>';
        secs.forEach(function(s) { h += '<option>' + s + '</option>'; });
        h += '</select>';
        h += '<label>分类</label>';
        h += '<select class="inp" id="pmBatchCat" style="max-width:130px"><option value="">请先选区域</option></select>';
        h += '<button class="btn s" onclick="batchFillAll()">全部应用</button>';
        h += '</div>';
        h += '</div>';
    }

    // 物品列表
    if (!_pmItems.length) {
        h += '<div style="font-size:.74rem;color:var(--tx-m);padding:8px 0">无物品</div>';
    } else {
        h += '<div class="tw"><table>';
        h += '<tr><th>品名</th><th>来源</th><th>区域</th><th>分类</th><th>数量</th><th>单位</th><th>单价</th><th>总价</th><th></th></tr>';

        _pmItems.forEach(function(i, idx) {
            var itemCats = getPurCats(i.section);

            h += '<tr>';

            // 品名
            h += '<td><div style="display:flex;flex-direction:column;gap:2px"><input class="pm-edit" style="min-width:110px" value="' + i.name.replace(/"/g, '&quot;') + '" onchange="pmEdit(' + idx + ',\'name\',this.value)">';
            h += getMatchSuggestionHTML(i);
            h += '</div></td>';

            // 来源
            h += '<td><select class="pm-edit" style="width:80px" onchange="pmEdit(' + idx + ',\'source\',this.value)">';
            h += '<option value="">-</option>';
            srcs.forEach(function(s) { h += '<option' + ((i.source || '') === s ? ' selected' : '') + '>' + s + '</option>'; });
            h += '</select></td>';

            // 区域
            h += '<td><select class="pm-edit" style="width:65px" onchange="purAreaChanged(this,' + idx + ')">';
            h += '<option value="">-</option>';
            secs.forEach(function(s) { h += '<option' + (i.section === s ? ' selected' : '') + '>' + s + '</option>'; });
            h += '</select></td>';

            // 分类
            h += '<td><select class="pm-edit" style="width:85px" onchange="pmEditSel(' + idx + ',\'category\',this.value)">';
            h += '<option value="">-</option>';
            itemCats.forEach(function(c) { h += '<option' + (i.category === c ? ' selected' : '') + '>' + c + '</option>'; });
            h += '<option value="__custom">自定义</option><option value="__clear">清除</option></select></td>';

            // 数量
            h += '<td><input class="pm-edit nr" type="number" step="any" style="width:50px" value="' + i.qty + '" onchange="pmEdit(' + idx + ',\'qty\',this.value)"></td>';

            // 单位
            h += '<td><input class="pm-edit" style="width:40px" value="' + (i.unit || '') + '" onchange="pmEdit(' + idx + ',\'unit\',this.value)"></td>';

            // 单价
            h += '<td><input class="pm-edit nr" type="number" step="0.01" style="width:70px" value="' + (i.unitPrice || 0) + '" onchange="pmEdit(' + idx + ',\'unitPrice\',this.value)"></td>';

            // 总价
            h += '<td><input class="pm-edit nr" type="number" step="0.01" style="width:80px" value="' + i.total + '" onchange="pmEdit(' + idx + ',\'total\',this.value)"></td>';

            // 删除
            h += '<td><button class="btn s d" onclick="_pmItems.splice(' + idx + ',1);renderPML()">×</button></td>';

            h += '</tr>';
        });

        // 合计行
        var sum = _pmItems.reduce(function(s, i) { return s + (i.total || 0); }, 0);
        h += '</table>';
        h += '<div style="display:flex;justify-content:flex-end;align-items:center;padding:8px 10px;font-size:.82rem;font-weight:700">';
        h += '<span style="color:var(--tx-m)">本次合计：</span>';
        h += '<span style="color:var(--ac);font-family:var(--fm);margin-left:6px">¥' + fmtC(sum) + '</span>';
        h += '</div></div>';
    }

    el.innerHTML = h;
}

// 表格单元格编辑：更新 _pmItems 中指定行的字段
function pmEdit(idx, field, val) {
    if (!_pmItems[idx]) return;
    if (field === 'qty' || field === 'total' || field === 'unitPrice') {
        _pmItems[idx][field] = parseFloat(val) || 0;
    } else {
        _pmItems[idx][field] = val;
    }
}

// 处理分类/区域下拉框的特殊值：__custom（弹窗输入）、__clear（清空）
function pmEditSel(idx, field, val) {
    if (val === '__clear') { _pmItems[idx][field] = ''; renderPML(); return; }
    if (val === '__custom') {
        setTimeout(function() {
            var v = prompt('输入' + (field === 'section' ? '区域' : '分类'));
            if (!v || !v.trim()) { renderPML(); return; }
            v = v.trim();
            _pmItems[idx][field] = v;
            var row = document.querySelectorAll('#pmList .tw table tr')[idx + 1];
            if (row) {
                var sels = row.querySelectorAll('select');
                var si = field === 'section' ? 0 : 1;
                if (sels[si]) {
                    var found = false;
                    for (var i = 0; i < sels[si].options.length; i++) {
                        if (sels[si].options[i].value === v) { found = true; break; }
                    }
                    if (!found) {
                        var opt = document.createElement('option');
                        opt.text = v;
                        sels[si].insertBefore(opt, sels[si].querySelector('[value="__custom"]'));
                    }
                    sels[si].value = v;
                }
            }
        }, 50);
        return;
    }
    _pmItems[idx][field] = val;
}

// ------ 分类管理 ------

// 弹窗管理各区域的分类
function manageCats() {
    var areas = ['厨房', '吧台', '外场'];
    var h = '<h3>管理分类</h3>';
    h += '<div class="hrow" style="margin-bottom:10px"><label>选择区域</label>';
    h += '<select class="inp" id="macArea" style="max-width:120px" onchange="renderAreaCatsList()">';
    areas.forEach(function(a) { h += '<option>' + a + '</option>'; });
    h += '</select></div>';
    h += '<div class="hrow" style="margin-bottom:10px">';
    h += '<input class="inp" id="newAreaCat" placeholder="输入新分类名称" style="flex:2">';
    h += '<button class="btn p" onclick="addAreaCat()">添加</button></div>';
    h += '<div id="macList"></div>';
    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end"><button class="btn" onclick="closeModal()">关闭</button></div>';
    showModal(h, 500);
    renderAreaCatsList();
}

// 渲染当前区域的分类列表
function renderAreaCatsList() {
    var area = $id('macArea').value;
    var cats = DB.areaCats[area] || [];
    var h = '';
    if (!cats.length) {
        h += '<div style="text-align:center;padding:20px;color:var(--tx-m)">该区域暂无分类</div>';
    } else {
        h += '<div class="tw"><table><tr><th>分类名称</th><th>使用次数</th><th>操作</th></tr>';
        cats.forEach(function(cat) {
            var count = 0;
            DB.purchases.forEach(function(p) {
                p.items.forEach(function(i) {
                    if ((i.section || '') === area && i.category === cat) count++;
                });
            });
            h += '<tr><td>' + cat + '</td><td class="nr">' + count + '</td>';
            h += '<td><button class="btn s d" onclick="delAreaCat(' + sq(cat) + ')">删除</button></td></tr>';
        });
        h += '</table></div>';
    }
    $id('macList').innerHTML = h;
}

// 添加新分类到指定区域
function addAreaCat() {
    var area = $id('macArea').value;
    var name = $id('newAreaCat').value.trim();
    if (!name) { toast('输入分类名称'); return; }
    if (!DB.areaCats[area]) DB.areaCats[area] = [];
    if (DB.areaCats[area].indexOf(name) >= 0) { toast('该区域已有此分类'); return; }
    DB.areaCats[area].push(name);
    saveDB(DB);
    sbScheduleSave;
    $id('newAreaCat').value = '';
    toast('已添加 ' + name);
    renderAreaCatsList();
}

// 删除指定区域的分类（同时清空采购记录中的该分类）
function delAreaCat(name) {
    var area = $id('macArea').value;
    if (!confirm('彻底删除"' + area + '"下的"' + name + '"？\n已使用该分类的采购记录中的分类会被清空')) return;
    DB.areaCats[area] = (DB.areaCats[area] || []).filter(function(c) { return c !== name; });
    DB.purchases.forEach(function(p) {
        p.items.forEach(function(i) {
            if ((i.section || '') === area && i.category === name) i.category = '';
        });
    });
    saveDB(DB);
    sbScheduleSave;
    toast('已删除');
    renderAreaCatsList();
}

// ------ 识别结果确认弹窗 ------

// 批量填充识别结果的区域或分类（强制覆盖全部行）
// 通用函数，同时支持粘贴解析和AI识别
function batchFill(field, source) {
    var r = source === 'parse' ? window._parseResult : window._mimoResult;
    if (!r) return;

    var prefix = source === 'parse' ? 'parse' : 'mimo';
    var selId = field === 'section' ? prefix + 'BatchSec' : prefix + 'BatchCat';
    var sel = document.getElementById(selId);
    var val = sel.value;

    if (val === '__custom') {
        var inpId = selId + 'C';
        var inp = document.getElementById(inpId);
        val = inp ? inp.value.trim() : '';
        if (!val) { toast('请输入自定义值'); return; }
    }
    if (!val) return;

    var rows = document.getElementById('parseTbl').querySelectorAll('tr');
    r.items.forEach(function(item, idx) {
        item[field] = val;

        var row = rows[idx + 1];
        if (!row) return;
        var sels = row.querySelectorAll('select');
        var si = field === 'section' ? 0 : 1;
        var targetSel = sels[si];
        if (!targetSel) return;

        var found = false;
        for (var i = 0; i < targetSel.options.length; i++) {
            if (targetSel.options[i].value === val) { found = true; break; }
        }
        if (!found) {
            var opt = document.createElement('option');
            opt.value = opt.text = val;
            targetSel.insertBefore(opt, targetSel.querySelector('[value="__custom"]'));
        }
        targetSel.value = val;
    });

    toast('已填充 ' + r.items.length + ' 项');
}

// 兼容旧调用
function parseBatchFill(field) { batchFill(field, 'parse'); }
function mimoBatchFill(field) { batchFill(field, 'mimo'); }

// 修改识别结果中单个物品的字段（支持 __clear / __custom）
function parseResFieldChange(idx, field, val) {
    var r = window._parseResult;
    if (!r || !r.items[idx]) return;

    var tbl = $id('parseTbl');
    if (!tbl) return;
    var rows = tbl.querySelectorAll('tr');
    var row = rows[idx + 1];
    if (!row) return;
    var sels = row.querySelectorAll('select');
    var si = field === 'section' ? 0 : 1;
    var sel = sels[si];
    if (!sel) return;

    if (val === '__clear') { r.items[idx][field] = ''; rebuildSel(sel, field, ''); return; }
    if (val === '__custom') {
        var prev = r.items[idx][field] || '';
        rebuildSel(sel, field, prev);
        setTimeout(function() {
            var v = prompt('输入' + (field === 'section' ? '区域' : '分类'));
            if (!v || !v.trim()) return;
            r.items[idx][field] = v.trim();
            rebuildSel(sel, field, v.trim());
        }, 50);
        return;
    }
    r.items[idx][field] = val;
}

// 确认AI识别结果并导入手动录入表单
function doMimoConfirm() {
    var r = window._mimoResult;
    if (!r) return;
    var src = $id('pResSrc').value || '岸香贸易';
    r.items.forEach(function(item) { item.source = src; });
    _pmItems = JSON.parse(JSON.stringify(r.items));
    _editPurId = null;
    closeModal();
    $id('pmDate').value = r.date;
    $id('pmSrc').value = src;
    switchPT('manual');
    renderPML();
    toast('已导入 ' + _pmItems.length + ' 项，请检查后保存');
}

// ------ 保存采购单 ------

// 保存采购单：判断是新建还是编辑
function saveMPur() {
    if (!_pmItems.length) { toast('无物品'); return; }

    var savedItems = JSON.parse(JSON.stringify(_pmItems));
    var savedDate = $id('pmDate').value || td();
    var savedSrc = $id('pmSrc').value || '外购';

    if (_editPurId) {
        upd(function(db) {
            var idx = db.purchases.findIndex(function(p) { return p.id == _editPurId; });
            if (idx >= 0) {
                db.purchases[idx].items = savedItems;
                db.purchases[idx].date = savedDate;
                db.purchases[idx].source = savedSrc;
            }
        });
        toast('已更新');
        _editPurId = null;
    } else {
        upd(function(db) {
            db.purchases.push({ id: 'p_' + Date.now(), date: savedDate, source: savedSrc, items: savedItems });
        });
        toast('已保存');
    }

    _pmItems = [];
    checkPurInvLink(savedItems, savedDate);
}

// ------ 采购入库联动 ------

// 保存后检查采购物品是否匹配库存，弹窗让用户确认入库
function checkPurInvLink(purItems, date) {
    var matches = [];

    purItems.forEach(function(pi) {
        var name = pi.name.trim();
        function matchList(list, type) {
            list.forEach(function(item) {
                if (item.name === name || name.indexOf(item.name) >= 0 || item.name.indexOf(name) >= 0) {
                    matches.push({ type: type, inv: item, pur: pi });
                }
            });
        }
        matchList(DB.teaItems, 'tea');
        matchList(DB.cigItems, 'cig');
        matchList(DB.alcItems, 'alc');
        matchList(DB.whItems, 'wh');
    });

    if (!matches.length) { rPurchase(); return; }

    // 去重
    var seen = {};
    var uniq = matches.filter(function(m) {
        var key = m.type + '_' + m.inv.id + m.pur.name;
        if (seen[key]) return false;
        seen[key] = true;
        return true;
    });

    var labels = { tea: '🍵茗茶', cig: '🚬香烟', alc: '🍺酒类', wh: '📦仓库' };
    var h = '<h3>采购入库联动</h3>';
    h += '<p style="font-size:.78rem;color:var(--tx-s);margin-bottom:10px">以下采购物品匹配到库存，可修改入库数量：</p>';

    uniq.forEach(function(m, idx) {
        var unit = { tea: '克', cig: '包', alc: '瓶', wh: m.inv.unit || '' }[m.type];
        var stockQty = m.pur.qty;

        // 单位换算
        if (m.type === 'tea' && m.inv.calcMode === 'pack') {
            unit = '包';
            if (m.pur.unit === '斤') stockQty = Math.round(m.pur.qty * 500 / (m.inv.gramsPerPack || 250));
        } else if (m.type === 'tea') {
            if (m.pur.unit === '斤') stockQty = m.pur.qty * 500;
        } else if (m.type === 'cig') {
            if (m.pur.unit === '条') stockQty = m.pur.qty * (m.inv.purchaseConvRatio || 10);
        } else if (m.type === 'alc') {
            if (m.pur.unit === '箱') stockQty = m.pur.qty * (m.inv.purchaseConvRatio || 12);
        }
        stockQty = Math.round(stockQty * 100) / 100;

        h += '<div class="item-card" style="flex-wrap:wrap;gap:6px">';
        h += '<div style="display:flex;align-items:center;gap:6px;flex:1;min-width:200px">';
        h += '<input type="checkbox" id="plink_' + idx + '" checked style="transform:scale(1.3)">';
        h += '<span class="badge">' + labels[m.type] + '</span> <b>' + m.inv.name + '</b></div>';
        h += '<div style="display:flex;align-items:center;gap:6px">';
        h += '<span style="font-size:.72rem;color:var(--tx-m)">' + m.pur.qty + (m.pur.unit || '') + '</span>';
        h += '<span style="font-size:.72rem;color:var(--ac)">→</span>';
        h += '<input class="inp" id="plink_qty_' + idx + '" type="number" step="any" style="width:80px;padding:4px 6px;font-size:.82rem" value="' + stockQty + '">';
        h += '<span style="font-size:.78rem">' + unit + '</span>';
        h += '</div></div>';
    });

    h += '<div class="brow" style="margin-top:14px;justify-content:flex-end;gap:10px">';
    h += '<button class="btn p" onclick="doPurInvLink()">确认入库</button>';
    h += '<button class="btn" onclick="closeModal();rPurchase()">跳过</button></div>';

    showModal(h);
    window._purLinkUniq = uniq;
    window._purLinkDate = date;
}

// 执行采购入库
function doPurInvLink() {
    var uniq = window._purLinkUniq;
    var date = window._purLinkDate;
    if (!uniq) return;
    var count = 0;

    uniq.forEach(function(m, idx) {
        var cb = $id('plink_' + idx);
        if (!cb || !cb.checked) return;

        var qtyInput = $id('plink_qty_' + idx);
        var stockQty = qtyInput ? parseFloat(qtyInput.value) || 0 : m.pur.qty;
        if (stockQty <= 0) return;
        stockQty = Math.round(stockQty * 100) / 100;

        if (m.type === 'wh') {
            upd(function(db) {
                var it = db.whItems.find(function(i) { return i.id === m.inv.id; });
                if (!it) return;
                if (!it.movements) it.movements = [];
                it.movements.push({ date: date, qty: stockQty, reason: '采购入库' });
                it.stock = Math.max(0, it.stock + stockQty);
            });
        } else {
            upd(function(db) {
                var it = db[INV[m.type].key].find(function(i) { return i.id === m.inv.id; });
                if (it) it.purchases.push({ date: date, qty: stockQty, source: '采购入库', cost: m.pur.unitPrice || 0 });
            });
        }
        count++;
    });

    closeModal();
    toast(count > 0 ? '已入库 ' + count + ' 项' : '未入库');
    rPurchase();
}

// ------ 编辑/删除采购单 ------

// 编辑采购单：载入手动表单
function editPur(id) {
    var p = DB.purchases.find(function(item) { return item.id == id; });
    if (!p) return;
    _pmItems = JSON.parse(JSON.stringify(p.items));
    _editPurId = id;
    switchPT('manual');
    $id('pmDate').value = p.date;
    $id('pmSrc').value = p.source || '外购';
    renderPML();
    window.scrollTo(0, 0);
}

// 折叠/展开采购明细中的日期分组
function togglePF(id) {
    var body = $id('pfB_' + id);
    if (!body) return;
    var show = body.style.display === 'none';
    body.style.display = show ? '' : 'none';
    var icon = $id('pfI_' + id);
    if (icon) icon.textContent = show ? '▼' : '▶';
}

// 弹窗编辑采购明细中的单个物品
function editPurByDate(date, name) {
    var purchases = DB.purchases.filter(function(pp) { return pp.date === date; });
    if (!purchases.length) return;
    var found = null, foundP = null;
    for (var i = 0; i < purchases.length; i++) {
        for (var k = 0; k < purchases[i].items.length; k++) {
            if (purchases[i].items[k].name === name) {
                found = purchases[i].items[k];
                foundP = purchases[i];
                break;
            }
        }
        if (found) break;
    }
    if (!found) return;

    var secs = ['厨房', '吧台', '外场'];
    var cats = getPurCats(found.section);
    var sources = ['岸香贸易', '外购', '其他'];
    var curSource = found.source || foundP.source || '外购';

    var h = '<h3>编辑物品</h3>';
    h += '<div class="hrow"><label>日期</label><input class="inp" id="epi_date" type="text" readonly placeholder="选择日期" value="' + foundP.date + '" onclick="_dpOpen(\'epi_date\')" style="max-width:160px;cursor:pointer"></div>';
    h += '<div class="hrow"><label>品名</label><input class="inp" id="epi_name" style="flex:2" value="' + found.name.replace(/"/g, '&quot;') + '"></div>';
    h += '<div class="hrow"><label>来源</label><select class="inp" id="epi_source" style="max-width:140px">';
    sources.forEach(function(s) { h += '<option' + (curSource === s ? ' selected' : '') + '>' + s + '</option>'; });
    h += '</select></div>';
    h += '<div class="hrow"><label>区域</label><select class="inp" id="epi_sec" style="max-width:110px" onchange="epiSecChanged(this)">';
    h += '<option value="">-</option>';
    secs.forEach(function(s) { h += '<option' + (found.section === s ? ' selected' : '') + '>' + s + '</option>'; });
    h += '</select><label>分类</label><select class="inp" id="epi_cat" style="max-width:130px">';
    h += '<option value="">-</option>';
    cats.forEach(function(c) { h += '<option' + (found.category === c ? ' selected' : '') + '>' + c + '</option>'; });
    h += '</select></div>';
    h += '<div class="hrow">';
    h += '<label>数量</label><input class="inp" id="epi_qty" type="number" step="any" style="max-width:80px" value="' + found.qty + '">';
    h += '<label>单位</label><input class="inp" id="epi_unit" style="max-width:60px" value="' + (found.unit || '') + '">';
    h += '<label>单价</label><input class="inp" id="epi_up" type="number" step="0.01" style="max-width:90px" value="' + (found.unitPrice || 0) + '" oninput="epiCalcTotal()">';
    h += '<label>总价</label><input class="inp" id="epi_total" type="number" step="0.01" style="max-width:100px" value="' + found.total + '">';
    h += '</div>';
    h += '<div class="brow" style="margin-top:14px;justify-content:flex-end">';
    h += '<button class="btn p" onclick="doEditPurItem(' + sq(date) + ',' + sq(name) + ')">保存</button>';
    h += '<button class="btn" onclick="backToPurDetail(\'' + date + '\')">返回</button></div>';
    showModal(h, 550);
}

// 编辑弹窗：区域变化时更新分类下拉
function epiSecChanged(sel) {
    var catSel = $id('epi_cat');
    var cats = getPurCats(sel.value);
    var html = '<option value="">-</option>';
    cats.forEach(function(c) { html += '<option>' + c + '</option>'; });
    catSel.innerHTML = html;
}

// 编辑弹窗：自动计算总价
function epiCalcTotal() {
    var q = parseFloat($id('epi_qty').value) || 0;
    var u = parseFloat($id('epi_up').value) || 0;
    if (q > 0) $id('epi_total').value = Math.round(q * u * 100) / 100;
}

// 保存编辑的物品
function doEditPurItem(date, origName) {
    var newDate = $id('epi_date').value;
    var newSource = $id('epi_source') ? $id('epi_source').value : '';

    // 先构建更新后的物品
    var updatedItem = {
        name: $id('epi_name').value.trim() || origName,
        source: newSource || '外购',
        section: $id('epi_sec').value,
        category: $id('epi_cat').value,
        qty: parseFloat($id('epi_qty').value) || 0,
        unit: $id('epi_unit').value.trim(),
        unitPrice: parseFloat($id('epi_up').value) || 0,
        total: parseFloat($id('epi_total').value) || 0
    };

    upd(function(db) {
        // 1. 从原日期采购单中移除该物品
        var removedFrom = null;
        db.purchases.forEach(function(p) {
            if (p.date !== date) return;
            for (var k = 0; k < p.items.length; k++) {
                if (p.items[k].name === origName) {
                    removedFrom = p.source || newSource || '外购';
                    p.items.splice(k, 1);
                    break;
                }
            }
        });
        if (!updatedItem.source || updatedItem.source === '外购') {
            updatedItem.source = removedFrom || newSource || '外购';
        }

        // 2. 清理空采购单
        db.purchases = db.purchases.filter(function(p) { return p.items.length > 0; });

        // 3. 找到或创建新日期的采购单（同供应商）
        var target = null;
        for (var i = 0; i < db.purchases.length; i++) {
            if (db.purchases[i].date === newDate && db.purchases[i].source === updatedItem.source) {
                target = db.purchases[i];
                break;
            }
        }
        if (!target) {
            target = { id: 'p_' + Date.now(), date: newDate, source: updatedItem.source, items: [] };
            db.purchases.push(target);
        }
        target.items.push(updatedItem);
    });

    closeModal();
    toast('已更新');
    setTimeout(function() { showPurDayModal(newDate); }, 250);
    renderPHist();
}

// ------ 采购明细日历 ------

// 明细日历视图
function renderPHist() {
    var el = $id('pHistArea');
    if (!el) return;
    var ym = $id('pHistM') ? $id('pHistM').value : curYM();
    if (!ym) ym = curYM();

    var year = parseInt(ym.split('-')[0]);
    var month = parseInt(ym.split('-')[1]);
    var daysInMonth = new Date(year, month, 0).getDate();
    var firstDay = new Date(year, month - 1, 1).getDay();
    firstDay = firstDay === 0 ? 6 : firstDay - 1;
    var todayStr = td();
    var todayDay = parseInt(todayStr.split('-')[2]);
    var isThisMonth = todayStr.startsWith(ym);

    var dayTotals = {}, grandTotal = 0, srcTotals = {}, srcReturnTotals = {};
    DB.purchases.filter(function(p) { return p.date.startsWith(ym); }).forEach(function(p) {
        p.items.forEach(function(item) {
            var day = parseInt(p.date.substring(8, 10));
            if (!dayTotals[day]) dayTotals[day] = 0;
            dayTotals[day] += item.total;
            grandTotal += item.total;
            var src = item.source || p.source || '外购';
            if (!srcTotals[src]) srcTotals[src] = 0;
            srcTotals[src] += item.total;
            // 计算退货总额
            if (item.qty < 0 || item.total < 0) {
                if (!srcReturnTotals[src]) srcReturnTotals[src] = 0;
                srcReturnTotals[src] += Math.abs(item.total);
            }
        });
    });

    // 计算涨幅预警物品（仅显示最近一次采购）
    var alertItems = {};
    DB.purchases.filter(function(p) { return p.date.startsWith(ym); }).forEach(function(p) {
        p.items.forEach(function(item) {
            if (item.unitPrice <= 0) return;
            var lastPrice = getLastMonthPrice(item.name, p.date);
            if (lastPrice <= 0) return;
            var priceChange = calcPriceChange(item.unitPrice, lastPrice);
            var level = getAlertLevel(priceChange, item.unitPrice);
            if (level === 'warning' || level === 'danger') {
                // 只保留最近一次采购的预警
                if (!alertItems[item.name] || p.date > alertItems[item.name].date) {
                    alertItems[item.name] = {
                        name: item.name,
                        unitPrice: item.unitPrice,
                        lastPrice: lastPrice,
                        priceChange: priceChange,
                        level: level,
                        date: p.date
                    };
                }
            }
        });
    });

    // 按预警严重程度排序（danger > warning），然后按涨幅绝对值排序
    alertItems = Object.values(alertItems).sort(function(a, b) {
        if (a.level === 'danger' && b.level !== 'danger') return -1;
        if (a.level !== 'danger' && b.level === 'danger') return 1;
        return Math.abs(b.priceChange) - Math.abs(a.priceChange);
    });

    var h = '';
    if (grandTotal > 0) {
        var ansiang = srcTotals['岸香贸易'] || 0;
        var waigou = srcTotals['外购'] || 0;
        var tuihuo = srcTotals['退货'] || 0;

        // 按来源→区域分组统计
        var srcSecTotals = {};
        DB.purchases.filter(function(p) { return p.date.startsWith(ym); }).forEach(function(p) {
            p.items.forEach(function(item) {
                var src = item.source || p.source || '外购';
                var sec = item.section || '未分区';
                if (!srcSecTotals[src]) srcSecTotals[src] = {};
                if (!srcSecTotals[src][sec]) srcSecTotals[src][sec] = 0;
                srcSecTotals[src][sec] += item.total;
            });
        });

                h += '<div class="cards">';
        h += '<div class="card"><div class="card-l">本月采购</div><div class="card-v ac">' + fmtC(grandTotal) + '</div></div>';
        h += '<div class="card"><div class="card-l">天数</div><div class="card-v">' + Object.keys(dayTotals).length + '</div></div>';
        h += '<div class="card"><div class="card-l">日均</div><div class="card-v">' + fmtC(grandTotal / daysInMonth) + '</div></div>';

        ['岸香贸易', '外购'].forEach(function(src) {
            var srcTotal = srcTotals[src] || 0;
            var srcReturn = srcReturnTotals[src] || 0;
            if (srcTotal <= 0 && srcReturn <= 0) return;
            var secs = srcSecTotals[src] || {};
            h += '<div class="card"><div class="card-l">' + src + '</div>';
            h += '<div class="card-v" style="color:var(--gn)">' + fmtC(srcTotal) + '</div>';
            // 显示退货总额（如果有）
            if (srcReturn > 0) {
                h += '<div style="font-size:.65rem;color:var(--rd);margin-top:2px">退 ¥' + fmtC(srcReturn) + '</div>';
            }
            h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;margin-top:4px">';
            Object.keys(secs).sort(function(a, b) { return secs[b] - secs[a]; }).forEach(function(sec) {
                h += '<div style="font-size:.65rem;color:var(--tx-m)">' + sec + '</div>';
                h += '<div style="font-size:.65rem;text-align:right;font-family:var(--fm)">' + fmtC(secs[sec]) + '</div>';
            });
            h += '</div></div>';
        });

        if (tuihuo < 0) {
            var secs = srcSecTotals['退货'] || {};
            h += '<div class="card"><div class="card-l">退货</div>';
            h += '<div class="card-v" style="color:var(--rd)">-' + fmtC(Math.abs(tuihuo)) + '</div>';
            h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:1px;margin-top:4px">';
            Object.keys(secs).sort(function(a, b) { return secs[b] - secs[a]; }).forEach(function(sec) {
                h += '<div style="font-size:.65rem;color:var(--tx-m)">' + sec + '</div>';
                h += '<div style="font-size:.65rem;text-align:right;font-family:var(--fm);color:var(--rd)">-' + fmtC(Math.abs(secs[sec])) + '</div>';
            });
            h += '</div></div>';
        }

        h += '</div>';
    }

    // 涨幅预警显示
    if (alertItems.length > 0) {
        h += '<div style="margin-bottom:14px">';
        h += '<div style="font-size:.78rem;font-weight:600;color:var(--tx-s);margin-bottom:8px">⚠️ 价格涨幅预警</div>';
        h += '<div style="display:flex;flex-wrap:wrap;gap:8px" id="alertList">';
        var showCount = Math.min(3, alertItems.length);
        for (var ai = 0; ai < alertItems.length; ai++) {
            var item = alertItems[ai];
            var bgColor = item.level === 'danger' ? 'rgba(199,84,80,0.08)' : 'rgba(212,160,23,0.08)';
            var borderColor = item.level === 'danger' ? 'var(--rd)' : 'var(--og)';
            var textColor = item.level === 'danger' ? 'var(--rd)' : 'var(--og)';
            var hideStyle = ai >= showCount ? 'display:none' : '';
            h += '<div style="background:' + bgColor + ';border:1px solid ' + borderColor + ';border-radius:6px;padding:6px 10px;font-size:.72rem;cursor:pointer' + (hideStyle ? ';'+hideStyle : '') + '" class="alert-item" onclick="showPriceDetail(\'' + item.name.replace(/'/g, "\\'") + '\',' + item.lastPrice + ',\'' + item.date.substring(0, 7) + '\')">';
            h += '<div style="font-weight:600;color:' + textColor + '">' + item.name + '</div>';
            h += '<div style="font-size:.65rem;color:var(--tx-m);margin-top:2px">¥' + fmtC(item.lastPrice) + ' → ¥' + fmtC(item.unitPrice) + ' <span style="color:' + textColor + ';font-weight:600">' + (item.priceChange > 0 ? '+' : '') + item.priceChange.toFixed(1) + '%</span></div>';
            h += '</div>';
        }
        h += '</div>';
        if (alertItems.length > showCount) {
            h += '<div style="text-align:center;margin-top:8px"><button class="btn s" id="alertToggle" onclick="toggleAlertList()">展开全部 ' + alertItems.length + '项 ▾</button></div>';
        }
        h += '</div>';
    }

    h += '<div style="display:grid;grid-template-columns:repeat(7,1fr);gap:4px">';
    ['一','二','三','四','五','六','日'].forEach(function(w) { h += '<div style="text-align:center;font-size:.7rem;color:var(--tx-m);padding:4px 0">' + w + '</div>'; });
    for (var ix = 0; ix < firstDay; ix++) h += '<div></div>';
    for (var d = 1; d <= daysInMonth; d++) {
        var dateStr = ym + '-' + (d < 10 ? '0' + d : d);
        var has = !!dayTotals[d], isToday = isThisMonth && d === todayDay;
        var bg = has ? 'var(--card)' : 'var(--card-h)';
        var border = isToday ? '2px solid var(--ac)' : '1px solid var(--bd)';
        h += '<div style="background:' + bg + ';border:' + border + ';border-radius:6px;padding:5px 4px;min-height:52px;cursor:' + (has ? 'pointer' : 'default') + '"';
        if (has) h += ' onclick="showPurDayModal(\'' + dateStr + '\')"';
        h += '><div style="font-size:.7rem;font-weight:600;color:' + (isToday ? 'var(--ac)' : 'var(--tx)') + '">' + d + '</div>';
        if (has) {
            h += '<div style="font-family:var(--fm);font-size:.65rem;color:var(--ac);margin-top:2px">';
            h += fmtC(dayTotals[d]);
            h += '</div>';
        }
        h += '</div>';
    }
    h += '</div>';
    if (!grandTotal) h += '<div style="text-align:center;padding:20px;color:var(--tx-m);font-size:.78rem">本月暂无采购记录</div>';
    el.innerHTML = h;
}

// 涨幅预警展开/收起
var _alertExpanded = false;
function toggleAlertList() {
    _alertExpanded = !_alertExpanded;
    var items = document.querySelectorAll('.alert-item');
    var btn = document.getElementById('alertToggle');
    items.forEach(function(item, i) {
        if (i >= 3) {
            item.style.display = _alertExpanded ? '' : 'none';
        }
    });
    if (btn) {
        btn.textContent = _alertExpanded ? '收起 ▴' : '展开全部 ' + items.length + '项 ▾';
    }
}

// ------ 日详情弹窗 ------

// 查看某天采购详情
function showPurDayModal(date) {
    var dayPurchases = DB.purchases.filter(function(p) { return p.date === date; });
    if (!dayPurchases.length) { toast('这天没有采购记录'); return; }

    var allItems = [];
    dayPurchases.forEach(function(p) {
        p.items.forEach(function(item) {
            allItems.push({
                name: item.name, section: item.section || '未分区', category: item.category || '未分类',
                source: item.source || p.source || '外购', qty: item.qty || 0, unit: item.unit || '',
                unitPrice: item.unitPrice || 0, total: item.total || 0, note: item.note || ''
            });
        });
    });

    var total = allItems.reduce(function(s, item) { return s + item.total; }, 0);
    var dateLabel = date.substring(5).replace('-', '/');

    // 顶部标题栏
    var h = '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px">';
    h += '<div style="display:flex;align-items:center;gap:6px">';
    h += '<h3 style="margin:0">' + dateLabel + ' 采购明细</h3>';
    h += '<button class="btn s" style="font-size:.65rem;padding:2px 6px" onclick="editPurDate(\'' + date + '\')">改日期</button></div>';
    h += '<div style="display:flex;align-items:center;gap:8px">';
    h += '<span style="font-size:.95rem;font-weight:700;color:var(--ac)">¥' + fmtC(total) + '</span>';
    h += '<button class="btn s d" onclick="delPurDay(\'' + date + '\')">删除当日</button></div></div>';

    // 按来源 → 区域 → 分类 三层分组
    var srcGroups = {};
    allItems.forEach(function(item) {
        var src = item.source;
        if (!srcGroups[src]) srcGroups[src] = {};
        if (!srcGroups[src][item.section]) srcGroups[src][item.section] = {};
        if (!srcGroups[src][item.section][item.category]) srcGroups[src][item.section][item.category] = { items: [], total: 0 };
        srcGroups[src][item.section][item.category].items.push(item);
        srcGroups[src][item.section][item.category].total += item.total;
    });

    // 来源小计
    var srcTotals = {};
    Object.keys(srcGroups).forEach(function(src) {
        srcTotals[src] = 0;
        Object.keys(srcGroups[src]).forEach(function(sec) {
            Object.keys(srcGroups[src][sec]).forEach(function(cat) {
                srcTotals[src] += srcGroups[src][sec][cat].total;
            });
        });
    });

    var srcKeys = Object.keys(srcGroups).sort(function(a, b) { return srcTotals[b] - srcTotals[a]; });

    h += '<div style="max-height:60vh;overflow-y:auto;padding-right:4px">';

    var si = 0;
    srcKeys.forEach(function(src) {
        si++;
        var srcId = 'srcBody' + si;
        var isReturn = false; // 退货现在显示在原来源下，不再单独处理

        // 来源层
        h += '<div style="margin-bottom:12px">';
        h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:8px 10px;background:var(--card-h);border:1px solid var(--bd);border-radius:8px;margin-bottom:6px;cursor:pointer" onclick="toggleSec(\'' + srcId + '\')">';
        h += '<span style="font-size:.88rem;font-weight:700;color:var(--ac)">▾ ' + src + '</span>';
        h += '<div style="display:flex;align-items:center;gap:6px">';
        h += '<span style="font-family:var(--fm);font-size:.88rem;font-weight:600">¥' + fmtC(srcTotals[src]) + '</span>';
        h += '</div></div>';

        h += '<div id="' + srcId + '">';

        // 区域列表
        var secGroups = srcGroups[src];
        var secTotals = {};
        Object.keys(secGroups).forEach(function(sec) {
            secTotals[sec] = 0;
            Object.keys(secGroups[sec]).forEach(function(cat) { secTotals[sec] += secGroups[sec][cat].total; });
        });
        var secOrder = { '厨房': 1, '吧台': 2, '外场': 3, '未分区': 98 };
        var secKeys = Object.keys(secGroups).sort(function(a, b) {
            var oa = secOrder[a] || 50, ob = secOrder[b] || 50;
            return oa !== ob ? oa - ob : secTotals[b] - secTotals[a];
        });

        var ei = 0;
        secKeys.forEach(function(sec) {
            ei++;
            var secId = srcId + 'sec' + ei;

            // 计算该区域的退货总额
            var secReturnTotal = 0;
            Object.keys(secGroups[sec]).forEach(function(cat) {
                secGroups[sec][cat].items.forEach(function(item) {
                    if (item.qty < 0 || item.total < 0) {
                        secReturnTotal += Math.abs(item.total);
                    }
                });
            });

            // 区域层
            h += '<div style="margin-left:8px;margin-bottom:6px">';
            h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;background:var(--card);border:1px solid var(--bd-l);border-radius:6px;margin-bottom:4px;cursor:pointer" onclick="toggleSec(\'' + secId + '\')">';
            h += '<span style="font-size:.82rem;font-weight:700;color:var(--tx)">▾ ' + sec + '</span>';
            h += '<div style="display:flex;align-items:center;gap:6px">';
            h += '<span style="font-family:var(--fm);font-size:.82rem;font-weight:600">¥' + fmtC(Math.abs(secTotals[sec])) + '</span>';
            // 显示退货总额（如果有）
            if (secReturnTotal > 0) {
                h += '<span style="font-family:var(--fm);font-size:.65rem;color:var(--rd);background:var(--rd-b);padding:2px 6px;border-radius:3px">退 ¥' + fmtC(secReturnTotal) + '</span>';
            }
            h += '<button class="btn s d" style="font-size:.6rem;padding:1px 5px" onclick="event.stopPropagation();delPurSec(\'' + date + '\',\'' + sec.replace(/'/g, "\\'") + '\')">删</button>';
            h += '</div></div>';

            h += '<div id="' + secId + '">';

            // 分类列表
            var catGroups = secGroups[sec];
            var catKeys = Object.keys(catGroups).sort(function(a, b) { return catGroups[b].total - catGroups[a].total; });

            var ci = 0;
            catKeys.forEach(function(cat) {
                ci++;
                var catId = secId + 'cat' + ci;
                var group = catGroups[cat];

                // 计算退货总额
                var returnTotal = 0;
                group.items.forEach(function(item) {
                    if (item.qty < 0 || item.total < 0) {
                        returnTotal += Math.abs(item.total);
                    }
                });

                h += '<div style="margin-left:8px;margin-bottom:4px">';
                h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:3px 0;margin-bottom:3px;cursor:pointer" onclick="toggleSec(\'' + catId + '\')">';
                h += '<span style="font-size:.75rem;font-weight:600;color:var(--tx-m)">▾ ' + cat + '</span>';
                h += '<div style="display:flex;align-items:center;gap:4px">';
                h += '<span style="font-family:var(--fm);font-size:.75rem;color:var(--tx-m)">¥' + fmtC(Math.abs(group.total)) + '</span>';
                // 显示退货总额（如果有）
                if (returnTotal > 0) {
                    h += '<span style="font-family:var(--fm);font-size:.65rem;color:var(--rd);background:var(--rd-b);padding:1px 5px;border-radius:3px">退 ¥' + fmtC(returnTotal) + '</span>';
                }
                h += '<button class="btn s d" style="font-size:.6rem;padding:1px 5px" onclick="event.stopPropagation();delPurCat(\'' + date + '\',\'' + sec.replace(/'/g, "\\'") + '\',\'' + cat.replace(/'/g, "\\'") + '\')">删</button>';
                h += '</div></div>';

                h += '<div id="' + catId + '">';

                // 物品列表
                group.items.forEach(function(item) {
                    // 计算涨幅
                    var lastPrice = getLastMonthPrice(item.name, date);
                    var priceChange = calcPriceChange(item.unitPrice, lastPrice);
                    var alertBadge = getAlertBadgeHTML(priceChange, item.unitPrice, lastPrice, item.name, date);

                    h += '<div style="display:flex;justify-content:space-between;align-items:center;padding:5px 8px;margin-bottom:2px;background:var(--card-h);border:1px solid var(--bd-l);border-radius:5px">';
                    h += '<div style="flex:1;min-width:0">';
                    h += '<div style="font-size:.78rem;font-weight:600">' + item.name + alertBadge + '</div>';
                    h += '<div style="font-size:.65rem;color:var(--tx-s)">' + item.qty + (item.unit || '') + ' × ¥' + fmtC(item.unitPrice) + (item.note ? ' · ' + item.note : '') + '</div>';
                    h += '</div>';
                    h += '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0;margin-left:6px">';
                    h += '<span style="font-size:.82rem;font-weight:700;color:' + (item.total < 0 ? 'var(--rd)' : 'var(--ac)') + '">' + (item.total < 0 ? '-' : '') + '¥' + fmtC(Math.abs(item.total)) + '</span>';
                    // 所有物品都有编辑和删除按钮
                    h += '<button class="btn s" style="font-size:.65rem;padding:2px 6px" onclick="editPurFromModal(\'' + date + '\',\'' + item.name.replace(/'/g, "\\'") + '\')">编</button>';
                    h += '<button class="btn s d" style="font-size:.65rem;padding:2px 6px" onclick="delPurFromModal(\'' + date + '\',\'' + item.name.replace(/'/g, "\\'") + '\')">删</button>';
                    // 只有非退货物品才有退货按钮
                    if (item.qty > 0) {
                        h += '<button class="btn s og" style="font-size:.65rem;padding:2px 6px" onclick="returnPurItem(\'' + date + '\',' + sq(item.name) + ')">退</button>';
                    }
                    h += '</div></div>';
                });

                h += '</div></div>';
            });

            h += '</div></div>';
        });

        h += '</div></div>';
    });

    h += '</div>';
    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end"><button class="btn" onclick="closeModal()">关闭</button></div>';

    showModal(h, 600);
    var mc = document.querySelector('.modal-content');
    if (mc) { mc.style.height = '75vh'; mc.style.display = 'flex'; mc.style.flexDirection = 'column'; }
    var sb = mc ? mc.querySelector('[style*="max-height"]') : null;
    if (sb) { sb.style.flex = '1'; sb.style.overflowY = 'auto'; sb.style.minHeight = '0'; }
}

// 收起/展开区域或分类
function toggleSec(id) {
    var el = $id(id);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? 'block' : 'none';
}

// 计算物品单价涨幅
function calcPriceChange(itemName, currentPrice, currentDate) {
    // 查找上一次采购记录
    var prevPurchase = null;
    var prevDate = '';
    for (var i = DB.purchases.length - 1; i >= 0; i--) {
        var p = DB.purchases[i];
        if (p.date >= currentDate) continue; // 跳过当前及之后的日期
        for (var k = 0; k < p.items.length; k++) {
            if (p.items[k].name === itemName && p.items[k].qty > 0) {
                prevPurchase = p.items[k];
                prevDate = p.date;
                break;
            }
        }
        if (prevPurchase) break;
    }

    if (!prevPurchase || prevPurchase.unitPrice <= 0) return null;

    var prevPrice = prevPurchase.unitPrice;
    var change = currentPrice - prevPrice;
    var changePercent = (change / prevPrice) * 100;

    return {
        prevPrice: prevPrice,
        prevDate: prevDate,
        change: change,
        changePercent: changePercent
    };
}

// 根据单价和涨幅获取预警等级
function getWarningLevel(unitPrice, changePercent) {
    var absChange = Math.abs(changePercent);

    if (unitPrice < 2) {
        // 低价物品 < ¥2
        if (absChange < 15) return 'normal';
        if (absChange < 40) return 'warning';
        return 'danger';
    } else if (unitPrice < 5) {
        // 低价物品 ¥2 - ¥5
        if (absChange < 10) return 'normal';
        if (absChange < 30) return 'warning';
        return 'danger';
    } else if (unitPrice < 20) {
        // 中价物品 ¥5 - ¥20
        if (absChange < 8) return 'normal';
        if (absChange < 25) return 'warning';
        return 'danger';
    } else if (unitPrice < 50) {
        // 中价物品 ¥20 - ¥50
        if (absChange < 5) return 'normal';
        if (absChange < 20) return 'warning';
        return 'danger';
    } else if (unitPrice < 100) {
        // 高价物品 ¥50 - ¥100
        if (absChange < 3) return 'normal';
        if (absChange < 15) return 'warning';
        return 'danger';
    } else {
        // 高价物品 > ¥100
        if (absChange < 2) return 'normal';
        if (absChange < 10) return 'warning';
        return 'danger';
    }
}

// 获取预警徽章HTML
function getWarningBadgeHTML(changePercent, level) {
    var color, text;
    if (changePercent < 0) {
        color = 'var(--gn)';
        text = '↓' + Math.abs(changePercent).toFixed(1) + '%';
    } else if (level === 'danger') {
        color = 'var(--rd)';
        text = '↑' + changePercent.toFixed(1) + '%';
    } else if (level === 'warning') {
        color = 'var(--og)';
        text = '↑' + changePercent.toFixed(1) + '%';
    } else {
        return ''; // 正常不显示徽章
    }

    return '<span style="font-size:.6rem;padding:1px 4px;border-radius:3px;background:' + color + '20;color:' + color + ';margin-left:4px">' + text + '</span>';
}

// 删除某天全部采购
function delPurDay(date) {
    if (!confirm('确认删除 ' + date + ' 的全部采购记录？')) return;
    upd(function(db) { db.purchases = db.purchases.filter(function(p) { return p.date !== date; }); });
    toast('已删除当日');
    closeModal();
}

// 删除某天某区域
function delPurSec(date, sec) {
    if (!confirm('确认删除该区域「' + sec + '」的全部物品？')) return;
    upd(function(db) {
        db.purchases.forEach(function(p) {
            if (p.date !== date) return;
            p.items = p.items.filter(function(item) { return (item.section || '未分区') !== sec; });
        });
        db.purchases = db.purchases.filter(function(p) { return p.items.length > 0; });
    });
    toast('已删除区域');
    renderPHist();
    var remain = DB.purchases.filter(function(p) { return p.date === date; });
    if (remain.length) showPurDayModal(date); else closeModal();
}

// 删除某天某分类
function delPurCat(date, sec, cat) {
    if (!confirm('确认删除该分类「' + cat + '」的全部物品？')) return;
    upd(function(db) {
        db.purchases.forEach(function(p) {
            if (p.date !== date) return;
            p.items = p.items.filter(function(item) {
                return !((item.section || '未分区') === sec && (item.category || '未分类') === cat);
            });
        });
        db.purchases = db.purchases.filter(function(p) { return p.items.length > 0; });
    });
    toast('已删除分类');
    renderPHist();
    var remain = DB.purchases.filter(function(p) { return p.date === date; });
    if (remain.length) showPurDayModal(date); else closeModal();
}

// 删除单个物品
function delPurFromModal(date, name) {
    if (!confirm('确认删除？')) return;
    upd(function(db) {
        db.purchases.forEach(function(p) {
            if (p.date !== date) return;
            p.items = p.items.filter(function(item) { return item.name !== name; });
        });
        db.purchases = db.purchases.filter(function(p) { return p.items.length > 0; });
    });
    toast('已删除');
    renderPHist();
    var remain = DB.purchases.filter(function(p) { return p.date === date; });
    if (remain.length) showPurDayModal(date); else closeModal();
}

// 采购退货
function returnPurItem(date, name) {
    var purchases = DB.purchases.filter(function(pp) { return pp.date === date; });
    if (!purchases.length) return;

    // 在所有采购记录中找原物品
    var orig = null, foundP = null;
    for (var i = 0; i < purchases.length; i++) {
        for (var k = 0; k < purchases[i].items.length; k++) {
            if (purchases[i].items[k].name === name && purchases[i].items[k].source !== '退货') {
                orig = purchases[i].items[k];
                foundP = purchases[i];
                break;
            }
        }
        if (orig) break;
    }
    if (!orig) { toast('未找到原采购记录'); return; }

    var h = '<h3>退货 · ' + name + '</h3>';
    h += '<div class="pv-row"><span class="k">来源</span><span>' + (foundP.source || '外购') + '</span></div>';
    h += '<div class="pv-row"><span class="k">原采购</span><span>' + fmtC(orig.total) + '</span></div>';
    h += '<div class="pv-row"><span class="k">数量</span><span>' + orig.qty + (orig.unit || '') + '</span></div>';
    h += '<div class="pv-row"><span class="k">单价</span><span>' + fmtC(orig.unitPrice || 0) + '</span></div>';

    h += '<div class="section-label">退货信息</div>';
    h += '<div class="hrow"><label>退货日期</label><input class="inp" id="retDate" type="text" readonly placeholder="选择日期" value="' + td() + '" onclick="_dpOpen(\'retDate\')" style="max-width:150px;cursor:pointer"></div>';
    h += '<div class="hrow"><label>退货数量</label><input class="inp" id="retQty" type="number" step="0.01" value="' + orig.qty + '" style="max-width:100px"></div>';
    h += '<div class="hrow"><label>退货金额</label><input class="inp" id="retTotal" type="number" step="0.01" value="' + orig.total + '" style="max-width:120px"></div>';
    h += '<div class="hrow"><label>退货原因</label><input class="inp" id="retReason" placeholder="可选" style="flex:1"></div>';

    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end">';
    h += '<button class="btn p" onclick="doReturnPurItem(\'' + date + '\',' + sq(name) + ')">确认退货</button>';
    h += '<button class="btn" onclick="backToPurDetail(\'' + date + '\')">取消</button></div>';

    showModal(h, 500);
}

// 退货时自动计算金额
function calcReturnTotal() {
    var qty = parseFloat($id('retQty').value) || 0;
    // 从原始记录取单价
    var total = qty * parseFloat($id('retTotal').value / parseFloat($id('retQty').value || 1));
    // 不自动算了，让用户自己填
}

// 执行退货：在退货日期新增一条负数记录
function doReturnPurItem(date, name) {
    var retDate = $id('retDate').value || td();
    var retQty = parseFloat($id('retQty').value) || 0;
    var retTotal = parseFloat($id('retTotal').value) || 0;
    var retReason = $id('retReason').value.trim();

    if (retQty <= 0 && retTotal <= 0) { toast('请填写退货信息'); return; }

    var purchases = DB.purchases.filter(function(pp) { return pp.date === date; });
    var orig = null, foundP = null;
    for (var i = 0; i < purchases.length; i++) {
        for (var k = 0; k < purchases[i].items.length; k++) {
            if (purchases[i].items[k].name === name && purchases[i].items[k].source !== '退货') {
                orig = purchases[i].items[k];
                foundP = purchases[i];
                break;
            }
        }
        if (orig) break;
    }
    if (!orig) { toast('未找到原采购'); return; }

    // 检查是否影响库存（茗茶/香烟/酒类）
    var stockImpact = null;
    var invTypes = ['tea', 'cig', 'alc'];
    for (var t = 0; t < invTypes.length; t++) {
        var key = INV[invTypes[t]].key;
        var item = (DB[key] || []).find(function(it) { return it.name === name; });
        if (item) {
            var c = invCalc(item, invTypes[t]);
            var unit = invTypes[t] === 'tea' ? (item.calcMode === 'pack' ? '包' : '克') : (invTypes[t] === 'cig' ? '包' : '瓶');
            stockImpact = { item: item, currentStock: c.stock, unit: unit, retQty: retQty };
            break;
        }
    }

    // 有库存影响时弹出确认
    if (stockImpact) {
        var newStock = stockImpact.currentStock - stockImpact.retQty;
        var h = '<div style="max-width:400px;margin:0 auto">';
        h += '<h3 style="margin-bottom:12px;color:var(--ac)">确认退货</h3>';
        h += '<div style="background:var(--og-b);border:1px solid rgba(212,160,23,.15);border-radius:var(--r);padding:12px;margin-bottom:14px">';
        h += '<div style="font-size:.78rem;margin-bottom:8px">退货将影响库存：</div>';
        h += '<div class="pv-row"><span class="k">商品</span><span style="font-weight:600">' + name + '</span></div>';
        h += '<div class="pv-row"><span class="k">当前库存</span><span style="font-family:var(--fm)">' + stockImpact.currentStock + ' ' + stockImpact.unit + '</span></div>';
        h += '<div class="pv-row"><span class="k">退货数量</span><span style="font-family:var(--fm);color:var(--rd)">-' + stockImpact.retQty + ' ' + stockImpact.unit + '</span></div>';
        h += '<div class="pv-row" style="border-bottom:none"><span class="k" style="font-weight:600">退货后库存</span><span style="font-family:var(--fm);font-weight:600;color:' + (newStock >= 0 ? 'var(--gn)' : 'var(--rd)') + '">' + newStock + ' ' + stockImpact.unit + '</span></div>';
        h += '</div>';
        h += '<div style="font-size:.72rem;color:var(--tx-m);margin-bottom:12px">退货金额 ¥' + fmtC(retTotal) + '</div>';
        h += '<div class="brow" style="justify-content:flex-end">';
        h += '<button class="btn" onclick="closeModal()">取消</button>';
        h += '<button class="btn p" onclick="_doReturnConfirm(\'' + date + '\',' + sq(name) + ')">确认退货</button>';
        h += '</div></div>';
        showModal(h, 420);
        window._returnData = { date: date, name: name, retDate: retDate, retQty: retQty, retTotal: retTotal, retReason: retReason };
    } else {
        // 非库存商品，直接执行
        _doReturnExec(date, name, retDate, retQty, retTotal, retReason);
    }
}

function _doReturnConfirm() {
    var d = window._returnData;
    closeModal();
    _doReturnExec(d.date, d.name, d.retDate, d.retQty, d.retTotal, d.retReason);
}

function _doReturnExec(date, name, retDate, retQty, retTotal, retReason) {
    retDate = retDate || td();
    retQty = retQty || 0;
    retTotal = retTotal || 0;
    retReason = retReason || '';

    var purchases = DB.purchases.filter(function(pp) { return pp.date === date; });
    var orig = null;
    for (var i = 0; i < purchases.length; i++) {
        for (var k = 0; k < purchases[i].items.length; k++) {
            if (purchases[i].items[k].name === name && purchases[i].items[k].source !== '退货') {
                orig = purchases[i].items[k];
                break;
            }
        }
        if (orig) break;
    }
    if (!orig) return;

    upd(function(db) {
        // 退货应该显示在原来的来源下面，而不是单独作为"退货"来源
        // 查找原采购记录所在的采购批次
        var target = null;
        for (var i = 0; i < db.purchases.length; i++) {
            if (db.purchases[i].date === date) {
                for (var k = 0; k < db.purchases[i].items.length; k++) {
                    if (db.purchases[i].items[k].name === name && db.purchases[i].items[k].source !== '退货') {
                        target = db.purchases[i];
                        break;
                    }
                }
                if (target) break;
            }
        }
        if (!target) {
            // 如果找不到原采购批次，创建新的（保留原来源）
            target = { date: retDate, source: orig.source, items: [] };
            db.purchases.push(target);
        }
        target.items.push({
            name: name, section: orig.section, category: orig.category,
            qty: -retQty, unit: orig.unit || '',
            unitPrice: orig.unitPrice || 0, total: -retTotal,
            source: orig.source, // 保留原来的来源，不设置为'退货'
            note: retReason
        });
    });

    closeModal();
    toast('已退货 ' + name + ' ¥' + fmtC(retTotal));
    setTimeout(function() { showPurDayModal(date); }, 250);
}

// 从弹窗跳转到编辑
function editPurFromModal(date, name) {
    closeModal();
    setTimeout(function() {
        editPurByDate(date, name);
    }, 250);
}

// 修改采购日期
function editPurDate(oldDate) {
    var h = '<h3>修改日期</h3>';
    h += '<div style="padding:10px 0">';
    h += '<div class="hrow"><label>当前日期</label><span style="font-size:.88rem;font-weight:600;color:var(--ac)">' + oldDate + '</span></div>';
    h += '<div class="hrow"><label>新日期</label><input class="inp" id="newPurDate" type="text" readonly value="' + oldDate + '" onclick="_dpOpen(\'newPurDate\')" style="max-width:160px;cursor:pointer"></div>';
    h += '</div>';
    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end">';
    h += '<button class="btn p" onclick="doEditPurDate(\'' + oldDate + '\')">确认修改</button>';
    h += '<button class="btn" onclick="backToPurDetail(\'' + oldDate + '\')">取消</button></div>';
    showModal(h, 400);
}

function doEditPurDate(oldDate) {
    var newDate = $id('newPurDate').value;
    if (!newDate || newDate === oldDate) { toast('日期未变更'); return; }
    if (!confirm('将 ' + oldDate + ' 的采购记录移到 ' + newDate + '？')) return;
    upd(function(db) {
        db.purchases.forEach(function(p) {
            if (p.date === oldDate) p.date = newDate;
        });
    });
    closeModal();
    toast('已修改为 ' + newDate);
    setTimeout(function() { showPurDayModal(newDate); }, 250);
    renderPHist();
}

// 删除某天某来源全部采购（从日详情弹窗调用）
function delPurDaySrc(date, src) {
    if (!confirm('删除 ' + date + ' ' + src + ' 全部？')) return;
    upd(function(db) {
        db.purchases.forEach(function(p) {
            if (p.date === date) {
                p.items = p.items.filter(function(i) { return (i.source || p.source) !== src; });
            }
        });
        db.purchases = db.purchases.filter(function(p) { return p.items.length > 0; });
    });
    toast('已删除');
    showPurDay(date);
}

// 通过采购单ID和物品索引编辑物品
function editPurByIdx(pid, idx) {
    var p = DB.purchases.find(function(pp) { return pp.id === pid; });
    if (!p || !p.items[idx]) return;
    var item = p.items[idx];

    var secs = ['厨房', '吧台', '外场'];
    var cats = getPurCats(item.section);

    // 当前值不在预设列表中则插入
    if (item.section && secs.indexOf(item.section) < 0) secs.unshift(item.section);
    if (item.category && cats.indexOf(item.category) < 0) cats.unshift(item.category);

    var h = '<h3>编辑物品</h3>';
    h += '<div class="hrow"><label>日期</label><input class="inp" id="epi_date" type="text" readonly placeholder="选择日期" style="max-width:160px;cursor:pointer" value="' + (p.date || td()) + '" onclick="_dpOpen(\'epi_date\')"></div>';
    
    h += '<div class="hrow"><label>品名</label><input class="inp" id="epi_name" style="flex:2" value="' + item.name.replace(/"/g, '&quot;') + '"></div>';

    h += '<div class="hrow"><label>区域</label><select class="inp" id="epi_sec" style="max-width:110px" onchange="epiSecChanged(this)">';
    h += '<option value="">-</option>';
    secs.forEach(function(s) { h += '<option' + (item.section === s ? ' selected' : '') + '>' + s + '</option>'; });
    h += '</select>';

    h += '<label>分类</label><select class="inp" id="epi_cat" style="max-width:130px">';
    h += '<option value="">-</option>';
    cats.forEach(function(c) { h += '<option' + (item.category === c ? ' selected' : '') + '>' + c + '</option>'; });
    h += '<option value="__custom">自定义</option></select></div>';

    h += '<div class="hrow">';
    h += '<label>数量</label><input class="inp" id="epi_qty" type="number" step="any" style="max-width:80px" value="' + item.qty + '">';
    h += '<label>单位</label><input class="inp" id="epi_unit" style="max-width:60px" value="' + (item.unit || '') + '"></div>';

    h += '<div class="hrow">';
    h += '<label>单价</label><input class="inp" id="epi_up" type="number" step="0.01" style="max-width:90px" value="' + (item.unitPrice || 0) + '" oninput="epiCalcTotal()">';
    h += '<label>总价</label><input class="inp" id="epi_total" type="number" step="0.01" style="max-width:100px" value="' + item.total + '"></div>';

    h += '<div class="brow" style="margin-top:14px;justify-content:flex-end">';
    h += '<button class="btn p" onclick="doEditPurByIdx(' + sq(pid) + ',' + idx + ')">保存</button>';
    h += '<button class="btn" onclick="closeModal()">取消</button></div>';

    showModal(h);
}

// 保存通过 pid+idx 编辑的物品
function doEditPurByIdx(pid, idx) {
    upd(function(db) {
        var pp = db.purchases.find(function(p) { return p.id === pid; });
        if (!pp || !pp.items[idx]) return;
        var newDate = document.getElementById('epi_date').value;
        if (newDate) pp.date = newDate;
        pp.items[idx].name = $id('epi_name').value.trim() || pp.items[idx].name;
        pp.items[idx].section = $id('epi_sec').value;
        pp.items[idx].category = $id('epi_cat').value;
        pp.items[idx].qty = parseFloat($id('epi_qty').value) || 0;
        pp.items[idx].unit = $id('epi_unit').value.trim();
        pp.items[idx].unitPrice = parseFloat($id('epi_up').value) || 0;
        pp.items[idx].total = parseFloat($id('epi_total').value) || 0;
    });
    closeModal();
    toast('已更新');
    renderPHist();
}

// 通过采购单ID和物品索引删除物品（空采购单自动清理）
function delPurByIdx(pid, idx) {
    var p = DB.purchases.find(function(pp) { return pp.id === pid; });
    if (!p || !p.items[idx]) return;
    if (!confirm('删除 ' + p.items[idx].name + ' ?')) return;

    upd(function(db) {
        var pp = db.purchases.find(function(p) { return p.id === pid; });
        if (!pp) return;
        pp.items.splice(idx, 1);
        if (!pp.items.length) {
            db.purchases = db.purchases.filter(function(ppp) { return ppp.id !== pid; });
        }
    });
    toast('已删除');
    renderPHist();
}



// ========== 涨幅预警功能 ==========

// 获取上月同物品的单价
function getLastMonthPrice(name, currentDate) {
    var date = new Date(currentDate);
    date.setMonth(date.getMonth() - 1);
    var lastYM = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
    
    var lastPrice = 0;
    DB.purchases.filter(function(p) { return p.date.startsWith(lastYM); }).forEach(function(p) {
        p.items.forEach(function(item) {
            if (item.name === name && item.unitPrice > 0) {
                lastPrice = item.unitPrice;
            }
        });
    });
    return lastPrice;
}

// 计算涨幅百分比
function calcPriceChange(currentPrice, lastPrice) {
    if (lastPrice <= 0) return 0;
    return ((currentPrice - lastPrice) / lastPrice * 100);
}

// 获取涨幅预警等级
function getAlertLevel(priceChange, unitPrice) {
    var threshold;
    if (unitPrice < 2) {
        threshold = { normal: 15, warning: 40 };
    } else if (unitPrice < 5) {
        threshold = { normal: 10, warning: 30 };
    } else if (unitPrice < 20) {
        threshold = { normal: 8, warning: 25 };
    } else if (unitPrice < 50) {
        threshold = { normal: 5, warning: 20 };
    } else if (unitPrice < 100) {
        threshold = { normal: 3, warning: 15 };
    } else {
        threshold = { normal: 2, warning: 10 };
    }
    
    if (priceChange < 0) return 'decrease';
    if (priceChange <= threshold.normal) return 'normal';
    if (priceChange <= threshold.warning) return 'warning';
    return 'danger';
}

// 获取涨幅徽章HTML
function getAlertBadgeHTML(priceChange, unitPrice, lastPrice, itemName, currentDate) {
    var level = getAlertLevel(priceChange, unitPrice);
    var color, bgColor, text;

    switch(level) {
        case 'decrease':
            color = '#3d8b5e';
            bgColor = 'rgba(61,139,94,0.1)';
            text = '↓' + Math.abs(priceChange).toFixed(1) + '%';
            break;
        case 'normal':
            color = '#666';
            bgColor = 'transparent';
            text = '';
            break;
        case 'warning':
            color = '#d4a017';
            bgColor = 'rgba(212,160,23,0.1)';
            text = '↑' + priceChange.toFixed(1) + '%';
            break;
        case 'danger':
            color = '#c75450';
            bgColor = 'rgba(199,84,80,0.1)';
            text = '↑' + priceChange.toFixed(1) + '%';
            break;
    }

    if (!text) return '';

    // 计算上次采购日期
    var lastDate = '';
    if (lastPrice > 0) {
        var date = new Date(currentDate);
        date.setMonth(date.getMonth() - 1);
        lastDate = date.getFullYear() + '-' + String(date.getMonth() + 1).padStart(2, '0');
    }

    return '<span style="font-size:.6rem;padding:1px 5px;border-radius:3px;color:' + color + ';background:' + bgColor + ';margin-left:4px;cursor:pointer" onclick="showBadgePriceDetail(\'' + itemName.replace(/'/g, "\\'") + '\',' + lastPrice + ',' + (lastPrice > 0 ? '\'' + lastDate + '\'' : 'null') + ',\'' + currentDate + '\')">' + text + '</span>';
}

// 显示价格详情弹窗
function showPriceDetail(itemName, lastPrice, lastDate) {
    var item = null;
    DB.purchases.forEach(function(p) {
        p.items.forEach(function(i) {
            if (i.name === itemName && i.unitPrice > 0) {
                item = i;
            }
        });
    });

    if (!item) return;

    var h = '<div style="max-width:300px">';
    h += '<h3 style="margin:0 0 12px;color:var(--ac);font-size:.88rem">' + itemName + ' 价格详情</h3>';

    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">';
    h += '<div style="text-align:center;padding:12px;background:var(--card-h);border-radius:8px">';
    h += '<div style="font-size:.65rem;color:var(--tx-m);margin-bottom:4px">上次采购</div>';
    h += '<div style="font-size:1rem;font-weight:600;color:var(--tx)">¥' + fmtC(lastPrice) + '</div>';
    if (lastDate) {
        h += '<div style="font-size:.6rem;color:var(--tx-m);margin-top:4px">' + lastDate + '</div>';
    }
    h += '</div>';

    h += '<div style="text-align:center;padding:12px;background:var(--card-h);border-radius:8px">';
    h += '<div style="font-size:.65rem;color:var(--tx-m);margin-bottom:4px">本次采购</div>';
    h += '<div style="font-size:1rem;font-weight:600;color:var(--ac)">¥' + fmtC(item.unitPrice) + '</div>';
    h += '</div>';
    h += '</div>';

    var priceChange = calcPriceChange(item.unitPrice, lastPrice);
    var level = getAlertLevel(priceChange, item.unitPrice);
    var levelText = level === 'decrease' ? '降价' : level === 'warning' ? '小幅涨价' : level === 'danger' ? '大幅涨价' : '正常';
    var levelColor = level === 'decrease' ? 'var(--gn)' : level === 'warning' ? 'var(--og)' : level === 'danger' ? 'var(--rd)' : 'var(--tx-s)';

    h += '<div style="text-align:center;padding:12px;background:var(--card-h);border-radius:8px">';
    h += '<div style="font-size:.65rem;color:var(--tx-m);margin-bottom:4px">涨幅</div>';
    h += '<div style="font-size:1.1rem;font-weight:600;color:' + levelColor + '">' + (priceChange > 0 ? '+' : '') + priceChange.toFixed(1) + '%</div>';
    h += '<div style="font-size:.6rem;color:' + levelColor + ';margin-top:4px">' + levelText + '</div>';
    h += '</div>';

    h += '<div style="margin-top:16px;text-align:right"><button class="btn" onclick="closeModal()">关闭</button></div>';
    h += '</div>';

    showModal(h, 350);
}

// 涨幅徽章点击弹窗（从采购明细弹窗中触发，含返回按钮）
function showBadgePriceDetail(itemName, lastPrice, lastDate, backDate) {
    var item = null;
    DB.purchases.forEach(function(p) {
        p.items.forEach(function(i) {
            if (i.name === itemName && i.unitPrice > 0) {
                item = i;
            }
        });
    });

    if (!item) return;

    var h = '<div style="max-width:300px">';
    h += '<h3 style="margin:0 0 12px;color:var(--ac);font-size:.88rem">' + itemName + ' 价格详情</h3>';

    h += '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-bottom:16px">';
    h += '<div style="text-align:center;padding:12px;background:var(--card-h);border-radius:8px">';
    h += '<div style="font-size:.65rem;color:var(--tx-m);margin-bottom:4px">上次采购</div>';
    h += '<div style="font-size:1rem;font-weight:600;color:var(--tx)">\u00a5' + fmtC(lastPrice) + '</div>';
    if (lastDate) {
        h += '<div style="font-size:.6rem;color:var(--tx-m);margin-top:4px">' + lastDate + '</div>';
    }
    h += '</div>';

    h += '<div style="text-align:center;padding:12px;background:var(--card-h);border-radius:8px">';
    h += '<div style="font-size:.65rem;color:var(--tx-m);margin-bottom:4px">本次采购</div>';
    h += '<div style="font-size:1rem;font-weight:600;color:var(--ac)">\u00a5' + fmtC(item.unitPrice) + '</div>';
    h += '</div>';
    h += '</div>';

    var priceChange = calcPriceChange(item.unitPrice, lastPrice);
    var level = getAlertLevel(priceChange, item.unitPrice);
    var levelText = level === 'decrease' ? '降价' : level === 'warning' ? '小幅涨价' : level === 'danger' ? '大幅涨价' : '正常';
    var levelColor = level === 'decrease' ? 'var(--gn)' : level === 'warning' ? 'var(--og)' : level === 'danger' ? 'var(--rd)' : 'var(--tx-s)';

    h += '<div style="text-align:center;padding:12px;background:var(--card-h);border-radius:8px">';
    h += '<div style="font-size:.65rem;color:var(--tx-m);margin-bottom:4px">涨幅</div>';
    h += '<div style="font-size:1.1rem;font-weight:600;color:' + levelColor + '">' + (priceChange > 0 ? '+' : '') + priceChange.toFixed(1) + '%</div>';
    h += '<div style="font-size:.6rem;color:' + levelColor + ';margin-top:4px">' + levelText + '</div>';
    h += '</div>';

    h += '<div style="margin-top:16px;display:flex;justify-content:space-between">';
    h += '<button class="btn" onclick="backToPurDetail(\'' + backDate + '\')">← 返回</button>';    h += '<button class="btn" onclick="closeModal()">关闭</button>';
    h += '</div></div>';

    showModal(h, 350);
}

// 平滑返回到采购明细
function backToPurDetail(date) {
    backToModal(function() {
        showPurDayModal(date);
    });
}

// 采购月份切换
function purchaseCalNav(dir) {
    var picker = document.getElementById('pHistM');
    var currentYM = picker ? picker.value : curYM();
    calendarNav(dir, currentYM, 'pHistM', function(ym) {
        renderPHist();
    });
}

// 采购月份选择
function purchaseCalPickYM(val) {
    calendarPickYM(val, function(ym) {
        renderPHist();
    });
}
