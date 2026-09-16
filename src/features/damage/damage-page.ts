/**
 * Damage Page - 报损页面组件
 *
 * 提供报损录入表单和报损记录列表。
 */

import {
  getDamageRecords,
  createDamageRecord,
  deleteDamageRecord,
  type DamageRecord,
} from './damage-service';

// ===== 状态 =====

let photoData: string | null = null;

// ===== 组件函数 =====

/**
 * 渲染 Damage 页面
 */
export function renderDamage(container: HTMLElement): void {
  const records = getDamageRecords();
  const today = getToday();

  let html = '';

  // 录入表单
  html += '<h3 style="margin-bottom: 0.75rem; font-size: 0.9rem; font-weight: 600;">录入报损</h3>';

  // 日期、物品名
  html += `
    <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap; align-items: center;">
      <label style="font-size: 0.85rem; color: var(--color-text-secondary);">日期</label>
      <input type="text" id="dmgDate" value="${today}" readonly style="max-width: 150px; cursor: pointer;">
      <label style="font-size: 0.85rem; color: var(--color-text-secondary);">物品</label>
      <input type="text" id="dmgName" placeholder="物品名称" style="flex: 2; min-width: 150px;">
    </div>
  `;

  // 数量、单位、原因
  html += `
    <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap; align-items: center;">
      <label style="font-size: 0.85rem; color: var(--color-text-secondary);">数量</label>
      <input type="number" id="dmgQty" value="1" min="1" style="max-width: 60px;">
      <label style="font-size: 0.85rem; color: var(--color-text-secondary);">单位</label>
      <input type="text" id="dmgUnit" style="max-width: 60px;">
      <label style="font-size: 0.85rem; color: var(--color-text-secondary);">原因</label>
      <input type="text" id="dmgReason" list="dmgReasonDL" style="max-width: 120px;">
      <datalist id="dmgReasonDL">
        <option value="过期"></option>
        <option value="破损"></option>
        <option value="变质"></option>
        <option value="自用"></option>
        <option value="其他"></option>
      </datalist>
    </div>
  `;

  // 照片
  html += `
    <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem; align-items: center;">
      <label style="font-size: 0.85rem; color: var(--color-text-secondary);">照片</label>
      <input type="file" id="dmgPhoto" accept="image/*" onchange="handleDmgPhoto(event)">
    </div>
  `;

  // 添加按钮
  html += `
    <div style="margin-bottom: 1.5rem;">
      <button class="btn-primary" onclick="doAddDmg()">添加</button>
    </div>
  `;

  // 报损记录列表
  html += '<h3 style="margin-bottom: 0.75rem; font-size: 0.9rem; font-weight: 600;">报损记录</h3>';

  if (records.length === 0) {
    html += '<div style="text-align: center; padding: 1.5rem; color: var(--color-text-muted);">暂无</div>';
  } else {
    html += '<div class="data-table"><table>';
    html += `
      <thead>
        <tr>
          <th>日期</th>
          <th>物品</th>
          <th>数量</th>
          <th>原因</th>
          <th>照片</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
    `;

    records.forEach((record) => {
      html += `
        <tr>
          <td>${record.date}</td>
          <td>${record.itemName}</td>
          <td>${record.qty}${record.unit}</td>
          <td>${record.reason || '-'}</td>
          <td>
            ${record.photoFile ? `<img src="${record.photoFile}" style="max-width: 40px; max-height: 28px; border-radius: 4px; cursor: pointer;" onclick="toggleDmgPhoto('${record.id}')">` : '-'}
          </td>
          <td>
            <button class="btn-secondary btn-sm" onclick="delDmg('${record.id}')">删除</button>
          </td>
        </tr>
      `;

      // 照片预览（默认隐藏）
      if (record.photoFile) {
        html += `
          <tr id="dmgPhoto_${record.id}" style="display: none;">
            <td colspan="6" style="text-align: center; padding: 0.5rem;">
              <img src="${record.photoFile}" style="max-width: 100%; max-height: 250px; border-radius: 8px; cursor: pointer;" onclick="toggleDmgPhoto('${record.id}')">
            </td>
          </tr>
        `;
      }
    });

    html += '</tbody></table></div>';
  }

  container.innerHTML = html;

  // 绑定日期选择器
  initDatePicker();
}

/**
 * 初始化日期选择器
 */
function initDatePicker(): void {
  const dmgDate = document.getElementById('dmgDate');
  if (dmgDate) {
    dmgDate.addEventListener('click', () => {
      // @ts-ignore - 旧系统全局函数
      if (typeof window._dpOpen === 'function') {
        // @ts-ignore
        window._dpOpen('dmgDate');
      }
    });
  }
}

// ===== 全局函数绑定 =====

export function initDamageGlobals(): void {
  // 照片处理
  (window as any).handleDmgPhoto = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      photoData = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // 添加报损
  (window as any).doAddDmg = () => {
    const nameInput = document.getElementById('dmgName') as HTMLInputElement;
    const qtyInput = document.getElementById('dmgQty') as HTMLInputElement;
    const unitInput = document.getElementById('dmgUnit') as HTMLInputElement;
    const reasonInput = document.getElementById('dmgReason') as HTMLInputElement;
    const dateInput = document.getElementById('dmgDate') as HTMLInputElement;

    const itemName = nameInput?.value.trim();
    if (!itemName) {
      showToast('请填写物品名称');
      return;
    }

    const qty = parseInt(qtyInput?.value) || 0;
    if (qty <= 0) {
      showToast('请填写数量');
      return;
    }

    createDamageRecord({
      date: dateInput?.value || getToday(),
      itemName,
      qty,
      unit: unitInput?.value.trim() || '',
      reason: reasonInput?.value.trim() || '',
      photoFile: photoData || '',
    });

    photoData = null;
    showToast(`已记录 ${itemName} ${qty}`);

    // 重新渲染
    const container = document.getElementById('mainContent');
    if (container) renderDamage(container);
  };

  // 删除报损
  (window as any).delDmg = (id: string) => {
    if (!confirm('确定删除？')) return;
    deleteDamageRecord(id);
    showToast('已删除');

    // 重新渲染
    const container = document.getElementById('mainContent');
    if (container) renderDamage(container);
  };

  // 切换照片预览
  (window as any).toggleDmgPhoto = (id: string) => {
    const el = document.getElementById(`dmgPhoto_${id}`);
    if (el) {
      el.style.display = el.style.display === 'none' ? '' : 'none';
    }
  };
}

// ===== 辅助函数 =====

function getToday(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function showToast(msg: string): void {
  // @ts-ignore - 旧系统全局函数
  if (typeof window.toast === 'function') {
    // @ts-ignore
    window.toast(msg);
  } else {
    alert(msg);
  }
}

export default {
  renderDamage,
  initDamageGlobals,
};
