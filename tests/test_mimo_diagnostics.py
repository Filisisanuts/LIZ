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


def test_mimo_preparing_state_is_not_reported_as_recognition_complete():
    """图片预处理仅显示处理中，确认识别前不可显示识别完成。"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:8080/index.html?guest=1")
        page.wait_for_load_state("networkidle")

        page.evaluate("showAILoading('preparing')")
        overlay_text = page.locator("#aiLoadingOverlay").inner_text()
        assert "正在处理图片" in overlay_text
        assert "识别完成" not in overlay_text

        page.evaluate("hideAILoading(null)")
        assert page.locator("#aiLoadingOverlay").count() == 0
        browser.close()


def test_successful_http_with_empty_ai_content_is_reported_as_failure():
    """HTTP 200 不能替代识别成功；空内容必须显示识别失败。"""
    with sync_playwright() as p:
        browser = p.chromium.launch(headless=True)
        page = browser.new_page()
        page.goto("http://localhost:8080/index.html?guest=1")
        page.wait_for_load_state("networkidle")

        page.evaluate(
            """() => {
                class EmptyContentXHR {
                    open() {}
                    setRequestHeader() {}
                    send() {
                        this.status = 200;
                        this.responseText = JSON.stringify({
                            choices: [{ message: { content: '' }, finish_reason: 'length' }]
                        });
                        setTimeout(() => this.onload(), 0);
                    }
                }
                window.XMLHttpRequest = EmptyContentXHR;
                window._pendingMimoBase64 = 'aGVsbG8=';
                window._pendingMimoEp = 'https://example.invalid/v1';
                window._pendingMimoKey = 'test-key';
                doAIParseGo();
            }"""
        )
        page.wait_for_timeout(50)
        assert "识别失败" in page.locator("#aiLoadingOverlay").inner_text()
        browser.close()


if __name__ == "__main__":
    test_mimo_diagnostics_are_persisted_and_visible()
    test_mimo_image_prepare_completes_once_after_image_cleanup()
    test_mimo_preparing_state_is_not_reported_as_recognition_complete()
    test_successful_http_with_empty_ai_content_is_reported_as_failure()
