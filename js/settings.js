// ---------- 设置主页面 ----------
function rData() {
    var h = '';

    // 用户账号
    h += '<div class="sec">用户账号</div>';
    h += '<div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:14px;margin-bottom:12px">';
    if (_auth.loggedIn && _auth.user) {
        var _uname = (DB.settings && DB.settings.user_name) || '';
        var _uavatar = (DB.settings && DB.settings.user_avatar) || '';
        h += '<div style="display:flex;align-items:center;gap:12px;margin-bottom:10px">';
        if (_uavatar) {
            h += '<img src="' + _uavatar + '" style="width:42px;height:42px;border-radius:50%;object-fit:cover">';
        } else {
            h += '<div style="width:42px;height:42px;border-radius:50%;background:var(--ac);color:#fff;display:flex;align-items:center;justify-content:center;font-size:.92rem;font-weight:700">' + (_uname || (_auth.user.email || '?')).charAt(0).toUpperCase() + '</div>';
        }
        h += '<div><div style="font-size:.82rem;font-weight:600">' + (_uname || '未设置昵称') + '</div>';
        h += '<div style="font-size:.68rem;color:var(--tx-m)">' + (_auth.user.email || '') + '</div></div>';
        h += '</div>';
        h += '<div class="brow"><button class="btn" onclick="showProfileModal()">编辑资料</button>';
        h += '<button class="btn d" onclick="doLogout()">退出登录</button></div>';
    } else {
        h += '<div style="font-size:.78rem;color:var(--tx-s);margin-bottom:10px">登录后可录入和修改数据</div>';
        h += '<div class="brow"><button class="btn p" onclick="showLoginModal()">登录 / 注册</button></div>';
    }
    h += '</div>';

    // 店铺信息
    var shopName = (DB.settings && DB.settings.ax_shop_name) || '';
    var shopIcon = (DB.settings && DB.settings.ax_shop_icon) || '☕';
    var shopSub = (DB.settings && DB.settings.ax_shop_sub) || 'COFFEE';
    h += '<div class="sec">店铺信息</div>';
    h += '<div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:14px;margin-bottom:12px">';
    h += '<div class="hrow" style="margin-bottom:10px"><label>店名</label><input class="inp" id="shopNameInput" style="flex:1" value="' + shopName + '" placeholder="输入店铺名称"></div>';
    h += '<div style="margin-bottom:8px"><label style="font-size:.72rem;color:var(--tx-s);display:block;margin-bottom:6px">图标</label>';
    h += '<div style="display:flex;gap:6px;flex-wrap:wrap">';
    ['☕','🍵','🧁','🍰','🫖','🧋','🏪','🏠'].forEach(function(icon) {
        h += '<div onclick="pickShopIcon(this,\'' + icon + '\')" style="width:36px;height:36px;border-radius:8px;border:1.5px solid ' + (icon === shopIcon ? 'var(--ac)' : 'var(--bd)') + ';display:flex;align-items:center;justify-content:center;font-size:1.1rem;cursor:pointer;transition:border-color .15s;flex-shrink:0">' + icon + '</div>';
    });
    h += '<input class="inp" id="shopIconInput" style="width:60px;text-align:center;font-size:1rem" maxlength="2" value="' + shopIcon + '" placeholder="自定义">';
    h += '</div></div>';
    h += '<div class="hrow"><label>副标题</label><input class="inp" id="shopSubInput" style="flex:1" value="' + shopSub + '" placeholder="COFFEE / TEA / RESTAURANT"></div>';
    h += '<div class="brow"><button class="btn p" onclick="saveShopInfo()">保存店铺信息</button></div>';
    h += '</div>';

    // 显示设置
    h += '<div class="sec">显示设置</div>';
    h += '<div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:14px;margin-bottom:12px">';

    // 字体
    h += '<div class="hrow" style="margin-bottom:8px">';
    h += '<label>标题</label>';
    h += '<select class="inp" onchange="setFontSetting(\'heading\',this.value)">';
    [{ v: '', l: '默认' }, { v: 'noto-serif', l: '思源宋体' }, { v: 'noto-sans', l: '思源黑体' }, { v: 'lxgw-serif', l: '霞鹜文楷' }].forEach(function(f) {
        h += '<option value="' + f.v + '"' + ((localStorage.getItem('ax_font_heading') || '') === f.v ? ' selected' : '') + '>' + f.l + '</option>';
    });
    h += '</select>';

    h += '<label>正文</label>';
    h += '<select class="inp" onchange="setFontSetting(\'body\',this.value)">';
    [{ v: '', l: '默认' }, { v: 'noto-sans', l: '思源黑体' }, { v: 'lxgw-wenkai', l: '霞鹜文楷' }, { v: 'ma-shan', l: '毛笔楷' }].forEach(function(f) {
        h += '<option value="' + f.v + '"' + ((localStorage.getItem('ax_font_body') || '') === f.v ? ' selected' : '') + '>' + f.l + '</option>';
    });
    h += '</select>';

    h += '<label>数字</label>';
    h += '<select class="inp" onchange="setFontSetting(\'number\',this.value)">';
    [{ v: '', l: '默认' }, { v: 'dm-mono', l: 'DM Mono' }, { v: 'lexend', l: 'Lexend' }, { v: 'noto-sans', l: '黑体' }].forEach(function(f) {
        h += '<option value="' + f.v + '"' + ((localStorage.getItem('ax_font_number') || '') === f.v ? ' selected' : '') + '>' + f.l + '</option>';
    });
    h += '</select>';
    h += '</div>';

    // 字号 + 圆角 + 间距
    h += '<div class="hrow">';
    h += '<label>字号</label>';
    h += '<select class="inp" onchange="setFontSize(this.value)">';
    [{ v: '12', l: '紧凑 12px' }, { v: '14', l: '偏小 14px' }, { v: '15', l: '适中 15px' }, { v: '17', l: '标准 17px' }, { v: '19', l: '偏大 19px' }, { v: '22', l: '最大 22px' }].forEach(function(s) {
        h += '<option value="' + s.v + '"' + ((localStorage.getItem('ax_fs') || '17') === s.v ? ' selected' : '') + '>' + s.l + '</option>';
    });
    h += '</select>';

    h += '<label>圆角</label>';
    h += '<select class="inp" onchange="setRadius(this.value)">';
    [{ v: '6', l: '小 6px' }, { v: '10', l: '中 10px' }, { v: '14', l: '大 14px' }, { v: '20', l: '圆润 20px' }].forEach(function(r) {
        h += '<option value="' + r.v + '"' + ((localStorage.getItem('ax_radius') || '10') === r.v ? ' selected' : '') + '>' + r.l + '</option>';
    });
    h += '</select>';

    h += '<label>间距</label>';
    h += '<select class="inp" onchange="setSpacing(this.value)">';
    [{ v: 'compact', l: '紧凑' }, { v: 'normal', l: '标准' }, { v: 'loose', l: '宽松' }].forEach(function(s) {
        h += '<option value="' + s.v + '"' + ((localStorage.getItem('ax_spacing') || 'normal') === s.v ? ' selected' : '') + '>' + s.l + '</option>';
    });
    h += '</select>';
    h += '</div>';

    h += '</div>';

    // MiMo配置
    h += '<div class="sec">MiMo配置</div>';
    h += '<div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:14px;margin-bottom:12px">';
    h += '<p style="font-size:.74rem;color:var(--tx-s);margin-bottom:10px">用于采购单拍照识别，接入小米MiMo视觉API</p>';
    h += '<div class="hrow"><label>API地址</label><input class="inp" id="mimoEndpoint" style="flex:2" placeholder="https://token-plan-cn.xiaomimimo.com/v1/chat/completions" value="' + (localStorage.getItem('ax_mimo_ep') || '') + '"></div>';
    h += '<div class="hrow"><label>API Key</label><div style="flex:2;position:relative;display:flex;align-items:center"><input class="inp" id="mimoKey" type="password" style="width:100%;padding-right:30px" placeholder="sk-xxxx" value="' + (localStorage.getItem('ax_mimo_key') || '') + '"><span onclick="toggleKeyVisibility()" style="position:absolute;right:8px;cursor:pointer;opacity:0.5" id="keyEye"><i data-feather="eye"></i></span></div></div>';
    h += '<div class="hrow"><label>模型</label>';
    h += '<select class="inp" id="mimoModel" style="max-width:200px">';
    ['mimo-v2.5', 'mimo-v2.5-pro', 'mimo-v2.5-tts-voiceclone', 'mimo-v2.5-tts-voicedesign', 'mimo-v2.5-tts', 'mimo-v2-pro', 'mimo-v2-omni', 'mimo-v2-tts'].forEach(function(m) {
        h += '<option' + ((localStorage.getItem('ax_mimo_model') || 'mimo-v2.5') === m ? ' selected' : '') + '>' + m + '</option>';
    });
    h += '</select></div>';
    h += '<div class="brow" style="margin-top:8px"><button class="btn p" onclick="saveMimoCfg()">保存配置</button></div>';
    h += '</div>';

    // Supabase 云同步
    h += '<div class="sec">Supabase 云同步</div>';
    h += '<div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:14px;margin-bottom:12px">';
    h += '<p style="font-size:.74rem;color:var(--gn)">✓ 已连接 Supabase</p>';
    h += '<div style="font-size:.68rem;color:var(--tx-m);margin-top:4px">数据按账号隔离，每个登录账号独立存储</div>';
    h += '<div class="brow" style="margin-top:8px"><button class="btn p" onclick="sbSave().then(function(){toast(\'已上传\')})">上传</button>';
    h += '<button class="btn" onclick="sbSyncOnStart().then(function(){goPage(_curPage||\'dash\');toast(\'已下载\')})">下载</button></div>';
    h += '</div>';

    // 数据码（游客不可用）
    if (!_guest || _auth.loggedIn) {
        h += '<div class="sec">数据码</div>';
        h += '<div class="brow" ><button class="btn" onclick="genSyncCode()">生成</button>';
        h += '<button class="btn" onclick="importSyncCode()">导入</button></div>';
    }

    // 数据统计
    h += '<div class="sec">数据统计</div>';
    h += '<div class="cards"><div class="card"><div class="card-l">日报</div><div class="card-v">' + DB.dailyReports.length + '</div></div>';
    h += '<div class="card"><div class="card-l">采购</div><div class="card-v">' + DB.purchases.length + '</div></div>';
    h += '<div class="card"><div class="card-l">费用</div><div class="card-v">' + DB.expenses.length + '</div></div>';
    h += '<div class="card"><div class="card-l">仓库</div><div class="card-v">' + (DB.whItems || []).length + '</div></div></div>';

    // 数据修复
    h += '<div class="sec">数据修复</div>';
    h += '<div class="brow"><button class="btn" onclick="fixAllBrackets()">修复英文括号 → 中文括号</button></div>';
    h += '<div style="font-size:.68rem;color:var(--tx-m);margin-top:4px">将所有物品名称中的英文括号()替换为中文括号（）</div>';

    // 导入导出（游客不可用）
    if (!_guest || _auth.loggedIn) {
        h += '<div class="brow" ><button class="btn" onclick="expJSON()">导出JSON</button>';
        h += '<input type="file" id="impF" accept=".json" style="display:none" onchange="impJSON(event)">';
        h += '<button class="btn" onclick="document.getElementById(\'impF\').click()">导入</button></div>';
    }

    // 危险操作（游客不可用）
    if (!_guest || _auth.loggedIn) {
        h += '<div class="sec" style="color:var(--rd)">危险</div>';
        h += '<div class="brow" ><button class="btn d" onclick="if(confirm(\'清空全部数据？此操作不可恢复！\')){DB=initDB();DB._ts=Date.now();saveDB(DB);sbScheduleSave();toast(\'已清空\');rData()}">清空全部</button></div>';
    }

    setMain('设置', h);
    if (typeof feather !== 'undefined') feather.replace();
}

