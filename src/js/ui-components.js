// 主题感知业务控件。现有 select 保留原值和 change 事件，增强层负责展示与交互。

var axSelectInstanceId = 0;

function axGetSelectLabel(native) {
    var labelledBy = native.getAttribute('aria-labelledby');
    if (labelledBy) return { attribute: 'aria-labelledby', value: labelledBy };
    var explicitLabel = native.getAttribute('aria-label');
    if (explicitLabel && native.dataset.axA11yAutoLabel !== 'true') return { attribute: 'aria-label', value: explicitLabel };
    var labels = native.labels ? Array.prototype.slice.call(native.labels) : [];
    var labelText = labels.map(function(label) {
        var clone = label.cloneNode(true);
        clone.querySelectorAll('select,input,textarea,button').forEach(function(control) { control.remove(); });
        return (clone.textContent || '').trim();
    }).filter(Boolean).join(' ');
    var labelBoundary = native.closest && native.closest('.ax-select') || native;
    var previousLabel = labelBoundary.previousElementSibling && labelBoundary.previousElementSibling.tagName === 'LABEL'
        ? labelBoundary.previousElementSibling
        : null;
    if (!labelText && previousLabel) {
        labelText = (previousLabel.textContent || '').trim();
    }
    if (!labelText) {
        var wrappingLabel = native.closest ? native.closest('label') : null;
        if (wrappingLabel) {
            var clone = wrappingLabel.cloneNode(true);
            clone.querySelectorAll('select,input,textarea,button').forEach(function(control) { control.remove(); });
            labelText = (clone.textContent || '').trim();
        }
    }
    return labelText
        ? { attribute: 'aria-label', value: labelText }
        : explicitLabel ? { attribute: 'aria-label', value: explicitLabel }
            : native.id ? { attribute: 'aria-label', value: native.id } : null;
}

function axSyncSelectTriggerLabel(native) {
    if (!native || native.tagName !== 'SELECT' || !native.closest) return;
    var wrapper = native.closest('.ax-select');
    var trigger = wrapper && wrapper.querySelector('.ax-select-trigger');
    var label = trigger && axGetSelectLabel(native);
    if (label) trigger.setAttribute(label.attribute, label.value);
}

function axEscapeHtml(value) {
    return String(value == null ? '' : value).replace(/[&<>'"]/g, function(char) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char];
    });
}

function axIsSheetViewport() {
    return window.matchMedia('(max-width: 600px)').matches;
}

function axSyncVisualViewport() {
    var viewport = window.visualViewport;
    var bottomGap = viewport
        ? Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop)
        : 0;
    document.querySelectorAll('.ax-select-menu.ax-select-sheet:not([hidden])').forEach(function(menu) {
        menu.style.setProperty('--ax-select-viewport-gap', Math.round(bottomGap) + 'px');
    });
}

function axGetSelectMenu(wrapper) {
    return wrapper && wrapper.dataset.menuId
        ? document.getElementById(wrapper.dataset.menuId)
        : wrapper && wrapper.querySelector('.ax-select-menu');
}

function axPositionSelectMenu(wrapper, menu) {
    if (!wrapper || !menu || wrapper.classList.contains('ax-select-sheet')) return;
    var trigger = wrapper.querySelector('.ax-select-trigger');
    if (!trigger) return;
    var rect = trigger.getBoundingClientRect();
    var viewportWidth = document.documentElement.clientWidth;
    var viewportHeight = window.innerHeight;
    var maxWidth = Math.max(0, viewportWidth - 20);
    var width = Math.min(Math.max(rect.width, 180), maxWidth);
    var desiredHeight = Math.min(menu.scrollHeight || 280, 280);
    var below = Math.max(0, viewportHeight - rect.bottom - 16);
    var above = Math.max(0, rect.top - 16);
    menu.classList.add('ax-select-portaled');
    menu.style.position = 'fixed';
    menu.style.width = width + 'px';
    menu.style.left = Math.max(10, Math.min(rect.left, viewportWidth - width - 10)) + 'px';
    if (below > 0 && (below >= Math.min(desiredHeight, 120) || below >= above)) {
        menu.style.top = (rect.bottom + 6) + 'px';
        menu.style.bottom = 'auto';
        menu.style.maxHeight = Math.max(96, Math.min(280, below)) + 'px';
    } else {
        menu.style.top = 'auto';
        menu.style.bottom = (viewportHeight - rect.top + 6) + 'px';
        menu.style.maxHeight = Math.max(96, Math.min(280, above)) + 'px';
    }
}

