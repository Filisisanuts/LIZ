import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const sources = ['config-store', 'utils', 'category', 'purchase', 'sync', 'search'].map((name) =>
  readFileSync(new URL(`../src/js/${name}.js`, import.meta.url), 'utf8'),
);

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, String(value)); },
    removeItem(key: string) { values.delete(key); },
    key(index: number) { return Array.from(values.keys())[index] ?? null; },
    get length() { return values.size; },
  };
}

function createHarness(categories: Record<string, string[]>, sections = ['厨房', '外场']) {
  const key = 'ax_app_config_purchase-user';
  const config = {
    schemaVersion: 2,
    updatedAt: 100,
    onboardingCompleted: true,
    purchaseSections: sections,
    purchaseSources: ['已有来源'],
    purchaseCategories: categories,
  };
  const localStorage = createStorage({ [key]: JSON.stringify(config) });
  const controls = new Map<string, any>();
  const requests: any[] = [];
  const database: any = {
    settings: { [key]: structuredClone(config) },
    areaCats: structuredClone(categories),
    purchases: [],
    dailyReports: [],
    expenses: [],
    teaItems: [],
    cigItems: [],
    alcItems: [],
    whItems: [],
  };
  let syncCount = 0;
  const document = {
    readyState: 'loading',
    addEventListener() {},
    getElementById(id: string) { return controls.get(id) ?? null; },
    querySelectorAll(_selector: string) { return []; },
    querySelector(_selector: string) { return null; },
    createElement(_tag: string) { return { value: '', text: '', textContent: '', setAttribute() {} }; },
  };
  /** Minimal XHR substitute that lets tests inspect requests and supply deterministic responses. */
  class FakeXMLHttpRequest {
    method = '';
    url = '';
    headers: Record<string, string> = {};
    timeout = 0;
    status = 0;
    responseText = '';
    payload = '';
    onload?: () => void;
    onerror?: () => void;
    ontimeout?: () => void;
    /** Records the method and URL for the queued test request. */
    open(method: string, url: string) { this.method = method; this.url = url; }
    /** Captures request headers so tests can verify credential placement. */
    setRequestHeader(name: string, value: string) { this.headers[name] = value; }
    /** Captures the body and allows the test to resolve the request manually. */
    send(payload = '') { this.payload = payload; requests.push(this); }
  }
  const context: Record<string, any> = {
    console,
    document,
    XMLHttpRequest: FakeXMLHttpRequest,
    localStorage,
    DB: database,
    _auth: { loggedIn: true, user: { id: 'purchase-user' } },
    saveDB() {},
    sbScheduleSave() { syncCount += 1; },
    setTimeout(callback: () => void) { callback(); return 1; },
    clearTimeout() {},
    confirm() { return true; },
    prompt() { return ''; },
  };
  context.window = context;
  vm.createContext(context);
  sources.forEach((source) => vm.runInContext(source, context));
  context.$id = (id: string) => controls.get(id) ?? null;
  context.upd = (callback: (db: any) => void) => callback(database);
  context.toast = () => {};
  context.rPurchase = () => {};
  context.closeModal = () => {};
  context.switchPT = () => {};
  context.axEscapeHtml = (value: unknown) => String(value ?? '').replace(/[&<>'\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' }[char]!));
  context._syncSetting = (setting: string, value: string) => localStorage.setItem(setting, value);
  context.sbScheduleSave = () => { syncCount += 1; };
  controls.set('macArea', { value: '厨房' });
  controls.set('newAreaCat', { value: '' });
  controls.set('macList', { innerHTML: '' });
  controls.set('pmList', { innerHTML: '' });
  return { context, controls, database, key, localStorage, requests, get syncCount() { return syncCount; } };
}

/** Creates a DOM-like datalist whose options can be inspected after rendering. */
function createDatalist(values: string[] = []) {
  const options: any[] = values.map((value) => ({ value }));
  return {
    options,
    get innerHTML() { return ''; },
    set innerHTML(_value: string) { options.splice(0); },
    appendChild(option: any) { options.push(option); },
  };
}

/** Creates a minimal select control for purchase source rendering and saving. */
function createSelect(value: string, values: string[] = []) {
  const options: any[] = values.map((optionValue) => ({ value: optionValue }));
  let selectedValue = options.some((option) => option.value === value) ? value : '';
  return {
    options,
    get value() { return selectedValue; },
    set value(next: string) { selectedValue = options.some((option) => option.value === next) ? next : ''; },
    appendChild(option: any) { options.push(option); },
  };
}

