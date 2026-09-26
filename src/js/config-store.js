// 统一的应用配置存储层。
// 旧系统和新架构都通过 window.axConfigStore 使用同一份读取与迁移逻辑。

var APP_CONFIG_SCHEMA_VERSION = 2;
var APP_CONFIG_PUBLIC_KEY = 'ax_app_config';
var ONBOARDING_BUSINESS_COLLECTIONS = [
    'dailyReports', 'purchases', 'expenses', 'salaryRecords', 'salaryTrash',
    'teaItems', 'cigItems', 'alcItems', 'otherItems', 'whItems',
    'damageRecords', 'exchangeRecords'
];

function appConfigDefaults() {
    return {
        enabledModules: [],
        dailyLabels: [],
        dailyFieldDefinitions: defaultDailyFieldDefinitions(),
        roomTypes: ['普通包厢', '500+包厢'],
        purchaseSources: [],
        purchaseSections: [],
        purchaseCategories: {},
        expenseCategories: [],
        warehouseCategories: [],
        inventoryTypes: [],
        customInventoryTypes: [],
        salaryDepartments: [],
        salaryTemplates: [],
        defaultSalaryTemplateId: '',
        dailyFeatures: { roomEnabled: false, reporterEnabled: false },
        onboardingCompleted: false,
        schemaVersion: APP_CONFIG_SCHEMA_VERSION,
        updatedAt: 0
    };
}

function defaultDailyFieldDefinitions() {
    return [
        { id: 'grossSales', label: '流水', group: '营收', path: 'revenue.grossSales', type: 'currency', statistic: 'revenue', visible: true, builtin: true },
        { id: 'discount', label: '折扣', group: '营收', path: 'revenue.discount', type: 'currency', statistic: 'revenue', visible: true, builtin: true },
        { id: 'netSales', label: '实收', group: '营收', path: 'revenue.netSales', type: 'currency', statistic: 'revenue', visible: true, builtin: true },
        { id: 'kitchenSales', label: '厨房', group: '营收', path: 'revenue.kitchenSales', type: 'currency', statistic: 'revenue', visible: true, builtin: true },
        { id: 'barSales', label: '吧台', group: '营收', path: 'revenue.barSales', type: 'currency', statistic: 'revenue', visible: true, builtin: true },
        { id: 'cigaretteSales', label: '香烟', group: '营收', path: 'revenue.cigarette.total', type: 'currency', statistic: 'revenue', visible: true, builtin: true },
        { id: 'otherRevenue', label: '其他', group: '营收', path: 'revenue.other', type: 'currency', statistic: 'revenue', visible: true, builtin: true },
        { id: 'pos', label: 'POS', group: '支付', path: 'payment.pos', type: 'currency', statistic: 'payment', visible: true, builtin: true },
        { id: 'ccbLife', label: '建行', group: '支付', path: 'payment.ccbLife', type: 'currency', statistic: 'payment', visible: true, builtin: true },
        { id: 'cash', label: '现金', group: '支付', path: 'payment.cash', type: 'currency', statistic: 'payment', visible: true, builtin: true },
        { id: 'memberCard', label: '会员', group: '支付', path: 'payment.memberCard', type: 'currency', statistic: 'payment', visible: true, builtin: true },
        { id: 'treat', label: '招待', group: '支付', path: 'payment.treat', type: 'currency', statistic: 'payment', visible: true, builtin: true },
        { id: 'arTotal', label: '合计', group: '应收', path: 'payment.ar.total', type: 'currency', statistic: 'receivable', visible: true, builtin: true, readonly: true },
        { id: 'arMeituan', label: '美团团购', group: '应收', path: 'payment.ar.meituan', type: 'currency', statistic: 'receivable', visible: true, builtin: true },
        { id: 'arDouyin', label: '抖音团购', group: '应收', path: 'payment.ar.douyin', type: 'currency', statistic: 'receivable', visible: true, builtin: true },
        { id: 'deliveryTotal', label: '合计', group: '外卖', path: 'delivery.total', type: 'currency', statistic: 'delivery', visible: true, builtin: true, readonly: true },
        { id: 'deliveryMeituan', label: '美团', group: '外卖', path: 'delivery.meituan', type: 'currency', statistic: 'delivery', visible: true, builtin: true },
        { id: 'deliveryTaobao', label: '淘宝', group: '外卖', path: 'delivery.taobao', type: 'currency', statistic: 'delivery', visible: true, builtin: true },
        { id: 'deliveryJd', label: '京东', group: '外卖', path: 'delivery.jd', type: 'currency', statistic: 'delivery', visible: true, builtin: true },
        { id: 'guestCount', label: '人数', group: '客情', path: 'guest.count', type: 'number', statistic: 'guest', visible: true, builtin: true },
        { id: 'avgSpend', label: '人均', group: '客情', path: 'guest.avgSpend', type: 'currency', statistic: 'none', visible: true, builtin: true },
        { id: 'premiumRoomsToday', label: '500+包厢', group: '客情', path: 'guest.premiumRoomsToday', type: 'number', statistic: 'guest', visible: true, builtin: true },
        { id: 'rooms', label: '包厢预定', group: '包厢预定', path: '', type: 'rooms', statistic: 'none', visible: true, builtin: true }
    ].map(function(field, index) {
        field.order = index;
        return field;
    });
}

