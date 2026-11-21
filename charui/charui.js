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
const {characterStars}=await import('./rarity.js');

try{D=await YJ.load()}catch(e){document.body.insertAdjacentHTML('beforeend','<p class="err">人物数据载入失败。</p>');return}
S=D.settings;C=D.characters;
const progress=await import(new URL('js/battle/progression.js',location.href).href);
const statDef=await (await fetch('data/battle/stats.json')).json();
let player=progress.loadPlayer();
const savedCharacter=character=>progress.playable(character.id)&&!YJ.useDraft;
const rawSkills = {};
const sheet=character=>savedCharacter(character)?progress.characterSheet(statDef,character,rawSkills[character.id],player):character;
function trainingButton(action,level,cap,label) {
  const cost=progress.upgradeCost(action,level);
  const full=level>=cap;
  return `<button type="button" data-train="${action}" ${full||player.material<cost?'disabled':''}>${full?'已满级':`${label} · ${cost} 素材`}</button>`;
}
/* 技能页：战斗逻辑层 js/battle（纯 ES Module）+ data/skills/<id>.json */
try{BT=await import(new URL('js/battle/index.js',location.href).href);const ix=await (await fetch('data/skills/index.json',{cache:'no-cache'})).json();
  for(const id of ix.ids){try{
    const data=await (await fetch('data/skills/'+id+'.json',{cache:'no-store'})).json();
    rawSkills[id]=data;
    SKD[id]=BT.skillView(progress.resolveSkills(data));
  }catch(e){console.warn(id,e)}}}catch(e){console.warn('技能数据载入失败',e)}
if(YJ.useDraft&&localStorage.getItem(YJ.DRAFT_KEY))$('#draftbar').hidden=false;
$('#bgimg').src=await YJ.src(S.background);
$('#rail').innerHTML=TABS.map(([k,n,e],i)=>`<button type="button" role="tab" data-t="${k}" aria-selected="${i?'false':'true'}"><span class="ti">${ic({detail:'detail',skill:'skill',module:'module',spectrum:'spectrum',ascend:'ascend',archive:'archive'}[k])}</span><b>${n}</b><small>${e}</small></button>`).join('')+'<div class="rfoot"><i></i><i></i><i></i><span>ASTERIAL</span></div>';
$('#rail').addEventListener('click',e=>{const b=e.target.closest('button');if(b)setTab(b.dataset.t)});
$('.swap .si').innerHTML=ic('swap');$('.back .bk').innerHTML=ic('back');

function fit(){
  const desk=innerWidth>900&&innerWidth>=innerHeight*1.05;
  app.classList.toggle('desk',desk);app.classList.toggle('mob',!desk);document.body.style.overflow=desk?'hidden':'auto';
  app.style.setProperty('--mk',Math.min(1,innerWidth/1920));if(desk){const k=Math.min(innerWidth/1920,innerHeight/1080);stage.style.transform=`translate(-50%,-50%) scale(${k})`}else stage.style.transform='';
  if(art.naturalWidth&&cur)YJ.place(art,cur.portrait||{},artbox);
  if(YJ.onArtPlaced)YJ.onArtPlaced()}
addEventListener('resize',fit);fit();

function stars(c){
  const unknown=L(c.stars);
  const count=unknown ? S.starMax||6 : c.stars;
  return characterStars(count,unknown);
}
/* 字标按名字长度缩放。 */
function profileHeading(c){
  const name=c.name||'';
  const runs=name.split(/([·・•])/);
  const lettering=runs.map(run=>/^[·・•]$/.test(run)?`<tspan font-size="50">${E(run)}</tspan>`:E(run)).join('');
  const advance=[...name].reduce((width,ch)=>{
    if (/[·・•]/.test(ch)) return width+26;
    return width+(/[a-z0-9]/i.test(ch)?49:73);
  },0);
  const width=Math.max(advance+10,20);
  const title=`<h1 class="profile-title" aria-label="${E(name)}" style="--word-aspect:${width/110}">
    <svg viewBox="0 0 ${width} 110" aria-hidden="true"><text x="4" y="85" textLength="${Math.max(advance,1)}" lengthAdjust="spacingAndGlyphs" transform="translate(-12 0) skewX(8)">${lettering}</text></svg>
  </h1>`;
  return `<header class="profile-heading">
    ${stars(c)}
    <div class="profile-band">${title}</div>
  </header>`;
}

