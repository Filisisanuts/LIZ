from playwright.sync_api import sync_playwright


def test_mimo_diagnostics_are_persisted_and_visible():
    """诊断记录应脱敏持久化，并可从采购页打开查看。"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:8080/index.html?guest=1")
        page.wait_for_load_state("networkidle")

        page.evaluate(
            """() => {
                localStorage.removeItem('ax_mimo_diag');
                window._mimoRunId = 'test-run';
                mimoDiag('response_received', {
                    responseBytes: 42,
                    contentLength: 0,
                    endpoint: mimoEndpointSummary('https://example.invalid/v1/chat?token=should-not-appear')
                });
                goPage('purchase');
                showMimoDiagnostics();
            }"""
        )

        report = page.locator("#mimoDiagReport").input_value()
        assert "response_received" in report
        assert "https://example.invalid" in report
        assert "should-not-appear" not in report
        assert page.get_by_role("button", name="复制诊断").is_visible()
        assert page.get_by_role("button", name="关闭").is_visible()
        browser.close()


if __name__ == "__main__":
    test_mimo_diagnostics_are_persisted_and_visible()