function normalizeDailyFieldDefinitions(value) {
    var defaults = defaultDailyFieldDefinitions();
    var source = Array.isArray(value) ? value : [];
    var result = [];
    var used = {};

    source.forEach(function(field, index) {
        if (!field || !field.id) return;
        var base = defaults.find(function(item) { return item.id === field.id; }) || {};
        var definition = Object.assign({}, base, field);
        definition.id = String(field.id);
        definition.label = String(field.label || base.label || definition.id).trim();
        definition.group = String(field.group || base.group || '其他').trim();
        definition.path = String(field.path || base.path || '');
        definition.type = field.type || base.type || 'currency';
        definition.statistic = field.statistic || base.statistic || 'none';
        definition.visible = field.visible !== false;
        definition.builtin = field.builtin === true || base.builtin === true;
        definition.readonly = field.readonly === true || base.readonly === true;
        definition.order = Number.isFinite(Number(field.order)) ? Number(field.order) : index;
        used[definition.id] = true;
        result.push(definition);
    });

    defaults.forEach(function(field) {
        if (!used[field.id]) result.push(Object.assign({}, field));
    });
    return result.sort(function(a, b) { return a.order - b.order; }).map(function(field, index) {
        field.order = index;
        return field;
    });
}

function copyAppConfigValue(value) {
    if (value === undefined || value === null) return value;
    try {
        return JSON.parse(JSON.stringify(value));
    } catch (e) {
        return value;
    }
}

function readAppConfigObject(value) {
    if (!value) return null;
    if (typeof value === 'object') return value;
    try {
        var parsed = JSON.parse(value);
        return parsed && typeof parsed === 'object' ? parsed : null;
    } catch (e) {
        return null;
    }
}

function appConfigUserId() {
    try {
        if (typeof _auth !== 'undefined' && _auth && _auth.loggedIn && _auth.user && _auth.user.id) {
            return _auth.user.id;
        }
    } catch (e) {}

    try {
        for (var i = 0; i < localStorage.length; i++) {
            var key = localStorage.key(i);
            if (!key || key.indexOf('sb-') !== 0 || key.indexOf('auth-token') <= 0) continue;
            var tokenData = readAppConfigObject(localStorage.getItem(key));
            if (tokenData && tokenData.user && tokenData.user.id) return tokenData.user.id;
        }
    } catch (e) {}
    return '';
}

function getConfigKey() {
    var userId = appConfigUserId();
    return userId ? APP_CONFIG_PUBLIC_KEY + '_' + userId : APP_CONFIG_PUBLIC_KEY;
}

function appConfigCandidates() {
    var candidates = [];
    var userKey = getConfigKey();
    var keys = [userKey];
    if (userKey !== APP_CONFIG_PUBLIC_KEY) keys.push(APP_CONFIG_PUBLIC_KEY);
    var settings = typeof DB !== 'undefined' && DB && DB.settings ? DB.settings : {};

    keys.forEach(function(key) {
        candidates.push(readAppConfigObject(localStorage.getItem(key)));
        candidates.push(readAppConfigObject(settings[key]));
    });
    return candidates.filter(function(item) { return !!item; });
}

function appConfigTimestamp(raw) {
    if (!raw) return 0;
    var value = Number(raw.updatedAt || raw.configUpdatedAt || 0);
    return isFinite(value) ? value : 0;
}

