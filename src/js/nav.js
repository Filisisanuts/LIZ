// 控制页面导航和切换

// 当前所在页面
var _curPage = 'dash';

// ---------- 渲染导航栏 ----------
// 根据 NAV 配置生成导航按钮，高亮当前页
// ------ 页面路由 ------

function goPage(name) {
    console.log('goPage called:', name);
    _curPage = name;
    localStorage.setItem('ax_lastPage', name);
    document.querySelectorAll('.toolbar-btn').forEach(function(b) {
        b.classList.toggle('active', b.dataset.page === name);
    });

    // 移动端自动收起侧边栏
    var toolbar = $id('toolbar');
    if (toolbar && toolbar.classList.contains('open')) {
        toolbar.classList.remove('open');
        $id('toolbarMask').classList.remove('open');
        document.body.style.overflow = '';
    }

    var icons = {
        dash: '📊', daily: '📝', purchase: '🛒', expense: '💰',
        damage: '📦', tea: '🍵', cig: '🚬', alc: '🍺', other: '💎', wh: '🏪',
        report: '📈', gen: '📤',  settings: '⚙️'
    };

    // 处理自定义贵重物品类型（custom_xxx 格式）
    if (name.startsWith('custom_')) {
        var customType = name.replace('custom_', '');
        rInv('other', customType); // 显示其他贵重物品页面，传入自定义类型名
        return;
    }

    switch (name) {
        case 'dash':      rDash(); break;
        case 'daily':     rDaily(); break;
        case 'purchase':  rPurchase(); break;
        case 'expense':   rExpense(); break;
        case 'salary':    rSalary(); break;
        case 'damage':    rDamage(); break;
        case 'tea':       rInv('tea'); break;
        case 'cig':       rInv('cig'); break;
        case 'alc':       rInv('alc'); break;
        case 'other':     rInv('other'); break;
        case 'wh':        rWH(); break;
        case 'report':    rReport(); break;
        case 'gen':       rGen(); break;
        case 'settings':  rData(); break;
        default:          rDash(); break;
    }
}

// ------ 工资管理页面 ------
// 草稿仅保留在当前浏览器会话：换月/离开后返回不会丢失，但刷新页面前需保存。
var _salaryTableData = [];
var _salaryPeriod = '';
var _salaryDrafts = {};
var _salaryDirtyPeriods = {};
var _salDragRowId = null;
var _salDropTargetId = null;
var _salDropPosition = 'before';
var _salaryView = 'entry';
var _salaryDetailPeriod = '';
var SALARY_TRASH_RETENTION_DAYS = 30;
var SALARY_FIELDS = [
    { key: 'department', label: '部门', width: '70px' },
    { key: 'employee', label: '姓名', width: '70px' },
    { key: 'position', label: '职务', width: '90px' },
    { key: 'baseSalary', label: '基本工资', width: '70px', numeric: true },
    { key: 'positionSubsidy', label: '职务补贴', width: '65px', numeric: true },
    { key: 'overtimeSubsidy', label: '加班补贴', width: '65px', numeric: true },
    { key: 'allowance', label: '津贴', width: '55px', numeric: true },
    { key: 'fullAttendance', label: '满勤奖', width: '55px', numeric: true },
    { key: 'seniority', label: '司龄', width: '55px', numeric: true },
    { key: 'commission', label: '提成', width: '65px', numeric: true },
    { key: 'otherSubsidy', label: '其他补助', width: '65px', numeric: true },
    { key: 'performance', label: '绩效', width: '65px', numeric: true },
    { key: 'socialInsurance', label: '社保', width: '65px', numeric: true },
    { key: 'tax', label: '个税', width: '65px', numeric: true }
];

