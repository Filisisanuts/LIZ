// 主题感知业务控件。现有 select 保留原值和 change 事件，增强层负责展示与交互。

function axEscapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function(char) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char];
    });
}

function axDispatchChange(element) {
    if (!element) return;
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('input', { bubbles: true }));
}

function axCloseSelects(except) {
    document.querySelectorAll('.ax-select.open').forEach(function(select) {
        if (select === except) return;
        select.classList.remove('open');
        var menu = select.querySelector('.ax-select-menu');
        if (menu) menu.hidden = true;
        var trigger = select.querySelector('.ax-select-trigger');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
}

function axCreateEnhancedSelect(native) {
    var mode = native.getAttribute('data-ax-mode') || (native.multiple ? 'multi' : 'single');
    var allowCustom = native.getAttribute('data-allow-custom') === 'true';
    var options = Array.prototype.slice.call(native.options);
    var searchable = options.length > 10 || native.getAttribute('data-searchable') === 'true';
    var wrapper = document.createElement('div');
    var trigger = document.createElement('button');
    var menu = document.createElement('div');
    var search = null;
    var customRow = null;

    wrapper.className = 'ax-select' + (window.matchMedia('(max-width: 768px)').matches ? ' ax-select-sheet' : '');
    wrapper.dataset.mode = mode;
    trigger.type = 'button';
    trigger.className = 'ax-select-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    menu.className = 'ax-select-menu';
    menu.hidden = true;

    if (searchable) {
        search = document.createElement('input');
        search.type = 'search';
        search.className = 'ax-select-search';
        search.placeholder = '搜索…';
        search.setAttribute('aria-label', native.getAttribute('aria-label') || '搜索选项');
        menu.appendChild(search);
    }

    function selectedValues() {
        return Array.prototype.slice.call(native.selectedOptions || []).map(function(option) {
            return option.value;
        });
    }

    function refreshTrigger() {
        var selected = Array.prototype.slice.call(native.selectedOptions || []).filter(function(option) {
            return option.value !== '' && option.value !== '__custom';
        });
        var text;
        if (mode === 'multi') {
            text = selected.length === 0 ? '请选择' : selected.length <= 2
                ? selected.map(function(option) { return option.textContent; }).join('、')
                : '已选 ' + selected.length + ' 个';
        } else {
            text = selected.length ? selected[0].textContent : (native.getAttribute('data-placeholder') || '请选择');
        }
        trigger.innerHTML = '<span>' + axEscapeHtml(text) + '</span><span class="ax-select-chevron" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>';
    }

    function renderOptions(filter) {
        Array.prototype.slice.call(menu.querySelectorAll('.ax-select-option')).forEach(function(option) {
            option.remove();
        });
        var query = String(filter || '').trim().toLowerCase();
        options.forEach(function(option) {
            if (option.value === '__custom') return;
            if (query && option.textContent.toLowerCase().indexOf(query) < 0) return;
            var button = document.createElement('button');
            button.type = 'button';
            button.className = 'ax-select-option';
            button.setAttribute('role', 'option');
            button.setAttribute('aria-selected', option.selected ? 'true' : 'false');
            button.textContent = option.textContent;
            button.addEventListener('click', function() {
                if (mode === 'multi') {
                    option.selected = !option.selected;
                } else {
                    options.forEach(function(item) { item.selected = false; });
                    option.selected = true;
                    axCloseSelects();
                    trigger.focus();
                }
                axDispatchChange(native);
                refreshTrigger();
                renderOptions(search ? search.value : '');
            });
            if (customRow) menu.insertBefore(button, customRow);
            else menu.appendChild(button);
        });
    }

    trigger.addEventListener('click', function() {
        var opening = menu.hidden;
        axCloseSelects(wrapper);
        menu.hidden = !opening;
        wrapper.classList.toggle('open', opening);
        trigger.setAttribute('aria-expanded', String(opening));
        if (opening) {
            renderOptions(search ? search.value : '');
            if (search) {
                search.focus();
            } else {
                var first = menu.querySelector('.ax-select-option');
                if (first) first.focus();
            }
        }
    });

    trigger.addEventListener('keydown', function(event) {
        if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
            event.preventDefault();
            trigger.click();
        }
    });

    if (search) {
        search.addEventListener('input', function() { renderOptions(search.value); });
    }

    if (allowCustom) {
        customRow = document.createElement('div');
        customRow.className = 'ax-select-custom';
        var customButton = document.createElement('button');
        customButton.type = 'button';
        customButton.className = 'ax-select-create';
        customButton.textContent = '创建自定义选项…';
        customButton.addEventListener('click', function() {
            var customTargetId = native.getAttribute('data-custom-target');
            var customTarget = customTargetId ? document.getElementById(customTargetId) : null;
            native.value = '__custom';
            axDispatchChange(native);
            axCloseSelects();
            if (customTarget) {
                customTarget.style.display = '';
                customTarget.focus();
            } else {
                var value = window.prompt('输入新选项名称');
                if (value && value.trim()) {
                    var clean = value.trim();
                    var existing = options.find(function(option) { return option.textContent.trim() === clean; });
                    if (existing) {
                        existing.selected = true;
                    } else {
                        var option = document.createElement('option');
                        option.value = clean;
                        option.textContent = clean;
                        option.dataset.axDraft = 'true';
                        native.insertBefore(option, native.querySelector('option[value="__custom"]') || null);
                        options.push(option);
                        option.selected = true;
                    }
                    axDispatchChange(native);
                    refreshTrigger();
                }
            }
        });
        customRow.appendChild(customButton);
        menu.appendChild(customRow);
    }

    native.classList.add('ax-select-native');
    native.setAttribute('tabindex', '-1');
    native.setAttribute('aria-hidden', 'true');
    native.parentNode.insertBefore(wrapper, native);
    wrapper.appendChild(native);
    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);
    native.addEventListener('change', function() {
        refreshTrigger();
        renderOptions(search ? search.value : '');
    });
    refreshTrigger();
    renderOptions('');
}