function detail(c){
  c=sheet(c);
  const technique={daier:'演出即将开始',liselotte:'战前部署'}[c.id];
  const k=cls(c.cls),e=el(c.element);const lv=c.level||{};
  const lvl=L(lv.cur)?`<b class="lvn none">--</b><span class="lvm">/--</span>`:`<b class="lvn">${E(lv.cur)}</b><span class="lvm">/${E(L(lv.max)?'--':lv.max)}</span>`;
  const pct=!L(lv.cur)&&!L(lv.max)&&lv.max>0?Math.min(100,lv.cur/lv.max*100):0;
  const stats=S.stats.map(s=>{const raw=(c.stats||{})[s.key];const v=typeof raw==='number'?Number(raw.toFixed(2)):raw;return `<li><span class="si">${ic(s.icon)}</span><span class="sn">${E(s.label)}</span>${L(v)?`<span class="sv none">— —</span>`:`<span class="sv">${E(v)}${s.unit&&!String(v).includes(s.unit)?s.unit:''}</span>`}</li>`}).join('');
  const sk=S.skillSlots.map((s,i)=>{const d=(c.skills||[]).find(x=>x.slot===s.slot)||{};return `<button type="button" class="dia${L(d.name)?' lkd':''}" data-sk="${i}"><span class="dg"><i></i>${YJ.slotIcon(s.icon)}</span><b>${E(s.label)}</b><small>${E((s.slot||'').toUpperCase())}</small></button>`}).join('');
  const PHI=`<span class="phi" aria-hidden="true"></span>`;
  return `${profileHeading(c)}
  <div class="card cecard">
    <div class="cc">${k?`<img src="${E(k.icon)}" alt="职业">`:PHI}<b class="${k?'':'none'}">${k?E(k.name):'数据锁定'}</b></div>
    <div class="cc" ${e?`style="--ec:${e.color}"`:''}>${e?`<img src="${E(e.icon)}" alt="元素">`:PHI}<b class="${e?'':'none'}">${e?E(e.name):'数据锁定'}</b></div>
  </div>
  <div class="card lvcard">
    <div class="lvrow">${savedCharacter(c)?`<small class="mat-balance">素材 ${player.material}</small>`:''}<span class="lvl">LV.</span>${lvl}${!L(lv.cur)&&lv.cur===lv.max?'<span class="cap">等级上限 ✓</span>':L(lv.cur)?LK('等级 · 数据锁定'):''}</div>
    <div class="bar${pct?'':' none'}"><i style="width:${pct}%"></i></div>
    <div class="btns">${savedCharacter(c)?trainingButton('level',lv.cur,lv.max,'升级')+'<a href="battle3d/?engine=unity&from='+encodeURIComponent(c.id)+'">出战</a>':''}${technique?`<button type="button" data-prepare="${c.id}" title="${technique}，持续20秒">战前秘技</button>`:''}<button type="button" data-go="ascend">${ic('ascend')}升格预览<i>▸</i></button>${c.page?`<a href="${E(c.page)}">${ic('archive')}完整档案<i>▸</i></a>`:''}</div>
  </div>
  <div class="card stcard">${PH(savedCharacter(c)?'实战属性':'基础属性','ATTRIBUTES')}<ul class="stats">${stats}</ul></div>
  <div class="card skcard">${PH('技能','SKILLS')}<div class="dias">${sk}</div></div>
`}

