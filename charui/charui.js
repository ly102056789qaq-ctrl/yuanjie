/* 源界 · 角色界面渲染。内容全部来自 data/characters.json，这里只有界面逻辑。 */
(async function(){
const $=s=>document.querySelector(s),E=YJ.esc,L=YJ.locked,ic=YJ.icon;
const app=$('#app'),stage=$('#stage'),art=$('#art'),artbox=$('#artbox');
let D,S,C,cur,tab='detail',skillSel=0,skSel='skill:skill',SKD={},BT=null;
const byId=id=>C.find(x=>x.id===id||(x.alias||[]).includes(id));
const TABS=[['detail','详情','DETAIL'],['skill','技能','SKILL'],['module','模组','MODULE'],['spectrum','频谱','SPECTRUM'],['ascend','升格','ASCENSION'],['archive','档案','ARCHIVE']];
const LK=(t='数据锁定')=>`<span class="lk">${ic('lock')}${E(t)}</span>`;
const cls=id=>S.classes.find(x=>x.id===id),el=id=>S.elements.find(x=>x.id===id),grp=id=>(S.groups.find(g=>g.id===id)||{}).name||'';
const PH=(t,e,extra='')=>`<div class="ph"><b>${t}</b><small>${e}</small><i></i>${extra}</div>`;
const STAR='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12.00 1.00L14.82 9.12L23.41 9.29L16.57 14.48L19.05 22.71L12.00 17.80L4.95 22.71L7.43 14.48L0.59 9.29L9.18 9.12z"/></svg>';

try{D=await YJ.load()}catch(e){document.body.insertAdjacentHTML('beforeend','<p class="err">人物数据载入失败。</p>');return}
S=D.settings;C=D.characters;
/* 技能页：战斗逻辑层 js/battle（纯 ES Module）+ data/skills/<id>.json */
try{BT=await import(new URL('js/battle/index.js',location.href).href);const ix=await (await fetch('data/skills/index.json',{cache:'no-cache'})).json();
  for(const id of ix.ids){try{SKD[id]=BT.skillView(await (await fetch('data/skills/'+id+'.json',{cache:'no-cache'})).json())}catch(e){}}}catch(e){console.warn('技能数据载入失败',e)}
if(YJ.useDraft&&localStorage.getItem(YJ.DRAFT_KEY))$('#draftbar').hidden=false;
$('#bgimg').src=await YJ.src(S.background);
$('#rail').innerHTML=TABS.map(([k,n,e],i)=>`<button type="button" role="tab" data-t="${k}" aria-selected="${i?'false':'true'}"><span class="ti">${ic({detail:'detail',skill:'skill',module:'module',spectrum:'spectrum',ascend:'ascend',archive:'archive'}[k])}</span><b>${n}</b><small>${e}</small></button>`).join('')+'<div class="rfoot"><i></i><i></i><i></i><span>ASTERIAL</span></div>';
$('#rail').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setTab(b.dataset.t)});
$('.swap .si').innerHTML=ic('swap');$('.back .bk').innerHTML=ic('back');

function fit(){
  const desk=innerWidth>900&&innerWidth>=innerHeight*1.05;
  app.classList.toggle('desk',desk);app.classList.toggle('mob',!desk);document.body.style.overflow=desk?'hidden':'auto';
  app.style.setProperty('--mk',Math.min(1,innerWidth/1920));if(desk){const k=Math.min(innerWidth/1920,innerHeight/1080);stage.style.transform=`translate(-50%,-50%) scale(${k})`}else stage.style.transform='';
  if(art.naturalWidth&&cur)YJ.place(art,cur.portrait||{},artbox);if(cur)fitName();
  if(YJ.onArtPlaced)YJ.onArtPlaced()}
addEventListener('resize',fit);fit();

function stars(c){const m=S.starMax||6;const n=c.stars;const lk=L(n);
  const sp=lk?'':'<b class="spk s1">✦</b><b class="spk s2">✦</b><b class="spk s3">✦</b>';
  return `<div class="stars${lk?' none':''}" aria-label="${lk?'星级 未定':'星级 '+n}">${Array.from({length:lk?m:n},()=>`<i>${STAR}</i>`).join('')}${sp}</div>`}
/* 名字排版：短名一行；长名（去掉「·」超过 5 字，或无「·」超过 6 字）拆成两行错位排列。完全由数据决定。 */
function nameLines(n){const parts=n.split(/[·・•]/).map(x=>x.trim()).filter(Boolean);const len=[...parts.join('')].length;
  if(parts.length>1&&len>5)return [parts[0],parts.slice(1).join('·')];
  if(parts.length===1&&len>6){const a=[...n],h=Math.ceil(a.length/2);return [a.slice(0,h).join(''),a.slice(h).join('')]}
  return null}
function ident(c){
  const n=c.name||'';const lines=nameLines(n);const i=C.indexOf(c);
  let nm;
  if(lines){const mx=Math.max(...lines.map(x=>[...x].length));
    nm=`<h1 class="nm two M${Math.min(mx,7)}" aria-label="${E(n)}"><span class="ln1">${E(lines[0])}<i class="dot" aria-hidden="true"></i></span><span class="ln2">${E(lines[1])}</span></h1>`}
  else{const len=[...n.replace(/[·・•]/g,'')].length;
    nm=`<h1 class="nm L${Math.min(len,7)}">${n.includes('·')?n.split('·').map(E).join('<i class="dot mid" aria-hidden="true"></i>'):E(n)}</h1>`}
  return `<div class="ncard">
    <i class="slab" aria-hidden="true"></i><i class="face" aria-hidden="true"></i>
    <i class="br b1"></i><i class="br b2"></i><i class="br b3"></i><i class="br b4"></i>
    <div class="nmw"><i class="rb"></i>${nm}</div>
    ${stars(c)}
  </div>
  ${(c.profile&&c.profile.quotes&&c.profile.quotes[0])?`<blockquote class="vq"><i>VOICE</i>「${E(c.profile.quotes[0])}」</blockquote>`:''}`}
/* 名字永不裁切：超出卡片可用宽度时逐步缩小字号 */
function fitName(){const h=$('#ident .nm');if(!h)return;h.style.fontSize='';const max=app.classList.contains('mob')?innerWidth-80:520;
  let fs=parseFloat(getComputedStyle(h).fontSize),g=0;while(h.scrollWidth>max&&fs>28&&g++<40){fs-=3;h.style.fontSize=fs+'px'}}

function detail(c){
  const k=cls(c.cls),e=el(c.element);const lv=c.level||{};
  const lvl=L(lv.cur)?`<b class="lvn none">--</b><span class="lvm">/--</span>`:`<b class="lvn">${E(lv.cur)}</b><span class="lvm">/${E(L(lv.max)?'--':lv.max)}</span>`;
  const pct=!L(lv.cur)&&!L(lv.max)&&lv.max>0?Math.min(100,lv.cur/lv.max*100):0;
  const stats=S.stats.map(s=>{const v=(c.stats||{})[s.key];return `<li><span class="si">${ic(s.icon)}</span><span class="sn">${E(s.label)}</span>${L(v)?`<span class="sv none">— —</span>`:`<span class="sv">${E(v)}${s.unit&&!String(v).includes(s.unit)?s.unit:''}</span>`}</li>`}).join('');
  const sk=S.skillSlots.map((s,i)=>{const d=(c.skills||[]).find(x=>x.slot===s.slot)||{};return `<button type="button" class="dia${L(d.name)?' lkd':''}" data-sk="${i}"><span class="dg"><i></i>${YJ.slotIcon(s.icon)}</span><b>${E(s.label)}</b><small>${E((s.slot||'').toUpperCase())}</small></button>`}).join('');
  const PHI=`<span class="phi" aria-hidden="true"></span>`;
  return `<div class="card cecard">
    <div class="cc">${k?`<img src="${E(k.icon)}" alt="职业">`:PHI}<b class="${k?'':'none'}">${k?E(k.name):'数据锁定'}</b></div>
    <div class="cc" ${e?`style="--ec:${e.color}"`:''}>${e?`<img src="${E(e.icon)}" alt="元素">`:PHI}<b class="${e?'':'none'}">${e?E(e.name):'数据锁定'}</b>${e?`<span class="kw">${(e.keywords||[]).map(x=>`<em>${E(x)}</em>`).join('')}</span>`:''}</div>
  </div>
  <div class="card lvcard">
    <div class="lvrow"><span class="lvl">LV.</span>${lvl}${!L(lv.cur)&&lv.cur===lv.max?'<span class="cap">等级上限 ✓</span>':L(lv.cur)?LK('等级 · 数据锁定'):''}</div>
    <div class="bar${pct?'':' none'}"><i style="width:${pct}%"></i></div>
    <div class="btns"><button type="button" data-go="ascend">${ic('ascend')}升格预览<i>▸</i></button>${c.page?`<a href="${E(c.page)}">${ic('archive')}完整档案<i>▸</i></a>`:''}</div>
  </div>
  <div class="card stcard">${PH('基础属性','ATTRIBUTES')}<ul class="stats">${stats}</ul></div>
  <div class="card skcard">${PH('技能','SKILLS')}<div class="dias">${sk}</div></div>
`}

