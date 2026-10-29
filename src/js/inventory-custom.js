// 账号自定义库存类型。旧四类由原库存页继续处理，新类型使用统一流水。
var _inventoryCustomMonth = curYM();
var INVENTORY_ACTION_LABELS = { add: '添加物品', inbound: '入库', sale: '销售', return: '退货', adjust: '盘点调整', loss: '报损' };

function inventoryHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function(char) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
}

function inventoryTypeDefinitions() {
    return getAppConfig().inventoryTypeDefinitions || [];
}

function inventoryTypeById(id) {
    return inventoryTypeDefinitions().find(function(type) { return type.id === id && !type.deleted; });
}

function inventoryUnclassifiedLegacyItems() {
    var items = typeof DB !== 'undefined' && DB && Array.isArray(DB.otherItems) ? DB.otherItems : [];
    var categories = inventoryTypeDefinitions().filter(function(type) {
        return type && type.preset === 'other-category';
    }).map(function(type) {
        return String(type.legacyCategory || type.name || '');
    }).filter(Boolean);

    return items.filter(function(item) {
        var category = String(item && item.category || '');
        return !category || categories.indexOf(category) < 0;
    });
}

function inventoryOperationEnabled(id, action) {
    var type = inventoryTypeById(id);
    return !!(type && !type.archived && type.actions && type.actions[action]);
}

function inventoryCurrentLegacyType(type) {
    if (_curPage && _curPage.indexOf('inventory_type_') === 0) {
        var current = inventoryTypeById(_curPage.slice('inventory_type_'.length));
        if (current && (current.preset === type || (type === 'other' && current.preset === 'other-category'))) return current;
    }
    if (type === 'other' && _curPage && _curPage.indexOf('custom_') === 0) {
        var legacyName = _curPage.slice('custom_'.length);
        var legacyType = inventoryTypeDefinitions().find(function(entry) { return entry.preset === 'other-category' && entry.legacyCategory === legacyName && !entry.deleted; });
        if (legacyType) return legacyType;
    }
    return inventoryTypeById(type);
}

function inventoryLegacySaleEnabled(type, item) {
    return inventoryLegacyActionEnabled(type, item, 'sale');
}

function inventoryLegacyDailyInputEnabled(type, item) {
    if (!inventoryLegacySaleEnabled(type, item)) return false;
    var root = inventoryTypeById(type);
    if (!root || !root.dailyLink || root.archived) return false;
    if (type === 'other' && item && item.category) {
        var category = inventoryTypeDefinitions().find(function(entry) { return entry.preset === 'other-category' && entry.legacyCategory === item.category && !entry.deleted; });
        if (category && (!category.dailyLink || category.archived)) return false;
    }
    return true;
}

function inventoryLegacyActionEnabled(type, item, action) {
    var definition = type === 'other' && item && item.category
        ? inventoryTypeDefinitions().find(function(entry) { return entry.preset === 'other-category' && entry.legacyCategory === item.category && !entry.deleted; })
        : inventoryTypeById(type);
    return !definition || inventoryOperationEnabled(definition.id, action);
}

function inventorySaveTypeDefinitions(types) {
    if (typeof requireAuth === 'function' && !requireAuth()) return false;
    saveAppConfig({ inventoryTypeDefinitions: types });
    renderNav();
    return true;
}

function inventoryTypeItems(typeId) {
    return (DB.inventoryCustomItems || []).filter(function(item) { return item.typeId === typeId; });
}

function inventoryTypeDataCount(type) {
    if (type.preset === 'generic') return inventoryTypeItems(type.id).length;
    if (type.preset === 'other' && (DB.exchangeRecords || []).length) return 1;
    var legacySales = (DB.dailyReports || []).some(function(report) {
        var salesKey = { tea: 'teaSales', cig: 'cigSales', alc: 'alcSales', other: 'otherSales', 'other-category': 'otherSales' }[type.preset];
        var sales = report[salesKey] || {};
        if (type.preset !== 'other-category') return Object.keys(sales).length > 0;
        return (DB.otherItems || []).some(function(item) { return item.category === type.legacyCategory && sales[item.id]; });
    });
    if (legacySales) return 1;
    if (type.preset === 'other-category') return (DB.otherItems || []).filter(function(item) {
        return item.category === type.legacyCategory;
    }).length;
    var legacy = INV[type.preset];
    return legacy ? (DB[legacy.key] || []).length : 0;
}