function salaryRowId() {
    return 'sal_draft_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

function cloneSalaryRows(rows) {
    return rows.map(function(row) { return Object.assign({}, row); });
}

function normalizeSalaryRow(row) {
    var result = createSalaryEmptyRow();
    SALARY_FIELDS.forEach(function(field) {
        result[field.key] = field.numeric ? (Number(row[field.key]) || 0) : (row[field.key] || '');
    });
    result.id = row.id || salaryRowId();
    result.period = _salaryPeriod;
    result.note = row.note || '';
    return result;
}

function cacheSalaryDraft() {
    if (!_salaryPeriod) return;
    _salaryDrafts[_salaryPeriod] = cloneSalaryRows(_salaryTableData);
    _salaryDirtyPeriods[_salaryPeriod] = true;
}

function hasSalaryDraft() {
    return !!_salaryDrafts[_salaryPeriod];
}

function loadSalaryPeriod() {
    if (hasSalaryDraft()) {
        _salaryTableData = cloneSalaryRows(_salaryDrafts[_salaryPeriod]);
        return;
    }
    var records = (DB.salaryRecords || []).filter(function(record) { return record.period === _salaryPeriod; });
    _salaryTableData = records.length ? records.map(normalizeSalaryRow) : loadSalaryTemplate();
}

function rSalary() {
    if (_salaryPeriod && _salaryDirtyPeriods[_salaryPeriod]) cacheSalaryDraft();
    if (!_salaryPeriod) _salaryPeriod = curYM();
    if (_salaryView === 'entry') loadSalaryPeriod();
    renderSalaryPage();
}

function renderSalaryPage() {
    var h = '<div class="salary-module-tabs" role="tablist" aria-label="工资功能">';
    h += '<button type="button" class="salary-module-tab ' + (_salaryView === 'entry' ? 'active' : '') + '" role="tab" aria-selected="' + (_salaryView === 'entry') + '" onclick="switchSalaryView(\'entry\')">录入</button>';
    h += '<button type="button" class="salary-module-tab ' + (_salaryView === 'detail' ? 'active' : '') + '" role="tab" aria-selected="' + (_salaryView === 'detail') + '" onclick="switchSalaryView(\'detail\')">明细</button>';
    h += '</div>';
    h += _salaryView === 'detail' ? renderSalaryDetailView() : renderSalaryEntryView();
    setMain('工资', h);
    if (_salaryView === 'entry') renderSalaryTable();
}

function renderSalaryEntryView() {
    var h = '<div style="display:flex;gap:8px;margin-bottom:16px;align-items:center;flex-wrap:wrap">';
    h += '<label>月份</label><button class="btn s" onclick="salaryCalNav(-1)">◀</button>';
    h += '<input class="inp" id="salPeriod" type="text" readonly value="' + _salaryPeriod + '" onclick="_mpOpen(\'salPeriod\')" onchange="changeSalaryPeriod(this.value)" style="max-width:180px;cursor:pointer">';
    h += '<button class="btn s" onclick="salaryCalNav(1)">▶</button><span id="salDraftState" style="font-size:.72rem;color:var(--og)"></span><div style="flex:1"></div>';
    h += '<button class="btn" onclick="addSalaryRow()">+ 添加行</button><button class="btn" onclick="importSalaryExcel()">📥 导入Excel</button><button class="btn" onclick="saveSalaryTemplate()">💾 保存模板</button><button class="btn p" onclick="saveSalaryTable()">💾 保存</button></div>';
    h += '<input type="file" id="salExcelInput" accept=".xlsx,.xls" style="display:none" onchange="handleSalaryExcel(event)">';
    h += '<div class="tw" style="overflow-x:auto"><table id="salTable"><thead><tr><th style="width:34px"></th>';
    SALARY_FIELDS.forEach(function(field) { h += '<th class="' + (field.numeric ? 'nr' : '') + '">' + field.label + '</th>'; });
    h += '<th class="nr">实发工资</th><th>操作</th></tr></thead><tbody id="salTableBody"></tbody><tfoot id="salTableFoot"></tfoot></table></div>';
    return h;
}

function createSalaryInput(row, field) {
    var input = document.createElement('input');
    input.className = 'inp' + (field.numeric ? ' nr' : '');
    input.type = field.numeric ? 'number' : 'text';
    input.value = field.numeric ? String(row[field.key] || 0) : row[field.key];
    input.style.width = field.width;
    input.style.padding = '4px';
    input.addEventListener('input', function() {
        updateSalaryRow(row.id, field.key, input.value);
    });
    return input;
}

function createSalaryRowElement(row) {
    var tr = document.createElement('tr');
    tr.dataset.rowId = row.id;
    tr.addEventListener('dragover', onSalDragOver);
    tr.addEventListener('drop', function(event) { onSalDrop(event, row.id); });

    var handleCell = document.createElement('td');
    var handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'btn s';
    handle.textContent = '⋮⋮';
    handle.title = '拖拽排序';
    handle.draggable = true;
    handle.style.cursor = 'grab';
    handle.style.padding = '2px 4px';
    handle.addEventListener('dragstart', function(event) { onSalDragStart(event, row.id); });
    handle.addEventListener('dragend', onSalDragEnd);
    handleCell.appendChild(handle);
    tr.appendChild(handleCell);

    SALARY_FIELDS.forEach(function(field) {
        var cell = document.createElement('td');
        cell.appendChild(createSalaryInput(row, field));
        tr.appendChild(cell);
    });

    var actualCell = document.createElement('td');
    actualCell.className = 'nr';
    actualCell.dataset.salaryActual = row.id;
    actualCell.style.fontWeight = '600';
    actualCell.style.color = 'var(--ac)';
    actualCell.textContent = fmtC(calcSalaryActual(row));
    tr.appendChild(actualCell);

    var actionCell = document.createElement('td');
    var removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'btn s d';
    removeButton.textContent = '×';
    removeButton.addEventListener('click', function() { removeSalaryRow(row.id); });
    actionCell.appendChild(removeButton);
    tr.appendChild(actionCell);
    return tr;
}

function renderSalaryTable() {
    var body = $id('salTableBody');
    if (!body) return;
    body.replaceChildren();
    _salaryTableData.forEach(function(row) { body.appendChild(createSalaryRowElement(row)); });
    updateSalarySummaries();
    updateSalaryDraftState();
}

function updateSalarySummaries() {
    _salaryTableData.forEach(function(row) {
        var actual = document.querySelector('[data-salary-actual="' + row.id + '"]');
        if (actual) actual.textContent = fmtC(calcSalaryActual(row));
    });
    var foot = $id('salTableFoot');
    if (!foot) return;
    var totals = calcSalaryTotals(_salaryTableData);
    foot.replaceChildren();
    var tr = document.createElement('tr');
    tr.style.background = 'var(--card-h)';
    tr.style.fontWeight = '600';
    var label = document.createElement('td');
    label.colSpan = 4;
    label.textContent = '合计';
    tr.appendChild(label);
    SALARY_FIELDS.filter(function(field) { return field.numeric; }).forEach(function(field) {
        var cell = document.createElement('td');
        cell.className = 'nr';
        cell.textContent = fmtC(totals[field.key]);
        tr.appendChild(cell);
    });
    var actualTotal = document.createElement('td');
    actualTotal.className = 'nr';
    actualTotal.style.color = 'var(--ac)';
    actualTotal.textContent = fmtC(totals.actualSalary);
    tr.appendChild(actualTotal);
    tr.appendChild(document.createElement('td'));
    foot.appendChild(tr);
}

function updateSalaryDraftState() {
    var state = $id('salDraftState');
    if (state) state.textContent = hasSalaryDraft() ? '未保存草稿' : '';
}

function switchSalaryView(view) {
    if (view === _salaryView) return;
    if (_salaryPeriod && _salaryDirtyPeriods[_salaryPeriod]) cacheSalaryDraft();
    _salaryView = view === 'detail' ? 'detail' : 'entry';
    if (_salaryView === 'entry') loadSalaryPeriod();
    renderSalaryPage();
}

function salaryEscape(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function(char) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char];
    });
}

function salaryRecordActual(record) {
    return typeof record.actualSalary === 'number' ? record.actualSalary : calcSalaryActual(record);
}

function salaryRequireAuth() {
    return typeof requireAuth !== 'function' || requireAuth();
}

