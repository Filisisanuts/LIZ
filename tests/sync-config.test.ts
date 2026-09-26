import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const configStoreSource = readFileSync(new URL('../src/js/config-store.js', import.meta.url), 'utf8');
const syncSource = readFileSync(new URL('../src/js/sync.js', import.meta.url), 'utf8');

function storage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key: string) { return values.get(key) ?? null; },
    setItem(key: string, value: string) { values.set(key, String(value)); },
    removeItem(key: string) { values.delete(key); },
    key(index: number) { return Array.from(values.keys())[index] ?? null; },
    get length() { return values.size; },
  };
}

describe('account configuration cloud hydration', () => {
  it('hydrates cloud configuration without replacing newer local business records', async () => {
    const localStorage = storage();
    const database: any = {
      _ts: 500,
      purchases: [{ id: 'local-purchase', source: '本地新增', items: [] }],
      settings: {},
    };
    const cloudData = {
      _ts: 100,
      purchases: [{ id: 'cloud-purchase', source: '云端旧记录', items: [] }],
      settings: {
        'ax_app_config_user-7': {
          schemaVersion: 2,
          updatedAt: 100,
          onboardingCompleted: true,
          purchaseSources: ['岸香贸易', '外购'],
          purchaseSections: ['厨房'],
          purchaseCategories: { 厨房: ['食材'] },
        },
      },
    };
    const client = {
      from() {
        return {
          select() {
            return {
              eq() {
                return { single: async () => ({ data: { data: cloudData }, error: null }) };
              },
            };
          },
          upsert: async () => ({ error: null }),
        };
      },
    };
    const context: Record<string, any> = {
      console,
      localStorage,
      DB: database,
      _auth: { loggedIn: true, user: { id: 'user-7' } },
      saveDB() {},
      toast() {},
      migrateAreaCats() {},
      setTimeout,
      clearTimeout,
    };
    context.window = context;
    vm.createContext(context);
    vm.runInContext(configStoreSource, context);
    vm.runInContext(syncSource, context);
    context._sb.ready = true;
    context._sb.client = client;

    await context.sbSyncOnStart();

    expect(context.DB.purchases).toEqual([{ id: 'local-purchase', source: '本地新增', items: [] }]);
    expect(context.DB.settings['ax_app_config_user-7']).toMatchObject({
      purchaseSources: ['岸香贸易', '外购'],
    });
    expect(JSON.parse(localStorage.getItem('ax_app_config_user-7')!)).toMatchObject({
      purchaseCategories: { 厨房: ['食材'] },
    });
  });
});