function showInventoryTypeManager() {
    var h = '<h3>库存类型</h3><p class="inventory-help">按账号保存。归档后从侧边栏隐藏，历史数据仍可查看和恢复。</p>';
    h += '<div class="inventory-type-list">';
    inventoryTypeDefinitions().filter(function(type) { return !type.deleted; }).forEach(function(type) {
        h += '<div class="inventory-type-list-row"><div><strong>' + inventoryHtml(type.name) + '</strong>';
        h += type.archived ? '<span class="inventory-muted"> · 已归档</span>' : '';
        h += '</div><button type="button" class="btn s" onclick="editInventoryType(\'' + type.id + '\')">设置</button></div>';
    });
    h += '</div><div class="brow"><button type="button" class="btn p" onclick="showCreateInventoryType()">添加类型</button>';
    h += '<button type="button" class="btn" onclick="closeModal()">关闭</button></div>';
    showModal(h);
}

function showCreateInventoryType() {
    var h = '<h3>添加库存类型</h3>';
    h += '<div class="hrow"><label for="inventoryNewTypeName">类型名称</label><input id="inventoryNewTypeName" class="inp" maxlength="30" placeholder="例如：点心"></div>';
    h += '<p class="inventory-help">创建后显示在侧边栏。默认有明细、库存两个页面；添加物品、入库和销售可用，日报联动关闭。</p>';
    h += '<div class="brow"><button type="button" class="btn p" onclick="createInventoryType()">创建</button><button type="button" class="btn" onclick="closeModal()">取消</button></div>';
    showModal(h);
    var input = $id('inventoryNewTypeName');
    if (input) input.focus();
}

function createInventoryType() {
    var name = String($id('inventoryNewTypeName').value || '').trim();
    if (!name) { toast('请输入类型名称'); return; }
    var types = inventoryTypeDefinitions();
    if (types.some(function(type) { return !type.deleted && type.name === name; })) { toast('类型名称已存在'); return; }
    var id = 'inv_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 8);
    types.push({ id: id, name: name, preset: 'generic', legacyCategory: '', archived: false, deleted: false,
        dailyLink: false, actions: { add: true, inbound: true, sale: true, return: true, adjust: false, loss: false } });
    if (!inventorySaveTypeDefinitions(types)) return;
    closeModal();
    goPage('inventory_type_' + id);
}

function editInventoryType(typeId) {
    var type = inventoryTypeById(typeId);
    if (!type) return;
    var h = '<h3>设置库存类型</h3>';
    h += '<div class="hrow"><label for="inventoryTypeName">名称</label><input id="inventoryTypeName" class="inp" maxlength="30" value="' + inventoryHtml(type.name) + '"></div>';
    h += '<div class="section-label">可用操作</div><div class="inventory-action-checks">';
    Object.keys(INVENTORY_ACTION_LABELS).filter(function(key) {
        return type.preset === 'generic' || ['add', 'inbound', 'sale', 'return'].indexOf(key) >= 0;
    }).forEach(function(key) {
        h += '<label><input type="checkbox" data-inventory-action="' + key + '"' + (type.actions[key] ? ' checked' : '') + '> ' + INVENTORY_ACTION_LABELS[key] + '</label>';
    });
    h += '</div><p class="inventory-help">关闭操作后不能再新增对应记录，已有历史继续保留。</p>';
    h += '<label class="inventory-daily-switch"><input type="checkbox" id="inventoryDailyLink"' + (type.dailyLink ? ' checked' : '') + '> 销售明细联动到日报</label>';
    h += '<p class="inventory-help">联动只显示在日报“库存销售”区域，不计入总流水或实收。</p>';
    h += '<div class="brow"><button type="button" class="btn p" onclick="saveInventoryType(\'' + type.id + '\')">保存</button>';
    if (type.archived) h += '<button type="button" class="btn" onclick="restoreInventoryType(\'' + type.id + '\')">恢复</button>';
    else h += '<button type="button" class="btn" onclick="archiveInventoryType(\'' + type.id + '\')">归档</button>';
    if (!inventoryTypeDataCount(type)) h += '<button type="button" class="btn d" onclick="deleteInventoryType(\'' + type.id + '\')">删除</button>';
    h += '<button type="button" class="btn" onclick="showInventoryTypeManager()">返回</button></div>';
    showModal(h);
}

