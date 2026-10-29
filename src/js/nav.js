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
        if (b.dataset.page === name) b.setAttribute('aria-current', 'page');
        else b.removeAttribute('aria-current');
    });

    // 移动端自动收起侧边栏
    var toolbar = $id('toolbar');
    if (toolbar && toolbar.classList.contains('open')) {
        setToolbarOpen(false, true);
    }

    if (name.startsWith('inventory_type_')) {
        var inventoryType = inventoryTypeById(name.slice('inventory_type_'.length));
        if (!inventoryType || inventoryType.archived) { rDash(); return; }
        if (inventoryType.preset === 'other') {
            goPage(inventoryUnclassifiedLegacyItems().length ? 'inventory_unclassified' : 'dash');
            return;
        }
        if (inventoryType.preset === 'generic') rCustomInventory(inventoryType.id);
        else if (inventoryType.preset === 'other-category') rInv('other', inventoryType.legacyCategory, inventoryType.name);
        else rInv(inventoryType.preset, null, inventoryType.name);
        return;
    }

    if (name === 'inventory_unclassified') {
        if (!inventoryUnclassifiedLegacyItems().length) { goPage('dash'); return; }
        rInv('other', null, '未分类', true);
        return;
    }

    // 兼容旧版保存的 custom_xxx 页面位置。
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
        case 'other':     goPage(inventoryUnclassifiedLegacyItems().length ? 'inventory_unclassified' : 'dash'); break;
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
var _salaryImageImportState = null;
var _salaryImagePasteHandler = null;
var SALARY_TRASH_RETENTION_DAYS = 30;
var _salaryCalculationFields = null;
var _salarySummaryRows = new Map();
var _salarySummarySchema = '';

// 配置快照仅在一次同步计算中有效，结束即释放，避免配置编辑后读取旧值。
function withSalaryCalculationFields(callback) {
    if (_salaryCalculationFields) return callback();
    _salaryCalculationFields = salaryFieldDefinitions();
    try { return callback(); }
    finally { _salaryCalculationFields = null; }
}

