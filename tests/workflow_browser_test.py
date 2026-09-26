from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:5173"


def wait_for_app(page):
    page.wait_for_function(
        "() => window.axUI && window.axConfigStore && window.initDB "
        "&& typeof window.goPage === 'function'",
        timeout=60000,
    )


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 1440, "height": 1000})
    page_errors = []
    page.on("pageerror", lambda error: page_errors.append(error.stack or str(error)))

    page.goto(f"{BASE_URL}/index.html?guest=1&workflow-test=1", wait_until="domcontentloaded")
    wait_for_app(page)
    page.evaluate(
        """() => {
            const db = initDB();
            db.purchases = [{
                id: 'purchase-1',
                date: '2026-09-25',
                source: '岸香贸易',
                recordType: 'purchase',
                items: [{
                    id: 'item-1',
                    name: '咖啡豆',
                    source: '岸香贸易',
                    section: '吧台',
                    category: '咖啡类',
                    qty: 10,
                    unit: 'kg',
                    unitPrice: 120,
                    total: 1200
                }]
            }];
            db.expenses = [{ id: 'e1', date: '2026-09-25', category: '水费', amount: 100 }];
            db.areaCats = { 吧台: ['咖啡类'] };
            localStorage.setItem('ax_cafe_v8', JSON.stringify(db));
            localStorage.setItem('ax_app_config', JSON.stringify({
                schemaVersion: 2,
                onboardingCompleted: true,
                purchaseSources: ['岸香贸易', '外购'],
                purchaseSections: ['吧台'],
                purchaseCategories: { 吧台: ['咖啡类'] },
                expenseCategories: ['水费'],
                salaryDepartments: ['未分部门', '吧台', '厨房']
            }));
            window.requireAuth = () => true;
        }"""
    )
    page.reload(wait_until="domcontentloaded")
    wait_for_app(page)
    page.evaluate("() => { window.requireAuth = () => true; }")

    # 日报：录入/明细、待确认字段、合并/覆盖
    page.evaluate("() => goPage('daily')")
    page.wait_for_function("() => document.querySelector('#dT')")
    daily_tabs = page.locator("#dT .view-tab").all_inner_texts()
    assert daily_tabs == ["录入", "明细"], daily_tabs
    assert page.locator("#dT").evaluate("el => getComputedStyle(el).borderRadius") == "999px"
    assert page.locator("#dText").is_visible()
    assert not page.locator("#dMan").is_visible()
    assert page.locator("#dailyPreview .pv-card").count() > 0
    parse_actions = page.locator("#dText > .brow").first
    assert parse_actions.evaluate("el => getComputedStyle(el).marginTop") == "12px"
    assert parse_actions.evaluate("el => getComputedStyle(el).marginBottom") == "20px"
    page.fill("#dtInput", "流水 1000\n网络收入 88")
    page.click("text=解析日报")
    page.wait_for_selector("[data-daily-pending]")
    assert "待确认字段" in page.locator("#dailyPreview").inner_text()
    assert not page.locator("#dMan").is_visible()
    section_order = page.locator("#dailyPreview .pv-card h4").all_inner_texts()
    assert section_order.index("营收") < section_order.index("茗茶销售"), section_order
    page.select_option("[data-daily-pending='0']", "revenue.other")
    page.click("#dailyPreview button:has-text('映射')")
    assert page.locator("[data-daily-pending]").count() == 0
    page.click("text=解析日报")
    assert not page.locator("#modal").is_visible()
    assert page.locator("button").filter(has_text="清空").count() == 1

    page.evaluate("() => { goPage('settings'); showDailyFieldsConfig(); }")
    page.fill("#newDailyFieldLabel", "网络收入")
    page.select_option("#newDailyFieldStatistic", "revenue", force=True)
    page.click("#modal button:has-text('新增字段')")
    field_labels = page.evaluate(
        "() => getAppConfig().dailyFieldDefinitions.map((field) => field.label)"
    )
    assert "网络收入" in field_labels, field_labels
    page.click("#modal button:has-text('关闭')")
    page.evaluate("() => goPage('daily')")
    page.wait_for_timeout(100)
    daily_diag = page.evaluate(
        """() => ({
            preview: document.querySelector('#dailyPreview').innerText,
            currentView: window._curPage,
            hasDraft: !!window._pd,
            pageErrors: [],
            fields: getAppConfig().dailyFieldDefinitions.map((field) => ({
                label: field.label, visible: field.visible, type: field.type,
                path: field.path, order: field.order
            }))
        })"""
    )
    daily_diag["pageErrors"] = page_errors
    assert "网络收入" in page.locator("#dailyPreview").inner_text(), daily_diag

    page.evaluate(
        """() => {
            resetDailyDraft();
            const saved = parseDaily('');
            saved.date = '2026-09-25';
            saved.revenue.grossSales = 500;
            DB.dailyReports.push(saved);
            saveDB(DB);
        }"""
    )
    page.fill("#dtInput", "2026-09-25\n流水 900")
    page.click("text=解析日报")
    assert not page.locator("#modal").is_visible()
    assert page.evaluate("() => _pd.revenue.grossSales") == 900
    page.evaluate(
        """() => {
            window._saveClickCount = 0;
            const originalSaveDaily = window.saveDaily;
            window.saveDaily = function(mode) {
                window._saveClickCount += 1;
                return originalSaveDaily(mode);
            };
        }"""
    )
    page.click("#dailyPreview > .brow button:has-text('保存')")
    save_diag = page.evaluate(
        """() => ({
            currentDate: _pd && _pd.date,
            dates: DB.dailyReports.map((report) => report.date),
            modalText: document.querySelector('#modal').innerText,
            modalVisible: document.querySelector('#modal').classList.contains('show'),
            saveClickCount: window._saveClickCount,
            pendingCount: (_pd.pending || []).length,
            existingFound: DB.dailyReports.some((report) => report.date === _pd.date),
            saveButtonOnclick: document.querySelector("#dailyPreview > .brow button").getAttribute('onclick'),
            saveFunction: String(window.saveDaily).slice(0, 180)
        })"""
    )
    save_diag["pageErrors"] = page_errors
    assert page.locator("#modal").get_by_text("已有日报").is_visible(), save_diag
    save_modal_actions = page.locator("#modal .brow").last
    assert save_modal_actions.evaluate("el => getComputedStyle(el).justifyContent") == "flex-end"
    assert save_modal_actions.evaluate("el => getComputedStyle(el).marginTop") == "24px"
    assert page.locator("#modal").get_by_text("合并").is_visible()
    assert page.locator("#modal").get_by_text("覆盖").is_visible()
    page.click("#modal button:has-text('覆盖')")
    assert page.evaluate(
        "() => DB.dailyReports.find((report) => report.date === '2026-09-25').revenue.grossSales"
    ) == 900

    page.evaluate(
        """() => {
            const first = parseDaily('');
            first.date = '2026-09-24';
            first.payment.cash = 300;
            const second = parseDaily('');
            second.date = '2026-09-25';
            second.payment.cash = 450;
            DB.dailyReports = [first, second];
            saveDB(DB);
        }"""
    )
    page.wait_for_timeout(100)
    page.evaluate("() => { closeModal(); switchDT('hist'); renderDHist(); }")
    assert page.locator(".payment-filter-toggle").get_by_text("结算方式筛选统计").is_visible()
    assert page.locator(".payment-filter-body").count() == 0
    assert page.evaluate(
        """() => {
            const container = document.querySelector('.payment-filter-chevron').getBoundingClientRect();
            const icon = document.querySelector('.payment-filter-chevron svg').getBoundingClientRect();
            return Math.abs((container.left + container.width / 2) - (icon.left + icon.width / 2)) < 0.5
                && Math.abs((container.top + container.height / 2) - (icon.top + icon.height / 2)) < 0.5;
        }"""
    )
    page.click(".payment-filter-toggle")
    page.wait_for_selector(".payment-filter-chip")
    last_filter_options = page.locator(".payment-filter-group.last .payment-filter-options")
    assert last_filter_options.evaluate("el => getComputedStyle(el).paddingBottom") == "16px"
    page.click(".payment-filter-chip:has-text('现金')")
    payment_summary = page.locator(".payment-filter-summary").inner_text()
    assert "现金" in payment_summary
    assert "750.00" in payment_summary
    assert "已选项目合计" in payment_summary
    assert "750.00" in page.locator(".payment-filter-summary-total").inner_text()
    page.click(".payment-filter-toggle")
    assert "已选 1 项" in page.locator(".payment-filter-toggle").inner_text()
    assert "750.00" in page.locator(".payment-filter-toggle").inner_text()

    page.evaluate(
        """() => {
            sessionStorage.setItem('ax_page_entered_daily', '1');
            rDaily();
        }"""
    )
    assert not page.locator(".page.active").evaluate("el => el.classList.contains('animate-once')")

    # 采购：独立退货、原归属继承、累计限制、关联回收站
    page.evaluate("() => goPage('purchase')")
    page.wait_for_function("() => document.querySelector('#pT')")
    purchase_tabs = page.locator("#pT .view-tab").all_inner_texts()
    assert purchase_tabs == ["录入", "退货", "明细"], purchase_tabs
    assert page.locator("#pT").evaluate("el => getComputedStyle(el).borderRadius") == "999px"
    assert page.locator("#pText").is_visible()
    assert page.locator("#pMan").is_visible()
    page.click("#pT button:has-text('退货')")
    assert page.locator("#pText").is_visible()
    page.click("#pT button:has-text('明细')")
    assert not page.locator("#pText").is_visible()
    page.evaluate("() => switchPT('entry')")
    page.wait_for_selector("#pmSec", state="attached")
    assert page.evaluate(
        "() => document.querySelector('#pT').compareDocumentPosition("
        "document.querySelector('#pText')) === Node.DOCUMENT_POSITION_FOLLOWING"
    )
    source_options = page.locator("#pmSrc option").all_inner_texts()
    assert "退货" not in source_options, source_options
    for select_id in ["#pmSrc", "#pmSec", "#pmCat"]:
        assert page.locator(select_id).evaluate(
            "el => getComputedStyle(el).display === 'none'"
        )
        assert page.locator(select_id).locator("xpath=..").locator(
            ".ax-select-trigger"
        ).is_visible()
    name_width_before = page.locator("#pmName").evaluate("el => el.getBoundingClientRect().width")
    page.fill("#pmName", "这是一条很长的采购品名称")
    name_width_after = page.locator("#pmName").evaluate("el => el.getBoundingClientRect().width")
    assert name_width_after > name_width_before
    assert name_width_after <= 320

    unit_width_before = page.locator("#pmUnit").evaluate("el => el.getBoundingClientRect().width")
    page.fill("#pmUnit", "超长单位")
    unit_width_after = page.locator("#pmUnit").evaluate("el => el.getBoundingClientRect().width")
    assert unit_width_after > unit_width_before
    assert unit_width_after <= 120
    page.evaluate(
        """() => {
            window._selectedRelPur = {
                purchaseId: 'purchase-1',
                itemId: 'item-1',
                date: '2026-09-25',
                name: '咖啡豆',
                qty: 10,
                unit: 'kg',
                unitPrice: 120,
                total: 1200,
                source: '岸香贸易',
                section: '吧台',
                category: '咖啡类'
            };
            switchPT('return');
            document.querySelector('#prQty').value = '2';
            document.querySelector('#prTotal').value = '240';
            savePurchaseReturn();
        }"""
    )
    return_record = page.evaluate(
        "() => DB.purchases.find((record) => record.recordType === 'return')"
    )
    if not return_record:
        raise AssertionError({
            "pageErrors": page_errors,
            "returnDraft": page.evaluate("() => window._selectedRelPur"),
            "purchaseCount": page.evaluate("() => DB.purchases.length")
        })
    assert return_record["source"] == "岸香贸易", return_record
    assert return_record["originalPurchaseId"] == "purchase-1", return_record
    assert return_record["items"][0]["section"] == "吧台", return_record
    assert return_record["items"][0]["category"] == "咖啡类", return_record
    assert return_record["items"][0]["qty"] == -2, return_record

    over_limit = page.evaluate(
        """() => {
            window._selectedRelPur = {
                purchaseId: 'purchase-1', itemId: 'item-1', date: '2026-09-25',
                name: '咖啡豆', qty: 10, unit: 'kg', unitPrice: 120,
                total: 1200, source: '岸香贸易', section: '吧台', category: '咖啡类'
            };
            switchPT('return');
            document.querySelector('#prQty').value = '20';
            document.querySelector('#prTotal').value = '2400';
            const before = DB.purchases.length;
            savePurchaseReturn();
            return before === DB.purchases.length;
        }"""
    )
    assert over_limit is True

    page.evaluate(
        """() => {
            upd((db) => {
                deletePurchaseItemWithReturns(db, 'purchase-1', 'item-1');
            });
        }"""
    )
    trash_state = page.evaluate(
        """() => ({
            trash: DB.purchaseTrash.length,
            returns: DB.purchases.filter((record) => record.recordType === 'return').length,
            originals: DB.purchases.filter((record) => record.recordType === 'purchase').length
        })"""
    )
    assert trash_state == {"trash": 1, "returns": 0, "originals": 0}, trash_state

    # 工资：部门分组、小计、模板菜单和云端配置
    page.evaluate(
        """() => {
            goPage('salary');
            _salaryTableData = [
                Object.assign(createSalaryEmptyRow(), {
                    employeeId: 'emp-1', department: '吧台', employee: '小林',
                    position: '吧台主管', baseSalary: 5800, commission: 1200
                }),
                Object.assign(createSalaryEmptyRow(), {
                    employeeId: 'emp-2', department: '厨房', employee: '阿杰',
                    position: '厨师长', baseSalary: 7200, commission: 1600
                })
            ];
            renderSalaryPage();
            openSalaryTemplateSaveDialog();
        }"""
    )
    page.wait_for_selector("#salaryTemplateName")
    page.fill("#salaryTemplateName", "基础人员模板")
    page.check("#salaryTemplateDefault")
    page.click("text=保存模板")
    template_state = page.evaluate(
        """() => ({
            templates: getAppConfig().salaryTemplates.length,
            defaultId: getAppConfig().defaultSalaryTemplateId,
            backup: !!localStorage.getItem(getConfigKey() + '_salaryTemplate_backup'),
            subtotals: document.querySelectorAll('.salary-department-subtotal').length,
            toolbar: document.body.innerText
        })"""
    )
    assert template_state["templates"] == 1, template_state
    assert template_state["defaultId"], template_state
    assert template_state["backup"] is True, template_state
    assert template_state["subtotals"] == 2, template_state
    assert "导入Excel" not in template_state["toolbar"], template_state
    assert "保存模板" not in template_state["toolbar"], template_state

    page.evaluate("() => goPage('report')")
    assert "view-tabs" in page.locator("#repNav").get_attribute("class")
    assert page.locator("#repNav .view-tab").count() > 0

    # 通用下拉框：超过10项启用搜索，多选和自定义能力可见
    page.evaluate(
        """() => {
            const simple = document.createElement('select');
            simple.id = 'workflowSimpleSelect';
            simple.innerHTML = '<option>选项一</option><option>选项二</option>';
            document.body.appendChild(simple);
            const select = document.createElement('select');
            select.id = 'workflowSelect';
            select.multiple = true;
            select.setAttribute('data-allow-custom', 'true');
            select.innerHTML = Array.from({ length: 12 }, (_, index) =>
                '<option>选项' + (index + 1) + '</option>'
            ).join('') + '<option value="__custom">自定义</option>';
            document.body.appendChild(select);
            window.axUI.initSelects(document);
            select.parentElement.querySelector('.ax-select-trigger').click();
        }"""
    )
    select_wrapper = page.locator("#workflowSelect").locator("xpath=..")
    assert select_wrapper.locator(".ax-select-search").is_visible()
    assert select_wrapper.locator(".ax-select-create").is_visible()
    assert select_wrapper.locator(".ax-select-chevron svg").evaluate(
        "el => el.getBoundingClientRect().width === 14"
    )
    assert page.locator("#workflowSimpleSelect").evaluate(
        "el => getComputedStyle(el).backgroundImage.includes('svg+xml')"
    )
    assert select_wrapper.locator(".ax-select-menu > *").last.locator(
        ".ax-select-create"
    ).is_visible()
    assert select_wrapper.locator(".ax-select-custom").evaluate(
        "el => getComputedStyle(el).borderTopWidth === '1px'"
    )
    assert select_wrapper.locator(".ax-select-custom").evaluate(
        "el => getComputedStyle(el).paddingTop === '2px'"
    )
    assert select_wrapper.evaluate(
        """el => {
            const option = el.querySelector('.ax-select-option').getBoundingClientRect();
            const create = el.querySelector('.ax-select-create').getBoundingClientRect();
            return Math.abs(option.left - create.left) < 0.5
                && Math.abs(option.height - create.height) < 0.5;
        }"""
    )
    assert page.locator("#workflowSelect").evaluate(
        "el => getComputedStyle(el).display === 'none' && getComputedStyle(el).opacity === '0'"
    )
    page.keyboard.press("Escape")

    viewport_meta = page.locator("meta[name='viewport']").get_attribute("content")
    assert "user-scalable=no" not in viewport_meta
    assert "maximum-scale=1" not in viewport_meta
    assert not page_errors, page_errors

    browser.close()

print("Workflow browser tests passed.")