function axRepositionOpenSelects() {
    document.querySelectorAll('.ax-select.open').forEach(function(wrapper) {
        var menu = axGetSelectMenu(wrapper);
        if (wrapper.classList.contains('ax-select-sheet')) axSyncVisualViewport();
        else axPositionSelectMenu(wrapper, menu);
    });
}

function axSyncSelectModes() {
    var useSheet = axIsSheetViewport();
    var wrappers = Array.prototype.slice.call(document.querySelectorAll('.ax-select'));
    var modeChanged = wrappers.some(function(wrapper) {
        return wrapper.classList.contains('ax-select-sheet') !== useSheet;
    });
    if (modeChanged) axCloseSelects();
    wrappers.forEach(function(wrapper) {
        wrapper.classList.toggle('ax-select-sheet', useSheet);
    });
}

function axDispatchChange(element) {
    if (!element) return;
    element.dispatchEvent(new Event('change', { bubbles: true }));
    element.dispatchEvent(new Event('input', { bubbles: true }));
}

function axSheetBackdrop(show) {
    var existing = document.querySelector('.ax-select-backdrop');
    if (!show) {
        if (existing) existing.remove();
        return;
    }
    if (existing) return;
    var backdrop = document.createElement('div');
    backdrop.className = 'ax-select-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    backdrop.addEventListener('click', function() { axCloseSelects(); });
    document.body.appendChild(backdrop);
}

function axCloseSelects(except) {
    document.querySelectorAll('.ax-select.open').forEach(function(select) {
        if (select === except) return;
        select.classList.remove('open');
        var menu = axGetSelectMenu(select);
        if (menu) {
            menu.hidden = true;
            menu.style.transform = '';
            menu.style.transition = '';
            menu.style.position = '';
            menu.style.left = '';
            menu.style.top = '';
            menu.style.bottom = '';
            menu.style.width = '';
            menu.style.maxHeight = '';
            menu.style.removeProperty('--ax-select-viewport-gap');
            menu.classList.remove('ax-select-portaled', 'ax-select-sheet');
            if (menu.parentNode !== select) select.appendChild(menu);
        }
        var trigger = select.querySelector('.ax-select-trigger');
        if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });
    axSheetBackdrop(false);
}