function salaryFieldDefinitions() {
    if (_salaryCalculationFields) return _salaryCalculationFields;
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
function salaryTableHeaderHtml(readOnly) {
    readOnly = readOnly === true;
    var visibleFields = salaryVisibleFields();
    var employeeField = visibleFields.find(function(field) { return field.key === 'employee'; });
    var fields = visibleFields.filter(function(field) { return field.key !== 'employee'; });
    var groupMap = {};
    salaryFieldGroups().forEach(function(group) { groupMap[group.id] = group; });

    var row1 = readOnly ? '' : '<th class="salary-drag-column" rowspan="2"></th>';
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
    if (!readOnly) row1 += '<th rowspan="2">操作</th>';
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

function cacheSalaryDraft(changedRow) {
    if (!_salaryPeriod) return;
    var draft = _salaryDrafts[_salaryPeriod];
    var index = changedRow && draft && draft.length === _salaryTableData.length
        ? draft.findIndex(function(row) { return row.id === changedRow.id; }) : -1;
    if (index >= 0) draft[index] = Object.assign({}, changedRow);
    else _salaryDrafts[_salaryPeriod] = cloneSalaryRows(_salaryTableData);
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

function updateSalarySummaries(changedRow) {
    return withSalaryCalculationFields(function() {
        updateSalarySummariesWithFields(changedRow);
    });
}

function updateSalarySummariesWithFields(changedRow) {
    var schema = JSON.stringify(salaryFieldDefinitions());
    if (!changedRow || schema !== _salarySummarySchema) {
        _salarySummaryRows.clear();
        changedRow = null;
    }
    _salarySummarySchema = schema;
    var numericFields = salaryAllNumericFields();
    _salaryTableData.forEach(function(row) {
        if (row !== changedRow && _salarySummaryRows.has(row)) return;
        var values = {};
        numericFields.forEach(function(field) {
            values[field.key] = field.category === 'computed' ? salaryCalculatedValue(row, field.key) : Number(row[field.key]) || 0;
        });
        _salarySummaryRows.set(row, values);
        document.querySelectorAll('[data-salary-computed="' + CSS.escape(row.id) + '"]').forEach(function(cell) {
            cell.textContent = fmtC(values[cell.dataset.salaryField] || 0);
        });
    });
    function cachedTotals(rows) {
        var totals = {};
        rows.forEach(function(row) {
            var values = _salarySummaryRows.get(row);
            numericFields.forEach(function(field) { totals[field.key] = (totals[field.key] || 0) + values[field.key]; });
        });
        return totals;
    }
    salaryDepartments().forEach(function(department) {
        if (changedRow && (String(changedRow.department || '').trim() || '未分部门') !== department) return;
        var totals = cachedTotals(salaryDepartmentRows(department));
        document.querySelectorAll('[data-salary-subtotal="' + CSS.escape(department) + '"]').forEach(function(cell) {
            var field = cell.dataset.salaryField;
            cell.textContent = fmtC(totals[field] || 0);
        });
    });
    var foot = $id('salTableFoot');
    if (!foot) return;
    var totals = cachedTotals(_salaryTableData);
    if (changedRow && foot.querySelector('[data-salary-total]')) {
        foot.querySelectorAll('[data-salary-total]').forEach(function(cell) {
            cell.textContent = fmtC(totals[cell.dataset.salaryTotal] || 0);
        });
        return;
    }
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
            cell.dataset.salaryTotal = field.key;
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
    var visibleFields = salaryVisibleFields();
    var employeeField = visibleFields.find(function(field) { return field.key === 'employee'; });
    var fields = visibleFields.filter(function(field) { return field.key !== 'employee'; });
    var h = '<div class="salary-month-detail">';
    h += '<div class="salary-month-detail-head"><button class="btn s" onclick="closeSalaryMonthDetail()">← 明细</button><div class="salary-month-detail-title"><strong>' + salaryEscape(period) + ' 工资明细</strong><span>' + records.length + ' 人 · 整月工资表</span></div><div class="salary-month-detail-actions"><button class="btn" onclick="openSalaryMonthMove(\'' + period + '\')">修改月份</button><button class="btn" onclick="openSalaryInEntry(\'' + period + '\')">在录入中编辑</button><button class="btn d" onclick="trashSalaryMonth(\'' + period + '\')">删除本月</button></div></div>';
    h += '<div class="tw salary-table-wrap salary-month-table-wrap" role="region" tabindex="0" aria-label="' + salaryEscape(period) + ' 工资明细表，可横向滚动">';
    h += '<table id="salaryMonthTable" class="salary-month-table" aria-label="' + salaryEscape(period) + ' 工资明细表"><thead>' + salaryTableHeaderHtml(true) + '</thead><tbody>';
    if (!records.length) {
        h += '<tr class="salary-month-empty"><td colspan="' + (fields.length + 1) + '">该月暂无工资记录</td></tr>';
    } else {
        salaryMonthDepartments(records).forEach(function(department) {
            var departmentRecords = salaryMonthDepartmentRows(records, department);
            if (!departmentRecords.length) return;
            h += '<tr class="salary-department-row"><td class="salary-department-label salary-name-column">' + salaryEscape(department) + ' · ' + departmentRecords.length + ' 人</td>';
            if (fields.length) h += '<td class="salary-summary-spacer" colspan="' + fields.length + '"></td>';
            h += '</tr>';
            departmentRecords.forEach(function(record) {
                h += '<tr class="salary-month-employee-row" data-salary-record-id="' + salaryEscape(record.id) + '"><td class="salary-name-column">' + salaryEscape(record.employee || '未命名员工') + '</td>';
                fields.forEach(function(field) { h += salaryMonthFieldCellHtml(record, field); });
                h += '</tr>';
            });
            h += salaryMonthSummaryRow('部门小计', departmentRecords, fields, 'salary-department-subtotal', 'salary-subtotal-label');
        });
    }
    h += '</tbody>';
    if (records.length) h += '<tfoot>' + salaryMonthSummaryRow('全店总计', records, fields, 'salary-grand-total', 'salary-total-label') + '</tfoot>';
    return h + '</table></div></div>';
}

function salaryMonthDepartments(records) {
    var config = getAppConfig();
    var departments = uniqueStrings(config.salaryDepartments || [], []);
    records.forEach(function(record) {
        var department = String(record.department || '').trim() || '未分部门';
        if (departments.indexOf(department) < 0) departments.push(department);
    });
    if (departments.indexOf('未分部门') < 0) departments.unshift('未分部门');
    return departments.filter(function(department) {
        return records.some(function(record) { return (String(record.department || '').trim() || '未分部门') === department; });
    });
}

function salaryMonthDepartmentRows(records, department) {
    return records.filter(function(record) {
        return (String(record.department || '').trim() || '未分部门') === department;
    });
}

function salaryMonthFieldValue(record, field) {
    var value = record[field.key];
    if (field.category === 'computed') {
        return value !== undefined && value !== null && value !== '' && Number.isFinite(Number(value))
            ? Number(value)
            : salaryCalculatedValue(record, field.key);
    }
    if (field.key === 'attendanceDays' && (value === undefined || value === null || value === '')) return 31;
    return field.numeric ? (Number(value) || 0) : (value || '');
}

function salaryMonthFieldCellHtml(record, field) {
    var value = salaryMonthFieldValue(record, field);
    if (field.category === 'computed') return '<td class="nr salary-computed-cell">' + fmtC(value) + '</td>';
    if (field.numeric) return '<td class="nr">' + salaryEscape(value) + '</td>';
    return '<td>' + (value ? salaryEscape(value) : '<span class="salary-month-empty-value">—</span>') + '</td>';
}

function salaryMonthSummaryRow(label, records, fields, rowClass, labelClass) {
    var totals = {};
    fields.filter(function(field) { return field.numeric; }).forEach(function(field) {
        totals[field.key] = records.reduce(function(sum, record) { return sum + salaryMonthFieldValue(record, field); }, 0);
    });
    var h = '<tr class="' + rowClass + '"><td class="' + labelClass + ' salary-name-column">' + label + '</td>';
    fields.forEach(function(field) {
        h += field.numeric
            ? '<td class="nr">' + fmtC(totals[field.key] || 0) + '</td>'
            : '<td class="salary-summary-spacer"></td>';
    });
    return h + '</tr>';
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

function salaryCalculationGroupForField(fieldId, category, group, selectedGroup) {
    if (fieldId === 'attendanceDays') return 'attendance';
    if (category === 'earning') {
        return selectedGroup === 'base' || selectedGroup === 'direct'
            ? selectedGroup
            : (group === 'basePay' ? 'base' : 'direct');
    }
    if (category === 'deduction') {
        return selectedGroup === 'preTaxDeduction' || selectedGroup === 'postTaxDeduction'
            ? selectedGroup
            : (group === 'preTax' ? 'preTaxDeduction' : 'postTaxDeduction');
    }
    return '';
}

function salaryCalculationGroupLabel(value) {
    return {
        base: '基本工资',
        direct: '直接应发',
        preTaxDeduction: '税前扣款',
        postTaxDeduction: '税后扣款',
        attendance: '出勤天数'
    }[value] || '不参与合计';
}

function salaryCalculationGroupOptions(category, selected) {
    var options = category === 'earning'
        ? [{ value: 'base', label: '基本工资' }, { value: 'direct', label: '直接应发' }]
        : [{ value: 'preTaxDeduction', label: '税前扣款' }, { value: 'postTaxDeduction', label: '税后扣款' }];
    return options.map(function(option) {
        return '<option value="' + option.value + '"' + (option.value === selected ? ' selected' : '') + '>' + option.label + '</option>';
    }).join('');
}

function salaryFieldCalculationControl(field) {
    var selected = salaryCalculationGroupForField(field.id, field.category, field.group, field.calculationGroup);
    if (field.id === 'attendanceDays') return '<span class="salary-calculation-fixed">' + salaryCalculationGroupLabel('attendance') + '</span>';
    if (field.category === 'earning' || field.category === 'deduction') {
        return '<select class="inp salary-field-calculation-group-input" aria-label="' + salaryEscape(field.label) + '计入工资计算" title="计入工资计算">'
            + salaryCalculationGroupOptions(field.category, selected) + '</select>';
    }
    return '<span class="salary-calculation-fixed">' + (field.category === 'computed' ? '公式计算' : '不参与合计') + '</span>';
}

document.addEventListener('pointerdown', function(event) {
    var current = event.target.closest && event.target.closest('.salary-editor-actions');
    document.querySelectorAll('.salary-editor-actions[open]').forEach(function(menu) {
        if (menu !== current) menu.open = false;
    });
    var addMenu = event.target.closest && event.target.closest('.salary-layout-add-fab');
    var openAddMenu = document.querySelector('.salary-layout-add-fab[open]');
    if (openAddMenu && openAddMenu !== addMenu) openAddMenu.open = false;
});
document.addEventListener('keydown', function(event) {
    if (event.key !== 'Escape') return;
    var menu = document.querySelector('.salary-editor-actions[open]');
    var addMenu = document.querySelector('.salary-layout-add-fab[open]');
    if (!menu && !addMenu) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    if (menu) {
        menu.open = false;
        menu.querySelector('summary').focus();
    } else {
        addMenu.open = false;
        addMenu.querySelector('summary').focus();
    }
}, true);

function salaryGroupEditorRow(group, fields) {
    fields = fields || [];
    var h = '<section class="salary-layout-group" data-group-id="' + salaryEscape(group.id) + '">';
    h += '<div class="salary-group-edit-row">';
    h += '<button type="button" class="salary-layout-drag-handle" data-drag-kind="group" onpointerdown="startSalaryLayoutDrag(event)" onkeydown="salaryLayoutHandleKeydown(event)" aria-label="拖动分组，也可用上下方向键调整" title="拖动或用键盘上下方向键调整">&#8942;&#8942;</button>';
    h += '<label class="salary-group-name"><input class="inp salary-group-label" value="' + salaryEscape(group.label) + '" aria-label="分组名称"></label>';
    h += '<label class="salary-group-span" title="开启后隐藏分组标题，每个字段名跨两行表头显示"><input type="checkbox" class="salary-group-span-input"' + (group.span ? ' checked' : '') + '><span>字段名跨两行</span></label>';
    h += '<details class="salary-editor-actions salary-group-actions"><summary aria-label="分组操作" title="分组操作">&#8942;</summary><div class="salary-editor-actions-menu"><button type="button" aria-label="上移分组" onclick="moveSalaryGroupEditorRow(this,-1)">上移分组</button><button type="button" aria-label="下移分组" onclick="moveSalaryGroupEditorRow(this,1)">下移分组</button><button type="button" class="danger" aria-label="删除分组" onclick="removeSalaryGroupEditorRow(this)">删除分组</button></div></details>';
    h += '</div><div class="salary-layout-fields" aria-label="' + salaryEscape(group.label) + '分组字段">';
    fields.forEach(function(field) { h += salaryFieldEditorRow(field, false); });
    h += '</div></section>';
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
    wrapper.innerHTML = salaryGroupEditorRow(group, []);
    var row = wrapper.firstElementChild;
    container.appendChild(row);
    updateSalaryGroupFieldNameWidth(row);
    scrollSalaryLayoutRowIntoView(row);
    var input = row.querySelector('.salary-group-label');
    if (input) { input.focus({ preventScroll: true }); input.select(); }
}

function moveSalaryGroupEditorRow(button, delta) {
    var row = button.closest('.salary-layout-group');
    if (!row) return;
    var menu = button.closest('.salary-editor-actions');
    if (menu) menu.open = false;
    var sibling = delta < 0 ? row.previousElementSibling : row.nextElementSibling;
    if (!sibling) { toast(delta < 0 ? '该分组已在最前面' : '该分组已在最后面'); return; }
    if (delta < 0) row.parentNode.insertBefore(row, sibling);
    else row.parentNode.insertBefore(sibling, row);
    toast('分组顺序已调整，保存后生效');
}

function removeSalaryGroupEditorRow(button) {
    var group = button.closest('.salary-layout-group');
    if (!group) return;
    var allGroups = Array.from(document.querySelectorAll('#salaryGroupRows > .salary-layout-group'));
    if (allGroups.length <= 1) { toast('至少保留一个工资表分组'); return; }
    var fallbackGroup = allGroups.find(function(item) { return item !== group; });
    var fields = Array.from(group.querySelectorAll('.salary-layout-fields > .salary-field-edit-row'));
    var fallbackContainer = fallbackGroup.querySelector('.salary-layout-fields');
    fields.forEach(function(field) { fallbackContainer.appendChild(field); });
    group.remove();
    updateSalaryGroupFieldNameWidth(fallbackGroup);
    toast(fields.length ? '分组已删除，字段已移入“' + (fallbackGroup.querySelector('.salary-group-label').value || '其他分组') + '”' : '分组已删除');
}

function salaryFieldEditorRow(field, fixed) {
    var lockedType = field.category === 'info' || field.category === 'computed';
    var editableCalculation = field.category === 'earning' || field.category === 'deduction';
    var calculationGroup = salaryCalculationGroupForField(field.id, field.category, field.group, field.calculationGroup);
    var rowClass = 'salary-field-edit-row' + (fixed ? ' salary-layout-field-fixed' : (editableCalculation ? ' salary-field-editable' : ' salary-field-static'));
    var h = '<div class="' + rowClass + '" data-field-id="' + salaryEscape(field.id) + '" data-group-id="' + salaryEscape(field.group || '') + '" data-category="' + salaryEscape(field.category) + '" data-calculation-group="' + salaryEscape(calculationGroup) + '" data-builtin="' + (field.builtin ? 'true' : 'false') + '" data-required="' + (field.required ? 'true' : 'false') + '" data-readonly="' + (field.readonly ? 'true' : 'false') + '" data-field-type="' + salaryEscape(field.type || 'number') + '" data-calculation="' + salaryEscape(field.calculation || '') + '" data-width="' + salaryEscape(field.width || '70px') + '" data-aliases="' + salaryEscape(JSON.stringify(field.aliases || [])) + '">';
    if (fixed) {
        h += '<label class="salary-field-name"><input class="inp salary-field-label" value="' + salaryEscape(field.label) + '" aria-label="工资字段名称"></label>';
        h += '<input type="hidden" class="salary-field-category-input" value="' + salaryEscape(field.category) + '">';
        h += '<input type="checkbox" class="salary-field-visible-input salary-field-hidden-state"' + (field.required || field.visible !== false ? ' checked' : '') + (field.required ? ' disabled' : '') + '>';
        h += '</div>';
        return h;
    }
    h += fixed
        ? '<span class="salary-layout-fixed-badge" title="姓名固定显示在工资表首列">固定首列</span>'
        : '<button type="button" class="salary-layout-drag-handle" data-drag-kind="field" onpointerdown="startSalaryLayoutDrag(event)" onkeydown="salaryLayoutHandleKeydown(event)" aria-label="拖动' + salaryEscape(field.label) + '，也可用上下方向键调整" title="拖动或用键盘上下方向键调整">&#8942;&#8942;</button>';
    h += '<label class="salary-field-name"><input class="inp salary-field-label" value="' + salaryEscape(field.label) + '" aria-label="工资字段名称" oninput="updateSalaryGroupFieldNameWidth(this.closest(\'.salary-layout-group\'))"></label>';
    if (lockedType) {
        var calculationLabel = field.category === 'computed'
            ? '公式计算'
            : (field.id === 'attendanceDays' ? salaryCalculationGroupLabel(calculationGroup) : '信息 · 不参与合计');
        h += '<div class="salary-field-meta salary-field-meta-static"><span class="salary-field-static-value">' + salaryEscape(calculationLabel) + '</span><input type="hidden" class="salary-field-category-input" value="' + salaryEscape(field.category) + '"></div>';
    } else {
        h += '<label class="salary-field-category"><span class="salary-layout-label">类型</span><select class="inp salary-field-category-input" aria-label="字段类型" onchange="updateSalaryFieldCalculationControl(this)">';
        h += '<option value="earning"' + (field.category === 'earning' ? ' selected' : '') + '>应发项</option><option value="deduction"' + (field.category === 'deduction' ? ' selected' : '') + '>扣款项</option>';
        h += '</select></label>';
        h += '<label class="salary-field-calculation"><span class="salary-layout-label">计算归属</span>' + salaryFieldCalculationControl(field) + '</label>';
    }
    h += field.required
        ? '<div class="salary-field-visible"><span class="salary-field-visible-fixed" aria-label="必填字段，始终显示">必显</span></div>'
        : '<label class="salary-field-visible"><input type="checkbox" class="salary-field-visible-input"' + (field.visible !== false ? ' checked' : '') + '><span>显示</span></label>';
    h += fixed
        ? '<div class="salary-layout-fixed-note">姓名固定首列</div>'
        : '<details class="salary-editor-actions salary-field-actions"><summary aria-label="' + salaryEscape(field.label) + '字段操作" title="字段操作">&#8942;</summary><div class="salary-editor-actions-menu"><button type="button" aria-label="上移字段" onclick="moveSalaryFieldEditorRow(this,-1)">上移字段</button><button type="button" aria-label="下移字段" onclick="moveSalaryFieldEditorRow(this,1)">下移字段</button><button type="button" class="danger" aria-label="删除字段" onclick="removeSalaryFieldEditorRow(this)">删除字段</button></div></details>';
    h += '</div>';
    return h;
}

function updateSalaryFieldCalculationControl(select) {
    var row = select.closest('.salary-field-edit-row');
    var calculation = row && row.querySelector('.salary-field-calculation-group-input');
    if (!row || !calculation) return;
    var category = select.value;
    var oldValue = calculation.value;
    var nextValue = category === 'earning'
        ? (oldValue === 'base' || oldValue === 'direct' ? oldValue : 'direct')
        : (oldValue === 'preTaxDeduction' || oldValue === 'postTaxDeduction' ? oldValue : 'postTaxDeduction');
    calculation.innerHTML = salaryCalculationGroupOptions(category, nextValue);
    row.dataset.category = category;
    row.dataset.calculationGroup = nextValue;
    updateSalaryGroupFieldNameWidth(row.closest('.salary-layout-group'));
}

function removeSalaryFieldEditorRow(button) {
    var row = button.closest('.salary-field-edit-row');
    if (!row) return;
    if (row.dataset.required === 'true') { toast('必填字段（如姓名）不能删除'); return; }
    if (row.dataset.builtin === 'true' && !window.confirm('这是内置字段，删除后如需恢复要手动重新添加（历史数据保留）。确定删除？')) return;
    var group = row.closest('.salary-layout-group');
    row.remove();
    updateSalaryGroupFieldNameWidth(group);
    toast('字段已从列表移除，保存后生效');
}

function openSalaryFieldManager() {
    var fields = salaryFieldDefinitions();
    var groups = salaryFieldGroups();
    var employeeField = fields.find(function(field) { return field.id === 'employee'; });
    var h = '<div class="salary-template-dialog salary-field-dialog"><h3>工资字段设置</h3>';
    h += '<p class="salary-template-intro">拖动只调列位置；核算由“计算归属”决定，隐藏字段仍保留历史数据。</p>';
    h += '<div class="view-tabs salary-field-tabs" role="tablist" aria-label="工资字段设置视图">';
    h += '<button type="button" class="view-tab active" role="tab" aria-selected="true" data-tab="layout" onclick="switchSalaryFieldTab(\'layout\')">工资表布局</button>';
    h += '<button type="button" class="view-tab" role="tab" aria-selected="false" data-tab="formulas" onclick="switchSalaryFieldTab(\'formulas\')">计算公式</button>';
    h += '</div><div class="salary-field-dialog-body">';
    h += '<div class="salary-field-panel" data-panel="layout">';
    if (employeeField) {
        h += '<div class="salary-layout-fixed"><div class="salary-layout-section-title">固定首列</div>';
        h += '<div id="salaryPinnedFieldRows">' + salaryFieldEditorRow(employeeField, true) + '</div></div>';
    }
    h += '<div id="salaryGroupRows" class="salary-layout-groups">';
    groups.forEach(function(group) {
        var groupFields = fields.filter(function(field) { return field.id !== 'employee' && field.group === group.id; });
        h += salaryGroupEditorRow(group, groupFields);
    });
    h += '</div>';
    var groupIds = groups.map(function(group) { return group.id; });
    var ungroupedFields = fields.filter(function(field) {
        return field.id !== 'employee' && groupIds.indexOf(field.group) < 0;
    });
    if (ungroupedFields.length) {
        h += '<section class="salary-layout-ungrouped"><div class="salary-layout-section-title">待归入工资表分组</div><p class="salary-field-panel-copy">这些字段当前没有对应分组；可用拖动或上下按钮将它们移入工资表分组。</p>';
        h += '<div id="salaryUngroupedFields" class="salary-layout-fields" aria-label="待归组工资字段">';
        ungroupedFields.forEach(function(field) { h += salaryFieldEditorRow(field, false); });
        h += '</div></section>';
    }
    h += '</div>';
    h += '<div class="salary-field-panel" data-panel="formulas" hidden><div class="salary-layout-section-title">工资计算公式</div><p class="salary-field-panel-copy">公式通过字段名称引用；拖动列位置不会更改公式。</p>' + salaryFormulaEditorHtml() + '</div></div>';
    h += '<details class="salary-layout-add-fab"><summary aria-label="添加字段或分组" title="添加字段或分组">+</summary><div class="salary-layout-add-menu"><button type="button" onclick="closeSalaryLayoutAddMenu();addSalaryGroupRow()">添加分组</button><button type="button" onclick="closeSalaryLayoutAddMenu();addSalaryCustomField()">添加工资段</button><button type="button" onclick="closeSalaryLayoutAddMenu();addSalaryInfoField()">添加信息段</button></div></details>';
    h += '<div class="salary-template-footer split"><button type="button" class="btn" onclick="backToModal(function(){openSalaryTemplateMenu()})">取消</button><button type="button" class="btn p" onclick="saveSalaryFieldDefinitions()">保存设置</button></div></div>';
    showModal(h, 880);
    document.querySelectorAll('#salaryGroupRows > .salary-layout-group').forEach(updateSalaryGroupFieldNameWidth);
}

function closeSalaryLayoutAddMenu() {
    var menu = document.querySelector('.salary-layout-add-fab[open]');
    if (menu) menu.open = false;
}

function scrollSalaryLayoutRowIntoView(row) {
    var body = row && row.closest('.salary-field-dialog-body');
    if (!row || !body) return;
    var rowRect = row.getBoundingClientRect();
    var bodyRect = body.getBoundingClientRect();
    var nextTop = body.scrollTop + rowRect.top - bodyRect.top - (body.clientHeight - rowRect.height) / 2;
    body.scrollTo({ left: 0, top: Math.max(0, nextTop), behavior: 'smooth' });
}

function updateSalaryGroupFieldNameWidth(group) {
    if (!group || !group.matches('.salary-layout-group')) return;
    var canvas = updateSalaryGroupFieldNameWidth.canvas || (updateSalaryGroupFieldNameWidth.canvas = document.createElement('canvas'));
    var context = canvas.getContext('2d');
    var fieldLabels = Array.from(group.querySelectorAll('.salary-layout-fields > .salary-field-edit-row .salary-field-label'));
    if (!context) return;
    var requiredWidth = 0;
    fieldLabels.forEach(function(input) {
        context.font = getComputedStyle(input).font;
        requiredWidth = Math.max(requiredWidth, context.measureText(input.value || '').width + 24);
    });
    var width = Math.max(96, Math.min(220, Math.ceil(requiredWidth)));
    group.style.setProperty('--salary-field-name-width', width + 'px');

    function measureSelectWidth(selector, fallback, minimum, maximum) {
        var required = minimum;
        group.querySelectorAll(selector).forEach(function(select) {
            context.font = getComputedStyle(select.closest('label') || select).font;
            Array.from(select.options || []).forEach(function(option) {
                required = Math.max(required, context.measureText(option.textContent || '').width + 46);
            });
        });
        return Math.max(minimum, Math.min(maximum, Math.ceil(required || fallback)));
    }

    var categoryWidth = measureSelectWidth('.salary-field-category-input', 100, 96, 140);
    var calculationWidth = measureSelectWidth('.salary-field-calculation-group-input', 116, 112, 160);
    context.font = getComputedStyle(group).font;
    var visibleWidth = Math.max(48, Math.min(64, Math.ceil(Math.max(
        context.measureText('必显').width,
        context.measureText('显示').width + 21
    ) + 8)));
    group.style.setProperty('--salary-field-category-width', categoryWidth + 'px');
    group.style.setProperty('--salary-field-calculation-width', calculationWidth + 'px');
    group.style.setProperty('--salary-field-visible-width', visibleWidth + 'px');

    var groups = Array.from(document.querySelectorAll('#salaryGroupRows > .salary-layout-group'));
    var tableWidth = groups.reduce(function(maxWidth, item) {
        var style = getComputedStyle(item);
        var columns = ['--salary-field-name-width', '--salary-field-category-width', '--salary-field-calculation-width', '--salary-field-visible-width'];
        var contentWidth = columns.reduce(function(sum, property) {
            return sum + (parseFloat(style.getPropertyValue(property)) || 0);
        }, 0);
        return Math.max(maxWidth, Math.ceil(contentWidth + 112));
    }, 0);
    var container = document.getElementById('salaryGroupRows');
    if (container && tableWidth) container.style.setProperty('--salary-layout-table-width', tableWidth + 'px');
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
    var addMenu = document.querySelector('.salary-layout-add-fab');
    if (addMenu) {
        addMenu.hidden = name !== 'layout';
        addMenu.open = false;
    }
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
    var groups = Array.from(document.querySelectorAll('#salaryGroupRows > .salary-layout-group'));
    if (!groups.length) { toast('请先新增一个工资表分组'); return; }
    var targetGroup = groups[groups.length - 1];
    var container = targetGroup.querySelector('.salary-layout-fields');
    if (!container) return;
    var field = {
        id: 'salary_custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        label: '新工资项', category: 'earning', group: targetGroup.dataset.groupId, calculationGroup: 'direct', type: 'number', visible: true,
        builtin: false, required: false, readonly: false, width: '70px', aliases: []
    };
    var wrapper = document.createElement('div');
    wrapper.innerHTML = salaryFieldEditorRow(field, false);
    var row = wrapper.firstElementChild;
    container.appendChild(row);
    updateSalaryGroupFieldNameWidth(targetGroup);
    scrollSalaryLayoutRowIntoView(row);
    var input = row.querySelector('.salary-field-label');
    if (input) { input.focus({ preventScroll: true }); input.select(); }
}

function addSalaryInfoField() {
    var container = $id('salaryGroupRows');
    if (!container) return;
    var targetGroup = Array.from(container.children).find(function(group) { return group.dataset.groupId === 'info'; });
    if (!targetGroup) {
        var infoGroup = { id: 'info', label: '信息项', span: true, order: 0 };
        var groupWrapper = document.createElement('div');
        groupWrapper.innerHTML = salaryGroupEditorRow(infoGroup, []);
        targetGroup = groupWrapper.firstElementChild;
        container.insertBefore(targetGroup, container.firstElementChild);
    }
    var fields = targetGroup.querySelector('.salary-layout-fields');
    if (!fields) return;
    var field = {
        id: 'salary_custom_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
        label: '新信息字段', category: 'info', group: targetGroup.dataset.groupId, type: 'text', visible: true,
        builtin: false, required: false, readonly: false, width: '90px', aliases: []
    };
    var wrapper = document.createElement('div');
    wrapper.innerHTML = salaryFieldEditorRow(field, false);
    var row = wrapper.firstElementChild;
    fields.appendChild(row);
    updateSalaryGroupFieldNameWidth(targetGroup);
    scrollSalaryLayoutRowIntoView(row);
    var input = row.querySelector('.salary-field-label');
    if (input) { input.focus({ preventScroll: true }); input.select(); }
}

function moveSalaryFieldEditorRow(button, delta) {
    var row = button.closest('.salary-field-edit-row');
    if (!row) return;
    var menu = button.closest('.salary-editor-actions');
    if (menu) menu.open = false;
    var container = row.closest('.salary-layout-fields');
    var group = row.closest('.salary-layout-group');
    if (!container) return;
    var sibling = delta < 0 ? row.previousElementSibling : row.nextElementSibling;
    if (sibling && sibling.classList.contains('salary-field-edit-row')) {
        if (delta < 0) container.insertBefore(row, sibling);
        else container.insertBefore(sibling, row);
    } else {
        var groups = Array.from(document.querySelectorAll('#salaryGroupRows > .salary-layout-group'));
        var groupIndex = group ? groups.indexOf(group) : -1;
        var targetIndex = group ? groupIndex + (delta < 0 ? -1 : 1) : (delta < 0 ? groups.length - 1 : -1);
        var targetGroup = groups[targetIndex];
        if (!targetGroup) { toast(delta < 0 ? '该字段已在最前面' : '该字段已在最后面'); return; }
        var targetContainer = targetGroup.querySelector('.salary-layout-fields');
        if (delta < 0) targetContainer.appendChild(row);
        else targetContainer.insertBefore(row, targetContainer.firstElementChild);
    }
    updateSalaryGroupFieldNameWidth(group);
    updateSalaryGroupFieldNameWidth(row.closest('.salary-layout-group'));
    hideEmptySalaryUngroupedFields();
    toast('字段顺序已调整，保存后生效');
}

function hideEmptySalaryUngroupedFields() {
    var container = $id('salaryUngroupedFields');
    var section = container && container.closest('.salary-layout-ungrouped');
    if (section && !container.children.length) section.hidden = true;
}

function salaryLayoutHandleKeydown(event) {
    if (event.key !== 'ArrowUp' && event.key !== 'ArrowDown') return;
    event.preventDefault();
    var delta = event.key === 'ArrowUp' ? -1 : 1;
    if (event.currentTarget.dataset.dragKind === 'group') moveSalaryGroupEditorRow(event.currentTarget, delta);
    else moveSalaryFieldEditorRow(event.currentTarget, delta);
}

var _salaryLayoutDrag = null;

function clearSalaryLayoutDropTargets() {
    document.querySelectorAll('.salary-layout-drop-before,.salary-layout-drop-after,.salary-layout-drop-active').forEach(function(node) {
        node.classList.remove('salary-layout-drop-before', 'salary-layout-drop-after', 'salary-layout-drop-active');
    });
}

function startSalaryLayoutDrag(event) {
    if (event.button !== undefined && event.button !== 0) return;
    var kind = event.currentTarget.dataset.dragKind;
    var item = kind === 'group' ? event.currentTarget.closest('.salary-layout-group') : event.currentTarget.closest('.salary-field-edit-row');
    if (!item) return;
    if (_salaryLayoutDrag) cancelSalaryLayoutDrag();
    event.preventDefault();
    _salaryLayoutDrag = {
        kind: kind,
        item: item,
        originContainer: item.closest('.salary-layout-fields'),
        startRect: item.getBoundingClientRect(),
        startX: event.clientX,
        startY: event.clientY,
        pointerId: event.pointerId,
        activated: false,
        dropTarget: null
    };
    document.addEventListener('pointermove', moveSalaryLayoutDrag);
    document.addEventListener('pointerup', finishSalaryLayoutDrag);
    document.addEventListener('pointercancel', cancelSalaryLayoutDrag);
}

function moveSalaryLayoutDrag(event) {
    if (!_salaryLayoutDrag) return;
    var drag = _salaryLayoutDrag;
    if (drag.pointerId !== undefined && event.pointerId !== drag.pointerId) return;
    if (!drag.activated) {
        if (Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 8) return;
        drag.activated = true;
        drag.item.classList.add('salary-layout-dragging-item');
        document.body.classList.add('salary-layout-dragging');
    }
    clearSalaryLayoutDropTargets();
    var hit = document.elementFromPoint(event.clientX, event.clientY);
    if (!hit) return;
    if (drag.kind === 'group') {
        var targetGroup = hit.closest('.salary-layout-group');
        if (!targetGroup || targetGroup === drag.item) { drag.dropTarget = null; return; }
        var afterGroup = event.clientY > targetGroup.getBoundingClientRect().top + targetGroup.getBoundingClientRect().height / 2;
        targetGroup.classList.add(afterGroup ? 'salary-layout-drop-after' : 'salary-layout-drop-before');
        drag.dropTarget = { kind: 'group', target: targetGroup, after: afterGroup };
        return;
    }
    var targetField = hit.closest('.salary-field-edit-row');
    if (targetField && targetField !== drag.item && !targetField.classList.contains('salary-layout-field-fixed')) {
        var afterField = event.clientY > targetField.getBoundingClientRect().top + targetField.getBoundingClientRect().height / 2;
        targetField.classList.add(afterField ? 'salary-layout-drop-after' : 'salary-layout-drop-before');
        drag.dropTarget = { kind: 'field', target: targetField, after: afterField };
        return;
    }
    var group = hit.closest('.salary-layout-group');
    var fields = group && group.querySelector('.salary-layout-fields');
    if (fields) {
        var overOriginalPosition = fields === drag.originContainer
            && event.clientX >= drag.startRect.left && event.clientX <= drag.startRect.right
            && event.clientY >= drag.startRect.top && event.clientY <= drag.startRect.bottom;
        if (overOriginalPosition) { drag.dropTarget = null; return; }
        fields.classList.add('salary-layout-drop-active');
        drag.dropTarget = { kind: 'fields', target: fields };
    } else drag.dropTarget = null;
}

function cleanupSalaryLayoutDrag() {
    var drag = _salaryLayoutDrag;
    if (!drag) return null;
    document.removeEventListener('pointermove', moveSalaryLayoutDrag);
    document.removeEventListener('pointerup', finishSalaryLayoutDrag);
    document.removeEventListener('pointercancel', cancelSalaryLayoutDrag);
    clearSalaryLayoutDropTargets();
    drag.item.classList.remove('salary-layout-dragging-item');
    document.body.classList.remove('salary-layout-dragging');
    _salaryLayoutDrag = null;
    return drag;
}

function cancelSalaryLayoutDrag(event) {
    if (_salaryLayoutDrag && event && _salaryLayoutDrag.pointerId !== undefined && event.pointerId !== _salaryLayoutDrag.pointerId) return;
    cleanupSalaryLayoutDrag();
}

function finishSalaryLayoutDrag(event) {
    if (_salaryLayoutDrag && event && _salaryLayoutDrag.pointerId !== undefined && event.pointerId !== _salaryLayoutDrag.pointerId) return;
    var drag = cleanupSalaryLayoutDrag();
    if (!drag || !drag.activated) return;
    var target = drag.dropTarget;
    if (!target) return;
    var oldGroup = drag.item.closest('.salary-layout-group');
    if (target.kind === 'group') {
        var groupParent = target.target.parentNode;
        if (drag.item === target.target || drag.item.contains(target.target)) return;
        groupParent.insertBefore(drag.item, target.after ? target.target.nextSibling : target.target);
        toast('分组顺序已调整，保存后生效');
    } else if (target.kind === 'field') {
        var fieldParent = target.target.parentNode;
        if (drag.item === target.target) return;
        fieldParent.insertBefore(drag.item, target.after ? target.target.nextSibling : target.target);
        updateSalaryGroupFieldNameWidth(oldGroup);
        updateSalaryGroupFieldNameWidth(drag.item.closest('.salary-layout-group'));
        hideEmptySalaryUngroupedFields();
        toast('字段位置已调整，保存后生效');
    } else if (target.kind === 'fields') {
        target.target.appendChild(drag.item);
        updateSalaryGroupFieldNameWidth(oldGroup);
        updateSalaryGroupFieldNameWidth(drag.item.closest('.salary-layout-group'));
        hideEmptySalaryUngroupedFields();
        toast('字段已移入分组，保存后生效');
    }
}

function saveSalaryFieldDefinitions() {
    var groupRows = Array.from(document.querySelectorAll('#salaryGroupRows > .salary-layout-group'));
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

    var rows = Array.from(document.querySelectorAll('#salaryPinnedFieldRows .salary-field-edit-row, #salaryGroupRows .salary-field-edit-row, #salaryUngroupedFields .salary-field-edit-row'));
    var labels = [];
    var invalid = false;
    var fields = rows.map(function(row, index) {
        var label = (row.querySelector('.salary-field-label').value || '').trim();
        if (!label || labels.indexOf(label) >= 0) invalid = true;
        labels.push(label);
        var categoryInput = row.querySelector('.salary-field-category-input');
        var category = categoryInput.value;
        var groupContainer = row.closest('.salary-layout-group');
        var group = groupContainer ? groupContainer.dataset.groupId : (row.dataset.groupId || '');
        var calculationInput = row.querySelector('.salary-field-calculation-group-input');
        var required = row.dataset.required === 'true';
        var visibleInput = row.querySelector('.salary-field-visible-input');
        var aliases = [];
        try { aliases = JSON.parse(row.dataset.aliases || '[]'); } catch (e) {}
        return {
            id: row.dataset.fieldId,
            label: label,
            category: category,
            group: group,
            calculation: row.dataset.calculation || '',
            calculationGroup: salaryCalculationGroupForField(row.dataset.fieldId, category, group, calculationInput ? calculationInput.value : row.dataset.calculationGroup),
            type: category === 'info' ? (row.dataset.fieldType || 'text') : 'number',
            visible: required || !visibleInput || visibleInput.checked,
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
    cacheSalaryDraft(row);
    if (field === 'department') {
        renderSalaryTable();
    } else {
        updateSalarySummaries(row);
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
    var validRows = _salaryTableData.filter(function(r) {
        return r.employee && (calcSalaryActual(r) !== 0 || r._salaryRecognitionAdded);
    }).map(function(row) {
        var savedRow = Object.assign({}, row);
        delete savedRow._salaryRecognitionAdded;
        return savedRow;
    });
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
    var h = '<h3>工资数据</h3><p class="salary-move-copy">识别结果先在核对页确认；每行可匹配已有员工、跳过，或添加到当前月份工资名单。</p>';
    h += '<div class="salary-add-options">';
    h += '<button type="button" class="salary-template-action primary" onclick="addSalaryEmployeeFromMenu()"><strong>添加空白员工</strong><span>新增一行后手动填写工资信息</span></button>';
    h += '<button type="button" class="salary-template-action" onclick="importSalaryExcelFromMenu()"><strong>识别 Excel 工资表</strong><span>匹配已有员工并填入工资数据</span></button>';
    h += '<button type="button" class="salary-template-action" onclick="openSalaryImageImport()"><strong>识别工资表图片</strong><span>选择图片、粘贴截图或用手机拍照</span></button>';
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

function cleanupSalaryImagePaste() {
    if (_salaryImagePasteHandler) {
        document.removeEventListener('paste', _salaryImagePasteHandler);
        _salaryImagePasteHandler = null;
    }
}

function clearSalaryImageReviewState() {
    _salaryImageImportState = null;
}

function openSalaryImageImport() {
    _salaryImageImportState = null;
    var h = '<h3>识别工资表图片</h3>';
    h += '<p class="salary-move-copy">支持工资表截图和清晰的打印表照片。图片会发送到当前设置的 AI 识图服务；识别后先核对员工对应关系和工资数据，只填入已有员工，不新增或删除员工。</p>';
    h += '<div class="salary-image-pick-actions">';
    h += '<button type="button" class="salary-template-action primary" onclick="selectSalaryImage(false)"><strong>选择图片</strong><span>从设备中选择一张图片</span></button>';
    h += '<button type="button" class="salary-template-action" onclick="selectSalaryImage(true)"><strong>手机拍照</strong><span>打开相机拍摄工资表</span></button>';
    h += '</div><div id="salaryImagePasteZone" class="salary-image-paste-zone" tabindex="0" role="button" aria-label="粘贴工资表截图">';
    h += '<strong>粘贴截图</strong><span>复制一张截图后，在这里按 Ctrl+V / ⌘V</span></div>';
    h += '<div class="salary-template-footer"><button type="button" class="btn" onclick="closeModal()">取消</button></div>';
    showModal(h, 560);
    cleanupSalaryImagePaste();
    _salaryImagePasteHandler = function(event) {
        if (!$id('salaryImagePasteZone')) return;
        var items = event.clipboardData && event.clipboardData.items;
        if (!items) return;
        for (var i = 0; i < items.length; i++) {
            var item = items[i];
            if (item.kind === 'file' && /^image\//i.test(item.type || '')) {
                var file = item.getAsFile();
                if (file) {
                    event.preventDefault();
                    handleSalaryImageFile(file);
                    return;
                }
            }
        }
    };
    document.addEventListener('paste', _salaryImagePasteHandler);
}

function selectSalaryImage(useCamera) {
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    if (useCamera) input.setAttribute('capture', 'environment');
    input.onchange = function() {
        var file = input.files && input.files[0];
        if (file) handleSalaryImageFile(file);
    };
    input.click();
}

function handleSalaryImageFile(file) {
    var imageFile = file && ((file.type && /^image\//i.test(file.type)) || /\.(png|jpe?g|webp|gif|bmp|heic|heif)$/i.test(file.name || ''));
    if (!imageFile) {
        toast('请选择图片文件');
        return;
    }
    cleanupSalaryImagePaste();
    closeModal();
    if (typeof prepareMimoImage !== 'function' || typeof requestConfiguredVisionAI !== 'function') {
        toast('图片识别服务尚未加载，请刷新页面后重试');
        return;
    }
    showAILoading('preparing');
    prepareMimoImage(file, function(imageError, base64) {
        if (imageError) {
            hideAILoading(null);
            var message = imageError.message || '图片处理失败';
            if (message.indexOf('仍超过 2 MB') >= 0) message = '图片处理后仍然过大，请裁剪或降低分辨率后重试（一次只识别一张图片）';
            toast(message);
            return;
        }
        hideAILoading(null);
        showAILoading();
        requestConfiguredVisionAI(salaryImageRecognitionPrompt(), base64, function(requestError, reply) {
            hideAILoading(null);
            if (requestError) {
                toast('工资表识别失败：' + (requestError.message || '请稍后重试'));
                return;
            }
            try {
                _salaryImageImportState = normalizeSalaryImageRecognition(reply);
                showSalaryImageReview();
            } catch (error) {
                _salaryImageImportState = null;
                toast(error.message || '无法读取工资表识别结果');
            }
        });
    });
}

function salaryImageRecognitionPrompt() {
    var fields = salaryRecognitionInputFields().map(function(field) {
        return { id: field.key, label: field.label, aliases: field.aliases || [], type: field.numeric ? 'number' : 'text' };
    });
    return '你是工资表 OCR 助手。识别图片中的月份、表头、员工姓名/部门/职务/卡号和工资数值，以便与系统中已有员工匹配。只提取可见内容，不要推测缺失值；不要计算工资、创建员工或补造字段。\n'
        + '可用工资字段（只能返回其中的 id，不允许创建字段）：' + JSON.stringify(fields) + '\n'
        + '请只返回 JSON，格式：{"period":"YYYY-MM 或空字符串","columns":[{"header":"图片原表头","fieldId":"匹配的字段 id 或空字符串","confidence":0到1}],"rows":[{"values":[{"value":"单元格原文或空字符串","confidence":0到1}]}]}。'
        + '每行 values 的顺序必须与 columns 完全一致。无法确认映射时 fieldId 留空；看不清的单元格 value 留空且 confidence 低于 0.5。月份无法识别时 period 留空。当前页面月份是 ' + _salaryPeriod + '。';
}

function salaryImageNormalizeMonth(value) {
    var text = String(value || '').trim();
    var match = text.match(/(20\d{2})\s*(?:年|[-/.])\s*(\d{1,2})/);
    if (!match) return '';
    var month = Number(match[2]);
    return month >= 1 && month <= 12 ? match[1] + '-' + String(month).padStart(2, '0') : '';
}

function salaryImageConfidence(value) {
    var confidence = Number(value);
    if (!Number.isFinite(confidence)) return 0;
    if (confidence > 1 && confidence <= 100) confidence /= 100;
    return Math.max(0, Math.min(1, confidence));
}

function salaryRecognitionCardKey() {
    var cardField = salaryInputFields(true).find(function(field) {
        return field.key === 'bankCard' || field.label === '卡号' || (field.aliases || []).indexOf('卡号') >= 0;
    });
    return cardField ? cardField.key : 'bankCard';
}

function salaryRecognitionIdentityKeys() {
    return ['employee', 'department', 'position', salaryRecognitionCardKey()];
}

function salaryRecognitionInputFields() {
    var identityKeys = salaryRecognitionIdentityKeys();
    return salaryInputFields(true).filter(function(field) {
        return field.numeric || identityKeys.indexOf(field.key) >= 0;
    });
}

function salaryRecognitionWritableFields() {
    var identityKeys = salaryRecognitionIdentityKeys();
    return salaryNumericFields(true).filter(function(field) {
        return identityKeys.indexOf(field.key) < 0;
    });
}

function salaryRecognitionText(value) {
    return String(value == null ? '' : value).replace(/\s+/g, '').trim().toLowerCase();
}

function salaryRecognitionEmployeeLabel(row) {
    return [row.employee, row.department, row.position, row[salaryRecognitionCardKey()]]
        .map(function(value) { return String(value || '').trim(); })
        .filter(Boolean).join(' · ');
}

function salaryRecognitionIdentityForRow(state, rowIndex) {
    var identity = {};
    var identityKeys = salaryRecognitionIdentityKeys();
    (state.columns || []).forEach(function(column, columnIndex) {
        if (identityKeys.indexOf(column.fieldId) < 0) return;
        var cell = state.rows[rowIndex] && state.rows[rowIndex][columnIndex];
        identity[column.fieldId] = String(cell && cell.value != null ? cell.value : '').trim();
    });
    return identity;
}

function salaryRecognitionMatchKey(row) {
    var identityKeys = ['employee', 'department', 'position'];
    if (!row || identityKeys.some(function(key) { return !Object.prototype.hasOwnProperty.call(row, key); })) return '';
    return identityKeys.map(function(key) { return salaryRecognitionText(row[key]); }).join('\u0000');
}

function salaryRecognitionFindMatch(identity, rows) {
    var cardKey = salaryRecognitionCardKey();
    var incomingCard = String(identity[cardKey] || '').trim();
    if (incomingCard) {
        var cardMatches = rows.filter(function(row) {
            var existingCard = String(row[cardKey] || '').trim();
            return existingCard && salaryRecognitionText(existingCard) === salaryRecognitionText(incomingCard);
        });
        if (cardMatches.length === 1) return { status: 'matched', employeeId: cardMatches[0].id, reason: '按卡号匹配' };
        if (cardMatches.length > 1) return { status: 'pending', reason: '多个员工使用相同卡号' };
    }
    var key = salaryRecognitionMatchKey(identity);
    if (!key) return { status: 'pending', reason: '需要姓名、部门和职务才能自动匹配' };
    var identityMatches = rows.filter(function(row) { return salaryRecognitionMatchKey(row) === key; });
    if (incomingCard) {
        if (identityMatches.length === 1 && !String(identityMatches[0][cardKey] || '').trim()) {
            return { status: 'matched', employeeId: identityMatches[0].id, reason: '原员工未填写卡号，按姓名、部门和职务匹配' };
        }
        if (identityMatches.length) return { status: 'pending', reason: '卡号与同名员工不一致，请核对' };
        return { status: 'pending', reason: '未匹配到已有员工' };
    }
    if (identityMatches.length === 1) return { status: 'matched', employeeId: identityMatches[0].id, reason: '按姓名、部门和职务匹配' };
    if (identityMatches.length > 1) return { status: 'pending', reason: '存在多名相同姓名、部门和职务的员工' };
    return { status: 'pending', reason: '未匹配到已有员工' };
}

function salaryRecognitionRefreshMatches() {
    var state = _salaryImageImportState;
    if (!state) return [];
    var oldMatches = state.matches || [];
    var existingRows = _salaryTableData.filter(function(row) { return !!String(row.employee || '').trim(); });
    var reserved = {};
    state.matches = state.rows.map(function(row, rowIndex) {
        var previous = oldMatches[rowIndex];
        var match;
        if (previous && previous.manual) {
            match = Object.assign({}, previous);
            if (match.status === 'matched' && !existingRows.some(function(existing) { return String(existing.id) === String(match.employeeId); })) {
                match = { status: 'pending', reason: '所选员工已不在当前月份名单中', manual: true };
            }
        } else {
            match = salaryRecognitionFindMatch(salaryRecognitionIdentityForRow(state, rowIndex), existingRows);
        }
        if (match.status === 'matched') {
            var id = String(match.employeeId || '');
            if (!id || reserved[id]) return { status: 'pending', reason: '多条识别记录指向同一员工，请核对', manual: !!match.manual };
            reserved[id] = true;
        }
        return match;
    });
    return state.matches;
}

function salaryRecognitionMatchChanged(select, rowIndex) {
    if (!_salaryImageImportState || !_salaryImageImportState.rows[rowIndex]) return;
    var value = select.value;
    if (value === '__skip') {
        _salaryImageImportState.matches[rowIndex] = { status: 'skipped', reason: '已选择跳过', manual: true };
    } else if (value === '__add_new') {
        _salaryImageImportState.matches[rowIndex] = { status: 'new_employee', reason: '最终确认后添加到当前月份', manual: true };
    } else if (value) {
        _salaryImageImportState.matches[rowIndex] = { status: 'matched', employeeId: value, reason: '手动匹配到现有员工', manual: true };
    } else {
        _salaryImageImportState.matches[rowIndex] = { status: 'pending', reason: '请选择已有员工、添加当前员工或跳过本行', manual: true };
    }
    updateSalaryImageReviewStatus();
}

function salaryImageResolveField(name) {
    var normalized = String(name || '').replace(/\s+/g, '').toLowerCase();
    if (!normalized) return null;
    return salaryRecognitionInputFields().find(function(field) {
        return [field.key, field.label].concat(field.aliases || []).some(function(value) {
            return String(value || '').replace(/\s+/g, '').toLowerCase() === normalized;
        });
    }) || null;
}

function normalizeSalaryImageRecognition(reply) {
    var text = String(reply || '').trim();
    var fenced = text.match(/```(?:json)?\s*([\s\S]*?)```/i);
    if (fenced) text = fenced[1].trim();
    else {
        var first = text.indexOf('{'), last = text.lastIndexOf('}');
        if (first >= 0 && last > first) text = text.slice(first, last + 1);
    }
    var result;
    try { result = JSON.parse(text); } catch (error) { throw new Error('AI 返回格式无法解析，请换一张更清晰的图片重试'); }
    if (!result || typeof result !== 'object') throw new Error('AI 返回内容不是有效的工资表数据');
    var rawColumns = Array.isArray(result.columns) ? result.columns : [];
    var columns = rawColumns.map(function(column, index) {
        if (typeof column === 'string') column = { header: column };
        column = column || {};
        var header = String(column.header || column.name || '第 ' + (index + 1) + ' 列').trim();
        var field = salaryRecognitionInputFields().find(function(item) { return item.key === String(column.fieldId || column.field || ''); })
            || salaryImageResolveField(header);
        return { header: header, fieldId: field ? field.key : '', confidence: salaryImageConfidence(column.confidence) };
    });
    var rawRows = Array.isArray(result.rows) ? result.rows : (Array.isArray(result.employees) ? result.employees : []);
    if (!columns.length && rawRows.length && rawRows[0] && !Array.isArray(rawRows[0].values)) {
        var firstRow = rawRows[0];
        Object.keys(firstRow).forEach(function(key) {
            if (key !== 'confidence' && key !== 'confidences') {
                var field = salaryImageResolveField(key);
                columns.push({ header: key, fieldId: field ? field.key : '', confidence: 0 });
            }
        });
    }
    if (!columns.length || !rawRows.length) throw new Error('没有识别到工资表表头或员工数据');
    var rows = rawRows.map(function(row) {
        row = row || {};
        var rawValues = Array.isArray(row) ? row : (Array.isArray(row.values) ? row.values : (Array.isArray(row.cells) ? row.cells : null));
        return columns.map(function(column, index) {
            var cell = rawValues ? rawValues[index] : row[column.header];
            if (!rawValues && cell === undefined && column.fieldId) cell = row[column.fieldId];
            var value = cell && typeof cell === 'object' ? (cell.value !== undefined ? cell.value : cell.text) : cell;
            var cellConfidence = cell && typeof cell === 'object' ? cell.confidence : null;
            if (cellConfidence === null || cellConfidence === undefined) {
                var confidenceList = row && row.confidences;
                cellConfidence = confidenceList && confidenceList[index] !== undefined ? confidenceList[index] : column.confidence;
            }
            return { value: value == null ? '' : String(value).trim(), confidence: salaryImageConfidence(cellConfidence), low: salaryImageConfidence(cellConfidence) < 0.7 };
        });
    });
    return {
        source: 'image',
        period: salaryImageNormalizeMonth(result.period || result.month),
        columns: columns,
        rows: rows,
        periodChoice: ''
    };
}

function salaryImageMappingError() {
    var state = _salaryImageImportState;
    if (!state) return '没有可核对的工资表识别结果';
    salaryRecognitionRefreshMatches();
    var used = {};
    var fields = {};
    salaryRecognitionInputFields().forEach(function(field) { fields[field.key] = field; });
    var writableColumnCount = 0;
    for (var i = 0; i < state.columns.length; i++) {
        var key = state.columns[i].fieldId;
        if (!key) return '请为每个未匹配列选择一个字段，或选择“跳过”';
        if (key === '__skip') continue;
        if (!fields[key]) return '识别列“' + state.columns[i].header + '”不是可用于匹配或工资填入的字段，请重新映射或跳过';
        if (used[key]) return '同一个字段不能映射多个识别列';
        used[key] = true;
        if (fields[key].numeric && salaryRecognitionWritableFields().some(function(field) { return field.key === key; })) writableColumnCount++;
    }
    if (!writableColumnCount) return '请至少映射一个已配置的工资数值字段';
    if (state.period && state.period !== _salaryPeriod && !state.periodChoice) return '请先选择填入当前月份，或切换到识别出的月份';
    for (var rowIndex = 0; rowIndex < state.rows.length; rowIndex++) {
        var match = state.matches[rowIndex];
        if (match && match.status === 'skipped') continue;
        if (match && match.status === 'new_employee') {
            var identity = salaryRecognitionIdentityForRow(state, rowIndex);
            if (!String(identity.employee || '').trim()) return '第 ' + (rowIndex + 1) + ' 行：请将员工姓名列映射到“姓名”后再添加当前员工';
            continue;
        }
        if (!match || match.status !== 'matched') return '第 ' + (rowIndex + 1) + ' 行：' + ((match && match.reason) || '请选择已有员工、添加当前员工或跳过本行');
    }
    for (var columnIndex = 0; columnIndex < state.columns.length; columnIndex++) {
        var field = fields[state.columns[columnIndex].fieldId];
        if (!field || !field.numeric || !salaryRecognitionWritableFields().some(function(item) { return item.key === field.key; })) continue;
        for (var numericRowIndex = 0; numericRowIndex < state.rows.length; numericRowIndex++) {
            var numericMatch = state.matches[numericRowIndex];
            if (numericMatch && numericMatch.status === 'skipped') continue;
            var cell = state.rows[numericRowIndex][columnIndex] || { value: '', low: true };
            var text = String(cell.value == null ? '' : cell.value).trim();
            if (text && !salaryImageNumericIsValid(text)) return '第 ' + (numericRowIndex + 1) + ' 行的“' + field.label + '”不是有效数字，请修改标红单元格';
        }
    }
    return '';
}

function salaryImageNumericIsValid(value) {
    var text = String(value == null ? '' : value).trim();
    if (!text) return true;
    return Number.isFinite(Number(text.replace(/[\s,，￥¥元%]/g, '')));
}

function salaryImageMappingChanged(select, index) {
    if (!_salaryImageImportState || !_salaryImageImportState.columns[index]) return;
    _salaryImageImportState.columns[index].fieldId = select.value;
    salaryRecognitionRefreshMatches();
    updateSalaryImageReviewStatus();
}

function salaryImageCellChanged(input) {
    var state = _salaryImageImportState;
    if (!state) return;
    var rowIndex = Number(input.dataset.row), columnIndex = Number(input.dataset.column);
    if (!state.rows[rowIndex] || !state.rows[rowIndex][columnIndex]) return;
    state.rows[rowIndex][columnIndex].value = input.value;
    state.rows[rowIndex][columnIndex].low = false;
    input.classList.remove('is-low-confidence');
    input.title = '已手动核对';
    salaryRecognitionRefreshMatches();
    updateSalaryImageReviewStatus();
}

function salaryImageChoosePeriod(choice) {
    var state = _salaryImageImportState;
    if (!state) return;
    state.periodChoice = choice;
    if (choice === 'source' && state.period && state.period !== _salaryPeriod) changeSalaryPeriod(state.period);
    salaryRecognitionRefreshMatches();
    showSalaryImageReview();
}

function updateSalaryImageReviewStatus() {
    salaryRecognitionRefreshMatches();
    var error = salaryImageMappingError();
    var status = $id('salaryImageReviewStatus');
    var actions = document.querySelectorAll('.salary-recognition-apply');
    var state = _salaryImageImportState;
    document.querySelectorAll('.salary-image-cell').forEach(function(input) {
        if (!state) return;
        var rowIndex = Number(input.dataset.row), columnIndex = Number(input.dataset.column);
        var column = state.columns[columnIndex];
        var field = column && salaryRecognitionInputFields().find(function(item) { return item.key === column.fieldId; });
        var cell = state.rows[rowIndex] && state.rows[rowIndex][columnIndex];
        var rowMatch = state.matches[rowIndex];
        var invalid = !!(rowMatch && rowMatch.status !== 'skipped' && field && field.numeric
            && salaryRecognitionWritableFields().some(function(item) { return item.key === field.key; })
            && cell && !salaryImageNumericIsValid(cell.value));
        input.classList.toggle('is-invalid', invalid);
        if (invalid) input.title = '数字格式无效，请修改';
        else if (cell && cell.low) input.title = 'AI 标记为低置信度，请核对';
        else input.title = '已手动核对';
    });
    document.querySelectorAll('.salary-recognition-match').forEach(function(select) {
        if (!state) return;
        var rowIndex = Number(select.dataset.row);
        var match = state.matches[rowIndex];
        var selectedId = match && match.status === 'skipped' ? '__skip'
            : match && match.status === 'new_employee' ? '__add_new'
                : (match && match.employeeId ? String(match.employeeId) : '');
        if (select.value !== selectedId) select.value = selectedId;
        var reason = select.parentNode && select.parentNode.querySelector('small');
        if (reason) reason.textContent = match && match.reason || '';
    });
    if (status) {
        var matches = state ? state.matches : [];
        var matchedCount = matches.filter(function(match) { return match.status === 'matched'; }).length;
        var newEmployeeCount = matches.filter(function(match) { return match.status === 'new_employee'; }).length;
        var pendingCount = matches.filter(function(match) { return match.status === 'pending'; }).length;
        var skippedCount = matches.filter(function(match) { return match.status === 'skipped'; }).length;
        var summary = '更新现有员工 ' + matchedCount + ' 行，待添加 ' + newEmployeeCount + ' 人，待核对 ' + pendingCount + ' 行，跳过 ' + skippedCount + ' 行。';
        status.textContent = summary + (error ? error : '确认后才会写入本月草稿；之后仍需手动保存工资。');
        status.classList.toggle('is-error', !!error);
        document.querySelectorAll('.salary-recognition-apply').forEach(function(button) {
            button.textContent = newEmployeeCount ? '确认填入并添加 ' + newEmployeeCount + ' 位员工' : '填入工资数据';
        });
    }
    actions.forEach(function(button) { button.disabled = !!error; });
}

function showSalaryImageReview() {
    var state = _salaryImageImportState;
    if (!state) return;
    var fields = salaryRecognitionInputFields();
    salaryRecognitionRefreshMatches();
    var mismatch = !!(state.period && state.period !== _salaryPeriod);
    if (!state.period) state.periodChoice = 'current';
    else if (!mismatch) state.periodChoice = 'current';
    var sourceLabel = state.source === 'excel' ? 'Excel 工资表' : '工资表图片';
    var h = '<div class="salary-image-review"><h3>核对' + sourceLabel + '识别结果</h3>';
    h += '<p class="salary-move-copy">共识别 ' + state.rows.length + ' 行。请核对工资数值和对应员工；未匹配行可选择现有员工、跳过，或标记为添加当前员工。橙色单元格为 AI 标记的低置信度内容。</p>';
    if (mismatch) {
        h += '<div class="salary-image-month-warning"><strong>图片月份为 ' + salaryEscape(state.period) + '，当前页面为 ' + salaryEscape(_salaryPeriod) + '</strong>';
        h += '<div><button type="button" class="btn s" onclick="salaryImageChoosePeriod(\'current\')">填入当前月份</button>';
        h += '<button type="button" class="btn s" onclick="salaryImageChoosePeriod(\'source\')">切换到 ' + salaryEscape(state.period) + '</button></div></div>';
    } else if (!state.period) {
        h += '<p class="salary-image-month-note">未识别到表格月份，将填入当前页面的 ' + salaryEscape(_salaryPeriod) + '。</p>';
    }
    h += '<div class="salary-image-review-wrap"><table class="salary-image-review-table"><thead><tr><th>行</th><th class="salary-recognition-match-head">对应员工</th>';
    state.columns.forEach(function(column, columnIndex) {
        h += '<th><div class="salary-image-column-head"><strong>' + salaryEscape(column.header) + '</strong><select class="inp salary-image-field-map" onchange="salaryImageMappingChanged(this,' + columnIndex + ')"><option value="">选择字段…</option><option value="__skip"' + (column.fieldId === '__skip' ? ' selected' : '') + '>跳过此列</option>';
        fields.forEach(function(field) {
            h += '<option value="' + salaryEscape(field.key) + '"' + (column.fieldId === field.key ? ' selected' : '') + '>' + salaryEscape(field.label) + '</option>';
        });
        h += '</select></div></th>';
    });
    h += '</tr></thead><tbody>';
    state.rows.forEach(function(row, rowIndex) {
        var match = state.matches[rowIndex] || { status: 'pending', reason: '请选择已有员工、添加当前员工或跳过本行' };
        var selectedId = match.status === 'skipped' ? '__skip'
            : match.status === 'new_employee' ? '__add_new'
                : (match.employeeId || '');
        h += '<tr><th>' + (rowIndex + 1) + '</th><td class="salary-recognition-match-cell"><select class="inp salary-recognition-match" data-row="' + rowIndex + '" aria-label="第 ' + (rowIndex + 1) + ' 行的员工处理方式" onchange="salaryRecognitionMatchChanged(this,' + rowIndex + ')">';
        h += '<option value=""' + (!selectedId ? ' selected' : '') + '>选择员工…</option>';
        h += '<option value="__add_new"' + (selectedId === '__add_new' ? ' selected' : '') + '>添加当前员工（确认后加入）</option>';
        h += '<option value="__skip"' + (selectedId === '__skip' ? ' selected' : '') + '>跳过本行</option>';
        _salaryTableData.filter(function(employee) { return !!String(employee.employee || '').trim(); }).forEach(function(employee) {
            h += '<option value="' + salaryEscape(employee.id) + '"' + (String(selectedId) === String(employee.id) ? ' selected' : '') + '>' + salaryEscape(salaryRecognitionEmployeeLabel(employee)) + '</option>';
        });
        h += '</select><small>' + salaryEscape(match.reason || '') + '</small></td>';
        state.columns.forEach(function(column, columnIndex) {
            var cell = row[columnIndex] || { value: '', low: true };
            h += '<td><input type="text" class="inp salary-image-cell' + (cell.low ? ' is-low-confidence' : '') + '" value="' + salaryEscape(cell.value) + '" data-row="' + rowIndex + '" data-column="' + columnIndex + '" title="' + (cell.low ? 'AI 标记为低置信度，请核对' : '点击编辑') + '" oninput="salaryImageCellChanged(this)"></td>';
        });
        h += '</tr>';
    });
    h += '</tbody></table></div><div id="salaryImageReviewStatus" class="salary-image-review-status"></div>';
    h += '<div class="salary-template-footer split"><button type="button" class="btn" onclick="closeModal();_salaryImageImportState=null">取消</button>';
    h += '<button type="button" class="btn d salary-recognition-apply" onclick="confirmSalaryImageRecognition()">填入工资数据</button></div></div>';
    showModal(h, 980);
    updateSalaryImageReviewStatus();
}

function salaryImageNumberValue(value, field, rowIndex) {
    var text = String(value == null ? '' : value).trim();
    if (!text) return null;
    var number = Number(text.replace(/[\s,，￥¥元%]/g, ''));
    if (!Number.isFinite(number)) throw new Error('第 ' + (rowIndex + 1) + ' 行的“' + field.label + '”不是有效数字，请先修正');
    return number;
}

function confirmSalaryImageRecognition() {
    var state = _salaryImageImportState;
    var mappingError = salaryImageMappingError();
    if (!state || mappingError) { toast(mappingError || '没有可核对的识别结果'); return; }
    var fieldsByKey = {};
    salaryRecognitionInputFields().forEach(function(field) { fieldsByKey[field.key] = field; });
    var writableColumns = state.columns.map(function(column, index) {
        return { field: fieldsByKey[column.fieldId], index: index };
    }).filter(function(column) {
        return column.field && column.field.numeric
            && salaryRecognitionWritableFields().some(function(field) { return field.key === column.field.key; });
    });
    var rows = cloneSalaryRows(_salaryTableData);
    var matchedCount = 0, addedCount = 0, writtenCount = 0, skippedCount = 0;
    try {
        state.rows.forEach(function(sourceRow, rowIndex) {
            var match = state.matches[rowIndex];
            if (!match || match.status === 'skipped') { skippedCount++; return; }
            var target;
            if (match.status === 'new_employee') {
                var identity = salaryRecognitionIdentityForRow(state, rowIndex);
                var employeeName = String(identity.employee || '').trim();
                if (!employeeName) throw new Error('第 ' + (rowIndex + 1) + ' 行缺少员工姓名，无法添加当前员工');
                target = createSalaryEmptyRow();
                target.employee = employeeName;
                target.department = String(identity.department || '').trim();
                target.position = String(identity.position || '').trim();
                var cardKey = salaryRecognitionCardKey();
                target[cardKey] = String(identity[cardKey] || '').trim();
                target._salaryRecognitionAdded = true;
                rows.push(target);
                addedCount++;
            } else {
                if (match.status !== 'matched') throw new Error('第 ' + (rowIndex + 1) + ' 行尚未匹配到员工');
                target = rows.find(function(row) { return String(row.id) === String(match.employeeId); });
                if (!target) throw new Error('第 ' + (rowIndex + 1) + ' 行对应的员工已不在当前月份，请重新核对');
                matchedCount++;
            }
            writableColumns.forEach(function(column) {
                var cell = sourceRow[column.index] || { value: '' };
                var number = salaryImageNumberValue(cell.value, column.field, rowIndex);
                if (number === null) return;
                target[column.field.key] = number;
                writtenCount++;
            });
        });
    } catch (error) { toast(error.message || '请检查识别内容'); return; }
    if (!writtenCount && !addedCount) {
        toast(skippedCount === state.rows.length ? '所有行都已跳过，没有修改工资数据' : '没有可写入的工资数值');
        return;
    }
    _salaryTableData = rows;
    _salaryImageImportState = null;
    cacheSalaryDraft();
    renderSalaryTable();
    closeModal();
    toast('已更新现有员工 ' + matchedCount + ' 位，添加 ' + addedCount + ' 位，跳过 ' + skippedCount + ' 行；请检查后手动保存工资');
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
            var matrix = XLSX.utils.sheet_to_json(sheet, { header: 1, raw: false, defval: '' });
            prepareSalaryExcelImport(salaryExcelMatrixToObjects(matrix, sheet));
        } catch (err) {
            console.error('Excel parse error:', err);
            toast('Excel 工资表识别失败');
        }
    };
    reader.readAsArrayBuffer(file);
    event.target.value = '';
}

function salaryExcelMatrixToObjects(matrix, sheet) {
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
    var departmentColumn = headers.findIndex(function(header) {
        return ['部门', 'department'].indexOf(String(header || '').toLowerCase()) >= 0;
    });
    var merges = sheet && Array.isArray(sheet['!merges']) ? sheet['!merges'] : [];
    return matrix.slice(startRow).map(function(values, rowOffset) {
        var sourceRowIndex = startRow + rowOffset;
        var row = {};
        headers.forEach(function(header, index) {
            if (header) row[header] = values[index];
        });
        if (departmentColumn >= 0 && (row['部门'] === '' || row['部门'] == null) && (row.department === '' || row.department == null)) {
            var departmentMerge = merges.find(function(merge) {
                return merge.s.r <= sourceRowIndex && merge.e.r >= sourceRowIndex
                    && merge.s.c <= departmentColumn && merge.e.c >= departmentColumn;
            });
            if (departmentMerge) {
                var mergeStartRow = matrix[departmentMerge.s.r] || [];
                var departmentValue = mergeStartRow[departmentMerge.s.c];
                if (departmentValue !== '' && departmentValue != null) row[headers[departmentColumn]] = departmentValue;
            }
        }
        row.__sourceRow = sourceRowIndex + 1;
        return row;
    }).filter(function(row) {
        return Object.keys(row).some(function(key) { return key !== '__sourceRow' && row[key] !== '' && row[key] !== null && row[key] !== undefined; });
    });
}

function salaryRowsFromExcel(jsonData) {
    var nameHeader = null;
    (jsonData || []).some(function(row) {
        nameHeader = Object.keys(row || {}).find(function(header) {
            var field = salaryImageResolveField(header);
            return field && field.key === 'employee';
        }) || nameHeader;
        return !!nameHeader;
    });
    return (jsonData || []).filter(function(row) {
        return nameHeader && String(row[nameHeader] == null ? '' : row[nameHeader]).trim();
    }).map(function(row) {
        var clean = {};
        Object.keys(row || {}).forEach(function(header) {
            if (header !== '__sourceRow') clean[header] = row[header];
        });
        clean.__sourceRow = row.__sourceRow;
        return clean;
    });
}

function prepareSalaryExcelImport(jsonData) {
    _salaryImageImportState = null;
    var recognizedRows = salaryRowsFromExcel(jsonData);
    if (!recognizedRows.length) {
        toast('没有识别到含姓名的工资数据');
        return;
    }
    var headers = [];
    recognizedRows.forEach(function(row) {
        Object.keys(row).forEach(function(header) {
            if (header !== '__sourceRow' && headers.indexOf(header) < 0) headers.push(header);
        });
    });
    _salaryImageImportState = {
        source: 'excel',
        period: '',
        periodChoice: 'current',
        columns: headers.map(function(header) {
            var field = salaryImageResolveField(header);
            return { header: header, fieldId: field ? field.key : '', confidence: 1 };
        }),
        rows: recognizedRows.map(function(row) {
            return headers.map(function(header) {
                var value = row[header];
                return { value: value == null ? '' : String(value).trim(), confidence: 1, low: false };
            });
        }),
        matches: []
    };
    salaryRecognitionRefreshMatches();
    showSalaryImageReview();
}

function confirmSalaryExcelImport() {
    if (!_salaryImageImportState || _salaryImageImportState.source !== 'excel') return;
    confirmSalaryImageRecognition();
}

// 保留旧入口兼容调用；现在只打开核对流程，不直接写入或重建员工行。
function parseSalaryExcelData(jsonData) {
    prepareSalaryExcelImport(jsonData);
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
        { id: 'dash',     icon: 'dashboard', label: '总览' }
    ];
    if (isModuleEnabled('daily')) mainPages.push({ id: 'daily', icon: 'notebook', label: '日报' });
    if (isModuleEnabled('purchase')) mainPages.push({ id: 'purchase', icon: 'basket', label: '采购' });
    if (isModuleEnabled('expense')) mainPages.push({ id: 'expense', icon: 'receipt', label: '费用' });
    if (isModuleEnabled('salary')) mainPages.push({ id: 'salary', icon: 'wallet', label: '工资' });

    // 库存类型由账号配置定义；旧类型和历史自定义分类也有稳定 ID。
    var invPages = [];
    var config = getAppConfig();
    (config.inventoryTypeDefinitions || []).forEach(function(type) {
        if (type.archived || type.deleted) return;
        if (type.preset === 'other') return;
        var icon = { tea: 'leaf', cig: 'package', alc: 'wine' }[type.preset] || 'gem';
        invPages.push({ id: 'inventory_type_' + type.id, icon: icon, label: type.name });
    });
    if (inventoryUnclassifiedLegacyItems().length) {
        invPages.push({ id: 'inventory_unclassified', icon: 'gem', label: '未分类' });
    }
    invPages.push({ id: 'inventory_add', icon: 'plus', label: '添加类型', action: 'showCreateInventoryType()' });

    // 仓库管理
    var whPages = [];
    if (isModuleEnabled('warehouse')) whPages.push({ id: 'wh', icon: 'warehouse', label: '仓库' });
    if (isModuleEnabled('damage')) whPages.push({ id: 'damage', icon: 'alert', label: '报损' });

    // 数据分析
    var reportPages = [];
    if (isModuleEnabled('report')) reportPages.push({ id: 'report', icon: 'chart', label: '报表' });
    if (isModuleEnabled('brief')) reportPages.push({ id: 'gen', icon: 'send', label: '汇报' });

    function renderGroup(pages, containerId, label) {
        var el = $id(containerId);
        if (!el) return;
        if (pages.length === 0) {
            el.innerHTML = '';
            el.style.display = 'none';
            return;
        }
        el.style.display = '';
        el.setAttribute('role', 'group');
        el.setAttribute('aria-label', label);
        el.innerHTML = pages.map(function(p) {
            return '<button type="button" class="toolbar-btn' + (p.action ? ' toolbar-btn-action' : '') + '" data-page="' + p.id + '" onclick="' + (p.action || ('goPage(\'' + p.id + '\')')) + '" title="' + inventoryHtml(p.label) + '" aria-label="' + inventoryHtml(p.label) + '">' +
                '<span class="ticon">' + axIcon(p.icon, 'ax-icon--nav') + '</span>' +
                '<span class="tlabel">' + inventoryHtml(p.id === 'inventory_add' ? '添加' : p.label) + '</span>' +
                '</button>';
        }).join('');
    }

    renderGroup(mainPages, 'toolbarMain', '日常经营');
    renderGroup(invPages, 'toolbarInv', '物品库存');
    renderGroup(whPages, 'toolbarWh', '仓库管理');
    renderGroup(reportPages, 'toolbarReport', '数据分析');
    $id('toolbar').setAttribute('aria-label', '主导航');
    $id('toolbar').setAttribute('role', 'navigation');
    $id('toolbar').inert = window.innerWidth <= 768 && !$id('toolbar').classList.contains('open');
    $id('hamburger').setAttribute('aria-controls', 'toolbar');
    $id('hamburger').setAttribute('aria-expanded', $id('toolbar').classList.contains('open') ? 'true' : 'false');

    var currentPage = localStorage.getItem('ax_lastPage') || _curPage || 'dash';
    document.querySelectorAll('.toolbar-btn').forEach(function(button) {
        button.classList.toggle('active', button.dataset.page === currentPage);
        if (button.dataset.page === currentPage) button.setAttribute('aria-current', 'page');
        else button.removeAttribute('aria-current');
    });
}

// 切换高亮
function switchNav(btn) {
    document.querySelectorAll('.toolbar-btn').forEach(function(b) {
        b.classList.remove('active');
    });
    btn.classList.add('active');
}

// 切换侧边栏展开/收起
function toggleToolbar() {
    setToolbarOpen(!$id('toolbar').classList.contains('open'), true);
}

function setToolbarOpen(open, restoreFocus) {
    var toolbar = $id('toolbar');
    var mask = $id('toolbarMask');
    if (!toolbar || !mask) return;
    toolbar.classList.toggle('open', open);
    toolbar.inert = window.innerWidth <= 768 && !open;
    mask.classList.toggle('open', open);
    document.body.style.overflow = open ? 'hidden' : '';
    var trigger = $id('hamburger');
    if (trigger) {
        trigger.setAttribute('aria-expanded', open ? 'true' : 'false');
        trigger.setAttribute('aria-label', open ? '关闭导航菜单' : '打开导航菜单');
    }
    if (open) {
        var selected = toolbar.querySelector('.toolbar-btn.active') || toolbar.querySelector('.toolbar-btn');
        if (selected) selected.focus();
    } else if (restoreFocus && trigger) trigger.focus();
}

document.addEventListener('keydown', function(event) {
    var toolbar = $id('toolbar');
    if (!toolbar || !toolbar.classList.contains('open')) return;
    if ($id('modal') && $id('modal').classList.contains('show')) return;
    if (event.key === 'Escape') { event.preventDefault(); setToolbarOpen(false, true); }
    if (event.key !== 'Tab') return;
    var buttons = Array.from(toolbar.querySelectorAll('button')).filter(function(button) { return button.getClientRects().length && !button.disabled; });
    if (!buttons.length) return;
    var first = buttons[0], last = buttons[buttons.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
});

if (typeof window.addEventListener === 'function') window.addEventListener('resize', function() {
    if (window.innerWidth > 768 && $id('toolbar') && $id('toolbar').classList.contains('open')) setToolbarOpen(false, false);
    if ($id('toolbar')) $id('toolbar').inert = window.innerWidth <= 768 && !$id('toolbar').classList.contains('open');
});

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


