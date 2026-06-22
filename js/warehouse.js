
// 仓库管理界面
function rWH() {
    var items = DB.whItems || [];
    var cats = getWHCats();
    var lowCount = items.filter(function(i) {
        return i.safeStock > 0 && i.stock <= i.safeStock;
    }).length;

    var h = '<div class="brow" style="margin-bottom:16px">';
    h += '<button class="btn" onclick="showAddWH()">+添加</button> ';
    h += '<button class="btn g" onclick="whMoveAll(1)">入库</button> ';
    h += '<button class="btn" onclick="whMoveAll(-1)">出库</button> ';
    h += '<button class="btn" onclick="showWHCats()">分类管理</button>';
    h += '</div>';

    h += '<div class="cards">';
    h += '<div class="card"><div class="card-l">品类</div><div class="card-v ac">' + items.length + '</div></div>';
    h += '<div class="card"><div class="card-l">低库存预警</div>';
    h += '<div class="card-v ' + (lowCount > 0 ? 'rd' : 'gn') + '">' + lowCount + '</div></div>';
    h += '</div>';

    if (!items.length) {
        h += '<div style="text-align:center;padding:30px;color:var(--tx-m)">暂无</div>';
    } else {
        // 按分类分组
        var groups = {};
        items.forEach(function(item) {
            var cat = item.category || '未分类';
            if (!groups[cat]) groups[cat] = [];
            groups[cat].push(item);
        });

        // 分为有低库存的分类和无低库存的分类
        var lowCats = [];
        var normalCats = [];

        Object.keys(groups).forEach(function(cat) {
            var hasLow = groups[cat].some(function(i) { return i.safeStock > 0 && i.stock <= i.safeStock; });
            if (hasLow) lowCats.push(cat);
            else normalCats.push(cat);
        });

        // 有低库存的分类：按低库存数量降序
        lowCats.sort(function(a, b) {
            var aLow = groups[a].filter(function(i) { return i.safeStock > 0 && i.stock <= i.safeStock; }).length;
            var bLow = groups[b].filter(function(i) { return i.safeStock > 0 && i.stock <= i.safeStock; }).length;
            return bLow - aLow;
        });

        // 无低库存的分类：按物品数量降序
        normalCats.sort(function(a, b) {
            return groups[b].length - groups[a].length;
        });

        // 有低库存的分类排最前面，无低库存的排后面
        var sortedCats = lowCats.concat(normalCats);

        // 渲染每个分类
        sortedCats.forEach(function(cat) {
            var catItems = groups[cat];
            var catLow = catItems.filter(function(i) { return i.safeStock > 0 && i.stock <= i.safeStock; }).length;

            // 组内排序：低库存排前面，同状态按库存数量降序
            catItems.sort(function(a, b) {
                var aLow = (a.safeStock > 0 && a.stock <= a.safeStock) ? 0 : 1;
                var bLow = (b.safeStock > 0 && b.stock <= b.safeStock) ? 0 : 1;
                if (aLow !== bLow) return aLow - bLow;
                return b.stock - a.stock;
            });

            h += '<div style="margin-bottom:16px">';
            h += '<div style="display:flex;align-items:center;justify-content:space-between;padding:8px 10px;background:' + (catLow > 0 ? 'rgba(199,84,80,0.06)' : 'var(--card-h)') + ';border:1px solid ' + (catLow > 0 ? 'var(--rd)' : 'var(--bd)') + ';border-radius:8px;margin-bottom:6px">';
            h += '<span style="font-size:.84rem;font-weight:700;color:' + (catLow > 0 ? 'var(--rd)' : 'var(--ac)') + '">' + cat + ' <span style="font-size:.72rem;color:var(--tx-m);font-weight:400">' + catItems.length + '项</span></span>';
            if (catLow > 0) h += '<span class="badge rd">' + catLow + '项低库存</span>';
            h += '</div>';

            h += '<div class="tw"><table>';
            h += '<tr><th>品名</th><th>单位</th><th>库存</th><th>安全库存</th><th>状态</th><th>操作</th></tr>';

            catItems.forEach(function(item) {
                var isLow = item.safeStock > 0 && item.stock <= item.safeStock;
                var status = '-';
                if (item.safeStock > 0) {
                    status = isLow ? '<span class="badge rd">低</span>' : '<span class="badge gn">正常</span>';
                }

                h += '<tr' + (isLow ? ' style="background:rgba(199,84,80,0.04)"' : '') + '>';
                h += '<td>' + item.name + '</td>';
                h += '<td>' + (item.unit || '-') + '</td>';
                h += '<td class="nr">' + item.stock + '</td>';
                h += '<td class="nr">' + (item.safeStock || '-') + '</td>';
                h += '<td>' + status + '</td>';
                h += '<td>';
                h += '<button class="btn s" onclick="showEditWH(\'' + item.id + '\')">编</button> ';
                h += '<button class="btn s" onclick="whDetail(\'' + item.id + '\')">详</button> ';
                h += '<button class="btn s d" onclick="delWH(\'' + item.id + '\')">×</button>';
                h += '</td></tr>';
            });

            h += '</table></div></div>';
        });
    }

    setMain('仓库管理', h);
}

