const portraits = {shen:'shen-stand.webp',rin:'rin-open.png',eliot:'eliot-stand.webp',siwei:'siwei-stand.webp',dekeke:'dekeke-stand.webp',vera:'vera-stand.webp'};
const metrics = {damage:['伤害','总伤害','输出最高'],heal:['治疗','有效治疗','治疗最高'],taken:['承伤','总承伤','承伤最高']};
const format = new Intl.NumberFormat('zh-CN',{maximumFractionDigits:0});
export function collectReport(battle, result, squad) {
  const members = battle.units.filter(unit=>unit.side==='ally').map(({id,name})=>({id,name,damage:0,heal:0,taken:0}));
  const byId = new Map(members.map(member=>[member.id,member]));
  for (const event of battle.bus.log) {
    const value = Number.isFinite(event.amount) ? Math.max(0,event.amount) : 0;
    if (event.type==='damage' && event.attacker.side!==event.target.side) {
      if (event.target.side==='enemy' && byId.has(event.attacker.id)) byId.get(event.attacker.id).damage+=value;
      if (event.target.side==='ally' && byId.has(event.target.id)) byId.get(event.target.id).taken+=value;
    }
    if (event.type==='heal' && byId.has(event.source?.id) && event.target.side==='ally') byId.get(event.source.id).heal+=value;
  }
  return {members, win:result==='win', rounds:battle.timeline.round, squad};
}
function element(tag, className, text) {
  const item = document.createElement(tag);
  item.className=className;
  if (text!=null) item.textContent=text;
  return item;
}
function imageFor(member, style) {
  const image=element('img',style);
  image.alt='';
  const file=portraits[member.id];
  if (file) image.src=new URL('../assets/art/'+file,import.meta.url).href;
  return image;
}
export function openReport(report, {reward='', restart, returnURL, returnLabel='角色养成', demo=false}={}) {
  const dialog=element('dialog','operation-report');
  dialog.dataset.outcome=report.win?'win':'lose';
  dialog.setAttribute('aria-labelledby','report-title');
  const sheet=element('div','report-sheet');
  const header=element('header','report-header');
  const brand=element('b','report-brand','源界');
  brand.prepend(element('i','report-insignia'));
  header.append(brand,element('span','report-file',demo?'战报预览':'作战记录'),element('span','report-squad',report.squad),element('strong','report-round','第 '+report.rounds+' 轮'));
  const hero=element('section','report-hero');
  const portraitFrame=element('div','report-portrait');
  const heroCaption=element('div','report-caption');
  const leaderLabel=element('span','report-leader');
  const heroName=element('strong','report-name');
  heroCaption.append(leaderLabel,heroName);
  hero.append(portraitFrame,heroCaption);
  const panel=element('section','report-panel');
  const heading=element('div','report-heading');
  const title=element('h1','report-title',report.win?'战斗胜利':'战斗失利');
  title.id='report-title';
  heading.append(title);
  const score=element('div','report-score');
  const scoreLabel=element('span','report-score-label');
  const scoreValue=element('strong','report-score-value');
  score.append(scoreLabel,scoreValue);
  heading.append(score);
  const filters=element('div','report-filters');
  filters.setAttribute('role','group'); filters.setAttribute('aria-label','统计指标');
  const ranks=element('ol','report-ranks');
  const footer=element('footer','report-footer');
  if (reward) footer.append(element('span','report-reward',reward));
  if (returnURL) {const back=element('a','report-return',returnLabel); back.href=returnURL;footer.append(back);}
  const again=element('button','report-again',demo?'进入实战':'再来一局');
  again.append(element('span','report-arrow','↗'));
  again.type='button';
  again.onclick=()=>{dialog.close();dialog.remove();restart();};
  footer.append(again);
  const draw=metric=>{
    const sorted=[...report.members].sort((first,second)=>second[metric]-first[metric]);
    const total=sorted.reduce((sum,member)=>sum+member[metric],0);
    scoreLabel.textContent=metrics[metric][1]; scoreValue.textContent=format.format(total);
    ranks.replaceChildren();
    const leader=sorted[0];
    ranks.style.setProperty('--value-digits',String(format.format(leader?.[metric] ?? 0).replaceAll(',','').length));
    ranks.style.setProperty('--value-separators',String((format.format(leader?.[metric] ?? 0).match(/,/g) || []).length));
    if (leader) {
      if (portraitFrame.dataset.member!==leader.id) {portraitFrame.replaceChildren(imageFor(leader,'report-hero-art')); portraitFrame.dataset.member=leader.id;}
      heroName.textContent=leader.name; leaderLabel.textContent=total?metrics[metric][2]:'出战队员';
    }
    for (const [index,member] of sorted.entries()) {
      const fraction=total?member[metric]/total:0;
      const row=element('li','report-row');
      row.dataset.member=member.id;
      if (index===0 && total>0) row.classList.add('report-first');
      const tile=element('div','report-avatar'); tile.append(imageFor(member,'report-face')); tile.dataset.member=member.id;
      const line=element('div','report-row-main');
      const top=element('div','report-row-head');
      const share=element('span','report-share',(fraction*100).toFixed(1)+'%');
      top.append(element('strong','report-call',member.name),share);
      const track=element('div','report-track'); const fill=element('i','report-fill');fill.style.width=(fraction*100)+'%';track.append(fill);
      line.append(top,track);
      tile.append(element('span','report-rank',String(index+1).padStart(2,'0')));
      row.append(tile,line,element('b','report-amount',format.format(member[metric])));
      ranks.append(row);
    }
    for(const button of filters.children)button.setAttribute('aria-pressed',String(button.dataset.metric===metric));
  };
  for(const [key,labels] of Object.entries(metrics)){
    const button=element('button','report-filter',labels[0]);button.type='button';button.dataset.metric=key;button.onclick=()=>draw(key);filters.append(button);
  }
  panel.append(heading,filters,ranks,footer);sheet.append(header,hero,panel);dialog.append(sheet);document.body.append(dialog);
  dialog.addEventListener('cancel',event=>event.preventDefault());
  dialog.addEventListener('keydown',event=>event.stopPropagation());
  dialog.tabIndex=-1;
  draw('damage');dialog.showModal();dialog.focus({preventScroll:true});
  return dialog;
}
