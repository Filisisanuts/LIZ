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
        roomTypes: ['普通包厢', '500+包厢'],
        purchaseSources: [],
        purchaseSections: [],
        purchaseCategories: {},
        expenseCategories: [],
        warehouseCategories: [],
        inventoryTypes: [],
        customInventoryTypes: [],
        dailyFeatures: { roomEnabled: false, reporterEnabled: false },
        onboardingCompleted: false,
        schemaVersion: APP_CONFIG_SCHEMA_VERSION,
        updatedAt: 0
    };
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
    var merged = {};
    for (var i = candidates.length - 1; i >= 0; i--) {
        var raw = candidates[i];
        Object.keys(raw).forEach(function(key) {
            merged[key] = copyAppConfigValue(raw[key]);
        });
    }

    var newest = null;
    var newestTime = -1;
    candidates.forEach(function(raw) {
        var time = appConfigTimestamp(raw);
        if (time > newestTime) {
            newest = raw;
            newestTime = time;
        }
    });
    if (newest && newest.updatedAt !== undefined) merged.updatedAt = newest.updatedAt;
    return merged;
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

    return {
        dailyLabels: labels,
        purchaseSources: sources,
        purchaseSections: Object.keys(purchaseCategories),
        purchaseCategories: purchaseCategories,
        expenseCategories: expenseCategories,
        warehouseCategories: warehouseCategories,
        hasBusinessData: hasExistingBusinessData(db)
    };
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
    if (raw.dailyFeatures && (raw.dailyFeatures.roomEnabled || raw.dailyFeatures.reporterEnabled)) return true;
    return false;
}

function normalizeAppConfig(raw, legacy) {
    var source = raw && typeof raw === 'object' ? raw : {};
    var needsMigration = Number(source.schemaVersion || 0) < APP_CONFIG_SCHEMA_VERSION;
    var config = appConfigDefaults();

    config.enabledModules = uniqueStrings(source.enabledModules, []);
    config.dailyLabels = stringsWithLegacy(source.dailyLabels, legacy.dailyLabels, needsMigration);
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
        if (typeof saveDB === 'function') saveDB(DB);
        if (typeof sbScheduleSave === 'function') sbScheduleSave();
    }
    return config;
}

function migrateAppConfig() {
    var config = getAppConfig();
    var key = getConfigKey();
    var raw = mergeAppConfigCandidates(appConfigCandidates());
    if (typeof DB !== 'undefined' && DB) {
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

    var needsConfigWrite = !localStorage.getItem(key)
        || Number(raw.schemaVersion || 0) < APP_CONFIG_SCHEMA_VERSION
        || JSON.stringify(raw) !== JSON.stringify(config);
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
