// 报损页面的照片数据（Base64，用于拍照记录报损物品）
var _dmgPhotoData = null;

// 报损主页：录入表单 + 报损记录列表
function rDamage() {
    var h = '<div class="section-label">录入报损</div>';

    // 日期、物品名
    h += '<div class="hrow"><label>日期</label><input class="inp" id="dmgDate" type="text" readonly placeholder="选择日期" value="' + td() + '" onclick="_dpOpen(\'dmgDate\')" style="max-width:150px;cursor:pointer">';
    h += '<label>物品</label><input class="inp" id="dmgName" placeholder="物品名称" style="flex:2"></div>';

    // 数量、单位、原因
    h += '<div class="hrow"><label>数量</label><input class="inp" id="dmgQty" type="number" value="1" style="max-width:60px">';
    h += '<label>单位</label><input class="inp" id="dmgUnit" style="max-width:60px">';
    h += '<label>原因</label><input class="inp" id="dmgReason" list="dmgReasonDL" style="max-width:120px">';
    h += '<datalist id="dmgReasonDL"><option>过期</option><option>破损</option><option>变质</option><option>自用</option><option>其他</option></datalist></div>';

    // 照片
    h += '<div class="hrow"><label>照片</label><input type="file" id="dmgPhoto" accept="image/*" onchange="handleDmgPhoto(event)"></div>';

    // 添加按钮
    h += '<div class="brow"><button class="btn p" onclick="doAddDmg()">添加</button></div>';

    // 报损记录列表
    h += '<div class="sec" style="margin-top:20px">报损记录</div>';

    var sorted = DB.damageRecords.slice().sort(function(a, b) { return b.date.localeCompare(a.date); });
    if (!sorted.length) {
        h += '<div style="text-align:center;padding:20px;color:var(--tx-m)">暂无</div>';
    } else {
        sorted.forEach(function(d) {
            h += '<div class="item-card">';
            h += '<span class="name">' + d.date + ' · ' + d.itemName + ' · ' + (d.qty || 0) + (d.unit || '') + (d.reason ? ' · ' + d.reason : '') + '</span>';
            h += '<div class="nums">';
            if (d.photoFile) {
                h += '<img src="' + d.photoFile + '" style="max-width:40px;max-height:28px;border-radius:4px;border:1px solid var(--bd);cursor:pointer;vertical-align:middle" onclick="toggleDmgPhoto(\'' + d.id + '\')">';
            }
            h += '<button class="btn s d" onclick="delDmg(\'' + d.id + '\')">×</button>';
            h += '</div></div>';
            if (d.photoFile) {
                h += '<div id="dmgPhoto_' + d.id + '" style="display:none;padding:6px 10px 10px;text-align:center">';
                h += '<img src="' + d.photoFile + '" style="max-width:100%;max-height:250px;border-radius:8px;border:1px solid var(--bd)" onclick="toggleDmgPhoto(\'' + d.id + '\')">';
                h += '</div>';
            }
        });
    }

    setMain('报损', h);
}

// 处理报损照片上传，读取为Base64字符串
function toggleDmgPhoto(id) {
    var el = document.getElementById('dmgPhoto_' + id);
    if (!el) return;
    el.style.display = el.style.display === 'none' ? '' : 'none';
}

// 添加报损记录
function doAddDmg() {
    var itemName = $id('dmgName').value.trim();
    if (!itemName) { toast('填物品名'); return; }

    var qty = parseInt($id('dmgQty').value) || 0;
    if (qty <= 0) { toast('填数量'); return; }

    upd(function(db) {
        db.damageRecords.push({
            id: 'dmg_' + Date.now(),
            date: $id('dmgDate').value || td(),
            category: '报损',
            itemId: '',
            itemName: itemName,
            qty: qty,
            unit: $id('dmgUnit').value.trim(),
            reason: $id('dmgReason').value.trim(),
            photoFile: _dmgPhotoData || ''
        });
    });

    _dmgPhotoData = null;
    toast('已记录 ' + itemName + ' ' + qty);
    rDamage();
}

// 删除报损记录
function delDmg(id) {
    if (!confirm('删除？')) return;
    upd(function(db) {
        db.damageRecords = db.damageRecords.filter(function(d) { return d.id !== id; });
    });
    toast('已删除');
    rDamage();
}