// 仓库物品添加
function showAddWH() {
    var cats = getWHCats();
    var h = '<h3>添加仓库物品</h3>';
    h += '<div class="hrow">';
    h += '<label>品名</label><input class="inp" id="wh_n" style="flex:2">';
    h += '</div>';
    h += '<div class="hrow">';
    h += '<label>分类</label><select class="inp" id="wh_c" style="max-width:120px">';
    cats.forEach(function(c) { h += '<option>' + c + '</option>'; });
    h += '<option value="_new">+新建分类</option></select>';
    h += '<input class="inp" id="wh_c_new" placeholder="新分类名" style="display:none;max-width:120px">';
    h += '<label>单位</label><input class="inp" id="wh_u" placeholder="个/箱/袋/瓶" style="max-width:100px">';
    h += '</div>';
    h += '<div class="hrow">';
    h += '<label>当前库存</label><input class="inp" id="wh_s" type="number" value="0" style="max-width:80px">';
    h += '<label>安全库存</label><input class="inp" id="wh_ss" type="number" value="0" style="max-width:80px">';
    h += '<span style="font-size:.72rem;color:var(--tx-m)">低于此数提醒</span>';
    h += '</div>';
    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end">';
    h += '<button class="btn p" onclick="doAddWH()">添加</button>';
    h += '<button class="btn" onclick="closeModal()">取消</button></div>';
    showModal(h);

    // 新建分类联动
    $id('wh_c').onchange = function() {
        var isNew = this.value === '_new';
        $id('wh_c_new').style.display = isNew ? '' : 'none';
    };
}

// 保存新添加的仓库物品
function doAddWH() {
    var n = $id('wh_n').value.trim();
    if (!n) { toast('填品名'); return; }
    var cat = $id('wh_c').value;
    if (cat === '_new') {
        cat = $id('wh_c_new').value.trim();
        if (!cat) { toast('填分类名'); return; }
        // 自动加入分类列表
        var cats = getWHCats();
        if (cats.indexOf(cat) < 0) {
            cats.push(cat);
            upd(function(db) { db.whCats = cats; });
        }
    }
    upd(function(db) {
        db.whItems.push({
            id: 'wh_' + Date.now(),
            name: n,
            category: cat || '未分类',
            unit: $id('wh_u').value.trim() || '个',
            stock: parseInt($id('wh_s').value) || 0,
            safeStock: parseInt($id('wh_ss').value) || 0,
            movements: []
        });
    });
    closeModal();
    toast('已添加');
    rWH();
}

// 仓库分类管理
function getWHCats() {
    return DB.whCats || ['包装', '调料', '清洁', '耗材', '设备', '其他'];
}

// 显示分类管理界面
function showWHCats() {
    var cats = getWHCats();
    var h = '<h3>仓库分类管理</h3>';
    h += '<div style="max-height:50vh;overflow-y:auto;padding-right:4px">';
    cats.forEach(function(c, i) {
        var count = (DB.whItems || []).filter(function(item) { return (item.category || '未分类') === c; }).length;
        h += '<div style="display:flex;align-items:center;gap:8px;padding:8px 10px;margin-bottom:4px;background:var(--card-h);border:1px solid var(--bd);border-radius:6px">';
        h += '<span style="font-size:.72rem;color:var(--tx-m);width:20px">' + (i + 1) + '</span>';
        h += '<span style="flex:1;font-size:.84rem;font-weight:600">' + c + '</span>';
        h += '<span class="badge">' + count + '项</span>';
        if (i > 0) h += '<button class="btn s" onclick="moveWHCat(' + i + ',-1)">▲</button>';
        if (i < cats.length - 1) h += '<button class="btn s" onclick="moveWHCat(' + i + ',1)">▼</button>';
        h += '<button class="btn s" onclick="editWHCat(' + i + ')">编</button>';
        h += '<button class="btn s d" onclick="delWHCat(' + i + ')">×</button>';
        h += '</div>';
    });
    h += '</div>';
    h += '<div class="hrow" style="margin-top:12px">';
    h += '<input class="inp" id="newWHCat" placeholder="新分类名称" style="flex:1">';
    h += '<button class="btn p" onclick="addWHCat()">添加</button></div>';
    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end"><button class="btn" onclick="closeModal();rWH()">完成</button></div>';
    showModal(h, 450);
}

