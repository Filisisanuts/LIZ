// ---------- 生成同步码 ----------
function genSyncCode() {
    try {
        var data = JSON.stringify(DB);
        var encoded = btoa(unescape(encodeURIComponent(data)));

        // 分块显示（避免单行过长）
        var chunkSize = 1000;
        var chunks = [];
        for (var i = 0; i < encoded.length; i += chunkSize) {
            chunks.push(encoded.substring(i, i + chunkSize));
        }

        var h = '<h3>数据同步码</h3>';
        h += '<div style="font-size:.72rem;color:var(--tx-m);margin-bottom:10px">数据大小：' + (encoded.length / 1024).toFixed(1) + 'KB</div>';
        h += '<textarea id="syncCodeOutput" style="width:100%;height:300px;font-family:monospace;font-size:.7rem;resize:vertical" readonly>' + chunks.join('\n') + '</textarea>';
        h += '<div class="brow" style="margin-top:10px;justify-content:flex-end">';
        h += '<button class="btn p" onclick="copySyncCode()">复制全部</button>';
        h += '<button class="btn" onclick="closeModal()">关闭</button></div>';
        showModal(h, 600);
    } catch (e) {
        toast('生成同步码失败：' + e.message);
    }
}

// ---------- 复制同步码 ----------
function copySyncCode() {
    var textarea = $id('syncCodeOutput');
    if (!textarea) return;

    textarea.select();
    textarea.setSelectionRange(0, 99999); // 兼容移动端

    try {
        document.execCommand('copy');
        toast('已复制到剪贴板');
    } catch (e) {
        // 尝试使用现代API
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textarea.value)
                .then(function() { toast('已复制到剪贴板'); })
                .catch(function() { toast('复制失败，请手动选择复制'); });
        } else {
            toast('复制失败，请手动选择复制');
        }
    }
}

// ---------- 导入同步码 ----------
function importSyncCode() {
    var h = '<h3>导入同步码</h3>';
    h += '<div style="font-size:.74rem;color:var(--tx-m);margin-bottom:10px">粘贴之前生成的同步码，将覆盖当前所有数据</div>';
    h += '<textarea id="syncCodeInput" style="width:100%;height:300px;font-family:monospace;font-size:.7rem;resize:vertical" placeholder="粘贴同步码..."></textarea>';
    h += '<div class="brow" style="margin-top:10px">';
    h += '<button class="btn p" onclick="doImportSyncCode()">导入</button>';
    h += '<button class="btn" onclick="closeModal()">取消</button></div>';
    showModal(h, 600);
}

// ---------- 执行导入 ----------
function doImportSyncCode() {
    var input = $id('syncCodeInput');
    if (!input) return;

    var code = (input.value || '').trim();
    if (!code) { toast('请粘贴同步码'); return; }

    // 去掉可能的换行符
    code = code.replace(/\n/g, '').replace(/\r/g, '');

    try {
        var decoded = decodeURIComponent(escape(atob(code)));
        var data = JSON.parse(decoded);

        // 简单验证数据结构
        if (!data.dailyReports && !data.purchases && !data.expenses) {
            toast('同步码格式错误：缺少必要数据');
            return;
        }

        if (!confirm('确认导入？这将覆盖当前所有数据！')) return;

        DB = data;
        saveDB(DB);
        sbScheduleSave();
        toast('导入成功');
        closeModal();
        goPage(_curPage || 'dash'); // 刷新当前页面
    } catch (e) {
        toast('导入失败：同步码格式错误或已损坏');
        console.error('导入同步码失败:', e);
    }
}