// ---- 编辑资料弹窗 ----
function showProfileModal() {
    var uname = (DB.settings && DB.settings.user_name) || '';
    var uavatar = (DB.settings && DB.settings.user_avatar) || '';

    var h = '<div style="max-width:380px;margin:0 auto">';
    h += '<h3 style="margin-bottom:16px">编辑资料</h3>';

    // 头像预览
    h += '<div style="text-align:center;margin-bottom:16px">';
    h += '<div id="profileAvatarWrap" style="width:72px;height:72px;border-radius:50%;margin:0 auto 8px;cursor:pointer;overflow:hidden;border:2px dashed var(--bd);display:flex;align-items:center;justify-content:center" onclick="document.getElementById(\'avatarFileInput\').click()">';
    if (uavatar) {
        h += '<img id="profileAvatarImg" src="' + uavatar + '" style="width:100%;height:100%;object-fit:cover">';
    } else {
        h += '<span id="profileAvatarImg" style="font-size:1.5rem;color:var(--tx-m)">📷</span>';
    }
    h += '</div>';
    h += '<div style="font-size:.68rem;color:var(--tx-m)">点击更换头像</div>';
    h += '<input type="file" id="avatarFileInput" accept="image/*" style="display:none" onchange="handleAvatarUpload(event)">';
    h += '</div>';

    // 昵称
    h += '<div class="hrow" style="margin-bottom:12px"><label>昵称</label><input class="inp" id="profileName" style="flex:1" placeholder="输入昵称" value="' + uname + '"></div>';

    h += '<div class="brow" style="justify-content:flex-end">';
    h += '<button class="btn" onclick="closeModal()">取消</button>';
    h += '<button class="btn p" onclick="saveProfile()">保存</button>';
    h += '</div>';
    h += '</div>';

    showModal(h, 420);
    window._pendingAvatar = null;
}

