from playwright.sync_api import sync_playwright


def test_local_entry_pages_load_without_missing_assets():
    """三个入口页面不得继续引用迁移前的 js/ 或 css/ 静态资源。"""
    pages = ("/index.html", "/login.html", "/dashboard.html")

    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        missing_assets = []
        page_errors = []

        def track_response(response):
            if response.url.startswith("http://localhost:8080/") and response.status >= 400:
                missing_assets.append(f"{response.status} {response.url}")

        page.on("response", track_response)
        page.on("pageerror", lambda error: page_errors.append(str(error)))

        for path in pages:
            page.goto(f"http://localhost:8080{path}")
            page.wait_for_load_state("networkidle")

        browser.close()

    assert not missing_assets, "本地资源加载失败：\n" + "\n".join(missing_assets)
    assert not page_errors, "页面脚本异常：\n" + "\n".join(page_errors)


if __name__ == "__main__":
    test_local_entry_pages_load_without_missing_assets()
