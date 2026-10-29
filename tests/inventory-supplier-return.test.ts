import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const legacySource = readFileSync(new URL('../src/js/inventory.js', import.meta.url), 'utf8');
const ledgerSource = readFileSync(new URL('../src/js/inventory-ledger.js', import.meta.url), 'utf8');
const customSource = readFileSync(new URL('../src/js/inventory-custom.js', import.meta.url), 'utf8');

function legacyHarness() {
  const item = {
    id: 'c1', name: '香烟', openingStock: 10, purchases: [{ date: '2026-10-15', qty: 5 }],
    sales: [{ date: '2026-10-15', qty: 3, amount: 90 }],
  };
  const db: any = { cigItems: [item], dailyReports: [{ date: '2026-10-15' }], purchases: [], settings: { _lastRollover: '2026-10' } };
  const controls: Record<string, any> = {
    irItem: { value: 'c1' }, irDate: { value: '2026-10-15' }, irQty: { value: '4' },
    irReason: { value: '退给供货方' },
    eir_date: { value: '2026-10-15' }, eir_qty: { value: '2' },
    eir_dir: { value: 'return' }, eir_src: { value: '换货' },
  };
  const notices: string[] = [];
  const context: any = {
    console, DB: db, INV: { cig: { key: 'cigItems' } }, _curPage: 'cig',
    document: { addEventListener() {} }, addEventListener() {}, curYM: () => '2026-10', td: () => '2026-10-15',
    $id: (id: string) => controls[id], requireAuth: () => true,
    inventoryCurrentLegacyType: () => ({ id: 'cig', preset: 'cig' }),
    inventoryOperationEnabled: () => true, inventoryLegacyActionEnabled: () => true,
    upd: (fn: (database: any) => void) => fn(db), closeModal() {}, toast: (message: string) => notices.push(message),
    confirm: () => true,
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(legacySource, context);
  context.rInv = () => {};
  context.refreshDetBuy = () => {};
  return { context, db, item, controls, notices };
}

function customHarness() {
  const item = { id: 'i1', typeId: 't1', name: '咖啡豆', unit: '袋', openingStock: 5, openingUnitCost: 10, transactions: [] as any[] };
  const db: any = { inventoryCustomItems: [item], dailyReports: [], purchases: [] };
  const type = { id: 't1', preset: 'generic', archived: false, deleted: false, actions: { return: true } };
  const controls: Record<string, any> = {
    inventoryTxnItem: { value: 'i1' }, inventoryTxnDate: { value: '2026-10-15' },
    inventoryTxnQty: { value: '2' }, inventoryTxnNote: { value: '供应商收回' },
  };
  const notices: string[] = [];
  const context: any = {
    console, DB: db, curYM: () => '2026-10', td: () => '2026-10-15',
    getAppConfig: () => ({ inventoryTypeDefinitions: [type] }),
    $id: (id: string) => controls[id], requireAuth: () => true,
    inventoryValidDate: (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date),
    upd: (fn: (database: any) => void) => fn(db), closeModal() {}, toast: (message: string) => notices.push(message),
  };
  context.window = context;
  vm.createContext(context);
  vm.runInContext(ledgerSource, context);
  vm.runInContext(customSource, context);
  context.rCustomInventory = () => {};
  return { context, db, item, controls, notices };
}

describe('supplier returns from inventory', () => {
  it('deducts legacy stock without changing sales, daily reports or purchase records', () => {
    const { context, db, item } = legacyHarness();
    expect(context.inventoryLegacyAvailableAt(item, 'cig', '2026-10-15')).toBe(12);
    context.saveInvReturn('cig');
    expect(item.purchases).toHaveLength(2);
    expect(item.purchases[1]).toMatchObject({ kind: 'return', qty: -4, reason: '退给供货方' });
    expect(context.inventoryLegacyAvailableAt(item, 'cig', '2026-10-15')).toBe(8);
    const records = context.buildRecords(item, 'cig', '2026-10');
    expect(records.find((record: any) => record.kind === 'return')).toMatchObject({ source: '退给供货方' });
    expect(records.find((record: any) => record.kind === 'sale').source).toBe('日报');
    expect(item.sales).toHaveLength(1);
    expect(db.dailyReports).toHaveLength(1);
    expect(db.purchases).toHaveLength(0);
  });

  it('blocks a return that exceeds stock or changes a closed month', () => {
    const { context, item, controls, notices } = legacyHarness();
    controls.irQty.value = '13';
    context.saveInvReturn('cig');
    expect(item.purchases).toHaveLength(1);
    expect(notices.at(-1)).toContain('不能超过');
    controls.irQty.value = '2';
    (item as any).monthClosingStock = { '2026-10': 12 };
    context.saveInvReturn('cig');
    expect(item.purchases).toHaveLength(1);
    expect(notices.at(-1)).toContain('已结转');
  });

  it('converts legacy pack quantities and validates edits before changing stock', () => {
    const { context, item, controls, notices } = legacyHarness();
    controls.irUnit = { value: '条' };
    controls.irQty.value = '1';
    context.saveInvReturn('cig');
    expect(item.purchases[1]).toMatchObject({ kind: 'return', qty: -10 });
    controls.eir_qty.value = '13';
    context.doEditInvMove('cig', 'c1', 1);
    expect(item.purchases[1].qty).toBe(-10);
    expect(notices.at(-1)).toContain('不能超过');
    controls.eir_qty.value = '2';
    context.doEditInvMove('cig', 'c1', 1);
    expect(item.purchases[1]).toMatchObject({ kind: 'return', qty: -2, reason: '换货' });
    context.delInvRow('cig', 'c1', 'move', 1);
    expect(item.purchases).toHaveLength(1);
  });

  it('uses a confirmed prior closing as opening when the current opening is absent', () => {
    const { context, item } = legacyHarness();
    item.openingStock = null as any;
    (item as any).monthClosingStock = { '2026-09': 8 };
    expect(context.inventoryLegacyAvailableAt(item, 'cig', '2026-10-15')).toBe(10);
    (item as any).monthOpeningStock = { '2026-10': null };
    expect(context.inventoryLegacyAvailableAt(item, 'cig', '2026-10-15')).toBeNull();
  });

  it('consumes FIFO layers for a custom return without adding sales revenue', () => {
    const { context, item, db, controls, notices } = customHarness();
    item.transactions.push({ id: 'in1', kind: 'inbound', date: '2026-10-14', createdAt: 1, qty: 2, unitCost: 20 });
    controls.inventoryTxnQty.value = '8';
    context.saveInventoryTransaction('t1', 'return', 'i1', '');
    expect(item.transactions).toHaveLength(1);
    expect(notices.at(-1)).toContain('不能超过');
    controls.inventoryTxnQty.value = '2';
    context.saveInventoryTransaction('t1', 'return', 'i1', '');
    expect(item.transactions).toHaveLength(2);
    expect(item.transactions[1]).toMatchObject({ kind: 'return', qty: 2, amount: 0 });
    item.transactions.push({ id: 's1', kind: 'sale', date: '2026-10-16', createdAt: 100, qty: 2, amount: 100 });
    const ledger = context.inventoryLedger(item);
    expect(ledger.stock).toBe(3);
    expect(ledger.results.s1.cost).toBe(20);
    expect(context.inventoryCustomStats('t1', '2026-10').sales).toBe(100);
    expect(db.dailyReports).toHaveLength(0);
    expect(db.purchases).toHaveLength(0);
  });

  it('does not save a custom return without permission or a known opening', () => {
    const { context, item, notices } = customHarness();
    context.requireAuth = () => false;
    context.saveInventoryTransaction('t1', 'return', 'i1', '');
    expect(item.transactions).toHaveLength(0);
    context.requireAuth = () => true;
    item.openingStock = null as any;
    context.saveInventoryTransaction('t1', 'return', 'i1', '');
    expect(item.transactions).toHaveLength(0);
    expect(notices.at(-1)).toContain('期初库存');
  });
});