function skill(c){const sd=SKD[c.id];return sd?skillNet(c,sd):skillOld(c)}
function skillOld(c){
  const list=S.skillSlots.map((s,i)=>{const d=(c.skills||[]).find(x=>x.slot===s.slot)||{};return `<button type="button" class="sk${i===skillSel?' on':''}" data-sel="${i}"><span class="dg sm"><i></i>${YJ.slotIcon(s.icon)}</span><span class="t"><small>${E(s.label)}</small><b>${L(d.name)?'数据锁定':E(d.name)}</b></span></button>`}).join('');
  const s=S.skillSlots[skillSel],d=(c.skills||[]).find(x=>x.slot===s.slot)||{};
  const tags=(d.tags||[]).filter(Boolean);
  return `<div class="card big skpane">
    <div class="skl">${PH('技能','SKILLS')}${list}</div>
    <div class="skd">
      <div class="skh"><span class="dg xl"><i></i>${YJ.slotIcon(s.icon)}</span><div><small>${E(s.label)}</small><h2>${L(d.name)?'数据锁定':E(d.name)}</h2>
      <div class="tags">${tags.length?tags.map(t=>`<em>${E(t)}</em>`).join(''):`<em class="none">类型 · 未定</em><em class="none">消耗 · 未定</em>`}</div></div></div>
      <div class="desc">${L(d.desc)?`<div class="lockbox">${ic('lock')}<b>技能说明 · 数据锁定</b><p>设定公开后在这里显示。</p></div>`:E(d.desc).replace(/\n/g,'<br>')}</div>
      <div class="params">${(d.params&&d.params.length?d.params:[['倍率',null],['冷却',null],['消耗',null],['范围',null]]).map(([k,v])=>`<div><small>${E(k)}</small>${L(v)?'<b class="none">— —</b>':`<b>${E(v)}</b>`}</div>`).join('')}</div>
      <b class="wm" aria-hidden="true">${E((s.slot||'').toUpperCase())}</b>
      <div class="lvls">${[1,2,3,4,5,6,7,8,9,10].map(i=>`<i class="${i===1&&!L(d.name)?'on':''}"></i>`).join('')}<span>技能等级 · ${L(d.name)?'--':'1'}</span></div>
    </div></div>`}

/* 技能 / 潜能：版式依据她给的技能页设计图；数据全部来自 data/skills/<id>.json（经 js/battle/view.js 整理） */
const HLS=t=>E(t).replace(/==(.+?)==/g,'<em class="hb">$1</em>').replace(/\n/g,'<br>');
const LV=(v,m)=>L(v)?'<span class="none">Lv.数据锁定</span>':`Lv.${E(v)}${L(m)?'':'/'+E(m)}`;
const PNAME={mult:'伤害倍率',dreamMarkBonus:'梦痕增伤',toughness:'削韧',markDuration:'梦痕持续',replayRatio:'复现比例',domainReplayRatio:'幻海复现比例',aoeMult:'全体倍率',hits:'追加段数',hitMult:'每段倍率',enemyDelay:'敌方行动延后',domainRounds:'幻海持续',replayBonus:'复现增伤',domainExtra:'幻海延长',defIgnore:'无视防御'};
const PFMT={mult:'%',dreamMarkBonus:'%',replayRatio:'%',domainReplayRatio:'%',aoeMult:'%',hitMult:'%',enemyDelay:'%',replayBonus:'%',defIgnore:'%',markDuration:'回合',domainRounds:'轮',domainExtra:'轮',hits:'段'};
const pv=(k,v)=>PFMT[k]==='%'?`${+(v*100).toFixed(1)}%`:PFMT[k]?`${v} ${PFMT[k]}`:String(v);
/* 网络坐标（1920×1080 舞台） */
const SKX=[560,760,960,1160],NETC=[860,800];
const MAJ={A:[610,800],B:[860,520],C:[1110,800]};
const MAJ6={I:[560,580],II:[860,520],III:[1160,580],IV:[560,820],V:[860,860],VI:[1160,820]};
const ROMANP='ⅠⅡⅢⅣⅤⅥ';
const MIN=[[860,610],[860,680],[455,740],[505,670],[1265,740],[1215,670]];
const MIN9=[[430,810],[390,730],[455,655],[520,720],[1290,810],[1330,730],[1265,655],[860,610],[800,680]];
function skNode(sd,key){const [t,id]=key.split(':');
  if(t==='skill')return {kind:'skill',d:sd.skills.find(x=>x.slot===id)};
  if(t==='pot')return {kind:'major',d:sd.major.find(x=>x.id===id)};
  return {kind:'minor',d:sd.minor.find(x=>x.id===id)}}
function skDetail(sd,key){const n=skNode(sd,key);if(!n.d)return '';const d=n.d;
  const mi=n.kind==='major'?(sd.major||[]).findIndex(x=>x.id===d.id):-1;
  const label=n.kind==='skill'?d.label:n.kind==='major'?'潜能 · '+(ROMANP[mi]||d.id):'属性节点';
  const icon=n.kind==='minor'?`<span class="skmi big">${ic('lock')}</span>`:`<img src="${E(d.icon)}" alt="">`;
  const minorVal=n.kind==='minor'?(d.format==='flat'?`+${d.value}`:`+${(d.value*100).toFixed(1).replace(/\.0$/,'')}%`):'';
  const params=n.kind==='minor'?[[d.name,minorVal]]:Object.entries(d.params||{}).filter(([k])=>PNAME[k]).map(([k,v])=>[PNAME[k],pv(k,v)]);
  const desc=n.kind==='minor'?`${E(d.name)} ${minorVal}（暂定）`:d.desc?HLS(d.desc):'<span class="none">数据锁定</span>';
  const tags=(d.type||[]).slice(0,3);
  return `<div class="skc">
    <div class="skch"><span class="skci">${icon}</span><div class="skct"><small>${E(label)}</small><h3>${E(d.name||'数据锁定')}</h3>
      <span class="sklv">${LV(d.level,d.maxLevel)}</span>${tags.length?`<div class="sktags">${tags.map(t=>`<em>${E(t)}</em>`).join('')}</div>`:''}</div></div>
    <div class="skcd">${desc}</div>
    <div class="skcs"><h4><i></i>升级预览</h4><table>${params.map(([k,v])=>`<tr><td>${E(k)}</td><td>${E(v)}</td><td class="ar">▸</td><td class="nx none">数据锁定</td></tr>`).join('')||'<tr><td class="none" colspan="4">数据锁定</td></tr>'}</table></div>
    <div class="skcs"><h4><i></i>升级消耗</h4><div class="skmat">${[0,1].map(()=>`<div class="mt"><span>${ic('lock')}</span><b class="none">数据锁定</b></div>`).join('')}</div></div>
    ${key==='skill:ultimate'?`<button type="button" class="skfxbtn" data-ultfx>▶ 预览演出</button>`:''}
    <button type="button" class="skup" disabled>升级<small>数据锁定</small><i>»</i></button>
  </div>`}
