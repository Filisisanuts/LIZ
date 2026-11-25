import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { describe, expect, it } from 'vitest';

const source = readFileSync(new URL('../src/js/utils.js', import.meta.url), 'utf8');
function harness() {
  const images: any[] = [], canvases: any[] = [], requests: any[] = [], timers: any[] = [], notices: string[] = [], revoked: string[] = [];
  const storage = new Map();
  let canvasError: Error | null = null, nullContext = false;
  class Image {
    width = 4096; height = 3072; naturalWidth = 4096; naturalHeight = 3072;
    onload: any; onerror: any; src = '';
    constructor() { images.push(this); }
  }
  class XHR {
    status = 200; responseText = ''; onload: any;
    constructor() { requests.push(this); }
    open() {} setRequestHeader() {} send() {}
  }
  const ctx: any = {
    console: { info() {} }, performance: {}, Image, XMLHttpRequest: XHR,
    URL: { createObjectURL: () => 'blob:test', revokeObjectURL: (url: string) => revoked.push(url) },
    localStorage: { getItem: (key: string) => storage.get(key) || null, setItem: (key: string, value: string) => storage.set(key, value) },
    document: { addEventListener() {}, getElementById: () => null, createElement: () => {
      const canvas = { width: 0, height: 0, getContext: () => nullContext ? null : { drawImage() { if (canvasError) throw canvasError; } }, toDataURL: () => 'data:image/jpeg;base64,AAAA' };
      canvases.push(canvas); return canvas;
    } },
    setTimeout: (fn: any) => timers.push(fn), clearInterval() {},
  };
  ctx.window = ctx;
  vm.createContext(ctx); vm.runInContext(source, ctx);
  ctx.toast = (message: string) => notices.push(message);
  ctx.hideAILoading = () => {}; ctx.showAILoading = () => {}; ctx.closeModal = () => {};
  ctx.getPurchaseSections = () => []; ctx.getPurchaseSources = () => [];
  ctx.normalizePurchaseSource = (value: string) => value || '';
  ctx.matchConfiguredPurchaseSource = () => ({ source: '', candidates: [] });
  ctx.addHistoryMatches = (items: any[]) => items; ctx.goPage = () => {};
  ctx.switchPT = () => {}; ctx.renderPML = () => {};
  ctx._mimoRunId = 'test-run';
  const logs = () => JSON.parse(storage.get('ax_mimo_diag') || '[]');
  return { ctx, images, canvases, requests, timers, notices, revoked, logs,
    setError: (error: Error) => { canvasError = error; }, noContext: () => { nullContext = true; } };
}

