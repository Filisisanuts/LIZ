var $id=function(id){return document.getElementById(id)};

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
function toast(m){var t=$id('toast');t.textContent=m;t.classList.add('show');setTimeout(function(){t.classList.remove('show')},2200)}

// 弹窗
function showModal(content, width) {
    var m = $id('modal'), o = $id('overlay');
    m.innerHTML = content;
    m.style.maxWidth = (width || 560) + 'px';
    m.classList.add('show', 'modal-enter');
    o.classList.add('show');
    m.style.position = 'fixed';
    m.style.overflowY = 'auto';
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
        e.stopPropagation();
    };
}

function closeModal() {
    var m = $id('modal'), o = $id('overlay');
    if (m) {
        m.classList.add('modal-exit');
        setTimeout(function() {
            m.classList.remove('show', 'modal-exit');
        }, 200);
    }
    if (o) {
        o.classList.remove('show');
        o.onclick = null;
    }
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

// 获取自定义标签列表
function getFreeLabels(){
    var d=['流水','实收业绩','厨房业绩','吧台业绩','折扣','香烟','其他收入','智能POS','建行生活','现金','会员卡','招待','美团团购','抖音团购','应收账款','美团外卖','淘宝闪购','京东外卖','外卖合计','人数','人均消费','500+包厢数'];
    try{var s=JSON.parse(localStorage.getItem('ax_fl')||'[]');s.forEach(function(l){if(d.indexOf(l)<0)d.push(l)})}catch(e){}
    return d;
}
function saveFL(l){try{var s=JSON.parse(localStorage.getItem('ax_fl')||'[]');if(s.indexOf(l)<0){s.push(l);localStorage.setItem('ax_fl',JSON.stringify(s))}}catch(e){}}

// 图片压缩
function processImage(file,mw,cb){var reader=new FileReader();reader.onload=function(e){var img=new Image();img.onload=function(){var c=document.createElement('canvas');var w=img.width,h=img.height;if(w>mw){h=h*mw/w;w=mw}c.width=w;c.height=h;c.getContext('2d').drawImage(img,0,0,w,h);cb(c.toDataURL('image/jpeg',.85))};img.src=e.target.result};reader.readAsDataURL(file)}
function handleExpPhoto(e){var f=e.target.files[0];if(!f)return;processImage(f,800,function(d){_expPhotoData=d;toast('已选择照片')})}
function handleDmgPhoto(e){var f=e.target.files[0];if(!f)return;processImage(f,800,function(d){_dmgPhotoData=d;toast('已选择照片')})}

// ---- AI加载动画（供采购单识别使用）----
function showAILoading(){
    if($id('aiLoadingOverlay'))return;
    var el=document.createElement('div');el.id='aiLoadingOverlay';
    el.style.cssText='position:fixed;bottom:20px;right:20px;background:var(--card);border:1px solid var(--bd);border-radius:10px;padding:12px 16px;z-index:9999;display:flex;align-items:center;gap:10px;box-shadow:0 4px 16px rgba(0,0,0,.2)';
    el.innerHTML='<div style="width:18px;height:18px;border:2px solid var(--bd);border-top-color:var(--ac);border-radius:50%;animation:aiSpin .8s linear infinite;flex-shrink:0"></div><div><div style="font-size:.78rem;font-weight:600;color:var(--tx)">MiMo 识别中</div><div id="aiLoadingTimer" style="font-size:.65rem;color:var(--tx-m)">0秒</div></div>';
    document.body.appendChild(el);
    window._aiStartTime=Date.now();
    window._aiTimerInterval=setInterval(function(){var el2=$id('aiLoadingTimer');if(el2)el2.textContent=Math.floor((Date.now()-window._aiStartTime)/1000)+'秒'},1000);
}
function hideAILoading(){
    if(window._aiTimerInterval){clearInterval(window._aiTimerInterval);window._aiTimerInterval=null}
    var el=$id('aiLoadingOverlay');if(!el)return;
    var elapsed=Math.floor((Date.now()-(window._aiStartTime||Date.now()))/1000);
    el.innerHTML='<div style="width:18px;height:18px;border-radius:50%;background:var(--gn);display:flex;align-items:center;justify-content:center;font-size:10px;color:#fff;flex-shrink:0">✓</div><div><div style="font-size:.78rem;font-weight:600;color:var(--gn)">识别完成</div><div style="font-size:.65rem;color:var(--tx-m)">耗时'+elapsed+'秒</div></div>';
    setTimeout(function(){var e=$id('aiLoadingOverlay');if(e)e.remove()},2000);
}

// ---- AI拍照识别（采购单，统一入口）----
function doAIParse(){
    if(!localStorage.getItem('ax_mimo_key')){toast('请先在设置页配置MiMo API');return}
    var input=document.createElement('input');input.type='file';input.accept='image/*';input.capture='environment';
    input.onchange=function(e){
        var file=e.target.files[0];if(!file)return;
        var reader=new FileReader();reader.onload=function(ev){
            var img=new Image();img.onload=function(){
                var canvas=document.createElement('canvas');var maxW=window.innerWidth<600?1000:1600;
                var w=img.width,h=img.height;if(w>maxW){h=Math.round(h*maxW/w);w=maxW}
                canvas.width=w;canvas.height=h;canvas.getContext('2d').drawImage(img,0,0,w,h);
                var quality=window.innerWidth<600?.6:.85;var base64=canvas.toDataURL('image/jpeg',quality).split(',')[1];
                var prompt='请识别这张采购单/出库单图片，提取所有商品信息。图片中会标注区域信息（如厨房、吧台、外场），请将每个商品对应的区域填入section字段。请严格按以下JSON格式返回：\n\n{"date":"YYYY-MM-DD","source":"供应商名称","items":[{"name":"商品名称","qty":数字,"unit":"单位","unitPrice":单价,"total":金额,"section":"区域"}]}\n\n区域只能是：厨房、吧台、外场。无法判断则留空。只返回JSON。';
                var body={model:localStorage.getItem('ax_mimo_model')||'mimo-v2.5',messages:[{role:'user',content:[{type:'text',text:prompt},{type:'image_url',image_url:{url:'data:image/jpeg;base64,'+base64}}]}],max_tokens:4096,temperature:.1};
                var h2='<div style="text-align:center;padding:10px"><div style="font-size:.88rem;font-weight:700;margin-bottom:8px">确认识别这张图片？</div><div class="brow"><button class="btn p" onclick="doAIParseGo()">确认识别</button> <button class="btn" onclick="closeModal()">取消</button></div></div>';
                showModal(h2,400);
                window._pendingMimoBody=body;window._pendingMimoEp=localStorage.getItem('ax_mimo_ep');window._pendingMimoKey=localStorage.getItem('ax_mimo_key');
            };img.src=ev.target.result;
        };reader.readAsDataURL(file);
    };input.click();
}
function doAIParseGo(){
    closeModal();showAILoading();
    var body=window._pendingMimoBody,ep=window._pendingMimoEp,key=window._pendingMimoKey;
    var xhr=new XMLHttpRequest();xhr.open('POST',ep,true);
    xhr.setRequestHeader('Content-Type','application/json');xhr.setRequestHeader('Authorization','Bearer '+key);xhr.timeout=120000;
    xhr.onload=function(){
        hideAILoading();
        try{
            var data=JSON.parse(xhr.responseText);var reply='';
            if(data.choices&&data.choices[0])reply=data.choices[0].message.content||'';
            if(!reply){toast('AI返回为空');return}
            var m=reply.match(/\{[\s\S]*\}/);if(!m){toast('AI未返回JSON');return}
            var result=JSON.parse(m[0]);if(!result.items||!result.items.length){toast('未识别到商品');return}
            if(!result.date)result.date=td();var src=result.source||'岸香贸易';
            if(/岸香.*贸易|贸易.*岸香/.test(src))src='岸香贸易';else if(!src)src='岸香贸易';
            var items=[];result.items.forEach(function(item){
                var qty=parseFloat(item.qty)||0,total=parseFloat(item.total)||0,unitPrice=parseFloat(item.unitPrice)||0;
                if(!unitPrice&&total>0&&qty>0)unitPrice=Math.round(total/qty*100)/100;
                if(qty>0&&total>0)items.push({name:item.name||'',section:item.section||'',category:'',qty:qty,unit:item.unit||'',unitPrice:unitPrice,total:total,source:src});
            });
            if(!items.length){toast('解析结果为空');return}
            // 添加历史匹配
            items = addHistoryMatches(items);
            _pmItems=items.slice();goPage('purchase');
            setTimeout(function(){switchPT('manual');if(result.date&&$id('pmDate'))$id('pmDate').value=result.date;if($id('pmSrc')){for(var i=0;i<$id('pmSrc').options.length;i++){if($id('pmSrc').options[i].value==src){$id('pmSrc').selectedIndex=i;break}}}renderPML();toast('已识别 '+items.length+' 项物品')},200);
        }catch(e){toast('解析失败');console.error(e)}
    };
    xhr.onerror=function(){hideAILoading();toast('请求失败')};xhr.ontimeout=function(){hideAILoading();toast('请求超时')};
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
function initDatePicker(){if(document.getElementById('datePicker'))return;var div=document.createElement('div');div.id='datePicker';div.className='date-picker';div.style.display='none';div.innerHTML='<div id="dpBody"></div>';document.body.appendChild(div)}
initDatePicker();





// ========== 历史匹配功能 ==========

// 获取历史采购物品
function getHistoryItems() {
    var items = [];
    DB.purchases.forEach(function(p) {
        (p.items || []).forEach(function(item) {
            if (item.name && item.unitPrice > 0) {
                items.push({
                    name: item.name,
                    section: item.section || '',
                    category: item.category || '',
                    source: item.source || p.source || '外购',
                    unitPrice: item.unitPrice,
                    unit: item.unit || ''
                });
            }
        });
    });
    return items;
}

// 计算字符串相似度（Jaccard系数）
function calculateSimilarity(str1, str2) {
    str1 = str1.toLowerCase().replace(/\s+/g, '');
    str2 = str2.toLowerCase().replace(/\s+/g, '');
    
    if (str1 === str2) return 1;
    if (str1.length === 0 || str2.length === 0) return 0;
    
    var set1 = new Set(str1.split(''));
    var set2 = new Set(str2.split(''));
    
    var intersection = 0;
    set1.forEach(function(char) {
        if (set2.has(char)) intersection++;
    });
    
    var union = set1.size + set2.size - intersection;
    return intersection / union;
}

// 匹配历史物品
function matchHistoricalItem(aiName, historyItems, threshold) {
    threshold = threshold || 0.8;
    var bestMatch = null;
    var bestScore = 0;
    
    historyItems.forEach(function(item) {
        var score = calculateSimilarity(aiName, item.name);
        if (score > bestScore && score >= threshold) {
            bestScore = score;
            bestMatch = item;
        }
    });
    
    return bestMatch ? { item: bestMatch, score: bestScore } : null;
}

// 为AI识别的物品添加历史匹配
function addHistoryMatches(items) {
    var historyItems = getHistoryItems();
    
    items.forEach(function(item) {
        if (!item.name) return;
        
        var match = matchHistoricalItem(item.name, historyItems);
        if (match) {
            item.historyMatch = {
                name: match.item.name,
                section: match.item.section,
                category: match.item.category,
                source: match.item.source,
                unitPrice: match.item.unitPrice,
                score: match.score
            };
            
            if (match.score >= 0.8) {
                item.originalName = item.name;
                item.name = match.item.name;
            }
            
            if (match.item.section && !item.section) {
                item.section = match.item.section;
            }
            if (match.item.category && !item.category) {
                item.category = match.item.category;
            }
        }
    });
    
    return items;
}

// 获取匹配建议的HTML
function getMatchSuggestionHTML(item) {
    if (!item.historyMatch) return '';
    
    var match = item.historyMatch;
    var scorePercent = Math.round(match.score * 100);
    
    if (item.originalName && item.originalName !== item.name) {
        return '<div style="font-size:.6rem;color:var(--gn);margin-top:2px;background:var(--gn-b);padding:2px 6px;border-radius:3px;display:inline-block">✓ 匹配: ' + item.name + ' (' + scorePercent + '%)</div>';
    }
    
    return '<div style="font-size:.6rem;color:var(--tx-m);margin-top:2px">匹配历史: ' + match.name + ' (' + scorePercent + '%)</div>';
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