function skill(c){
  const raw=rawSkills[c.id];
  if (!savedCharacter(c) || !raw?.skills.every(skill=>skill.scaling || skill.rankOne)) return SKD[c.id]?skillNet(c,SKD[c.id]):skillOld(c);
  const saved=player.characters[c.id];
  const data=progress.resolveSkills(raw,saved.skillLevels,{},saved.ascension);
  const active=nodes=>nodes.map(node=>node.unlockLevel==null?node:{...node,unlocked:saved.level>=node.unlockLevel});
  return skillNet(c,BT.skillView({...data,potential:{major:active(data.potential.major),minor:active(data.potential.minor)}}));
}
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
const PNAME={healRatio:'治疗生命倍率',healFlat:'固定治疗',bloomRatio:'持续治疗生命倍率',hitRatio:'花信生命倍率',streak:'每层连击增伤',transfer:'转火首段增伤',echo:'回响 · 每段生命倍率',joint:'协同 · 每段生命倍率',mult:'伤害倍率',dreamMarkBonus:'梦痕增伤',toughness:'削韧',markDuration:'梦痕持续',replayRatio:'复现比例',domainReplayRatio:'幻海复现比例',aoeMult:'全体倍率',hits:'追加段数',hitMult:'每段倍率',enemyDelay:'敌方行动延后',domainRounds:'幻海持续',replayBonus:'复现增伤',domainExtra:'幻海延长',defIgnore:'无视防御'};
const PFMT={healRatio:'%',bloomRatio:'%',hitRatio:'%',streak:'%',transfer:'%',echo:'%',joint:'%',mult:'%',dreamMarkBonus:'%',replayRatio:'%',domainReplayRatio:'%',aoeMult:'%',hitMult:'%',enemyDelay:'%',replayBonus:'%',defIgnore:'%',markDuration:'回合',domainRounds:'轮',domainExtra:'轮',hits:'段'};
const pv=(k,v)=>PFMT[k]==='%'?`${+(v*100).toFixed(1)}%`:PFMT[k]?`${v} ${PFMT[k]}`:String(v);
/* 网络坐标（1920×1080 舞台） */
const SKX=[560,760,960,1160],NETC=[860,800];
const MAJ={A:[610,800],B:[860,520],C:[1110,800]};
const MAJ6={I:[560,580],II:[860,520],III:[1160,580],IV:[560,820],V:[860,860],VI:[1160,820]};
const ROMANP='ⅠⅡⅢⅣⅤⅥ';
const MIN=[[860,610],[860,680],[455,740],[505,670],[1265,740],[1215,670]];
const MIN9=[[430,810],[390,730],[455,655],[520,720],[1290,810],[1330,730],[1265,655],[860,610],[800,680],[1200,720]];
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
  const desc=n.kind==='minor'?`${E(d.name)} ${minorVal}${(sd.id==='rin'||d.unlockLevel)?'':'（暂定）'}`:d.desc?HLS(d.desc):'<span class="none">数据锁定</span>';
  const cost=(d.scaling || d.rankOne) && progress.upgradeCost('skillLevel',d.trained);
  const next=d.ranks?.[d.trained];
  const tags=(d.type||[]).slice(0,3);
  return `<div class="skc">
    <div class="skch"><span class="skci">${icon}</span><div class="skct"><small>${E(label)}</small><h3>${E(d.name||'数据锁定')}</h3>
      <span class="sklv">${LV(d.level,d.maxLevel)}</span>${tags.length?`<div class="sktags">${tags.map(t=>`<em>${E(t)}</em>`).join('')}</div>`:''}</div></div>
    <div class="skcd">${desc}</div>
    <div class="skcs"><h4><i></i>升级预览</h4><table>${(d.scaling || d.rankOne)?d.growth.map(key=>[key,d.params[key]]).map(([key,value])=>`<tr><td>${E(PNAME[key])}</td><td>${pv(key,value)}</td><td class="ar">▸</td><td>${next?pv(key,next[key]):'已满级'}</td></tr>`).join(''):params.map(([k,v])=>`<tr><td>${E(k)}</td><td>${E(v)}</td><td class="ar">▸</td><td class="nx none">数据锁定</td></tr>`).join('')||'<tr><td class="none" colspan="4">数据锁定</td></tr>'}</table></div>
    ${d.scaling?`<div class="skcs"><h4><i></i>升级消耗</h4><b>${next?cost+' 素材':'已满级'}</b> · 持有 ${player.material}</div>`:d.unlockLevel?`<div class="skcs">等级 ${d.unlockLevel} 解锁 · ${d.unlocked?'已激活':'未激活'}</div>`:`<div class="skcs"><h4><i></i>升级消耗</h4><div class="skmat">${[0,1].map(()=>`<div class="mt"><span>${ic('lock')}</span><b class="none">数据锁定</b></div>`).join('')}</div></div>`}
    ${key==='skill:ultimate'?`<button type="button" class="skfxbtn" data-ultfx>▶ 预览演出</button>`:''}
    ${(d.scaling || d.rankOne)?`<button type="button" class="skup" data-train="skillLevel" data-slot="${E(d.slot)}" ${!next||player.material<cost?'disabled':''}>${next?'升级':'已满级'}<i>»</i></button>`:d.unlockLevel?'':`<button type="button" class="skup" disabled>升级<small>数据锁定</small><i>»</i></button>`}
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
    line(MAJ.C,MIN9[4],lit(mi[4])),line(MIN9[4],MIN9[5],lit(mi[5])),line(MIN9[5],MIN9[6],lit(mi[6])),
    mi[9]?line(MIN9[6],MIN9[9],lit(mi[9])):''
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
  if (['shen','eliot','liselotte','daier'].includes(sd.id)) {
    const video=document.createElement('video');
    video.src='assets/battle/ult/'+sd.id+'-ult.mp4'+(sd.id==='daier'?'?v=silent-original':'');
    video.playsInline=true;
    o.setAttribute('aria-label',u.name+' · 点击关闭');
    const close=()=>{video.pause();o.remove()};
    video.onended=close;
    o.onclick=close;
    o.appendChild(video);stage.appendChild(o);
    video.play().catch(()=>{video.controls=true});
    return;
  }
  o.innerHTML=`<div class="ufbg"></div>${[0,1,2,3].map(i=>`<i class="rp" style="--d:${i*.28}s"></i>`).join('')}<div class="uft"><small>ULTIMATE</small><b>${E(u.name||'')}</b>${(u.previewTag||(sd.id==='siwei'?'幻海展开':''))?`<em>${E(u.previewTag||'幻海展开')}</em>`:''}</div>${[0,1,2].map(i=>`<i class="sl" style="--d:${1.5+i*.22}s;--r:${[-24,18,-6][i]}deg"></i>`).join('')}<i class="aoe"></i><span class="ufhint">点击关闭 · 正式演出待美术</span>`;
  stage.appendChild(o);const close=()=>{o.remove()};o.addEventListener('click',close);setTimeout(close,3600)}
/* 模组：版式依据她给的模组设计图；内容全部来自 c.module，未设定显示「数据锁定」 */
const HL=t=>E(t).replace(/==(.+?)==/g,'<em class="hl">$1</em>').replace(/\n/g,'<br>');
const MSTAR='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 1.5l2.3 8.2 8.2 2.3-8.2 2.3L12 22.5l-2.3-8.2L1.5 12l8.2-2.3z"/></svg>';
function module(c){c=sheet(c);const m=c.module||{};const lk=L(m.name);const lv=m.level||{};const ef=m.effect||{};
  const ro=m.roman||c.roman||'';const pct=(!L(lv.cur)&&!L(lv.max)&&+lv.max>0)?Math.min(100,lv.cur/lv.max*100):0;
  const refinement=savedCharacter(c) && player.characters[c.id].refinement;
  const stats=(m.stats&&m.stats.length?m.stats:[{key:'atk'},{key:'hp'},{key:'spd'}]).map(x=>{const d=S.stats.find(s=>s.key===x.key)||{label:x.key,icon:'lock'};
    return `<div class="mst"><span class="mk">${ic(d.icon)}<b>${E(d.label)}</b></span>${L(x.value)?'<em class="none">— —</em>':`<em>${E(x.value)}</em>`}</div>`}).join('');
  const starN=L(m.stars)?0:+m.stars;
  return `<div class="mxd${lk?' lkd':''}">
    <div class="mxno"><b>MODULE</b><small>// EXCLUSIVE</small>${m.no?`<em>${E(m.no)}</em>`:''}</div>
    <div class="mxart">${m.art?`<div class="mxfloat"><img class="mxobject" src="${E(m.art)}" alt="${E(m.name||'模组')}"><img class="mxfoil" src="${E(m.art)}" alt="" aria-hidden="true"></div>`:`<div class="mxlock">${ic('lock')}<b>模组立绘 · 数据锁定</b></div>`}</div>
    <div class="mxfoot"><b>${E(ro||'— —')} //</b><b>EXCLUSIVE MODULE</b><span class="bc"></span></div>
    <div class="mxtop"><small>// MODULE</small><i></i></div>
    <div class="mxcol">
      <div class="mc mname"><i class="mcfx" aria-hidden="true"></i><span class="mtag">专属模组</span>
        <div class="mnr"><h2 class="${lk?'none':''}">${lk?'数据锁定':E(m.name)}</h2>${ro?`<small>${E(ro)}</small>`:''}</div>
        <div class="mstars">${starN?Array.from({length:starN},()=>MSTAR).join(''):'<span class="none">星级 · 数据锁定</span>'}</div>
        <svg class="mseal" viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="50" cy="50" r="37" fill="none" stroke="currentColor" stroke-width=".8" stroke-dasharray="2 4"/><path d="M28 74L72 26" stroke="currentColor" stroke-width="2"/><path d="M60 30c-12 6-20 18-24 34 10-6 18-14 24-34z" fill="currentColor" opacity=".55"/></svg></div>
      <div class="mc mlv"><i class="mcfx" aria-hidden="true"></i><div class="lvr"><span class="lvt">LV.</span>${L(lv.cur)?'<b class="none">— —</b>':`<b>${E(lv.cur)}</b>`}<span class="lvm">/${L(lv.max)?'— —':E(lv.max)}</span>
        ${savedCharacter(c)?`<div class="gear-controls">${refinement?`<label>试用精炼 <select data-refinement>${[1,2,3,4,5].map(rank=>`<option value="${rank}" ${rank===refinement?'selected':''}>${rank}</option>`).join('')}</select></label>`:''}${trainingButton("moduleLevel",lv.cur,lv.max,"强化")}<button type="button" data-train="toggleModule">${player.characters[c.id].module?"卸下":"装备"}</button><small>素材 ${player.material}</small></div>`:`<button type="button" class="rebuild" disabled>${ic('lock')}<span>重构</span><i><svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 8a8 8 0 0 0-14 1M5 16a8 8 0 0 0 14-1" fill="none" stroke="currentColor" stroke-width="2"/><path d="M19 3v5h-5M5 21v-5h5" fill="none" stroke="currentColor" stroke-width="2"/></svg></i></button>`}</div>
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
function spData(c){const sp=savedCharacter(c)?progress.loadout(c,player).spectrum:c.spectrum&&!Array.isArray(c.spectrum)?c.spectrum:{};const n=S.spectrumSlots||6;
  const slots=Array.from({length:n},(_,i)=>(sp.slots||[])[i]||{});return {sp,slots,set:sp.sets?.find(set=>set.name===slots[spSel]?.set)||sp.set||{},inv:sp.inventory||[]}}
