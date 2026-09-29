// 全站功能图标唯一来源：旧 JS 与 TypeScript 页面均使用 axIcon(name)。
(function () {
    var ICONS = {
        dashboard: '<rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><rect x="14" y="14" width="6" height="6" rx="1"/>',
        notebook: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M9 3v18M12 8h4M12 12h4M12 16h3"/>',
        basket: '<path d="M4 10h16l-1.3 9H5.3Z"/><path d="m8 10 4-6 4 6M8 14h.01M12 14h.01M16 14h.01"/>',
        receipt: '<path d="M5 3h14v18l-2.5-1.7L14 21l-2-1.7L9.5 21 7 19.3 5 21Z"/><path d="M9 8h6M9 12h6M9 16h3"/>',
        wallet: '<path d="M4 7a3 3 0 0 1 3-3h10v16H7a3 3 0 0 1-3-3Z"/><path d="M4 8h15a2 2 0 0 1 2 2v6h-6a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2h6"/><path d="M16 13h.01"/>',
        leaf: '<path d="M20 4C11 4 5 8.6 5 15c0 2.6 1.6 4.6 4.2 4.6C15.6 19.6 20 12.1 20 4Z"/><path d="M4 20c3-4.8 6.5-7 11-9"/>',
        package: '<path d="m4 7 8-4 8 4v10l-8 4-8-4Z"/><path d="m4 7 8 4 8-4M12 11v10"/>',
        wine: '<path d="M7 3h10v5a5 5 0 0 1-10 0Z"/><path d="M12 13v7M8 21h8"/>',
        gem: '<path d="m3 9 4-5h10l4 5-9 11Z"/><path d="m3 9h18M9 9l3 11 3-11M7 4l2 5m8-5-2 5"/>',
        warehouse: '<path d="m3 10 9-6 9 6v10H3Z"/><path d="M8 20v-6h8v6M7 10h.01M12 10h.01M17 10h.01"/>',
        alert: '<path d="m12 3 10 18H2Z"/><path d="M12 9v4M12 17h.01"/>',
        chart: '<path d="M4 20V10M10 20V4M16 20v-7M22 20H2"/><path d="m3 8 6-3 6 4 6-6"/>',
        trend: '<path d="M3 17 9 11l4 4 8-9"/><path d="M16 6h5v5"/>',
        calendar: '<rect x="4" y="5" width="16" height="15" rx="2"/><path d="M8 3v4M16 3v4M4 10h16M8 14h.01M12 14h.01M16 14h.01"/>',
        calendarRange: '<rect x="3" y="5" width="18" height="15" rx="2"/><path d="M7 3v4M17 3v4M3 10h18M7 14h10"/>',
        fileDownload: '<path d="M6 3h8l4 4v14H6Z"/><path d="M14 3v5h5M12 11v6M9 14l3 3 3-3"/>',
        tag: '<path d="M4 5v6l9 9 7-7-9-9Z"/><circle cx="8" cy="9" r="1"/>',
        send: '<path d="m21 3-7 18-4-8-7-4Z"/><path d="m10 13 5-5"/>',
        sliders: '<path d="M4 7h16M4 17h16M9 3v8M15 13v8"/><circle cx="9" cy="7" r="2"/><circle cx="15" cy="17" r="2"/>',
        menu: '<path d="M4 7h16M4 12h16M4 17h16"/>',
        user: '<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.1-6 8-6s6.5 2 8 6"/>',
        cloudCheck: '<path d="M7 18h10a4 4 0 0 0 .7-7.9A6 6 0 0 0 6.2 9 4.5 4.5 0 0 0 7 18Z"/><path d="m10 14 2 2 3-4"/>',
        circle: '<circle cx="12" cy="12" r="8"/>'
    };

    function safeClassName(className) {
        return String(className || '').replace(/[^a-zA-Z0-9_\-\s]/g, '').trim();
    }

    window.axIcon = function (name, className) {
        var paths = ICONS[name] || ICONS.circle;
        var classes = 'ax-icon' + (className ? ' ' + safeClassName(className) : '');
        return '<svg class="' + classes + '" viewBox="0 0 24 24" aria-hidden="true" focusable="false">' + paths + '</svg>';
    };

    window.axRenderIcons = function (root) {
        var scope = root || document;
        scope.querySelectorAll('[data-ax-icon]').forEach(function (element) {
            element.innerHTML = window.axIcon(element.getAttribute('data-ax-icon'), element.getAttribute('data-ax-icon-class'));
        });
    };

    window.axRenderIcons();
})();
