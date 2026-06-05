// ==================== 用户认证模块 ====================
// 基于 Supabase Auth 的邮箱/密码登录
// 未登录用户可浏览只读页面，写操作需要登录

var _auth = { loggedIn: false, user: null };
var _guest = (new URLSearchParams(window.location.search)).get('guest') === '1';

// ---------- 初始化认证 ----------
function authInit() {
    if (!_sb || !_sb.client) return;
    _sb.client.auth.getSession().then(function(res) {
        if (res.data && res.data.session) {
            _auth.loggedIn = true;
            _auth.user = res.data.session.user;
            _authLoadData();
        }
        updateAuthUI();
    });
    _sb.client.auth.onAuthStateChange(function(event, session) {
        if (session && session.user) {
            _auth.loggedIn = true;
            _auth.user = session.user;
            toast('已登录：' + (session.user.email || '用户'));
            _authLoadData();
        } else if (event === 'SIGNED_OUT') {
            _auth.loggedIn = false;
            _auth.user = null;
            _authClearLocal();
            DB = initDB();
            saveDB(DB);
            document.documentElement.removeAttribute('style');
            applyTheme(); applyFonts(); applySpacing();
            initConfig();
            updateAuthUI();
            goPage('dash');
            toast('已退出，本地数据已清除');
        }
    });
}

// 登录后加载共享数据
function _authLoadData() {
    sbSyncOnStart().then(function() {
        DB = loadDB();
        restoreSettings();
        updateAuthUI();
        // 不在这里调用goPage()，因为appInit()已经处理了
    });
}

// 清空所有本地存储的设置和数据
function _authClearLocal() {
    var keys = [
        'ax_cafe_v8', 'ax_mimo_ep', 'ax_mimo_key', 'ax_mimo_model',
        'ax_fl', 'ax_fs', 'ax_radius', 'ax_spacing',
        'ax_font_heading', 'ax_font_body', 'ax_font_number',
        'ax_theme', 'ax_gh_token', 'ax_gh_gist_id',
        'ax_baidu_ak', 'ax_baidu_sk'
    ];
    keys.forEach(function(k) { localStorage.removeItem(k); });
}

// ---------- 检查是否已登录 ----------
function requireAuth() {
    if (_guest && !_auth.loggedIn) { toast('游客模式，登录后可编辑数据'); return false; }
    if (!_auth.loggedIn) { showLoginModal(); toast('请先登录'); return false; }
    return true;
}

// ---------- 登录弹窗 ----------
function showLoginModal() {
    var h = '<div style="max-width:380px;margin:0 auto">';
    h += '<div style="text-align:center;margin-bottom:20px">';
    var _shopName = localStorage.getItem('ax_shop_name') || '经营管理';
    var _shopIcon = localStorage.getItem('ax_shop_icon') || '☕';
    h += '<div style="font-size:1.5rem;margin-bottom:6px">' + _shopIcon + '</div>';
    h += '<div style="font-size:.92rem;font-weight:700;color:var(--ac)">' + _shopName + '</div>';
    h += '<div style="font-size:.72rem;color:var(--tx-m);margin-top:4px">登录后可录入和修改数据</div>';
    h += '</div>';

    // 登录表单
    h += '<div id="authLoginForm">';
    h += '<div class="hrow" style="margin-bottom:8px"><input class="inp" id="authEmail" type="email" placeholder="邮箱" style="flex:1"></div>';
    h += '<div class="hrow" style="margin-bottom:12px"><input class="inp" id="authPass" type="password" placeholder="密码" style="flex:1"></div>';
    h += '<div class="brow" style="justify-content:flex-end">';
    h += '<button class="btn p" onclick="doLogin()" style="flex:1">登录</button>';
    h += '<button class="btn" onclick="switchAuthTab(\'reg\')">注册</button>';
    h += '</div>';
    h += '</div>';

    // 注册表单（默认隐藏）
    h += '<div id="authRegForm" style="display:none">';
    h += '<div class="hrow" style="margin-bottom:8px"><input class="inp" id="regEmail" type="email" placeholder="邮箱" style="flex:1"></div>';
    h += '<div class="hrow" style="margin-bottom:8px"><input class="inp" id="regPass" type="password" placeholder="密码（至少6位）" style="flex:1"></div>';
    h += '<div class="hrow" style="margin-bottom:12px"><input class="inp" id="regPass2" type="password" placeholder="确认密码" style="flex:1"></div>';
    h += '<div class="brow" style="justify-content:flex-end">';
    h += '<button class="btn p" onclick="doRegister()" style="flex:1">注册</button>';
    h += '<button class="btn" onclick="switchAuthTab(\'login\')">返回登录</button>';
    h += '</div>';
    h += '</div>';

    h += '</div>';
    showModal(h, 420);
}

