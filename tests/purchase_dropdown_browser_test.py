"""Run against the local Vite server: python tests/purchase_dropdown_browser_test.py."""

from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:5173/?guest=1"


with sync_playwright() as playwright:
    browser = playwright.chromium.launch(headless=True)
    page = browser.new_page(viewport={"width": 900, "height": 760})
    errors = []
    page.on("pageerror", lambda error: errors.append(str(error)))
    page.goto(BASE_URL, wait_until="networkidle", timeout=60000)
    page.wait_for_function("() => typeof manageCats === 'function' && typeof goPage === 'function'")
    page.evaluate(
        """() => {
            const config = {
                schemaVersion: 2,
                updatedAt: Date.now(),
                onboardingCompleted: true,
                purchaseSources: ['外购'],
                purchaseSections: ['厨房', '外场'],
                purchaseCategories: { 厨房: ['干调'], 外场: ['香烟类'] }
            };
            localStorage.setItem('ax_app_config', JSON.stringify(config));
            const db = initDB();
            db.areaCats = { 厨房: ['干调'], 外场: ['香烟类'] };
            localStorage.setItem('ax_cafe_v8', JSON.stringify(db));
        }"""
    )
    page.reload(wait_until="networkidle", timeout=60000)
    page.wait_for_function("() => typeof goPage === 'function' && getAppConfig().purchaseSections.length === 2")
    page.evaluate("() => goPage('purchase')")
    page.locator("#pMan button", has_text="管理").click()

    native = page.locator("#macArea")
    assert native.get_attribute("data-ax-ready") == "true"
    wrapper = page.locator("#modal .ax-select:has(#macArea)")
    assert wrapper.count() == 1
    wrapper.locator(".ax-select-trigger").click()
    wrapper.get_by_role("option", name="外场").click()
    assert native.input_value() == "外场"
    assert "香烟类" in page.locator("#macList").inner_text()
    assert "干调" not in page.locator("#macList").inner_text()

    page.set_viewport_size({"width": 390, "height": 844})
    wrapper.locator(".ax-select-trigger").click()
    wrapper.get_by_role("option", name="厨房").click()
    assert native.input_value() == "厨房"
    assert "干调" in page.locator("#macList").inner_text()
    assert not errors, errors
    browser.close()

print("Purchase manager dropdown browser behavior passed.")
