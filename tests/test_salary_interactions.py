import os

from playwright.sync_api import sync_playwright


BASE_URL = os.getenv("AX_TEST_BASE_URL", "http://localhost:8080")


def test_salary_table_keeps_drafts_and_limits_drag_to_handle():
    """工资表编辑、导入、换月、拖拽与保存不得丢失未保存状态。"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))

        page.goto(f"{BASE_URL}/index.html?guest=1")
        page.wait_for_load_state("networkidle")
        page.evaluate("goPage('salary')")

        first_row = page.locator("#salTableBody tr").first
        employee = first_row.locator("input").nth(1)
        base_salary = first_row.locator("input[type=number]").first
        page.evaluate(
            "window.__salaryEmployee = "
            "document.querySelector('#salTableBody tr').querySelectorAll('input')[1]"
        )
        employee.fill("测试员工")
        base_salary.fill("5000")

        assert page.evaluate("window.__salaryEmployee.isConnected")
        assert page.evaluate("_salaryTableData[0].employee") == "测试员工"
        assert page.evaluate("_salaryTableData[0].baseSalary") == 5000
        assert first_row.get_attribute("draggable") is None
        assert first_row.locator("button").first.get_attribute("draggable") == "true"

        page.get_by_role("button", name="+ 添加行").click()
        assert employee.input_value() == "测试员工"

        page.evaluate(
            """() => {
                const body = document.getElementById('salTableBody');
                const source = body.rows[1];
                const target = body.rows[0];
                const transfer = new DataTransfer();
                source.querySelector('button[draggable=true]').dispatchEvent(
                    new DragEvent('dragstart', { bubbles: true, dataTransfer: transfer })
                );
                target.dispatchEvent(new DragEvent('dragover', { bubbles: true, dataTransfer: transfer }));
                window.__salaryDropFeedback = {
                    marker: !!document.getElementById('salaryDropMarker'),
                    label: document.querySelector('#salaryDropMarker .salary-drop-line span')?.textContent,
                    targetClass: target.className
                };
                target.dispatchEvent(new DragEvent('drop', { bubbles: true, dataTransfer: transfer }));
            }"""
        )
        assert page.evaluate("window.__salaryDropFeedback.marker")
        assert page.evaluate("window.__salaryDropFeedback.label") == "放在这里"
        assert "salary-drop-before" in page.evaluate("window.__salaryDropFeedback.targetClass")
        assert page.locator("#salaryDropMarker").count() == 0
        assert page.locator("#salTableBody tr").first.locator("input").nth(1).input_value() == ""

        page.evaluate("parseSalaryExcelData([{姓名:'导入员工', 基本工资:8800}])")
        assert page.locator("#salTableBody tr").count() == 1
        assert page.locator("#salTableBody tr input").nth(1).input_value() == "导入员工"

        page.evaluate(
            "updateSalaryRow(_salaryTableData[0].id, 'employee', '草稿员工'); "
            "salaryCalNav(-1); salaryCalNav(1)"
        )
        assert page.locator("#salTableBody tr input").nth(1).input_value() == "草稿员工"

        page.evaluate("window.requireAuth = () => true; saveSalaryTable()")
        assert page.evaluate(
            "DB.salaryRecords.filter(r => r.period === _salaryPeriod && r.employee === '草稿员工').length"
        ) == 1
        assert not errors, errors
        browser.close()


def test_salary_detail_month_table_is_readonly_and_restores_monthly_payroll():
    """明细按录入表结构展示整月记录，查看不写入且整月回收站流程保持可用。"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))

        page.goto(f"{BASE_URL}/index.html?guest=1")
        page.wait_for_load_state("networkidle")
        page.evaluate(
            """() => {
                window.requireAuth = () => true;
                const config = getAppConfig();
                config.salaryFieldGroups = [
                    {id:'info',label:'信息项',order:0,span:true},
                    {id:'basePay',label:'应付基本工资项目',order:1,span:false},
                    {id:'actual',label:'实发工资',order:2,span:true}
                ];
                config.salaryFieldDefinitions = [
                    {id:'employee',key:'employee',label:'姓名',category:'info',numeric:false,visible:true,order:0,group:'info'},
                    {id:'department',key:'department',label:'部门',category:'info',numeric:false,visible:true,order:1,group:'info'},
                    {id:'position',key:'position',label:'职务',category:'info',numeric:false,visible:true,order:2,group:'info'},
                    {id:'baseSalary',key:'baseSalary',label:'基本工资',category:'earning',numeric:true,visible:true,order:3,group:'basePay'},
                    {id:'performance',key:'performance',label:'绩效',category:'earning',numeric:true,visible:true,order:4,group:'basePay'},
                    {id:'actualSalary',key:'actualSalary',label:'实发工资',category:'computed',numeric:true,visible:true,order:5,group:'actual'}
                ];
                storeAppConfig(config);
                DB.salaryRecords = [
                    {id:'salary-aug-a', period:'2026-08', department:'前厅', employee:'小艾', position:'助理', baseSalary:4000, performance:500, socialInsurance:100, tax:0, actualSalary:4400},
                    {id:'salary-aug-b', period:'2026-08', department:'厨房', employee:'小周', position:'领班', baseSalary:5000, performance:0, socialInsurance:0, tax:0, actualSalary:5000},
                    {id:'salary-jul-a', period:'2026-07', department:'前厅', employee:'小李', position:'店长', baseSalary:6000, performance:0, socialInsurance:0, tax:0, actualSalary:6000}
                ];
                DB.salaryTrash = [];
                saveDB(DB);
                goPage('salary');
            }"""
        )
        page.get_by_role("tab", name="明细").click()
        assert page.locator(".salary-month-row").count() == 2
        assert "¥9,400.00" in page.locator(".salary-month-row").first.inner_text()

        page.locator(".salary-month-row").first.click()
        assert page.get_by_text("2026-08 工资明细").count() == 1
        assert page.locator("#salaryMonthTable .salary-month-employee-row").count() == 2
        assert page.locator("#salaryMonthTable .salary-department-row").count() == 2
        assert page.locator("#salaryMonthTable .salary-department-subtotal").count() == 2
        assert page.locator("#salaryMonthTable .salary-grand-total").count() == 1
        assert page.locator("#salaryMonthTable .salary-group-header", has_text="应付基本工资项目").count() == 1
        assert page.locator("#salaryMonthTable .salary-name-column", has_text="小艾").count() == 1
        assert page.locator("#salaryMonthTable input, #salaryMonthTable button, #salaryMonthTable select, #salaryMonthTable textarea").count() == 0
        assert "9,400.00" in page.locator("#salaryMonthTable .salary-grand-total").inner_text()
        assert page.locator(".salary-person-row").count() == 0
        before = page.evaluate("JSON.stringify(DB.salaryRecords)")
        for width in (375, 390, 1440):
            page.set_viewport_size({"width": width, "height": 800})
            metrics = page.evaluate("""() => {
                const wrap = document.querySelector('.salary-month-table-wrap');
                const name = document.querySelector('#salaryMonthTable tbody .salary-name-column');
                return {
                    bodyOverflow: document.documentElement.scrollWidth > window.innerWidth,
                    tableScrolls: wrap.scrollWidth > wrap.clientWidth,
                    stickyName: getComputedStyle(name).position === 'sticky' && getComputedStyle(name).left === '0px',
                    stickyHeader: getComputedStyle(document.querySelector('#salaryMonthTable thead th')).position === 'sticky'
                };
            }""")
            assert not metrics["bodyOverflow"], (width, metrics)
            if width <= 768:
                assert metrics["tableScrolls"], (width, metrics)
            assert metrics["stickyName"], (width, metrics)
            assert metrics["stickyHeader"], (width, metrics)
        assert page.evaluate("JSON.stringify(DB.salaryRecords)") == before
        page.get_by_role("button", name="在录入中编辑").click()
        assert page.get_by_role("tab", name="录入").get_attribute("aria-selected") == "true"
        assert page.locator("#salTableBody input").count() > 0
        page.evaluate("switchSalaryView('detail'); openSalaryMonthDetail('2026-08')")

        page.once("dialog", lambda dialog: dialog.accept())
        page.get_by_role("button", name="删除本月").click()
        assert page.evaluate("DB.salaryRecords.filter(r => r.period === '2026-08').length") == 0
        assert page.evaluate("DB.salaryTrash.length") == 1
        trash_id = page.evaluate("DB.salaryTrash[0].id")

        page.evaluate(f"restoreSalaryTrash('{trash_id}')")
        assert page.evaluate("DB.salaryRecords.filter(r => r.period === '2026-08').length") == 2
        assert page.evaluate("DB.salaryRecords.find(r => r.id === 'salary-aug-a').actualSalary") == 4400
        assert page.evaluate("DB.salaryTrash.length") == 0
        assert not errors, errors
        browser.close()


