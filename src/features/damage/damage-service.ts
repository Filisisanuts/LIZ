/**
 * Damage Service - 报损数据服务
 *
 * 负责报损记录的增删改查操作。
 */

import legacyBridge from '@/legacy/legacy-bridge';

// ===== 类型定义 =====

export interface DamageRecord {
  id: string;
  date: string;
  category: string;
  itemId: string;
  itemName: string;
  qty: number;
  unit: string;
  reason: string;
  photoFile: string;
}

export interface CreateDamageInput {
  date: string;
  itemName: string;
  qty: number;
  unit: string;
  reason: string;
  photoFile?: string;
}

// ===== 服务函数 =====

/**
 * 获取所有报损记录
 */
export function getDamageRecords(): DamageRecord[] {
  const db = legacyBridge.getDatabase();
  return (db?.damageRecords || []).sort(
    (a: DamageRecord, b: DamageRecord) => b.date.localeCompare(a.date)
  );
}

/**
 * 创建报损记录
 */
export function createDamageRecord(input: CreateDamageInput): DamageRecord {
  const record: DamageRecord = {
    id: `dmg_${Date.now()}`,
    date: input.date,
    category: '报损',
    itemId: '',
    itemName: input.itemName,
    qty: input.qty,
    unit: input.unit,
    reason: input.reason,
    photoFile: input.photoFile || '',
  };

  legacyBridge.update((db) => {
    db.damageRecords.push(record);
  });

  return record;
}

/**
 * 删除报损记录
 */
export function deleteDamageRecord(id: string): void {
  legacyBridge.update((db) => {
    db.damageRecords = db.damageRecords.filter((d: DamageRecord) => d.id !== id);
  });
}

export default {
  getDamageRecords,
  createDamageRecord,
  deleteDamageRecord,
};
