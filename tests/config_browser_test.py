from playwright.sync_api import sync_playwright


BASE_URL = "http://127.0.0.1:5173"


def wait_for_app(page):
    page.wait_for_function(
        "() => window.axConfigStore && typeof window.getAppConfig === 'function' "
        "&& typeof window.initDB === 'function'",
        timeout=60000,
    )


def assert_legacy_config_visible(page):
    config = page.evaluate("() => getAppConfig()")
    assert config["dailyLabels"] == ["实收", "厨房"], config
    assert config["purchaseSources"] == ["外购"], config
    assert config["purchaseSections"] == ["厨房", "吧台"], config
    assert config["purchaseCategories"] == {
        "厨房": ["调料"],
        "吧台": ["饮品"],
    }, config
    assert config["expenseCategories"] == ["水费"], config
    assert config["warehouseCategories"] == ["包装"], config

    page.evaluate("() => { goPage('settings'); showPurchaseSectionConfig(); }")
    modal_text = page.locator("#modal").inner_text()
    assert "厨房" in modal_text, modal_text
    assert "调料" in modal_text, modal_text
    assert "吧台" in modal_text, modal_text
    assert "饮品" in modal_text, modal_text


with sync_playwright() as p:
    browser = p.chromium.launch(headless=True)
    page = browser.new_page()
    page_errors = []
    page.on("pageerror", lambda error: page_errors.append(str(error)))

    page.goto(f"{BASE_URL}/?guest=1", wait_until="domcontentloaded", timeout=60000)
    wait_for_app(page)
    page.evaluate(
        """() => {
            const db = initDB();
            db.purchases = [{
                date: '2026-09-24',
                source: '外购',
                items: [{ section: '吧台', category: '饮品' }]
            }];
            db.expenses = [{ date: '2026-09-24', category: '水费' }];
            db.areaCats = { 厨房: ['调料'] };
            db.whCats = ['包装'];
            localStorage.setItem('ax_cafe_v8', JSON.stringify(db));
            localStorage.setItem('ax_app_config', JSON.stringify({
                onboardingCompleted: true,
                dailyLabels: []
            }));
            localStorage.setItem('ax_fl', JSON.stringify(['实收', '厨房']));
        }"""
    )
    page.reload(wait_until="domcontentloaded", timeout=60000)
    wait_for_app(page)
    assert_legacy_config_visible(page)

    page.evaluate(
        """() => {
            localStorage.setItem(
                'sb-browser-auth-token',
                JSON.stringify({ user: { id: 'browser-user' } })
            );
            localStorage.removeItem('ax_app_config_browser-user');
            const db = initDB();
            db.settings['ax_app_config_browser-user'] = {
                schemaVersion: 2,
                updatedAt: Date.now(),
                enabledModules: [],
                dailyLabels: ['云端标签'],
                roomTypes: ['普通包厢'],
                purchaseSources: ['云端来源'],
                purchaseSections: ['仓库'],
                purchaseCategories: { 仓库: ['耗材'] },
                expenseCategories: ['云端费用'],
                warehouseCategories: ['云端仓库'],
                inventoryTypes: [],
                customInventoryTypes: [],
                dailyFeatures: { roomEnabled: false, reporterEnabled: false },
                onboardingCompleted: true
            };
            localStorage.setItem('ax_cafe_v8', JSON.stringify(db));
        }"""
    )
    page.reload(wait_until="domcontentloaded", timeout=60000)
    wait_for_app(page)
    cloud_config = page.evaluate("() => getAppConfig()")
    assert cloud_config["purchaseSources"] == ["云端来源"], cloud_config
    assert cloud_config["purchaseCategories"] == {"仓库": ["耗材"]}, cloud_config
    assert cloud_config["expenseCategories"] == ["云端费用"], cloud_config

    assets = page.evaluate(
        """() => Array.from(document.querySelectorAll(
            'script, link'
        )).map((node) => node.getAttribute('src') || node.getAttribute('href'))
            .filter((url) => url && (url.includes('src/js/') || url.includes('src/css/')))"""
    )
    assert assets, assets
    for asset_url in assets:
        assert "?v=" in asset_url, asset_url
        version = asset_url.split("?v=", 1)[1]
        assert len(version) == 12 and all(c in "0123456789abcdef" for c in version), asset_url

    assert not page_errors, page_errors
    browser.close()

print("Config browser behavior passed.")