function salaryMonthGroups() {
    var groups = {};
    (DB.salaryRecords || []).forEach(function(record) {
        if (!record.period) return;
        if (!groups[record.period]) groups[record.period] = { period: record.period, count: 0, total: 0 };
        groups[record.period].count += 1;
        groups[record.period].total += salaryRecordActual(record);
    });
    return Object.keys(groups).sort().reverse().map(function(period) { return groups[period]; });
}

function activeSalaryTrash() {
    var now = Date.now();
    return (DB.salaryTrash || []).filter(function(item) { return item && item.expiresAt > now; });
}

function salaryPruneTrash(db) {
    var now = Date.now();
    db.salaryTrash = (db.salaryTrash || []).filter(function(item) { return item && item.expiresAt > now; });
}

function salaryMonthRecords(period) {
    return (DB.salaryRecords || []).filter(function(record) { return record.period === period; });
}

function salaryTrashLabel(item) {
    var count = (item.records || []).length;
    return item.kind === 'record'
        ? item.period + ' · ' + (item.recordName || '工资条')
        : item.period + ' 工资表 · ' + count + ' 人';
}

function renderSalaryDetailView() {
    var trash = activeSalaryTrash();
    var h = '<div class="salary-detail-toolbar"><div>';
    h += '<div class="salary-detail-kicker">已保存工资表</div><div class="salary-detail-caption">按月份查看实发工资总额</div>';
    h += '</div><button class="btn" onclick="openSalaryTrash()">♻ 回收站' + (trash.length ? ' <span class="salary-trash-count">' + trash.length + '</span>' : '') + '</button></div>';
    if (_salaryDetailPeriod) return h + renderSalaryMonthDetail(_salaryDetailPeriod);

    var groups = salaryMonthGroups();
    if (!groups.length) {
        return h + '<div class="salary-empty-state"><div class="salary-empty-icon">▤</div><strong>还没有已保存的工资表</strong><span>在“录入”标签保存工资后，会按月份显示在这里。</span><button class="btn p" onclick="switchSalaryView(\'entry\')">去录入工资</button></div>';
    }
    h += '<div class="salary-month-list">';
    groups.forEach(function(group) {
        h += '<button class="salary-month-row" type="button" onclick="openSalaryMonthDetail(\'' + group.period + '\')">';
        h += '<span class="salary-month-period">' + salaryEscape(group.period) + '</span>';
        h += '<span class="salary-month-meta">' + group.count + ' 人</span>';
        h += '<strong class="salary-month-total">¥' + fmtC(group.total) + '</strong><span class="salary-month-arrow">›</span></button>';
    });
    return h + '</div>';
}

function renderSalaryMonthDetail(period) {
    var records = salaryMonthRecords(period);
    var total = records.reduce(function(sum, record) { return sum + salaryRecordActual(record); }, 0);
    var h = '<div class="salary-month-detail">';
    h += '<div class="salary-month-detail-head"><button class="btn s" onclick="closeSalaryMonthDetail()">← 明细</button><div class="salary-month-detail-title"><strong>' + salaryEscape(period) + ' 工资明细</strong><span>' + records.length + ' 人 · 实发工资总额</span></div><div style="flex:1"></div><button class="btn" onclick="openSalaryMonthMove(\'' + period + '\')">修改月份</button><button class="btn" onclick="openSalaryInEntry(\'' + period + '\')">在录入中编辑</button><button class="btn d" onclick="trashSalaryMonth(\'' + period + '\')">删除本月</button></div>';
    h += '<div class="salary-month-total-card"><span>实发工资总额</span><strong>¥' + fmtC(total) + '</strong></div>';
    h += '<div class="salary-person-list">';
    records.forEach(function(record) {
        h += '<button type="button" class="salary-person-row" onclick="openSalaryRecordDetail(\'' + period + '\',\'' + salaryEscape(record.id) + '\')">';
        h += '<span class="salary-person-avatar">' + salaryEscape((record.employee || '?').slice(0, 1)) + '</span><span class="salary-person-name"><strong>' + salaryEscape(record.employee || '未命名员工') + '</strong><small>' + salaryEscape(record.department || '未分部门') + (record.position ? ' · ' + salaryEscape(record.position) : '') + '</small></span>';
        h += '<strong class="salary-person-total">¥' + fmtC(salaryRecordActual(record)) + '</strong><span class="salary-month-arrow">›</span></button>';
    });
    return h + '</div></div>';
}

function openSalaryMonthDetail(period) {
    _salaryView = 'detail';
    _salaryDetailPeriod = period;
    renderSalaryPage();
}

function closeSalaryMonthDetail() {
    _salaryDetailPeriod = '';
    renderSalaryPage();
}

function openSalaryInEntry(period) {
    _salaryPeriod = period;
    _salaryView = 'entry';
    _salaryDetailPeriod = '';
    loadSalaryPeriod();
    renderSalaryPage();
}

function openSalaryMonthMove(period) {
    if (!salaryRequireAuth()) return;
    var records = salaryMonthRecords(period);
    if (!records.length) { toast('该月没有可迁移的工资记录'); return; }
    var h = '<h3>修改工资月份</h3><p class="salary-move-copy">将 <strong>' + salaryEscape(period) + '</strong> 的 ' + records.length + ' 条工资记录整体迁移到新月份。</p>';
    h += '<label class="salary-move-field">工资月份<input class="inp" id="salaryMoveTarget" type="text" readonly value="' + salaryEscape(period) + '" onclick="_mpOpen(\'salaryMoveTarget\')" aria-haspopup="dialog" style="cursor:pointer"></label>';
    h += '<p class="salary-move-hint">未保存的录入草稿不会随此操作移动。</p><div class="salary-record-editor-actions"><div style="flex:1"></div><button class="btn" onclick="closeModal()">取消</button><button class="btn p" onclick="prepareSalaryMonthMove(\'' + period + '\')">继续</button></div>';
    showModal(h, 480);
}