function spWave(){return '<canvas class="spwave" width="640" height="168" aria-hidden="true"></canvas>'}
function spTile(s,i,on){const lk=L(s.name);
  return `<button type="button" class="spt p${i+1}${on?' on':''}${lk?' lkd':''}" data-spi="${i}" aria-label="${lk?`频谱 ${pad2(i+1)} 数据锁定`:E(s.name)}">
    <span class="spn">${pad2(i+1)}</span><span class="spim">${s.icon?`<img src="${E(s.icon)}" alt="">`:`<i class="spl">${ic('lock')}<b>数据锁定</b></i>`}</span>
    <span class="spb">${L(s.plus)?'':`<b>+${E(s.plus)}</b>`}<span class="sps">${L(s.stars)?'':Array.from({length:+s.stars},()=>SPSTAR).join('')}</span></span><i class="spy"></i>${on?'<i class="spk"></i>':''}</button>`}
function spRing(selectedSlot, slotCount){const V='viewBox="-500 -500 1000 1000" aria-hidden="true"';return `<div class="spring">
  <svg class="rl" ${V}><circle class="spticks" r="481" pathLength="360" stroke-dasharray=".32 2.68"/>
    <g transform="rotate(${selectedSlot*360/slotCount})">
      <path class="spsector" d="M-58 -478 Q0 -486 58 -478"/>
      <path class="spindex" d="M-5 -493h10l-5 7z"/>
    </g></svg>
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
  <div class="spbg" aria-hidden="true"></div>
  <div class="spcrumb"><span class="sl">///</span><div><b>角色养成 <i>/</i> 频谱</b><small>DEVELOPMENT <i>/</i> SPECTRUM</small></div></div>
  <div class="sphead"><h2>频谱装载</h2><small>SPECTRUM ARRAY</small>${L(sp.intro)?'':`<p>${HLB(sp.intro)}</p>`}</div>
  <div class="sparr">${spRing(spSel,n)}
    <div class="spcore"><svg class="spstar" viewBox="0 0 100 100" aria-hidden="true"><path d="M50 4l6 38 38 8-38 8-6 38-6-38-38-8 38-8z"/></svg>${spWave()}
      <small>SPECTRUM</small><i></i><b>${pad2(loaded)}/${pad2(n)}</b><em>${loaded===n?'装载完成':loaded?'部分装载':'数据锁定'}</em></div>
    ${slots.map((x,i)=>spTile(x,i,i===spSel)).join('')}</div>
  <div class="spcnt"><b>${pad2(loaded)}<small>/${pad2(n)}</small></b><em>${loaded===n?'装载完成':loaded?'部分装载':'数据锁定'}</em><span class="bc"></span></div>
  <div class="spcard${lk?' lkd':''}">
    <div class="sch"><div class="sct"><div class="scno"><i>频谱</i> <b>${pad2(spSel+1)}</b>${lk?'':'<span class="sctag">已装载</span>'}</div>
      <h3>${lk?(savedCharacter(c)?'未装载':'数据锁定'):E(s.name)}</h3><small>SPECTRUM RECORD</small></div>
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
  <div class="spact">${savedCharacter(c)?`<button type="button" class="unl" data-train="unload" ${loaded?"":"disabled"}>一键卸下</button>${lk?'<button type="button" disabled>选择一件频谱</button>':trainingButton("spectrum",s.level,15,"强化")}<small>培养素材 ${player.material}</small>`:`<button type="button" class="unl" disabled>${ic('unload')}<span>一键卸下</span></button><button type="button" class="enh" disabled>${ic('ffw')}<span>强化</span></button>`}</div>
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
  const same=!sel||sel._k==='s'+(pos-1)||L(sel.name)||(savedCharacter(c)&&sel.pos!==pos);
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
     <p class="sxtip">${savedCharacter(c)?'同槽位频谱可以互换。确认后，属性将在下一场战斗生效。':'频谱配置预览'}</p></div>
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
function refreshTraining(){
  if(!cur||!savedCharacter(cur))return;
  $('.pane[data-p=detail]').innerHTML=detail(cur);
  $('.pane[data-p=module]').innerHTML=module(cur);
  $('.pane[data-p=skill]').innerHTML=skill(cur);
  spRefresh();
}
async function train(action,index){
  const id=cur.id;
  try{player=await progress.saveChange(save=>progress.changePlayer(save,id,action,index))}
  catch(error){player=progress.loadPlayer();window.alert(error.message)}
  refreshTraining();
}
$('#panes').addEventListener('click',event=>{
  const button=event.target.closest('[data-train]');
  if(button&&!button.disabled&&savedCharacter(cur))train(button.dataset.train,button.dataset.slot ?? player.characters[cur.id].equipped[spSel]);
});
$('#panes').addEventListener('change',event=>{
  if(event.target.matches('[data-refinement]') && savedCharacter(cur)) train('refinement',Number(event.target.value));
});
addEventListener('storage',event=>{if(event.key===progress.SAVE_KEY||event.key===null){player=progress.loadPlayer();refreshTraining()}});
addEventListener('pageshow',event=>{if(event.persisted){player=progress.loadPlayer();refreshTraining()}});
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
    if(savedCharacter(cur)){if(sel&&sel.pos===spx.pos){spx=null;train('equip',sel.index)}return}
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
const glassLayouts = await fetch('assets/ascend/glass-layout.json').then(response=>response.json()).catch(()=>({}));
function glassLayout(character, ascension, unlocked) {
  const params=new URLSearchParams(location.search);
  if(params.has('fx')||params.get('bloom')==='1'||YJ.useDraft)return null;
  const layout=glassLayouts[character.id];
  if(!layout||layout.art!==ascension.art)return null;
  const focus=ascension.focus||{};
  const matchesFocus=layout.focus.every((value,index)=>value===[focus.x,focus.y,focus.w][index]);
  return matchesFocus&&layout.unlocked===unlocked.map(Number).join('')?layout:null;
}
function glassPlates(character,layout) {
  const scaled=value=>`${value*.75}px`;
  const tiles=layout.tiles.map(([left,top,width,height],index)=>`<i class="glass-piece" style="left:${scaled(left)};top:${scaled(top)};width:${scaled(width)};height:${scaled(height)};--phase:${-index*.9}s"><img decoding="async" src="assets/ascend/glass/${encodeURIComponent(character.id)}-${index+1}.webp" width="${width}" height="${height}" alt=""></i>`);
  return `<div class="glass-plates" aria-hidden="true">${tiles.join('')}</div>`;
}
function asData(c){const a=c.ascension||{};const sh=Array.from({length:6},(_,i)=>(a.shards||[])[i]||{});const st=c.levelStats && savedCharacter(c)?player.characters[c.id].ascension:L(a.stage)?null:+a.stage;
  const un=sh.map((s,i)=>s.unlocked===true||s.unlocked===false?s.unlocked:(st!=null&&i<st));
  const f=a.focus||{};const iw=+f.w||1820,ih=iw*941/1672;const fx=L(f.x)?.7:+f.x,fy=L(f.y)?.27:+f.y;
  const img={x:920-fx*iw,y:316-fy*ih,w:iw,h:ih};return {a,sh,st,un,img}}
function asCard(c,i){const {a,sh,un,img}=asData(c);const s=sh[i]||{};const lk=L(s.name);const ok=un[i];const unknown=c.id==='rin'&&s.unlocked==null&&L(a.stage);
  const p=ASPOLY[i];const xs=p.map(q=>q[0]),ys=p.map(q=>q[1]);const bx=Math.min(...xs),by=Math.min(...ys),bw=Math.max(...xs)-bx,bh=Math.max(...ys)-by;
  const CW=416,CH=230;const k=Math.max(CW/bw,CH/bh)*1.15;const cx=bx+bw/2,cy=by+bh/2;
  const top=s.art?`<img src="${E(s.art)}" alt="">`:a.art?`<span class="acimg" style="background-image:url('${E(a.art)}');background-size:${img.w*k}px ${img.h*k}px;background-position:${CW/2-(cx-img.x)*k}px ${CH/2-(cy-img.y)*k}px"></span>`:`<span class="acimg none">${ic('lock')}</span>`;
  return `<div class="ascard${ok?'':' lkd'}${i===5?' ult':''}" role="region" aria-label="升格 ${ROMAN[i]}"><div class="act">${top}<i class="acsh"></i><b class="acr">${ROMAN[i]}</b></div>
   <div class="acb"><h3 class="${lk?'none':''}">${lk?'数据锁定':E(s.name)}</h3><i class="acl"></i>${L(s.desc)?`<p class="none">${ic('lock')} 升格效果 · 数据锁定</p>`:`<p>${HL(s.desc)}</p>`}${L(s.quote)?'':`<blockquote class="acq">「${E(s.quote)}」</blockquote>`}</div>
   <div class="acf">${ok?'<svg class="ic" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" stroke-width="2.4"/></svg><span>已解锁</span>':unknown?`${ic('lock')}<span>数据锁定</span>`:`${ic('lock')}<span>未解锁</span>`}</div></div>`}
function ascend(c){const {a,un,st,img}=asData(c);const has=!!a.art;const n=un.filter(Boolean).length;
  const glass=glassLayout(c,a,un);
  const bg=has?`background-image:url('${E(a.art)}');background-size:${img.w}px ${img.h}px;background-position:${img.x}px ${img.y}px`:'';
  const shards=ASIN.map((p,i)=>`<button type="button" class="ash${un[i]?'':' alk'}${i===asSel?' on':''}" data-asi="${i}" aria-label="升格 ${ROMAN[i]}${un[i]?'':'（未解锁）'}" aria-pressed="${i===asSel}" style="clip-path:polygon(${p.map(q=>q[0].toFixed(1)+'px '+q[1].toFixed(1)+'px').join(',')})"><span class="asimg" style="${bg}"></span><i class="asgl"></i></button>`).join('');
  const labs=ASLAB.map((q,i)=>`<span class="aslb${un[i]?'':' alk'}${i===5?' ult':''}${i===asSel?' on':''}" data-asl="${i}" style="left:${q[0]}px;top:${q[1]}px"><b>${ROMAN[i]}</b><i></i>${un[i]?'<em>◆</em>':ic('lock')}</span>`).join('');
  const segs=ASIN.map(p=>`<polygon points="${p.map(q=>q.join(',')).join(' ')}"/>`).join('');
  const petals=Array.from({length:16},(_,i)=>`<i style="--x:${(i*137)%1100+380}px;--d:${9+(i*7)%9}s;--dl:-${(i*1.3)%9}s;--s:${i%4?5:12}px"></i>`).join('');
  return `<div class="asd${has?'':' noart'}${asSel>=0?' sel':''}" data-fx="${glass?'glass':'2d'}">
  <div class="asstage"><div class="asbg" aria-hidden="true"></div>
  <svg class="asflower" viewBox="0 0 520 620" aria-hidden="true">${asFlower()}</svg>
  <svg class="asshadow" viewBox="0 0 1920 1080" aria-hidden="true"><defs><filter id="as-shadow"><feGaussianBlur stdDeviation="22"/></filter></defs><g transform="translate(0 18)" filter="url(#as-shadow)">${segs}</g></svg>
  <div class="asfx" aria-hidden="true">
    <svg class="ascrack" viewBox="0 0 1920 1080"><defs><filter id="asglow" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="5"/></filter></defs>
      <g class="cg">${segs}</g><g class="cl">${segs}</g><g class="cf">${segs}</g>
      ${asSel>=0?`<g class="csel"><polygon points="${ASIN[asSel].map(q=>q.join(',')).join(' ')}"/></g>`:''}</svg></div>
  <div class="asshards">${shards}</div>
  ${glass?glassPlates(c,glass):''}
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
  d.querySelectorAll('.glass-piece').forEach((plate,index)=>plate.classList.toggle('on',index===asSel));
  const svg=d.querySelector('.ascrack');svg.querySelector('.csel')?.remove();
  if(asSel>=0&&d.dataset.fx==='2d'){svg.insertAdjacentHTML('beforeend',`<g class="csel pulse"><polygon points="${ASIN[asSel].map(q=>q.join(',')).join(' ')}"/></g>`)}
  d.querySelector('.ascside').innerHTML=asSel>=0?asCard(cur,asSel):'';
  if(as3)as3.select(asSel)}