function skillNet(c,sd){
  const on=k=>k===skSel?' on':'';const lit=x=>x&&x.unlocked===true;
  const six=(sd.major||[]).length>=6;
  const nine=!six && (sd.minor||[]).length>=9;
  const minPos=nine?MIN9:MIN;
  const main=sd.skills.map((x,i)=>`<button type="button" class="skm${on('skill:'+x.slot)}" data-skn="skill:${x.slot}" style="left:${SKX[i]}px"><span class="skmc">${x.icon?`<img src="${E(x.icon)}" alt="">`:ic('lock')}</span><b>${E(x.label)}</b><small>${E(x.name||'数据锁定')}</small><em>${LV(x.level,x.maxLevel)}</em></button>`).join('');
  const line=(a,b,u)=>`<line x1="${a[0]}" y1="${a[1]}" x2="${b[0]}" y2="${b[1]}" class="${u?'u':''}"/>`;
  const mi=sd.minor||[];
  const L2=six?[
    line(MAJ6.I,MAJ6.II,true),line(MAJ6.II,MAJ6.III,true),line(MAJ6.IV,MAJ6.V,true),line(MAJ6.V,MAJ6.VI,true),
    line(MAJ6.I,MAJ6.IV,true),line(MAJ6.III,MAJ6.VI,true),line(MAJ6.II,NETC,true),line(MAJ6.V,NETC,true)
  ].join(''):nine?[
    line(MAJ.B,MIN9[7],lit(mi[7])),line(MIN9[7],MIN9[8],lit(mi[8])),line(MIN9[8],NETC,lit(mi[8])),
    line(MAJ.A,NETC,lit(sd.major[0])),line(MAJ.C,NETC,lit(sd.major[2])),
    line(MAJ.A,MIN9[0],lit(mi[0])),line(MIN9[0],MIN9[1],lit(mi[1])),line(MIN9[1],MIN9[2],lit(mi[2])),line(MIN9[2],MIN9[3],lit(mi[3])),
    line(MAJ.C,MIN9[4],lit(mi[4])),line(MIN9[4],MIN9[5],lit(mi[5])),line(MIN9[5],MIN9[6],lit(mi[6]))
  ].join(''):[
    line(MAJ.B,MIN[0],lit(mi[0])),line(MIN[0],MIN[1],lit(mi[1])),line(MIN[1],NETC,lit(mi[1])),
    line(MAJ.A,NETC,lit(sd.major[0])),line(MAJ.C,NETC,lit(sd.major[2])),
    line(MAJ.A,MIN[3],lit(mi[3])),line(MIN[3],MIN[2],lit(mi[2])),line(MAJ.C,MIN[5],lit(mi[5])),line(MIN[5],MIN[4],lit(mi[4]))].join('');
  const arcs=`<circle cx="${NETC[0]}" cy="${NETC[1]}" r="130"/><circle cx="${NETC[0]}" cy="${NETC[1]}" r="250" class="d"/><path d="M300 700 Q 860 380 1420 700" class="d"/>`;
  const majors=sd.major.map((x,i)=>{const p=six?(MAJ6[x.id]||[0,0]):(MAJ[x.id]||[0,0]);const lb=six?((i%3===1)?'r':(i%3===0)?'bl':'br'):(x.id==='B'?'r':i===0?'bl':'br');
    return `<button type="button" class="skp${on('pot:'+x.id)}${lit(x)?' lit':''}" data-skn="pot:${x.id}" style="left:${p[0]}px;top:${p[1]}px"><span class="dia"><img src="${E(x.icon)}" alt=""></span><span class="lb ${lb}"><span class="rn"><span>${ROMANP[i]||''}</span></span><b>${E(x.name)}</b><em>${[0,1,2,3].map(j=>`<s class="${!L(x.level)&&j<x.level?'f':''}"></s>`).join('')}</em></span></button>`}).join('');
  const minors=mi.map((x,i)=>{const p=minPos[i]||[0,0];return `<button type="button" class="skn${on('min:'+x.id)}${lit(x)?' lit':''}" data-skn="min:${x.id}" style="left:${p[0]}px;top:${p[1]}px" title="${E(x.name)}"><span>${E(x.name.slice(0,1))}</span></button>`}).join('');
  const pr=sd.progress;const segs=Array.from({length:pr.total},(_,i)=>`<i class="${pr.unlocked!=null&&i<pr.unlocked?'f':''}"></i>`).join('');
  return `<div class="skx">
    <div class="skxbg" aria-hidden="true"><i class="g1"></i><i class="g2"></i></div>
    <div class="skhd"><b>${E(sd.name||c.name)}</b><small>${E((c.roman||'').toUpperCase())}</small><i>///</i></div>
    <div class="skcrumb"><i>///</i><b>技能 / 潜能</b><small>SKILL &amp; POTENTIAL</small></div>
    <div class="sklab" style="top:228px"><b>主技能</b><small>SKILL</small><i></i></div>
    <div class="sklab" style="top:470px"><b>潜能</b><small>POTENTIAL</small><i></i></div>
    <div class="skrow"><i class="rl"></i>${main}</div>
    <svg class="sknet" viewBox="0 0 1920 1080" aria-hidden="true"><g class="arc">${arcs}</g><g class="ln">${L2}</g></svg>
    <div class="skcore" style="left:${NETC[0]}px;top:${NETC[1]}px"><svg viewBox="-60 -60 120 120"><path d="M0-58L9-9 58 0 9 9 0 58-9 9-58 0-9-9Z"/></svg></div>
    ${majors}${minors}
    <div class="skprog"><span class="sx">✦</span><div><b>潜能进度</b><small>POTENTIAL PROGRESS</small></div><strong>${pr.unlocked==null?'<span class="none">--</span>':pr.unlocked}<small>/${pr.total}</small></strong><div class="seg">${segs}</div>${pr.unlocked==null?'<em class="none">解锁状态 · 数据锁定</em>':''}</div>
    <div class="skside">${skDetail(sd,skSel)}</div>
  </div>`}
function ultFx(sd){const u=sd.skills.find(x=>x.slot==='ultimate')||{};const o=document.createElement('div');o.className='ultfx';
  o.innerHTML=`<div class="ufbg"></div>${[0,1,2,3].map(i=>`<i class="rp" style="--d:${i*.28}s"></i>`).join('')}<div class="uft"><small>ULTIMATE</small><b>${E(u.name||'')}</b>${(u.previewTag||(sd.id==='siwei'?'幻海展开':''))?`<em>${E(u.previewTag||'幻海展开')}</em>`:''}</div>${[0,1,2].map(i=>`<i class="sl" style="--d:${1.5+i*.22}s;--r:${[-24,18,-6][i]}deg"></i>`).join('')}<i class="aoe"></i><span class="ufhint">点击关闭 · 正式演出待美术</span>`;
  stage.appendChild(o);const close=()=>{o.remove()};o.addEventListener('click',close);setTimeout(close,3600)}
/* 模组：版式依据她给的模组设计图；内容全部来自 c.module，未设定显示「数据锁定」 */
const HL=t=>E(t).replace(/==(.+?)==/g,'<em class="hl">$1</em>').replace(/\n/g,'<br>');
const MSTAR='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l2.3 8.2 8.2 2.3-8.2 2.3L12 22.5l-2.3-8.2L1.5 12l8.2-2.3z"/></svg>';
function module(c){const m=c.module||{};const lk=L(m.name);const lv=m.level||{};const ef=m.effect||{};
  const ro=m.roman||c.roman||'';const pct=(!L(lv.cur)&&!L(lv.max)&&+lv.max>0)?Math.min(100,lv.cur/lv.max*100):0;
  const stats=(m.stats&&m.stats.length?m.stats:[{key:'atk'},{key:'hp'},{key:'spd'}]).map(x=>{const d=S.stats.find(s=>s.key===x.key)||{label:x.key,icon:'lock'};
    return `<div class="mst"><span class="mk">${ic(d.icon)}<b>${E(d.label)}</b></span>${L(x.value)?'<em class="none">— —</em>':`<em>${E(x.value)}</em>`}</div>`}).join('');
  const starN=L(m.stars)?0:+m.stars;
  return `<div class="mxd${lk?' lkd':''}">
    <div class="mxbg" aria-hidden="true"><i class="b1"></i><i class="b2"></i><i class="b3"></i><i class="b4"></i><i class="b5"></i><i class="b6"></i></div>
    <div class="mxno"><b>MODULE</b><small>// EXCLUSIVE</small><em>${E(m.no||'— —')}</em></div>
    <div class="mxart">${m.art?`<img src="${E(m.art)}" alt="${E(m.name||'模组')}">`:`<div class="mxlock">${ic('lock')}<b>模组立绘 · 数据锁定</b></div>`}</div>
    <div class="mxfoot"><b>${E(ro||'— —')} //</b><b>EXCLUSIVE MODULE</b><span class="bc"></span></div>
    <div class="mxtop"><small>// MODULE</small><i></i></div>
    <div class="mxcol">
      <div class="mc mname"><i class="mcfx" aria-hidden="true"></i><span class="mtag">专属模组</span>
        <div class="mnr"><h2 class="${lk?'none':''}">${lk?'数据锁定':E(m.name)}</h2>${ro?`<small>${E(ro)}</small>`:''}</div>
        <div class="mstars">${starN?Array.from({length:starN},()=>MSTAR).join(''):'<span class="none">星级 · 数据锁定</span>'}</div>
        <svg class="mseal" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="50" cy="50" r="37" fill="none" stroke="currentColor" stroke-width=".8" stroke-dasharray="2 4"/><path d="M28 74L72 26" stroke="currentColor" stroke-width="2"/><path d="M60 30c-12 6-20 18-24 34 10-6 18-14 24-34z" fill="currentColor" opacity=".55"/></svg></div>
      <div class="mc mlv"><i class="mcfx" aria-hidden="true"></i><div class="lvr"><span class="lvt">LV.</span>${L(lv.cur)?'<b class="none">— —</b>':`<b>${E(lv.cur)}</b>`}<span class="lvm">/${L(lv.max)?'— —':E(lv.max)}</span>
        <button type="button" class="rebuild" disabled>${ic('lock')}<span>重构</span><i><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 8a8 8 0 0 0-14 1M5 16a8 8 0 0 0 14-1" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19 3v5h-5M5 21v-5h5" fill="none" stroke="currentColor" stroke-width="2"/></svg></i></button></div>
        <div class="lvbar"><i style="width:${pct}%"></i></div></div>
      <div class="mc mbase"><i class="mcfx" aria-hidden="true"></i>${PH('基础属性','// BASE ATTRIBUTES')}<div class="msts">${stats}</div></div>
      <div class="mc meff"><i class="mcfx" aria-hidden="true"></i>${PH('模组特性','// MODULE EFFECT')}
        <div class="mef"><span class="mei">${ef.icon?`<img src="${E(ef.icon)}" alt="">`:L(ef.name)?ic('lock'):`<svg viewBox="0 0 64 64" aria-hidden="true"><path d="M32 6l5 21 21 5-21 5-5 21-5-21-21-5 21-5z" fill="#fff"/><path d="M46 14l2 8 8 2-8 2-2 8-2-8-8-2 8-2z" fill="#fff" opacity=".7"/></svg>`}</span>
        <div class="met"><div class="meh"><b class="${L(ef.name)?'none':''}">${L(ef.name)?'数据锁定':E(ef.name)}</b>${L(ef.level)?'':`<span class="melv">LV.${E(ef.level)}</span>`}</div>
        ${L(ef.desc)?`<p class="none">${ic('lock')} 模组特性 · 数据锁定</p>`:`<p>${HL(ef.desc)}</p>`}</div></div></div>
    </div></div>`}