// 添加新分类
function addWHCat() {
    var name = $id('newWHCat').value.trim();
    if (!name) { toast('填分类名'); return; }
    var cats = getWHCats();
    if (cats.indexOf(name) >= 0) { toast('已存在'); return; }
    cats.push(name);
    upd(function(db) { db.whCats = cats; });
    toast('已添加');
    showWHCats();
}

//  编辑分类名（同步更新物品分类）
function editWHCat(index) {
    var cats = getWHCats();
    var old = cats[index];
    var h = '<h3>编辑分类</h3>';
    h += '<div class="hrow"><label>分类名</label><input class="inp" id="editCatName" value="' + old + '" style="flex:2"></div>';
    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end">';
    h += '<button class="btn p" onclick="doEditWHCat(' + index + ')">保存</button>';
    h += '<button class="btn" onclick="closeModal();showWHCats()">取消</button></div>';
    showModal(h, 400);
}

// 删除分类（物品分类变为"未分类"）
function delWHCat(index) {
    var cats = getWHCats();
    var name = cats[index];
    var count = (DB.whItems || []).filter(function(item) { return (item.category || '未分类') === name; }).length;
    if (!confirm('删除分类「' + name + '」？' + (count > 0 ? '\n' + count + '个物品会变为"未分类"' : ''))) return;
    cats.splice(index, 1);
    upd(function(db) {
        db.whCats = cats;
        db.whItems.forEach(function(item) {
            if (item.category === name) item.category = '未分类';
        });
    });
    toast('已删除');
    showWHCats();
}

// 分类上下移动
function moveWHCat(index, dir) {
    var cats = getWHCats();
    var target = index + dir;
    if (target < 0 || target >= cats.length) return;
    var temp = cats[index];
    cats[index] = cats[target];
    cats[target] = temp;
    upd(function(db) { db.whCats = cats; });
    showWHCats();
}

// 保存编辑后的分类名，并同步更新物品分类
function doEditWHCat(index) {
    var cats = getWHCats();
    var old = cats[index];
    var name = $id('editCatName').value.trim();
    if (!name || name === old) { closeModal(); showWHCats(); return; }
    cats[index] = name;
    upd(function(db) {
        db.whCats = cats;
        db.whItems.forEach(function(item) {
            if (item.category === old) item.category = name;
        });
    });
    toast('已修改');
    showWHCats();
}