function saveInventoryType(typeId) {
    var types = inventoryTypeDefinitions();
    var type = types.find(function(entry) { return entry.id === typeId && !entry.deleted; });
    if (!type) return;
    var name = String($id('inventoryTypeName').value || '').trim();
    if (!name) { toast('请输入类型名称'); return; }
    if (types.some(function(other) { return other.id !== typeId && !other.deleted && other.name === name; })) { toast('类型名称已存在'); return; }
    type.name = name;
    type.dailyLink = $id('inventoryDailyLink').checked;
    document.querySelectorAll('[data-inventory-action]').forEach(function(input) {
        type.actions[input.dataset.inventoryAction] = input.checked;
    });
    if (!inventorySaveTypeDefinitions(types)) return;
    closeModal();
    if (_curPage === 'settings') rData();
    else if (_curPage === 'inventory_type_' + typeId && type.preset === 'generic') rCustomInventory(typeId);
    else if (_curPage === 'inventory_type_' + typeId && type.preset === 'other-category') rInv('other', type.legacyCategory, type.name);
    else if (_curPage === 'inventory_type_' + typeId) rInv(type.preset, null, type.name);
    else if (INV[typeId]) rInv(typeId, null, type.name);
}

function archiveInventoryType(typeId) {
    var types = inventoryTypeDefinitions();
    var type = types.find(function(entry) { return entry.id === typeId; });
    if (!type || !confirm('归档“' + type.name + '”？可在设置中恢复。')) return;
    type.archived = true;
    if (!inventorySaveTypeDefinitions(types)) return;
    closeModal();
    goPage('dash');
}

function restoreInventoryType(typeId) {
    var types = inventoryTypeDefinitions();
    var type = types.find(function(entry) { return entry.id === typeId; });
    if (!type) return;
    type.archived = false;
    if (!inventorySaveTypeDefinitions(types)) return;
    closeModal();
    showInventoryTypeManager();
}

function deleteInventoryType(typeId) {
    var types = inventoryTypeDefinitions();
    var type = types.find(function(entry) { return entry.id === typeId; });
    if (!type || inventoryTypeDataCount(type)) { toast('有商品或历史记录，只能归档'); return; }
    if (!confirm('删除空库存类型“' + type.name + '”？')) return;
    type.deleted = true;
    if (!inventorySaveTypeDefinitions(types)) return;
    closeModal();
    if (_curPage === 'inventory_type_' + typeId || _curPage === typeId) goPage('dash');
    else showInventoryTypeManager();
}

function inventoryCustomStats(typeId, month) {
    var summary = { sales: 0, cost: 0, pending: 0, outstanding: 0, stock: 0, rows: [] };
    inventoryTypeItems(typeId).forEach(function(item) {
        var ledger = inventoryLedger(item);
        summary.stock += ledger.stock;
        ledger.entries.forEach(function(entry) {
            if (entry.kind === 'sale' && (ledger.results[entry.id] || {}).pendingQty > 0) summary.outstanding++;
        });
        ledger.entries.forEach(function(entry) {
            if (!entry.date || entry.date.slice(0, 7) !== month) return;
            var result = ledger.results[entry.id] || {};
            if (entry.kind === 'sale') {
                summary.sales += Number(entry.amount) || 0;
                summary.cost += result.cost || 0;
                summary.pending += result.pendingQty || 0;
            }
            summary.rows.push({ item: item, entry: entry, result: result });
        });
    });
    summary.rows.sort(function(a, b) {
        return String(b.entry.date).localeCompare(String(a.entry.date)) || Number(b.entry.createdAt || 0) - Number(a.entry.createdAt || 0);
    });
    return summary;
}

