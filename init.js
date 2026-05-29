// init.js - 初始化启动 + Chart.js 加载

// ==================== 19. 初始化 ====================

function appInit() {
    DB = loadDB();
    initConfig();

    migrateAreaCats();

    applyTheme(); applyFonts(); applySpacing(); initToolbar();
    var savedFS = localStorage.getItem('ax_fs');
    if (savedFS) document.documentElement.style.fontSize = savedFS + 'px';
    var savedR = localStorage.getItem('ax_radius');
    if (savedR) document.documentElement.style.setProperty('--r', savedR + 'px');
    if (['ax_font_heading','ax_font_body','ax_font_number'].some(function(k){return localStorage.getItem(k)})) applyFonts();

    renderNav();
    goPage('dash');

    var headerDate = document.getElementById('headerDate');
    if (headerDate) {
        var today = new Date();
        var dow = ['日','一','二','三','四','五','六'][today.getDay()];
        headerDate.textContent = today.getFullYear() + '.' +
            String(today.getMonth()+1).padStart(2,'0') + '.' +
            String(today.getDate()).padStart(2,'0') + ' 星期' + dow;
    }

    sbInit();
    if (_sb.ready) sbSyncOnStart();
    updSyncInd();

    console.log('岸香咖啡经营管理系统初始化完成');
}

window.addEventListener('scroll', function() {
  var fnav = $id('fnav');
  if (!fnav) return;
  if (window.scrollY > 10) fnav.classList.add('scrolled');
  else fnav.classList.remove('scrolled');
});

function initToolbar() {
  var groups = {
    toolbarMain: [],
    toolbarInv: [],
    toolbarReport: [],
    toolbarSys: []
  };

  var currentGroup = 'toolbarMain';
  NAV.forEach(function(item) {
    if (item.sep) {
      if (currentGroup === 'toolbarMain') currentGroup = 'toolbarInv';
      else if (currentGroup === 'toolbarInv') currentGroup = 'toolbarReport';
      else if (currentGroup === 'toolbarReport') currentGroup = 'toolbarSys';
      return;
    }
    groups[currentGroup].push(item);
  });

  Object.keys(groups).forEach(function(containerId) {
    var el = $id(containerId);
    if (!el) return;
    el.innerHTML = groups[containerId].map(function(p) {
      return '<button class="toolbar-btn" data-page="' + p.id + '" onclick="goPage(\'' + p.id + '\')" title="' + p.label + '">' +
        '<span class="ticon">' + p.icon + '</span>' +
        '<span class="tlabel">' + p.label + '</span>' +
        (p.badge ? '<span class="badge-dot"></span>' : '') +
        '</button>';
    }).join('');
  });

  var first = $id('toolbarMain');
  if (first) {
    var btn = first.querySelector('.toolbar-btn');
    if (btn) btn.classList.add('active');
  }
}

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', appInit);
} else {
    appInit();
}


// ==================== 20. Chart.js 加载 ====================

var _chartSrcs = [
    'https://cdn.bootcdn.net/ajax/libs/Chart.js/4.4.0/chart.umd.min.js',
    'https://unpkg.com/chart.js@4.4.0/dist/chart.umd.min.js',
    'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

function _loadChart(i) {
    if (i >= _chartSrcs.length) {
        console.warn('Chart.js 加载失败，图表功能不可用');
        return;
    }
    var s = document.createElement('script');
    s.src = _chartSrcs[i];
    s.onload = function() {
        window._chartLoaded = true;
        console.log('Chart.js 加载成功');
    };
    s.onerror = function() {
        console.warn('Chart.js CDN ' + (i + 1) + ' 失败，尝试下一个...');
        _loadChart(i + 1);
    };
    document.head.appendChild(s);
}

_loadChart(0);

// ==================== 21. 结束 ====================
