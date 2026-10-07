
// 采购区域和分类以账号配置为准；旧数据由 getAppConfig 的迁移逻辑读取。
function getPurchaseSections() {
    return (getAppConfig().purchaseSections || []).slice();
}

function getPurCats(area) {
    var categories = getAppConfig().purchaseCategories || {};
    // 指定区域却没有配置时保持为空，不能把其他区域的分类混进来。
    if (area) return (categories[area] || []).slice();

    // 没传区域参数时，供跨区域搜索等场景使用合并后的分类列表。
    var all = [];
    Object.keys(categories).forEach(function(a) {
        categories[a].forEach(function(c) {
            if (all.indexOf(c) < 0) all.push(c);
        });
    });
    return all;
}

// 根据区域重建分类下拉框
function updateCatSelect(selEl, area) {
    // 获取该区域的分类列表
    var cats = area ? getPurCats(area) : [];

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
    selEl.disabled = !area;
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
    refreshPMAiReviewStatus(idx);
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