function lockedTab(t,e){return `<div class="card big lockpane">${PH(t,e)}<div class="lockbox">${ic('lock')}<b>${t} · 数据锁定</b><p>内容尚未公开。</p></div></div>`}
/* 频谱：版式依据她给的频谱设计图；内容全部来自 c.spectrum，未设定显示「数据锁定」。更换界面的版式参考战双帕弥什「意识」更换。 */
let spSel=0,spSetOpen=true,spx=null;
const HLB=t=>E(t).replace(/==(.+?)==/g,'<em class="hb">$1</em>').replace(/\n/g,'<br>');
const SPSTAR='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.8l2.9 6.6 7.1.6-5.4 4.7 1.6 7-6.2-3.7-6.2 3.7 1.6-7L2 9l7.1-.6z"/></svg>';
const pad2=n=>String(n).padStart(2,'0');
function spData(c){const sp=c.spectrum&&!Array.isArray(c.spectrum)?c.spectrum:{};const n=S.spectrumSlots||6;
  const slots=Array.from({length:n},(_,i)=>(sp.slots||[])[i]||{});return {sp,slots,set:sp.set||{},inv:sp.inventory||[]}}
function spWave(){return '<canvas class="spwave" width="640" height="168" aria-hidden="true"></canvas>'}
function spTile(s,i,on){const lk=L(s.name);
  return `<button type="button" class="spt p${i+1}${on?' on':''}${lk?' lkd':''}" data-spi="${i}" aria-label="${lk?`频谱 ${pad2(i+1)} 数据锁定`:E(s.name)}">
    <span class="spn">${pad2(i+1)}</span><span class="spim">${s.icon?`<img src="${E(s.icon)}" alt="">`:`<i class="spl">${ic('lock')}<b>数据锁定</b></i>`}</span>
    <span class="spb">${L(s.plus)?'':`<b>+${E(s.plus)}</b>`}<span class="sps">${L(s.stars)?'':Array.from({length:+s.stars},()=>SPSTAR).join('')}</span></span><i class="spy"></i>${on?'<i class="spk"></i>':''}</button>`}
function spRing(){const V='viewBox="-500 -500 1000 1000" aria-hidden="true"';return `<div class="spring">
  <svg class="rl l0" ${V}><circle r="470" class="r0"/></svg>
  <svg class="rl l1" ${V}><circle r="430" class="r1"/></svg>
  <svg class="rl l2" ${V}><circle r="395" class="r2"/><circle r="300" class="r3"/><circle r="250" class="r4"/></svg>
  <svg class="rl l3" ${V}><path class="a1" d="M-260 -366A450 450 0 0 1 120 -434"/><path class="a1" d="M330 300A450 450 0 0 1 60 446"/></svg>
  <svg class="rl l4" ${V}><path class="a2" d="M-440 -95A450 450 0 0 1 -400 -205"/><path class="a2" d="M-420 160A450 450 0 0 1 -446 60"/><path class="a2" d="M300 -336A450 450 0 0 1 380 -240"/></svg>
  <svg class="rl l5" ${V}><path class="a3" d="M-395 0A395 395 0 0 1 -280 -279"/><path class="a3" d="M395 0A395 395 0 0 1 280 279"/></svg>
  <svg class="rl l6" ${V}><circle r="345" class="r5"/></svg></div>`}
function spectrum(c){const {sp,slots,set}=spData(c);const n=slots.length;if(spSel>=n)spSel=0;
  const loaded=slots.filter(s=>!L(s.name)).length;const s=slots[spSel]||{};const lk=L(s.name);
  const inSet=L(set.name)?0:slots.filter(x=>x.set===set.name).length;const smax=+set.max||4;
  const subs=(s.subs&&s.subs.length?s.subs:[{},{},{},{}]).map(x=>`<li>${x.icon?ic(x.icon):'<i class="dot"></i>'}<span>${L(x.label)?'<em class="none">数据锁定</em>':E(x.label)}</span><b>${L(x.value)?'— —':E(x.value)}</b></li>`).join('');
  const m=s.main||{};
  const bon=(set.bonuses||[]).map(b=>`<li><i></i><span>${E(b.n)}件：${L(b.desc)?'<em class="none">数据锁定</em>':HLB(b.desc)}</span></li>`).join('');
  return `<div class="spd">
  <div class="spbg" aria-hidden="true"><i class="g1"></i><i class="g2"></i><i class="g3"></i><i class="g4"></i></div>
  <div class="spcrumb"><span class="sl">///</span><div><b>角色养成 <i>/</i> 频谱</b><small>DEVELOPMENT <i>/</i> SPECTRUM</small></div></div>
  <div class="sphead"><h2>频谱装载</h2><small>SPECTRUM ARRAY</small>${L(sp.intro)?'':`<p>${HLB(sp.intro)}</p>`}</div>
  <div class="sparr">${spRing()}
    <div class="spcore"><svg class="spstar" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 4l6 38 38 8-38 8-6 38-6-38-38-8 38-8z"/></svg>${spWave()}
      <small>SPECTRUM</small><i></i><b>${pad2(loaded)}/${pad2(n)}</b><em>${loaded===n?'装载完成':loaded?'部分装载':'数据锁定'}</em></div>
    ${slots.map((x,i)=>spTile(x,i,i===spSel)).join('')}</div>
  <div class="spcnt"><b>${pad2(loaded)}<small>/${pad2(n)}</small></b><em>${loaded===n?'装载完成':loaded?'部分装载':'数据锁定'}</em><span class="bc"></span></div>
  <div class="spcard${lk?' lkd':''}">
    <div class="sch"><div class="sct"><div class="scno"><i>频谱</i> <b>${pad2(spSel+1)}</b>${lk?'':'<span class="sctag">已装载</span>'}</div>
      <h3>${lk?'数据锁定':E(s.name)}</h3><small>SPECTRUM RECORD</small></div>
      <div class="scban">${s.banner||s.icon?`<img src="${E(s.banner||s.icon)}" alt="">`:`<i>${ic('lock')}</i>`}</div></div>
    <div class="sclv"><div class="lvx"><b>Lv.${L(s.level)?'— —':E(s.level)}</b><span>/ ${L(s.max)?'— —':E(s.max)}</span><i style="width:${!L(s.level)&&+s.max>0?Math.min(100,s.level/s.max*100):0}%"></i></div>
      <button type="button" class="sclock${s.locked?' on':''}" disabled aria-label="锁定">${ic('lock')}</button>
      <button type="button" class="scswap" data-spswap="${spSel}">${ic('xchg')}<span>更换</span></button></div>
    <div class="scsec"><h4><i></i>主属性<small>MAIN ATTRIBUTE</small></h4>
      <div class="scmain">${m.icon?ic(m.icon):'<i class="dot"></i>'}<span>${L(m.label)?'数据锁定':E(m.label)}</span><b>${L(m.value)?'— —':E(m.value)}</b></div></div>
    <div class="scsec"><h4><i></i>副属性<small>SUB ATTRIBUTE</small></h4><ul class="scsub">${subs}</ul></div>
    <div class="scsec"><h4><i></i>套装共鸣<small>SET RESONANCE</small></h4>
      <button type="button" class="scset${spSetOpen?' open':''}" data-spset aria-expanded="${spSetOpen}"><span class="hex">${set.icon?`<img src="${E(set.icon)}" alt="">`:`<svg viewBox="0 0 40 40" aria-hidden="true"><path d="M20 6c2 6 2 9 0 14-2-5-2-8 0-14zM20 34c-2-6-2-9 0-14 2 5 2 8 0 14zM6 20c6-2 9-2 14 0-5 2-8 2-14 0zM34 20c-6 2-9 2-14 0 5-2 8-2 14 0z" fill="#fff"/><path d="M10 10c5 3 7 5 10 10-5-3-7-5-10-10zM30 30c-5-3-7-5-10-10 5 3 7 5 10 10zM30 10c-3 5-5 7-10 10 3-5 5-7 10-10zM10 30c3-5 5-7 10-10-3 5-5 7-10 10z" fill="#C9D3FF"/><circle cx="20" cy="20" r="2.6" fill="#F3D27A"/></svg>`}</span>
        <b>${L(set.name)?'数据锁定':E(set.name)}</b>${L(set.name)?'':`<em>(${Math.min(inSet,smax)}/${smax})</em>`}${ic('chev')}</button>
      <ul class="scbon"${spSetOpen?'':' hidden'}>${bon}</ul></div>
    <div class="scfoot"><span class="bc"></span><i></i><code>${L(sp.code)?'— —':E(sp.code)}</code></div></div>
  <div class="spact"><button type="button" class="unl" disabled>${ic('unload')}<span>一键卸下</span></button><button type="button" class="enh" disabled>${ic('ffw')}<span>强化</span></button></div>
  ${spx?spSwap(c):''}</div>`}