describe('image preparation diagnostics and cleanup', () => {
  it('releases decoded images, URL and canvas before the success callback and allows retry', () => {
    const h = harness(); let calls = 0;
    h.ctx.prepareMimoImage({}, (error: any, data: string) => {
      calls++; expect(error).toBeNull(); expect(data).toBe('AAAA');
      expect(h.canvases[0].width).toBe(0); expect(h.images[0].src).toBe('');
      expect(h.revoked).toEqual(['blob:test']);
    });
    h.images[0].onload(); expect(calls).toBe(1);
    h.ctx.prepareMimoImage({}, () => calls++); h.images[1].onload(); expect(calls).toBe(2);
    expect(h.logs().every((log: any) => log.version && log.run === 'test-run')).toBe(true);
  });
  it('does not call generic canvas errors memory exhaustion and cleans up on failure', () => {
    const h = harness(); h.setError(new TypeError('private image or credential text'));
    let error: any; h.ctx.prepareMimoImage({}, (value: any) => { error = value; }); h.images[0].onload();
    expect(error.message).not.toContain('内存不足');
    expect(h.canvases[0].height).toBe(0); expect(h.images[0].src).toBe('');
    expect(JSON.stringify(h.logs())).not.toContain('private');
    expect(h.logs().find((log: any) => log.event === 'local_failure').detail).toMatchObject({ stage: 'canvas_compress', errorName: 'TypeError' });
  });
  it('identifies explicit allocation failures and a missing canvas context separately', () => {
    const h = harness(); h.setError(new Error('out of memory'));
    let message = ''; h.ctx.prepareMimoImage({}, (error: any) => { message = error.message; }); h.images[0].onload();
    expect(message).toContain('内存不足');
    const other = harness(); other.noContext(); other.ctx.prepareMimoImage({}, () => {}); other.images[0].onload();
    expect(other.logs().find((log: any) => log.event === 'local_failure').detail.stage).toBe('canvas_context');
  });
  it('records a confirmation callback exception without a second callback or false compression error', () => {
    const h = harness(); let calls = 0;
    h.ctx.prepareMimoImage({}, () => { calls++; throw new Error('dialog failed'); }); h.images[0].onload();
    expect(calls).toBe(1); expect(h.images[0].src).toBe('');
    expect(h.logs().find((log: any) => log.event === 'run_failed').detail.stage).toBe('image_ready_callback');
    expect(h.logs().some((log: any) => log.event === 'local_failure')).toBe(false);
    expect(h.notices.at(-1)).not.toContain('内存不足');
  });
  it('records object URL failures and file reader failures with cleanup', () => {
    const h = harness(); h.ctx.URL.createObjectURL = () => { throw new Error('unsupported'); };
    h.ctx.prepareMimoImage({}, () => {});
    expect(h.logs().find((log: any) => log.event === 'local_failure').detail.stage).toBe('object_url_create');
    const other = harness(); let reader: any;
    other.ctx.FileReader = class { onerror: any; error = new Error('read failed'); readAsDataURL() { reader = this; } };
    other.ctx.prepareMimoImage({}, () => {}); other.images[0].onerror(); reader.onerror();
    expect(reader.onerror).toBeNull(); expect(other.images[0].src).toBe('');
    expect(other.logs().find((log: any) => log.event === 'local_failure').detail.stage).toBe('file_reader_read');
  });
  it('releases the fallback decoded image and reader on success', () => {
    const h = harness(); let reader: any, calls = 0;
    h.ctx.FileReader = class { onload: any; readAsDataURL() { reader = this; } };
    h.ctx.prepareMimoImage({}, (error: any, data: string) => { calls++; expect(error).toBeNull(); expect(data).toBe('AAAA'); });
    h.images[0].onerror(); reader.onload({ target: { result: 'data:image/jpeg;base64,AAAA' } }); h.images[1].onload();
    expect(h.images[1].src).toBe(''); expect(reader.onload).toBeNull(); expect(calls).toBe(1);
  });
});

describe('purchase recognition terminal diagnostics', () => {
  function respond(h: ReturnType<typeof harness>) {
    h.ctx._pendingMimoBase64 = 'AAAA'; h.ctx.doAIParseGo();
    const xhr = h.requests[0];
    xhr.responseText = JSON.stringify({ choices: [{ message: { content: JSON.stringify({ date: '2026-11-25', items: [{ name: 'test', qty: 1, total: 5 }] }) } }] });
    xhr.onload();
  }
  it('only completes after the review UI renders and preserves the originating run', () => {
    const h = harness(); respond(h);
    expect(h.logs().some((log: any) => log.event === 'run_completed')).toBe(false);
    h.ctx._mimoRunId = 'later-run'; h.timers.shift()();
    expect(h.logs().find((log: any) => log.event === 'run_completed').run).toBe('test-run');
  });
  it('captures delayed review rendering errors instead of declaring success', () => {
    const h = harness(); h.ctx.renderPML = () => { throw new Error('private receipt'); }; respond(h); h.timers.shift()();
    expect(h.logs().some((log: any) => log.event === 'run_completed')).toBe(false);
    expect(h.logs().find((log: any) => log.event === 'run_failed').detail.stage).toBe('review_render');
    expect(JSON.stringify(h.logs())).not.toContain('private receipt');
  });
});
