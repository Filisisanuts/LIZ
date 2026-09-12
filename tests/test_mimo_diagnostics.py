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


def test_mimo_image_prepare_completes_once_after_image_cleanup():
    """真实浏览器图片解码后，清理图片不能触发第二次完成回调。"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:8080/index.html?guest=1")
        page.wait_for_load_state("networkidle")

        result = page.evaluate(
            """async () => {
                localStorage.removeItem('ax_mimo_diag');
                window._mimoRunId = 'single-completion-test';
                const canvas = document.createElement('canvas');
                canvas.width = 20;
                canvas.height = 20;
                const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg'));
                const file = new File([blob], 'test.jpg', { type: 'image/jpeg' });
                let callbacks = 0;
                let errorMessage = null;
                let base64Length = 0;
                await new Promise(resolve => {
                    prepareMimoImage(file, (error, base64) => {
                        callbacks += 1;
                        errorMessage = error && error.message;
                        base64Length = base64 ? base64.length : 0;
                        setTimeout(resolve, 100);
                    });
                });
                return { callbacks, errorMessage, base64Length };
            }"""
        )

        assert result["callbacks"] == 1
        assert result["errorMessage"] is None
        assert result["base64Length"] > 0
        browser.close()


if __name__ == "__main__":
    test_mimo_diagnostics_are_persisted_and_visible()
    test_mimo_image_prepare_completes_once_after_image_cleanup()