// 头像上传处理
function handleAvatarUpload(e) {
    var file = e.target.files[0];
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function(ev) {
        var img = new Image();
        img.onload = function() {
            var c = document.createElement('canvas');
            var size = 120;
            c.width = size; c.height = size;
            var ctx = c.getContext('2d');
            // 居中裁剪为正方形
            var min = Math.min(img.width, img.height);
            var sx = (img.width - min) / 2;
            var sy = (img.height - min) / 2;
            ctx.drawImage(img, sx, sy, min, min, 0, 0, size, size);
            var dataUrl = c.toDataURL('image/jpeg', 0.7);
            window._pendingAvatar = dataUrl;
            // 更新预览
            var wrap = document.getElementById('profileAvatarWrap');
            if (wrap) wrap.innerHTML = '<img src="' + dataUrl + '" style="width:100%;height:100%;object-fit:cover">';
            toast('头像已选择');
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}

// 保存资料
function saveProfile() {
    var name = (document.getElementById('profileName').value || '').trim();
    if (!DB.settings) DB.settings = {};
    DB.settings.user_name = name;
    if (window._pendingAvatar) {
        DB.settings.user_avatar = window._pendingAvatar;
    }
    window._pendingAvatar = null;
    DB._ts = Date.now();
    saveDB(DB);
    sbScheduleSave();
    closeModal();
    updateAuthUI();
    rData();
    toast('资料已保存');
}

// ---- 店铺信息 ----
function pickShopIcon(el, icon) {
    document.getElementById('shopIconInput').value = icon;
    el.parentElement.querySelectorAll('div').forEach(function(d) { d.style.borderColor = 'var(--bd)'; });
    el.style.borderColor = 'var(--ac)';
}

function saveShopInfo() {
    var name = (document.getElementById('shopNameInput').value || '').trim();
    var icon = (document.getElementById('shopIconInput').value || '').trim() || '☕';
    var sub = (document.getElementById('shopSubInput').value || '').trim() || 'COFFEE';
    _syncSetting('ax_shop_name', name);
    _syncSetting('ax_shop_icon', icon);
    _syncSetting('ax_shop_sub', sub);
    updateShopDisplay();
    toast('店铺信息已保存');
}

function updateShopDisplay() {
    var name = localStorage.getItem('ax_shop_name') || '';
    var icon = localStorage.getItem('ax_shop_icon') || '☕';
    var sub = localStorage.getItem('ax_shop_sub') || 'COFFEE';
    var displayName = name || '经营管理';
    document.title = name ? name + ' · 经营管理' : '经营管理';
    var fnavLabel = document.getElementById('fnavLabel');
    if (fnavLabel) fnavLabel.textContent = name ? name + ' · 经营管理' : '经营管理';
    var pageIcon = document.querySelector('.page-icon');
    if (pageIcon) pageIcon.textContent = icon;
    var toolbarLogo = document.querySelector('.toolbar-logo');
    if (toolbarLogo) {
        toolbarLogo.title = name || '经营管理';
        toolbarLogo.querySelector('div:first-child').textContent = displayName;
        var subEl = toolbarLogo.querySelector('div:nth-child(2)');
        if (subEl) subEl.textContent = sub;
    }
}

// ---- 复制报表链接 ----
// 更新分享链接
function copyDashLink() {
    var input = document.getElementById('dashLinkInput');
    var link = '';
    if (input) {
        link = input.value;
    } else {
        // 如果没有input元素，直接生成链接
        link = window.location.origin + window.location.pathname.replace(/index\.html$/, '').replace(/\/$/, '/') + 'dashboard.html';
    }
    if (!link) return;

    try {
        navigator.clipboard.writeText(link).then(function(){ toast('链接已复制'); });
    } catch(e) {
        // fallback
        var temp = document.createElement('textarea');
        temp.value = link;
        document.body.appendChild(temp);
        temp.select();
        document.execCommand('copy');
        document.body.removeChild(temp);
        toast('链接已复制');
    }
}

// API Key显示/隐藏切换
function toggleKeyVisibility() {
    var input = document.getElementById('mimoKey');
    var eye = document.getElementById('keyEye');
    if (input.type === 'password') {
        input.type = 'text';
        eye.innerHTML = '<i data-feather="eye-off"></i>';
    } else {
        input.type = 'password';
        eye.innerHTML = '<i data-feather="eye"></i>';
    }
    feather.replace();
}

function saveMimoCfg() {
    var ep = document.getElementById('mimoEndpoint').value.trim();
    var key = document.getElementById('mimoKey').value.trim();
    var model = document.getElementById('mimoModel').value.trim();
    if (ep) _syncSetting('ax_mimo_ep', ep);
    if (key) _syncSetting('ax_mimo_key', key);
    if (model) _syncSetting('ax_mimo_model', model);
    toast('已保存MiMo配置');
}

// 应用主题颜色（从 localStorage 读取，写入 CSS 变量）
function applyTheme() {
    var theme = localStorage.getItem('ax_theme') || 'light';
    var root = document.documentElement;

    if (theme === 'dark') {
        root.style.setProperty('--bg', '#0d0d0d');
        root.style.setProperty('--surface', '#1a1a1a');
        root.style.setProperty('--card', '#1e1e1e');
        root.style.setProperty('--card-h', '#252525');
        root.style.setProperty('--ac', '#c9a84c');
        root.style.setProperty('--tx', '#f0ece4');
        root.style.setProperty('--tx-m', '#8a8580');
        root.style.setProperty('--tx-s', '#6a6560');
        root.style.setProperty('--bd', '#2d2d2d');
        root.style.setProperty('--bd-l', '#222');
        root.style.setProperty('--gn', '#34d399');
        root.style.setProperty('--rd', '#f87171');
        root.style.setProperty('--og', '#fb923c');
    } else {
        root.style.setProperty('--bg', '#f5f2ec');
        root.style.setProperty('--surface', '#ffffff');
        root.style.setProperty('--card', '#ffffff');
        root.style.setProperty('--card-h', '#f0ece4');
        root.style.setProperty('--ac', '#8b6914');
        root.style.setProperty('--tx', '#2c2c2c');
        root.style.setProperty('--tx-m', '#888');
        root.style.setProperty('--tx-s', '#aaa');
        root.style.setProperty('--bd', '#e0dbd0');
        root.style.setProperty('--bd-l', '#eae5da');
        root.style.setProperty('--gn', '#2d8b5e');
        root.style.setProperty('--rd', '#c75450');
        root.style.setProperty('--og', '#d97706');
    }
}

// 调整全局字号
function setFontSize(v) {
    document.documentElement.style.fontSize = v + 'px';
    _syncSetting('ax_fs', v);
    toast('已调整');
}

// 切换字体设置（标题字体/正文字体等）
function setFontSetting(type, val) {
    _syncSetting('ax_font_' + type, val);
    applyFonts();
    toast('已切换');
}

// 应用字体设置：从localStorage读取用户选择的字体，更新CSS变量以应用到页面
function applyFonts(){
    var headingMap={
        '':'"Playfair Display",serif',
        'noto-serif':'"Noto Serif SC",serif',
        'noto-sans':'"Noto Sans SC",sans-serif',
        'dm-serif':'"DM Serif Display",serif',
        'syne':'"Syne",sans-serif',
        'bebas':'"Bebas Neue",sans-serif',
        'instrument':'"Instrument Serif",serif',
        'playfair':'"Playfair Display",serif',
        'cormorant':'"Cormorant Garamond",serif',
        'lxgw-serif':'"LXGW WenKai",serif'
    };
    var bodyMap={
        '':'"Noto Serif SC",Georgia,serif',
        'noto-sans':'"Noto Sans SC",sans-serif',
        'lxgw-wenkai':'"LXGW WenKai",serif',
        'source-serif':'"Source Serif 4",serif',
        'crimson':'"Crimson Pro",serif',
        'lora':'"Lora",serif',
        'dm-sans':'"DM Sans",sans-serif'
    };
    var numberMap={
        '':'"DM Mono","Lexend",monospace',
        'dm-mono':'"DM Mono",monospace',
        'lexend':'"Lexend",monospace',
        'noto-sans':'"Noto Sans SC",sans-serif',
        'courier':'"Courier New",monospace',
        'jetbrains':'"JetBrains Mono",monospace',
        'fira':'"Fira Code",monospace',
        'ibm-plex':'"IBM Plex Mono",monospace'
    };

    var h=localStorage.getItem('ax_font_heading')||'';
    var b=localStorage.getItem('ax_font_body')||'';
    var n=localStorage.getItem('ax_font_number')||'';

    document.documentElement.style.setProperty('--fd',headingMap[h]||headingMap['']);
    document.documentElement.style.setProperty('--fb',bodyMap[b]||bodyMap['']);
    document.documentElement.style.setProperty('--fm',numberMap[n]||numberMap['']);
}

// ---------- 圆角 ----------
function setRadius(v) {
    _syncSetting('ax_radius', v);
    document.documentElement.style.setProperty('--r', v + 'px');
    toast('已调整');
}

// ---------- 间距 ----------
function setSpacing(v) {
    _syncSetting('ax_spacing', v);
    applySpacing();
    toast('已调整');
}

function applySpacing() {
    var v = localStorage.getItem('ax_spacing') || 'normal';
    var root = document.documentElement;
    if (v === 'compact') { root.style.setProperty('--sp', '8px'); root.style.setProperty('--sp-l', '10px'); }
    else if (v === 'loose') { root.style.setProperty('--sp', '18px'); root.style.setProperty('--sp-l', '24px'); }
    else { root.style.setProperty('--sp', '12px'); root.style.setProperty('--sp-l', '16px'); }
}

// ---------- 修复英文括号 ----------
function fixAllBrackets() {
    if (!confirm('将把所有物品名称中的英文括号()替换为中文括号（），确定？')) return;
    var count = 0;
    // 修复采购物品
    DB.purchases.forEach(function(p) {
        (p.items || []).forEach(function(item) {
            if (item.name && (item.name.indexOf('(') >= 0 || item.name.indexOf(')') >= 0)) {
                item.name = fixBrackets(item.name);
                count++;
            }
        });
    });
    // 修复库存物品
    ['invTea', 'invCig', 'invAlc', 'invOther'].forEach(function(key) {
        (DB[key] || []).forEach(function(item) {
            if (item.name && (item.name.indexOf('(') >= 0 || item.name.indexOf(')') >= 0)) {
                item.name = fixBrackets(item.name);
                count++;
            }
        });
    });
    // 修复仓库物品
    (DB.whItems || []).forEach(function(item) {
        if (item.name && (item.name.indexOf('(') >= 0 || item.name.indexOf(')') >= 0)) {
            item.name = fixBrackets(item.name);
            count++;
        }
    });
    if (count > 0) {
        DB._ts = Date.now();
        saveDB(DB);
        sbScheduleSave();
        toast('已修复 ' + count + ' 个物品的括号');
        rData();
    } else {
        toast('没有需要修复的物品');
    }
}

// ---------- 导出JSON ----------
function expJSON() {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' }));
    a.download = '岸香咖啡_' + td() + '.json';
    a.click();
    toast('已导出');
}

// ---------- 导入JSON ----------
function impJSON(event) {
    var f = event.target.files[0];
    if (!f) return;
    var reader = new FileReader();
    reader.onload = function(e) {
        try {
            DB = JSON.parse(e.target.result);
            saveDB(DB);
            sbScheduleSave();
            toast('已导入');
            rData();
        } catch (err) { toast('导入失败：文件格式错误'); }
    };
    reader.readAsText(f);
    event.target.value = '';
}

