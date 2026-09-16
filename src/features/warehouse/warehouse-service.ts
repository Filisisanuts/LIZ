/**
 * Warehouse Service - 仓库数据服务
 *
 * 负责仓库物品的增删改查操作。
 */

import legacyBridge from '@/legacy/legacy-bridge';

// ===== 类型定义 =====

export interface WarehouseItem {
  id: string;
  name: string;
  category: string;
  unit: string;
  stock: number;
  safeStock: number;
  matchKeyword: string;
  movements: Movement[];
}

export interface Movement {
  date: string;
  qty: number;
  reason: string;
}

export interface CreateWarehouseInput {
  name: string;
  category: string;
  unit: string;
  stock: number;
  safeStock: number;
  matchKeyword?: string;
}

export interface MovementInput {
  date: string;
  qty: number;
  reason: string;
}

// ===== 服务函数 =====

/**
 * 获取所有仓库物品
 */
export function getWarehouseItems(): WarehouseItem[] {
  const db = legacyBridge.getDatabase();
  return db?.whItems || [];
}

/**
 * 获取仓库分类
 * 从配置管理模块读取
 */
export function getWarehouseCategories(): string[] {
  // 从配置管理模块读取
  try {
    const config = JSON.parse(localStorage.getItem('ax_app_config') || '{}');
    if (config.warehouseCategories && config.warehouseCategories.length > 0) {
      return config.warehouseCategories;
    }
  } catch (e) {}

  // 从数据库读取
  const db = legacyBridge.getDatabase();
  return db?.whCats || [];
}

/**
 * 创建仓库物品
 */
export function createWarehouseItem(input: CreateWarehouseInput): WarehouseItem {
  const item: WarehouseItem = {
    id: `wh_${Date.now()}`,
    name: input.name,
    category: input.category || '未分类',
    unit: input.unit || '个',
    stock: input.stock || 0,
    safeStock: input.safeStock || 0,
    matchKeyword: input.matchKeyword || '',
    movements: [],
  };

  legacyBridge.update((db) => {
    db.whItems.push(item);
  });

  return item;
}

/**
 * 更新仓库物品
 */
export function updateWarehouseItem(id: string, updates: Partial<CreateWarehouseInput>): void {
  legacyBridge.update((db) => {
    const item = db.whItems.find((i: WarehouseItem) => i.id === id);
    if (item) {
      Object.assign(item, updates);
    }
  });
}

/**
 * 删除仓库物品
 */
export function deleteWarehouseItem(id: string): void {
  legacyBridge.update((db) => {
    db.whItems = db.whItems.filter((i: WarehouseItem) => i.id !== id);
  });
}

/**
 * 添加出入库记录
 */
export function addMovement(itemId: string, movement: MovementInput): void {
  legacyBridge.update((db) => {
    const item = db.whItems.find((i: WarehouseItem) => i.id === itemId);
    if (item) {
      item.movements.push(movement);
      item.stock = Math.max(0, item.stock + movement.qty);
    }
  });
}

/**
 * 删除出入库记录
 */
export function deleteMovement(itemId: string, index: number): void {
  legacyBridge.update((db) => {
    const item = db.whItems.find((i: WarehouseItem) => i.id === itemId);
    if (item && item.movements[index]) {
      const movement = item.movements[index];
      item.stock = item.stock - movement.qty;
      item.stock = Math.round(item.stock * 100) / 100;
      item.movements.splice(index, 1);
    }
  });
}

/**
 * 添加仓库分类
 */
export function addCategory(name: string): void {
  legacyBridge.update((db) => {
    if (!db.whCats) db.whCats = ['包装', '调料', '清洁', '耗材', '设备', '其他'];
    if (!db.whCats.includes(name)) {
      db.whCats.push(name);
    }
  });
}

/**
 * 删除仓库分类
 */
export function deleteCategory(index: number): void {
  legacyBridge.update((db) => {
    const cats = db.whCats || [];
    const name = cats[index];
    cats.splice(index, 1);
    // 将该分类下的物品设为"未分类"
    (db.whItems || []).forEach((item: WarehouseItem) => {
      if (item.category === name) {
        item.category = '未分类';
      }
    });
  });
}

/**
 * 获取低库存预警数量
 */
export function getLowStockCount(): number {
  return getWarehouseItems().filter(
    (item) => item.safeStock > 0 && item.stock <= item.safeStock
  ).length;
}

export default {
  getWarehouseItems,
  getWarehouseCategories,
  createWarehouseItem,
  updateWarehouseItem,
  deleteWarehouseItem,
  addMovement,
  deleteMovement,
  addCategory,
  deleteCategory,
  getLowStockCount,
};