function initAxSelects(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('select:not([data-ax-ready])').forEach(function(select) {
        select.dataset.axReady = 'true';
        var optionCount = select.options.length;
        var simple = !select.multiple
            && optionCount <= 6
            && select.getAttribute('data-ax-enhanced') !== 'true'
            && select.getAttribute('data-allow-custom') !== 'true'
            && select.getAttribute('data-searchable') !== 'true';
        if (simple) {
            select.classList.add('ax-select-simple');
            return;
        }
        axCreateEnhancedSelect(select);
    });
}

function initA11yEnhancements(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('button').forEach(function(button) {
        var text = (button.textContent || '').trim();
        if (!text && !button.getAttribute('aria-label')) button.setAttribute('aria-label', button.title || '操作按钮');
        if (/^[×✕✕☰‹›◀▶]+$/.test(text) && !button.getAttribute('aria-label')) {
            button.setAttribute('aria-label', text === '×' ? '删除' : text === '☰' ? '打开导航' : '切换');
        }
    });

    scope.querySelectorAll('input,select,textarea').forEach(function(control) {
        if (control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')) return;
        if (control.labels && control.labels.length) return;
        var wrapper = control.closest('.hrow,.field,label');
        var label = wrapper ? wrapper.querySelector('label') : null;
        var text = label ? (label.textContent || '').trim() : '';
        control.setAttribute('aria-label', text || control.getAttribute('placeholder') || control.id || '表单控件');
    });

    scope.querySelectorAll('[onclick]').forEach(function(element) {
        var tag = element.tagName;
        if (tag === 'BUTTON' || tag === 'A' || tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA' || tag === 'LABEL') return;
        if (!element.getAttribute('role')) element.setAttribute('role', 'button');
        if (!element.hasAttribute('tabindex')) element.setAttribute('tabindex', '0');
        if (!element.getAttribute('aria-label')) {
            element.setAttribute('aria-label', (element.textContent || element.title || '可点击操作').trim().slice(0, 40));
        }
        if (!element.dataset.axKeydown) {
            element.dataset.axKeydown = 'true';
            element.addEventListener('keydown', function(event) {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    element.click();
                }
            });
        }
    });
}

function axAutoSizeInput(input) {
    if (!input) return;
    var style = window.getComputedStyle(input);
    var canvas = axAutoSizeInput._canvas || (axAutoSizeInput._canvas = document.createElement('canvas'));
    var context = canvas.getContext('2d');
    if (!context) return;
    context.font = style.fontWeight + ' ' + style.fontSize + ' ' + style.fontFamily;
    var sample = input.value || input.getAttribute('placeholder') || ' ';
    var padding = parseFloat(style.paddingLeft) + parseFloat(style.paddingRight)
        + parseFloat(style.borderLeftWidth) + parseFloat(style.borderRightWidth);
    var min = Number(input.getAttribute('data-autosize-min')) || 80;
    var max = Number(input.getAttribute('data-autosize-max')) || 280;
    var width = context.measureText(sample).width + padding + 2;
    input.style.width = Math.round(Math.min(max, Math.max(min, width))) + 'px';
    input.style.flex = '0 0 auto';
}

function initAxAutoSizing(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('[data-ax-autosize]').forEach(function(input) {
        axAutoSizeInput(input);
    });
}

window.axUI = {
    initSelects: initAxSelects,
    initA11y: initA11yEnhancements,
    initAutoSizing: initAxAutoSizing,
    closeSelects: axCloseSelects
};

document.addEventListener('click', function(event) {
    if (!event.target.closest || !event.target.closest('.ax-select')) axCloseSelects();
});

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') axCloseSelects();
});

if (window.MutationObserver) {
    var axSelectObserver = new MutationObserver(function() {
        window.clearTimeout(window._axSelectTimer);
        window._axSelectTimer = window.setTimeout(function() {
            initAxSelects(document);
            initA11yEnhancements(document);
            initAxAutoSizing(document);
        }, 0);
    });
    axSelectObserver.observe(document.documentElement, { childList: true, subtree: true });
}
