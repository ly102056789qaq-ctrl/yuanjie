/* 源界 · 角色编辑器：编辑 data/characters.json 的本机草稿，导出给小惟发布 */
(async function(){
const $=s=>document.querySelector(s),E=YJ.esc,L=YJ.locked;
let D,S,cur=0,saveT,pvT,dirty=false;
YJ.useDraft=true;
const st=t=>{$('#status').textContent=t};
const draft=localStorage.getItem(YJ.DRAFT_KEY);
if(draft){try{D=JSON.parse(draft);dirty=true}catch(e){}}
if(!D){D=await YJ.load({draft:false})}
S=D.settings;
const C=()=>D.characters;
st(dirty?'本机草稿 · 已载入':'线上数据 · 尚未修改');

/* ---------- 路径读写 ---------- */
const get=(o,p)=>p.split('.').reduce((a,k)=>a==null?a:a[k],o);
function set(o,p,v){const ks=p.split('.');let a=o;for(let i=0;i<ks.length-1;i++){if(a[ks[i]]==null)a[ks[i]]=/^\d+$/.test(ks[i+1])?[]:{};a=a[ks[i]]}a[ks.at(-1)]=v}
function save(){dirty=true;clearTimeout(saveT);saveT=setTimeout(()=>{localStorage.setItem(YJ.DRAFT_KEY,JSON.stringify(D));const t=new Date();st(`本机草稿 · 已自动保存 ${String(t.getHours()).padStart(2,'0')}:${String(t.getMinutes()).padStart(2,'0')}:${String(t.getSeconds()).padStart(2,'0')}`);refreshPv()},300)}
function saveNow(){localStorage.setItem(YJ.DRAFT_KEY,JSON.stringify(D));dirty=true}

/* ---------- 列表 ---------- */
function renderList(){
  $('#cnt').textContent=C().length+' 人';
  $('#list').innerHTML=C().map((c,i)=>`<button type="button" class="it${i===cur?' on':''}" data-i="${i}"><b>${E(c.name||'(未命名)')}</b><small>${E((S.groups.find(g=>g.id===c.group)||{}).name||'')}</small>${c.portrait&&c.portrait.src?'<i title="有立绘">●</i>':''}</button>`).join('')}
$('#list').addEventListener('click',e=>{const b=e.target.closest('.it');if(!b)return;cur=+b.dataset.i;renderList();renderForm();refreshPv(true)});

/* ---------- 表单组件 ---------- */
const F={
 text:(k,lab,ph='',w='')=>`<label class="f ${w}"><span>${lab}</span><input type="text" data-k="${k}" data-t="text" placeholder="${E(ph)}"></label>`,
 num:(k,lab,ph='留空 = 数据锁定',w='')=>`<label class="f ${w}"><span>${lab}</span><input type="text" inputmode="decimal" data-k="${k}" data-t="num" placeholder="${E(ph)}"></label>`,
 area:(k,lab,ph='',rows=3,w='w')=>`<label class="f ${w}"><span>${lab}</span><textarea rows="${rows}" data-k="${k}" data-t="text" placeholder="${E(ph)}"></textarea></label>`,
 lines:(k,lab,ph='',rows=3)=>`<label class="f w"><span>${lab}</span><textarea rows="${rows}" data-k="${k}" data-t="lines" placeholder="${E(ph)}"></textarea></label>`,
 sel:(k,lab,opts,w='')=>`<label class="f ${w}"><span>${lab}</span><select data-k="${k}" data-t="sel">${opts.map(([v,t])=>`<option value="${E(v)}">${E(t)}</option>`).join('')}</select></label>`,
 chk:(k,lab)=>`<label class="ck"><input type="checkbox" data-k="${k}" data-t="chk"><span>${lab}</span></label>`
};
const sec=(id,t,en,body,open=true)=>`<details class="sec" id="s-${id}" ${open?'open':''}><summary><b>${t}</b><small>${en}</small></summary><div class="sb">${body}</div></details>`;

/* 频谱结构补齐（旧版数组原型会被替换为新结构） */
const spSlot=()=>({name:null,icon:null,banner:null,level:null,max:null,plus:null,stars:null,set:null,locked:false,main:{label:null,value:null,icon:null},subs:[0,1,2,3].map(()=>({label:null,value:null,icon:null}))});
const spInv=()=>({name:null,pos:null,icon:null,plus:null,stars:null,set:null,main:{label:null,value:null,icon:null}});
function spNorm(sp){if(!sp||Array.isArray(sp))sp={};sp.set=sp.set||{name:null,max:null,icon:null,bonuses:[]};sp.set.bonuses=sp.set.bonuses||[];
  [2,4].forEach((n,i)=>{if(!sp.set.bonuses[i])sp.set.bonuses[i]={n,desc:null}});
  sp.slots=sp.slots||[];const N=S.spectrumSlots||6;for(let i=0;i<N;i++){sp.slots[i]=sp.slots[i]||spSlot();const x=sp.slots[i];x.main=x.main||{label:null,value:null,icon:null};x.subs=x.subs||[];while(x.subs.length<4)x.subs.push({label:null,value:null,icon:null})}
  sp.inventory=sp.inventory||[];while(sp.inventory.length<4)sp.inventory.push(spInv());sp.inventory.forEach(x=>{x.main=x.main||{label:null,value:null,icon:null}});return sp}
const SPIC=[['','（无图标）'],['atk','攻击'],['hp','生命'],['def','防御'],['spd','速度'],['crit','暴击率'],['critdmg','暴击伤害'],['energy','充能']];
function renderForm(){
  const c=C()[cur];if(!c){$('#form').innerHTML='<p class="none">没有角色。点「新建角色」。</p>';return}
  /* 补齐结构 */
  c.stats=c.stats||{};c.level=c.level||{cur:null,max:null};c.skills=c.skills||[];c.potentials=c.potentials||[];c.module=c.module||{};c.module.level=c.module.level||{cur:null,max:null};c.module.stats=c.module.stats||[{key:'atk',value:null},{key:'hp',value:null},{key:'spd',value:null}];while(c.module.stats.length<3)c.module.stats.push({key:'atk',value:null});c.module.effect=c.module.effect||{name:null,level:null,desc:null,icon:null};c.spectrum=spNorm(c.spectrum);c.ascension=c.ascension||{};c.ascension.focus=c.ascension.focus||{x:null,y:null,w:null};c.ascension.shards=c.ascension.shards||[];for(let i=0;i<6;i++){c.ascension.shards[i]=c.ascension.shards[i]||{name:null,desc:null,quote:null,unlocked:null,art:null}};c.profile=c.profile||{rows:[],quotes:[],relations:[],locks:[]};c.portrait=c.portrait||{src:null};
  S.skillSlots.forEach((s,i)=>{if(!c.skills.find(x=>x.slot===s.slot))c.skills.push({slot:s.slot,name:null,desc:null,tags:[]})});
  c.skills.sort((a,b)=>S.skillSlots.findIndex(s=>s.slot===a.slot)-S.skillSlots.findIndex(s=>s.slot===b.slot));
  while(c.potentials.length<(S.potentialCount||6))c.potentials.push({name:null,desc:null,unlocked:false});
  c.skills.forEach(s=>{if(!s.params)s.params=[['倍率',null],['冷却',null],['消耗',null],['范围',null]]});
  const clsO=[['','未定（数据锁定）'],...S.classes.map(x=>[x.id,x.name])],elO=[['','未定（数据锁定）'],...S.elements.map(x=>[x.id,x.name])];
  const grO=S.groups.map(g=>[g.id,g.name]);
  const others=C().filter(x=>x!==c).map(x=>[x.id,x.name]);
  let h='';
  h+=sec('base','基本','BASIC',`<div class="g2">${F.text('name','名字','例：德可可')}${F.text('roman','罗马音 / 英文名','留空 = 未定','')}${F.sel('group','分组',grO)}${F.text('code','编号','例：CA-04（可留空）')}${F.text('role','身份一句话','保留在数据中（角色界面左侧已不显示）','w')}
    <label class="f"><span>ID（用于网址，只能小写字母数字和 -）</span><input type="text" data-k="id" data-t="id"></label>${F.text('page','完整档案页链接','例：char-xxx.html，可留空')}</div>`);
  h+=sec('ce','职业 · 元素 · 星级','CLASS / ELEMENT',`<div class="g3">${F.sel('cls','职业',clsO)}${F.sel('element','元素',elO)}${F.sel('stars','星级',[['','未定'],...Array.from({length:S.starMax||6},(_,i)=>[String(i+1),'★'.repeat(i+1)])])}</div><p class="tip">职业、元素的名称来自设定（六职业 · 十元素），这里只能选，不能新增。</p>`);
  h+=sec('lv','等级 · 属性','LEVEL / ATTRIBUTES',`<div class="g3">${F.num('level.cur','当前等级')}${F.num('level.max','等级上限')}</div><div class="g3">${S.stats.map(s=>F.num('stats.'+s.key,s.label+(s.unit?`（${s.unit}）`:''))).join('')}</div><p class="tip">留空的格子在页面上显示「— —」或「数据锁定」。测试数值请写清楚，比如在编号里注明“测试”。</p>`);
  h+=sec('sk','技能','SKILLS',c.skills.map((s,i)=>{const sl=S.skillSlots.find(x=>x.slot===s.slot)||{label:s.slot};return `<div class="sub"><h4>${E(sl.label)}</h4><div class="g2">${F.text(`skills.${i}.name`,'技能名','留空 = 数据锁定')}<label class="f"><span>标签（用逗号分隔）</span><input type="text" data-k="skills.${i}.tags" data-t="csv" placeholder="例：单体，多段"></label>
    ${F.area(`skills.${i}.desc`,'说明','留空 = 数据锁定',3)}${s.params.map((p,j)=>`<label class="f q"><span>${E(p[0])}</span><input type="text" data-k="skills.${i}.params.${j}.1" data-t="text" placeholder="— —"></label>`).join('')}</div></div>`}).join(''),false);
  h+=sec('pt','潜能','POTENTIAL',c.potentials.map((p,i)=>`<div class="row3"><b>${i+1}</b>${F.text(`potentials.${i}.name`,'名称','留空 = 数据锁定')}${F.text(`potentials.${i}.desc`,'效果','')}${F.chk(`potentials.${i}.unlocked`,'已解锁')}</div>`).join(''),false);
  h+=sec('md','模组','MODULE',`<p class="hint">版式依据模组设计图。留空的项目在页面上显示「数据锁定」。特性说明里用 ==文字== 标红。</p>
    <div class="g3">${F.text('module.name','模组名','留空 = 数据锁定')}${F.text('module.roman','拼音 / 英文小字','例：SIWEINUOMU')}${F.text('module.no','编号（左上大号）','例：01')}</div>
    <div class="g3">${F.sel('module.stars','星级',[['','未定'],['1','★'],['2','★★'],['3','★★★'],['4','★★★★'],['5','★★★★★'],['6','★★★★★★']])}${F.num('module.level.cur','当前等级')}${F.num('module.level.max','等级上限')}</div>
    ${F.text('module.art','模组立绘路径','例：assets/art/xxx.webp（透明 PNG/WebP）','w')}
    <h5>基础属性（3 格）</h5>${[0,1,2].map(i=>`<div class="g2">${F.sel(`module.stats.${i}.key`,'属性',S.stats.map(x=>[x.key,x.label]))}${F.text(`module.stats.${i}.value`,'数值','例：+608，留空 = — —')}</div>`).join('')}
    <h5>模组特性</h5><div class="g3">${F.text('module.effect.name','特性名','留空 = 数据锁定')}${F.num('module.effect.level','特性等级')}${F.text('module.effect.icon','特性图标路径','可留空')}</div>
    ${F.area('module.effect.desc','特性说明','用 ==文字== 标红，留空 = 数据锁定',4)}`,false);
  const N=S.spectrumSlots||6;
  h+=sec('sp','频谱','SPECTRUM',`<p class="hint">版式依据频谱设计图。留空 = 数据锁定。套装效果里用 ==文字== 标蓝。图标路径例：assets/spectrum/slot1.webp。</p>
    <div class="g3">${F.text('spectrum.set.name','套装名','例：终夜长楹')}${F.num('spectrum.set.max','套装件数上限','例：4')}${F.text('spectrum.code','卡片编号（右下）','例：SR-SP-0467')}</div>
    ${F.area('spectrum.intro','标题下说明','可换行',2)}${F.text('spectrum.set.icon','套装图标路径','可留空，留空用默认花纹','w')}
    ${c.spectrum.set.bonuses.map((b,i)=>`<div class="g2">${F.num(`spectrum.set.bonuses.${i}.n`,'件数')}${F.text(`spectrum.set.bonuses.${i}.desc`,'效果','例：攻击力提高==12%==。')}</div>`).join('')}
    ${Array.from({length:N},(_,i)=>`<div class="sub"><h4>槽位 ${String(i+1).padStart(2,'0')}</h4>
      <div class="g3">${F.text(`spectrum.slots.${i}.name`,'名称','留空 = 数据锁定')}${F.text(`spectrum.slots.${i}.set`,'所属套装','例：终夜长楹')}${F.chk(`spectrum.slots.${i}.locked`,'已上锁')}</div>
      <div class="g2">${F.text(`spectrum.slots.${i}.icon`,'方形插画路径')}${F.text(`spectrum.slots.${i}.banner`,'详情横幅路径','留空用方形插画')}</div>
      <div class="g3">${F.num(`spectrum.slots.${i}.level`,'等级')}${F.num(`spectrum.slots.${i}.max`,'等级上限')}${F.num(`spectrum.slots.${i}.plus`,'强化 +')}</div>
      <div class="g3">${F.sel(`spectrum.slots.${i}.stars`,'星级',[['','未定'],['1','★'],['2','★★'],['3','★★★'],['4','★★★★'],['5','★★★★★'],['6','★★★★★★']])}${F.text(`spectrum.slots.${i}.main.label`,'主属性','例：暴击伤害')}${F.text(`spectrum.slots.${i}.main.value`,'主属性数值','例：+24.0%')}</div>
      ${F.sel(`spectrum.slots.${i}.main.icon`,'主属性图标',SPIC)}
      ${[0,1,2,3].map(j=>`<div class="g3">${F.text(`spectrum.slots.${i}.subs.${j}.label`,`副属性 ${j+1}`)}${F.text(`spectrum.slots.${i}.subs.${j}.value`,'数值')}${F.sel(`spectrum.slots.${i}.subs.${j}.icon`,'图标',SPIC)}</div>`).join('')}</div>`).join('')}
    <h5>备选（更换界面里的其他条目）</h5>${c.spectrum.inventory.map((x,i)=>`<div class="sub"><h4>备选 ${i+1}</h4><div class="g3">${F.text(`spectrum.inventory.${i}.name`,'名称','留空 = 数据锁定')}${F.num(`spectrum.inventory.${i}.pos`,'位置（1–6）')}${F.text(`spectrum.inventory.${i}.set`,'所属套装')}</div>
      <div class="g3">${F.text(`spectrum.inventory.${i}.icon`,'插画路径')}${F.num(`spectrum.inventory.${i}.plus`,'强化 +')}${F.sel(`spectrum.inventory.${i}.stars`,'星级',[['','未定'],['1','★'],['2','★★'],['3','★★★'],['4','★★★★'],['5','★★★★★'],['6','★★★★★★']])}</div>
      <div class="g2">${F.text(`spectrum.inventory.${i}.main.label`,'主属性')}${F.text(`spectrum.inventory.${i}.main.value`,'主属性数值')}</div></div>`).join('')}`,false);
  h+=sec('as','升格','ASCENSION',`<p class="hint">原画会被切成六块玻璃碎片（I–VI）。留空 = 数据锁定。说明里用 ==文字== 标红；台词留空就不显示（例如 VI）。碎片图留空时，技能卡顶部自动截原画对应区域。</p>
    <div class="g3">${F.sel('ascension.stage','当前升格',[['','未定'],['0','0'],['1','1'],['2','2'],['3','3'],['4','4'],['5','5'],['6','6']])}${F.text('ascension.art','原画路径','例：assets/ascend/siwei-ascend.webp')}${F.num('ascension.focus.w','原画显示宽度','默认 1820')}</div>
    <div class="g2">${F.num('ascension.focus.x','脸部横向位置（0–1）','例：0.70')}${F.num('ascension.focus.y','脸部纵向位置（0–1）','例：0.27')}</div>
    ${c.ascension.shards.map((x,i)=>`<div class="sub"><h4>升格 ${['I','II','III','IV','V','VI'][i]}</h4>
      <div class="g3">${F.text(`ascension.shards.${i}.name`,'技能名','留空 = 数据锁定')}${F.sel(`ascension.shards.${i}.unlocked`,'解锁状态',[['','按当前升格'],['true','已解锁'],['false','未解锁']])}${F.text(`ascension.shards.${i}.art`,'碎片图路径','可留空')}</div>
      ${F.area(`ascension.shards.${i}.desc`,'技能说明','数字可用 ==20%== 标红',3)}
      ${F.text(`ascension.shards.${i}.quote`,'台词 / 引言','不用加「」，留空不显示','w')}</div>`).join('')}`,false);
  const rows=(c.profile.rows||[]).map((r,i)=>`<div class="kv"><input type="text" data-k="profile.rows.${i}.0" data-t="text" placeholder="条目"><textarea rows="2" data-k="profile.rows.${i}.1" data-t="text" placeholder="内容"></textarea><button type="button" class="x" data-del="profile.rows" data-i="${i}">✕</button></div>`).join('');
  const rels=(c.profile.relations||[]).map((r,i)=>`<div class="kv rl"><select data-k="profile.relations.${i}.id" data-t="sel">${others.map(([v,t])=>`<option value="${E(v)}">${E(t)}</option>`).join('')}</select><input type="text" data-k="profile.relations.${i}.label" data-t="text" placeholder="关系"><input type="text" data-k="profile.relations.${i}.desc" data-t="text" placeholder="说明"><button type="button" class="x" data-del="profile.relations" data-i="${i}">✕</button></div>`).join('');
  h+=sec('ar','档案','ARCHIVE',`<h5>档案条目</h5>${rows}<button type="button" class="add" data-add="profile.rows">＋ 添加条目</button>
    ${F.lines('profile.quotes','台词（一行一句）','',3)}
    <h5>关系</h5>${rels}<button type="button" class="add" data-add="profile.relations">＋ 添加关系</button>
    ${F.lines('profile.locks','未定事项（一行一条，显示为锁定标签）','',2)}`,false);
  const p=c.portrait;
  h+=sec('pt2','立绘','PORTRAIT',`<div class="drop" id="drop"><input type="file" id="fArt" accept="image/*" hidden><b>${p.src?'换一张立绘':'上传立绘'}</b><span>点这里选图，或把图片拖进来。透明底 PNG 效果最好；普通图会自动识别人物并淡出背景。</span></div>
    <div class="pinfo">${p.src?`<code>${E(p.src)}</code>`:'<span class="none">还没有立绘</span>'}${p.bbox?`<span>识别：${p.alpha?'透明通道':'背景差异'} · ${p.mode==='half'?'半身':p.mode==='full'?'全身':'自动'} · 脸部${p.face&&p.face.by==='detector'?'（人脸检测）':p.face&&p.face.by==='skin'?'（肤色定位）':'（按比例估算）'}</span>`:''}</div>
    <div class="pbtn"><button type="button" data-pa="auto">重新自动识别</button><button type="button" data-pa="full">全身构图</button><button type="button" data-pa="half">半身构图</button><button type="button" data-pa="rm" class="ghost">移除立绘</button></div>
    <div class="g3">${F.num('portrait.crop.zoom','缩放（图高 ÷ 画面高）','1')}${F.num('portrait.crop.x','焦点 X（0–1）','0.5')}${F.num('portrait.crop.y','焦点 Y（0–1）','0.5')}</div>
    <div class="g3">${F.chk('portrait.fade','边缘淡出（非透明图建议开）')}<label class="f"><span>淡出宽度</span><input type="range" min="0" max="20" step="1" data-k="portrait.feather" data-t="num"></label></div>
    <p class="tip">右边「立绘裁切」框里可以直接拖动、滚轮缩放；数值会自动写回这里。</p>`,true);
  $('#form').innerHTML=h;
  fill();bindArt();drawCrop()}
function fill(){const c=C()[cur];
  document.querySelectorAll('#form [data-k]').forEach(el=>{let v=get(c,el.dataset.k);const t=el.dataset.t;
    if(t==='chk')el.checked=el.dataset.k==='portrait.fade'?(v??!c.portrait.alpha):!!v;
    else if(t==='lines')el.value=(v||[]).join('\n');else if(t==='csv')el.value=(v||[]).join('，');
    else if(el.type==='range')el.value=v??6;
    else el.value=v==null?'':String(v)})}
$('#form').addEventListener('input',e=>{const el=e.target.closest('[data-k]');if(!el)return;const c=C()[cur];const k=el.dataset.k,t=el.dataset.t;let v;
  if(t==='chk')v=el.checked;else if(t==='lines')v=el.value.split('\n').map(x=>x.trim()).filter(Boolean);else if(t==='csv')v=el.value.split(/[,，、]/).map(x=>x.trim()).filter(Boolean);
  else if(t==='num'){v=el.value.trim()===''?null:(isNaN(+el.value)?el.value.trim():+el.value)}
  else if(t==='id'){v=el.value.trim().toLowerCase().replace(/[^a-z0-9-]/g,'');if(!v||C().some((x,i)=>i!==cur&&x.id===v)){el.classList.add('bad');return}el.classList.remove('bad')}
  else if(t==='sel'){v=el.value===''?null:el.value;if(/^ascension\.shards\.\d+\.unlocked$/.test(k))v=v===null?null:v==='true';if(k==='stars'||k==='ascension.stage'||k==='module.stars'||/^spectrum\.(slots|inventory)\.\d+\.stars$/.test(k))v=v===null?null:+v}
  else v=el.value===''?null:el.value;
  if(k.startsWith('portrait.crop')&&!c.portrait.crop)c.portrait.crop={x:.5,y:.5,zoom:1};
  set(c,k,v);if(k==='name'||k==='group')renderList();if(k.startsWith('portrait'))drawCrop();save()});
$('#form').addEventListener('click',e=>{const c=C()[cur];
  const a=e.target.closest('[data-add]');if(a){const arr=get(c,a.dataset.add)||[];arr.push(a.dataset.add==='profile.rows'?['','']:{id:(C().find(x=>x!==c)||{}).id,label:'',desc:''});set(c,a.dataset.add,arr);keepOpen(renderForm);save();return}
  const d=e.target.closest('[data-del]');if(d){get(c,d.dataset.del).splice(+d.dataset.i,1);keepOpen(renderForm);save();return}
  const pa=e.target.closest('[data-pa]');if(pa){portraitAction(pa.dataset.pa)}});
function keepOpen(fn){const open=[...document.querySelectorAll('details.sec[open]')].map(d=>d.id);const y=$('#form').scrollTop;fn();document.querySelectorAll('details.sec').forEach(d=>d.open=open.includes(d.id));$('#form').scrollTop=y}

/* ---------- 立绘 ---------- */
async function loadImg(src){const url=await YJ.src(src);const im=new Image();im.src=url;await im.decode();return im}
async function normalize(file){/* 太大的图转成 webp，避免发布时超限；保留透明 */
  const url=URL.createObjectURL(file);const im=new Image();im.src=url;await im.decode();
  const maxH=2600;if(file.size<=3e6&&im.naturalHeight<=maxH&&im.naturalWidth<=4000)return {blob:file,ext:(file.name.split('.').pop()||'png').toLowerCase()};
  const k=Math.min(1,maxH/im.naturalHeight,4000/im.naturalWidth);const cv=document.createElement('canvas');cv.width=Math.round(im.naturalWidth*k);cv.height=Math.round(im.naturalHeight*k);
  cv.getContext('2d').drawImage(im,0,0,cv.width,cv.height);
  for(const q of [.9,.82,.74]){const b=await new Promise(r=>cv.toBlob(r,'image/webp',q));if(b.size<3e6)return {blob:b,ext:'webp'}}
  return {blob:await new Promise(r=>cv.toBlob(r,'image/webp',.66)),ext:'webp'}}
async function setArt(file){const c=C()[cur];st('处理图片中…');
  const {blob,ext}=await normalize(file);const path=`assets/portraits/${c.id}-${Date.now().toString(36)}.${ext}`;
  const old=c.portrait&&c.portrait.src;if(old&&old.startsWith('assets/portraits/'))YJ.delFile(old).catch(()=>{});
  await YJ.putFile(path,blob);c.portrait={src:path,mode:'auto'};await autoArt(c,'auto');saveNow();renderList();keepOpen(renderForm);refreshPv(true);st('立绘已识别 · 草稿已保存')}
async function autoArt(c,mode){const im=await loadImg(c.portrait.src);const det=await YJ.detect(im);const m=mode==='auto'?det.mode:mode;
  Object.assign(c.portrait,{mode:m,bbox:det.bbox,face:det.face,alpha:det.alpha,fade:!det.alpha,feather:c.portrait.feather??6,crop:YJ.computeCrop(det,m,im.naturalWidth/im.naturalHeight)})}
async function portraitAction(a){const c=C()[cur];
  if(a==='rm'){if(!confirm('移除这张立绘？'))return;const old=c.portrait.src;if(old&&old.startsWith('assets/portraits/'))YJ.delFile(old).catch(()=>{});c.portrait={src:null,mode:'auto'};}
  else{if(!c.portrait.src)return;await autoArt(c,a)}
  save();renderList();keepOpen(renderForm)}
function bindArt(){const dz=$('#drop'),fi=$('#fArt');if(!dz)return;
  dz.addEventListener('click',()=>fi.click());fi.addEventListener('change',()=>fi.files[0]&&setArt(fi.files[0]));
  dz.addEventListener('dragover',e=>{e.preventDefault();dz.classList.add('ov')});dz.addEventListener('dragleave',()=>dz.classList.remove('ov'));
  dz.addEventListener('drop',e=>{e.preventDefault();dz.classList.remove('ov');const f=e.dataTransfer.files[0];if(f&&f.type.startsWith('image/'))setArt(f)})}
const cimg=$('#cimg'),cbox=$('#cbox');
async function drawCrop(){const c=C()[cur];const p=c&&c.portrait;
  if(!p||!p.src){cimg.hidden=true;$('#cbb').hidden=$('#cfc').hidden=true;$('#cempty').hidden=false;return}
  $('#cempty').hidden=true;cimg.hidden=false;const url=await YJ.src(p.src);
  const go=()=>{YJ.place(cimg,p,cbox);const l=parseFloat(cimg.style.left),t=parseFloat(cimg.style.top),w=parseFloat(cimg.style.width),h=parseFloat(cimg.style.height);
    if(p.bbox){const b=$('#cbb');b.hidden=false;Object.assign(b.style,{left:l+p.bbox[0]*w+'px',top:t+p.bbox[1]*h+'px',width:(p.bbox[2]-p.bbox[0])*w+'px',height:(p.bbox[3]-p.bbox[1])*h+'px'})}
    if(p.face){const f=$('#cfc');f.hidden=false;Object.assign(f.style,{left:l+p.face.x*w+'px',top:t+p.face.y*h+'px'})}};
  if(cimg.dataset.src===url&&cimg.complete){go()}else{cimg.onload=go;cimg.dataset.src=url;cimg.src=url}}
let drag=null;
cbox.addEventListener('pointerdown',e=>{const c=C()[cur];if(!c||!c.portrait.src||!c.portrait.crop)return;drag={x:e.clientX,y:e.clientY,c0:{...c.portrait.crop}};cbox.setPointerCapture(e.pointerId)});
cbox.addEventListener('pointermove',e=>{if(!drag)return;const c=C()[cur];const w=parseFloat(cimg.style.width),h=parseFloat(cimg.style.height);
  c.portrait.crop.x=+(drag.c0.x-(e.clientX-drag.x)/w).toFixed(4);c.portrait.crop.y=+(drag.c0.y-(e.clientY-drag.y)/h).toFixed(4);drawCrop()});
cbox.addEventListener('pointerup',()=>{if(!drag)return;drag=null;fill();save()});
cbox.addEventListener('wheel',e=>{const c=C()[cur];if(!c||!c.portrait.crop)return;e.preventDefault();c.portrait.crop.zoom=+Math.max(.2,Math.min(6,c.portrait.crop.zoom*(1-e.deltaY*.0012))).toFixed(4);drawCrop();fill();save()},{passive:false});

/* ---------- 预览 ---------- */
function refreshPv(now){clearTimeout(pvT);pvT=setTimeout(()=>{const c=C()[cur];if(!c)return;if(dirty)localStorage.setItem(YJ.DRAFT_KEY,JSON.stringify(D));
  const u=`character.html?id=${encodeURIComponent(c.id)}&draft=1&tab=${$('#pvTab').value}`;const f=$('#pv');
  try{f.contentWindow.location.replace(u)}catch(e){f.src=u}},now?0:700)}
$('#pvTab').addEventListener('change',()=>refreshPv(true));
new ResizeObserver(()=>{const w=$('.pvf').clientWidth;$('#pv').style.transform=`scale(${w/1920})`}).observe($('.pvf'));
$('#bPreview').addEventListener('click',()=>{saveNow();const c=C()[cur];open(`character.html?id=${encodeURIComponent(c.id)}&draft=1`,'_blank')});

/* ---------- 列表操作 ---------- */
$('#bAdd').addEventListener('click',()=>{let n=1;while(C().some(x=>x.id==='new-'+n))n++;
  const c={id:'new-'+n,name:'新角色',roman:'',group:S.groups[0].id,role:'',code:'',stars:null,cls:null,element:null,level:{cur:null,max:null},stats:Object.fromEntries(S.stats.map(s=>[s.key,null])),skills:[],potentials:[],module:{name:null,roman:null,no:null,stars:null,art:null,level:{cur:null,max:null},stats:[{key:'atk',value:null},{key:'hp',value:null},{key:'spd',value:null}],effect:{name:null,level:null,desc:null,icon:null}},spectrum:null,ascension:{stage:null,notes:null,art:null,focus:{x:null,y:null,w:null},shards:[0,1,2,3,4,5].map(()=>({name:null,desc:null,quote:null,unlocked:null,art:null}))},profile:{rows:[],quotes:[],relations:[],locks:[]},portrait:{src:null,mode:'auto'},page:''};
  C().splice(cur+1,0,c);cur++;renderList();renderForm();save();refreshPv(true)});
$('#bDel').addEventListener('click',()=>{const c=C()[cur];if(!c||!confirm(`删除「${c.name}」？（只影响草稿，导出后才会生效）`))return;C().splice(cur,1);cur=Math.max(0,cur-1);renderList();renderForm();save();refreshPv(true)});
$('#bUp').addEventListener('click',()=>{if(cur<1)return;const a=C();[a[cur-1],a[cur]]=[a[cur],a[cur-1]];cur--;renderList();save()});
$('#bDown').addEventListener('click',()=>{const a=C();if(cur>=a.length-1)return;[a[cur+1],a[cur]]=[a[cur],a[cur+1]];cur++;renderList();save()});

/* ---------- 导入导出 ---------- */
const dl=(blob,name)=>{const a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove()},1000)};
const stamp=()=>{const d=new Date();return `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}-${String(d.getHours()).padStart(2,'0')}${String(d.getMinutes()).padStart(2,'0')}`};
$('#bJson').addEventListener('click',()=>dl(new Blob([JSON.stringify(D,null,1)],{type:'application/json'}),'characters.json'));
$('#bZip').addEventListener('click',async()=>{st('打包中…');const files=[{name:'data/characters.json',data:JSON.stringify(D,null,1)}];
  const all=await YJ.allFiles();const used=new Set(C().map(c=>c.portrait&&c.portrait.src).filter(Boolean));
  for(const [k,b] of Object.entries(all))if(used.has(k))files.push({name:k,data:b});
  files.push({name:'README.txt',data:`源界角色界面更新包 ${stamp()}\n角色 ${C().length} 人，新立绘 ${files.length-1} 张。\n把这个 zip 发给小惟，解压到网站目录后发布即可。\n`});
  dl(await makeZip(files),`源界角色更新包-${stamp()}.zip`);st(`已导出：${files.length-2} 张新立绘 + characters.json`)});
$('#fImport').addEventListener('change',async e=>{const f=e.target.files[0];if(!f)return;try{const j=JSON.parse(await f.text());if(!j.characters||!j.settings)throw 0;D=j;S=D.settings;cur=0;saveNow();renderList();renderForm();refreshPv(true);st('已导入 '+f.name)}catch(er){alert('这个文件不是角色数据（characters.json）')}});
$('#bReset').addEventListener('click',async()=>{if(!confirm('放弃本机草稿，重新载入线上数据？没导出的修改会丢失。'))return;localStorage.removeItem(YJ.DRAFT_KEY);
  const all=await YJ.allFiles();for(const k of Object.keys(all))await YJ.delFile(k);location.reload()});
addEventListener('beforeunload',()=>{if(dirty)localStorage.setItem(YJ.DRAFT_KEY,JSON.stringify(D))});

const qid=new URLSearchParams(location.search).get('id');if(qid){const i=C().findIndex(x=>x.id===qid);if(i>=0)cur=i}
renderList();renderForm();refreshPv(true);
})();