def test_salary_month_move_handles_empty_merge_and_replace_targets():
    """整月改月份不得静默覆盖：无冲突迁移、合并与覆盖均有确定结果。"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        errors = []
        page.on("pageerror", lambda error: errors.append(str(error)))

        page.goto(f"{BASE_URL}/index.html?guest=1")
        page.wait_for_load_state("networkidle")
        page.evaluate(
            """() => {
                window.requireAuth = () => true;
                DB.salaryRecords = [
                    {id:'move-source', period:'2026-09', employee:'九月员工', baseSalary:5000, actualSalary:5000},
                    {id:'merge-target', period:'2026-08', employee:'八月员工', baseSalary:4000, actualSalary:4000},
                    {id:'replace-target', period:'2026-07', employee:'七月员工', baseSalary:3000, actualSalary:3000}
                ];
                DB.salaryTrash = [];
                saveDB(DB);
                goPage('salary');
                switchSalaryView('detail');
                openSalaryMonthDetail('2026-09');
            }"""
        )

        page.get_by_role("button", name="修改月份").click()
        assert page.locator("#salaryMoveTarget").get_attribute("type") == "text"
        assert page.locator("#salaryMoveTarget").get_attribute("readonly") == ""
        page.locator("#salaryMoveTarget").click()
        page.locator("#datePicker .dp-month", has_text="十月").click()
        assert page.locator("#salaryMoveTarget").input_value() == "2026-10"
        page.get_by_role("button", name="继续").click()
        page.get_by_role("button", name="确认迁移").click()
        assert page.evaluate("DB.salaryRecords.filter(r => r.period === '2026-09').length") == 0
        assert page.evaluate("DB.salaryRecords.filter(r => r.period === '2026-10').length") == 1

        page.evaluate("openSalaryMonthMove('2026-10')")
        page.locator("#salaryMoveTarget").click()
        page.locator("#datePicker .dp-month", has_text="八月").click()
        page.get_by_role("button", name="继续").click()
        page.get_by_role("button", name="合并到 2026-08").click()
        assert page.evaluate("DB.salaryRecords.filter(r => r.period === '2026-08').length") == 2
        assert page.evaluate("DB.salaryTrash.length") == 0

        page.evaluate("openSalaryMonthMove('2026-08')")
        page.locator("#salaryMoveTarget").click()
        page.locator("#datePicker .dp-month", has_text="七月").click()
        page.get_by_role("button", name="继续").click()
        page.get_by_role("button", name="覆盖 2026-07").click()
        assert page.evaluate("DB.salaryRecords.filter(r => r.period === '2026-08').length") == 0
        assert page.evaluate("DB.salaryRecords.filter(r => r.period === '2026-07').length") == 2
        assert page.evaluate("DB.salaryTrash.length") == 1
        assert page.evaluate("DB.salaryTrash[0].period") == "2026-07"
        assert not errors, errors
        browser.close()


if __name__ == "__main__":
    test_salary_table_keeps_drafts_and_limits_drag_to_handle()
    test_salary_detail_tab_edits_and_restores_monthly_payroll()
    test_salary_month_move_handles_empty_merge_and_replace_targets()