/* 更换界面：左侧候选网格 + 位置/套装筛选 + 排序，右侧「当前装载 vs 选中」对比，底部确认更换（仅前端预览，不写入数据） */
function spPool(c){const {slots,inv}=spData(c);
  return [...slots.map((s,i)=>({...s,pos:i+1,_eq:true,_k:'s'+i})),...inv.map((s,i)=>({...s,pos:+s.pos||null,_k:'v'+i}))]}
function spCmp(a,b){const av=parseFloat(String(a||'').replace(/[^\d.-]/g,'')),bv=parseFloat(String(b||'').replace(/[^\d.-]/g,''));
  if(isNaN(av)||isNaN(bv)||av===bv)return '<i class="eq">—</i>';return bv>av?`<i class="up">${ic('up')}</i>`:`<i class="dn">${ic('down')}</i>`}
function spMini(s,tag,ref){const lk=L(s&&s.name);s=s||{};const m=s.main||{};const rm=(ref&&ref.main)||{};
  const subs=(s.subs||[]).map((x,i)=>{const r=ref&&ref.subs&&ref.subs[i]||{};return `<li><span>${L(x.label)?'— —':E(x.label)}</span><b>${L(x.value)?'— —':E(x.value)}</b>${ref?spCmp(r.value,x.value):''}</li>`}).join('')||'<li><span class="none">副属性 · 数据锁定</span></li>';
  return `<div class="sxc${lk?' lkd':''}"><div class="sxct"><em>${tag}</em>${s.pos?`<small>位置 ${pad2(s.pos)}</small>`:''}</div>
    <div class="sxch"><span class="sxim">${s.icon?`<img src="${E(s.icon)}" alt="">`:ic('lock')}</span><div><b>${lk?'数据锁定':E(s.name)}</b><small>${L(s.level)?'':`Lv.${E(s.level)}/${E(s.max)}`}${L(s.plus)?'':` · +${E(s.plus)}`}</small><span class="sps">${L(s.stars)?'':Array.from({length:+s.stars},()=>SPSTAR).join('')}</span></div></div>
    <div class="sxm"><span>${L(m.label)?'主属性 · 数据锁定':E(m.label)}</span><b>${L(m.value)?'— —':E(m.value)}</b>${ref?spCmp(rm.value,m.value):''}</div>
    <ul>${subs}</ul><p class="sxset">${L(s.set)?'<span class="none">套装 · 数据锁定</span>':`套装 · <b>${E(s.set)}</b>`}</p></div>`}
function spSwap(c){const {slots}=spData(c);const pool=spPool(c);const pos=spx.pos;
  let list=pool.filter(x=>(spx.all||x.pos===pos||x.pos==null)&&(spx.set==='all'||x.set===spx.set));
  list.sort((a,b)=>spx.sort==='lv'?(+b.level||0)-(+a.level||0):(a.pos||99)-(b.pos||99));
  const curS=slots[pos-1]||{};const sel=pool.find(x=>x._k===spx.sel)||null;const sets=[...new Set(pool.map(x=>x.set).filter(x=>!L(x)))];
  const same=!sel||sel._k==='s'+(pos-1)||L(sel.name);
  return `<div class="spx" role="dialog" aria-label="更换频谱"><div class="spxin">
   <div class="sxh"><div class="sxtt"><b>更换频谱</b><small>REPLACE SPECTRUM</small></div>
     <div class="sxpos">${slots.map((_,i)=>`<button type="button" data-sxpos="${i+1}" class="${i+1===pos?'on':''}">${pad2(i+1)}</button>`).join('')}</div>
     <button type="button" class="sxx" data-sxclose aria-label="关闭">${ic('close')}</button></div>
   <div class="sxl"><div class="sxf"><button type="button" data-sxall class="${spx.all?'on':''}">${ic('filter')}<span>${spx.all?'全部位置':'当前位置'}</span></button>
      <div class="sxchips"><button type="button" data-sxset="all" class="${spx.set==='all'?'on':''}">全部套装</button>${sets.map(t=>`<button type="button" data-sxset="${E(t)}" class="${spx.set===t?'on':''}">${E(t)}</button>`).join('')}</div>
      <button type="button" data-sxsort class="sxsort">${ic('sort')}<span>${spx.sort==='lv'?'等级':'位置'}</span></button></div>
     <div class="sxg">${list.map(x=>{const lk=L(x.name);return `<button type="button" class="sxi${x._k===spx.sel?' on':''}${lk?' lkd':''}" data-sxsel="${x._k}">
       <span class="sxim">${x.icon?`<img src="${E(x.icon)}" alt="">`:`<i>${ic('lock')}<b>数据锁定</b></i>`}</span>${x.pos?`<span class="sxp">${pad2(x.pos)}</span>`:''}
       ${x._eq?'<span class="sxeq">装载中</span>':''}<span class="sxb">${L(x.plus)?'':`+${E(x.plus)}`}<span class="sps">${L(x.stars)?'':Array.from({length:+x.stars},()=>SPSTAR).join('')}</span></span>
       <span class="sxn">${lk?'数据锁定':E(x.name)}</span></button>`}).join('')||'<p class="none sxempty">没有符合条件的频谱</p>'}</div>
     <p class="sxtip">候选条目来自编辑器「频谱 · 备选」；更换为前端预览，不会写入数据。</p></div>
   <div class="sxr"><div class="sxcmp">${spMini(curS,'当前装载')}<span class="sxvs">VS</span>${sel?spMini(sel,'选中',curS):`<div class="sxc empty"><p>从左侧选择一件频谱进行对比</p></div>`}</div>
     <div class="sxbtn"><button type="button" class="ghost" data-sxclose>取消</button><button type="button" class="ok" data-sxok ${same?'disabled':''}>${ic('xchg')}<span>确认更换</span></button></div></div>
  </div></div>`}

/* 频谱动态：中心波形（canvas，中间高两侧低、呼吸起伏），切换槽位时脉冲高亮；减少动态时只画静帧 */
const spRM=matchMedia('(prefers-reduced-motion: reduce)');let spPulse=-1e9,spRaf=0;
function spDraw(cv,t){const g=cv.getContext('2d'),W=cv.width,H=cv.height,N=64,bw=W/N;g.clearRect(0,0,W,H);
  const p=Math.max(0,1-(t-spPulse)/650);const br=.82+.18*Math.sin(t/900);const mid=H/2;
  for(let i=0;i<N;i++){const x=i/(N-1);const env=Math.exp(-Math.pow((x-.5)/.21,2));
    const n=.55+.25*Math.sin(t/260+i*.9)+.2*Math.sin(t/410-i*1.7)+.12*Math.sin(t/150+i*2.3);
    const ring=p*Math.exp(-Math.pow((x-.5)/(.08+.5*(1-p)),2));
    const v=Math.max(3,(6+env*68*n*br)*(1+.7*p)+ring*22);
    g.fillStyle=ring>.15?`rgba(${150+100*ring|0},${180+60*ring|0},255,1)`:'#4D74FF';
    g.fillRect(i*bw+bw*.25,mid-v,bw*.5,v*2)}}