function mergeAppConfigCandidates(candidates) {
    // 配置是完整快照。逐字段混合本地与云端快照会让“空数组”覆盖云端已有项，
    // 也会把不同时间点的配置拼成一个从未真实保存过的状态。
    // 优先选择已完成引导或包含实际设置的候选项，再在其中取最新的一份。
    var authoritative = candidates.filter(function(raw) {
        return hasMeaningfulAppConfig(raw) || raw.onboardingCompleted === true;
    });
    var source = authoritative.length ? authoritative : candidates;
    var newest = null;
    var newestTime = -1;
    source.forEach(function(raw) {
        var time = appConfigTimestamp(raw);
        if (time > newestTime) {
            newest = raw;
            newestTime = time;
        }
    });
    return newest ? copyAppConfigValue(newest) : {};
}

function uniqueStrings(value, fallback) {
    var source = Array.isArray(value) ? value : (Array.isArray(fallback) ? fallback : []);
    var result = [];
    source.forEach(function(item) {
        if (item === undefined || item === null) return;
        var text = String(item).trim();
        if (text && result.indexOf(text) < 0) result.push(text);
    });
    return result;
}

function stringsWithLegacy(value, fallback, needsMigration) {
    var source = Array.isArray(value) ? value : [];
    if (needsMigration && source.length === 0 && Array.isArray(fallback) && fallback.length > 0) {
        source = fallback;
    }
    return uniqueStrings(source, fallback);
}

function categoryMap(value, fallback) {
    var source = value && typeof value === 'object' && !Array.isArray(value)
        ? value
        : (fallback && typeof fallback === 'object' ? fallback : {});
    var result = {};
    Object.keys(source).forEach(function(section) {
        result[section] = uniqueStrings(source[section], []);
    });
    return result;
}

function hasExistingBusinessData(database) {
    if (!database || typeof database !== 'object') return false;
    return ONBOARDING_BUSINESS_COLLECTIONS.some(function(key) {
        return Array.isArray(database[key]) && database[key].length > 0;
    });
}

function legacyAppConfig(database) {
    var db = database && typeof database === 'object' ? database : {};
    var labels = [];
    var sources = [];
    var expenseCategories = [];
    var warehouseCategories = uniqueStrings(db.whCats, []);
    var purchaseCategories = categoryMap(db.areaCats, {});
    var salaryDepartments = [];
    var legacySalaryTemplate = [];

    try {
        labels = uniqueStrings(JSON.parse(localStorage.getItem('ax_fl') || '[]'), []);
    } catch (e) {}

    (db.purchases || []).forEach(function(purchase) {
        if (purchase && purchase.source && sources.indexOf(purchase.source) < 0) sources.push(purchase.source);
        (purchase && purchase.items ? purchase.items : []).forEach(function(item) {
            var section = item && item.section ? String(item.section) : '';
            var category = item && item.category ? String(item.category) : '';
            if (!section || !category) return;
            if (!purchaseCategories[section]) purchaseCategories[section] = [];
            if (purchaseCategories[section].indexOf(category) < 0) purchaseCategories[section].push(category);
        });
    });

    (db.expenses || []).forEach(function(expense) {
        var category = expense && expense.category ? String(expense.category) : '';
        if (category && expenseCategories.indexOf(category) < 0) expenseCategories.push(category);
    });

    if (warehouseCategories.length === 0) {
        (db.whItems || []).forEach(function(item) {
            var category = item && item.category ? String(item.category) : '';
            if (category && warehouseCategories.indexOf(category) < 0) warehouseCategories.push(category);
        });
    }

    (db.salaryRecords || []).forEach(function(record) {
        var department = record && record.department ? String(record.department).trim() : '';
        if (department && salaryDepartments.indexOf(department) < 0) salaryDepartments.push(department);
    });

    try {
        legacySalaryTemplate = JSON.parse(localStorage.getItem(getConfigKey() + '_salaryTemplate') || '[]');
        if (!Array.isArray(legacySalaryTemplate)) legacySalaryTemplate = [];
        legacySalaryTemplate = legacySalaryTemplate.map(function(row) {
            return {
                department: String(row && row.department || '').trim(),
                employee: String(row && row.employee || '').trim(),
                position: String(row && row.position || '').trim(),
                baseSalary: Number(row && row.baseSalary) || 0
            };
        }).filter(function(row) { return row.employee; });
        legacySalaryTemplate.forEach(function(row) {
            if (row.department && salaryDepartments.indexOf(row.department) < 0) salaryDepartments.push(row.department);
        });
    } catch (e) {}

    return {
        dailyLabels: labels,
        purchaseSources: sources,
        purchaseSections: Object.keys(purchaseCategories),
        purchaseCategories: purchaseCategories,
        expenseCategories: expenseCategories,
        warehouseCategories: warehouseCategories,
        salaryDepartments: salaryDepartments,
        legacySalaryTemplate: legacySalaryTemplate,
        hasBusinessData: hasExistingBusinessData(db)
    };
}

