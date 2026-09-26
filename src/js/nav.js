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
var _pendingSalaryImportRows = [];
var SALARY_TRASH_RETENTION_DAYS = 30;

function salaryFieldDefinitions() {
    return (getAppConfig().salaryFieldDefinitions || []).map(function(field) {
        return Object.assign({}, field, { key: field.id, numeric: field.type === 'number' });
    }).sort(function(a, b) { return a.order - b.order; });
}

function salaryInputFields(includeHidden) {
    return salaryFieldDefinitions().filter(function(field) {
        return field.category !== 'computed' && (includeHidden || field.visible !== false);
    });
}

function salaryVisibleFields() {
    return salaryFieldDefinitions().filter(function(field) { return field.visible !== false; });
}

function salaryNumericFields(includeHidden) {
    return salaryInputFields(includeHidden).filter(function(field) { return field.numeric; });
}

function salaryAllNumericFields() {
    return salaryFieldDefinitions().filter(function(field) { return field.numeric; });
}

function salaryActualField() {
    return salaryFieldDefinitions().find(function(field) { return field.id === 'actualSalary'; })
        || { id: 'actualSalary', key: 'actualSalary', label: '实发工资', category: 'computed', numeric: true };
}

function salaryFieldGroups() {
    return (getAppConfig().salaryFieldGroups || []).slice().sort(function(a, b) { return a.order - b.order; });
}

// 双行分组表头：span 分组（或未配置分组）的字段各自 rowspan=2，
// 普通分组第一行显示分组标题（colspan），第二行显示字段名，结构对齐原版 Excel 工资表。
function salaryTableHeaderHtml() {
    var visibleFields = salaryVisibleFields();
    var employeeField = visibleFields.find(function(field) { return field.key === 'employee'; });
    var fields = visibleFields.filter(function(field) { return field.key !== 'employee'; });
    var groupMap = {};
    salaryFieldGroups().forEach(function(group) { groupMap[group.id] = group; });

    var row1 = '<th class="salary-drag-column" rowspan="2"></th>';
    row1 += '<th class="salary-name-column" rowspan="2">' + salaryEscape(employeeField ? employeeField.label : '姓名') + '</th>';
    var row2 = '';

    var segments = [];
    fields.forEach(function(field) {
        var groupId = field.group || '';
        var last = segments[segments.length - 1];
        if (last && last.groupId === groupId) last.fields.push(field);
        else segments.push({ groupId: groupId, fields: [field] });
    });

    segments.forEach(function(segment) {
        var group = groupMap[segment.groupId];
        if (!group || group.span === true) {
            segment.fields.forEach(function(field) {
                row1 += '<th rowspan="2" class="salary-span-header' + (field.numeric ? ' nr' : '') + '">' + salaryEscape(field.label) + '</th>';
            });
        } else {
            row1 += '<th colspan="' + segment.fields.length + '" class="salary-group-header">' + salaryEscape(group.label) + '</th>';
            segment.fields.forEach(function(field) {
                row2 += '<th class="' + (field.numeric ? 'nr' : '') + '">' + salaryEscape(field.label) + '</th>';
            });
        }
    });
    row1 += '<th rowspan="2">操作</th>';
    return '<tr class="salary-group-row">' + row1 + '</tr>'
        + (row2 ? '<tr class="salary-field-label-row">' + row2 + '</tr>' : '');
}

function salaryRowId() {
    return 'sal_draft_' + Date.now() + '_' + Math.random().toString(36).slice(2, 9);
}

function cloneSalaryRows(rows) {
    return rows.map(function(row) { return Object.assign({}, row); });
}

function normalizeSalaryRow(row) {
    var result = Object.assign(createSalaryEmptyRow(), row || {});
    salaryInputFields(true).forEach(function(field) {
        var sourceValue = row ? row[field.key] : undefined;
        if (field.key === 'attendanceDays' && (sourceValue === undefined || sourceValue === null || sourceValue === '')) {
            result[field.key] = 31;
        } else {
            result[field.key] = field.numeric ? (Number(sourceValue) || 0) : (sourceValue || '');
        }
    });
    result.id = row.id || salaryRowId();
    result.employeeId = row.employeeId || row.id || salaryRowId();
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
    var h = '<div class="view-tabs" role="tablist" aria-label="工资视图">';
    h += '<button type="button" class="view-tab ' + (_salaryView === 'entry' ? 'active' : '') + '" role="tab" aria-selected="' + (_salaryView === 'entry') + '" onclick="switchSalaryView(\'entry\')">录入</button>';
    h += '<button type="button" class="view-tab ' + (_salaryView === 'detail' ? 'active' : '') + '" role="tab" aria-selected="' + (_salaryView === 'detail') + '" onclick="switchSalaryView(\'detail\')">明细</button>';
    h += '</div>';
    h += _salaryView === 'detail' ? renderSalaryDetailView() : renderSalaryEntryView();
    setMain('工资', h);
    if (_salaryView === 'entry') renderSalaryTable();
}

function renderSalaryEntryView() {
    var h = '<div class="salary-entry-toolbar">';
    h += '<div class="salary-period-group"><span class="salary-toolbar-label">月份</span>';
    h += '<div class="salary-period-control"><button type="button" class="salary-period-nav" onclick="salaryCalNav(-1)" aria-label="上一月">‹</button>';
    h += '<input class="salary-period-input" id="salPeriod" type="text" readonly value="' + _salaryPeriod + '" onclick="_mpOpen(\'salPeriod\')" onchange="changeSalaryPeriod(this.value)" aria-label="工资月份">';
    h += '<button type="button" class="salary-period-nav" onclick="salaryCalNav(1)" aria-label="下一月">›</button></div>';
    h += '<span id="salDraftState" class="salary-draft-state" hidden></span></div>';
    h += '<div class="salary-entry-actions"><button class="btn" onclick="openSalaryAddMenu()">添加 / 导入</button><button class="btn" onclick="openSalaryTemplateMenu()">模板</button><button class="btn p" onclick="saveSalaryTable()">保存工资</button></div></div>';
    h += '<input type="file" id="salExcelInput" accept=".xlsx,.xls" style="display:none" onchange="handleSalaryExcel(event)">';
    h += '<div class="tw salary-table-wrap"><table id="salTable"><thead>' + salaryTableHeaderHtml() + '</thead><tbody id="salTableBody"></tbody><tfoot id="salTableFoot"></tfoot></table></div>';
    return h;
}

