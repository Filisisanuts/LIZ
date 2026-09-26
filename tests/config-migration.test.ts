import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const configStoreSource = readFileSync(
  new URL('../src/js/config-store.js', import.meta.url),
  'utf8',
);

interface StorageHarness {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
  key(index: number): string | null;
  readonly length: number;
}

function createStorage(initial: Record<string, string> = {}): StorageHarness {
  const values = new Map(Object.entries(initial));
  return {
    getItem(key) {
      return values.has(key) ? values.get(key)! : null;
    },
    setItem(key, value) {
      values.set(key, String(value));
    },
    removeItem(key) {
      values.delete(key);
    },
    key(index) {
      return Array.from(values.keys())[index] ?? null;
    },
    get length() {
      return values.size;
    },
  };
}

function createConfigHarness(options: {
  storage?: Record<string, string>;
  database?: Record<string, unknown>;
  userId?: string;
}) {
  const storage = createStorage(options.storage);
  const database = options.database ?? {};
  let syncCount = 0;
  const context: Record<string, unknown> = {
    console,
    localStorage: storage,
    DB: database,
    _auth: options.userId
      ? { loggedIn: true, user: { id: options.userId } }
      : { loggedIn: false, user: null },
    toast() {},
    sbScheduleSave() {
      syncCount += 1;
    },
    saveDB() {},
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(configStoreSource, context);

  return {
    api: context.axConfigStore as {
      getConfigKey(): string;
      getAppConfig(): any;
      saveAppConfig(config: Record<string, unknown>): any;
      migrateAppConfig(): any;
      shouldShowLegacyOnboarding(): boolean;
    },
    database,
    storage,
    get syncCount() {
      return syncCount;
    },
  };
}

describe('unified app config migration', () => {
  it('migrates public and legacy business data into the user config', () => {
    const database = {
      dailyReports: [],
      purchases: [{
        source: '外购',
        items: [{ section: '吧台', category: '饮品' }],
      }],
      expenses: [{ category: '水费' }],
      areaCats: { 厨房: ['调料'] },
      whCats: ['包装'],
      whItems: [],
      settings: {},
    };
    const harness = createConfigHarness({
      userId: 'user-1',
      database,
      storage: {
        ax_fl: JSON.stringify(['实收', '厨房']),
        ax_app_config: JSON.stringify({
          onboardingCompleted: true,
          dailyLabels: [],
          purchaseSources: [],
          purchaseSections: [],
          purchaseCategories: {},
        }),
      },
    });

    const config = harness.api.migrateAppConfig();

    expect(harness.api.getConfigKey()).toBe('ax_app_config_user-1');
    expect(config.dailyLabels).toEqual(['实收', '厨房']);
    expect(config.purchaseSources).toEqual(['外购']);
    expect(config.purchaseSections).toEqual(['厨房', '吧台']);
    expect(config.purchaseCategories).toEqual({
      厨房: ['调料'],
      吧台: ['饮品'],
    });
    expect(config.expenseCategories).toEqual(['水费']);
    expect(config.warehouseCategories).toEqual(['包装']);
    expect(config.schemaVersion).toBe(2);
    expect(harness.storage.getItem('ax_app_config_user-1')).toContain('"schemaVersion":2');
    expect((database.settings as Record<string, any>)['ax_app_config_user-1'])
      .toMatchObject({ expenseCategories: ['水费'] });
  });

  it('reads a fresh browser config from cloud DB.settings', () => {
    const database = {
      settings: {
        ax_app_config_user_2: {
          schemaVersion: 2,
          updatedAt: 100,
          purchaseSources: ['云端来源'],
          purchaseSections: ['厨房'],
          purchaseCategories: { 厨房: ['食材'] },
          onboardingCompleted: true,
        },
      },
    };
    const harness = createConfigHarness({
      userId: 'user_2',
      database,
    });

    expect(harness.api.getAppConfig()).toMatchObject({
      purchaseSources: ['云端来源'],
      purchaseSections: ['厨房'],
      purchaseCategories: { 厨房: ['食材'] },
      onboardingCompleted: true,
    });
  });

  it('prefers a meaningful newer cloud configuration over a blank local startup configuration', () => {
    const database = {
      settings: {
        'ax_app_config_user-5': {
          schemaVersion: 2,
          updatedAt: 100,
          onboardingCompleted: true,
          purchaseSources: ['云端供应商'],
          purchaseSections: ['厨房'],
          purchaseCategories: { 厨房: ['食材'] },
        },
      },
    };
    const harness = createConfigHarness({
      userId: 'user-5',
      database,
      storage: {
        'ax_app_config_user-5': JSON.stringify({
          schemaVersion: 2,
          updatedAt: 200,
          onboardingCompleted: false,
          purchaseSources: [],
          purchaseSections: [],
          purchaseCategories: {},
        }),
      },
    });

    expect(harness.api.migrateAppConfig()).toMatchObject({
      purchaseSources: ['云端供应商'],
      purchaseSections: ['厨房'],
      purchaseCategories: { 厨房: ['食材'] },
    });
    expect(JSON.parse(harness.storage.getItem('ax_app_config_user-5')!))
      .toMatchObject({ purchaseSources: ['云端供应商'] });
  });

  it('does not create a cloud-bound empty config before a new browser loads remote data', () => {
    const database = { areaCats: { 厨房: ['旧分类'] }, whCats: ['包装'] };
    const harness = createConfigHarness({ userId: 'user-6', database });

    harness.api.migrateAppConfig();

    expect(harness.storage.getItem('ax_app_config_user-6')).toBeNull();
    expect((database as any).settings).toBeUndefined();
    expect(database.areaCats).toEqual({ 厨房: ['旧分类'] });
    expect(harness.syncCount).toBe(0);
  });

  it('keeps intentionally empty schema-v2 lists empty', () => {
    const database = {
      areaCats: { 厨房: ['旧分类'] },
      purchases: [{ source: '旧来源', items: [] }],
      settings: {},
    };
    const harness = createConfigHarness({
      userId: 'user-3',
      database,
      storage: {
        'ax_app_config_user-3': JSON.stringify({
          schemaVersion: 2,
          updatedAt: 200,
          purchaseSources: [],
          purchaseSections: [],
          purchaseCategories: {},
          onboardingCompleted: true,
        }),
      },
    });

    const config = harness.api.migrateAppConfig();

    expect(config.purchaseSources).toEqual([]);
    expect(config.purchaseSections).toEqual([]);
    expect(config.purchaseCategories).toEqual({});
  });

  it('persists settings locally, in DB.settings, and schedules cloud sync', () => {
    const database = { settings: {} };
    const harness = createConfigHarness({
      userId: 'user-4',
      database,
    });

    harness.api.saveAppConfig({ purchaseSources: ['新来源'] });

    expect(JSON.parse(harness.storage.getItem('ax_app_config_user-4')!))
      .toMatchObject({ purchaseSources: ['新来源'] });
    expect((database.settings as Record<string, any>)['ax_app_config_user-4'])
      .toMatchObject({ purchaseSources: ['新来源'] });
    expect(harness.syncCount).toBeGreaterThan(0);
  });

  it('uses business data only to decide onboarding, not config visibility', () => {
    const existing = createConfigHarness({
      database: { dailyReports: [{ date: '2026-09-24' }] },
    });
    const blank = createConfigHarness({ database: {} });

    expect(existing.api.shouldShowLegacyOnboarding()).toBe(false);
    expect(blank.api.shouldShowLegacyOnboarding()).toBe(true);
    expect(existing.api.getAppConfig().onboardingCompleted).toBe(true);
  });
});
