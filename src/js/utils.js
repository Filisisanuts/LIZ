var $id=function(id){return document.getElementById(id)};

// 括号转换：英文括号转中文括号
function fixBrackets(s){if(!s)return s;return s.replace(/\(/g,'（').replace(/\)/g,'）')}

// 日期工具
function td(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0')}
function curYM(){var d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}
function lastYM(){var d=new Date();d.setMonth(d.getMonth()-1);return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')}

// 格式化
function fmt(n){return n==null?'-':n.toLocaleString('zh-CN',{minimumFractionDigits:2,maximumFractionDigits:2})}
function fmtC(n){return(n<0?'-':'')+fmt(Math.abs(n))}
function fmtP(n){return n.toFixed(1)+'%'}

// 字符串转单引号包裹（用于拼接onclick内联事件）
function sq(s){return"'"+s+"'"}

// 从字符串提取数字
function extN(s){var m=s.match(/([\d,]+\.?\d*)/);return m?parseFloat(m[0].replace(/,/g,'')):0}

// 提示消息
function toast(m){var t=$id('toast');if(!t)return;t.textContent=m;t.classList.add('show');setTimeout(function(){t.classList.remove('show')},2200)}

// 弹窗
function showModal(content, width) {
    var m = $id('modal'), o = $id('overlay');
    window._axModalReturnFocus = document.activeElement;
    m.innerHTML = content;
    m.style.maxWidth = (width || 560) + 'px';
    m.setAttribute('role', 'dialog');
    m.setAttribute('aria-modal', 'true');
    m.setAttribute('tabindex', '-1');
    m.classList.add('show', 'modal-enter');
    o.classList.add('show');
    m.style.position = 'fixed';
    // 不自动设置overflowY，由调用方控制
    o.onclick = function(e) {
        if (e.target !== o) return;
        var dp = document.getElementById('datePicker');
        if (dp && dp.style.display !== 'none' && dp.style.display !== '') {
            _dpClose();
            return;
        }
        closeModal();
    };
    m.onclick = function(e) {
        // 点击输入框、按钮、下拉框时不关日期选择器
        var tag = e.target.tagName;
        if (tag === 'INPUT' || tag === 'SELECT' || tag === 'BUTTON' || tag === 'OPTION') return;
        var dp = document.getElementById('datePicker');
        if (dp && dp.style.display !== 'none' && dp.style.display !== '') {
            _dpClose();
        }
        // 弹窗内点击非下拉区域时关闭已打开的下拉（stopPropagation 会拦掉 document 的冒泡关闭）
        if (typeof axCloseSelects === 'function'
            && e.target.closest && !e.target.closest('.ax-select')
            && document.querySelector('.ax-select.open')) {
            axCloseSelects();
        }
        e.stopPropagation();
    };
    m.onkeydown = function(e) {
        if (e.key !== 'Tab') return;
        var focusable = Array.prototype.slice.call(m.querySelectorAll('button,input,select,textarea,[href],[tabindex]:not([tabindex="-1"])')).filter(function(el) {
            return !el.disabled && el.offsetParent !== null;
        });
        if (!focusable.length) return;
        var first = focusable[0], last = focusable[focusable.length - 1];
        if (e.shiftKey && document.activeElement === first) {
            e.preventDefault();
            last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
            e.preventDefault();
            first.focus();
        }
    };
    if (window.axUI && window.axUI.initSelects) window.axUI.initSelects(m);
    if (window.axUI && window.axUI.initA11y) window.axUI.initA11y(m);
    setTimeout(function() {
        var focusable = m.querySelector('input:not([type="hidden"]),select,textarea,button');
        if (focusable) focusable.focus();
    }, 0);
}

function closeModal() {
    // AI 识图确认框被遮罩关闭时，也必须释放待处理的原始照片。
    if(window._pendingMimoDialog&&typeof clearPendingMimo==='function')clearPendingMimo();
    var m = $id('modal'), o = $id('overlay');
    if (m) {
        m.onkeydown = null;
        m.removeAttribute('role');
        m.removeAttribute('aria-modal');
        m.classList.remove('show', 'modal-enter', 'modal-exit');
        m.innerHTML = '';
        // 清除所有内联样式，让CSS类的display:none生效
        m.removeAttribute('style');
    }
    if (o) {
        o.classList.remove('show');
        o.onclick = null;
    }
    if (window._axModalReturnFocus && typeof window._axModalReturnFocus.focus === 'function') {
        try { window._axModalReturnFocus.focus(); } catch (e) {}
    }
    window._axModalReturnFocus = null;
}

// 通用的平滑返回函数
function backToModal(callback) {
    closeModal();
    setTimeout(function() {
        if (typeof callback === 'function') {
            callback();
        }
    }, 250);
}

// 获取某月全部日报
function getMR(ym){return DB.dailyReports.filter(function(r){return r.date.startsWith(ym)})}

// 获取采购来源列表
// 优先从配置读取，否则返回空数组（新用户通过引导配置）
function getPurchaseSources() {
    try {
        var config = getAppConfig();
        if (config.purchaseSources && config.purchaseSources.length > 0) {
            return config.purchaseSources.filter(function(source) { return source !== '退货'; });
        }
    } catch(e) {}
    return [];
}

// 获取自定义标签列表
// 优先从配置管理模块读取，否则使用旧逻辑
function getFreeLabels(){
    try {
        var config = getAppConfig();
        if (config.dailyLabels && config.dailyLabels.length > 0) {
            return config.dailyLabels;
        }
    } catch(e) {}

    // 兼容旧逻辑（从已有日报中提取标签）
    var d = [];
    try {
        if (DB && DB.dailyReports) {
            // 可以从历史日报中提取常用标签
        }
    } catch(e) {}
    try{var s=JSON.parse(localStorage.getItem('ax_fl')||'[]');s.forEach(function(l){if(d.indexOf(l)<0)d.push(l)})}catch(e){}
    return d;
}
function saveFL(l){
    try{
        var s=JSON.parse(localStorage.getItem('ax_fl')||'[]');
        if(s.indexOf(l)<0){
            s.push(l);
            localStorage.setItem('ax_fl',JSON.stringify(s));
        }
        var config=getAppConfig();
        config.dailyLabels=config.dailyLabels||[];
        if(config.dailyLabels.indexOf(l)<0) config.dailyLabels.push(l);
        storeAppConfig({dailyLabels:config.dailyLabels});
    }catch(e){}
}

// 一次性迁移旧标签到账号配置；只在明确调用时执行，不扫描其他账号。
function syncLegacyDailyLabels(){
    try{
        var legacy=[];
        var saved=JSON.parse(localStorage.getItem('ax_fl')||'[]');
        if(Array.isArray(saved)) saved.forEach(function(label){if(label&&legacy.indexOf(label)<0)legacy.push(String(label))});
        (DB.dailyReports||[]).forEach(function(report){
            var items=report&&report.revenue&&report.revenue.otherItems;
            if(items&&typeof items==='object') Object.keys(items).forEach(function(label){if(label&&legacy.indexOf(label)<0)legacy.push(label)});
        });
        var config=getAppConfig();
        var labels=(config.dailyLabels||[]).slice();
        legacy.forEach(function(label){if(labels.indexOf(label)<0)labels.push(label)});
        if(labels.length===(config.dailyLabels||[]).length) return labels;
        storeAppConfig({dailyLabels:labels});
        return labels;
    }catch(e){
        console.error('同步旧日报标签失败:',e);
        return [];
    }
}

// 图片压缩
function processImage(file,mw,cb){var reader=new FileReader();reader.onload=function(e){var img=new Image();img.onload=function(){var c=document.createElement('canvas');var w=img.width,h=img.height;if(w>mw){h=h*mw/w;w=mw}c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);cb(c.toDataURL('image/jpeg',.85))};img.src=e.target.result};reader.readAsDataURL(file)}
var _expPhotoSelectionVersion=0;
function handleExpPhoto(e){
    var f=e.target.files[0];
    var status=$id('expPhotoStatus');
    var clear=$id('expPhotoClear');
    if(!f){
        clearExpPhoto();
        return;
    }
    var selectionVersion=++_expPhotoSelectionVersion;
    if(status){status.textContent='正在读取：'+f.name;status.className='expense-upload-status';}
    if(clear)clear.hidden=true;
    processImage(f,800,function(d){
        if(selectionVersion!==_expPhotoSelectionVersion)return;
        _expPhotoData=d;
        if(status){status.textContent='✓ 已添加：'+f.name;status.className='expense-upload-status is-selected';}
        if(clear)clear.hidden=false;
        toast('已选择照片');
    })
}
function handleDmgPhoto(e){var f=e.target.files[0];if(!f)return;processImage(f,800,function(d){_dmgPhotoData=d;toast('已选择照片')})}

// ---- AI加载动画（供采购单识别使用）----
function showAILoading(phase){
    if($id('aiLoadingOverlay'))return;
    var preparing=phase==='preparing';
    var el=document.createElement('div');el.id='aiLoadingOverlay';
    el.style.cssText='position:fixed;bottom:20px;right:20px;background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:12px 16px;z-index:9999;display:flex;align-items:center;gap:10px;box-shadow:0 4px 16px rgba(0,0,0,.2)';
    el.innerHTML='<div style="width:18px;height:18px;border:2px solid var(--bd);border-top-color:var(--ac);border-radius:50%;animation:aiSpin .8s linear infinite;flex-shrink:0"></div><div><div style="font-size:.78rem;font-weight:600;color:var(--tx)">'+(preparing?'正在处理图片':'MiMo 识别中')+'</div><div id="aiLoadingTimer" style="font-size:.65rem;color:var(--tx-m)">'+(preparing?'压缩完成后请确认识别':'0秒')+'</div></div>';
    document.body.appendChild(el);
    window._aiStartTime=Date.now();
    window._aiTimerInterval=setInterval(function(){var el2=$id('aiLoadingTimer');if(el2)el2.textContent=Math.floor((Date.now()-window._aiStartTime)/1000)+'秒'},1000);
}
function hideAILoading(success){
    if(window._aiTimerInterval){clearInterval(window._aiTimerInterval);window._aiTimerInterval=null}
    var el=$id('aiLoadingOverlay');if(!el)return;
    if(success===null){el.remove();return}
    var elapsed=Math.floor((Date.now()-(window._aiStartTime||Date.now()))/1000);
    var ok=success!==false, color=ok?'var(--gn)':'var(--rd)', icon=ok?'✓':'!';
    el.innerHTML='<div style="width:18px;height:18px;border-radius:50%;background:'+color+';display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;flex-shrink:0">'+icon+'</div><div><div style="font-size:.78rem;font-weight:600;color:'+color+'">'+(ok?'识别完成':'识别失败')+'</div><div style="font-size:.65rem;color:var(--tx-m)">耗时'+elapsed+'秒</div></div>';
    setTimeout(function(){var e=$id('aiLoadingOverlay');if(e)e.remove()},2000);
}

// ---- AI拍照识别（采购单，统一入口）----
function clearPendingMimo(){
    window._pendingMimoFile=null;
    window._pendingMimoBase64=null;
    window._pendingMimoEp=null;
    window._pendingMimoKey=null;
    window._pendingMimoDialog=false;
}
// release AI memory after recognition
function releaseMimoMemory(){
    try{
        if(window._mimoObjectURL){URL.revokeObjectURL(window._mimoObjectURL);window._mimoObjectURL=null}
    }catch(e){}
    window._mimoBase64=null;
    window._mimoProcessing=false;
}
function mimoErrorMessage(text){
    try{
        var data=JSON.parse(text||'');
        return (data.error&&(data.error.message||data.error.code))||data.message||'';
    }catch(e){return (text||'').replace(/<[^>]*>/g,' ').replace(/\s+/g,' ').trim().slice(0,160)}
}
// ---- AI识图脱敏诊断 ----
var MIMO_DIAG_KEY='ax_mimo_diag',MIMO_DIAG_LIMIT=80;
function mimoMemorySnapshot(){
    var memory=performance&&performance.memory;
    return memory?{usedJSHeapSize:memory.usedJSHeapSize,totalJSHeapSize:memory.totalJSHeapSize,jsHeapSizeLimit:memory.jsHeapSizeLimit}:null;
}
function mimoDiag(event,detail){
    var record={at:new Date().toISOString(),run:window._mimoRunId||'unknown',event:event,detail:detail||{}};
    try{
        var records=JSON.parse(localStorage.getItem(MIMO_DIAG_KEY)||'[]');
        records.push(record);
        localStorage.setItem(MIMO_DIAG_KEY,JSON.stringify(records.slice(-MIMO_DIAG_LIMIT)));
    }catch(e){}
    if(window.console&&console.info)console.info('[MiMo诊断]',record);
}
function startMimoRun(file){
    window._mimoRunId='mimo-'+Date.now()+'-'+Math.random().toString(36).slice(2,7);
    mimoDiag('file_selected',{type:file.type||'unknown',size:file.size||0,lastModified:file.lastModified||0,memory:mimoMemorySnapshot()});
}
function mimoEndpointSummary(endpoint){
    try{return new URL(endpoint).origin}catch(e){return 'invalid-endpoint'}
}
function mimoResponseSummary(data,responseText){
    var choice=data&&data.choices&&data.choices[0],message=choice&&choice.message,content=message&&message.content,reasoning=message&&(message.reasoning_content||message.reasoningContent);
    return {
        responseBytes:(responseText||'').length,
        topLevelKeys:data&&typeof data==='object'?Object.keys(data).slice(0,12):[],
        choicesCount:data&&data.choices&&data.choices.length||0,
        hasMessage:!!message,
        contentType:typeof content,
        contentLength:typeof content==='string'?content.length:0,
        reasoningContentType:typeof reasoning,
        reasoningContentLength:typeof reasoning==='string'?reasoning.length:0,
        finishReason:choice&&choice.finish_reason||null,
        errorCode:data&&data.error&&(data.error.code||data.error.type)||null
    };
}
function showMimoDiagnostics(){
    var records=[];
    try{records=JSON.parse(localStorage.getItem(MIMO_DIAG_KEY)||'[]')}catch(e){}
    var report=JSON.stringify(records,null,2);
    var h='<h3>AI识图诊断</h3><p style="font-size:.75rem;color:var(--tx-m)">仅含阶段、尺寸、耗时与响应结构；不含图片、单据内容、API Key 或完整 AI 回复。</p><textarea id="mimoDiagReport" class="inp" readonly style="height:320px;font-family:monospace;font-size:.68rem;white-space:pre">'+report.replace(/</g,'&lt;')+'</textarea><div class="brow" style="margin-top:10px"><button class="btn p" onclick="copyMimoDiagnostics()">复制诊断</button><button class="btn" onclick="closeModal()">关闭</button></div>';
    showModal(h,680);
}
function copyMimoDiagnostics(){
    var report=$id('mimoDiagReport');if(!report)return;
    report.select();
    if(navigator.clipboard&&navigator.clipboard.writeText){
        navigator.clipboard.writeText(report.value).then(function(){toast('诊断已复制')}).catch(function(){document.execCommand('copy');toast('诊断已复制')});
    }else{document.execCommand('copy');toast('诊断已复制')}
}
function prepareMimoImage(file,cb){
    var finished=false;
    function finish(error,base64){
        if(finished){
            mimoDiag('ignored_late_image_event',{outcome:error?'error':'success'});
            return;
        }
        finished=true;
        cb(error,base64);
    }
    function releaseImage(img){
        if(!img)return;
        img.onload=null;
        img.onerror=null;
        img.src='';
    }
    // Shared canvas compression logic
    function compressImage(img){
        try{
            var maxSide=1200,maxPixels=1200000,w=img.width,h=img.height;
            var scale=Math.min(1,maxSide/Math.max(w,h),Math.sqrt(maxPixels/(w*h)));
            w=Math.max(1,Math.round(w*scale));h=Math.max(1,Math.round(h*scale));
            var canvas=document.createElement("canvas");canvas.width=w;canvas.height=h;
            canvas.getContext("2d").drawImage(img,0,0,w,h);
            var base64=canvas.toDataURL("image/jpeg",.65).split(",")[1];
            mimoDiag('image_compressed',{width:w,height:h,base64Bytes:base64.length,memory:mimoMemorySnapshot()});
            canvas.width=0;canvas.height=0;canvas=null;
            if(base64.length>2*1024*1024){mimoDiag('local_failure',{stage:'compressed_image_too_large',base64Bytes:base64.length});finish(new Error("图片压缩后仍超过 2 MB，请靠近单据重新拍摄，或分两张识别"));releaseImage(img);return}
            finish(null,base64);
            releaseImage(img);
        }catch(canvasErr){
            mimoDiag('local_failure',{stage:'canvas_compress',errorName:canvasErr&&canvasErr.name||'Error',memory:mimoMemorySnapshot()});
            finish(new Error("内存不足，无法处理图片。请关闭其他标签页后重试"));
            releaseImage(img);
        }
    }
    try{
        // Try objectURL first (lower memory), fall back to FileReader if it fails
        var objectURL=URL.createObjectURL(file);
        window._mimoObjectURL=objectURL;
        var img=new Image();
        var triedObjectURL=true;
        img.onload=function(){
            img.onload=null;img.onerror=null;
            URL.revokeObjectURL(objectURL);window._mimoObjectURL=null;
            mimoDiag('object_url_loaded',{width:img.naturalWidth||img.width,height:img.naturalHeight||img.height});
            compressImage(img);
        };
        img.onerror=function(){
            if(finished){mimoDiag('ignored_late_image_event',{source:'object_url'});return}
            URL.revokeObjectURL(objectURL);window._mimoObjectURL=null;
            if(triedObjectURL){
                triedObjectURL=false;
                mimoDiag('object_url_failed',{fallback:'FileReader'});
                var reader=new FileReader();
                reader.onload=function(ev){
                    var img2=new Image();
                    img2.onload=function(){img2.onload=null;img2.onerror=null;mimoDiag('file_reader_loaded',{width:img2.naturalWidth||img2.width,height:img2.naturalHeight||img2.height});compressImage(img2)};
                    img2.onerror=function(){mimoDiag('local_failure',{stage:'file_reader_image_decode'});finish(new Error("图片无法读取，请重新拍摄"))};
                    img2.src=ev.target.result;
                };
                reader.onerror=function(){mimoDiag('local_failure',{stage:'file_reader_read'});finish(new Error("图片读取失败，请重新拍摄"))};
                reader.readAsDataURL(file);
            }
        };
        img.src=objectURL;
    }catch(e){
        mimoDiag('local_failure',{stage:'object_url_create',errorName:e&&e.name||'Error',memory:mimoMemorySnapshot()});
        finish(new Error("内存不足，无法加载图片。请关闭其他标签页后重试"));
    }
}
function doAIParse(){
    if(!localStorage.getItem('ax_mimo_key')){toast('请先在设置页配置MiMo API');return}
    var input=document.createElement('input');input.type='file';input.accept='image/*';input.capture='environment';
    input.onchange=function(e){
        var file=e.target.files[0];if(!file)return;
        clearPendingMimo();
        startMimoRun(file);
        // Eagerly load and compress image right away (before confirmation dialog)
        window._pendingMimoBase64=null;
        window._pendingMimoEp=localStorage.getItem('ax_mimo_ep');
        window._pendingMimoKey=localStorage.getItem('ax_mimo_key');
        showAILoading('preparing');
        prepareMimoImage(file,function(imageError,base64){
            hideAILoading(null);
            if(imageError){mimoDiag('run_failed',{stage:'prepare_image',message:imageError.message});toast(imageError.message+'（可查看识别诊断）');return}
            window._pendingMimoBase64=base64;
            window._pendingMimoDialog=true;
            mimoDiag('confirmation_shown',{base64Bytes:base64.length});
            var h2='<div style="text-align:center;padding:10px"><div style="font-size:.88rem;font-weight:700;margin-bottom:8px">确认识别这张图片？</div><div class="brow"><button class="btn p" onclick="doAIParseGo()">确认识别</button> <button class="btn" onclick="clearPendingMimo();closeModal()">取消</button></div></div>';
            showModal(h2,400);
        });
    };input.click();
}
function doAIParseGo(){
    if(window._mimoProcessing)return;
    window._mimoProcessing=true;
    window._pendingMimoDialog=false;
    closeModal();showAILoading();
    var base64=window._pendingMimoBase64,ep=window._pendingMimoEp,key=window._pendingMimoKey;
    if(!base64){window._mimoProcessing=false;mimoDiag('run_failed',{stage:'confirm_without_image'});hideAILoading(false);toast("图片已失效，请重新拍摄（可查看识别诊断）");return}
    var purchaseSections = getPurchaseSections();
    var regionRule = purchaseSections.length ? '区域只能是：' + purchaseSections.join('、') + '。' : '';
    var prompt='请识别这张采购单/出库单图片，提取日期、供应商名称和商品信息。每项商品的区域只作为识图候选，不代表已确认；不要根据历史记录推断区域或分类，也不要返回category。请严格按以下JSON格式返回：\n\n{"date":"YYYY-MM-DD","source":"供应商名称","items":[{"name":"商品名称","qty":数字,"unit":"单位","unitPrice":单价,"total":金额,"section":"区域候选"}]}\n\n' + regionRule + '无法判断则留空。只返回JSON。';
    var body={model:localStorage.getItem('ax_mimo_model')||'mimo-v2.5',messages:[{role:'user',content:[{type:'text',text:prompt},{type:'image_url',image_url:{url:'data:image/jpeg;base64,'+base64}}]}],max_tokens:4096,temperature:.1};
    var xhr=new XMLHttpRequest();xhr.open('POST',ep,true);
    xhr.setRequestHeader('Content-Type','application/json');xhr.setRequestHeader('Authorization','Bearer '+key);xhr.timeout=120000;
    mimoDiag('request_started',{endpoint:mimoEndpointSummary(ep),model:body.model,base64Bytes:base64.length,memory:mimoMemorySnapshot()});
    xhr.onload=function(){
        window._mimoProcessing=false;
        if(xhr.status<200||xhr.status>=300){var message=mimoErrorMessage(xhr.responseText)||("服务返回 HTTP "+xhr.status);mimoDiag('api_failure',{httpStatus:xhr.status,responseBytes:(xhr.responseText||'').length,message:message});clearPendingMimo();releaseMimoMemory();hideAILoading(false);toast("识别失败："+message+"（可查看识别诊断）");return}
        mimoDiag('http_success',{httpStatus:xhr.status,responseBytes:(xhr.responseText||'').length});
        clearPendingMimo();releaseMimoMemory();
        try{
            var data=JSON.parse(xhr.responseText);mimoDiag('response_received',mimoResponseSummary(data,xhr.responseText));var reply='';
            if(data.choices&&data.choices[0])reply=data.choices[0].message.content||'';
            if(!reply){mimoDiag('run_failed',{stage:'empty_ai_content'});hideAILoading(false);toast('AI返回为空（可查看识别诊断）');return}
            var m=reply.match(/\{[\s\S]*\}/);if(!m){mimoDiag('run_failed',{stage:'missing_json',contentLength:reply.length});hideAILoading(false);toast('AI未返回JSON（可查看识别诊断）');return}
            var result=JSON.parse(m[0]);if(!result.items||!result.items.length){mimoDiag('run_failed',{stage:'empty_items'});hideAILoading(false);toast('未识别到商品（可查看识别诊断）');return}
            if(!result.date)result.date=td();
            // 识别到的来源仅匹配账号已配置来源；无唯一匹配时留空，交由用户选择。
            var sources=getPurchaseSources();
            var sourceSuggestion=normalizePurchaseSource(result.source, '');
            var sourceMatch=matchConfiguredPurchaseSource(sourceSuggestion, sources);
            var src=sourceMatch.source;
            result.source=src;
            var items=[];result.items.forEach(function(item){
                var qty=parseFloat(item.qty)||0,total=parseFloat(item.total)||0,unitPrice=parseFloat(item.unitPrice)||0;
                if(!unitPrice&&total>0&&qty>0)unitPrice=Math.round(total/qty*100)/100;
                if(qty>0&&total>0)items.push({name:String(item.name||''),section:'',category:'',aiSectionSuggestion:normalizePurchaseSource(item.section,''),aiCategorySuggestion:normalizePurchaseSource(item.category,''),qty:qty,unit:String(item.unit||''),unitPrice:unitPrice,total:total,source:src});
            });
            if(!items.length){mimoDiag('run_failed',{stage:'items_filtered_out',rawItems:result.items.length});hideAILoading(false);toast('解析结果为空（可查看识别诊断）');return}
            // 英文括号转中文括号
            items.forEach(function(item){item.name=fixBrackets(item.name)});
            // 添加历史匹配
            items = addHistoryMatches(items);
            window._pmAiReviewState={active:true,source:src,sourceResolved:!!src,sourceSuggestion:src?'':sourceSuggestion,sourceMatchStatus:sourceMatch.status,sourceManuallySelected:false,sourceMatchCandidates:sourceMatch.candidates};
            hideAILoading();
            _pmItems=items.slice();goPage('purchase');
            setTimeout(function(){switchPT('manual');if(result.date&&$id('pmDate'))$id('pmDate').value=result.date;if($id('pmSrc'))$id('pmSrc').value=src;renderPML();toast('已识别 '+items.length+' 项，请核对未匹配项目和来源')},200);
        }catch(e){mimoDiag('run_failed',{stage:'response_parse',errorName:e&&e.name||'Error'});hideAILoading(false);toast('解析失败（可查看识别诊断）');console.error(e)}
    };
    xhr.onerror=function(){window._mimoProcessing=false;mimoDiag('api_failure',{stage:'network_error'});clearPendingMimo();releaseMimoMemory();hideAILoading(false);toast("请求失败，请检查网络或 API 地址（可查看识别诊断）")};xhr.ontimeout=function(){window._mimoProcessing=false;mimoDiag('api_failure',{stage:'timeout',timeoutMs:xhr.timeout});clearPendingMimo();releaseMimoMemory();hideAILoading(false);toast("请求超时（可查看识别诊断）")};
    xhr.send(JSON.stringify(body));
}

// ==== 日期选择器 ====
var _dpTarget=null,_dpDate=null,_dpSelected=null;
function _dpOpen(inputId){var input=document.getElementById(inputId);if(!input)return;_dpTarget=input;var val=input.value;if(val&&/^\d{4}-\d{2}-\d{2}$/.test(val)){var parts=val.split('-');_dpDate=new Date(parseInt(parts[0]),parseInt(parts[1])-1,1);_dpSelected=val}else{_dpDate=new Date();_dpDate.setDate(1);_dpSelected=null}_dpRender();var el=document.getElementById('datePicker');el.style.display='block';var rect=input.getBoundingClientRect();el.style.top=(rect.bottom+window.scrollY+6)+'px';var left=rect.left+window.scrollX;if(left+300>window.innerWidth)left=window.innerWidth-310;if(left<8)left=8;el.style.left=left+'px';setTimeout(function(){document.addEventListener('click',_dpOutside)},50)}
function _dpClose(){var el=document.getElementById('datePicker');if(el)el.style.display='none';_dpTarget=null;document.removeEventListener('click',_dpOutside)}
function _dpOutside(e) {
    if (e.target.id === 'overlay') return;
    var el = document.getElementById('datePicker');
    if (!el) return;
    var rect = el.getBoundingClientRect();
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom)
        _dpClose();
}
function _dpNav(dir){_dpDate.setMonth(_dpDate.getMonth()+dir);_dpRender()}
function _dpSel(dateStr){_dpSelected=dateStr;if(_dpTarget){_dpTarget.value=dateStr;_dpTarget.dispatchEvent(new Event('change',{bubbles:true}));_dpTarget.dispatchEvent(new Event('input',{bubbles:true}))}_dpClose()}
function _dpToday(){var now=new Date();var y=now.getFullYear(),m=String(now.getMonth()+1).padStart(2,'0'),d=String(now.getDate()).padStart(2,'0');_dpSel(y+'-'+m+'-'+d)}
function _dpClear(){if(_dpTarget){_dpTarget.value='';_dpTarget.dispatchEvent(new Event('change',{bubbles:true}));_dpTarget.dispatchEvent(new Event('input',{bubbles:true}))}_dpClose()}
function _dpRender(){var el=document.getElementById('dpBody');if(!el)return;var year=_dpDate.getFullYear(),month=_dpDate.getMonth(),today=new Date();var todayStr=today.getFullYear()+'-'+String(today.getMonth()+1).padStart(2,'0')+'-'+String(today.getDate()).padStart(2,'0');var daysInMonth=new Date(year,month+1,0).getDate();var firstDay=new Date(year,month,1).getDay();firstDay=firstDay===0?6:firstDay-1;var monthNames=['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];var h='<div class="dp-header"><button class="dp-nav" onclick="_dpNav(-1)">&#8249;</button><span class="dp-title">'+year+'年 '+monthNames[month]+'</span><button class="dp-nav" onclick="_dpNav(1)">&#8250;</button></div>';h+='<div class="dp-weekdays">';['一','二','三','四','五','六','日'].forEach(function(w){h+='<div class="dp-wd">'+w+'</div>'});h+='</div><div class="dp-days">';for(var i=0;i<firstDay;i++)h+='<div class="dp-day dp-empty"></div>';for(var d=1;d<=daysInMonth;d++){var ds=year+'-'+String(month+1).padStart(2,'0')+'-'+String(d).padStart(2,'0');var cls='dp-day';if(ds===todayStr)cls+=' dp-today';if(ds===_dpSelected)cls+=' dp-selected';h+='<div class="'+cls+'" onclick="_dpSel(\''+ds+'\')">'+d+'</div>'}h+='</div><div class="dp-footer"><button class="dp-btn dp-btn-today" onclick="_dpToday()">今天</button><button class="dp-btn dp-btn-clear" onclick="_dpClear()">清除</button></div>';el.innerHTML=h}

// ==== 月份选择器 ====
var _mpTarget=null,_mpYear=null;
function _mpOpen(inputId){var input=document.getElementById(inputId);if(!input)return;_mpTarget=input;var val=input.value;if(val&&/^\d{4}-\d{2}$/.test(val)){_mpYear=parseInt(val.split('-')[0])}else{_mpYear=new Date().getFullYear()}_mpRender();var el=document.getElementById('datePicker');el.style.display='block';var rect=input.getBoundingClientRect();el.style.top=(rect.bottom+window.scrollY+6)+'px';var left=rect.left+window.scrollX;if(left+300>window.innerWidth)left=window.innerWidth-310;if(left<8)left=8;el.style.left=left+'px';setTimeout(function(){document.addEventListener('click',_mpOutside)},50)}
function _mpClose(){var el=document.getElementById('datePicker');if(el)el.style.display='none';_mpTarget=null;document.removeEventListener('click',_mpOutside)}
function _mpOutside(e){var el=document.getElementById('datePicker');if(!el)return;var rect=el.getBoundingClientRect();if(e.clientX<rect.left||e.clientX>rect.right||e.clientY<rect.top||e.clientY>rect.bottom)_mpClose()}
function _mpNav(dir){_mpYear+=dir;_mpRender()}
function _mpSel(ym){if(_mpTarget){_mpTarget.value=ym;_mpTarget.dispatchEvent(new Event('change',{bubbles:true}));_mpTarget.dispatchEvent(new Event('input',{bubbles:true}))}_mpClose()}
function _mpRender(){var el=document.getElementById('dpBody');if(!el)return;var now=new Date();var thisMonth=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');var selected=_mpTarget?_mpTarget.value:'';var monthNames=['一月','二月','三月','四月','五月','六月','七月','八月','九月','十月','十一月','十二月'];var h='<div class="dp-header"><button class="dp-nav" onclick="_mpNav(-1)">&#8249;</button><span class="dp-title">'+_mpYear+'年</span><button class="dp-nav" onclick="_mpNav(1)">&#8250;</button></div>';h+='<div class="dp-months">';for(var m=1;m<=12;m++){var ym=_mpYear+'-'+String(m).padStart(2,'0');var cls='dp-month';if(ym===thisMonth)cls+=' dp-today';if(ym===selected)cls+=' dp-selected';h+='<div class="'+cls+'" onclick="_mpSel(\''+ym+'\')">'+monthNames[m-1]+'</div>'}h+='</div><div class="dp-footer"><button class="dp-btn dp-btn-today" onclick="_mpThisMonth()">本月</button><button class="dp-btn dp-btn-clear" onclick="_mpClear()">清除</button></div>';el.innerHTML=h}
function _mpThisMonth(){var now=new Date();var ym=now.getFullYear()+'-'+String(now.getMonth()+1).padStart(2,'0');_mpSel(ym)}
function _mpClear(){if(_mpTarget){_mpTarget.value='';_mpTarget.dispatchEvent(new Event('change',{bubbles:true}));_mpTarget.dispatchEvent(new Event('input',{bubbles:true}))}_mpClose()}

// 初始化日期选择器DOM
function initDatePicker(){if(document.getElementById('datePicker'))return;if(!document.body)return;var div=document.createElement('div');div.id='datePicker';div.className='date-picker';div.style.display='none';div.innerHTML='<div id="dpBody"></div>';document.body.appendChild(div)}
// 确保DOM加载完成后再初始化
if(document.readyState==='loading'){document.addEventListener('DOMContentLoaded',initDatePicker)}else if(document.body){initDatePicker()}else{document.addEventListener('DOMContentLoaded',initDatePicker)}





// ========== 历史匹配功能 ==========

// 获取历史采购物品
function getHistoryItems() {
    var items = [];
    DB.purchases.forEach(function(p, purchaseOrder) {
        if (!p || p.recordType === 'return' || p.type === 'return' || p.source === '退货') return;
        (p.items || []).forEach(function(item, itemOrder) {
            if (item.name && item.recordType !== 'return' && item.return !== true && item.source !== '退货') {
                items.push({
                    name: item.name,
                    section: item.section || '',
                    category: item.category || '',
                    source: item.source || p.source || '外购',
                    unitPrice: item.unitPrice,
                    unit: item.unit || '',
                    date: String(p.date || ''),
                    purchaseOrder: purchaseOrder,
                    itemOrder: itemOrder
                });
            }
        });
    });
    return items;
}

/**
 * 从同名历史商品中取采购日期最近的一条；同日时取记录顺序靠后的一条。
 * @param {Array<Object>} items 同名历史商品记录。
 * @returns {Object|null} 最近记录；没有历史记录时返回 null。
 */
function getLatestPurchaseHistoryItem(items) {
    var latest = null;
    (items || []).forEach(function(item) {
        if (!latest) { latest = item; return; }
        var itemDate = String(item.date || '');
        var latestDate = String(latest.date || '');
        if (itemDate > latestDate) { latest = item; return; }
        if (itemDate < latestDate) return;

        var itemPurchaseOrder = Number(item.purchaseOrder) || 0;
        var latestPurchaseOrder = Number(latest.purchaseOrder) || 0;
        if (itemPurchaseOrder > latestPurchaseOrder) { latest = item; return; }
        if (itemPurchaseOrder < latestPurchaseOrder) return;
        if ((Number(item.itemOrder) || 0) > (Number(latest.itemOrder) || 0)) latest = item;
    });
    return latest;
}

/**
 * 规范化采购品名，忽略空格、大小写、常见标点及全半角差异。
 * @param {unknown} name 原始品名。
 * @returns {string} 用于比较的规范化品名。
 */
function normalizePurchaseItemName(name) {
    var value = String(name == null ? '' : name);
    if (typeof value.normalize === 'function') value = value.normalize('NFKC');
    return value.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
}

/**
 * 计算两个采购品名规范化后的 Levenshtein 编辑距离。
 * @param {unknown} left 第一个品名。
 * @param {unknown} right 第二个品名。
 * @returns {number} 将左侧品名转换为右侧品名所需的最少单字符操作数。
 */
function calculatePurchaseNameDistance(left, right) {
    var a = normalizePurchaseItemName(left);
    var b = normalizePurchaseItemName(right);
    if (!a || !b) return Math.max(a.length, b.length);

    var previous = [];
    for (var j = 0; j <= b.length; j++) previous[j] = j;
    for (var i = 1; i <= a.length; i++) {
        var current = [i];
        for (var k = 1; k <= b.length; k++) {
            var substitution = previous[k - 1] + (a.charAt(i - 1) === b.charAt(k - 1) ? 0 : 1);
            current[k] = Math.min(previous[k] + 1, current[k - 1] + 1, substitution);
        }
        previous = current;
    }
    return previous[b.length];
}

// 保留相似度接口，使用编辑距离衡量识图名称差异。
function calculateSimilarity(str1, str2) {
    var a = normalizePurchaseItemName(str1);
    var b = normalizePurchaseItemName(str2);
    var longest = Math.max(a.length, b.length);
    if (!longest) return 1;
    return 1 - calculatePurchaseNameDistance(a, b) / longest;
}

/**
 * 按规范化名称匹配历史采购物品；精确优先，OCR 错字只接受唯一的一字符差异候选。
 * @param {unknown} aiName AI 识别出的品名。
 * @param {Array<Object>} historyItems 历史采购物品。
 * @returns {Object|null} 唯一匹配及其同名记录、歧义候选，或未命中时的 null。
 */
function matchHistoricalItem(aiName, historyItems) {
    var aiKey = normalizePurchaseItemName(aiName);
    if (!aiKey) return null;

    var groups = [];
    historyItems.forEach(function(item) {
        var key = normalizePurchaseItemName(item.name);
        if (!key) return;
        var group = groups.find(function(candidate) { return candidate.key === key; });
        if (!group) {
            group = { key: key, name: item.name, items: [] };
            groups.push(group);
        }
        group.items.push(item);
    });

    groups.forEach(function(group) {
        group.distance = calculatePurchaseNameDistance(aiKey, group.key);
        group.score = 1 - group.distance / Math.max(aiKey.length, group.key.length);
        group.latestItem = getLatestPurchaseHistoryItem(group.items);
        if (group.latestItem) group.name = group.latestItem.name;
    });

    var exact = groups.find(function(group) { return group.distance === 0; });
    if (exact) return { item: exact.latestItem, items: exact.items, score: 1 };

    var near = groups.filter(function(group) {
        return group.distance === 1 && Math.min(aiKey.length, group.key.length) >= 3;
    });
    if (near.length === 1) return { item: near[0].latestItem, items: near[0].items, score: near[0].score };
    if (near.length > 1) return { ambiguous: true, candidates: near.map(function(group) { return group.name; }) };
    return null;
}

/**
 * 将唯一历史品名匹配自动规范化，并从最近采购记录回填账号配置中仍有效的区域/分类。
 * @param {Array<Object>} items AI 识别出的采购物品。
 * @returns {Array<Object>} 已应用唯一历史匹配的原数组。
 */
function addHistoryMatches(items) {
    var historyItems = getHistoryItems();
    var configuredSections = getPurchaseSections();
    items.forEach(function(item) {
        if (!item.name) return;
        item.aiHistoryReview = true;
        item.section = '';
        item.category = '';

        var match = matchHistoricalItem(item.name, historyItems);
        if (!match) return;
        if (match.ambiguous) {
            item.historyMatchAmbiguous = true;
            return;
        }

        var originalName = String(item.name);
        if (originalName !== match.item.name) item.originalName = originalName;
        item.name = match.item.name;

        // 最新一笔采购作为区域/分类来源，再核对值是否仍存在于当前账号配置。
        var historicalSection = normalizePurchaseSource(match.item.section, '');
        var configuredSection = historicalSection
            ? configuredSections.find(function(sectionName) {
                return normalizePurchaseSource(sectionName, '') === historicalSection;
            }) || ''
            : '';

        var historicalCategory = normalizePurchaseSource(match.item.category, '');
        var configuredCategory = historicalCategory
            ? (configuredSection ? getPurCats(configuredSection) : []).find(function(categoryName) {
                return normalizePurchaseSource(categoryName, '') === historicalCategory;
            }) || ''
            : '';
        // Area and category form one location choice; never partially apply an incomplete history row.
        var locationReady = !!configuredSection && !!configuredCategory;
        var section = locationReady ? configuredSection : '';
        var category = locationReady ? configuredCategory : '';
        if (section) item.section = section;
        if (category) item.category = category;
        item.historyMatch = {
            name: match.item.name,
            section: section,
            category: category,
            score: match.score,
            locationUnavailable: !!((historicalSection && !configuredSection) ||
                (historicalCategory && (!configuredSection || !configuredCategory))),
            locationIncomplete: !locationReady
        };
    });

    return items;
}

// 为 AI 识图结果显示名称匹配、历史回填和待核对状态。
function getMatchSuggestionHTML(item) {
    if (!item.aiHistoryReview) return '';
    var message = '';
    var detail = '';
    var statusClass = 'is-review';
    if (item.historyMatchAmbiguous) {
        message = '候选不唯一，请核对品名';
    } else if (item.historyMatch) {
        var nameCorrected = item.originalName && item.originalName !== item.name;
        var locationReady = !!item.section && !!item.category;
        if (!locationReady) {
            message = item.historyMatch.locationUnavailable ? '区域/分类需重选' : '需补区域/分类';
            detail = item.historyMatch.locationUnavailable
                ? '最近记录区域/分类不可用，请重新选择'
                : '最近记录缺区域/分类，请补选';
            statusClass += ' is-location-review';
        } else if (nameCorrected) {
            message = '名称已纠正';
            statusClass = 'is-success';
        } else if (locationReady) {
            message = '已匹配';
            statusClass = 'is-success';
        }
    } else if (!item.section || !item.category) {
        message = '未匹配，请核对品名';
    }
    if (!message) return '';
    var detailAttribute = detail ? ' title="' + axEscapeHtml(detail) + '" aria-label="' + axEscapeHtml(detail) + '"' : '';
    return '<div class="pm-ai-suggestion ' + statusClass + '"' + detailAttribute + '>' + axEscapeHtml(message) + '</div>';
}

/**
 * 规范化供应商来源；空值时回退到调用方提供的当前采购来源。
 * @param {unknown} source AI 或表单提供的来源。
 * @param {unknown} fallback 空来源时使用的回退来源。
 * @returns {string} 去除首尾空白后的来源。
 */
function normalizePurchaseSource(source, fallback) {
    var value = String(source == null ? '' : source).replace(/\s+/g, ' ').trim();
    return value || String(fallback == null ? '' : fallback).replace(/\s+/g, ' ').trim();
}

/**
 * 将识别来源映射到唯一且足够具体的账号已配置来源。
 * @param {unknown} source 识别到的供应商文本。
 * @param {Array<string>} configuredSources 当前账号来源配置。
 * @returns {{source: string, status: string, candidates: Array<string>}} 映射结果与候选状态。
 */
function matchConfiguredPurchaseSource(source, configuredSources) {
    var normalized = normalizePurchaseSource(source, '');
    if (!normalized) return { source: '', status: 'empty', candidates: [] };

    function key(value) { return normalizePurchaseSource(value, '').toLowerCase().replace(/\s+/g, ''); }
    function isSpecific(value) {
        var compact = key(value);
        var core = compact.replace(/(有限责任公司|股份有限公司|有限公司|集团|公司)$/g, '');
        var generic = ['外购', '内购', '采购', '其他', '其它', '供应商', '未知', '商贸', '贸易'];
        return core.length >= 3 && generic.indexOf(core) < 0;
    }

    var sourceKey = key(normalized);
    var configured = (configuredSources || []).map(function(value) {
        return normalizePurchaseSource(value, '');
    }).filter(function(value, index, list) {
        return value && list.findIndex(function(candidate) { return key(candidate) === key(value); }) === index;
    });
    var exact = configured.filter(function(value) { return key(value) === sourceKey; });
    if (exact.length === 1) return { source: exact[0], status: 'exact', candidates: exact };
    if (exact.length > 1) return { source: '', status: 'ambiguous', candidates: exact };

    var aliases = configured.filter(function(value) {
        var configuredKey = key(value);
        return isSpecific(value) && configuredKey.length < sourceKey.length && sourceKey.indexOf(configuredKey) >= 0;
    });
    if (aliases.length === 1) return { source: aliases[0], status: 'alias', candidates: aliases };
    if (aliases.length > 1) return { source: '', status: 'ambiguous', candidates: aliases };
    return { source: '', status: 'unmatched', candidates: [] };
}

/**
 * 确保来源可在当前采购表单选择；未配置来源只创建本次页面的临时选项。
 * @param {HTMLSelectElement} select 来源下拉。
 * @param {string} source 来源名称。
 * @returns {boolean} 来源有效且存在或已插入时返回 true。
 */
function ensurePurchaseSourceOption(select, source) {
    source = normalizePurchaseSource(source, '');
    if (!select || !source) return false;
    for (var i = 0; i < select.options.length; i++) {
        if (select.options[i].value === source) return true;
    }
    var option = document.createElement('option');
    option.value = source;
    option.textContent = source;
    option.setAttribute('data-ai-temporary', 'true');
    select.appendChild(option);
    return true;
}

/**
 * 将已填写的聊天补全地址转换为 OpenAI 兼容的模型列表地址。
 * @param {string} endpoint API 地址。
 * @returns {string} 模型列表地址；空输入返回空字符串。
 */
function getMimoModelsEndpoint(endpoint) {
    var value = String(endpoint || '').trim().replace(/\/+$/, '');
    if (/\/models$/i.test(value)) return value;
    if (/\/chat\/completions$/i.test(value)) return value.replace(/\/chat\/completions$/i, '/models');
    return value ? value + '/models' : '';
}

/**
 * 使用当前设置中的 API Key 加载模型候选；请求失败时不改当前输入模型。
 * @returns {void}
 */
function loadMimoModels() {
    var endpointInput = document.getElementById('mimoEndpoint');
    var keyInput = document.getElementById('mimoKey');
    var select = document.getElementById('mimoModel');
    var list = document.getElementById('mimoModelOptions');
    var status = document.getElementById('mimoModelStatus');
    var endpoint = getMimoModelsEndpoint(endpointInput && endpointInput.value);
    var key = keyInput && keyInput.value.trim();
    /** Updates the visible model-loading status without including request credentials. */
    function report(message) { if (status) status.textContent = message; }
    if (!endpoint || !key || !select || !list) { report('请先填写 API 地址和 API Key'); return; }
    report('正在加载模型…');
    var xhr = new XMLHttpRequest();
    xhr.open('GET', endpoint, true);
    xhr.setRequestHeader('Authorization', 'Bearer ' + key);
    xhr.timeout = 15000;
    xhr.onload = function() {
        if (xhr.status < 200 || xhr.status >= 300) { report('加载失败（HTTP ' + xhr.status + '），仍可使用当前模型'); return; }
        try {
            var response = JSON.parse(xhr.responseText);
            var models = Array.isArray(response.data) ? response.data.map(function(model) { return String(model && model.id || '').trim(); }).filter(Boolean) : [];
            models = Array.from(new Set(models)).sort();
            // 把已保存/手工输入模型保留在候选首位，再追加已去重排序的 API 结果。
            var current = select.value.trim() || (localStorage.getItem('ax_mimo_model') || '').trim();
            // 空列表响应不清空此前候选；有返回时才用当前结果刷新列表。
            var previous = Array.from(list.options || []).map(function(option) { return String(option.value || '').trim(); });
            var options = Array.from(new Set([current].concat(models.length ? models : previous).filter(Boolean)));
            list.innerHTML = '';
            options.forEach(function(model) { var option = document.createElement('option'); option.value = model; list.appendChild(option); });
            select.value = current;
            report(models.length ? '已加载 ' + models.length + ' 个模型' : '接口未返回模型，仍可手动填写');
        } catch (error) { report('模型列表格式无法识别，仍可使用当前模型'); }
    };
    xhr.onerror = function() { report('加载失败（网络或跨域限制），仍可使用当前模型'); };
    xhr.ontimeout = function() { report('加载超时，仍可使用当前模型'); };
    xhr.send();
}


// ========== 通用月份切换功能 ==========

// 通用的月份导航函数
function calendarNav(dir, currentYM, pickerId, renderCallback) {
    var parts = currentYM.split('-').map(Number);
    parts[1] += dir;
    if (parts[1] < 1) { parts[0]--; parts[1] = 12; }
    if (parts[1] > 12) { parts[0]++; parts[1] = 1; }
    var newYm = parts[0] + '-' + String(parts[1]).padStart(2, '0');
    
    var picker = document.getElementById(pickerId);
    if (picker) picker.value = newYm;
    
    if (typeof renderCallback === 'function') {
        renderCallback(newYm);
    }
    
    return newYm;
}

// 通用的月份选择函数
function calendarPickYM(val, renderCallback) {
    if (!val) return;
    if (typeof renderCallback === 'function') {
        renderCallback(val);
    }
}