describe('purchase category and section consistency', () => {
  it('saves a category in account config so cloud hydration keeps it', () => {
    const harness = createHarness({ 厨房: ['干调'], 外场: ['香烟类'] });
    harness.controls.get('newAreaCat').value = '冻品类';
    harness.controls.set('pmSec', { value: '厨房', style: {} });
    harness.controls.set('pmCat', { value: '干调', innerHTML: '' });
    harness.controls.set('pmSecC', { style: {} });
    harness.controls.set('pmCatC', { style: {} });

    harness.context.addAreaCat();

    expect(harness.controls.get('pmCat').innerHTML).toContain('冻品类');
    const saved = JSON.parse(harness.localStorage.getItem(harness.key)!);
    expect(saved.purchaseCategories.厨房).toEqual(['干调', '冻品类']);
    expect(harness.database.settings[harness.key].purchaseCategories.厨房).toEqual(['干调', '冻品类']);
    expect(harness.syncCount).toBeGreaterThan(0);

    harness.database.areaCats = { 厨房: ['干调'], 外场: ['香烟类'] };
    harness.context.sbApplyRemoteAppConfig({ settings: { [harness.key]: saved } });
    expect(Array.from(harness.context.getPurCats('厨房'))).toEqual(['干调', '冻品类']);
    expect(Array.from(harness.database.areaCats.厨房)).toEqual(['干调', '冻品类']);
  });

  it('does not offer categories from another section when one has no categories', () => {
    const harness = createHarness({ 厨房: [], 外场: ['香烟类'] });

    expect(Array.from(harness.context.getPurCats('厨房'))).toEqual([]);
    expect(Array.from(harness.context.getPurCats('未知区域'))).toEqual([]);
    expect(Array.from(harness.context.getPurCats('外场'))).toEqual(['香烟类']);

    harness.controls.set('pmCat', { innerHTML: '' });
    harness.controls.set('pmSecC', { style: {} });
    harness.controls.set('pmCatC', { style: {} });
    harness.context.pmSecChanged({ value: '厨房' });
    expect(harness.controls.get('pmCat').innerHTML).not.toContain('香烟类');

    harness.controls.set('pmList', { innerHTML: '' });
    harness.context._pmItems = [{
      name: '盐', section: '厨房', category: '', source: '', qty: 1,
      unit: '袋', unitPrice: 5, total: 5,
    }];
    harness.context.renderPML();
    expect(harness.controls.get('pmList').innerHTML).not.toContain('香烟类');
  });

  it('removes a category only from its selected section and saves the change', () => {
    const harness = createHarness({ 厨房: ['通用'], 外场: ['通用'] });
    harness.database.purchases.push({ items: [
      { name: '厨房用品', section: '厨房', category: '通用' },
      { name: '外场用品', section: '外场', category: '通用' },
    ] });

    harness.context.delAreaCat('通用');

    const saved = JSON.parse(harness.localStorage.getItem(harness.key)!);
    expect(saved.purchaseCategories).toEqual({ 厨房: [], 外场: ['通用'] });
    expect(harness.database.purchases[0].items[0].category).toBe('');
    expect(harness.database.purchases[0].items[1].category).toBe('通用');
  });

  it('puts a custom row category in the category select and keeps its section', () => {
    const harness = createHarness({ 厨房: ['干调'], 外场: ['香烟类'] });
    harness.context._pmItems = [{ name: '纸杯', section: '外场', category: '' }];
    const selects = ['外购', '外场', '__custom'].map((value) => ({
      value,
      options: [{ value: '__custom' }],
      querySelector() { return this.options[0]; },
      insertBefore(option: any) { this.options.unshift(option); },
    }));
    const row = { querySelectorAll() { return selects; } };
    harness.context.document.querySelectorAll = () => [{}, row];
    harness.context.prompt = () => '纸品类';

    harness.context.pmEditSel(0, 'category', '__custom');

    expect(harness.context._pmItems[0]).toMatchObject({ section: '外场', category: '纸品类' });
    expect(selects[1].value).toBe('外场');
    expect(selects[2].value).toBe('纸品类');
  });

  it('automatically applies the configured historical area and category for an exact name match', () => {
    const harness = createHarness({ 厨房: ['干调'], 外场: ['香烟类'] });
    harness.database.purchases.push({ items: [{ name: '纸杯', section: '厨房', category: '干调', unitPrice: 5 }] });
    const item = { name: '纸杯', section: '', category: '' };

    harness.context.addHistoryMatches([item]);

    expect(item).toMatchObject({ name: '纸杯', section: '厨房', category: '干调' });
    expect((item as any).historyMatch).toMatchObject({ section: '厨房', category: '干调', locationIncomplete: false });
  });

  it('keeps a valid historical area but skips a category removed from account configuration', () => {
    const harness = createHarness({ 厨房: ['新分类'], 外场: ['香烟类'] });
    harness.database.purchases.push({ items: [{ name: '纸杯', section: '厨房', category: '旧分类', unitPrice: 5 }] });
    const item = { name: '纸杯', section: '', category: '' };

    harness.context.addHistoryMatches([item]);

    expect(item).toMatchObject({ section: '厨房', category: '' });
    expect((item as any).historyMatch).toMatchObject({ locationIncomplete: true });
  });

  it('uses the latest history row when it has a removed area', () => {
    const harness = createHarness({ 厨房: ['干调'], 外场: ['香烟类'] });
    harness.database.purchases.push(
      { items: [{ name: '纸杯', section: '厨房', category: '干调', unitPrice: 5 }] },
      { items: [{ name: '纸杯', section: '已删除区域', category: '旧分类', unitPrice: 5 }] },
    );
    const item = { name: '纸杯', section: '', category: '' };

    harness.context.addHistoryMatches([item]);

    expect(item).toMatchObject({ name: '纸杯', section: '', category: '' });
    expect((item as any).historyMatch).toMatchObject({ section: '', category: '', locationUnavailable: true, locationIncomplete: true });
    expect(harness.context.getMatchSuggestionHTML(item)).toContain('最近记录的区域/分类已不在当前配置');
  });

  it('uses the latest history row category when older rows have a removed category', () => {
    const harness = createHarness({ 厨房: ['干调'], 外场: ['香烟类'] });
    harness.database.purchases.push(
      { items: [{ name: '纸杯', section: '厨房', category: '干调', unitPrice: 5 }] },
      { items: [{ name: '纸杯', section: '厨房', category: '已删除分类', unitPrice: 5 }] },
    );
    const item = { name: '纸杯', section: '', category: '' };

    harness.context.addHistoryMatches([item]);

    expect(item).toMatchObject({ name: '纸杯', section: '厨房', category: '' });
    expect((item as any).historyMatch).toMatchObject({ section: '厨房', category: '', locationUnavailable: true, locationIncomplete: true });
    expect(harness.context.getMatchSuggestionHTML(item)).toContain('最近记录的区域/分类已不在当前配置');
  });

  it('uses the most recent configured area and category when same-name history differs', () => {
    const areaHarness = createHarness({ 厨房: ['干调'], 外场: ['香烟类'] });
    areaHarness.database.purchases.push(
      { items: [{ name: '纸杯', section: '厨房', category: '干调', unitPrice: 5 }] },
      { items: [{ name: '纸杯', section: '外场', category: '香烟类', unitPrice: 5 }] },
    );
    const areaConflict = { name: '纸杯', section: '', category: '' };

    areaHarness.context.addHistoryMatches([areaConflict]);

    expect(areaConflict).toMatchObject({ section: '外场', category: '香烟类' });
    expect((areaConflict as any).historyMatch).toMatchObject({ section: '外场', category: '香烟类', locationIncomplete: false });

    const categoryHarness = createHarness({ 厨房: ['干调', '一次性用品'], 外场: ['香烟类'] });
    categoryHarness.database.purchases.push(
      { items: [{ name: '纸杯', section: '厨房', category: '干调', unitPrice: 5 }] },
      { items: [{ name: '纸杯', section: '厨房', category: '一次性用品', unitPrice: 5 }] },
    );
    const categoryConflict = { name: '纸杯', section: '', category: '' };

    categoryHarness.context.addHistoryMatches([categoryConflict]);

    expect(categoryConflict).toMatchObject({ section: '厨房', category: '一次性用品' });
    expect((categoryConflict as any).historyMatch).toMatchObject({ section: '厨房', category: '一次性用品', locationIncomplete: false });
  });

  it('uses the matched historical category instead of an AI category guess', () => {
    const harness = createHarness({ 厨房: ['干调'], 外场: ['香烟类'] });
    harness.database.purchases.push({ items: [{ name: '纸杯', section: '厨房', category: '干调', unitPrice: 5 }] });
    const item = { name: '纸杯', section: '', category: 'AI识别分类' };

    harness.context.addHistoryMatches([item]);

    expect(item).toMatchObject({ section: '厨房', category: '干调' });
    expect((item as any).historyMatch).toMatchObject({ section: '厨房', category: '干调' });
  });

  it('requires a configured source but permits matched items from different areas', () => {
    const harness = createHarness({ 厨房: ['干调'], 外场: ['香烟类'] });
    const pmSource = createSelect('', ['', '已有来源']);
    harness.controls.set('pResSrc', { value: ' 新供应商 ' });
    harness.controls.set('pmDate', { value: '2026-10-01' });
    harness.controls.set('pmSrc', pmSource);
    harness.context.window._mimoResult = {
      date: '2026-10-01',
      source: '新供应商',
      items: [{ name: '纸杯', section: '厨房', category: '干调', qty: 2, unit: '个', unitPrice: 3, total: 6 }],
    };

    harness.context.doMimoConfirm();
    expect(harness.context._pmAiReviewState.sourceResolved).toBe(false);
    expect(harness.context._pmItems[0]).toMatchObject({ section: '', category: '', aiSectionSuggestion: '厨房', aiCategorySuggestion: '干调' });
    expect(harness.controls.get('pmList').innerHTML).not.toContain('<option value="新供应商"');

    harness.context.saveMPur();
    expect(harness.database.purchases).toHaveLength(0);

    pmSource.value = '已有来源';
    harness.context.pmSrcChanged();
    expect(harness.context._pmAiReviewState).toMatchObject({ sourceResolved: true, sourceManuallySelected: true });
    expect(harness.controls.get('pmList').innerHTML).toContain('已选择账号来源“已有来源”');
    harness.context._pmItems[0].section = '外场';
    harness.context._pmItems[0].category = '香烟类';
    harness.context._pmItems.push({ name: '纸巾', section: '厨房', category: '干调', qty: 1, unit: '包', unitPrice: 2, total: 2 });
    harness.context.saveMPur();

    expect(pmSource.value).toBe('已有来源');
    expect(harness.database.purchases[0].source).toBe('已有来源');
    expect(harness.database.purchases[0].items[0]).toMatchObject({ source: '已有来源', section: '外场', category: '香烟类' });
    expect(harness.database.purchases[0].items[1]).toMatchObject({ source: '已有来源', section: '厨房', category: '干调' });
    expect(JSON.parse(harness.localStorage.getItem(harness.key)!).purchaseSources).toEqual(['已有来源']);
  });

  it('automatically fills a unique history match while leaving an unmatched supplier unresolved', () => {
    const harness = createHarness({ 厨房: ['干调'], 外场: ['香烟类'] });
    const pmSource = createSelect('', ['', '已有来源']);
    harness.controls.set('pmDate', { value: '' });
    harness.controls.set('pmSrc', pmSource);
    harness.controls.set('pmList', { innerHTML: '' });
    harness.database.purchases.push({ items: [{ name: '纸杯', section: '外场', category: '香烟类', unitPrice: 5 }] });
    harness.context.showAILoading = () => {};
    harness.context.hideAILoading = () => {};
    harness.context.mimoDiag = () => {};
    harness.context.mimoEndpointSummary = () => 'https://api.example/v1';
    harness.context.mimoMemorySnapshot = () => ({});
    harness.context.mimoResponseSummary = () => ({});
    harness.context.goPage = () => {};
    harness.context.switchPT = () => {};
    harness.context.window._pendingMimoBase64 = 'aGVsbG8=';
    harness.context.window._pendingMimoEp = 'https://api.example/v1/chat/completions';
    harness.context.window._pendingMimoKey = 'test-secret';

    harness.context.doAIParseGo();
    const request = harness.requests[0];
    const requestBody = JSON.parse(request.body || request.sentBody || request.payload || '{}');
    request.status = 200;
    request.responseText = JSON.stringify({
      choices: [{ message: { content: JSON.stringify({
        date: '2026-10-01', source: '未配置供应商',
        items: [{ name: '纸杯', section: '厨房', category: '干调', qty: 2, unit: '个', unitPrice: 3, total: 6 }],
      }) } }],
    });
    request.onload();

    expect(requestBody.messages[0].content[0].text).toContain('不要返回category');
    expect(harness.context._pmAiReviewState).toMatchObject({ active: true, sourceResolved: false });
    expect(harness.context._pmItems[0]).toMatchObject({ name: '纸杯', section: '外场', category: '香烟类', aiSectionSuggestion: '厨房', historyMatch: { section: '外场', category: '香烟类' } });
    expect(pmSource.value).toBe('');
    expect(harness.controls.get('pmList').innerHTML).toContain('已按名称自动匹配 1 项');
    expect(harness.controls.get('pmList').innerHTML).toContain('未匹配到已配置来源');
  });

  it('maps only a unique, specific supplier alias to a configured source', () => {
    const { context } = createHarness({ 厨房: [], 外场: [] });

    expect(context.matchConfiguredPurchaseSource(' 安徽岸香贸易有限公司 ', ['岸香贸易'])).toMatchObject({ source: '岸香贸易', status: 'alias' });
    expect(context.matchConfiguredPurchaseSource('岸香贸易配送有限公司', ['岸香贸易', '岸香贸易配送'])).toMatchObject({ source: '', status: 'ambiguous' });
    expect(context.matchConfiguredPurchaseSource('采购', ['岸香贸易'])).toMatchObject({ source: '', status: 'unmatched' });
    expect(context.matchConfiguredPurchaseSource('浙江商贸有限公司', ['商贸'])).toMatchObject({ source: '', status: 'unmatched' });
    expect(context.matchConfiguredPurchaseSource('', ['岸香贸易'])).toMatchObject({ source: '', status: 'empty' });
  });

  it('corrects a unique one-character OCR typo and leaves tied name candidates for review', () => {
    const harness = createHarness({ 厨房: ['干调'], 外场: ['香烟类'] });
    harness.database.purchases.push({ items: [
      { name: '一次性纸杯', section: '厨房', category: '干调', unitPrice: 5 },
      { name: '红豆糖', section: '厨房', category: '干调', unitPrice: 4 },
      { name: '红豆茶', section: '外场', category: '香烟类', unitPrice: 4 },
    ] });
    const corrected = { name: '一次性紙杯', section: '', category: '' };
    const ambiguous = { name: '红豆杯', section: '', category: '' };

    harness.context.addHistoryMatches([corrected, ambiguous]);

    expect(corrected).toMatchObject({ name: '一次性纸杯', section: '厨房', category: '干调', originalName: '一次性紙杯' });
    expect(ambiguous).toMatchObject({ name: '红豆杯', section: '', category: '', historyMatchAmbiguous: true });
    expect(harness.context.getMatchSuggestionHTML(ambiguous)).toContain('名称候选不唯一');
  });

  it('escapes untrusted purchase sources in day details and keeps source text out of inline handlers', () => {
    const harness = createHarness({ 厨房: ['干调'], 外场: ['香烟类'] });
    const maliciousSource = "</span><img src=x onerror=alert(1)>";
    harness.database.purchases.push({
      id: 'purchase-xss', date: '2026-10-01', source: maliciousSource,
      items: [{ name: '纸杯', source: maliciousSource, section: '厨房', category: '干调', qty: 1, unit: '个', unitPrice: 3, total: 3 }],
    });
    harness.database.purchases.push({
      id: 'purchase-prototype-source', date: '2026-10-01', source: '__proto__',
      items: [{ name: '纸巾', source: '__proto__', section: '厨房', category: '干调', qty: 1, unit: '包', unitPrice: 2, total: 2 }],
    });
    let modalHtml = '';
    harness.context.showModal = (html: string) => { modalHtml = html; };

    harness.context.showPurDayModal('2026-10-01');

    expect(modalHtml).toContain('&lt;/span&gt;&lt;img src=x onerror=alert(1)&gt;');
    expect(modalHtml).not.toContain('</span><img src=x onerror=alert(1)>');
    expect(modalHtml).toContain('editPurSrcByIndex(0)');
    expect(modalHtml).not.toContain('editPurSrc(\'2026-10-01\',');
    expect(modalHtml).toContain('>__proto__</span>');
  });

  it('escapes a source in the source-edit dialog without embedding it in onclick code', () => {
    const harness = createHarness({ 厨房: [], 外场: [] });
    const maliciousSource = "岸香');alert(1)//";
    harness.database.purchases.push({
      id: 'purchase-edit-xss', date: '2026-10-01', source: maliciousSource,
      items: [{ name: '纸杯', source: maliciousSource, qty: 1, total: 3 }],
    });
    let modalHtml = '';
    harness.context.showModal = (html: string) => { modalHtml = html; };

    harness.context.editPurSrc('2026-10-01', maliciousSource);

    expect(modalHtml).toContain('岸香&#39;);alert(1)//');
    expect(modalHtml).not.toContain("onclick=\"doEditPurSrc('2026-10-01'");
    expect(modalHtml).toContain('onclick="doEditPurSrc()"');
  });

  it('escapes a purchase source in the return details card', () => {
    const harness = createHarness({ 厨房: [], 外场: [] });
    const maliciousSource = '<svg onload=alert(1)>';
    harness.database.purchases.push({
      id: 'purchase-return-xss', date: '2026-10-01', source: maliciousSource,
      items: [{ id: 'item-1', name: '纸杯', source: maliciousSource, section: '厨房', category: '干调', qty: 2, unit: '个', unitPrice: 3, total: 6 }],
    });
    harness.context.window._selectedRelPur = {
      purchaseId: 'purchase-return-xss', itemId: 'item-1', name: '纸杯', source: maliciousSource,
      section: '厨房', category: '干调', unit: '个',
    };
    harness.controls.set('prSummary', { innerHTML: '' });
    harness.controls.set('prPending', { innerHTML: '' });

    harness.context.renderPurchaseReturn();

    expect(harness.controls.get('prSummary').innerHTML).toContain('&lt;svg onload=alert(1)&gt;');
    expect(harness.controls.get('prSummary').innerHTML).not.toContain('<svg onload=alert(1)>');
  });

  it('escapes a purchase source in the legacy return modal', () => {
    const harness = createHarness({ 厨房: [], 外场: [] });
    const maliciousSource = '<svg onload=alert(1)>';
    harness.database.purchases.push({
      id: 'purchase-return-modal-xss', date: '2026-10-01', source: maliciousSource,
      items: [{ name: '纸杯', source: maliciousSource, qty: 2, unit: '个', unitPrice: 3, total: 6 }],
    });
    let modalHtml = '';
    harness.context.showModal = (html: string) => { modalHtml = html; };

    harness.context.returnPurItem('2026-10-01', '纸杯');

    expect(modalHtml).toContain('&lt;svg onload=alert(1)&gt;');
    expect(modalHtml).not.toContain('<svg onload=alert(1)>');
  });

  it('escapes a purchase source in global search results', () => {
    const harness = createHarness({ 厨房: [], 外场: [] });
    const maliciousSource = '</span><img src=x onerror=alert(1)>';
    harness.database.purchases.push({ date: '2026-10-01', source: maliciousSource, items: [{ name: '纸杯' }] });
    harness.controls.set('searchIn', { value: '纸杯' });
    harness.controls.set('searchResults', { innerHTML: '' });

    harness.context.doSearch();

    expect(harness.controls.get('searchResults').innerHTML).toContain('&lt;/span&gt;&lt;img src=x onerror=alert(1)&gt;');
    expect(harness.controls.get('searchResults').innerHTML).not.toContain('</span><img src=x onerror=alert(1)>');
  });

  it('escapes configured supplier names and keeps them out of settings inline handlers', () => {
    const harness = createHarness({ 厨房: [], 外场: [] });
    const maliciousSource = "岸香');alert(1)//";
    let modalHtml = '';
    harness.context.getAppConfig = () => ({ purchaseSources: [maliciousSource] });
    harness.context.showModal = (html: string) => { modalHtml = html; };
    vm.runInContext(readFileSync(new URL('../src/js/settings.js', import.meta.url), 'utf8'), harness.context);

    harness.context.showPurchaseSourceConfig();

    expect(modalHtml).toContain('岸香&#39;);alert(1)//');
    expect(modalHtml).toContain('removePurchaseSourceFromConfigByIndex(0)');
    expect(modalHtml).not.toContain("removePurchaseSourceFromConfig('岸香");
  });

  it('escapes saved supplier names in report cost rows and read-only day details', () => {
    const harness = createHarness({ 厨房: [], 外场: [] });
    const maliciousSource = '</td><img src=x onerror=alert(1)>';
    harness.database.purchases.push({
      id: 'purchase-report-xss', date: '2026-10-01', source: maliciousSource,
      items: [{ name: '纸杯', source: maliciousSource, section: '厨房', category: '干调', qty: 1, unit: '个', unitPrice: 3, total: 3 }],
    });
    harness.controls.set('mainContent', {});
    harness.context.axIcon = () => '';
    let modalHtml = '';
    harness.context.showModal = (html: string) => { modalHtml = html; };
    vm.runInContext(readFileSync(new URL('../src/js/report.js', import.meta.url), 'utf8'), harness.context);

    const costs = harness.context.renderCostSection({}, 3, 0, 0, 0, 0, 0, 0, {}, 0, 0, null, '2026-10');
    harness.context.showPurDayModalReadOnly('2026-10-01');

    expect(costs).toContain('&lt;/td&gt;&lt;img src=x onerror=alert(1)&gt;');
    expect(costs).not.toContain('</td><img src=x onerror=alert(1)>');
    expect(modalHtml).toContain('&lt;/td&gt;&lt;img src=x onerror=alert(1)&gt;');
    expect(modalHtml).not.toContain('</td><img src=x onerror=alert(1)>');
    expect(modalHtml).toContain('toggleSection(\'srcDay1\')');
  });

  it('escapes saved supplier names in generated business briefs', () => {
    const harness = createHarness({ 厨房: [], 外场: [] });
    const maliciousSource = '</td><img src=x onerror=alert(1)>';
    harness.database.purchases.push({
      date: '2026-10-01', source: maliciousSource,
      items: [{ name: '纸杯', source: maliciousSource, section: '厨房', category: '干调', qty: 1, unitPrice: 3, total: 3 }],
    });
    harness.controls.set('genM', { value: '2026-10' });
    let briefHtml = '';
    harness.context.window.open = () => ({ document: { write(html: string) { briefHtml = html; }, close() {} } });
    vm.runInContext(readFileSync(new URL('../src/js/brief.js', import.meta.url), 'utf8'), harness.context);

    harness.context.doGen('month');

    expect(briefHtml).toContain('&lt;/td&gt;&lt;img src=x onerror=alert(1)&gt;');
    expect(briefHtml).not.toContain('</td><img src=x onerror=alert(1)>');
  });

  it('keeps each rendered source row aligned with the purchase source selector and saved record', () => {
    const harness = createHarness({ 厨房: ['干调'], 外场: ['香烟类'] });
    const pmSource = createSelect('原来源', ['原来源', '新来源']);
    harness.controls.set('pmSrc', pmSource);
    harness.controls.set('pmDate', { value: '2026-10-01' });
    harness.context._pmItems = [{ name: '纸杯', section: '厨房', category: '干调', source: '原来源', qty: 1, unit: '个', unitPrice: 3, total: 3 }];

    pmSource.value = '新来源';
    harness.context.pmSrcChanged();

    expect(harness.context._pmItems[0].source).toBe('新来源');
    expect(harness.controls.get('pmList').innerHTML).toContain('<option value="新来源" selected>新来源</option>');
    harness.context.saveMPur();

    expect(harness.database.purchases[0].source).toBe('新来源');
    expect(harness.database.purchases[0].items[0].source).toBe('新来源');
    expect(JSON.parse(harness.localStorage.getItem(harness.key)!).purchaseSources).toEqual(['已有来源']);
  });

  it('restores a temporary supplier when editing and resaving a saved purchase', () => {
    const harness = createHarness({ 厨房: ['干调'], 外场: ['香烟类'] });
    const purchase = {
      id: 'purchase-temporary-source', date: '2026-10-01', source: '新供应商',
      items: [{ name: '纸杯', source: '新供应商', section: '厨房', category: '干调', qty: 1, unit: '个', unitPrice: 3, total: 3 }],
    };
    harness.database.purchases.push(purchase);
    const sourceSelect = createSelect('', ['已有来源']);
    harness.controls.set('pmSrc', sourceSelect);
    harness.controls.set('pmDate', { value: '' });
    harness.context.window.scrollTo = () => {};

    harness.context.editPur(purchase.id);

    expect(sourceSelect.value).toBe('新供应商');
    expect(sourceSelect.options.map((option: any) => option.value)).toContain('新供应商');
    expect(harness.controls.get('pmList').innerHTML).toContain('<option value="新供应商" selected>新供应商</option>');
    harness.context.saveMPur();

    expect(purchase.source).toBe('新供应商');
    expect(purchase.items[0].source).toBe('新供应商');
    expect(JSON.parse(harness.localStorage.getItem(harness.key)!).purchaseSources).toEqual(['已有来源']);
  });

  it('keeps a temporary supplier selected in single-item edit and saves it unchanged', () => {
    const harness = createHarness({ 厨房: ['干调'], 外场: ['香烟类'] });
    harness.database.purchases.push({
      id: 'purchase-single-edit', date: '2026-10-01', source: '新供应商',
      items: [{ id: 'item-1', name: '纸杯', source: '新供应商', section: '厨房', category: '干调', qty: 1, unit: '个', unitPrice: 3, total: 3 }],
    });
    let modalHtml = '';
    harness.context.showModal = (html: string) => { modalHtml = html; };

    harness.context.editPurByDate('2026-10-01', '纸杯');

    expect(modalHtml).toContain('<option value="新供应商" selected>新供应商</option>');
    harness.controls.set('epi_date', { value: '2026-10-01' });
    harness.controls.set('epi_source', createSelect('新供应商', ['已有来源', '新供应商']));
    harness.controls.set('epi_name', { value: '纸杯' });
    harness.controls.set('epi_sec', { value: '厨房' });
    harness.controls.set('epi_cat', { value: '干调' });
    harness.controls.set('epi_qty', { value: '1' });
    harness.controls.set('epi_unit', { value: '个' });
    harness.controls.set('epi_up', { value: '3' });
    harness.controls.set('epi_total', { value: '3' });
    harness.context.showPurDayModal = () => {};
    harness.context.renderPHist = () => {};

    harness.context.doEditPurItem('2026-10-01', '纸杯');

    const saved = harness.database.purchases.find((record: any) => record.items.some((item: any) => item.name === '纸杯'));
    expect(saved.source).toBe('新供应商');
    expect(saved.items[0].source).toBe('新供应商');
    expect(JSON.parse(harness.localStorage.getItem(harness.key)!).purchaseSources).toEqual(['已有来源']);
  });

  it('escapes AI supplier text in the batch source selector', () => {
    const harness = createHarness({ 厨房: ['干调'], 外场: ['香烟类'] });
    const maliciousSource = '供应商</option><img src=x onerror=alert(1)>';
    const maliciousUnit = '\"><svg onload=alert(1)>';
    harness.context._pmItems = [{ name: '纸杯', source: maliciousSource, section: '厨房', category: '干调', qty: 1, unit: maliciousUnit, unitPrice: 3, total: 3 }];

    harness.context.renderPML();

    const html = harness.controls.get('pmList').innerHTML;
    const batchOptions = html.split('id="pmBatchSrc"')[1].split('</select>')[0];
    expect(batchOptions).toContain('&lt;/option&gt;&lt;img src=x onerror=alert(1)&gt;');
    expect(batchOptions).not.toContain('</option><img src=x onerror=alert(1)>');
    expect(html).toContain('&quot;&gt;&lt;svg onload=alert(1)&gt;');
    expect(html).not.toContain('\"><svg onload=alert(1)>');
  });

  it('loads model candidates while retaining the current custom model', () => {
    const harness = createHarness({ 厨房: [], 外场: [] });
    const modelInput = { value: 'my-custom-vision' };
    const modelList = createDatalist(['my-custom-vision']);
    const status = { textContent: '' };
    harness.controls.set('mimoEndpoint', { value: 'https://api.example/v1/chat/completions' });
    harness.controls.set('mimoKey', { value: 'test-secret' });
    harness.controls.set('mimoModel', modelInput);
    harness.controls.set('mimoModelOptions', modelList);
    harness.controls.set('mimoModelStatus', status);

    harness.context.loadMimoModels();
    const request = harness.requests[0];
    expect([request.method, request.url, request.headers.Authorization]).toEqual([
      'GET', 'https://api.example/v1/models', 'Bearer test-secret',
    ]);
    request.status = 200;
    request.responseText = JSON.stringify({ data: [{ id: 'z-model' }, { id: 'a-model' }, { id: 'a-model' }] });
    request.onload();

    expect(modelInput.value).toBe('my-custom-vision');
    expect(modelList.options.map((option: any) => option.value)).toEqual(['my-custom-vision', 'a-model', 'z-model']);
    expect(status.textContent).toBe('已加载 2 个模型');
    expect(status.textContent).not.toContain('test-secret');
  });

  it('keeps the custom model and existing model candidates after an empty or failed response', () => {
    const harness = createHarness({ 厨房: [], 外场: [] });
    const modelInput = { value: 'custom-model' };
    const modelList = createDatalist(['custom-model', 'existing-model']);
    const status = { textContent: '' };
    harness.controls.set('mimoEndpoint', { value: 'https://api.example/v1/chat/completions' });
    harness.controls.set('mimoKey', { value: 'test-secret' });
    harness.controls.set('mimoModel', modelInput);
    harness.controls.set('mimoModelOptions', modelList);
    harness.controls.set('mimoModelStatus', status);

    harness.context.loadMimoModels();
    harness.requests[0].status = 200;
    harness.requests[0].responseText = JSON.stringify({ data: [] });
    harness.requests[0].onload();
    expect(modelInput.value).toBe('custom-model');
    expect(status.textContent).toContain('未返回模型');

    harness.context.loadMimoModels();
    harness.requests[1].status = 401;
    harness.requests[1].responseText = 'unauthorized';
    harness.requests[1].onload();
    expect(modelInput.value).toBe('custom-model');
    expect(modelList.options.map((option: any) => option.value)).toEqual(['custom-model', 'existing-model']);
    expect(status.textContent).toContain('HTTP 401');

    harness.context.loadMimoModels();
    harness.requests[2].onerror();
    expect(modelInput.value).toBe('custom-model');
    expect(modelList.options.map((option: any) => option.value)).toEqual(['custom-model', 'existing-model']);
    expect(status.textContent).toContain('网络或跨域限制');
  });

  it('recognizes a colon-terminated outside heading instead of carrying over kitchen', () => {
    const harness = createHarness({ 厨房: ['干调'], 外场: ['香烟类'] });
    const parsed = harness.context.parsePurchase('厨房\n盐\t1袋\t5\t5\n外场：\n纸杯\t2个\t3\t6');

    expect(parsed.items.map((item: any) => item.section)).toEqual(['厨房', '外场']);
  });
});