function spTick(t){spRaf=0;const cv=document.querySelector('.pane[data-p=spectrum].on .spwave');
  if(!cv||document.hidden)return;spDraw(cv,t);const c=cv.closest('.spcore');if(c)c.style.setProperty('--pl',Math.max(0,1-(t-spPulse)/650).toFixed(3));
  if(!spRM.matches)spRaf=requestAnimationFrame(spTick)}
function spKick(){if(!spRaf)spRaf=requestAnimationFrame(spTick)}
new MutationObserver(spKick).observe(app,{attributes:true,attributeFilter:['data-tab']});
document.addEventListener('visibilitychange',spKick);spRM.addEventListener?.('change',spKick);
function spRefresh(){const p=$('.pane[data-p=spectrum]');if(p)p.innerHTML=spectrum(cur);if(spRaf){cancelAnimationFrame(spRaf);spRaf=0}spKick()}
$('#panes').addEventListener('click',e=>{if(!e.target.closest('.pane[data-p=spectrum]'))return;
  let b;
  if(b=e.target.closest('[data-spi]')){const ch=spSel!==+b.dataset.spi;spSel=+b.dataset.spi;if(ch)spPulse=performance.now();spRefresh();if(ch){const c=$('.pane[data-p=spectrum] .spcore');c&&c.classList.add('pulse')}return}
  if(b=e.target.closest('[data-spset]')){spSetOpen=!spSetOpen;spRefresh();return}
  if(b=e.target.closest('[data-spswap]')){spx={pos:+b.dataset.spswap+1,all:false,set:'all',sort:'pos',sel:null};spRefresh();return}
  if(e.target.closest('[data-sxclose]')){spx=null;spRefresh();return}
  if(b=e.target.closest('[data-sxpos]')){spx.pos=+b.dataset.sxpos;spx.sel=null;spSel=spx.pos-1;spRefresh();return}
  if(e.target.closest('[data-sxall]')){spx.all=!spx.all;spRefresh();return}
  if(b=e.target.closest('[data-sxset]')){spx.set=b.dataset.sxset;spRefresh();return}
  if(e.target.closest('[data-sxsort]')){spx.sort=spx.sort==='lv'?'pos':'lv';spRefresh();return}
  if(b=e.target.closest('[data-sxsel]')){spx.sel=b.dataset.sxsel;spRefresh();return}
  if(e.target.closest('[data-sxok]')){const pool=spPool(cur);const sel=pool.find(x=>x._k===spx.sel);const {sp,slots}=spData(cur);
    if(sel&&!L(sel.name)){const i=spx.pos-1;const o=slots[i];const clean=({_eq,_k,...r})=>r;
      if(sel._k[0]==='s'){const j=+sel._k.slice(1);sp.slots[j]=clean({...o});}else{const j=+sel._k.slice(1);sp.inventory[j]={...clean({...o}),pos:i+1}}
      sp.slots[i]=clean({...sel});spSel=i}
    spx=null;spRefresh()}});
addEventListener('keydown',e=>{if(e.key==='Escape'&&spx){spx=null;spRefresh()}});
/* 升格：版式依据她给的升格设计图。原画斜切成六块玻璃碎片 I–VI；内容全部来自 c.ascension，未设定显示「数据锁定」。
   画面效果：优先 Three.js 真 3D 玻璃（charui/ascend3d.js），WebGL 不可用 / 减少动态 / 手机 / 帧率过低时退回 CSS 2D 版。 */
const ROMAN=['I','II','III','IV','V','VI'];
const AV={C1:[960,520],C2:[1010,640],T0:[560,110],T1:[1090,46],T2:[1340,58],T3:[1372,350],T4:[1396,700],T5:[1340,930],T6:[870,1060],T7:[520,900],T8:[400,640],T9:[380,420],T10:[440,300]};
const ASPOLY=[['C1','T10','T0','T1'],['C1','T1','T2','T3'],['C2','T8','T9','T10','C1'],['C1','T3','T4','C2'],['C2','T6','T7','T8'],['C2','T4','T5','T6']].map(p=>p.map(k=>AV[k]));
const ASOUT=[['T0','T10','T1'],['T2','T1','T3'],['T9','T8','T10'],['T3','T4'],['T7','T6','T8'],['T5','T4','T6']].map(p=>p.map(k=>AV[k]));
const cen=p=>p.reduce((a,q)=>[a[0]+q[0]/p.length,a[1]+q[1]/p.length],[0,0]);
const inset=(p,d)=>{const c=cen(p);return p.map(q=>{const dx=q[0]-c[0],dy=q[1]-c[1],L=Math.hypot(dx,dy)||1;const k=1-d/L;return [c[0]+dx*k,c[1]+dy*k]})};
const ASIN=ASPOLY.map(p=>inset(p,6));
const ASLAB=ASPOLY.map((p,i)=>{const c=cen(p),o=cen(ASOUT[i]);return [c[0]+(o[0]-c[0])*.42,c[1]+(o[1]-c[1])*.42]});
let asSel=-1,as3=null,as3Busy=false,as3For=null,as3Off=false;
function asData(c){const a=c.ascension||{};const sh=Array.from({length:6},(_,i)=>(a.shards||[])[i]||{});const st=L(a.stage)?null:+a.stage;
  const un=sh.map((s,i)=>s.unlocked===true||s.unlocked===false?s.unlocked:(st!=null&&i<st));
  const f=a.focus||{};const iw=+f.w||1820,ih=iw*941/1672;const fx=L(f.x)?.7:+f.x,fy=L(f.y)?.27:+f.y;
  const img={x:920-fx*iw,y:316-fy*ih,w:iw,h:ih};return {a,sh,st,un,img}}
function asCard(c,i){const {a,sh,un,img}=asData(c);const s=sh[i]||{};const lk=L(s.name);const ok=un[i];
  const p=ASPOLY[i];const xs=p.map(q=>q[0]),ys=p.map(q=>q[1]);const bx=Math.min(...xs),by=Math.min(...ys),bw=Math.max(...xs)-bx,bh=Math.max(...ys)-by;
  const CW=416,CH=230;const k=Math.max(CW/bw,CH/bh)*1.15;const cx=bx+bw/2,cy=by+bh/2;
  const top=s.art?`<img src="${E(s.art)}" alt="">`:a.art?`<span class="acimg" style="background-image:url('${E(a.art)}');background-size:${img.w*k}px ${img.h*k}px;background-position:${CW/2-(cx-img.x)*k}px ${CH/2-(cy-img.y)*k}px"></span>`:`<span class="acimg none">${ic('lock')}</span>`;
  return `<div class="ascard${ok?'':' lkd'}${i===5?' ult':''}" role="region" aria-label="升格 ${ROMAN[i]}"><div class="act">${top}<i class="acsh"></i><b class="acr">${ROMAN[i]}</b></div>
   <div class="acb"><h3 class="${lk?'none':''}">${lk?'数据锁定':E(s.name)}</h3><i class="acl"></i>${L(s.desc)?`<p class="none">${ic('lock')} 升格效果 · 数据锁定</p>`:`<p>${HL(s.desc)}</p>`}${L(s.quote)?'':`<blockquote class="acq">「${E(s.quote)}」</blockquote>`}</div>
   <div class="acf">${ok?'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="2.4"/></svg><span>已解锁</span>':`${ic('lock')}<span>未解锁</span>`}</div></div>`}