// 切换 登录/注册 标签
function switchAuthTab(tab) {
    var login = document.getElementById('authLoginForm');
    var reg = document.getElementById('authRegForm');
    if (!login || !reg) return;
    if (tab === 'reg') {
        login.style.display = 'none';
        reg.style.display = '';
    } else {
        login.style.display = '';
        reg.style.display = 'none';
    }
}

// ---------- 登录 ----------
function doLogin() {
    var email = (document.getElementById('authEmail').value || '').trim();
    var pass = document.getElementById('authPass').value || '';
    if (!email || !pass) { toast('请填写邮箱和密码'); return; }
    if (!_sb.client) { toast('请先配置 Supabase 连接'); return; }

    _sb.client.auth.signInWithPassword({ email: email, password: pass }).then(function(res) {
        if (res.error) { toast('登录失败：' + res.error.message); return; }
        closeModal();
        toast('登录成功');
    });
}

// ---------- 注册 ----------
function doRegister() {
    var email = (document.getElementById('regEmail').value || '').trim();
    var pass = document.getElementById('regPass').value || '';
    var pass2 = document.getElementById('regPass2').value || '';
    if (!email || !pass) { toast('请填写邮箱和密码'); return; }
    if (pass.length < 6) { toast('密码至少6位'); return; }
    if (pass !== pass2) { toast('两次密码不一致'); return; }
    if (!_sb.client) { toast('请先配置 Supabase 连接'); return; }

    _sb.client.auth.signUp({ email: email, password: pass }).then(function(res) {
        if (res.error) { toast('注册失败：' + res.error.message); return; }
        toast('注册成功，请查收验证邮件');
        switchAuthTab('login');
    });
}

// ---------- 登出 ----------
function doLogout() {
    if (!_sb.client) return;
    if (!confirm('确定退出登录？当前数据会上传到云端，所有本地设置将清除。')) return;
    sbSave().then(function() {
        return _sb.client.auth.signOut();
    }).catch(function() {
        return _sb.client.auth.signOut();
    });
}

// ---------- 更新导航栏用户状态 ----------
function updateAuthUI() {
    var el = document.getElementById('authBadge');
    if (!el) return;
    if (_guest && !_auth.loggedIn) {
        el.innerHTML = '<a href="login.html" style="font-size:.65rem;color:var(--ac);text-decoration:none;border:1px solid var(--ac);border-radius:12px;padding:3px 10px;white-space:nowrap;transition:background .2s" onmouseenter="this.style.background=\'var(--ac-b)\'" onmouseleave="this.style.background=\'transparent\'">登录</a>';
        return;
    }
    if (_auth.loggedIn && _auth.user) {
        var email = _auth.user.email || '';
        var uname = (DB.settings && DB.settings.user_name) || '';
        var uavatar = (DB.settings && DB.settings.user_avatar) || '';
        var display = uname || email;
        var initial = display.charAt(0).toUpperCase();
        if (uavatar) {
            el.innerHTML = '<img src="' + uavatar + '" onclick="goPage(\'settings\')" style="width:28px;height:28px;border-radius:50%;object-fit:cover;cursor:pointer" title="' + display + '">';
        } else {
            el.innerHTML = '<div onclick="goPage(\'settings\')" style="width:28px;height:28px;border-radius:50%;background:var(--ac);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.7rem;font-weight:700;cursor:pointer" title="' + display + '">' + initial + '</div>';
        }
    } else {
        el.innerHTML = '<button onclick="showLoginModal()" class="fnav-icon-btn" title="登录" style="font-size:.82rem">👤</button>';
    }
}
