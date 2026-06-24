var _sb = { client: null, ready: false, saving: false };

// Supabase 配置（内置）
var _SB_URL = 'https://aahvuwdifuqhwyanrvwj.supabase.co';
var _SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFhaHZ1d2RpZnVxaHd5YW5ydndqIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyMDc5MzMsImV4cCI6MjA5NDc4MzkzM30.6DByxb_Pk_wGVzp189SslD3B8gDoY9H7CpyWEySgFS8';

// 初始化连接
function sbInit() {
    if (typeof supabase === 'undefined') { console.warn('Supabase SDK 未加载'); return; }
    _sb.client = supabase.createClient(_SB_URL, _SB_KEY);
    _sb.ready = true;
    console.log('Supabase 已连接');
}

// 获取数据行ID（每个账号独立存储）
function _sbDataId() {
    if (_auth && _auth.loggedIn && _auth.user) return _auth.user.id;
    return null;
}

// 从云端下载当前用户的数据
// force 参数：true 时强制下载，忽略时间戳比较
async function sbLoad(force) {
    if (!_sb.ready) { console.log('sbLoad: Supabase未就绪'); return null; }
    var dataId = _sbDataId();
    if (!dataId) { console.log('sbLoad: 未登录'); return null; }
    try {
        console.log('sbLoad: 开始从云端获取数据, 数据ID:', dataId);
        var resp = await _sb.client.from('cafe_data').select('data, updated_at').eq('id', dataId).single();
        if (resp.error) { console.log('sbLoad: 查询出错', resp.error); return null; }
        if (!resp.data) { console.log('sbLoad: 云端没有数据'); return null; }
        var remote = resp.data.data;
        console.log('sbLoad: 获取到云端数据', '云端_ts:', remote._ts, '本地_ts:', DB._ts || 0);
        // 强制下载或云端数据更新时返回
        if (force || (remote._ts && remote._ts > (DB._ts || 0))) {
            console.log('sbLoad: 返回云端数据');
            return remote;
        } else {
            console.log('sbLoad: 本地数据更新，跳过下载');
        }
    } catch (e) { console.error('Supabase 读取失败:', e); }
    return null;
}

// 上传当前用户的数据到云端（同时写入共享行供报表页读取）
async function sbSave() {
    if (!_sb.ready || _sb.saving) { console.log('跳过保存: ready=' + _sb.ready + ', saving=' + _sb.saving); return; }
    var dataId = _sbDataId();
    if (!dataId) { console.log('跳过保存: 未登录'); return; }
    _sb.saving = true;
    DB._ts = Date.now();
    console.log('开始上传数据...', '数据ID:', dataId, '数据大小:', JSON.stringify(DB).length);
    try {
        var payload = { id: dataId, data: DB, updated_at: new Date().toISOString() };
        var result1 = await _sb.client.from('cafe_data').upsert(payload);
        console.log('用户数据上传结果:', result1);
        // 同时写入共享行，供 dashboard.html 读取
        var result2 = await _sb.client.from('cafe_data').upsert({ id: 'shop_data', data: DB, updated_at: new Date().toISOString() });
        console.log('共享行上传结果:', result2);
        // 检查上传结果
        if (result1.error) {
            toast('上传失败: ' + (result1.error.message || '未知错误'));
        } else if (result2.error) {
            toast('共享行上传失败: ' + (result2.error.message || '未知错误'));
        }
        // 上传成功不显示提示，避免频繁打扰用户
    } catch (e) {
        console.error('Supabase 保存异常:', e);
        toast('上传异常: ' + e.message);
    }
    _sb.saving = false;
    updSyncInd();
}

// 防抖保存（数据变更后2秒自动上传）
var _sbTimer = null;
function sbScheduleSave() {
    if (!_sb.ready) return;
    if (_sbTimer) clearTimeout(_sbTimer);
    _sbTimer = setTimeout(sbSave, 2000);
}

// 启动时同步：下载用户数据，同时同步到共享行
async function sbSyncOnStart() {
    if (!_sb.ready) return;
    var remote = await sbLoad();
    if (remote) { DB = remote; saveDB(DB); toast('云端已加载'); }
    // 同步到共享行供报表页读取
    if (_sbDataId()) {
        try { await _sb.client.from('cafe_data').upsert({ id: 'shop_data', data: DB, updated_at: new Date().toISOString() }); } catch(e) {}
    }
}

// 更新同步状态指示灯
function updSyncInd() {
    var el = $id('syncInd'); if (!el) return;
    el.innerHTML = _sb.ready
        ? '<span class="sync-dot" style="background:var(--gn)"></span>已同步'
        : '<span class="sync-dot" style="background:var(--tx-m)"></span>本地';
}