function ascend(c){const {a,un,st,img}=asData(c);const has=!!a.art;const n=un.filter(Boolean).length;
  const bg=has?`background-image:url('${E(a.art)}');background-size:${img.w}px ${img.h}px;background-position:${img.x}px ${img.y}px`:'';
  const shards=ASIN.map((p,i)=>`<button type="button" class="ash${un[i]?'':' alk'}${i===asSel?' on':''}" data-asi="${i}" aria-label="升格 ${ROMAN[i]}${un[i]?'':'（未解锁）'}" aria-pressed="${i===asSel}" style="clip-path:polygon(${p.map(q=>q[0].toFixed(1)+'px '+q[1].toFixed(1)+'px').join(',')})"><span class="asimg" style="${bg}"></span><i class="asgl"></i></button>`).join('');
  const labs=ASLAB.map((q,i)=>`<span class="aslb${un[i]?'':' alk'}${i===5?' ult':''}${i===asSel?' on':''}" data-asl="${i}" style="left:${q[0]}px;top:${q[1]}px"><b>${ROMAN[i]}</b><i></i>${un[i]?'<em>◆</em>':ic('lock')}</span>`).join('');
  const segs=ASIN.map(p=>`<polygon points="${p.map(q=>q.join(',')).join(' ')}"/>`).join('');
  const petals=Array.from({length:16},(_,i)=>`<i style="--x:${(i*137)%1100+380}px;--d:${9+(i*7)%9}s;--dl:-${(i*1.3)%9}s;--s:${i%4?5:12}px"></i>`).join('');
  return `<div class="asd${has?'':' noart'}${asSel>=0?' sel':''}" data-fx="2d">
  <div class="asstage"><div class="asbg" aria-hidden="true"><i class="b1"></i><i class="b2"></i><i class="b3"></i><svg viewBox="0 0 1920 1080"><circle cx="960" cy="560" r="520"/><circle cx="960" cy="560" r="430" class="d"/><path d="M670 80h28M684 66v28"/></svg></div>
  <svg class="asflower" viewBox="0 0 520 620" aria-hidden="true">${asFlower()}</svg>
  <div class="asfx" aria-hidden="true">
    <svg class="ascrack" viewBox="0 0 1920 1080"><defs><filter id="asglow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter></defs>
      <g class="cg">${segs}</g><g class="cl">${segs}</g><g class="cf">${segs}</g>
      ${asSel>=0?`<g class="csel"><polygon points="${ASIN[asSel].map(q=>q.join(',')).join(' ')}"/></g>`:''}</svg></div>
  <div class="asshards">${shards}</div>
  <div class="aslabs" aria-hidden="true">${labs}</div>
  <div class="asdust" aria-hidden="true">${petals}</div>
  <div class="ascrumb"><span>///</span><div><b>角色养成 <i>/</i> 升格</b><small>DEVELOPMENT <i>/</i> ASCENSION</small></div></div>
  <div class="asname"><b>${E(c.name||'')}</b><small>${E((c.roman||'').toUpperCase())}</small><i class="sl"></i><h2>升格</h2><em>ASCENSION</em><i class="ln"></i></div>
  <div class="aswm" aria-hidden="true"><b>// 升格</b><span>ASCENSION</span></div>
  </div>
  <div class="ascside">${asSel>=0?asCard(c,asSel):''}</div>
  <div class="ascnt"><b>${st==null?'— —':String(n).padStart(2,'0')}<small>/06</small></b><em><i></i>${st==null?'数据锁定':n>=6?'升格完成':'升格中'}</em><span class="wv"></span></div>
  <button type="button" class="asview" data-asview ${has?'':'disabled'}><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M14 4h6v6M20 4l-8 8M18 14v6H4V6h6" fill="none" stroke="currentColor" stroke-width="2"/></svg><i></i><span>${has?'查看原画':'原画 · 数据锁定'}</span></button>
  ${has?`<div class="asviewer" hidden role="dialog" aria-label="原画"><img src="${E(a.art)}" alt="${E(c.name)} 升格原画"><button type="button" class="avx" data-asclose aria-label="关闭">${ic('close')}</button><small>${E(c.name)} · ASCENSION ART</small></div>`:''}
  </div>`}
function asFlower(){/* 左下装饰：铃兰花枝（纯 SVG 自绘） */
  let h='<path class="st" d="M40 610C120 470 210 390 330 330S470 250 500 180"/><path class="st t" d="M150 470c40-70 110-110 170-120"/>';
  const bells=[[330,330],[372,302],[410,272],[445,240],[475,205],[300,350],[262,372],[230,398],[200,428],[170,456]];
  bells.forEach(([x,y],i)=>{const s=1-i%5*.08;h+=`<g transform="translate(${x} ${y+16}) scale(${s})"><path class="pd" d="M0 -18v10"/><path class="bl" d="M-11 0c0-10 5-14 11-14s11 4 11 14c-3-2-5 2-7 0-2 2-6 2-8 0-2 2-4-2-7 0z"/></g>`});
  h+='<path class="lf" d="M60 600C80 520 140 460 230 430c-60 40-110 100-130 170z"/>';return h}
function asApply(){const pane=$('.pane[data-p=ascend]');if(!pane)return;const d=pane.querySelector('.asd');if(!d)return;
  d.classList.toggle('sel',asSel>=0);
  d.querySelectorAll('.ash').forEach((b,i)=>{b.classList.toggle('on',i===asSel);b.setAttribute('aria-pressed',i===asSel)});
  d.querySelectorAll('.aslb').forEach((b,i)=>b.classList.toggle('on',i===asSel));
  const svg=d.querySelector('.ascrack');svg.querySelector('.csel')?.remove();
  if(asSel>=0){svg.insertAdjacentHTML('beforeend',`<g class="csel pulse"><polygon points="${ASIN[asSel].map(q=>q.join(',')).join(' ')}"/></g>`)}
  d.querySelector('.ascside').innerHTML=asSel>=0?asCard(cur,asSel):'';
  if(as3)as3.select(asSel)}
async function as3Mount(){const pane=$('.pane[data-p=ascend]');const d=pane&&pane.querySelector('.asd');if(!d||as3||as3Busy||as3Off)return;
  const force=new URLSearchParams(location.search).get('fx');
  if(force==='2d'||(force!=='3d'&&(app.classList.contains('mob')||matchMedia('(prefers-reduced-motion: reduce)').matches)))return;
  const {a,un,img}=asData(cur);if(!a.art&&force!=='3d')return;
  try{const t=document.createElement('canvas');if(!(t.getContext('webgl2')))return}catch(e){return}
  as3Busy=true;const who=cur;
  try{const m=await import('./ascend3d.js');
    if(who!==cur||tab!=='ascend'){as3Busy=false;return}
    as3=await m.mount(d.querySelector('.asfx'),{polys:ASIN,art:a.art?await YJ.src(a.art):null,img,unlocked:un,sel:asSel,stage:{w:1920,h:1080}});as3For=who;
    as3.onSlow=()=>{if(force==='3d')return;as3Off=true;as3Drop();};
    d.dataset.fx='3d';as3.start()}catch(e){console.warn('升格 3D 不可用，使用 2D 版',e);as3=null}
  as3Busy=false}
function as3Drop(){if(as3){as3.destroy();as3=null}const d=document.querySelector('.pane[data-p=ascend] .asd');if(d)d.dataset.fx='2d'}
function asTab(){if(tab==='ascend'){if(as3&&as3For!==cur)as3Drop();if(as3)as3.start();else as3Mount()}else if(as3)as3.stop()}
$('#panes').addEventListener('click',e=>{const pane=e.target.closest('.pane[data-p=ascend]');if(!pane)return;let b;
  if(b=e.target.closest('[data-asi]')){const i=+b.dataset.asi;asSel=i;asApply();const p=pane.querySelector('.csel');return}
  if(e.target.closest('[data-asview]')){const v=pane.querySelector('.asviewer');if(v){v.hidden=false;requestAnimationFrame(()=>v.classList.add('open'));v.querySelector('.avx').focus()}return}
  if(e.target.closest('[data-asclose]')||e.target.classList.contains('asviewer')){const v=pane.querySelector('.asviewer');v.classList.remove('open');setTimeout(()=>v.hidden=true,220);return}
  if(!e.target.closest('.ascard,.asview,button')&&asSel>=0){asSel=-1;asApply()}});
addEventListener('keydown',e=>{if(e.key!=='Escape'||tab!=='ascend')return;const v=document.querySelector('.pane[data-p=ascend] .asviewer');
  if(v&&!v.hidden){v.classList.remove('open');setTimeout(()=>v.hidden=true,220)}else if(asSel>=0){asSel=-1;asApply()}});
new MutationObserver(asTab).observe(app,{attributes:true,attributeFilter:['data-tab']});
function archive(c){const p=c.profile||{};
  const rows=(p.rows||[]).map(([k,v])=>`<div class="r"><dt>${E(k)}</dt><dd>${E(v)}</dd></div>`).join('');
  const q=(p.quotes||[]).map(x=>`<blockquote>「${E(x)}」</blockquote>`).join('');
  const rel=(p.relations||[]).map(r=>{const o=byId(r.id);const nm=o?o.name:r.id;return `<a class="rel" ${o?`href="character.html?id=${encodeURIComponent(o.id)}" data-id="${E(o.id)}"`:''}><b>${E(nm)}</b><em>${E(r.label)}</em><p>${E(r.desc)}</p></a>`}).join('');
  return `<div class="card big arpane">
    <div class="arl">${PH('档案','ARCHIVE')}<dl>${rows||`<div class="r"><dt>档案</dt><dd>${LK()}</dd></div>`}</dl>${(p.locks||[]).length?`<div class="locks">${p.locks.map(x=>LK(x)).join('')}</div>`:''}</div>
    <div class="arr">${q?`${PH('台词','VOICE')}<div class="qs">${q}</div>`:''}${rel?`${PH('关系','RELATIONS')}<div class="rels">${rel}</div>`:''}
    ${c.page?`<a class="full" href="${E(c.page)}">查看完整档案页 <i>▸</i></a>`:''}</div></div>`}

