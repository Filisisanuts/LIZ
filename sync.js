// sync.js - 云同步 + 同步码

// ==================== 16. Supabase 云同步 ====================
var _sb = { client: null, ready: false, saving: false };

function sbInit() {
    var url = localStorage.getItem('ax_sb_url');
    var key = localStorage.getItem('ax_sb_key');
    if (!url || !key) return;
    if (typeof supabase === 'undefined') { console.warn('Supabase SDK 未加载'); return; }
    _sb.client = supabase.createClient(url, key);
    _sb.ready = true;
    console.log('Supabase 已连接');
}

function sbConnect() {
    var url = ($id('sbUrl')||{}).value||''; url = url.trim();
    var key = ($id('sbKey')||{}).value||''; key = key.trim();
    if (!url || !key) { toast('请填写 URL 和 Key'); return; }
    localStorage.setItem('ax_sb_url', url);
    localStorage.setItem('ax_sb_key', key);
    _sb.client = supabase.createClient(url, key);
    _sb.ready = true;
    toast('Supabase 已连接');
    sbSyncOnStart().then(function() { rData(); });
}

function sbDisconnect() {
    if (!confirm('断开 Supabase 同步？')) return;
    localStorage.removeItem('ax_sb_url');
    localStorage.removeItem('ax_sb_key');
    _sb = { client: null, ready: false, saving: false };
    updSyncInd();
    rData();
    toast('已断开');
}

async function sbLoad() {
    if (!_sb.ready) return null;
    try {
        var resp = await _sb.client.from('cafe_data').select('data, updated_at').eq('id', 'main').single();
        if (resp.error || !resp.data) return null;
        var remote = resp.data.data;
        if (remote._ts && remote._ts > (DB._ts || 0)) return remote;
    } catch (e) { console.warn('Supabase 读取失败:', e); }
    return null;
}

async function sbSave() {
    if (!_sb.ready || _sb.saving) return;
    _sb.saving = true;
    DB._ts = Date.now();
    try {
        var resp = await _sb.client.from('cafe_data').upsert({ id: 'main', data: DB, updated_at: new Date().toISOString() });
        if (resp.error) console.warn('Supabase 保存失败:', resp.error);
        else console.log('Supabase 已同步');
    } catch (e) { console.warn('Supabase 保存异常:', e); }
    _sb.saving = false;
    updSyncInd();
}

var _sbTimer = null;
function sbScheduleSave() {
    if (!_sb.ready) return;
    if (_sbTimer) clearTimeout(_sbTimer);
    _sbTimer = setTimeout(sbSave, 2000);
}

async function sbSyncOnStart() {
    if (!_sb.ready) return;
    var remote = await sbLoad();
    if (remote) { DB = remote; saveDB(DB); toast('云端已加载'); }
}

function updSyncInd() {
    var el = $id('syncInd'); if (!el) return;
    el.innerHTML = _sb.ready
        ? '<span class="sync-dot" style="background:var(--gn)"></span>已同步'
        : '<span class="sync-dot" style="background:var(--tx-m)"></span>本地';
}


// ==================== 18. 同步码 ====================
function genSyncCode() {
    try {
        var data = JSON.stringify(DB);
        var encoded = btoa(unescape(encodeURIComponent(data)));

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

function copySyncCode() {
    var textarea = $id('syncCodeOutput');
    if (!textarea) return;

    textarea.select();
    textarea.setSelectionRange(0, 99999);

    try {
        document.execCommand('copy');
        toast('已复制到剪贴板');
    } catch (e) {
        if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(textarea.value)
                .then(function() { toast('已复制到剪贴板'); })
                .catch(function() { toast('复制失败，请手动选择复制'); });
        } else {
            toast('复制失败，请手动选择复制');
        }
    }
}

function importSyncCode() {
    var h = '<h3>导入同步码</h3>';
    h += '<div style="font-size:.74rem;color:var(--tx-m);margin-bottom:10px">粘贴之前生成的同步码，将覆盖当前所有数据</div>';
    h += '<textarea id="syncCodeInput" style="width:100%;height:300px;font-family:monospace;font-size:.7rem;resize:vertical" placeholder="粘贴同步码..."></textarea>';
    h += '<div class="brow" style="margin-top:10px">';
    h += '<button class="btn p" onclick="doImportSyncCode()">导入</button>';
    h += '<button class="btn" onclick="closeModal()">取消</button></div>';
    showModal(h, 600);
}

function doImportSyncCode() {
    var input = $id('syncCodeInput');
    if (!input) return;

    var code = (input.value || '').trim();
    if (!code) { toast('请粘贴同步码'); return; }

    code = code.replace(/\n/g, '').replace(/\r/g, '');

    try {
        var decoded = decodeURIComponent(escape(atob(code)));
        var data = JSON.parse(decoded);

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
        goPage(_curPage || 'dash');
    } catch (e) {
        toast('导入失败：同步码格式错误或已损坏');
        console.error('导入同步码失败:', e);
    }
}