async function as3Mount(){const pane=$('.pane[data-p=ascend]');const d=pane&&pane.querySelector('.asd');if(!d||as3||as3Busy||as3Off)return;
  if(d.dataset.fx==='glass')return;
  const force=new URLSearchParams(location.search).get('fx');
  if(!window.Worker||!HTMLCanvasElement.prototype.transferControlToOffscreen)return;
  if(force==='2d'||(force!=='3d'&&(app.classList.contains('mob')||matchMedia('(prefers-reduced-motion: reduce)').matches)))return;
  const {a,un,img}=asData(cur);if(!a.art&&force!=='3d')return;
  as3Busy=true;const who=cur;
  try{const m=await import('./ascend-view.js');
    const artUrl=a.art?new URL(await YJ.src(a.art),document.baseURI).href:null;
    if(!d.isConnected||tab!=='ascend'||document.hidden)return;
    d.dataset.fx='loading';
    as3=m.mount(d.querySelector('.asfx'),{polys:ASIN,art:artUrl,img,unlocked:un,sel:asSel,stage:{w:1920,h:1080},bloom:new URLSearchParams(location.search).get('bloom')==='1'},{
      ready:()=>{d.dataset.fx='3d'},
      slow:()=>{if(force!=='3d'){as3Off=true;as3Drop()}},
      failed:message=>{console.warn('升格 3D 不可用，使用 2D 版',message);as3Off=true;as3Drop()}
    });
    as3For=who;asTab()}catch(e){d.dataset.fx='2d';console.warn('升格 3D 不可用，使用 2D 版',e)}
  finally{as3Busy=false;if(!d.isConnected)asTab()}}
