
// 获取分类列表
function getPurCats(area) {
    // 如果还没有分类数据，初始化默认分类
    if (!DB.areaCats) {
        DB.areaCats = {
            "厨房": ["调料/粮油", "食材", "茶叶/干货"],
            "吧台": ["饮品", "耗材"],
            "外场": ["清洁", "包装", "设备"]
        };
    }

    // 传了区域参数，返回该区域的分类（slice复制一份，防止修改原数组）
    if (area && DB.areaCats[area]) {
        return DB.areaCats[area].slice();
    }

    // 没传参数，返回所有区域的分类（合并去重）
    var all = [];
    Object.keys(DB.areaCats).forEach(function(a) {
        DB.areaCats[a].forEach(function(c) {
            if (all.indexOf(c) < 0) all.push(c);
        });
    });

    // 如果完全没有分类，返回硬编码的默认值
    return all.length ? all : ["调料/粮油", "食材", "茶叶/干货", "清洁", "耗材", "设备", "包装"];
}

// 根据区域重建分类下拉框
function updateCatSelect(selEl, area) {
    // 获取该区域的分类列表
    var cats = getPurCats(area);

    // 重建下拉选项
    var html = '<option value="">-</option>';
    cats.forEach(function(c) {
        html += '<option>' + c + '</option>';
    });
    // 自定义：用户手输入新分类
    // 清除：清空已选分类
    html += '<option value="__custom">自定义</option>';
    html += '<option value="__clear">清除</option>';

    // 替换原来的选项
    selEl.innerHTML = html;
}

// 采购行区域下拉变化时触发
function purAreaChanged(areaEl, idx) {
    // 获取选中的区域值
    var area = areaEl.value;

    // 更新数据：设置新区域，清空旧分类
    _pmItems[idx].section = area;
    _pmItems[idx].category = '';

    // 找到这一行的 <tr>，然后找到第3个 <select>（分类下拉），重建选项
    var row = areaEl.closest('tr');
    if (row) {
        var selects = row.querySelectorAll('select');
        if (selects[2]) {
            updateCatSelect(selects[2], area);
        }
    }
}

// 切换自定义输入框的显示/隐藏，当下拉选择"自定义"时显示输入框供用户手动输入
function toggleCustomInput(sel, customId) {
    var c = document.getElementById(customId);
    if (sel.value === '__custom') {
        c.style.display = '';
        c.focus();
    } else {
        c.style.display = 'none';
        c.value = '';
    }
}

// 获取下拉框的值（含自定义输入）
function getSelVal(selId, customId) {
    var s = document.getElementById(selId);
    return s.value === '__custom'
        ? (document.getElementById(customId).value.trim() || '')
        : s.value;
}