// 仓库物品编辑
function showEditWH(id) {
    var item = DB.whItems.find(function(i) { return i.id === id; });
    if (!item) return;
    var cats = getWHCats();

    var h = '<h3>编辑仓库物品</h3>';
    h += '<div class="hrow">';
    h += '<label>品名</label><input class="inp" id="ewh_n" style="flex:2" value="' + item.name.replace(/"/g, '&quot;') + '">';
    h += '</div>';
    h += '<div class="hrow">';
    h += '<label>分类</label><select class="inp" id="ewh_c" style="max-width:120px">';
    cats.forEach(function(c) { h += '<option' + (item.category === c ? ' selected' : '') + '>' + c + '</option>'; });
    h += '</select>';
    h += '<label>单位</label><input class="inp" id="ewh_u" style="max-width:80px" value="' + (item.unit || '') + '">';
    h += '</div>';
    h += '<div class="hrow">';
    h += '<label>当前库存</label><input class="inp" id="ewh_s" type="number" style="max-width:80px" value="' + item.stock + '">';
    h += '<label>安全库存</label><input class="inp" id="ewh_ss" type="number" style="max-width:80px" value="' + (item.safeStock || 0) + '">';
    h += '<span style="font-size:.72rem;color:var(--tx-m)">低于此数提醒</span>';
    h += '</div>';
    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end">';
    h += '<button class="btn p" onclick="doEditWH(\'' + id + '\')">保存</button>';
    h += '<button class="btn" onclick="closeModal()">取消</button></div>';
    showModal(h);
}

// 保存编辑后的仓库物品信息
function doEditWH(id) {
    var n = document.getElementById('ewh_n').value.trim();
    if (!n) { toast('填品名'); return; }
    upd(function(db) {
        var it = db.whItems.find(function(i) { return i.id === id; });
        if (!it) return;
        it.name = n;
        it.category = document.getElementById('ewh_c').value.trim() || '未分类';
        it.unit = document.getElementById('ewh_u').value.trim() || '个';
        it.stock = parseInt(document.getElementById('ewh_s').value) || 0;
        it.safeStock = parseInt(document.getElementById('ewh_ss').value) || 0;
    });
    closeModal();
    toast('已更新');
    rWH();
}

// 删除仓库物品
function delWH(id) {
    if (!confirm('删除？')) return;
    upd(function(db) {
        db.whItems = db.whItems.filter(function(i) { return i.id !== id; });
    });
    toast('已删除');
    rWH();
}

// 入库/出库操作（dir>0入库，dir<0出库）
function whMoveAll(dir) {
    var items = DB.whItems || [];
    if (!items.length) { toast('请先添加物品'); return; }

    var title = dir > 0 ? '入库' : '出库';
    var h = '<h3>' + title + '</h3>';
    h += '<div class="hrow"><label>物品</label>';
    h += '<select class="inp" id="mvItem" style="max-width:200px">';
    items.forEach(function(item) {
        h += '<option value="' + item.id + '">' + item.name + ' (库存:' + item.stock + item.unit + ')</option>';
    });
    h += '</select></div>';
    h += '<div class="hrow"><label>日期</label><input class="inp" id="whDate" type="text" readonly placeholder="选择日期" value="' + td() + '" onclick="_dpOpen(\'whDate\')" style="max-width:150px;cursor:pointer"></div>';
    h += '<div class="hrow"><label>数量</label><input class="inp" id="whQty" type="number" style="max-width:100px"></div>';
    h += '<div class="hrow"><label>' + (dir > 0 ? '来源' : '原因') + '</label><input class="inp" id="whReason" style="max-width:150px"></div>';
    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end">';
    h += '<button class="btn p" onclick="doWhMoveAll(' + dir + ')">' + title + '</button>';
    h += '<button class="btn" onclick="closeModal()">取消</button>';
    h += '</div>';
    showModal(h);
}

// 执行入库/出库操作，更新库存和记录
function doWhMoveAll(dir) {
    var itemId = document.getElementById('mvItem').value;
    var qty = parseInt(document.getElementById('whQty').value);
    if (isNaN(qty) || qty <= 0) { toast('填数量'); return; }
    var date = document.getElementById('whDate').value || td();
    var reason = document.getElementById('whReason').value || '';

    upd(function(db) {
        var it = db.whItems.find(function(i) { return i.id === itemId; });
        if (!it) return;
        if (!it.movements) it.movements = [];
        it.movements.push({ date: date, qty: dir > 0 ? qty : -qty, reason: reason });
        it.stock = Math.max(0, it.stock + dir * qty);
    });
    closeModal();
    toast((dir > 0 ? '入库' : '出库') + ' ' + qty);
    rWH();
}

// 查看仓库物品的出入库明细
function whDetail(id) {
    var item = DB.whItems.find(function(i) { return i.id === id; });
    if (!item) return;

    var h = '<h3>' + item.name + ' · 出入库明细</h3>';
    var moves = (item.movements || []).slice().sort(function(a, b) {
        return b.date.localeCompare(a.date);
    });

    if (!moves.length) {
        h += '<div style="text-align:center;padding:20px;color:var(--tx-m)">暂无出入库记录</div>';
    } else {
        h += '<div class="tw"><table>';
        h += '<tr><th>日期</th><th>类型</th><th>数量</th><th>来源/原因</th><th>操作</th></tr>';

        moves.forEach(function(m, idx) {
            var isIn = m.qty > 0;
            var origIdx = item.movements.indexOf(m);
            h += '<tr>';
            h += '<td>' + m.date + '</td>';
            h += '<td><span class="badge ' + (isIn ? 'gn' : 'rd') + '">' + (isIn ? '入库' : '出库') + '</span></td>';
            h += '<td class="nr">' + Math.abs(m.qty) + item.unit + '</td>';
            h += '<td>' + (m.reason || '-') + '</td>';
            h += '<td>';
            h += '<button class="btn s" onclick="editWHMove(\'' + id + '\',' + origIdx + ')">编</button> ';
            h += '<button class="btn s d" onclick="delWHMove(\'' + id + '\',' + origIdx + ')">×</button>';
            h += '</td>';
            h += '</tr>';
        });

        h += '<tr style="background:var(--card-h)">';
        h += '<td style="font-weight:600">当前库存</td>';
        h += '<td colspan="4" class="nr" style="font-weight:600">' + item.stock + item.unit + '</td>';
        h += '</tr>';
        h += '</table></div>';
    }

    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end"><button class="btn" onclick="closeModal()">关闭</button></div>';
    showModal(h);
}

// 编辑出入库记录
function editWHMove(id, idx) {
    var item = DB.whItems.find(function(i) { return i.id === id; });
    if (!item || !item.movements[idx]) return;
    var m = item.movements[idx];

    var h = '<h3>编辑出入库 · ' + item.name + '</h3>';
    h += '<div class="hrow"><label>日期</label><input class="inp" id="ewm_date" type="text" readonly placeholder="选择日期" value="' + m.date + '" onclick="_dpOpen(\'ewm_date\')" style="max-width:150px;cursor:pointer"></div>';
    h += '<div class="hrow"><label>类型</label><select class="inp" id="ewm_type" style="max-width:100px">';
    h += '<option value="1"' + (m.qty > 0 ? ' selected' : '') + '>入库</option>';
    h += '<option value="-1"' + (m.qty < 0 ? ' selected' : '') + '>出库</option>';
    h += '</select></div>';
    h += '<div class="hrow"><label>数量</label><input class="inp" id="ewm_qty" type="number" step="any" value="' + Math.abs(m.qty) + '" style="max-width:120px">';
    h += '<span style="font-size:.78rem;color:var(--tx-m)">' + item.unit + '</span></div>';
    h += '<div class="hrow"><label>原因</label><input class="inp" id="ewm_reason" value="' + (m.reason || '') + '" style="flex:1"></div>';

    h += '<div class="brow" style="margin-top:12px;justify-content:flex-end">';
    h += '<button class="btn p" onclick="saveWHMove(\'' + id + '\',' + idx + ')">保存</button>';
    h += '<button class="btn" onclick="closeModal();setTimeout(function(){whDetail(\'' + id + '\')},250)">取消</button>';
    h += '</div>';

    showModal(h, 450);
}

// 保存编辑
function saveWHMove(id, idx) {
    var item = DB.whItems.find(function(i) { return i.id === id; });
    if (!item || !item.movements[idx]) return;

    var oldQty = item.movements[idx].qty;
    var dir = parseInt($id('ewm_type').value);
    var newQty = Math.abs(parseFloat($id('ewm_qty').value) || 0) * dir;

    // 更新库存：先减旧的，再加新的
    item.stock = item.stock - oldQty + newQty;
    item.stock = Math.round(item.stock * 100) / 100;

    item.movements[idx].date = $id('ewm_date').value;
    item.movements[idx].qty = newQty;
    item.movements[idx].reason = $id('ewm_reason').value.trim();

    saveDB(DB);
    closeModal();
    toast('已更新');
    setTimeout(function() { whDetail(id); }, 100);
}

// 删除出入库记录
function delWHMove(id, idx) {
    var item = DB.whItems.find(function(i) { return i.id === id; });
    if (!item || !item.movements[idx]) return;

    var m = item.movements[idx];
    var desc = (m.qty > 0 ? '入库' : '出库') + ' ' + Math.abs(m.qty) + item.unit;
    if (!confirm('删除这条' + desc + '记录？')) return;

    // 减去该记录的库存影响
    item.stock = item.stock - m.qty;
    item.stock = Math.round(item.stock * 100) / 100;

    item.movements.splice(idx, 1);
    saveDB(DB);
    toast('已删除');
    setTimeout(function() { whDetail(id); }, 100);
}