function as3Drop(){if(as3){as3.destroy();as3=null}const d=document.querySelector('.pane[data-p=ascend] .asd');if(d)d.dataset.fx='2d'}
function asTab(){
  if(tab!=='ascend'||document.hidden||$('.asd .asviewer.open')){as3?.stop();return}
  if(as3&&as3For!==cur)as3Drop();
  if(as3)as3.start();else as3Mount()}
document.addEventListener('visibilitychange',asTab);
$('#panes').addEventListener('click',e=>{const pane=e.target.closest('.pane[data-p=ascend]');if(!pane)return;let b;
  if(b=e.target.closest('[data-asi]')){const index=Number(b.dataset.asi);if(index!==asSel){asSel=index;asApply()}return}
  if(e.target.closest('[data-asview]')){const v=pane.querySelector('.asviewer');if(v){v.hidden=false;requestAnimationFrame(()=>{v.classList.add('open');asTab()});v.querySelector('.avx').focus()}return}
  if(e.target.closest('[data-asclose]')||e.target.classList.contains('asviewer')){closeArtViewer(pane.querySelector('.asviewer'));return}
  if(!e.target.closest('.ascard,.asview,button')&&asSel>=0){asSel=-1;asApply()}});
addEventListener('keydown',e=>{if(e.key!=='Escape'||tab!=='ascend')return;const v=document.querySelector('.pane[data-p=ascend] .asviewer');
  if(v&&!v.hidden){closeArtViewer(v)}else if(asSel>=0){asSel=-1;asApply()}});