function prepareSalaryMonthMove(sourcePeriod) {
    if (!salaryRequireAuth()) return;
    var targetInput = $id('salaryMoveTarget');
    var targetPeriod = targetInput && targetInput.value;
    if (!/^\d{4}-\d{2}$/.test(targetPeriod)) { toast('请选择有效的工资月份'); return; }
    if (targetPeriod === sourcePeriod) { toast('工资月份未变化'); return; }
    var sourceRecords = salaryMonthRecords(sourcePeriod);
    var targetRecords = salaryMonthRecords(targetPeriod);
    if (!sourceRecords.length) { closeModal(); toast('该月工资表已不存在'); return; }
    if (!targetRecords.length) {
        var h = '<h3>确认迁移</h3><p class="salary-move-copy">将 <strong>' + salaryEscape(sourcePeriod) + '</strong> 的 ' + sourceRecords.length + ' 条工资记录迁移到 <strong>' + salaryEscape(targetPeriod) + '</strong>？</p>';
        h += '<p class="salary-move-hint">原月份将不再显示这张工资表。</p><div class="salary-record-editor-actions"><div style="flex:1"></div><button class="btn" onclick="closeModal()">取消</button><button class="btn p" onclick="moveSalaryMonth(\'' + sourcePeriod + '\',\'' + targetPeriod + '\',\'move\')">确认迁移</button></div>';
        showModal(h, 480);
        return;
    }
    var h = '<h3>目标月份已有工资表</h3><p class="salary-move-copy"><strong>' + salaryEscape(targetPeriod) + '</strong> 已有 ' + targetRecords.length + ' 条工资记录。请选择处理方式：</p>';
    h += '<div class="salary-move-options"><button class="salary-move-option" type="button" onclick="moveSalaryMonth(\'' + sourcePeriod + '\',\'' + targetPeriod + '\',\'merge\')"><strong>合并到 ' + salaryEscape(targetPeriod) + '</strong><span>保留两张工资表中的所有员工记录。</span></button>';
    h += '<button class="salary-move-option danger" type="button" onclick="moveSalaryMonth(\'' + sourcePeriod + '\',\'' + targetPeriod + '\',\'replace\')"><strong>覆盖 ' + salaryEscape(targetPeriod) + '</strong><span>目标月份原有工资表会移入回收站，保留 30 天。</span></button></div>';
    h += '<div class="salary-record-editor-actions"><div style="flex:1"></div><button class="btn" onclick="closeModal()">取消</button></div>';
    showModal(h, 520);
}