function normalizeSalaryTemplateRows(value) {
    if (!Array.isArray(value)) return [];
    return value.map(function(row) {
        return {
            department: String(row && row.department || '').trim(),
            employee: String(row && row.employee || '').trim(),
            position: String(row && row.position || '').trim(),
            baseSalary: Number(row && row.baseSalary) || 0
        };
    }).filter(function(row) { return row.employee; });
}

function normalizeSalaryTemplates(value, legacyRows) {
    var source = Array.isArray(value) ? value : [];
    var templates = source.map(function(template, index) {
        return {
            id: String(template && template.id || ('salary_template_' + (index + 1))),
            name: String(template && template.name || ('模板 ' + (index + 1))).trim(),
            isDefault: template && template.isDefault === true,
            rows: normalizeSalaryTemplateRows(template && template.rows)
        };
    }).filter(function(template) { return template.name; });

    if (!templates.length && legacyRows.length) {
        templates = [{
            id: 'salary_template_default',
            name: '默认模板',
            isDefault: true,
            rows: normalizeSalaryTemplateRows(legacyRows)
        }];
    }
    return templates;
}

function hasMeaningfulAppConfig(raw) {
    if (!raw || typeof raw !== 'object') return false;
    var fields = [
        'enabledModules', 'dailyLabels', 'purchaseSources', 'purchaseSections',
        'expenseCategories', 'warehouseCategories', 'inventoryTypes', 'customInventoryTypes'
    ];
    for (var i = 0; i < fields.length; i++) {
        if (Array.isArray(raw[fields[i]]) && raw[fields[i]].length > 0) return true;
    }
    if (raw.purchaseCategories && Object.keys(raw.purchaseCategories).length > 0) return true;
    if (Array.isArray(raw.salaryDepartments) && raw.salaryDepartments.length > 0) return true;
    if (Array.isArray(raw.salaryTemplates) && raw.salaryTemplates.length > 0) return true;
    if (raw.dailyFeatures && (raw.dailyFeatures.roomEnabled || raw.dailyFeatures.reporterEnabled)) return true;
    return false;
}

function normalizeAppConfig(raw, legacy) {
    var source = raw && typeof raw === 'object' ? raw : {};
    var needsMigration = Number(source.schemaVersion || 0) < APP_CONFIG_SCHEMA_VERSION;
    var config = appConfigDefaults();

    config.enabledModules = uniqueStrings(source.enabledModules, []);
    config.dailyLabels = stringsWithLegacy(source.dailyLabels, legacy.dailyLabels, needsMigration);
    config.dailyFieldDefinitions = normalizeDailyFieldDefinitions(source.dailyFieldDefinitions);
    config.roomTypes = uniqueStrings(source.roomTypes, config.roomTypes);
    config.purchaseSources = stringsWithLegacy(source.purchaseSources, legacy.purchaseSources, needsMigration);
    config.purchaseCategories = needsMigration
        && (!source.purchaseCategories || Object.keys(source.purchaseCategories).length === 0)
        ? categoryMap(legacy.purchaseCategories, {})
        : categoryMap(source.purchaseCategories, {});
    config.purchaseSections = stringsWithLegacy(source.purchaseSections, legacy.purchaseSections, needsMigration);

    Object.keys(config.purchaseCategories).forEach(function(section) {
        if (config.purchaseSections.indexOf(section) < 0) config.purchaseSections.push(section);
    });

    config.expenseCategories = stringsWithLegacy(source.expenseCategories, legacy.expenseCategories, needsMigration);
    config.warehouseCategories = stringsWithLegacy(source.warehouseCategories, legacy.warehouseCategories, needsMigration);
    config.inventoryTypes = uniqueStrings(source.inventoryTypes, []);
    config.customInventoryTypes = uniqueStrings(source.customInventoryTypes, []);
    config.salaryDepartments = stringsWithLegacy(source.salaryDepartments, legacy.salaryDepartments, true);
    config.salaryTemplates = normalizeSalaryTemplates(source.salaryTemplates, legacy.legacySalaryTemplate);
    config.defaultSalaryTemplateId = String(source.defaultSalaryTemplateId || '') ||
        (config.salaryTemplates.length && config.salaryTemplates[0].id) || '';

    var features = source.dailyFeatures && typeof source.dailyFeatures === 'object' ? source.dailyFeatures : {};
    config.dailyFeatures = {
        roomEnabled: features.roomEnabled === true,
        reporterEnabled: features.reporterEnabled === true
    };

    config.onboardingCompleted = typeof source.onboardingCompleted === 'boolean'
        ? source.onboardingCompleted
        : (hasMeaningfulAppConfig(source) || legacy.hasBusinessData);
    config.schemaVersion = APP_CONFIG_SCHEMA_VERSION;
    config.updatedAt = appConfigTimestamp(source);
    return config;
}