function closeArtViewer(viewer){viewer.classList.remove('open');asTab();setTimeout(()=>{if(!viewer.classList.contains('open'))viewer.hidden=true},220)}
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
  cur=c;app.dataset.id=c.id;document.title=`${c.name} · 角色 · 源界 ASTERIAL`;
  $('#bgimg').src=c.background||await YJ.src(S.background);
  if(cur!==c)return;
  const i=C.indexOf(c);$('#no').innerHTML=`<span class="bcd"></span>No. ${String(i+1).padStart(3,'0')}${c.code?`<em>${E(c.code)}</em>`:''}`;
  $('#footcode').textContent=`SYN-${String(7400+i*13).padStart(4,'0')}-${String(i+1).padStart(2,'0')}`;
  $('#ghost').textContent=(c.roman||'').split(' ')[0]||'';
  const quote=c.profile?.quotes?.[0];
  $('#ident').innerHTML=`<b class="archive-name">${E(c.name)}</b>${quote?`<blockquote class="vq"><i>VOICE</i>「${E(quote)}」</blockquote>`:''}`;
  $('#panes').innerHTML=`<section class="pane" data-p="detail">${detail(c)}</section><section class="pane" data-p="skill">${skill(c)}</section><section class="pane" data-p="module">${module(c)}</section><section class="pane" data-p="spectrum">${spectrum(c)}</section><section class="pane" data-p="ascend">${ascend(c)}</section><section class="pane" data-p="archive">${archive(c)}</section>`;
  const glassPane=$('.asd[data-fx="glass"]');
  if(glassPane){
    Promise.all(Array.from(glassPane.querySelectorAll('.glass-piece img'),image=>image.decode())).catch(()=>{if(glassPane.isConnected){glassPane.dataset.fx='2d';asTab()}});
  }
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
  document.querySelectorAll('.pane').forEach(p=>{const active=p.dataset.p===t;p.classList.toggle('on',active);p.inert=!active});
  if(!quiet){const u=new URL(location);u.searchParams.set('tab',t);history.replaceState(null,'',u)}}
