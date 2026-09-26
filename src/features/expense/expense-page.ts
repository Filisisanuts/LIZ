/**
 * Expense Page - 费用页面组件
 *
 * 提供费用录入表单和费用明细列表。
 */

import { formatCurrency } from '@/shared/format/currency';
import {
  getExpenses,
  getExpenseCategories,
  createExpense,
  deleteExpense,
  type Expense,
} from './expense-service';

// ===== 状态 =====

let photoData: string | null = null;

// ===== 组件函数 =====

/**
 * 渲染 Expense 页面
 */
export function renderExpense(container: HTMLElement): void {
  const expenses = getExpenses().sort((a, b) => b.date.localeCompare(a.date));
  const categories = getExpenseCategories();
  const today = getToday();

  let html = '';

  // 标签栏
  html += `
    <div class="view-tabs" id="expTabs" role="tablist" aria-label="费用视图">
      <button type="button" class="view-tab active" role="tab" aria-selected="true" onclick="switchExpTab('input')">录入</button>
      <button type="button" class="view-tab" role="tab" aria-selected="false" onclick="switchExpTab('detail')">明细</button>
    </div>
  `;

  // 录入页
  html += '<div id="expInput">';
  html += '<h3 style="margin-bottom: 0.75rem; font-size: 0.9rem; font-weight: 600;">录入费用</h3>';

  // 日期、分类、金额
  html += `
    <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem; flex-wrap: wrap; align-items: center;">
      <label style="font-size: 0.85rem; color: var(--color-text-secondary);">日期</label>
      <input type="text" id="expDate" value="${today}" readonly style="max-width: 150px; cursor: pointer;">
      <label style="font-size: 0.85rem; color: var(--color-text-secondary);">分类</label>
      <select id="expCatSel" style="max-width: 120px;" onchange="toggleCustomInput(this,'expCatC')">
        <option value="">请选择</option>
        ${categories.map((c) => `<option>${c}</option>`).join('')}
        <option value="__custom">自定义</option>
      </select>
      <input type="text" id="expCatC" style="display: none; max-width: 120px;" placeholder="输入分类">
      <label style="font-size: 0.85rem; color: var(--color-text-secondary);">金额</label>
      <input type="number" id="expAmt" step="0.01" style="max-width: 100px;">
      <span style="font-size: 0.85rem; color: var(--color-text-secondary);">元</span>
    </div>
  `;

  // 备注
  html += `
    <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem; align-items: center;">
      <label style="font-size: 0.85rem; color: var(--color-text-secondary);">备注</label>
      <input type="text" id="expNote" style="flex: 1;">
    </div>
  `;

  // 凭证
  html += `
    <div style="display: flex; gap: 0.5rem; margin-bottom: 0.75rem; align-items: center;">
      <label style="font-size: 0.85rem; color: var(--color-text-secondary);">凭证</label>
      <input type="file" id="expPhoto" accept="image/*" onchange="handleExpPhoto(event)">
    </div>
  `;

  // 添加按钮
  html += `
    <div style="margin-bottom: 1.5rem;">
      <button class="btn-primary" onclick="addExp()">添加</button>
    </div>
  `;

  html += '</div>';

  // 明细页
  html += '<div id="expDetail" style="display: none;">';
  html += '<h3 style="margin-bottom: 0.75rem; font-size: 0.9rem; font-weight: 600;">费用明细</h3>';

  if (expenses.length === 0) {
    html += '<div style="text-align: center; padding: 1.5rem; color: var(--color-text-muted);">暂无</div>';
  } else {
    html += '<div class="data-table"><table>';
    html += `
      <thead>
        <tr>
          <th>日期</th>
          <th>分类</th>
          <th style="text-align: right;">金额</th>
          <th>备注</th>
          <th>操作</th>
        </tr>
      </thead>
      <tbody>
    `;

    expenses.forEach((expense) => {
      html += `
        <tr>
          <td>${expense.date}</td>
          <td>${expense.category}</td>
          <td style="text-align: right; font-family: var(--font-mono);">${formatCurrency(expense.amount)}</td>
          <td>${expense.note || '-'}</td>
          <td>
            <button class="btn-secondary btn-sm" onclick="editExp('${expense.id}')">编</button>
            <button class="btn-secondary btn-sm btn-danger" onclick="delExp('${expense.id}')">×</button>
          </td>
        </tr>
      `;
    });

    html += '</tbody></table></div>';
  }

  html += '</div>';

  container.innerHTML = html;

  // 绑定日期选择器
  initDatePickers();
}

/**
 * 初始化日期选择器
 */
function initDatePickers(): void {
  const expDate = document.getElementById('expDate');
  if (expDate) {
    expDate.addEventListener('click', () => {
      // @ts-ignore - 旧系统全局函数
      if (typeof window._dpOpen === 'function') {
        // @ts-ignore
        window._dpOpen('expDate');
      }
    });
  }
}

// ===== 全局函数绑定 =====

export function initExpenseGlobals(): void {
  // 切换标签
  (window as any).switchExpTab = (tab: string) => {
    const inputEl = document.getElementById('expInput');
    const detailEl = document.getElementById('expDetail');
    const tabs = document.querySelectorAll('#expTabs .view-tab');

    tabs.forEach((t) => t.classList.remove('active'));

    if (tab === 'input') {
      inputEl?.style.removeProperty('display');
      detailEl && (detailEl.style.display = 'none');
      tabs[0]?.classList.add('active');
    } else {
      inputEl && (inputEl.style.display = 'none');
      detailEl?.style.removeProperty('display');
      tabs[1]?.classList.add('active');
    }
  };

  // 切换自定义输入
  (window as any).toggleCustomInput = (select: HTMLSelectElement, inputId: string) => {
    const input = document.getElementById(inputId) as HTMLInputElement;
    if (input) {
      input.style.display = select.value === '__custom' ? '' : 'none';
    }
  };

  // 照片处理
  (window as any).handleExpPhoto = (event: Event) => {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      photoData = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  // 添加费用
  (window as any).addExp = () => {
    const catSel = document.getElementById('expCatSel') as HTMLSelectElement;
    const catInput = document.getElementById('expCatC') as HTMLInputElement;
    const amtInput = document.getElementById('expAmt') as HTMLInputElement;
    const dateInput = document.getElementById('expDate') as HTMLInputElement;
    const noteInput = document.getElementById('expNote') as HTMLInputElement;

    let category = catSel?.value;
    if (category === '__custom') {
      category = catInput?.value.trim();
    }

    const amount = parseFloat(amtInput?.value) || 0;

    if (!category || !amount) {
      showToast('请填写分类和金额');
      return;
    }

    createExpense({
      date: dateInput?.value || getToday(),
      category,
      amount,
      note: noteInput?.value.trim() || '',
      photoFile: photoData || '',
    });

    photoData = null;
    showToast('已添加');

    // 重新渲染
    const container = document.getElementById('mainContent');
    if (container) renderExpense(container);
  };

  // 删除费用
  (window as any).delExp = (id: string) => {
    if (!confirm('确定删除？')) return;
    deleteExpense(id);
    showToast('已删除');

    // 重新渲染
    const container = document.getElementById('mainContent');
    if (container) renderExpense(container);
  };

  // 编辑费用（复用旧系统弹窗）
  (window as any).editExp = (id: string) => {
    // @ts-ignore - 旧系统全局函数
    if (typeof window.editExp === 'function') {
      // @ts-ignore
      window.editExp(id);
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
  renderExpense,
  initExpenseGlobals,
};