function rCustomInventory(typeId) {
    var type = inventoryTypeById(typeId);
    if (!type || type.preset !== 'generic' || type.archived) { goPage('dash'); return; }
    var month = _inventoryCustomMonth || curYM();
    var items = inventoryTypeItems(typeId);
    var stats = inventoryCustomStats(typeId, month);
    var h = '<div class="inventory-custom-head"><span class="inventory-help">按商品单位管理库存与销售成本</span>';
    h += '<button type="button" class="btn s" onclick="editInventoryType(\'' + typeId + '\')">类型设置</button></div>';
    if (stats.outstanding > 0) h += '<div class="inventory-pending" role="status">有 ' + stats.outstanding + ' 笔销售成本待结转。请核对并补录实际早于销售日的入库记录。</div>';
    h += '<div class="cards"><div class="card"><div class="card-l">商品</div><div class="card-v">' + items.length + '</div></div>';
    h += '<div class="card"><div class="card-l">本月销售</div><div class="card-v">' + fmtC(stats.sales) + '</div></div>';
    h += '<div class="card"><div class="card-l">已结转成本</div><div class="card-v">' + fmtC(stats.cost) + '</div></div>';
    h += '<div class="card"><div class="card-l">本月毛利</div><div class="card-v">' + (stats.pending ? '待结转' : fmtC(stats.sales - stats.cost)) + '</div></div></div>';
    h += '<div class="hrow"><label for="inventoryCustomMonth">月份</label><input id="inventoryCustomMonth" class="inp" type="month" value="' + inventoryHtml(month) + '" onchange="changeCustomInventoryMonth(this.value)"></div>';
    h += '<div class="view-tabs" role="tablist" aria-label="库存视图">';
    h += '<button type="button" class="view-tab active" role="tab" aria-selected="true" onclick="switchCustomInventoryTab(\'detail\')">明细</button>';
    h += '<button type="button" class="view-tab" role="tab" aria-selected="false" onclick="switchCustomInventoryTab(\'stock\')">库存</button></div>';
    h += '<div id="inventoryCustomDetail">';
    h += '<div class="brow inventory-action-bar">';
    if (type.actions.inbound) h += '<button class="btn" onclick="showInventoryTransaction(\'' + typeId + '\',\'inbound\')">入库</button>';
    if (type.actions.sale) h += '<button class="btn p" onclick="showInventoryTransaction(\'' + typeId + '\',\'sale\')">销售</button>';
    if (type.actions.return) h += '<button class="btn" onclick="showInventoryTransaction(\'' + typeId + '\',\'return\')">退货</button>';
    if (type.actions.adjust) h += '<button class="btn" onclick="showInventoryTransaction(\'' + typeId + '\',\'adjust\')">盘点调整</button>';
    if (type.actions.loss) h += '<button class="btn" onclick="showInventoryTransaction(\'' + typeId + '\',\'loss\')">报损</button>';
    h += '</div>';
    if (stats.rows.length) {
        h += '<div class="tw tw-viewport-scroll"><table><tr><th>日期</th><th>物品</th><th>类型</th><th>数量</th><th>金额</th><th>成本</th><th>毛利</th><th>操作</th></tr>';
        stats.rows.forEach(function(row) {
            var entry = row.entry;
            var kind = { inbound: '入库', sale: '销售', return: '退货', adjust: '盘点调整', loss: '报损' }[entry.kind] || entry.kind;
            var rowActionName = inventoryHtml((row.item.name || '物品') + ' ' + (entry.date || '未知日期') + ' ' + kind);
            var qty = Number(entry.qty) || 0;
            var cost = entry.kind === 'sale' ? fmtC(row.result.cost) + (row.result.pendingQty ? ' · 待结转 ' + row.result.pendingQty + inventoryHtml(row.item.unit) : '') : '—';
            var profit = entry.kind === 'sale' ? (row.result.pendingQty ? '待结转' : fmtC(row.result.profit)) : '—';
            h += '<tr><td>' + inventoryHtml(entry.date) + '</td><td>' + inventoryHtml(row.item.name) + '</td><td>' + kind + '</td>';
            h += '<td class="nr">' + qty + inventoryHtml(row.item.unit) + '</td><td class="nr">' + (entry.kind === 'sale' ? fmtC(Number(entry.amount) || 0) : '—') + '</td>';
            h += '<td class="nr">' + cost + '</td><td class="nr">' + profit + '</td><td><button class="btn s" aria-label="编辑' + rowActionName + '记录" onclick="showInventoryTransaction(\'' + typeId + '\',\'' + entry.kind + '\',\'' + row.item.id + '\',\'' + entry.id + '\')">编辑</button> ';
            h += '<button class="btn s d" aria-label="删除' + rowActionName + '记录" onclick="deleteInventoryTransaction(\'' + row.item.id + '\',\'' + entry.id + '\',\'' + typeId + '\')">删除</button></td></tr>';
        });
        h += '</table></div>';
    } else h += '<div class="inventory-empty">本月暂无库存明细</div>';
    h += '</div><div id="inventoryCustomStock" style="display:none">';
    if (type.actions.add) h += '<div class="brow inventory-action-bar"><button class="btn p" onclick="showInventoryItemModal(\'' + typeId + '\')">添加物品</button></div>';
    if (items.length) {
        h += '<div class="tw tw-viewport-scroll inventory-viewport-table"><table><tr><th>物品</th><th>单位</th><th>结存</th><th>售价</th><th>提醒</th><th>操作</th></tr>';
        items.forEach(function(item) {
            var stock = inventoryLedger(item).stock;
            var itemActionName = inventoryHtml(item.name || '物品');
            h += '<tr><td>' + inventoryHtml(item.name) + '</td><td>' + inventoryHtml(item.unit) + '</td><td class="nr">' + stock + '</td>';
            h += '<td class="nr">' + fmtC(Number(item.pricePerUnit) || 0) + '</td><td>' + (Number(item.restockAlert) > 0 && stock <= Number(item.restockAlert) ? '需要补货' : '—') + '</td>';
            h += '<td><button class="btn s" aria-label="编辑' + itemActionName + '" onclick="showInventoryItemModal(\'' + typeId + '\',\'' + item.id + '\')">编辑</button> ';
            if (!(item.transactions || []).length) h += '<button class="btn s d" aria-label="删除' + itemActionName + '" onclick="deleteInventoryItem(\'' + typeId + '\',\'' + item.id + '\')">删除</button>';
            h += '</td></tr>';
        });
        h += '</table></div>';
    } else h += '<div class="inventory-empty">暂无物品</div>';
    h += '</div>';
    setMain(inventoryHtml(type.name) + '管理', h);
}