$('#panes').addEventListener('click',e=>{
  const prep=e.target.closest('[data-prepare]');
  if(prep){
    const id=prep.dataset.prepare;
    sessionStorage.setItem('yuanjie.nextTechnique',JSON.stringify({id,expires:Date.now()+20000}));
    prep.textContent=id==='daier'?'候场中 · 点击出战':'战备中 · 点击出战';
    prep.disabled=true;
    setTimeout(()=>{prep.disabled=false;prep.textContent='战前秘技'},20000);
    return;
  }
  const g=e.target.closest('[data-go]');if(g){setTab(g.dataset.go);return}
  const n=e.target.closest('[data-skn]');if(n){skSel=n.dataset.skn;$('.pane[data-p=skill]').innerHTML=skill(cur);return}
  if(e.target.closest('[data-ultfx]')){const sd=SKD[cur.id];if(sd)ultFx(sd);return}
  const d=e.target.closest('[data-sk]');if(d){skillSel=+d.dataset.sk;const sl=S.skillSlots[skillSel];if(sl){const slot=({normal:'basic',ult:'ultimate'})[sl.slot]||sl.slot;skSel='skill:'+slot}$('.pane[data-p=skill]').innerHTML=skill(cur);setTab('skill');return}
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
let rosterBuilt=false;
function openR(){if(!rosterBuilt){rosterBuilt=true;buildRoster().then(rosterMark)}$('#roster').hidden=false;requestAnimationFrame(()=>$('#roster').classList.add('open'))}
function closeR(){if(!cur)return;$('#roster').classList.remove('open');setTimeout(()=>$('#roster').hidden=true,260)}
$('#swapbtn').addEventListener('click',openR);$('#rclose').addEventListener('click',closeR);
addEventListener('keydown',e=>{if(e.key==='Escape')closeR()});
$('#rbody').addEventListener('click',e=>{const t=e.target.closest('.tile');if(!t)return;e.preventDefault();go(t.dataset.id);closeR()});
function go(id){const c=byId(id);if(!c)return;app.classList.remove('pick');$('#rclose').hidden=false;const u=new URL(location);u.searchParams.set('id',c.id);history.pushState(null,'',u);skillSel=0;skSel='skill:skill';spSel=0;spx=null;asSel=-1;render(c)}
addEventListener('popstate',()=>{const id=new URLSearchParams(location.search).get('id');const c=byId(id);if(c)render(c,false)});

const qs=new URLSearchParams(location.search);const id=qs.get('id');tab=TABS.some(t=>t[0]===qs.get('tab'))?qs.get('tab'):'detail';
const first=byId(id);
if(first){if(id&&id!==first.id){const u=new URL(location);u.searchParams.set('id',first.id);history.replaceState(null,'',u)}render(first)}else{app.classList.add('pick');$('#rclose').hidden=true;openR()}
})();