function getAppConfig() {
    var legacy = legacyAppConfig(typeof DB !== 'undefined' ? DB : null);
    return normalizeAppConfig(mergeAppConfigCandidates(appConfigCandidates()), legacy);
}

function storeAppConfig(nextConfig) {
    var legacy = legacyAppConfig(typeof DB !== 'undefined' ? DB : null);
    var merged = Object.assign({}, getAppConfig(), nextConfig || {});
    merged.schemaVersion = APP_CONFIG_SCHEMA_VERSION;
    merged.updatedAt = Date.now();
    var config = normalizeAppConfig(merged, legacy);
    var key = getConfigKey();

    localStorage.setItem(key, JSON.stringify(config));
    if (typeof DB !== 'undefined' && DB) {
        if (!DB.settings) DB.settings = {};
        DB.settings[key] = copyAppConfigValue(config);
        // 旧模块仍会读取这两个字段。显式保存配置时同步它们，保证新旧入口一致。
        DB.areaCats = copyAppConfigValue(config.purchaseCategories) || {};
        DB.whCats = copyAppConfigValue(config.warehouseCategories) || [];
        if (typeof saveDB === 'function') saveDB(DB);
        if (typeof sbScheduleSave === 'function') sbScheduleSave();
    }
    return config;
}

function migrateAppConfig() {
    var config = getAppConfig();
    var key = getConfigKey();
    var raw = mergeAppConfigCandidates(appConfigCandidates());
    // 新浏览器在云端数据到达前没有任何配置可迁移。此时不能生成并上传一份
    // 默认空配置，否则会覆盖同账号其他浏览器已经保存的分类。
    var hasPersistedConfig = Object.keys(raw).length > 0;
    var canSyncLegacyFields = hasPersistedConfig || hasMeaningfulAppConfig(config);
    if (typeof DB !== 'undefined' && DB && canSyncLegacyFields) {
        var areaCats = copyAppConfigValue(config.purchaseCategories) || {};
        var whCats = copyAppConfigValue(config.warehouseCategories) || [];
        var needsDbSync = JSON.stringify(DB.areaCats || {}) !== JSON.stringify(areaCats)
            || JSON.stringify(DB.whCats || []) !== JSON.stringify(whCats);
        if (needsDbSync) {
            DB.areaCats = areaCats;
            DB.whCats = whCats;
            if (typeof saveDB === 'function') saveDB(DB);
        }
    }

    var needsConfigWrite = hasPersistedConfig && (!localStorage.getItem(key)
        || Number(raw.schemaVersion || 0) < APP_CONFIG_SCHEMA_VERSION
        || JSON.stringify(raw) !== JSON.stringify(config));
    return needsConfigWrite ? storeAppConfig(config) : config;
}

function saveAppConfig(config) {
    var saved = storeAppConfig(config);
    if (typeof toast === 'function') toast('配置已保存');
    return saved;
}

function shouldShowLegacyOnboarding() {
    var config = getAppConfig();
    return !config.onboardingCompleted && !hasMeaningfulAppConfig(config);
}

window.axConfigStore = {
    getConfigKey: getConfigKey,
    getAppConfig: getAppConfig,
    saveAppConfig: storeAppConfig,
    migrateAppConfig: migrateAppConfig,
    hasExistingBusinessData: hasExistingBusinessData,
    shouldShowLegacyOnboarding: shouldShowLegacyOnboarding
};
