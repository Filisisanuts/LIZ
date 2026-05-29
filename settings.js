// settings.js - 设置

// ==================== 15. 设置 ====================

function rData() {
    var h = '';

    h += '<div class="sec">显示设置</div>';
    h += '<div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:14px;margin-bottom:12px">';

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

    h += '<div class="hrow">';
    h += '<label>字号</label>';
    h += '<select class="inp" onchange="setFontSize(this.value)">';
    [{ v: '12', l: '小 12px' }, { v: '13', l: '标准 13px' }, { v: '14', l: '中 14px' }, { v: '15', l: '大 15px' }, { v: '17', l: '特大 17px' }, { v: '19', l: '超大 19px' }].forEach(function(s) {
        h += '<option value="' + s.v + '"' + ((localStorage.getItem('ax_fs') || '13') === s.v ? ' selected' : '') + '>' + s.l + '</option>';
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

    h += '<div class="sec">MiMo配置</div>';
    h += '<div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:14px;margin-bottom:12px">';
    h += '<p style="font-size:.74rem;color:var(--tx-s);margin-bottom:10px">用于采购单拍照识别，接入小米MiMo视觉API</p>';
    h += '<div class="hrow"><label>API地址</label><input class="inp" id="mimoEndpoint" style="flex:2" placeholder="https://token-plan-cn.xiaomimimo.com/v1/chat/completions" value="' + (localStorage.getItem('ax_mimo_ep') || '') + '"></div>';
    h += '<div class="hrow"><label>API Key</label><input class="inp" id="mimoKey" style="flex:2" placeholder="sk-xxxx" value="' + (localStorage.getItem('ax_mimo_key') || '') + '"></div>';
    h += '<div class="hrow"><label>模型</label>';
    h += '<select class="inp" id="mimoModel" style="max-width:200px">';
    ['mimo-v2.5', 'mimo-v2.5-pro', 'mimo-v2.5-tts-voiceclone', 'mimo-v2.5-tts-voicedesign', 'mimo-v2.5-tts', 'mimo-v2-pro', 'mimo-v2-omni', 'mimo-v2-tts'].forEach(function(m) {
        h += '<option' + ((localStorage.getItem('ax_mimo_model') || 'mimo-v2.5') === m ? ' selected' : '') + '>' + m + '</option>';
    });
    h += '</select></div>';
    h += '<div class="brow" style="margin-top:8px"><button class="btn p" onclick="saveMimoCfg()">保存配置</button></div>';
    h += '</div>';

    h += '<div class="sec">Supabase 云同步</div>';
    h += '<div style="background:var(--card);border:1px solid var(--bd);border-radius:var(--r);padding:14px;margin-bottom:12px">';
    if(!_sb.ready){
        h += '<p style="font-size:.74rem;color:var(--tx-s);margin-bottom:10px">配置 Supabase 实现多设备云同步</p>';
        h += '<div class="hrow"><label>URL</label><input class="inp" id="sbUrl" style="flex:2" placeholder="https://xxxx.supabase.co" value="' + (localStorage.getItem('ax_sb_url')||'') + '"></div>';
        h += '<div class="hrow"><label>Key</label><input class="inp" id="sbKey" style="flex:2" placeholder="eyJ..." value="' + (localStorage.getItem('ax_sb_key')||'') + '"></div>';
        h += '<div class="brow" style="margin-top:8px"><button class="btn p" onclick="sbConnect()">连接</button></div>';
    }else{
        h += '<p style="font-size:.74rem;color:var(--gn)">✓ 已连接 Supabase</p>';
        h += '<div class="brow" style="margin-top:8px"><button class="btn" onclick="sbSave().then(function(){toast(\'已同步\')})">手动同步</button>';
        h += '<button class="btn d s" onclick="sbDisconnect()">断开</button></div>';
    }
    h += '</div>';

    h += '<div class="sec">数据码</div>';
    h += '<div class="brow" ><button class="btn" onclick="genSyncCode()">生成</button>';
    h += '<button class="btn" onclick="importSyncCode()">导入</button></div>';

    h += '<div class="sec">数据统计</div>';
    h += '<div class="cards"><div class="card"><div class="card-l">日报</div><div class="card-v">' + DB.dailyReports.length + '</div></div>';
    h += '<div class="card"><div class="card-l">采购</div><div class="card-v">' + DB.purchases.length + '</div></div>';
    h += '<div class="card"><div class="card-l">费用</div><div class="card-v">' + DB.expenses.length + '</div></div>';
    h += '<div class="card"><div class="card-l">仓库</div><div class="card-v">' + (DB.whItems || []).length + '</div></div></div>';

    h += '<div class="brow" ><button class="btn" onclick="expJSON()">导出JSON</button>';
    h += '<input type="file" id="impF" accept=".json" style="display:none" onchange="impJSON(event)">';
    h += '<button class="btn" onclick="document.getElementById(\'impF\').click()">导入</button></div>';

    h += '<div class="sec" style="color:var(--rd)">危险</div>';
    h += '<div class="brow" ><button class="btn d" onclick="if(confirm(\'清空全部数据？此操作不可恢复！\')){DB=initDB();DB._ts=Date.now();saveDB(DB);sbScheduleSave();toast(\'已清空\');rData()}">清空全部</button></div>';

    setMain('设置', h);
}

function saveMimoCfg() {
    var ep = document.getElementById('mimoEndpoint').value.trim();
    var key = document.getElementById('mimoKey').value.trim();
    var model = document.getElementById('mimoModel').value.trim();
    if (ep) localStorage.setItem('ax_mimo_ep', ep);
    if (key) localStorage.setItem('ax_mimo_key', key);
    if (model) localStorage.setItem('ax_mimo_model', model);
    toast('已保存MiMo配置');
}

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

function setFontSize(v) {
    document.documentElement.style.fontSize = v + 'px';
    localStorage.setItem('ax_fs', v);
    toast('已调整');
}

function setFontSetting(type, val) {
    localStorage.setItem('ax_font_' + type, val);
    applyFonts();
    toast('已切换');
}

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

function setRadius(v) {
    localStorage.setItem('ax_radius', v);
    document.documentElement.style.setProperty('--r', v + 'px');
    toast('已调整');
}

function setSpacing(v) {
    localStorage.setItem('ax_spacing', v);
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

function expJSON() {
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(DB, null, 2)], { type: 'application/json' }));
    a.download = '岸香咖啡_' + td() + '.json';
    a.click();
    toast('已导出');
}

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