function moveSalaryMonth(sourcePeriod, targetPeriod, mode) {
    if (!salaryRequireAuth()) return;
    if (sourcePeriod === targetPeriod) return;
    var sourceRecords = salaryMonthRecords(sourcePeriod);
    var targetRecords = salaryMonthRecords(targetPeriod);
    if (!sourceRecords.length) { closeModal(); toast('该月工资表已不存在'); return; }
    if (targetRecords.length && mode !== 'merge' && mode !== 'replace') return;
    upd(function(db) {
        salaryPruneTrash(db);
        if (mode === 'replace' && targetRecords.length) {
            db.salaryTrash.push({ id: 'sal_trash_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), kind: 'month', period: targetPeriod, records: targetRecords.map(function(record) { return Object.assign({}, record); }), deletedAt: Date.now(), expiresAt: Date.now() + SALARY_TRASH_RETENTION_DAYS * 86400000, replacedByPeriod: sourcePeriod });
            db.salaryRecords = db.salaryRecords.filter(function(record) { return record.period !== targetPeriod; });
        }
        db.salaryRecords.forEach(function(record) {
            if (record.period === sourcePeriod) record.period = targetPeriod;
        });
    });
    if (_salaryPeriod === sourcePeriod) _salaryPeriod = targetPeriod;
    _salaryDetailPeriod = targetPeriod;
    closeModal();
    renderSalaryPage();
    toast(mode === 'merge' ? '已合并到 ' + targetPeriod : '工资表已迁移至 ' + targetPeriod);
}

function openSalaryRecordDetail(period, recordId) {
    var record = salaryMonthRecords(period).find(function(item) { return item.id === recordId; });
    if (!record) { toast('未找到这条工资记录'); return; }
    var h = '<h3>' + salaryEscape(record.employee || '工资条') + '<span style="font-size:.72rem;color:var(--tx-m);font-weight:400"> · ' + salaryEscape(period) + '</span></h3>';
    h += '<div class="salary-record-editor">';
    SALARY_FIELDS.forEach(function(field) {
        var value = field.numeric ? (Number(record[field.key]) || 0) : (record[field.key] || '');
        h += '<label>' + field.label + '<input class="inp" id="salaryRecord_' + field.key + '" type="' + (field.numeric ? 'number' : 'text') + '" value="' + salaryEscape(value) + '"></label>';
    });
    h += '<label class="salary-record-note">备注<textarea class="inp" id="salaryRecord_note">' + salaryEscape(record.note || '') + '</textarea></label></div>';
    h += '<div class="salary-record-editor-actions"><button class="btn d" onclick="trashSalaryRecord(\'' + salaryEscape(period) + '\',\'' + salaryEscape(recordId) + '\')">删除此人</button><div style="flex:1"></div><button class="btn" onclick="closeModal()">取消</button><button class="btn p" onclick="saveSalaryRecordDetail(\'' + salaryEscape(period) + '\',\'' + salaryEscape(recordId) + '\')">保存修改</button></div>';
    showModal(h, 760);
}

function saveSalaryRecordDetail(period, recordId) {
    if (!salaryRequireAuth()) return;
    var changes = {};
    SALARY_FIELDS.forEach(function(field) {
        var input = $id('salaryRecord_' + field.key);
        changes[field.key] = field.numeric ? (parseFloat(input && input.value) || 0) : (input ? input.value.trim() : '');
    });
    changes.note = ($id('salaryRecord_note') || {}).value || '';
    if (!changes.employee) { toast('请填写姓名'); return; }
    upd(function(db) {
        var record = (db.salaryRecords || []).find(function(item) { return item.period === period && item.id === recordId; });
        if (!record) return;
        Object.assign(record, changes);
        record.baseTotal = (record.baseSalary || 0) + (record.positionSubsidy || 0) + (record.overtimeSubsidy || 0) + (record.allowance || 0) + (record.fullAttendance || 0) + (record.seniority || 0);
        record.subtotal = record.baseTotal + (record.commission || 0) + (record.otherSubsidy || 0) + (record.performance || 0);
        record.totalDeduction = (record.socialInsurance || 0) + (record.tax || 0);
        record.actualSalary = record.subtotal - record.totalDeduction;
    });
    closeModal();
    renderSalaryPage();
    toast('工资条已更新');
}

function trashSalaryRecord(period, recordId) {
    if (!salaryRequireAuth()) return;
    var record = salaryMonthRecords(period).find(function(item) { return item.id === recordId; });
    if (!record || !confirm('将“' + (record.employee || '该员工') + '”的工资条移入回收站？')) return;
    upd(function(db) {
        salaryPruneTrash(db);
        db.salaryTrash.push({ id: 'sal_trash_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), kind: 'record', period: period, recordName: record.employee || '工资条', records: [Object.assign({}, record)], deletedAt: Date.now(), expiresAt: Date.now() + SALARY_TRASH_RETENTION_DAYS * 86400000 });
        db.salaryRecords = db.salaryRecords.filter(function(item) { return item.id !== recordId; });
    });
    closeModal();
    renderSalaryPage();
    toast('已移入回收站，可在 30 天内恢复');
}

function trashSalaryMonth(period) {
    if (!salaryRequireAuth()) return;
    var records = salaryMonthRecords(period);
    var total = records.reduce(function(sum, record) { return sum + salaryRecordActual(record); }, 0);
    if (!records.length || !confirm('确定将 ' + period + ' 工资表（' + records.length + ' 人，¥' + fmtC(total) + '）移入回收站吗？')) return;
    upd(function(db) {
        salaryPruneTrash(db);
        db.salaryTrash.push({ id: 'sal_trash_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8), kind: 'month', period: period, records: records.map(function(record) { return Object.assign({}, record); }), deletedAt: Date.now(), expiresAt: Date.now() + SALARY_TRASH_RETENTION_DAYS * 86400000 });
        db.salaryRecords = db.salaryRecords.filter(function(record) { return record.period !== period; });
    });
    _salaryDetailPeriod = '';
    renderSalaryPage();
    toast('已移入回收站，可在 30 天内恢复');
}

function openSalaryTrash() {
    var items = activeSalaryTrash().sort(function(a, b) { return b.deletedAt - a.deletedAt; });
    var h = '<h3>工资回收站</h3><p style="font-size:.74rem;color:var(--tx-m);margin-bottom:12px">删除的工资表和工资条保留 30 天，到期后不可恢复。</p>';
    if (!items.length) h += '<div class="salary-trash-empty">回收站为空</div>';
    items.forEach(function(item) {
        var expires = new Date(item.expiresAt).toLocaleDateString('zh-CN');
        h += '<div class="salary-trash-item"><div><strong>' + salaryEscape(salaryTrashLabel(item)) + '</strong><small>恢复截止：' + expires + '</small></div><div><button class="btn s" onclick="restoreSalaryTrash(\'' + item.id + '\')">恢复</button><button class="btn s d" onclick="permanentlyDeleteSalaryTrash(\'' + item.id + '\')">永久删除</button></div></div>';
    });
    h += '<div style="display:flex;justify-content:flex-end;margin-top:16px"><button class="btn" onclick="closeModal()">关闭</button></div>';
    showModal(h, 680);
}

function restoreSalaryTrash(itemId) {
    if (!salaryRequireAuth()) return;
    var item = activeSalaryTrash().find(function(entry) { return entry.id === itemId; });
    if (!item) { toast('该回收站项目已过期'); closeModal(); return; }
    var existing = salaryMonthRecords(item.period);
    if (item.kind === 'month' && existing.length && !confirm(item.period + ' 已有工资表，恢复会覆盖现有 ' + existing.length + ' 条记录。继续吗？')) return;
    upd(function(db) {
        var restored = (item.records || []).map(function(record) { return Object.assign({}, record); });
        if (item.kind === 'month') db.salaryRecords = db.salaryRecords.filter(function(record) { return record.period !== item.period; });
        restored.forEach(function(record) {
            db.salaryRecords = db.salaryRecords.filter(function(current) { return current.id !== record.id; });
            db.salaryRecords.push(record);
        });
        db.salaryTrash = (db.salaryTrash || []).filter(function(entry) { return entry.id !== itemId; });
    });
    closeModal();
    renderSalaryPage();
    toast('已恢复' + (item.kind === 'month' ? '整月工资表' : '工资条'));
}

function permanentlyDeleteSalaryTrash(itemId) {
    if (!salaryRequireAuth()) return;
    if (!confirm('永久删除后将无法恢复，确定继续吗？')) return;
    upd(function(db) { db.salaryTrash = (db.salaryTrash || []).filter(function(item) { return item.id !== itemId; }); });
    openSalaryTrash();
    renderSalaryPage();
}

// 工资模板功能
function loadSalaryTemplate() {
    try {
        var config = JSON.parse(localStorage.getItem(getConfigKey() + '_salaryTemplate') || 'null');
        if (config && config.length > 0) {
            return config.map(normalizeSalaryRow);
        }
    } catch(e) {}
    return [createSalaryEmptyRow()];
}

function saveSalaryTemplate() {
    var template = _salaryTableData.filter(function(r) { return r.employee; }).map(function(r) {
        return {
            department: r.department || '',
            employee: r.employee || '',
            position: r.position || '',
            baseSalary: r.baseSalary || 0,
            positionSubsidy: r.positionSubsidy || 0,
            overtimeSubsidy: r.overtimeSubsidy || 0,
            allowance: r.allowance || 0,
            fullAttendance: r.fullAttendance || 0,
            seniority: r.seniority || 0,
            commission: 0,
            otherSubsidy: 0,
            performance: 0,
            socialInsurance: r.socialInsurance || 0,
            tax: 0,
            note: ''
        };
    });

    if (template.length === 0) {
        toast('没有可保存的人员');
        return;
    }

    localStorage.setItem(getConfigKey() + '_salaryTemplate', JSON.stringify(template));
    toast('已保存模板（' + template.length + '人）');
}

function onSalDragStart(event, rowId) {
    _salDragRowId = rowId;
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', rowId);
    event.currentTarget.closest('tr').style.opacity = '0.5';
}

function onSalDragOver(event) {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    var target = event.currentTarget;
    var rect = target.getBoundingClientRect();
    setSalaryDropIndicator(target, event.clientY < rect.top + rect.height / 2 ? 'before' : 'after');
}

function onSalDrop(event, targetRowId) {
    event.preventDefault();
    var sourceRowId = _salDragRowId || event.dataTransfer.getData('text/plain');
    var dropPosition = _salDropTargetId === targetRowId ? _salDropPosition : 'before';
    clearSalaryDropIndicator();
    if (!sourceRowId || sourceRowId === targetRowId) return;
    var sourceIndex = _salaryTableData.findIndex(function(row) { return row.id === sourceRowId; });
    var targetIndex = _salaryTableData.findIndex(function(row) { return row.id === targetRowId; });
    if (sourceIndex < 0 || targetIndex < 0) return;
    var moved = _salaryTableData.splice(sourceIndex, 1)[0];
    targetIndex = _salaryTableData.findIndex(function(row) { return row.id === targetRowId; });
    _salaryTableData.splice(dropPosition === 'after' ? targetIndex + 1 : targetIndex, 0, moved);
    cacheSalaryDraft();
    var body = $id('salTableBody');
    var sourceElement = body && body.querySelector('[data-row-id="' + sourceRowId + '"]');
    var targetElement = body && body.querySelector('[data-row-id="' + targetRowId + '"]');
    if (sourceElement && targetElement) body.insertBefore(sourceElement, dropPosition === 'after' ? targetElement.nextSibling : targetElement);
    updateSalaryDraftState();
}

function onSalDragEnd(event) {
    var row = event.currentTarget.closest('tr');
    if (row) row.style.opacity = '';
    _salDragRowId = null;
    clearSalaryDropIndicator();
}

function clearSalaryDropIndicator() {
    document.querySelectorAll('#salTableBody .salary-drop-before, #salTableBody .salary-drop-after').forEach(function(row) {
        row.classList.remove('salary-drop-before', 'salary-drop-after');
    });
    var marker = $id('salaryDropMarker');
    if (marker) marker.remove();
    _salDropTargetId = null;
}

function setSalaryDropIndicator(target, position) {
    if (_salDropTargetId === target.dataset.rowId && _salDropPosition === position) return;
    clearSalaryDropIndicator();
    _salDropTargetId = target.dataset.rowId;
    _salDropPosition = position;
    target.classList.add(position === 'before' ? 'salary-drop-before' : 'salary-drop-after');

    var marker = document.createElement('tr');
    marker.id = 'salaryDropMarker';
    marker.className = 'salary-drop-marker';
    marker.setAttribute('aria-hidden', 'true');
    var cell = document.createElement('td');
    cell.colSpan = SALARY_FIELDS.length + 3;
    var line = document.createElement('div');
    line.className = 'salary-drop-line';
    var label = document.createElement('span');
    label.textContent = '放在这里';
    line.appendChild(label);
    cell.appendChild(line);
    marker.appendChild(cell);
    target.parentNode.insertBefore(marker, position === 'before' ? target : target.nextSibling);
}

function createSalaryEmptyRow() {
    return {
        id: salaryRowId(),
        period: _salaryPeriod,
        department: '',
        employee: '',
        position: '',
        baseSalary: 0,
        positionSubsidy: 0,
        overtimeSubsidy: 0,
        allowance: 0,
        fullAttendance: 0,
        seniority: 0,
        commission: 0,
        otherSubsidy: 0,
        performance: 0,
        socialInsurance: 0,
        tax: 0,
        note: ''
    };
}

function calcSalaryActual(row) {
    var base = (row.baseSalary || 0) + (row.positionSubsidy || 0) +
        (row.overtimeSubsidy || 0) + (row.allowance || 0) +
        (row.fullAttendance || 0) + (row.seniority || 0);
    var subtotal = base + (row.commission || 0) +
        (row.otherSubsidy || 0) + (row.performance || 0);
    var deduction = (row.socialInsurance || 0) + (row.tax || 0);
    return subtotal - deduction;
}

function calcSalaryTotals(rows) {
    var totals = {
        baseSalary: 0, positionSubsidy: 0, overtimeSubsidy: 0,
        allowance: 0, fullAttendance: 0, seniority: 0,
        commission: 0, otherSubsidy: 0, performance: 0,
        socialInsurance: 0, tax: 0, actualSalary: 0
    };
    rows.forEach(function(r) {
        totals.baseSalary += r.baseSalary || 0;
        totals.positionSubsidy += r.positionSubsidy || 0;
        totals.overtimeSubsidy += r.overtimeSubsidy || 0;
        totals.allowance += r.allowance || 0;
        totals.fullAttendance += r.fullAttendance || 0;
        totals.seniority += r.seniority || 0;
        totals.commission += r.commission || 0;
        totals.otherSubsidy += r.otherSubsidy || 0;
        totals.performance += r.performance || 0;
        totals.socialInsurance += r.socialInsurance || 0;
        totals.tax += r.tax || 0;
        totals.actualSalary += calcSalaryActual(r);
    });
    return totals;
}

function addSalaryRow() {
    var row = createSalaryEmptyRow();
    _salaryTableData.push(row);
    cacheSalaryDraft();
    var body = $id('salTableBody');
    if (body) body.appendChild(createSalaryRowElement(row));
    updateSalarySummaries();
    updateSalaryDraftState();
    var addedRow = body && body.querySelector('[data-row-id="' + row.id + '"] input');
    if (addedRow) addedRow.focus();
}

function removeSalaryRow(rowId) {
    _salaryTableData = _salaryTableData.filter(function(row) { return row.id !== rowId; });
    cacheSalaryDraft();
    var row = document.querySelector('[data-row-id="' + rowId + '"]');
    if (row) row.remove();
    updateSalarySummaries();
    updateSalaryDraftState();
}

function updateSalaryRow(rowId, field, value) {
    var row = _salaryTableData.find(function(item) { return item.id === rowId; });
    var fieldDefinition = SALARY_FIELDS.find(function(item) { return item.key === field; });
    if (!row || !fieldDefinition) return;
    row[field] = fieldDefinition.numeric ? (parseFloat(value) || 0) : value;
    cacheSalaryDraft();
    updateSalarySummaries();
    updateSalaryDraftState();
}

function salaryCalNav(dir) {
    var newPeriod = calendarNav(dir, _salaryPeriod, '');
    changeSalaryPeriod(newPeriod);
}

function changeSalaryPeriod(period) {
    if (!period || period === _salaryPeriod) return;
    if (_salaryDirtyPeriods[_salaryPeriod]) cacheSalaryDraft();
    _salaryPeriod = period;
    loadSalaryPeriod();
    renderSalaryPage();
}

function saveSalaryTable() {
    var validRows = _salaryTableData.filter(function(r) { return r.employee && calcSalaryActual(r) !== 0; });
    if (validRows.length === 0) { toast('没有有效数据'); return; }

    upd(function(db) {
        if (!db.salaryRecords) db.salaryRecords = [];
        // 删除该月份的旧记录
        db.salaryRecords = db.salaryRecords.filter(function(r) { return r.period !== _salaryPeriod; });
        // 添加新记录
        validRows.forEach(function(r) {
            r.period = _salaryPeriod;
            r.id = 'sal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            r.date = td();
            r.baseTotal = (r.baseSalary || 0) + (r.positionSubsidy || 0) + (r.overtimeSubsidy || 0) + (r.allowance || 0) + (r.fullAttendance || 0) + (r.seniority || 0);
            r.subtotal = r.baseTotal + (r.commission || 0) + (r.otherSubsidy || 0) + (r.performance || 0);
            r.totalDeduction = (r.socialInsurance || 0) + (r.tax || 0);
            r.actualSalary = r.subtotal - r.totalDeduction;
            db.salaryRecords.push(r);
        });
    });
    delete _salaryDrafts[_salaryPeriod];
    delete _salaryDirtyPeriods[_salaryPeriod];
    toast('已保存 ' + validRows.length + ' 条工资记录');
    loadSalaryPeriod();
    renderSalaryPage();
}

function importSalaryExcel() {
    $id('salExcelInput').click();
}

function handleSalaryExcel(event) {
    var file = event.target.files[0];
    if (!file) return;

    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            // 使用 SheetJS 解析 Excel
            var data = new Uint8Array(e.target.result);
            var workbook = XLSX.read(data, { type: 'array' });
            var sheetName = workbook.SheetNames[0];
            var sheet = workbook.Sheets[sheetName];
            var jsonData = XLSX.utils.sheet_to_json(sheet);
            parseSalaryExcelData(jsonData);
        } catch (err) {
            console.error('Excel parse error:', err);
            toast('Excel解析失败');
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

function parseSalaryExcelData(jsonData) {
    _salaryTableData = jsonData.map(function(row) {
        return {
            period: _salaryPeriod,
            department: row['部门'] || row['department'] || '',
            employee: row['姓名'] || row['employee'] || '',
            position: row['职务'] || row['position'] || '',
            baseSalary: parseFloat(row['基本工资'] || row['baseSalary']) || 0,
            positionSubsidy: parseFloat(row['职务补贴'] || row['positionSubsidy']) || 0,
            overtimeSubsidy: parseFloat(row['加班补贴'] || row['overtimeSubsidy']) || 0,
            allowance: parseFloat(row['津贴'] || row['allowance']) || 0,
            fullAttendance: parseFloat(row['满勤奖'] || row['fullAttendance']) || 0,
            seniority: parseFloat(row['司龄工龄'] || row['seniority']) || 0,
            commission: parseFloat(row['提成'] || row['commission']) || 0,
            otherSubsidy: parseFloat(row['其他补助'] || row['otherSubsidy']) || 0,
            performance: parseFloat(row['绩效工资'] || row['performance']) || 0,
            socialInsurance: parseFloat(row['社保'] || row['socialInsurance']) || 0,
            tax: parseFloat(row['个税'] || row['tax']) || 0,
            note: row['备注'] || row['note'] || '',
            id: salaryRowId()
        };
    });
    cacheSalaryDraft();
    toast('已导入 ' + _salaryTableData.length + ' 条记录');
    renderSalaryTable();
}

// ------ 侧边栏生成 ------
// 根据配置动态生成侧边栏，兼容旧用户（无配置时显示所有）
// 配置跟随用户，每个用户有自己的配置

function getConfigKey() {
    // 如果已登录，配置键包含用户ID
    if (typeof _auth !== 'undefined' && _auth && _auth.loggedIn && _auth.user && _auth.user.id) {
        return 'ax_app_config_' + _auth.user.id;
    }
    // 未登录时使用默认键
    return 'ax_app_config';
}

function getAppConfig() {
    try {
        // 只读取用户特定的配置键
        var userKey = getConfigKey();
        var saved = localStorage.getItem(userKey);
        if (saved) return JSON.parse(saved);
    } catch(e) {}
    return null;
}

function isModuleEnabled(moduleId) {
    var config = getAppConfig();
    // 无配置或配置为空 → 显示所有（兼容旧用户）
    if (!config) return true;
    if (!config.enabledModules || config.enabledModules.length === 0) return true;
    // 有配置 → 按配置显示
    return config.enabledModules.includes(moduleId);
}

function isInventoryTypeEnabled(typeId) {
    var config = getAppConfig();
    // 无配置或配置为空 → 显示所有（兼容旧用户）
    if (!config) return true;
    if (!config.inventoryTypes || config.inventoryTypes.length === 0) return true;
    // 有配置 → 按配置显示
    return config.inventoryTypes.includes(typeId);
}

function renderNav() {
    // 日常经营（总览始终显示）
    var mainPages = [
        { id: 'dash',     icon: '📊', label: '总览' }
    ];
    if (isModuleEnabled('daily')) mainPages.push({ id: 'daily', icon: '📝', label: '日报' });
    if (isModuleEnabled('purchase')) mainPages.push({ id: 'purchase', icon: '🛒', label: '采购' });
    if (isModuleEnabled('expense')) mainPages.push({ id: 'expense', icon: '💰', label: '费用' });
    if (isModuleEnabled('salary')) mainPages.push({ id: 'salary', icon: '👤', label: '工资' });

    // 贵重物品（根据配置显示）
    var invPages = [];
    if (isInventoryTypeEnabled('tea')) invPages.push({ id: 'tea', icon: '🍵', label: '茗茶' });
    if (isInventoryTypeEnabled('cig')) invPages.push({ id: 'cig', icon: '🚬', label: '香烟' });
    if (isInventoryTypeEnabled('alc')) invPages.push({ id: 'alc', icon: '🍺', label: '酒类' });
    if (isInventoryTypeEnabled('other')) invPages.push({ id: 'other', icon: '💎', label: '贵重' });

    // 添加自定义贵重物品类型
    var config = getAppConfig();
    if (config && config.customInventoryTypes && config.customInventoryTypes.length > 0) {
        config.customInventoryTypes.forEach(function(type) {
            invPages.push({ id: 'custom_' + type, icon: '💎', label: type, isCustom: true });
        });
    }

    // 仓库管理
    var whPages = [];
    if (isModuleEnabled('warehouse')) whPages.push({ id: 'wh', icon: '🏪', label: '仓库' });
    if (isModuleEnabled('damage')) whPages.push({ id: 'damage', icon: '⚠️', label: '报损' });

    // 数据分析
    var reportPages = [];
    if (isModuleEnabled('report')) reportPages.push({ id: 'report', icon: '📈', label: '报表' });
    if (isModuleEnabled('brief')) reportPages.push({ id: 'gen', icon: '📤', label: '汇报' });

    function renderGroup(pages, containerId) {
        var el = $id(containerId);
        if (!el) return;
        if (pages.length === 0) {
            el.innerHTML = '';
            el.style.display = 'none';
            return;
        }
        el.style.display = '';
        el.innerHTML = pages.map(function(p) {
            return '<button class="toolbar-btn" data-page="' + p.id + '" onclick="goPage(\'' + p.id + '\')" title="' + p.label + '">' +
                '<span class="ticon">' + p.icon + '</span>' +
                '<span class="tlabel">' + p.label + '</span>' +
                '</button>';
        }).join('');
    }

    renderGroup(mainPages, 'toolbarMain');
    renderGroup(invPages, 'toolbarInv');
    renderGroup(whPages, 'toolbarWh');
    renderGroup(reportPages, 'toolbarReport');

    var active = $id('toolbarMain').querySelector('.toolbar-btn');
    if (active) active.classList.add('active');
}

// 切换高亮
function switchNav(btn) {
    document.querySelectorAll('.toolbar-btn').forEach(function(b) {
        b.classList.remove('active');
    });
    btn.classList.add('active');
}

// 更新悬浮导航栏的子标签
function updateFnavTabs(page) {
  var tabs = {
    home:     ['概览', '日报', '采购'],
    tea:      ['库存', '明细'],
    cig:      ['库存', '明细'],
    alc:      ['库存', '明细'],
    report:   ['利润表', '营收', '成本', '毛利']
  };

  var tabList = tabs[page];
  var el = $id('fnavTabs');
  if (!tabList || !tabList.length) { el.innerHTML = ''; return; }

  el.innerHTML = tabList.map(function(t, i) {
    return '<button class="fnav-tab' + (i === 0 ? ' active' : '') + '" onclick="fnavTabClick(this,\'' + page + '\',' + i + ')">' + t + '</button>';
  }).join('');
}

function fnavTabClick(btn, page, idx) {
  $id('fnavTabs').querySelectorAll('.fnav-tab').forEach(function(t) { t.classList.remove('active'); });
  btn.classList.add('active');

  // 如果页面内有子标签栏，同步切换
  var tabBtns = $id('mainContent').querySelectorAll('.tab-bar .tab-btn, .tab-bar button');
  if (tabBtns[idx]) tabBtns[idx].click();
}

// 切换侧边栏展开/收起
function toggleToolbar() {
    var toolbar = $id('toolbar');
    var mask = $id('toolbarMask');
    toolbar.classList.toggle('open');
    mask.classList.toggle('open');
    document.body.style.overflow = toolbar.classList.contains('open') ? 'hidden' : '';
}

// ---------- 刷新当前页面（同步后调用）----------
function renderPage(page) {
    console.log('renderPage called:', page);
    page = page || _curPage || 'dash';
    _curPage = page;
    var fn = {
        'dash': rDash,
        'daily': rDaily,
        'purchase': rPurchase,
        'expense': rExpense,
        'tea': function() { rInv('tea'); },
        'cig': function() { rInv('cig'); },
        'alc': function() { rInv('alc'); },
        'other': function() { rInv('other'); },
        'wh': rWH,
        'damage': rDamage,
        'report': rReport,
        'gen': rGen,
        'data': rData
    }[page];
    if (fn) fn();
    updateNav(page);
}

// ---------- 更新导航按钮高亮 ----------
function updateNav(p) {
    document.querySelectorAll('.nav-item').forEach(function(el) {
        el.classList.toggle('active', el.dataset.page === p);
    });
}

// ---------- 设置主内容区 ----------
// 所有页面渲染时调用，设置标题和内容
function setMain(t, c) {
    $id('mainContent').innerHTML = '<div class="page-title">' + t + '</div><div class="page active">' + c + '</div>';
    window.scrollTo(0, 0);
}