function createSalaryInput(row, field) {
    var input;
    if (field.key === 'department') {
        input = document.createElement('select');
        input.className = 'inp';
        input.style.width = '112px';
        input.setAttribute('data-allow-custom', 'true');
        input.setAttribute('data-placeholder', '选择部门');
        var departments = salaryDepartments();
        var current = row.department || '';
        if (current && departments.indexOf(current) < 0) departments.push(current);
        input.innerHTML = '<option value="">未分部门</option>' + departments.map(function(department) {
            return '<option value="' + salaryEscape(department) + '"' + (department === current ? ' selected' : '') + '>' + salaryEscape(department) + '</option>';
        }).join('') + '<option value="__custom">自定义部门…</option>';
        input.addEventListener('change', function() {
            if (input.value === '__custom') {
                var department = (window.prompt('输入部门名称') || '').trim();
                if (!department) {
                    input.value = current || '';
                    return;
                }
                var option = document.createElement('option');
                option.value = department;
                option.textContent = department;
                input.insertBefore(option, input.querySelector('option[value="__custom"]'));
                option.selected = true;
            }
            updateSalaryRow(row.id, field.key, input.value);
        });
        return input;
    }

    input = document.createElement('input');
    var emptyValue = field.numeric ? Number(row[field.key] || 0) === 0 : !String(row[field.key] || '').trim();
    input.className = 'inp salary-input' + (field.numeric ? ' nr' : '') + (emptyValue ? ' salary-empty-value' : '');
    input.type = field.numeric ? 'number' : 'text';
    input.setAttribute('aria-label', field.label);
    input.value = field.numeric ? String(row[field.key] || 0) : row[field.key];
    input.style.width = field.width;
    input.style.padding = '4px';
    input.addEventListener('input', function() {
        input.classList.toggle('salary-empty-value', field.numeric
            ? Number(input.value || 0) === 0
            : !input.value.trim());
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
    handleCell.className = 'salary-drag-column';
    var handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'btn s';
    handle.textContent = '⋮⋮';
    handle.title = '拖拽排序';
    handle.setAttribute('aria-label', '拖拽排序工资行');
    handle.draggable = true;
    handle.style.cursor = 'grab';
    handle.style.padding = '2px 4px';
    handle.addEventListener('dragstart', function(event) { onSalDragStart(event, row.id); });
    handle.addEventListener('dragend', onSalDragEnd);
    handleCell.appendChild(handle);
    tr.appendChild(handleCell);

    var employeeField = salaryInputFields(true).find(function(field) { return field.key === 'employee'; });
    var nameCell = document.createElement('td');
    nameCell.className = 'salary-name-column';
    nameCell.appendChild(createSalaryInput(row, employeeField));
    tr.appendChild(nameCell);

    salaryVisibleFields().filter(function(field) { return field.key !== 'employee'; }).forEach(function(field) {
        var cell = document.createElement('td');
        if (field.category === 'computed') {
            cell.className = 'nr salary-computed-cell';
            cell.dataset.salaryComputed = row.id;
            cell.dataset.salaryField = field.key;
            cell.textContent = fmtC(salaryCalculatedValue(row, field.key));
        } else {
            cell.appendChild(createSalaryInput(row, field));
        }
        tr.appendChild(cell);
    });

    var actionCell = document.createElement('td');
    var removeButton = document.createElement('button');
    removeButton.type = 'button';
    removeButton.className = 'btn s d';
    removeButton.textContent = '×';
    removeButton.setAttribute('aria-label', '删除工资行');
    removeButton.addEventListener('click', function() { removeSalaryRow(row.id); });
    actionCell.appendChild(removeButton);
    tr.appendChild(actionCell);
    return tr;
}

function salaryDepartments() {
    var config = getAppConfig();
    var departments = uniqueStrings(config.salaryDepartments || [], []);
    _salaryTableData.forEach(function(row) {
        var department = String(row.department || '').trim() || '未分部门';
        if (departments.indexOf(department) < 0) departments.push(department);
    });
    if (departments.indexOf('未分部门') < 0) departments.unshift('未分部门');
    return departments;
}

function salaryDepartmentRows(department) {
    return _salaryTableData.filter(function(row) {
        return (String(row.department || '').trim() || '未分部门') === department;
    });
}

function renderSalaryTable() {
    var body = $id('salTableBody');
    if (!body) return;
    var visibleFields = salaryVisibleFields();
    body.replaceChildren();
    salaryDepartments().forEach(function(department) {
        var rows = salaryDepartmentRows(department);
        if (!rows.length) return;

        var header = document.createElement('tr');
        header.className = 'salary-department-row';
        var headerHandle = document.createElement('td');
        headerHandle.className = 'salary-summary-handle';
        header.appendChild(headerHandle);
        var headerCell = document.createElement('td');
        headerCell.className = 'salary-department-label';
        headerCell.textContent = department + ' · ' + rows.length + ' 人';
        header.appendChild(headerCell);
        var headerSpacer = document.createElement('td');
        headerSpacer.colSpan = Math.max(visibleFields.length - 1, 1);
        headerSpacer.className = 'salary-summary-spacer';
        header.appendChild(headerSpacer);
        header.appendChild(document.createElement('td'));
        body.appendChild(header);

        rows.forEach(function(row) { body.appendChild(createSalaryRowElement(row)); });

        var subtotal = document.createElement('tr');
        subtotal.className = 'salary-department-subtotal';
        var subtotalHandle = document.createElement('td');
        subtotalHandle.className = 'salary-summary-handle';
        subtotal.appendChild(subtotalHandle);
        var subtotalLabel = document.createElement('td');
        subtotalLabel.className = 'salary-subtotal-label';
        subtotalLabel.textContent = '部门小计';
        subtotal.appendChild(subtotalLabel);
        visibleFields.filter(function(field) { return field.key !== 'employee'; }).forEach(function(field) {
            var cell = document.createElement('td');
            if (field.numeric) {
                cell.className = 'nr';
                cell.dataset.salarySubtotal = department;
                cell.dataset.salaryField = field.key;
            } else {
                cell.className = 'salary-summary-spacer';
            }
            subtotal.appendChild(cell);
        });
        subtotal.appendChild(document.createElement('td'));
        body.appendChild(subtotal);
    });
    updateSalarySummaries();
    updateSalaryDraftState();
    if (window.axUI && window.axUI.initSelects) window.axUI.initSelects(body);
}

function updateSalarySummaries() {
    _salaryTableData.forEach(function(row) {
        document.querySelectorAll('[data-salary-computed="' + CSS.escape(row.id) + '"]').forEach(function(cell) {
            cell.textContent = fmtC(salaryCalculatedValue(row, cell.dataset.salaryField));
        });
    });
    salaryDepartments().forEach(function(department) {
        var totals = calcSalaryTotals(salaryDepartmentRows(department));
        document.querySelectorAll('[data-salary-subtotal="' + CSS.escape(department) + '"]').forEach(function(cell) {
            var field = cell.dataset.salaryField;
            cell.textContent = fmtC(totals[field] || 0);
        });
    });
    var foot = $id('salTableFoot');
    if (!foot) return;
    var totals = calcSalaryTotals(_salaryTableData);
    foot.replaceChildren();
    var tr = document.createElement('tr');
    tr.className = 'salary-grand-total';
    tr.style.fontWeight = '600';
    var totalHandle = document.createElement('td');
    totalHandle.className = 'salary-summary-handle';
    tr.appendChild(totalHandle);
    var label = document.createElement('td');
    label.className = 'salary-total-label';
    label.textContent = '全店总计';
    tr.appendChild(label);
    salaryVisibleFields().filter(function(field) { return field.key !== 'employee'; }).forEach(function(field) {
        var cell = document.createElement('td');
        if (field.numeric) {
            cell.className = 'nr';
            cell.textContent = fmtC(totals[field.key]);
        } else {
            cell.className = 'salary-summary-spacer';
        }
        tr.appendChild(cell);
    });
    tr.appendChild(document.createElement('td'));
    foot.appendChild(tr);
}

function updateSalaryDraftState() {
    var state = $id('salDraftState');
    if (!state) return;
    var dirty = hasSalaryDraft();
    state.textContent = dirty ? '未保存' : '';
    state.hidden = !dirty;
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
    h += '<label>部门<input class="inp" id="salaryRecord_department" type="text" value="' + salaryEscape(record.department || '') + '"></label>';
    salaryVisibleFields().forEach(function(field) {
        var value = field.numeric ? (Number(record[field.key]) || 0) : (record[field.key] || '');
        h += '<label>' + salaryEscape(field.label) + '<input class="inp" id="salaryRecord_' + field.key + '" type="' + (field.numeric ? 'number' : 'text') + '" value="' + salaryEscape(value) + '"' + (field.category === 'computed' ? ' readonly' : '') + '></label>';
    });
    h += '<label class="salary-record-note">备注<textarea class="inp" id="salaryRecord_note">' + salaryEscape(record.note || '') + '</textarea></label></div>';
    h += '<div class="salary-record-editor-actions"><button class="btn d" onclick="trashSalaryRecord(\'' + salaryEscape(period) + '\',\'' + salaryEscape(recordId) + '\')">删除此人</button><div style="flex:1"></div><button class="btn" onclick="closeModal()">取消</button><button class="btn p" onclick="saveSalaryRecordDetail(\'' + salaryEscape(period) + '\',\'' + salaryEscape(recordId) + '\')">保存修改</button></div>';
    showModal(h, 760);
}

function saveSalaryRecordDetail(period, recordId) {
    if (!salaryRequireAuth()) return;
    var changes = { department: (($id('salaryRecord_department') || {}).value || '').trim() };
    salaryVisibleFields().forEach(function(field) {
        var input = $id('salaryRecord_' + field.key);
        changes[field.key] = field.numeric ? (parseFloat(input && input.value) || 0) : (input ? input.value.trim() : '');
    });
    changes.note = ($id('salaryRecord_note') || {}).value || '';
    if (!changes.employee) { toast('请填写姓名'); return; }
    upd(function(db) {
        var record = (db.salaryRecords || []).find(function(item) { return item.period === period && item.id === recordId; });
        if (!record) return;
        Object.assign(record, changes);
        applySalaryCalculations(record);
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

// 工资模板功能：多个命名模板，保存在账号配置并随云端同步。
function salaryTemplates() {
    return getAppConfig().salaryTemplates || [];
}

function defaultSalaryTemplate() {
    var templates = salaryTemplates();
    var config = getAppConfig();
    return templates.find(function(template) { return template.id === config.defaultSalaryTemplateId; })
        || templates.find(function(template) { return template.isDefault; })
        || templates[0]
        || null;
}

function loadSalaryTemplate() {
    var template = defaultSalaryTemplate();
    if (template && template.rows && template.rows.length) {
        return template.rows.map(function(row) {
            return normalizeSalaryRow(Object.assign({}, row, {
                id: salaryRowId(),
                employeeId: salaryRowId(),
                period: _salaryPeriod
            }));
        });
    }
    return [createSalaryEmptyRow()];
}

function salaryTemplateRowsFromCurrent() {
    return _salaryTableData.filter(function(row) { return row.employee; }).map(function(row) {
        return {
            department: row.department || '',
            employee: row.employee || '',
            position: row.position || '',
            baseSalary: Number(row.baseSalary) || 0
        };
    });
}

function openSalaryTemplateMenu() {
    var template = defaultSalaryTemplate();
    var hasTemplate = !!(template && template.rows && template.rows.length);
    var disabled = hasTemplate ? '' : ' disabled';
    var h = '<div class="salary-template-dialog"><h3>工资模板</h3>';
    h += '<p class="salary-template-intro">模板只保存部门、姓名、职务和基本工资，并随账号云端同步。</p>';
    if (hasTemplate) {
        h += '<div class="salary-template-current"><span>默认模板</span><strong>' + salaryEscape(template.name) + '</strong><small>' + template.rows.length + ' 人</small></div>';
    } else {
        h += '<div class="salary-template-empty-inline"><strong>还没有模板</strong><span>请先将当前工资表保存为模板。</span></div>';
    }
    h += '<section class="salary-template-section"><div class="salary-template-section-title">常用操作</div><div class="salary-template-main-actions">';
    h += '<button type="button" class="salary-template-action primary" onclick="openSalaryTemplateLoadDialog()"' + disabled + '><strong>载入模板</strong><span>将默认模板应用到当前月份</span></button>';
    h += '<button type="button" class="salary-template-action" onclick="openSalaryTemplateSaveDialog()"><strong>保存当前为模板</strong><span>保存人员与基本工资信息</span></button>';
    h += '</div></section>';
    h += '<section class="salary-template-section"><div class="salary-template-section-title">管理与导出</div><div class="salary-template-utility-actions">';
    h += '<button type="button" class="btn" onclick="openSalaryTemplateManager()">管理模板</button>';
    h += '<button type="button" class="btn" onclick="openSalaryDepartmentManager()">管理部门</button>';
    h += '<button type="button" class="btn" onclick="openSalaryFieldManager()">工资字段</button>';
    h += '<button type="button" class="btn" onclick="exportSalaryTemplate(\'' + (template ? salaryEscape(template.id) : '') + '\')"' + disabled + '>导出模板</button>';
    h += '</div></section><div class="salary-template-footer"><button type="button" class="btn" onclick="closeModal()">关闭</button></div></div>';
    showModal(h, 520);
}

function openSalaryTemplateLoadDialog() {
    var templates = salaryTemplates();
    var h = '<div class="salary-template-dialog"><h3>载入工资模板</h3><p class="salary-template-intro">按姓名、部门、职务匹配；已有员工只更新模板字段，当月其他工资字段保持不变。</p><div class="salary-template-load-list">';
    if (!templates.length) h += '<div class="salary-template-empty-inline"><strong>还没有模板</strong><span>返回后可将当前工资表保存为模板。</span></div>';
    templates.forEach(function(template) {
        h += '<div class="salary-template-load-row"><div class="salary-template-row-info"><div><strong>' + salaryEscape(template.name) + '</strong>' + (template.isDefault ? '<span class="salary-template-badge">默认</span>' : '') + '</div><small>' + template.rows.length + ' 人 · 仅更新模板字段</small></div>';
        h += '<button type="button" class="btn' + (template.isDefault ? ' p' : '') + '" onclick="loadSalaryTemplateById(\'' + salaryEscape(template.id) + '\')">载入</button></div>';
    });
    h += '</div><div class="salary-template-footer"><button type="button" class="btn" onclick="backToModal(function(){openSalaryTemplateMenu()})">返回</button></div></div>';
    showModal(h, 560);
}

function loadSalaryTemplateById(templateId) {
    var template = salaryTemplates().find(function(item) { return item.id === templateId; });
    if (!template) { toast('模板不存在'); return; }
    template.rows.forEach(function(templateRow) {
        var key = [templateRow.employee, templateRow.department, templateRow.position].join('\u0000');
        var existing = _salaryTableData.find(function(row) {
            return [row.employee, row.department, row.position].join('\u0000') === key;
        });
        if (existing) {
            existing.baseSalary = Number(templateRow.baseSalary) || 0;
        } else {
            var row = createSalaryEmptyRow();
            row.department = templateRow.department || '';
            row.employee = templateRow.employee || '';
            row.position = templateRow.position || '';
            row.baseSalary = Number(templateRow.baseSalary) || 0;
            _salaryTableData.push(row);
        }
    });
    cacheSalaryDraft();
    closeModal();
    renderSalaryPage();
    toast('已载入模板：' + template.name);
}

function openSalaryTemplateSaveDialog() {
    var rowCount = _salaryTableData.filter(function(row) { return row.employee; }).length;
    if (!rowCount) {
        toast('没有可保存的人员');
        return;
    }
    var isFirstTemplate = salaryTemplates().length === 0;
    var h = '<div class="salary-template-dialog"><h3>保存工资模板</h3><p class="salary-template-intro">将当前工资表中的 ' + rowCount + ' 位员工保存为可复用模板。</p>';
    h += '<div class="salary-template-form"><label class="salary-template-field"><span>模板名称</span><input class="inp" id="salaryTemplateName" value="工资模板 ' + salaryEscape(_salaryPeriod) + '"></label>';
    h += '<label class="salary-template-default-choice"><input id="salaryTemplateDefault" type="checkbox"' + (isFirstTemplate ? ' checked disabled' : '') + '><span><strong>设为默认模板</strong><small>' + (isFirstTemplate ? '第一个模板会自动设为默认。' : '下次进入工资录入时优先使用此模板。') + '</small></span></label>';
    h += '<div class="salary-template-note"><strong>保存范围</strong><span>仅保存部门、姓名、职务和基本工资；补贴、提成、扣款等月度数据不会写入模板。</span></div></div>';
    h += '<div class="salary-template-footer split"><button type="button" class="btn" onclick="backToModal(function(){openSalaryTemplateMenu()})">返回</button><button type="button" class="btn p" onclick="saveSalaryTemplateAs()">保存模板</button></div></div>';
    showModal(h, 520);
}

function saveSalaryTemplateAs() {
    var name = ($id('salaryTemplateName').value || '').trim();
    var rows = salaryTemplateRowsFromCurrent();
    if (!name) { toast('请填写模板名称'); return; }
    if (!rows.length) { toast('没有可保存的人员'); return; }
    var templates = salaryTemplates().map(function(template) { return Object.assign({}, template); });
    var id = 'salary_template_' + Date.now() + '_' + Math.random().toString(36).slice(2, 7);
    var isDefault = $id('salaryTemplateDefault').checked || templates.length === 0;
    if (isDefault) templates.forEach(function(template) { template.isDefault = false; });
    templates.push({ id: id, name: name, isDefault: isDefault, rows: rows });
    localStorage.setItem(getConfigKey() + '_salaryTemplate_backup', JSON.stringify(salaryTemplates()));
    storeAppConfig({
        salaryTemplates: templates,
        defaultSalaryTemplateId: isDefault ? id : (getAppConfig().defaultSalaryTemplateId || id)
    });
    closeModal();
    toast('模板已保存到账号云端');
}

function openSalaryTemplateManager() {
    var templates = salaryTemplates();
    var h = '<div class="salary-template-dialog"><h3>管理工资模板</h3><p class="salary-template-intro">设置默认模板、修改名称或导出备份。</p><div class="salary-template-manager-list">';
    if (!templates.length) h += '<div class="salary-template-empty-inline"><strong>还没有模板</strong><span>先返回并保存当前工资表。</span></div>';
    templates.forEach(function(template) {
        h += '<div class="salary-template-manage-row"><div class="salary-template-row-info"><div><strong>' + salaryEscape(template.name) + '</strong>' + (template.isDefault ? '<span class="salary-template-badge">默认</span>' : '') + '</div><small>' + template.rows.length + ' 人</small></div>';
        h += '<div class="salary-template-row-actions">';
        if (!template.isDefault) h += '<button class="btn s" onclick="setDefaultSalaryTemplate(\'' + salaryEscape(template.id) + '\')">设默认</button>';
        h += '<button class="btn s" onclick="renameSalaryTemplate(\'' + salaryEscape(template.id) + '\')">重命名</button>';
        h += '<button class="btn s" onclick="exportSalaryTemplate(\'' + salaryEscape(template.id) + '\')">导出</button>';
        h += '<button class="btn s d" onclick="deleteSalaryTemplate(\'' + salaryEscape(template.id) + '\')">删除</button></div></div>';
    });
    h += '</div><div class="salary-template-footer"><button type="button" class="btn" onclick="backToModal(function(){openSalaryTemplateMenu()})">返回</button></div></div>';
    showModal(h, 680);
}

function saveSalaryTemplates(templates, defaultId) {
    localStorage.setItem(getConfigKey() + '_salaryTemplate_backup', JSON.stringify(salaryTemplates()));
    storeAppConfig({ salaryTemplates: templates, defaultSalaryTemplateId: defaultId });
}

function setDefaultSalaryTemplate(templateId) {
    var templates = salaryTemplates().map(function(template) {
        template.isDefault = template.id === templateId;
        return template;
    });
    saveSalaryTemplates(templates, templateId);
    openSalaryTemplateManager();
}

function renameSalaryTemplate(templateId) {
    var template = salaryTemplates().find(function(item) { return item.id === templateId; });
    if (!template) return;
    var h = '<div class="salary-template-dialog"><h3>重命名模板</h3><p class="salary-template-intro">修改后会同步到当前账号的其他设备。</p><div class="salary-template-form">';
    h += '<label class="salary-template-field"><span>模板名称</span><input class="inp" id="salaryTemplateRenameInput" value="' + salaryEscape(template.name) + '" onkeydown="if(event.key===\'Enter\')confirmRenameSalaryTemplate(\'' + salaryEscape(template.id) + '\')"></label></div>';
    h += '<div class="salary-template-footer split"><button type="button" class="btn" onclick="backToModal(function(){openSalaryTemplateManager()})">取消</button><button type="button" class="btn p" onclick="confirmRenameSalaryTemplate(\'' + salaryEscape(template.id) + '\')">保存名称</button></div></div>';
    showModal(h, 480);
    setTimeout(function() { var input = $id('salaryTemplateRenameInput'); if (input) { input.focus(); input.select(); } }, 0);
}

function confirmRenameSalaryTemplate(templateId) {
    var name = (($id('salaryTemplateRenameInput') && $id('salaryTemplateRenameInput').value) || '').trim();
    if (!name) return;
    var templates = salaryTemplates().map(function(item) {
        if (item.id === templateId) item.name = name;
        return item;
    });
    saveSalaryTemplates(templates, getAppConfig().defaultSalaryTemplateId);
    openSalaryTemplateManager();
}

function deleteSalaryTemplate(templateId) {
    var template = salaryTemplates().find(function(item) { return item.id === templateId; });
    if (!template || !confirm('删除模板“' + template.name + '”？')) return;
    var templates = salaryTemplates().filter(function(item) { return item.id !== templateId; });
    var defaultId = getAppConfig().defaultSalaryTemplateId === templateId ? (templates[0] ? templates[0].id : '') : getAppConfig().defaultSalaryTemplateId;
    if (defaultId) templates.forEach(function(item) { item.isDefault = item.id === defaultId; });
    saveSalaryTemplates(templates, defaultId);
    openSalaryTemplateManager();
}

function exportSalaryTemplate(templateId) {
    var template = salaryTemplates().find(function(item) { return item.id === templateId; }) || defaultSalaryTemplate();
    if (!template) { toast('没有可导出的模板'); return; }
    if (typeof XLSX === 'undefined') { toast('Excel 导出组件未加载'); return; }
    var rows = template.rows.map(function(row) {
        return { '部门': row.department, '姓名': row.employee, '职务': row.position, '基本工资': row.baseSalary };
    });
    var sheet = XLSX.utils.json_to_sheet(rows);
    var workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, sheet, '工资模板');
    XLSX.writeFile(workbook, template.name.replace(/[\\/:*?"<>|]/g, '_') + '.xlsx');
    toast('模板已导出');
}

function openSalaryDepartmentManager() {
    var departments = salaryDepartments().filter(function(department) { return department !== '未分部门'; });
    var h = '<div class="salary-template-dialog"><h3>管理部门</h3><p class="salary-template-intro">逐项修改部门。删除正在使用的部门后，其员工会在保存时移到“未分部门”。</p>';
    h += '<div class="salary-department-editor"><div class="salary-department-system-row"><div><strong>未分部门</strong><small>系统保留项</small></div><span class="salary-template-badge">不可删除</span></div><div id="salaryDepartmentRows">';
    departments.forEach(function(department) {
        h += salaryDepartmentEditorRow(department);
    });
    h += '</div><button type="button" class="btn salary-department-add" onclick="addSalaryDepartmentEditorRow()">+ 添加部门</button></div>';
    h += '<div class="salary-template-footer split"><button type="button" class="btn" onclick="backToModal(function(){openSalaryTemplateMenu()})">取消</button><button type="button" class="btn p" onclick="saveSalaryDepartments()">保存部门</button></div></div>';
    showModal(h, 560);
}

function salaryDepartmentEditorRow(department) {
    return '<div class="salary-department-edit-row"><input class="inp salary-department-input" value="' + salaryEscape(department || '') + '" aria-label="部门名称"><button type="button" class="btn s d" onclick="removeSalaryDepartmentEditorRow(this)" aria-label="删除部门">删除</button></div>';
}

function addSalaryDepartmentEditorRow() {
    var container = $id('salaryDepartmentRows');
    if (!container) return;
    var wrapper = document.createElement('div');
    wrapper.innerHTML = salaryDepartmentEditorRow('');
    var row = wrapper.firstElementChild;
    container.appendChild(row);
    var input = row.querySelector('input');
    if (input) input.focus();
}

function removeSalaryDepartmentEditorRow(button) {
    var row = button.closest('.salary-department-edit-row');
    var input = row && row.querySelector('input');
    var department = input ? input.value.trim() : '';
    var employeeCount = department ? _salaryTableData.filter(function(item) { return item.department === department; }).length : 0;
    if (employeeCount && !confirm('“' + department + '”有 ' + employeeCount + ' 位员工，保存后他们会移到“未分部门”。继续删除吗？')) return;
    if (row) row.remove();
}

function saveSalaryDepartments() {
    var values = Array.from(document.querySelectorAll('#salaryDepartmentRows .salary-department-input')).map(function(input) { return input.value.trim(); }).filter(Boolean);
    var departments = [];
    values.forEach(function(value) { if (departments.indexOf(value) < 0) departments.push(value); });
    if (departments.indexOf('未分部门') < 0) departments.unshift('未分部门');
    var allowed = departments.filter(function(value) { return value !== '未分部门'; });
    _salaryTableData.forEach(function(row) {
        if (row.department && allowed.indexOf(row.department) < 0) row.department = '';
    });
    storeAppConfig({ salaryDepartments: departments });
    cacheSalaryDraft();
    closeModal();
    renderSalaryPage();
    toast('部门已更新');
}

function salaryFieldCategoryLabel(category) {
    return { info: '信息项', earning: '应发项', deduction: '扣款项', computed: '自动计算' }[category] || '应发项';
}

function salaryFieldGroupOptions(selectedId) {
    var h = '<option value="">未分组</option>';
    salaryFieldGroups().forEach(function(group) {
        h += '<option value="' + salaryEscape(group.id) + '"' + (group.id === selectedId ? ' selected' : '') + '>' + salaryEscape(group.label) + '</option>';
    });
    return h;
}

function salaryGroupEditorRow(group) {
    var h = '<div class="salary-group-edit-row" data-group-id="' + salaryEscape(group.id) + '">';
    h += '<label class="salary-group-name"><input class="inp salary-group-label" value="' + salaryEscape(group.label) + '" aria-label="分组名称"></label>';
    h += '<label class="salary-group-span" title="开启后隐藏分组标题，字段名称独立跨两行显示"><input type="checkbox" class="salary-group-span-input"' + (group.span ? ' checked' : '') + '><span>单列显示</span></label>';
    h += '<div class="salary-group-order"><button type="button" class="btn s" onclick="moveSalaryGroupEditorRow(this,-1)" aria-label="上移分组">&#8593;</button><button type="button" class="btn s" onclick="moveSalaryGroupEditorRow(this,1)" aria-label="下移分组">&#8595;</button><button type="button" class="btn s d" onclick="removeSalaryGroupEditorRow(this)" aria-label="删除分组">&times;</button></div>';
    h += '</div>';
    return h;
}

function addSalaryGroupRow() {
    var container = $id('salaryGroupRows');
    if (!container) return;
    var group = {
        id: 'salary_group_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        label: '新分组',
        span: false,
        order: container.children.length
    };
    var wrapper = document.createElement('div');
    wrapper.innerHTML = salaryGroupEditorRow(group);
    var row = wrapper.firstElementChild;
    container.appendChild(row);
    document.querySelectorAll('.salary-field-group-input').forEach(function(select) {
        var option = document.createElement('option');
        option.value = group.id;
        option.textContent = group.label;
        select.appendChild(option);
    });
    var input = row.querySelector('.salary-group-label');
    if (input) { input.focus(); input.select(); }
}

function moveSalaryGroupEditorRow(button, delta) {
    var row = button.closest('.salary-group-edit-row');
    if (!row) return;
    var sibling = delta < 0 ? row.previousElementSibling : row.nextElementSibling;
    if (!sibling) return;
    if (delta < 0) row.parentNode.insertBefore(row, sibling);
    else row.parentNode.insertBefore(sibling, row);
}

function removeSalaryGroupEditorRow(button) {
    var row = button.closest('.salary-group-edit-row');
    if (!row) return;
    var groupId = row.dataset.groupId;
    var hasInfo = !!document.querySelector('#salaryGroupRows [data-group-id="info"]');
    var fallback = hasInfo ? 'info' : '';
    var moved = 0;
    document.querySelectorAll('#salaryFieldRows .salary-field-edit-row').forEach(function(fieldRow) {
        var select = fieldRow.querySelector('.salary-field-group-input');
        if (!select || select.value !== groupId) return;
        select.value = fallback;
        moved++;
    });
    document.querySelectorAll('#salaryFieldRows .salary-field-group-input').forEach(function(select) {
        Array.from(select.options).forEach(function(option) {
            if (option.value === groupId) option.remove();
        });
    });
    row.remove();
    toast(moved ? '分组已删除，' + moved + ' 个字段已归入' + (fallback === 'info' ? '信息项' : '未分组') : '分组已删除');
}

function salaryFieldEditorRow(field) {
    var lockedType = field.category === 'info' || field.category === 'computed';
    var lockedOrder = field.required || field.category === 'computed';
    var h = '<div class="salary-field-edit-row" data-field-id="' + salaryEscape(field.id) + '" data-builtin="' + (field.builtin ? 'true' : 'false') + '" data-required="' + (field.required ? 'true' : 'false') + '" data-readonly="' + (field.readonly ? 'true' : 'false') + '" data-field-type="' + salaryEscape(field.type || 'number') + '" data-calculation="' + salaryEscape(field.calculation || '') + '" data-width="' + salaryEscape(field.width || '70px') + '" data-aliases="' + salaryEscape(JSON.stringify(field.aliases || [])) + '">';
    h += '<label class="salary-field-name"><input class="inp salary-field-label" value="' + salaryEscape(field.label) + '" aria-label="工资字段名称"></label>';
    h += '<label class="salary-field-category"><select class="inp salary-field-category-input" aria-label="计算归属"' + (lockedType ? ' disabled' : '') + '>';
    if (lockedType) h += '<option value="' + field.category + '" selected>' + salaryFieldCategoryLabel(field.category) + '</option>';
    else h += '<option value="earning"' + (field.category === 'earning' ? ' selected' : '') + '>应发项</option><option value="deduction"' + (field.category === 'deduction' ? ' selected' : '') + '>扣款项</option>';
    h += '</select></label>';
    h += '<label class="salary-field-group"><select class="inp salary-field-group-input" aria-label="所属分组">' + salaryFieldGroupOptions(field.group || '') + '</select></label>';
    h += '<div class="salary-field-spacer" aria-hidden="true"></div>';
    h += '<label class="salary-field-visible"><input type="checkbox" class="salary-field-visible-input"' + (field.visible !== false ? ' checked' : '') + (field.required ? ' disabled' : '') + '><span>显示</span></label>';
    h += '<div class="salary-field-order"><button type="button" class="btn s" onclick="moveSalaryFieldEditorRow(this,-1)" aria-label="上移字段"' + (lockedOrder ? ' disabled' : '') + '>↑</button><button type="button" class="btn s" onclick="moveSalaryFieldEditorRow(this,1)" aria-label="下移字段"' + (lockedOrder ? ' disabled' : '') + '>↓</button></div>';
    h += '<div class="salary-field-remove"><button type="button" class="btn s d" onclick="removeSalaryFieldEditorRow(this)" aria-label="删除字段">&times;</button></div>';
    h += '</div>';
    return h;
}

function removeSalaryFieldEditorRow(button) {
    var row = button.closest('.salary-field-edit-row');
    if (!row) return;
    if (row.dataset.required === 'true') { toast('必填字段（如姓名）不能删除'); return; }
    if (row.dataset.builtin === 'true' && !window.confirm('这是内置字段，删除后如需恢复要手动重新添加（历史数据保留）。确定删除？')) return;
    row.remove();
    toast('字段已从列表移除，保存后生效');
}

function openSalaryFieldManager() {
    var fields = salaryFieldDefinitions();
    var h = '<div class="salary-template-dialog salary-field-dialog"><h3>工资字段设置</h3>';
    h += '<p class="salary-template-intro">设置表头结构、工资项目与计算方式。修改会随当前账号同步，隐藏字段仍保留历史数据。</p>';
    h += '<div class="view-tabs salary-field-tabs" role="tablist" aria-label="工资字段设置视图">';
    h += '<button type="button" class="view-tab active" role="tab" aria-selected="true" data-tab="groups" onclick="switchSalaryFieldTab(\'groups\')">表头分组</button>';
    h += '<button type="button" class="view-tab" role="tab" aria-selected="false" data-tab="fields" onclick="switchSalaryFieldTab(\'fields\')">工资字段</button>';
    h += '<button type="button" class="view-tab" role="tab" aria-selected="false" data-tab="formulas" onclick="switchSalaryFieldTab(\'formulas\')">计算公式</button>';
    h += '</div><div class="salary-field-dialog-body">';
    h += '<div class="salary-field-panel" data-panel="groups"><p class="salary-field-panel-copy">调整表头分组顺序；开启“单列显示”后，该组不显示上层分组标题。</p>';
    h += '<div id="salaryGroupRows" class="salary-group-editor">';
    salaryFieldGroups().forEach(function(group) { h += salaryGroupEditorRow(group); });
    h += '</div><button type="button" class="btn salary-department-add" onclick="addSalaryGroupRow()">+ 新增分组</button>';
    h += '</div>';
    h += '<div class="salary-field-panel" data-panel="fields" hidden><p class="salary-field-panel-copy">计算归属：应发项计入工资、扣款项从工资中扣除；表头分组：该字段显示在工资表顶部表头的哪个分组下；显示：是否在工资表中展示。</p>';
    h += '<div class="salary-field-list-head"><span>字段名称</span><span>归属</span><span>表头分组</span><span class="salary-field-spacer"></span><span>显示</span><span>排序</span><span></span></div>';
    h += '<div id="salaryFieldRows" class="salary-field-editor">';
    fields.forEach(function(field) { h += salaryFieldEditorRow(field); });
    h += '</div><button type="button" class="btn salary-department-add" onclick="addSalaryCustomField()">+ 添加工资项</button>';
    h += '</div>';
    h += '<div class="salary-field-panel" data-panel="formulas" hidden><p class="salary-field-panel-copy">公式使用字段名称引用；留空时采用系统内置计算。</p>' + salaryFormulaEditorHtml() + '</div></div>';
    h += '<div class="salary-template-footer split"><button type="button" class="btn" onclick="backToModal(function(){openSalaryTemplateMenu()})">取消</button><button type="button" class="btn p" onclick="saveSalaryFieldDefinitions()">保存设置</button></div></div>';
    showModal(h, 880);
}

function switchSalaryFieldTab(name) {
    document.querySelectorAll('.salary-field-tabs .view-tab').forEach(function(btn) {
        var active = btn.dataset.tab === name;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-selected', active ? 'true' : 'false');
    });
    document.querySelectorAll('.salary-field-panel').forEach(function(panel) {
        panel.hidden = panel.dataset.panel !== name;
    });
}

function salaryFormulaEditorHtml() {
    var defs = salaryFieldDefinitions();
    var computed = defs.filter(function(field) { return field.category === 'computed'; });
    if (!computed.length) return '<p class="salary-template-intro">当前没有自动计算字段。</p>';
    var h = '<div id="salaryFormulaRows" class="salary-formula-list">';
    computed.forEach(function(field) {
        var display = salaryFormulaToDisplay(field.formula || '');
        h += '<div class="salary-formula-row" data-field-id="' + salaryEscape(field.id) + '">';
        h += '<div class="salary-formula-head"><strong>' + salaryEscape(field.label) + '</strong><span class="salary-formula-badge">自动计算</span></div>';
        h += '<div class="salary-formula-input-row">';
        h += '<input class="inp salary-formula-input" value="' + salaryEscape(display) + '" spellcheck="false" aria-label="' + salaryEscape(field.label) + ' 公式" placeholder="留空则使用内置计算">';
        h += '<select class="inp salary-formula-insert" onchange="insertSalaryFormulaField(this)" aria-label="插入字段到公式">';
        h += '<option value="">插入字段…</option>';
        defs.forEach(function(other) {
            if (!other.numeric || other.id === field.id) return;
            h += '<option value="' + salaryEscape(other.label) + '">' + salaryEscape(other.label) + '</option>';
        });
        h += '</select></div>';
        h += '<p class="salary-formula-error" hidden></p>';
        h += '</div>';
    });
    h += '</div>';
    h += '<div class="salary-formula-help"><strong>可用函数</strong><br>'
        + 'EARNINGS() 全部应发项合计 · DEDUCTIONS() 全部扣款项合计 · BASE() 基本工资项目 · DIRECT() 提成/其他补助/绩效及自定义应发<br>'
        + 'PRE_TAX() 社保组 · POST_TAX() 个税组 · SUM(...) 求和 · ROUND(x, n) 四舍五入 · MIN(...) / MAX(...)<br>'
        + '字段用 {字段名} 引用，支持 + - * / 与括号；公式随账号云端同步，仅对当前账号生效。</div>';
    return h;
}

function insertSalaryFormulaField(select) {
    var label = select.value;
    if (!label) return;
    var input = select.parentNode ? select.parentNode.querySelector('.salary-formula-input') : null;
    if (!input) return;
    var text = '{' + label + '}';
    var start = input.selectionStart !== null && input.selectionStart !== undefined ? input.selectionStart : input.value.length;
    var end = input.selectionEnd !== null && input.selectionEnd !== undefined ? input.selectionEnd : start;
    input.value = input.value.slice(0, start) + text + input.value.slice(end);
    var caret = start + text.length;
    input.focus();
    input.setSelectionRange(caret, caret);
    select.value = '';
}

function salaryFormulaCycles(formulas) {
    var refs = {};
    Object.keys(formulas).forEach(function(id) {
        var list = [];
        var re = /\{([^{}]+)\}/g;
        var match;
        var text = String(formulas[id] || '');
        while ((match = re.exec(text))) list.push(match[1]);
        refs[id] = list;
    });
    var seen = {};
    var stack = [];
    function dfs(id) {
        if (stack.indexOf(id) >= 0) return stack.concat([id]);
        if (seen[id]) return null;
        stack.push(id);
        var deps = (refs[id] || []).filter(function(dep) { return refs[dep] !== undefined; });
        for (var i = 0; i < deps.length; i++) {
            var cycle = dfs(deps[i]);
            if (cycle) return cycle;
        }
        stack.pop();
        seen[id] = true;
        return null;
    }
    var ids = Object.keys(refs);
    for (var i = 0; i < ids.length; i++) {
        var found = dfs(ids[i]);
        if (found) return found;
    }
    return null;
}

function addSalaryCustomField() {
    var container = $id('salaryFieldRows');
    if (!container) return;
    var field = {
        id: 'salary_custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        label: '新工资项', category: 'earning', group: '', type: 'number', visible: true,
        builtin: false, required: false, readonly: false, width: '70px', aliases: []
    };
    var wrapper = document.createElement('div');
    wrapper.innerHTML = salaryFieldEditorRow(field);
    var row = wrapper.firstElementChild;
    var actualRow = container.querySelector('[data-field-id="actualSalary"]');
    container.insertBefore(row, actualRow || null);
    var input = row.querySelector('.salary-field-label');
    if (input) { input.focus(); input.select(); }
}

function moveSalaryFieldEditorRow(button, delta) {
    var row = button.closest('.salary-field-edit-row');
    if (!row) return;
    var sibling = delta < 0 ? row.previousElementSibling : row.nextElementSibling;
    if (!sibling || sibling.dataset.required === 'true' || sibling.dataset.readonly === 'true') return;
    if (delta < 0) row.parentNode.insertBefore(row, sibling);
    else row.parentNode.insertBefore(sibling, row);
}

function saveSalaryFieldDefinitions() {
    var groupRows = Array.from(document.querySelectorAll('#salaryGroupRows .salary-group-edit-row'));
    var groupLabels = [];
    var invalidGroup = false;
    var groups = groupRows.map(function(row, index) {
        var label = (row.querySelector('.salary-group-label').value || '').trim();
        if (!label || groupLabels.indexOf(label) >= 0) invalidGroup = true;
        groupLabels.push(label);
        return {
            id: row.dataset.groupId,
            label: label,
            span: row.querySelector('.salary-group-span-input').checked === true,
            order: index
        };
    });
    if (invalidGroup) { toast('分组名称不能为空或重复'); return; }
    if (!groups.length) { toast('至少需要一个表头分组'); return; }
    var groupIds = groups.map(function(group) { return group.id; });

    var rows = Array.from(document.querySelectorAll('#salaryFieldRows .salary-field-edit-row'));
    var labels = [];
    var invalid = false;
    var fields = rows.map(function(row, index) {
        var label = (row.querySelector('.salary-field-label').value || '').trim();
        if (!label || labels.indexOf(label) >= 0) invalid = true;
        labels.push(label);
        var categoryInput = row.querySelector('.salary-field-category-input');
        var category = categoryInput.value;
        var groupInput = row.querySelector('.salary-field-group-input');
        var group = groupInput ? groupInput.value : '';
        var required = row.dataset.required === 'true';
        var aliases = [];
        try { aliases = JSON.parse(row.dataset.aliases || '[]'); } catch (e) {}
        return {
            id: row.dataset.fieldId,
            label: label,
            category: category,
            group: group,
            calculation: row.dataset.calculation || '',
            calculationGroup: salaryCalculationGroupForField(row.dataset.fieldId, category, group),
            type: category === 'info' ? (row.dataset.fieldType || 'text') : 'number',
            visible: required || row.querySelector('.salary-field-visible-input').checked,
            builtin: row.dataset.builtin === 'true',
            required: required,
            readonly: row.dataset.readonly === 'true',
            width: row.dataset.width || '70px',
            order: index,
            aliases: aliases
        };
    });
    if (invalid) { toast('字段名称不能为空或重复'); return; }
    var ungrouped = fields.find(function(field) { return !field.group || groupIds.indexOf(field.group) < 0; });
    if (ungrouped) { toast('请为字段「' + ungrouped.label + '」选择所属分组'); return; }

    var formulasById = {};
    var invalidFormula = false;
    document.querySelectorAll('#salaryFormulaRows .salary-formula-row').forEach(function(row) {
        var fieldId = row.dataset.fieldId;
        var errorEl = row.querySelector('.salary-formula-error');
        var raw = row.querySelector('.salary-formula-input').value;
        if (errorEl) { errorEl.hidden = true; errorEl.textContent = ''; }
        try {
            formulasById[fieldId] = raw.trim() ? salaryFormulaToStorage(raw) : '';
            if (formulasById[fieldId]) parseSalaryFormula(formulasById[fieldId]);
        } catch (e) {
            invalidFormula = true;
            formulasById[fieldId] = raw;
            if (errorEl) {
                errorEl.textContent = e && e.message ? e.message : '公式无效';
                errorEl.hidden = false;
            }
        }
    });
    if (invalidFormula) { toast('计算公式有误，请修正后再保存'); return; }
    var cycle = salaryFormulaCycles(formulasById);
    if (cycle) { toast('公式存在循环引用：' + cycle.join(' → ')); return; }
    fields.forEach(function(field) {
        field.formula = formulasById[field.id] !== undefined ? formulasById[field.id] : '';
    });

    storeAppConfig({ salaryFieldDefinitions: fields, salaryFieldGroups: groups });
    cacheSalaryDraft();
    closeModal();
    renderSalaryPage();
    toast('工资字段已更新');
}

function salaryCalculationGroupForField(fieldId, category, group) {
    if (fieldId === 'attendanceDays') return 'attendance';
    if (category === 'earning') return group === 'basePay' ? 'base' : 'direct';
    if (category === 'deduction') return group === 'preTax' ? 'preTaxDeduction' : 'postTaxDeduction';
    return '';
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
    var targetRow = _salaryTableData[targetIndex];
    if (targetRow) moved.department = targetRow.department || '';
    _salaryTableData.splice(dropPosition === 'after' ? targetIndex + 1 : targetIndex, 0, moved);
    cacheSalaryDraft();
    var body = $id('salTableBody');
    var sourceElement = body && body.querySelector('[data-row-id="' + sourceRowId + '"]');
    var targetElement = body && body.querySelector('[data-row-id="' + targetRowId + '"]');
    if (sourceElement && targetElement) body.insertBefore(sourceElement, dropPosition === 'after' ? targetElement.nextSibling : targetElement);
    renderSalaryTable();
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
    cell.colSpan = salaryVisibleFields().length + 1;
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
    var row = {
        id: salaryRowId(),
        employeeId: salaryRowId(),
        period: _salaryPeriod,
        department: '',
        note: ''
    };
    salaryInputFields(true).forEach(function(field) {
        row[field.key] = field.numeric ? 0 : '';
    });
    if (Object.prototype.hasOwnProperty.call(row, 'attendanceDays')) row.attendanceDays = 31;
    return row;
}

function calcSalaryActual(row) {
    return salaryCalculatedValue(row, 'actualSalary');
}

function salaryGroupTotal(row, group) {
    var total = 0;
    salaryNumericFields(true).forEach(function(field) {
        // 未配置 calculationGroup 的字段按计算归属分类兜底：应发项计入、扣款项扣除。
        var fieldGroup = field.calculationGroup
            || (field.category === 'earning' ? 'direct' : field.category === 'deduction' ? 'postTaxDeduction' : '');
        if (fieldGroup === group) total += Number(row[field.key]) || 0;
    });
    return total;
}

function salaryCalculatedValue(row, key, stack) {
    stack = stack || [];
    var field = salaryFieldDefinitions().find(function(item) { return item.key === key; });
    // 账号级公式优先；语法/求值失败或循环引用时回退内置计算，保证表格不中断。
    if (field && typeof field.formula === 'string' && field.formula.trim()) {
        if (stack.indexOf(key) >= 0) {
            console.warn('工资公式循环引用：' + stack.concat([key]).join(' → '));
        } else {
            try {
                return evalSalaryFormula(field.formula, row, stack.concat([key]));
            } catch (e) {
                console.warn('工资公式求值失败（' + key + '）：' + (e && e.message));
            }
        }
    }
    var attendance = row.attendanceDays === undefined || row.attendanceDays === null || row.attendanceDays === ''
        ? 31
        : Number(row.attendanceDays) || 0;
    var basePayTotal = salaryGroupTotal(row, 'base');
    var basePayProrated = basePayTotal / 31 * attendance;
    var directEarnings = salaryGroupTotal(row, 'direct');
    var payableSubtotal = basePayProrated + directEarnings;
    var preTaxDeduction = salaryGroupTotal(row, 'preTaxDeduction');
    var postTaxDeduction = salaryGroupTotal(row, 'postTaxDeduction');
    var values = {
        basePayTotal: basePayTotal,
        basePayProrated: basePayProrated,
        payableSubtotal: payableSubtotal,
        payableTotal: payableSubtotal - preTaxDeduction,
        totalDeduction: postTaxDeduction,
        actualSalary: payableSubtotal - preTaxDeduction - postTaxDeduction
    };
    return values[key] !== undefined ? values[key] : (field && field.calculation ? values[field.calculation] || 0 : Number(row[key]) || 0);
}

// ===== 账号级工资公式引擎 =====
// 公式保存在账号配置 salaryFieldDefinitions[].formula 中（字段 id 引用），
// UI 层用 salaryFormulaToDisplay/ToStorage 与字段名互转，各账号公式互相独立。
var SALARY_FORMULA_FUNCTIONS = ['SUM', 'ROUND', 'MIN', 'MAX', 'EARNINGS', 'DEDUCTIONS', 'BASE', 'DIRECT', 'PRE_TAX', 'POST_TAX'];

function salaryFormulaError(message, pos) {
    var error = new Error(message + (pos !== undefined && pos !== null ? '（位置 ' + pos + '）' : ''));
    error.position = pos;
    return error;
}

function tokenizeSalaryFormula(text) {
    var tokens = [];
    var s = String(text);
    var i = 0;
    while (i < s.length) {
        var ch = s.charAt(i);
        if (/\s/.test(ch)) { i++; continue; }
        if (ch === '{') {
            var end = s.indexOf('}', i + 1);
            if (end < 0) throw salaryFormulaError('字段引用缺少 }', i);
            var refId = s.slice(i + 1, end).trim();
            if (!refId) throw salaryFormulaError('字段引用为空', i);
            tokens.push({ t: 'ref', v: refId, p: i });
            i = end + 1;
            continue;
        }
        if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(s.charAt(i + 1) || ''))) {
            var numMatch = /^[0-9]*\.?[0-9]+/.exec(s.slice(i));
            tokens.push({ t: 'num', v: parseFloat(numMatch[0]), p: i });
            i += numMatch[0].length;
            continue;
        }
        if (/[A-Za-z_]/.test(ch)) {
            var fnMatch = /^[A-Za-z_][A-Za-z0-9_]*/.exec(s.slice(i));
            var fnName = fnMatch[0].toUpperCase();
            if (SALARY_FORMULA_FUNCTIONS.indexOf(fnName) < 0) throw salaryFormulaError('未知函数：' + fnMatch[0], i);
            tokens.push({ t: 'fn', v: fnName, p: i });
            i += fnMatch[0].length;
            continue;
        }
        if ('+-*/(),'.indexOf(ch) >= 0) { tokens.push({ t: ch, p: i }); i += 1; continue; }
        throw salaryFormulaError('无法识别的字符：' + ch, i);
    }
    return tokens;
}

function parseSalaryFormula(text) {
    var tokens = tokenizeSalaryFormula(text);
    var pos = 0;

    function peek() { return tokens[pos]; }
    function eat(type) {
        var tk = tokens[pos];
        if (tk && tk.t === type) { pos += 1; return tk; }
        return null;
    }
    function expect(type, desc) {
        var tk = eat(type);
        if (!tk) throw salaryFormulaError('缺少' + desc, pos < tokens.length ? tokens[pos].p : String(text).length);
        return tk;
    }
    function parseExpr() {
        var node = parseTerm();
        while (peek() && (peek().t === '+' || peek().t === '-')) {
            var op = tokens[pos].t; pos += 1;
            node = { t: 'bin', op: op, l: node, r: parseTerm() };
        }
        return node;
    }
    function parseTerm() {
        var node = parseUnary();
        while (peek() && (peek().t === '*' || peek().t === '/')) {
            var op = tokens[pos].t; pos += 1;
            node = { t: 'bin', op: op, l: node, r: parseUnary() };
        }
        return node;
    }
    function parseUnary() {
        if (peek() && peek().t === '-') { pos += 1; return { t: 'neg', x: parseUnary() }; }
        if (peek() && peek().t === '+') { pos += 1; return parseUnary(); }
        return parsePrimary();
    }
    function parsePrimary() {
        var tk = peek();
        if (!tk) throw salaryFormulaError('公式意外结束', String(text).length);
        if (tk.t === 'num') { pos += 1; return { t: 'num', v: tk.v }; }
        if (tk.t === 'ref') { pos += 1; return { t: 'ref', id: tk.v }; }
        if (tk.t === 'fn') {
            pos += 1;
            expect('(', '（');
            var args = [];
            if (peek() && peek().t !== ')') {
                args.push(parseExpr());
                while (eat(',')) args.push(parseExpr());
            }
            expect(')', '）');
            return { t: 'call', name: tk.v, args: args, p: tk.p };
        }
        if (tk.t === '(') {
            pos += 1;
            var grouped = parseExpr();
            expect(')', '）');
            return grouped;
        }
        throw salaryFormulaError('意外的符号：' + (tk.v || tk.t), tk.p);
    }

    if (!tokens.length) throw salaryFormulaError('公式为空', 0);
    var ast = parseExpr();
    if (pos < tokens.length) throw salaryFormulaError('公式末尾有多余内容', tokens[pos].p);
    return ast;
}

function salaryCategorySum(row, category) {
    return salaryNumericFields(true).reduce(function(total, field) {
        return field.category === category ? total + (Number(row[field.key]) || 0) : total;
    }, 0);
}

function evalSalaryFormulaAst(ast, row, stack) {
    if (ast.t === 'num') return ast.v;
    if (ast.t === 'neg') return -evalSalaryFormulaAst(ast.x, row, stack);
    if (ast.t === 'bin') {
        var l = evalSalaryFormulaAst(ast.l, row, stack);
        var r = evalSalaryFormulaAst(ast.r, row, stack);
        if (ast.op === '+') return l + r;
        if (ast.op === '-') return l - r;
        if (ast.op === '*') return l * r;
        if (ast.op === '/') {
            if (!r) throw new Error('除数为 0');
            return l / r;
        }
        throw new Error('未知运算符：' + ast.op);
    }
    if (ast.t === 'ref') {
        var def = salaryFieldDefinitions().find(function(item) { return item.key === ast.id; });
        if (!def) throw new Error('未知字段：' + ast.id);
        if (def.category === 'computed') return salaryCalculatedValue(row, ast.id, stack);
        return Number(row[ast.id]) || 0;
    }
    if (ast.t === 'call') {
        var args = ast.args.map(function(arg) { return evalSalaryFormulaAst(arg, row, stack); });
        switch (ast.name) {
            case 'SUM': return args.reduce(function(a, b) { return a + b; }, 0);
            case 'MIN': return args.length ? Math.min.apply(null, args) : 0;
            case 'MAX': return args.length ? Math.max.apply(null, args) : 0;
            case 'ROUND': {
                var factor = Math.pow(10, args.length > 1 ? args[1] : 0);
                return Math.round((Number(args[0]) || 0) * factor) / factor;
            }
            case 'EARNINGS': return salaryCategorySum(row, 'earning');
            case 'DEDUCTIONS': return salaryCategorySum(row, 'deduction');
            case 'BASE': return salaryGroupTotal(row, 'base');
            case 'DIRECT': return salaryGroupTotal(row, 'direct');
            case 'PRE_TAX': return salaryGroupTotal(row, 'preTaxDeduction');
            case 'POST_TAX': return salaryGroupTotal(row, 'postTaxDeduction');
        }
        throw new Error('未知函数：' + ast.name);
    }
    throw new Error('无法求值的公式节点');
}

function evalSalaryFormula(text, row, stack) {
    return evalSalaryFormulaAst(parseSalaryFormula(text), row, stack || []);
}

// 编辑器显示：{字段id} → {字段名}
function salaryFormulaToDisplay(text) {
    return String(text == null ? '' : text).replace(/\{([^{}]+)\}/g, function(match, id) {
        var def = salaryFieldDefinitions().find(function(item) { return item.key === id; });
        return def ? '{' + def.label + '}' : match;
    });
}

// 保存入库：{字段名}或{id} → {字段id}；未知引用抛错
function salaryFormulaToStorage(text) {
    var defs = salaryFieldDefinitions();
    var unknown = null;
    var out = String(text == null ? '' : text).replace(/\{([^{}]+)\}/g, function(match, name) {
        if (defs.some(function(item) { return item.key === name; })) return '{' + name + '}';
        var byLabel = defs.find(function(item) { return item.label === name; });
        if (byLabel) return '{' + byLabel.id + '}';
        if (!unknown) unknown = name;
        return match;
    });
    if (unknown) throw new Error('未知字段：' + unknown);
    return out.trim();
}

function salaryCategoryTotal(row, category) {
    return salaryNumericFields(true).reduce(function(total, field) {
        return field.category === category ? total + (Number(row[field.key]) || 0) : total;
    }, 0);
}

function calcSalaryTotals(rows) {
    var totals = {};
    salaryAllNumericFields().forEach(function(field) { totals[field.key] = 0; });
    rows.forEach(function(r) {
        salaryAllNumericFields().forEach(function(field) {
            totals[field.key] += field.category === 'computed'
                ? salaryCalculatedValue(r, field.key)
                : (Number(r[field.key]) || 0);
        });
    });
    return totals;
}

function applySalaryCalculations(row) {
    salaryFieldDefinitions().filter(function(field) { return field.category === 'computed'; }).forEach(function(field) {
        row[field.key] = salaryCalculatedValue(row, field.key);
    });
    row.baseTotal = Number(row.basePayTotal) || salaryGroupTotal(row, 'base');
    row.subtotal = Number(row.payableSubtotal) || row.baseTotal;
    row.totalDeduction = Number(row.totalDeduction) || salaryGroupTotal(row, 'postTaxDeduction');
    row.actualSalary = salaryCalculatedValue(row, 'actualSalary');
    return row;
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
    var fieldDefinition = salaryInputFields(true).find(function(item) { return item.key === field; });
    if (!row || !fieldDefinition) return;
    row[field] = fieldDefinition.numeric ? (parseFloat(value) || 0) : value;
    cacheSalaryDraft();
    if (field === 'department') {
        renderSalaryTable();
    } else {
        updateSalarySummaries();
        updateSalaryDraftState();
    }
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
    var departments = salaryDepartments();
    storeAppConfig({ salaryDepartments: departments });

    upd(function(db) {
        if (!db.salaryRecords) db.salaryRecords = [];
        // 删除该月份的旧记录
        db.salaryRecords = db.salaryRecords.filter(function(r) { return r.period !== _salaryPeriod; });
        // 添加新记录
        validRows.forEach(function(r) {
            r.period = _salaryPeriod;
            r.employeeId = r.employeeId || salaryRowId();
            r.id = 'sal_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
            r.date = td();
            applySalaryCalculations(r);
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

function openSalaryAddMenu() {
    var h = '<h3>添加工资数据</h3><p class="salary-move-copy">选择单独添加员工，或从 Excel 工资表批量识别。</p>';
    h += '<div class="salary-add-options">';
    h += '<button type="button" class="salary-template-action primary" onclick="addSalaryEmployeeFromMenu()"><strong>添加空白员工</strong><span>新增一行后手动填写工资信息</span></button>';
    h += '<button type="button" class="salary-template-action" onclick="importSalaryExcelFromMenu()"><strong>导入 Excel 工资表</strong><span>支持 .xlsx 和 .xls 文件</span></button>';
    h += '</div><div class="salary-template-footer"><button type="button" class="btn" onclick="closeModal()">取消</button></div>';
    showModal(h, 500);
}

function addSalaryEmployeeFromMenu() {
    closeModal();
    addSalaryRow();
}

function importSalaryExcelFromMenu() {
    importSalaryExcel();
    closeModal();
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
            var matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: true, defval: '' });
            prepareSalaryExcelImport(salaryExcelMatrixToObjects(matrix));
        } catch (err) {
            console.error('Excel parse error:', err);
            toast('Excel解析失败');
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

function salaryExcelMatrixToObjects(matrix) {
    if (!Array.isArray(matrix) || !matrix.length) return [];
    var headerRow = matrix.findIndex(function(row) {
        return Array.isArray(row) && row.some(function(value) { return String(value).trim() === '姓名'; });
    });
    if (headerRow < 0) return [];
    var childRow = headerRow + 1;
    var knownLabels = salaryFieldDefinitions().reduce(function(labels, field) {
        labels.push(field.label);
        return labels.concat(field.aliases || []);
    }, ['姓名', '部门', '职务', '卡号', '备注']);
    var childIsHeader = Array.isArray(matrix[childRow]) && matrix[childRow].some(function(value) {
        var label = String(value).replace(/\s+/g, '').trim();
        return label && knownLabels.indexOf(label) >= 0;
    });
    var headers = (matrix[headerRow] || []).map(function(base, index) {
        var child = childIsHeader && matrix[childRow] ? matrix[childRow][index] : '';
        return String(child || base || '').replace(/\s+/g, '').trim();
    });
    var startRow = childIsHeader ? childRow + 1 : headerRow + 1;
    return matrix.slice(startRow).map(function(values) {
        var row = {};
        headers.forEach(function(header, index) {
            if (header) row[header] = values[index];
        });
        return row;
    }).filter(function(row) {
        return Object.keys(row).some(function(key) { return row[key] !== '' && row[key] !== null && row[key] !== undefined; });
    });
}

function salaryRowsFromExcel(jsonData) {
    return jsonData.map(function(row) {
        var mapped = {
            period: _salaryPeriod,
            department: row['部门'] || row['department'] || '',
            note: row['备注'] || row['note'] || ''
        };
        salaryInputFields(true).forEach(function(field) {
            var keys = [field.label, field.key].concat(field.aliases || []);
            var value = '';
            for (var i = 0; i < keys.length; i++) {
                if (row[keys[i]] !== undefined && row[keys[i]] !== null && row[keys[i]] !== '') {
                    value = row[keys[i]];
                    break;
                }
            }
            mapped[field.key] = field.numeric ? (parseFloat(value) || 0) : String(value || '');
        });
        return normalizeSalaryRow(mapped);
    }).filter(function(row) { return !!String(row.employee || '').trim(); });
}

function salaryImportMatchKey(row) {
    return [row.employee || '', row.department || '', row.position || ''].map(function(value) {
        return String(value).trim();
    }).join('\u0000');
}

function applySalaryExcelRows(rows, mode) {
    if (mode === 'replace') {
        _salaryTableData = cloneSalaryRows(rows);
    } else {
        var merged = cloneSalaryRows(_salaryTableData);
        rows.forEach(function(imported) {
            var key = salaryImportMatchKey(imported);
            var existing = merged.find(function(row) { return salaryImportMatchKey(row) === key; });
            if (!existing) {
                merged.push(Object.assign({}, imported));
                return;
            }
            var rowId = existing.id;
            var employeeId = existing.employeeId;
            salaryInputFields(true).forEach(function(field) { existing[field.key] = imported[field.key]; });
            existing.note = imported.note || '';
            existing.id = rowId;
            existing.employeeId = employeeId;
            existing.period = _salaryPeriod;
        });
        _salaryTableData = merged;
    }
    cacheSalaryDraft();
    renderSalaryTable();
}

function prepareSalaryExcelImport(jsonData) {
    _pendingSalaryImportRows = salaryRowsFromExcel(jsonData);
    if (!_pendingSalaryImportRows.length) {
        toast('没有识别到含姓名的工资记录');
        return;
    }
    var currentCount = _salaryTableData.filter(function(row) { return !!String(row.employee || '').trim(); }).length;
    var h = '<h3>已识别 ' + _pendingSalaryImportRows.length + ' 位员工</h3>';
    h += '<p class="salary-move-copy">当前草稿已有 <strong>' + currentCount + '</strong> 位员工。合并时按“姓名 + 部门 + 职务”匹配同一员工。</p>';
    h += '<div class="salary-move-options"><button class="salary-move-option" type="button" onclick="confirmSalaryExcelImport(\'merge\')"><strong>合并到当前草稿</strong><span>更新匹配员工，并保留当前草稿中的其他员工。</span></button>';
    h += '<button class="salary-move-option danger" type="button" onclick="confirmSalaryExcelImport(\'replace\')"><strong>覆盖当前草稿</strong><span>当前未保存内容将替换为 Excel 识别结果。</span></button></div>';
    h += '<div class="salary-template-footer"><button type="button" class="btn" onclick="closeModal()">取消</button></div>';
    showModal(h, 520);
}

function confirmSalaryExcelImport(mode) {
    var rows = cloneSalaryRows(_pendingSalaryImportRows);
    _pendingSalaryImportRows = [];
    applySalaryExcelRows(rows, mode);
    closeModal();
    toast((mode === 'merge' ? '已合并 ' : '已导入 ') + rows.length + ' 条记录');
}

// 保留旧入口供测试和兼容调用；直接调用时按原有行为覆盖当前草稿。
function parseSalaryExcelData(jsonData) {
    var rows = salaryRowsFromExcel(jsonData);
    applySalaryExcelRows(rows, 'replace');
    toast('已导入 ' + rows.length + ' 条记录');
}

// ------ 侧边栏生成 ------
// 根据配置动态生成侧边栏，兼容旧用户（无配置时显示所有）
// 配置跟随用户，每个用户有自己的配置

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

    var currentPage = localStorage.getItem('ax_lastPage') || _curPage || 'dash';
    document.querySelectorAll('.toolbar-btn').forEach(function(button) {
        button.classList.toggle('active', button.dataset.page === currentPage);
    });
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
    return '<button type="button" class="view-tab' + (i === 0 ? ' active' : '') + '" role="tab" aria-selected="' + (i === 0) + '" onclick="fnavTabClick(this,\'' + page + '\',' + i + ')">' + t + '</button>';
  }).join('');
}

function fnavTabClick(btn, page, idx) {
  $id('fnavTabs').querySelectorAll('.view-tab').forEach(function(t) {
    t.classList.remove('active');
    t.setAttribute('aria-selected', 'false');
  });
  btn.classList.add('active');
  btn.setAttribute('aria-selected', 'true');

  // 如果页面内有子标签栏，同步切换
  var tabBtns = $id('mainContent').querySelectorAll('.view-tabs .view-tab');
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
    var animate = false;
    try {
        var key = 'ax_page_entered_' + _curPage;
        animate = !sessionStorage.getItem(key);
        sessionStorage.setItem(key, '1');
    } catch (e) {}
    $id('mainContent').innerHTML = '<div class="page-title">' + t + '</div><div class="page active' + (animate ? ' animate-once' : '') + '">' + c + '</div>';
    window.scrollTo(0, 0);
}


