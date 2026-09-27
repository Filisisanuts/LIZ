import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const sources = ['config-store', 'utils', 'category', 'purchase', 'sync'].map((name) =>
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
    purchaseCategories: categories,
  };
  const localStorage = createStorage({ [key]: JSON.stringify(config) });
  const controls = new Map<string, any>();
  const database: any = {
    settings: { [key]: structuredClone(config) },
    areaCats: structuredClone(categories),
    purchases: [],
  };
  let syncCount = 0;
  const document = {
    readyState: 'loading',
    addEventListener() {},
    getElementById(id: string) { return controls.get(id) ?? null; },
    querySelectorAll(_selector: string) { return []; },
    createElement(_tag: string) { return { value: '', text: '' }; },
  };
  const context: Record<string, any> = {
    console,
    document,
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
  context.sbScheduleSave = () => { syncCount += 1; };
  controls.set('macArea', { value: '厨房' });
  controls.set('newAreaCat', { value: '' });
  controls.set('macList', { innerHTML: '' });
  return { context, controls, database, key, localStorage, get syncCount() { return syncCount; } };
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

  it('keeps an AI item section blank when the same name exists in kitchen history', () => {
    const harness = createHarness({ 厨房: ['干调'], 外场: ['香烟类'] });
    harness.database.purchases.push({
      items: [{ name: '纸杯', section: '厨房', category: '干调', unitPrice: 5 }],
    });
    const item = { name: '纸杯', section: '', category: '' };

    harness.context.addHistoryMatches([item]);

    expect(item).toMatchObject({ section: '', category: '' });
    expect((item as any).historyMatch).toMatchObject({ section: '厨房', category: '干调' });
  });

  it('recognizes a colon-terminated outside heading instead of carrying over kitchen', () => {
    const harness = createHarness({ 厨房: ['干调'], 外场: ['香烟类'] });
    const parsed = harness.context.parsePurchase('厨房\n盐\t1袋\t5\t5\n外场：\n纸杯\t2个\t3\t6');

    expect(parsed.items.map((item: any) => item.section)).toEqual(['厨房', '外场']);
  });
});
