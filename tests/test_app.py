from playwright.sync_api import sync_playwright

def test_ax_coffee():
    """测试 ax-coffee 应用的基本功能"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()

        # 测试主页面
        page.goto('http://localhost:8080')
        page.wait_for_load_state('networkidle')
        page.screenshot(path='test_screenshot.png', full_page=True)

        # 检查关键元素是否存在
        assert page.locator('body').is_visible(), "页面加载失败"

        # 检查是否有导航栏或主要容器
        has_content = page.locator('body').inner_text()
        assert len(has_content) > 0, "页面内容为空"

        print("✓ 基本页面测试通过")

        browser.close()

if __name__ == '__main__':
    test_ax_coffee()