function changeCustomInventoryMonth(month) {
    if (/^\d{4}-\d{2}$/.test(month)) _inventoryCustomMonth = month;
    var typeId = _curPage.slice('inventory_type_'.length);
    rCustomInventory(typeId);
}

function switchCustomInventoryTab(tab) {
    $id('inventoryCustomDetail').style.display = tab === 'detail' ? '' : 'none';
    $id('inventoryCustomStock').style.display = tab === 'stock' ? '' : 'none';
    if (tab === 'stock') requestAnimationFrame(syncInventoryViewportHeight);
    document.querySelectorAll('.view-tabs .view-tab').forEach(function(button) {
        var selected = button.textContent === (tab === 'detail' ? '明细' : '库存');
        button.classList.toggle('active', selected);
        button.setAttribute('aria-selected', selected ? 'true' : 'false');
    });
}

function showInventoryItemModal(typeId, itemId) {
    var item = itemId ? (DB.inventoryCustomItems || []).find(function(entry) { return entry.id === itemId && entry.typeId === typeId; }) : null;
    if (!item && !inventoryOperationEnabled(typeId, 'add')) { toast('此类型已关闭添加物品'); return; }
    var hasTransactions = !!(item && (item.transactions || []).length);
    var h = '<h3>' + (item ? '编辑物品' : '添加物品') + '</h3>';
    function field(label, id, value, type, disabled) {
        return '<div class="hrow"><label for="' + id + '">' + label + '</label><input class="inp" id="' + id + '" type="' + (type || 'text') + '"' + (type === 'number' ? ' min="0" step="any"' : '') + (disabled ? ' disabled' : '') + ' value="' + inventoryHtml(value) + '"></div>';
    }
    h += field('名称', 'inventoryItemName', item && item.name || '');
    h += field('单位', 'inventoryItemUnit', item && item.unit || '个', 'text', hasTransactions);
    if (hasTransactions) h += '<p class="inventory-help">已有库存流水，单位不可更改，以免历史数量被重新解释。</p>';
    h += field('期初库存', 'inventoryOpening', item && item.openingStock || 0, 'number');
    h += field('期初单价', 'inventoryOpeningCost', item && item.openingUnitCost || 0, 'number');
    h += field('默认售价', 'inventoryItemPrice', item && item.pricePerUnit || 0, 'number');
    h += field('补货提醒', 'inventoryRestockAlert', item && item.restockAlert || 0, 'number');
    h += field('备注', 'inventoryItemNote', item && item.note || '');
    h += '<div class="brow"><button class="btn p" onclick="saveInventoryItem(\'' + typeId + '\',\'' + (itemId || '') + '\')">保存</button><button class="btn" onclick="closeModal()">取消</button></div>';
    showModal(h);
}