// 底部面板下滑关闭：仅响应面板顶部把手区域的下滑手势。
function axBindSheetDrag(wrapper, menu) {
    if (!wrapper.classList.contains('ax-select-sheet')) return;
    var startY = null;
    var dy = 0;
    menu.addEventListener('touchstart', function(event) {
        if (menu.hidden) return;
        var touch = event.touches[0];
        var rect = menu.getBoundingClientRect();
        if (touch.clientY - rect.top > 56) return;
        startY = touch.clientY;
        dy = 0;
        menu.style.transition = 'none';
    }, { passive: false });
    menu.addEventListener('touchmove', function(event) {
        if (startY === null) return;
        dy = event.touches[0].clientY - startY;
        if (dy > 0) {
            if (event.cancelable) event.preventDefault();
            menu.style.transform = 'translateY(' + dy + 'px)';
        }
    }, { passive: false });
    menu.addEventListener('touchend', function() {
        if (startY === null) return;
        menu.style.transition = '';
        menu.style.transform = '';
        if (dy > 60) axCloseSelects();
        startY = null;
        dy = 0;
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

    var fitClass = native.classList.contains('pm-choice-fit') ? ' pm-choice-fit' : '';
    var editChoiceClass = native.classList.contains('pm-edit-choice') ? ' pm-edit-choice' : '';
    var batchChoiceClass = native.classList.contains('pm-batch-choice') ? ' pm-batch-choice' : '';
    wrapper.className = 'ax-select' + fitClass + editChoiceClass + batchChoiceClass + (axIsSheetViewport() ? ' ax-select-sheet' : '');
    if (native.style.cssText) wrapper.style.cssText = native.style.cssText;
    wrapper.dataset.mode = mode;
    trigger.type = 'button';
    trigger.className = 'ax-select-trigger';
    var nativeTypography = window.getComputedStyle(native);
    ['fontFamily', 'fontSize', 'fontStyle', 'fontVariant', 'fontWeight', 'lineHeight', 'letterSpacing'].forEach(function(property) {
        if (nativeTypography[property]) trigger.style[property] = nativeTypography[property];
    });
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    menu.id = 'ax-select-menu-' + (++axSelectInstanceId);
    wrapper.dataset.menuId = menu.id;
    menu.setAttribute('role', 'listbox');
    if (mode === 'multi') menu.setAttribute('aria-multiselectable', 'true');
    trigger.setAttribute('aria-controls', menu.id);
    var selectLabel = axGetSelectLabel(native);
    if (selectLabel) trigger.setAttribute(selectLabel.attribute, selectLabel.value);
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
            var placeholderOption = Array.prototype.slice.call(native.selectedOptions || []).find(function(option) {
                return option.value === '';
            });
            text = selected.length ? selected[0].textContent
                : placeholderOption ? placeholderOption.textContent
                    : (native.getAttribute('data-placeholder') || '请选择');
        }
        trigger.innerHTML = '<span>' + axEscapeHtml(text) + '</span><span class="ax-select-chevron" aria-hidden="true"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m6 9 6 6 6-6"/></svg></span>';
        trigger.disabled = native.disabled;
        trigger.setAttribute('aria-disabled', String(native.disabled));
        wrapper.classList.toggle('is-disabled', native.disabled);
        if (native.disabled && wrapper.classList.contains('open')) axCloseSelects();
    }

    function renderOptions(filter) {
        options = Array.prototype.slice.call(native.options);
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
            button.setAttribute('aria-disabled', String(option.disabled || (option.parentElement && option.parentElement.tagName === 'OPTGROUP' && option.parentElement.disabled)));
            button.disabled = option.disabled || !!(option.parentElement && option.parentElement.tagName === 'OPTGROUP' && option.parentElement.disabled);
            button.dataset.value = option.value;
            button.textContent = option.textContent;
            button.addEventListener('click', function() {
                if (button.disabled || native.disabled) return;
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
                if (mode === 'multi') {
                    var updated = Array.prototype.slice.call(menu.querySelectorAll('.ax-select-option')).find(function(item) {
                        return item.dataset.value === option.value;
                    });
                    if (updated) updated.focus();
                }
            });
            if (customRow) menu.insertBefore(button, customRow);
            else menu.appendChild(button);
        });
    }

    menu.addEventListener('keydown', function(event) {
        var available = Array.prototype.slice.call(menu.querySelectorAll('.ax-select-option')).filter(function(option) {
            return !option.disabled;
        });
        if (event.key === 'Escape') {
            event.preventDefault();
            axCloseSelects();
            trigger.focus();
            return;
        }
        if (event.key === 'Tab') {
            axCloseSelects();
            return;
        }
        if (!available.length || !['ArrowDown', 'ArrowUp', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        var current = available.indexOf(document.activeElement);
        var next = current;
        if (event.key === 'Home') next = 0;
        else if (event.key === 'End') next = available.length - 1;
        else if (event.key === 'ArrowDown') next = current < 0 ? 0 : (current + 1) % available.length;
        else next = current < 0 ? available.length - 1 : (current - 1 + available.length) % available.length;
        available[next].focus();
    });

    trigger.addEventListener('click', function(event) {
        if (trigger.disabled) return;
        var opening = menu.hidden;
        if (opening) axCloseSelects(wrapper);
        else axCloseSelects();
        menu.hidden = !opening;
        wrapper.classList.toggle('open', opening);
        trigger.setAttribute('aria-expanded', String(opening));
        if (opening) {
            renderOptions(search ? search.value : '');
            document.body.appendChild(menu);
            if (axIsSheetViewport()) {
                menu.classList.add('ax-select-sheet');
                axSheetBackdrop(true);
            } else {
                axPositionSelectMenu(wrapper, menu);
            }
            if (search && event.detail === 0) {
                search.focus();
            } else if (!search) {
                var focusTarget = Array.prototype.slice.call(menu.querySelectorAll('.ax-select-option')).find(function(option) {
                    return option.getAttribute('aria-selected') === 'true' && !option.disabled;
                }) || menu.querySelector('.ax-select-option:not(:disabled)');
                if (focusTarget) focusTarget.focus();
            }
            axSyncVisualViewport();
        }
    });

    trigger.addEventListener('keydown', function(event) {
        if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
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
    if (window.MutationObserver) {
        var optionsObserver = new MutationObserver(function() {
            options = Array.prototype.slice.call(native.options);
            refreshTrigger();
            renderOptions(search ? search.value : '');
            if (wrapper.classList.contains('open') && !wrapper.classList.contains('ax-select-sheet')) {
                axPositionSelectMenu(wrapper, menu);
            }
        });
        optionsObserver.observe(native, { childList: true, subtree: true, attributes: true, attributeFilter: ['disabled'] });
    }
    refreshTrigger();
    renderOptions('');
    axBindSheetDrag(wrapper, menu);
}

function initAxSelects(root) {
    var scope = root && root.querySelectorAll ? root : document;
    scope.querySelectorAll('select:not([data-ax-ready])').forEach(function(select) {
        select.dataset.axReady = 'true';
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
        if (control.getAttribute('aria-label') || control.getAttribute('aria-labelledby')) {
            axSyncSelectTriggerLabel(control);
            return;
        }
        if (control.labels && control.labels.length) {
            axSyncSelectTriggerLabel(control);
            return;
        }
        var labelBoundary = control.tagName === 'SELECT' && control.closest('.ax-select') || control;
        var adjacentLabel = labelBoundary.previousElementSibling && labelBoundary.previousElementSibling.tagName === 'LABEL'
            ? labelBoundary.previousElementSibling
            : null;
        var wrapper = control.closest('.hrow,.field,label');
        var label = adjacentLabel || (wrapper ? wrapper.querySelector('label') : null);
        var text = label ? (label.textContent || '').trim() : '';
        control.setAttribute('aria-label', text || control.getAttribute('placeholder') || control.id || '表单控件');
        control.dataset.axA11yAutoLabel = 'true';
        axSyncSelectTriggerLabel(control);
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
    if (!event.target.closest || (!event.target.closest('.ax-select') && !event.target.closest('.ax-select-menu'))) axCloseSelects();
});

document.addEventListener('keydown', function(event) {
    if (event.key === 'Escape') axCloseSelects();
});

window.addEventListener('resize', function() {
    axSyncSelectModes();
    axSyncVisualViewport();
    axRepositionOpenSelects();
});
window.addEventListener('scroll', axRepositionOpenSelects, true);
if (window.visualViewport) {
    window.visualViewport.addEventListener('resize', axRepositionOpenSelects);
    window.visualViewport.addEventListener('scroll', axRepositionOpenSelects);
}

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