async function render(c,anim=true){
  cur=c;document.title=`${c.name} · 角色 · 源界 ASTERIAL`;
  const i=C.indexOf(c);$('#no').innerHTML=`<span class="bcd"></span>No. ${String(i+1).padStart(3,'0')}${c.code?`<em>${E(c.code)}</em>`:''}`;
  $('#footcode').textContent=`SYN-${String(7400+i*13).padStart(4,'0')}-${String(i+1).padStart(2,'0')}`;
  $('#ghost').textContent=(c.roman||'').split(' ')[0]||'';
  $('#ident').innerHTML=ident(c);fitName();
  $('#panes').innerHTML=`<section class="pane" data-p="detail">${detail(c)}</section><section class="pane" data-p="skill">${skill(c)}</section><section class="pane" data-p="module">${module(c)}</section><section class="pane" data-p="spectrum">${spectrum(c)}</section><section class="pane" data-p="ascend">${ascend(c)}</section><section class="pane" data-p="archive">${archive(c)}</section>`;
  if(as3){as3.destroy();as3=null}asSel=-1;setTab(tab,true);spKick();asTab();
  app.classList.remove('in');void app.offsetWidth;if(anim)app.classList.add('in');else app.classList.add('in','now');
  const p=c.portrait||{};
  if(p.breath)art.dataset.breath='1';else art.removeAttribute('data-breath');
  if(p.blink)art.dataset.blink=p.blink;else art.removeAttribute('data-blink');
  if(p.orb)art.dataset.orb=p.orb;else art.removeAttribute('data-orb');
  if(p.orbAnchor){art.dataset.orbX=p.orbAnchor.x;art.dataset.orbY=p.orbAnchor.y}else{art.removeAttribute('data-orb-x');art.removeAttribute('data-orb-y')}
  if(p.motion)art.dataset.motion=p.motion;else art.removeAttribute('data-motion');
  if(p.src){art.hidden=false;$('#noart').hidden=true;art.classList.remove('ok');
    const url=await YJ.src(p.src);
    art.onload=async()=>{if(cur!==c)return;
      if(!p.crop||!p.bbox){try{const det=await YJ.detect(art);p.bbox=p.bbox||det.bbox;p.face=p.face||det.face;p.alpha=det.alpha;const m=p.mode&&p.mode!=='auto'?p.mode:det.mode;p.crop=p.crop||YJ.computeCrop(det,m,art.naturalWidth/art.naturalHeight)}catch(e){p.crop={x:.5,y:.5,zoom:1}}}
      YJ.place(art,p,artbox);art.classList.add('ok');if(YJ.onArtPlaced)YJ.onArtPlaced()};
    art.src=url;art.alt=`${c.name}立绘`}
  else{art.hidden=true;art.removeAttribute('src');art.removeAttribute('data-breath');art.removeAttribute('data-blink');art.removeAttribute('data-orb');art.removeAttribute('data-orb-x');art.removeAttribute('data-orb-y');art.removeAttribute('data-motion');$('#noart').hidden=false;$('#nfch').textContent=[...(c.name||'')][0]||'';if(YJ.onArtPlaced)YJ.onArtPlaced()}
  rosterMark()}

function setTab(t,quiet){tab=t;app.dataset.tab=t;
  document.querySelectorAll('#rail button').forEach(b=>{b.setAttribute('aria-selected',b.dataset.t===t);if(b.dataset.t===t&&app.classList.contains('mob')){const r=$('#rail');r.scrollTo({left:b.offsetLeft-r.clientWidth/2+b.offsetWidth/2,behavior:quiet?'auto':'smooth'})}});
  document.querySelectorAll('.pane').forEach(p=>p.classList.toggle('on',p.dataset.p===t));
  if(!quiet){const u=new URL(location);u.searchParams.set('tab',t);history.replaceState(null,'',u)}}
$('#panes').addEventListener('click',e=>{
  const g=e.target.closest('[data-go]');if(g){setTab(g.dataset.go);return}
  const n=e.target.closest('[data-skn]');if(n){skSel=n.dataset.skn;$('.pane[data-p=skill]').innerHTML=skill(cur);return}
  if(e.target.closest('[data-ultfx]')){const sd=SKD[cur.id];if(sd)ultFx(sd);return}
  const d=e.target.closest('[data-sk]');if(d){skillSel=+d.dataset.sk;const sl=S.skillSlots[skillSel];if(sl)skSel='skill:'+sl.slot;$('.pane[data-p=skill]').innerHTML=skill(cur);setTab('skill');return}
  const s=e.target.closest('[data-sel]');if(s){skillSel=+s.dataset.sel;$('.pane[data-p=skill]').innerHTML=skill(cur);return}
  const r=e.target.closest('a.rel[data-id]');if(r){e.preventDefault();go(r.dataset.id)}});

/* 名册 */
async function buildRoster(){
  let h='';
  for(const g of S.groups){const list=C.filter(c=>c.group===g.id);if(!list.length)continue;
    h+=`<div class="rg"><h3><span>${E(g.name)}</span><em>${list.length}</em></h3><div class="rt">`;
    for(const c of list){const k=cls(c.cls),e=el(c.element);
      h+=`<a class="tile" href="character.html?id=${encodeURIComponent(c.id)}" data-id="${E(c.id)}"><span class="th" data-src="${E(c.portrait&&c.portrait.src||'')}"><b>${E([...(c.name||'?')][0])}</b></span><span class="num">${String(C.indexOf(c)+1).padStart(3,'0')}</span><span class="ce2">${k?`<img src="${E(k.icon)}" alt="">`:''}${e?`<img src="${E(e.icon)}" alt="">`:''}</span><span class="tn"><b>${E(c.name)}</b><small>${k?E(k.name):'职业 未定'} ／ ${e?E(e.name):'元素 未定'}</small></span>${L(c.stars)?'':`<span class="tst">${'★'.repeat(c.stars)}</span>`}</a>`}
    h+='</div></div>'}
  const orphans=C.filter(c=>!S.groups.some(g=>g.id===c.group));
  if(orphans.length)h+=`<div class="rg"><h3><span>其他</span><em>${orphans.length}</em></h3><div class="rt">${orphans.map(c=>`<a class="tile" href="character.html?id=${encodeURIComponent(c.id)}" data-id="${E(c.id)}"><span class="th"><b>${E([...(c.name||'?')][0])}</b></span><span class="tn"><b>${E(c.name)}</b></span></a>`).join('')}</div></div>`;
  $('#rbody').innerHTML=`<div class="rcols">${h}</div>`;
  for(const th of document.querySelectorAll('.th[data-src]')){const src=th.dataset.src;if(!src)continue;const c=byId(th.parentElement.dataset.id);
    const url=await YJ.src(src);const im=new Image();im.onload=async()=>{const p=c.portrait;if(!p.face){try{const d=await YJ.detect(im);p.face=d.face;p.bbox=p.bbox||d.bbox}catch(e){}}
      const f=p.face||{x:.5,y:.25,size:.2};const ar=im.naturalWidth/im.naturalHeight;const s=Math.max(1.2,.42/(f.size||.2));
      th.style.backgroundImage=`url("${url}")`;th.style.backgroundSize=`${s*ar*100*(th.offsetHeight/th.offsetWidth||1.25)}% auto`;
      th.style.backgroundPosition=`${f.x*100}% ${Math.max(0,f.y*100-6)}%`;th.classList.add('has')};im.src=url}}
function rosterMark(){document.querySelectorAll('.roster .tile').forEach(t=>t.classList.toggle('on',cur&&t.dataset.id===cur.id))}
function openR(){$('#roster').hidden=false;requestAnimationFrame(()=>$('#roster').classList.add('open'))}
function closeR(){if(!cur)return;$('#roster').classList.remove('open');setTimeout(()=>$('#roster').hidden=true,260)}
$('#swapbtn').addEventListener('click',openR);$('#rclose').addEventListener('click',closeR);
addEventListener('keydown',e=>{if(e.key==='Escape')closeR()});
$('#rbody').addEventListener('click',e=>{const t=e.target.closest('.tile');if(!t)return;e.preventDefault();go(t.dataset.id);closeR()});
function go(id){const c=byId(id);if(!c)return;app.classList.remove('pick');$('#rclose').hidden=false;const u=new URL(location);u.searchParams.set('id',c.id);history.pushState(null,'',u);skillSel=0;skSel='skill:skill';spSel=0;spx=null;asSel=-1;render(c)}
addEventListener('popstate',()=>{const id=new URLSearchParams(location.search).get('id');const c=byId(id);if(c)render(c,false)});

await buildRoster();
const qs=new URLSearchParams(location.search);const id=qs.get('id');tab=TABS.some(t=>t[0]===qs.get('tab'))?qs.get('tab'):'detail';
const first=byId(id);
if(first){if(id&&id!==first.id){const u=new URL(location);u.searchParams.set('id',first.id);history.replaceState(null,'',u)}render(first)}else{app.classList.add('pick');$('#rclose').hidden=true;openR()}
})();