function saveInventoryItem(typeId, itemId) {
    if (typeof requireAuth === 'function' && !requireAuth()) return;
    if (!itemId && !inventoryOperationEnabled(typeId, 'add')) { toast('此类型已关闭添加物品'); return; }
    var existingItem = itemId ? inventoryTypeItems(typeId).find(function(entry) { return entry.id === itemId; }) : null;
    if (itemId && !existingItem) { toast('原物品不存在'); return; }
    var name = String($id('inventoryItemName').value || '').trim();
    var unit = String($id('inventoryItemUnit').value || '').trim();
    var opening = Number($id('inventoryOpening').value);
    var cost = Number($id('inventoryOpeningCost').value);
    var price = Number($id('inventoryItemPrice').value);
    var alertQty = Number($id('inventoryRestockAlert').value);
    if (!name || !unit || ![opening, cost, price, alertQty].every(function(value) { return Number.isFinite(value) && value >= 0; })) {
        toast('请填写名称、单位及有效的非负数字'); return;
    }
    if (existingItem && (existingItem.transactions || []).length && unit !== existingItem.unit) {
        toast('已有库存流水，不能更改单位'); return;
    }
    upd(function(db) {
        if (!db.inventoryCustomItems) db.inventoryCustomItems = [];
        var item = itemId ? db.inventoryCustomItems.find(function(entry) { return entry.id === itemId && entry.typeId === typeId; }) : null;
        if (!item) {
            item = { id: 'item_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7), typeId: typeId, transactions: [] };
            db.inventoryCustomItems.push(item);
        }
        Object.assign(item, { name: name, unit: unit, openingStock: opening, openingUnitCost: cost,
            pricePerUnit: price, restockAlert: alertQty, note: String($id('inventoryItemNote').value || '').trim() });
    });
    closeModal();
    rCustomInventory(typeId);
    switchCustomInventoryTab('stock');
}

function deleteInventoryItem(typeId, itemId) {
    if (typeof requireAuth === 'function' && !requireAuth()) return;
    var item = inventoryTypeItems(typeId).find(function(entry) { return entry.id === itemId; });
    if (!item || (item.transactions || []).length) { toast('有交易历史的物品不能删除'); return; }
    if (!confirm('删除物品“' + item.name + '”？')) return;
    upd(function(db) { db.inventoryCustomItems = db.inventoryCustomItems.filter(function(entry) { return entry.id !== itemId; }); });
    rCustomInventory(typeId);
    switchCustomInventoryTab('stock');
}

function showInventoryTransaction(typeId, kind, itemId, transactionId) {
    if (!transactionId && !inventoryOperationEnabled(typeId, kind)) { toast('此操作已关闭'); return; }
    var items = inventoryTypeItems(typeId);
    if (!items.length) { toast('请先添加物品'); return; }
    var item = itemId ? items.find(function(entry) { return entry.id === itemId; }) : items[0];
    if (!item) return;
    var transaction = transactionId ? (item.transactions || []).find(function(entry) { return entry.id === transactionId; }) : null;
    var title = { inbound: '入库', sale: '销售', return: '退货', adjust: '盘点调整', loss: '报损' }[kind];
    if (!title) return;
    var h = '<h3>' + (transaction ? '编辑' : '') + title + '</h3><div class="hrow"><label for="inventoryTxnItem">物品</label>';
    if (transaction) h += '<span>' + inventoryHtml(item.name) + '</span>';
    else {
        h += '<select class="inp" id="inventoryTxnItem" onchange="inventoryPrefillSaleAmount(); inventoryUpdateReturnUnit()">';
        items.forEach(function(option) { h += '<option value="' + option.id + '"' + (option.id === item.id ? ' selected' : '') + '>' + inventoryHtml(option.name) + '</option>'; });
        h += '</select>';
    }
    h += '</div><div class="hrow"><label for="inventoryTxnDate">日期</label><input class="inp" id="inventoryTxnDate" type="date" value="' + inventoryHtml(transaction && transaction.date || td()) + '"></div>';
    h += '<div class="hrow"><label for="inventoryTxnQty">数量' + (kind === 'adjust' ? '（正数增加，负数减少）' : '') + '</label>';
    h += '<input class="inp" id="inventoryTxnQty" type="number" step="any" value="' + inventoryHtml(transaction && transaction.qty || '') + '" oninput="inventoryPrefillSaleAmount()">';
    if (kind === 'return') h += '<span id="inventoryReturnUnit">' + inventoryHtml(item.unit || '个') + '</span>';
    h += '</div>';
    if (kind === 'inbound' || kind === 'adjust') {
        var transactionCost = transaction && transaction.unitCost != null ? transaction.unitCost : (item.openingUnitCost || 0);
        h += '<div class="hrow"><label for="inventoryTxnCost">入库单价</label><input class="inp" id="inventoryTxnCost" type="number" min="0" step="0.01" value="' + inventoryHtml(transactionCost) + '"></div>';
    }
    if (kind === 'sale') h += '<div class="hrow"><label for="inventoryTxnAmount">实际销售金额</label><input class="inp" id="inventoryTxnAmount" type="number" min="0" step="0.01" data-item-id="' + item.id + '" value="' + inventoryHtml(transaction && transaction.amount || 0) + '" oninput="this.dataset.edited=\'true\'"></div>';
    h += '<div class="hrow"><label for="inventoryTxnNote">' + (kind === 'return' ? '退货原因' : '备注') + '</label><input class="inp" id="inventoryTxnNote" value="' + inventoryHtml(transaction && transaction.note || '') + '"></div>';
    if (kind === 'return') h += '<p class="inventory-help">仅更新库存；如需登记采购退款，请到采购页另行录入退货。</p>';
    h += '<div class="brow"><button class="btn p" onclick="saveInventoryTransaction(\'' + typeId + '\',\'' + kind + '\',\'' + item.id + '\',\'' + (transactionId || '') + '\')">保存</button>';
    h += '<button class="btn" onclick="closeModal()">取消</button></div>';
    showModal(h);
}

function inventoryPrefillSaleAmount() {
    var amountInput = $id('inventoryTxnAmount');
    if (!amountInput || amountInput.dataset.edited === 'true') return;
    var select = $id('inventoryTxnItem');
    var item = (DB.inventoryCustomItems || []).find(function(entry) { return entry.id === (select && select.value || amountInput.dataset.itemId); });
    if (!item) return;
    amountInput.value = (Math.round((Number($id('inventoryTxnQty').value) || 0) * (Number(item.pricePerUnit) || 0) * 100) / 100).toFixed(2);
}

function inventoryUpdateReturnUnit() {
    var unit = $id('inventoryReturnUnit');
    var select = $id('inventoryTxnItem');
    if (!unit || !select) return;
    var item = (DB.inventoryCustomItems || []).find(function(entry) { return entry.id === select.value; });
    unit.textContent = item && item.unit || '个';
}

function inventoryCustomAvailableAt(item, date, excludedTransactionId) {
    if (item.openingStock === undefined || item.openingStock === null || String(item.openingStock).trim() === '' ||
        !Number.isFinite(Number(item.openingStock))) return null;
    var transactions = (item.transactions || []).filter(function(entry) {
        return entry.date && entry.date <= date && (!excludedTransactionId || entry.id !== excludedTransactionId);
    });
    return inventoryLedger(Object.assign({}, item, { transactions: transactions })).stock;
}

function saveInventoryTransaction(typeId, kind, initialItemId, transactionId) {
    if (typeof requireAuth === 'function' && !requireAuth()) return;
    if (!transactionId && !inventoryOperationEnabled(typeId, kind)) { toast('此操作已关闭'); return; }
    var itemId = transactionId ? initialItemId : ($id('inventoryTxnItem') && $id('inventoryTxnItem').value || initialItemId);
    var item = inventoryTypeItems(typeId).find(function(entry) { return entry.id === itemId; });
    if (transactionId && (!item || !(item.transactions || []).some(function(entry) { return entry.id === transactionId && entry.kind === kind; }))) {
        toast('原记录不存在'); return;
    }
    var date = String($id('inventoryTxnDate').value || '');
    var qty = Number($id('inventoryTxnQty').value);
    var cost = $id('inventoryTxnCost') ? Number($id('inventoryTxnCost').value) : 0;
    var amount = $id('inventoryTxnAmount') ? Number($id('inventoryTxnAmount').value) : 0;
    if (!item || !inventoryValidDate(date) || !Number.isFinite(qty) ||
        (kind === 'adjust' ? qty === 0 : qty <= 0) || !Number.isFinite(cost) || cost < 0 || !Number.isFinite(amount) || amount < 0) {
        toast('请填写有效日期、数量和金额'); return;
    }
    if (kind === 'return') {
        var available = inventoryCustomAvailableAt(item, date, transactionId);
        if (available === null) { toast('无法确认退货日期的期初库存，请先补录'); return; }
        if (qty > available + 0.000001) { toast('退货数量不能超过当日可用库存 ' + available + (item.unit || '个')); return; }
    }
    upd(function(db) {
        var target = db.inventoryCustomItems.find(function(entry) { return entry.id === itemId && entry.typeId === typeId; });
        if (!target.transactions) target.transactions = [];
        var entry = transactionId ? target.transactions.find(function(record) { return record.id === transactionId; }) : null;
        if (!entry) {
            entry = { id: 'txn_' + Date.now().toString(36) + '_' + Math.random().toString(36).slice(2, 7), createdAt: Date.now() };
            target.transactions.push(entry);
        }
        Object.assign(entry, { kind: kind, date: date, qty: qty, unitCost: cost, amount: amount,
            note: String($id('inventoryTxnNote').value || '').trim() });
    });
    closeModal();
    rCustomInventory(typeId);
}

function deleteInventoryTransaction(itemId, transactionId, typeId) {
    if (typeof requireAuth === 'function' && !requireAuth()) return;
    var item = inventoryTypeItems(typeId).find(function(entry) { return entry.id === itemId; });
    if (!item || !confirm('删除这条库存记录？相关库存和成本会重新计算。')) return;
    upd(function(db) {
        var target = db.inventoryCustomItems.find(function(entry) { return entry.id === itemId; });
        target.transactions = (target.transactions || []).filter(function(entry) { return entry.id !== transactionId; });
    });
    rCustomInventory(typeId);
}

function inventoryDailySalesSection(date) {
    var groups = [];
    inventoryTypeDefinitions().filter(function(type) { return type.preset === 'generic' && type.dailyLink && !type.deleted; }).forEach(function(type) {
        var rows = [];
        inventoryTypeItems(type.id).forEach(function(item) {
            (item.transactions || []).filter(function(entry) { return entry.kind === 'sale' && entry.date === date; }).forEach(function(entry) {
                rows.push({ item: item, entry: entry });
            });
        });
        if (rows.length) groups.push({ type: type, rows: rows });
    });
    if (!groups.length) return '';
    var h = '<div class="section-label">库存销售</div>';
    groups.forEach(function(group) {
        h += '<div class="inventory-daily-group"><strong>' + inventoryHtml(group.type.name) + '</strong>';
        h += '<div class="tw"><table><tr><th>物品</th><th>数量</th><th>金额</th></tr>';
        group.rows.forEach(function(row) {
            h += '<tr><td>' + inventoryHtml(row.item.name) + '</td><td class="nr">' + Number(row.entry.qty) + inventoryHtml(row.item.unit) + '</td>';
            h += '<td class="nr">' + fmtC(Number(row.entry.amount) || 0) + '</td></tr>';
        });
        h += '</table></div></div>';
    });
    return h;
}

function refreshDailyInventorySales(date) {
    var container = $id('dmInventorySales');
    if (container) container.innerHTML = inventoryDailySalesSection(date);
}
