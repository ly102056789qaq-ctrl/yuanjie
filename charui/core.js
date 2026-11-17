/* 源界 · 角色界面 共享核心：数据载入、草稿、自动识别裁切、图标
   人物内容全部来自 data/characters.json（或编辑器里的本地草稿），这里不写任何角色设定。 */
(function(){
const YJ=window.YJ={};
YJ.DATA_URL='data/characters.json';
YJ.DRAFT_KEY='yj-charui-draft';
/* 立绘舞台（桌面 1920×1080 画面里的立绘区）——自动裁切按这个比例算 */
YJ.BOX={w:980,h:1080};

/* ---------- IndexedDB：编辑器上传的图片 ---------- */
function idb(){return new Promise((ok,no)=>{const r=indexedDB.open('yj-charui',1);r.onupgradeneeded=()=>r.result.createObjectStore('files');r.onsuccess=()=>ok(r.result);r.onerror=()=>no(r.error)})}
YJ.putFile=async(key,blob)=>{const db=await idb();return new Promise((ok,no)=>{const t=db.transaction('files','readwrite');t.objectStore('files').put(blob,key);t.oncomplete=ok;t.onerror=()=>no(t.error)})};
YJ.getFile=async key=>{const db=await idb();return new Promise(ok=>{const t=db.transaction('files');const q=t.objectStore('files').get(key);q.onsuccess=()=>ok(q.result||null);q.onerror=()=>ok(null)})};
YJ.allFiles=async()=>{const db=await idb();return new Promise(ok=>{const out={};const t=db.transaction('files');const c=t.objectStore('files').openCursor();c.onsuccess=()=>{const cur=c.result;if(cur){out[cur.key]=cur.value;cur.continue()}else ok(out)}})};
YJ.delFile=async key=>{const db=await idb();return new Promise(ok=>{const t=db.transaction('files','readwrite');t.objectStore('files').delete(key);t.oncomplete=ok})};
const urlCache={};
YJ.src=async path=>{if(!path)return null;if(urlCache[path])return urlCache[path];
  if(YJ.useDraft){try{const b=await YJ.getFile(path);if(b){urlCache[path]=URL.createObjectURL(b);return urlCache[path]}}catch(e){}}
  return path};

/* ---------- 数据 ---------- */
YJ.useDraft=/[?&]draft=1/.test(location.search);
YJ.load=async(opts={})=>{
  const draft=opts.draft??YJ.useDraft;
  if(draft){const s=localStorage.getItem(YJ.DRAFT_KEY);if(s){try{return JSON.parse(s)}catch(e){}}}
  const r=await fetch(YJ.DATA_URL,{cache:'no-cache'});return r.json()};
YJ.locked=v=>v===null||v===undefined||v===''||(Array.isArray(v)&&!v.length);
YJ.esc=s=>String(s??'').replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* ---------- 自动识别裁切 ----------
   透明 PNG：用 alpha 通道求主体外框。
   不透明图：从四边取背景色，按“颜色接近背景且与邻近像素平滑相连”从边缘向内泛洪，剩下的就是主体；
   取最大且靠中间的连通块（并入相邻的碎块，如发梢、手），得到外框。
   脸：浏览器支持 FaceDetector 时优先用；否则在外框顶部找肤色像素的中心，再不行按头身比估算。 */
YJ.detect=async function(img){
  const N=256,ar=img.naturalWidth/img.naturalHeight;
  const W=ar>=1?N:Math.round(N*ar),H=ar>=1?Math.round(N/ar):N;
  const cv=document.createElement('canvas');cv.width=W;cv.height=H;const cx=cv.getContext('2d',{willReadFrequently:true});
  cx.drawImage(img,0,0,W,H);const d=cx.getImageData(0,0,W,H).data;const n=W*H;
  let tr=0;for(let i=0;i<n;i++)if(d[i*4+3]<24)tr++;
  const alpha=tr>n*0.03;const fg=new Uint8Array(n);
  if(alpha){for(let i=0;i<n;i++)fg[i]=d[i*4+3]>48?1:0}
  else{
    /* 背景色簇 */
    const hist={};const border=[];
    for(let x=0;x<W;x++)for(const y of [0,1,2,H-1,H-2,H-3])border.push(y*W+x);
    for(let y=0;y<H;y++)for(const x of [0,1,2,W-1,W-2,W-3])border.push(y*W+x);
    border.forEach(i=>{const k=(d[i*4]>>4)+'|'+(d[i*4+1]>>4)+'|'+(d[i*4+2]>>4);(hist[k]=hist[k]||[]).push(i)});
    const cl=Object.values(hist).sort((a,b)=>b.length-a.length);let acc=0;const bgs=[];
    for(const g of cl){let r=0,gg=0,b=0;g.forEach(i=>{r+=d[i*4];gg+=d[i*4+1];b+=d[i*4+2]});bgs.push([r/g.length,gg/g.length,b/g.length]);acc+=g.length;if(acc>border.length*.85||bgs.length>8)break}
    const dbg=i=>{let m=1e9;for(const c of bgs){const dr=d[i*4]-c[0],dg=d[i*4+1]-c[1],db=d[i*4+2]-c[2];const v=dr*dr+dg*dg+db*db;if(v<m)m=v}return Math.sqrt(m)};
    const nd=(a,b)=>Math.abs(d[a*4]-d[b*4])+Math.abs(d[a*4+1]-d[b*4+1])+Math.abs(d[a*4+2]-d[b*4+2]);
    const bg=new Uint8Array(n);const q=[];
    border.forEach(i=>{if(!bg[i]&&dbg(i)<60){bg[i]=1;q.push(i)}});
    while(q.length){const i=q.pop();const x=i%W,y=(i/W)|0;
      for(const j of [x>0?i-1:-1,x<W-1?i+1:-1,y>0?i-W:-1,y<H-1?i+W:-1]){if(j<0||bg[j])continue;
        const dist=dbg(j);if(dist<34||(nd(i,j)<16&&dist<110)){bg[j]=1;q.push(j)}}}
    for(let i=0;i<n;i++)fg[i]=bg[i]?0:1;
    /* 开运算去噪 */
    const er=new Uint8Array(n);for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;er[i]=fg[i]&&fg[i-1]&&fg[i+1]&&fg[i-W]&&fg[i+W]?1:0}
    for(let i=0;i<n;i++)fg[i]=0;for(let y=1;y<H-1;y++)for(let x=1;x<W-1;x++){const i=y*W+x;if(er[i]||er[i-1]||er[i+1]||er[i-W]||er[i+W])fg[i]=1}
  }
  /* 连通块 */
  const lab=new Int32Array(n).fill(-1);const comps=[];
  for(let s=0;s<n;s++){if(!fg[s]||lab[s]>=0)continue;const id=comps.length;const c={a:0,x0:W,y0:H,x1:0,y1:0,sx:0};const st=[s];lab[s]=id;
    while(st.length){const i=st.pop();const x=i%W,y=(i/W)|0;c.a++;c.sx+=x;if(x<c.x0)c.x0=x;if(x>c.x1)c.x1=x;if(y<c.y0)c.y0=y;if(y>c.y1)c.y1=y;
      for(const j of [x>0?i-1:-1,x<W-1?i+1:-1,y>0?i-W:-1,y<H-1?i+W:-1])if(j>=0&&fg[j]&&lab[j]<0){lab[j]=id;st.push(j)}}
    comps.push(c)}
  let bb;
  if(!comps.length){bb={x0:0,y0:0,x1:W-1,y1:H-1}}
  else{
    comps.forEach(c=>{const mx=c.sx/c.a/W;c.score=c.a*(1-.7*Math.abs(mx-.5))});
    comps.sort((a,b)=>b.score-a.score);const m=comps[0];bb={x0:m.x0,y0:m.y0,x1:m.x1,y1:m.y1};
    const pad=Math.max(W,H)*.03;
    for(let pass=0;pass<2;pass++)for(const c of comps.slice(1)){if(c.a<m.a*.015)continue;
      if(c.x1>=bb.x0-pad&&c.x0<=bb.x1+pad&&c.y1>=bb.y0-pad&&c.y0<=bb.y1+pad){bb.x0=Math.min(bb.x0,c.x0);bb.y0=Math.min(bb.y0,c.y0);bb.x1=Math.max(bb.x1,c.x1);bb.y1=Math.max(bb.y1,c.y1)}}
  }
  const bbox=[bb.x0/W,bb.y0/H,(bb.x1+1)/W,(bb.y1+1)/H];
  const bw=bbox[2]-bbox[0],bh=bbox[3]-bbox[1];
  const tall=(bh*H)/(bw*W);
  const cutBottom=bbox[3]>.97;
  const mode=(!cutBottom&&tall>1.25)||tall>2.3?'full':'half';
  /* 脸 */
  let face=null;
  if('FaceDetector' in window){try{const fd=new FaceDetector({fastMode:true,maxDetectedFaces:1});const fs=await fd.detect(img);
    if(fs.length){const b=fs[0].boundingBox;face={x:(b.x+b.width/2)/img.naturalWidth,y:(b.y+b.height/2)/img.naturalHeight,size:b.height/img.naturalHeight,by:'detector'}}}catch(e){}}
  if(!face){
    const head=mode==='full'?bh/7.2:Math.min(bh/3.2,bw*W/H*.55);
    const y0=Math.floor(bbox[1]*H),y1=Math.min(H,Math.ceil((bbox[1]+head*1.6)*H));
    let sx=0,sy=0,c=0,mx=0,mc=0;
    for(let y=y0;y<y1;y++)for(let x=Math.floor(bbox[0]*W);x<Math.ceil(bbox[2]*W);x++){const i=y*W+x;if(!fg[i])continue;mx+=x;mc++;
      const r=d[i*4],g=d[i*4+1],b=d[i*4+2];if(r>170&&g>130&&b>110&&r>=g&&g>=b-8&&r-b>8&&r-b<90){sx+=x;sy+=y;c++}}
    if(c>12){face={x:sx/c/W,y:Math.min(sy/c/H,bbox[1]+head*1.05),size:head,by:'skin'}}
    else face={x:mc?mx/mc/W:(bbox[0]+bw/2),y:bbox[1]+head*.6,size:head,by:'estimate'};
  }
  return {bbox:bbox.map(v=>+v.toFixed(4)),face:{x:+face.x.toFixed(4),y:+face.y.toFixed(4),size:+(face.size||bh/6).toFixed(4),by:face.by},mode,alpha};
};
/* 由外框和模式算出裁切：crop.x/crop.y 是放在立绘舞台中心的图片坐标（0–1），crop.zoom 是图片高 ÷ 舞台高 */
YJ.computeCrop=function(det,mode,aspect,box=YJ.BOX){
  const [x0,y0,x1,y1]=det.bbox;const bh=y1-y0,bw=x1-x0;let zoom,x,y;
  if(mode==='full'){zoom=.9/bh;x=x0+bw/2;y=y0+(.5-.06)/zoom}
  else{const fx=det.face?det.face.x:x0+bw/2,fy=det.face?det.face.y:y0+bh*.15;
    zoom=Math.min(1.18/Math.max(bh,.35),box.w*1.05/(bw*aspect*box.h));if(det.face&&det.face.size)zoom=Math.min(zoom,.26/det.face.size);
    zoom=Math.max(zoom,1);x=fx;y=fy+(.5-.28)/zoom}
  return {x:+x.toFixed(4),y:+y.toFixed(4),zoom:+zoom.toFixed(4)}};
/* 把裁切应用到 img（box 为舞台元素） */
YJ.place=function(img,p,box){
  const bw=box.offsetWidth,bh=box.offsetHeight,ar=img.naturalWidth/img.naturalHeight||1;
  const c=p.crop||{x:.5,y:.5,zoom:1};const h=c.zoom*bh,w=h*ar;
  img.style.width=w+'px';img.style.height=h+'px';img.style.left=(bw/2-c.x*w)+'px';img.style.top=(bh/2-c.y*h+bh*(YJ.SHIFT_Y??.07))+'px';
  const fade=p.fade??!p.alpha;
  if(fade&&p.bbox){const [a,b,cc,dd]=p.bbox.map(v=>v*100);const f=(p.feather??6);
    const m=`linear-gradient(90deg,transparent ${a-f}%,#000 ${a+f*.4}%,#000 ${cc-f*.4}%,transparent ${cc+f}%),linear-gradient(180deg,transparent ${b-f*1.5}%,#000 ${b+f*.3}%,#000 ${Math.max(dd-f*1.2,b+30)}%,transparent ${dd+2}%)`;
    img.style.webkitMaskImage=img.style.maskImage=m;img.style.webkitMaskComposite='source-in';img.style.maskComposite='intersect'}
  else{img.style.webkitMaskImage=img.style.maskImage='none'}};
YJ.thumbStyle=function(p,ar){/* 头像格：脸放中间偏上 */
  const f=p.face||{x:.5,y:.2,size:.2};const s=Math.max(1,.5/f.size);/* 头高占格子约一半 */
  return {size:`${s*ar*100}% ${s*100}%`,pos:f};};

/* ---------- 图标 ---------- */
const I={
 detail:'<path d="M5 3h10l4 4v14H5z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M8 10h8M8 14h8M8 18h5" stroke="currentColor" stroke-width="1.8"/>',
 skill:'<path d="M12 2l2.2 7.8L22 12l-7.8 2.2L12 22l-2.2-7.8L2 12l7.8-2.2z" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round"/><circle cx="12" cy="12" r="1.8" fill="currentColor"/>',
 module:'<path d="M12 2.5l8.3 4.8v9.4L12 21.5l-8.3-4.8V7.3z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 8l3.5 2v4L12 16l-3.5-2v-4z" fill="currentColor"/>',
 spectrum:'<path d="M4 20V12M8 20V6M12 20V9M16 20V3M20 20v-6" stroke="currentColor" stroke-width="2.2" stroke-linecap="square"/>',
 ascend:'<path d="M5 13l7-7 7 7M5 20l7-7 7 7" fill="none" stroke="currentColor" stroke-width="2"/>',
 archive:'<path d="M3 6h7l2 2h9v12H3z" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M7 13h10M7 16.5h6" stroke="currentColor" stroke-width="1.6"/>',
 hp:'<path d="M12 20s-7.5-4.6-7.5-10A4.3 4.3 0 0 1 12 7.4 4.3 4.3 0 0 1 19.5 10c0 5.4-7.5 10-7.5 10z" fill="currentColor"/>',
 atk:'<path d="M19.5 3.5l1 1-9.6 9.6-1-1zM4 20l3.7-1.2-2.5-2.5zM9.2 12.9l1.9 1.9-1.6 1.6-1.9-1.9zM6 14.5l3.5 3.5" stroke="currentColor" stroke-width="1.8" fill="currentColor"/>',
 def:'<path d="M12 2.5l7.5 3v6c0 4.6-3.2 8.4-7.5 10-4.3-1.6-7.5-5.4-7.5-10v-6z" fill="currentColor"/><path d="M12 6v12" stroke="#fff" stroke-width="1.4" opacity=".7"/>',
 spd:'<path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" fill="currentColor"/>',
 crit:'<path d="M12 2l1.8 6.2L20 6.3l-3.6 5.7L22 14l-6.3.8L16 21l-4-4.7L8 21l.3-6.2L2 14l5.6-2L4 6.3l6.2 1.9z" fill="currentColor"/>',
 critdmg:'<path d="M12 1.5l2 7.1 7-2.3-4.8 5.7 4.8 5.7-7-2.3-2 7.1-2-7.1-7 2.3 4.8-5.7L3 6.3l7 2.3z" fill="none" stroke="currentColor" stroke-width="1.6"/><circle cx="12" cy="12" r="2.4" fill="currentColor"/>',
 energy:'<circle cx="12" cy="12" r="8.5" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 3.5v3M12 17.5v3M3.5 12h3M17.5 12h3" stroke="currentColor" stroke-width="1.8"/><path d="M9 13.5l3-6 1 4.5h2l-3 5.5-.6-4z" fill="currentColor"/>',
 chev:'<path d="M5 9l7 7 7-7" fill="none" stroke="currentColor" stroke-width="2.4"/>',
 unload:'<rect x="4" y="4" width="16" height="16" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M5 19L19 5" stroke="currentColor" stroke-width="1.6"/>',
 ffw:'<path d="M3 5l7 7-7 7M12 5l7 7-7 7" fill="none" stroke="currentColor" stroke-width="2.6"/>',
 sort:'<path d="M7 4v16M3 16l4 4 4-4M17 20V4M13 8l4-4 4 4" fill="none" stroke="currentColor" stroke-width="1.8"/>',
 filter:'<path d="M3 5h18l-7 8v6l-4 2v-8z" fill="none" stroke="currentColor" stroke-width="1.8"/>',
 close:'<path d="M5 5l14 14M19 5L5 19" stroke="currentColor" stroke-width="2.2"/>',
 up:'<path d="M12 5l6 8h-4v6h-4v-6H6z" fill="currentColor"/>',
 down:'<path d="M12 19l6-8h-4V5h-4v6H6z" fill="currentColor"/>',
 xchg:'<path d="M4 8h14l-4-4M20 16H6l4 4" fill="none" stroke="currentColor" stroke-width="2.2"/>',
 lock:'<rect x="5" y="10.5" width="14" height="10" rx="1" fill="currentColor"/><path d="M8 10.5V7.8a4 4 0 0 1 8 0v2.7" fill="none" stroke="currentColor" stroke-width="2"/>',
 swap:'<circle cx="8" cy="8" r="3.4" fill="currentColor"/><path d="M2 20c.6-4 3-6 6-6s5.4 2 6 6z" fill="currentColor"/><circle cx="16.5" cy="7" r="2.8" fill="currentColor" opacity=".6"/><path d="M15 13.4c3.3-.4 6.3 1.4 7 5.6h-6" fill="currentColor" opacity=".6"/>',
 home:'<path d="M3 11l9-7.5 9 7.5M6 9.5V20h12V9.5" fill="none" stroke="currentColor" stroke-width="1.9"/>',
 back:'<path d="M15 4l-8 8 8 8" fill="none" stroke="currentColor" stroke-width="2.4"/>',
 /* 技能槽类型（48 视框，白色线稿） */
 normal:'<g fill="none" stroke="currentColor" stroke-linecap="round"><path d="M10 38C18 34 30 22 38 8" stroke-width="2.6"/><path d="M13 40c9-3 20-14 28-29" stroke-width="1.2" opacity=".6"/><ellipse cx="24" cy="30" rx="17" ry="5.5" stroke-width="1.4" opacity=".75" transform="rotate(-12 24 30)"/></g><path d="M38 8l1.6 4.2-4.4-1.2z" fill="currentColor"/>',
 skillslot:'<g fill="none" stroke="currentColor"><ellipse cx="24" cy="24" rx="19" ry="7" stroke-width="1.6"/><ellipse cx="24" cy="24" rx="12" ry="4.2" stroke-width="1" opacity=".6"/></g><path d="M24 8l2.4 13.6L40 24l-13.6 2.4L24 40l-2.4-13.6L8 24l13.6-2.4z" fill="currentColor"/>',
 ult:'<g fill="currentColor"><path d="M24 3l2 19 2-1-4 25-4-25 2 1z"/><path d="M14 14l1.3 13M34 14l-1.3 13M9 22l3 8M39 22l-3 8" stroke="currentColor" stroke-width="1.6" opacity=".7"/></g><ellipse cx="24" cy="38" rx="16" ry="4" fill="none" stroke="currentColor" stroke-width="1.4" opacity=".8"/>',
 talent:'<path d="M24 24c-4.5-6-8-8-11.5-8a8 8 0 0 0 0 16c3.5 0 7-2 11.5-8s8-8 11.5-8a8 8 0 0 1 0 16c-3.5 0-7-2-11.5-8z" fill="none" stroke="currentColor" stroke-width="2.4"/><path d="M24 10v4M24 34v4" stroke="currentColor" stroke-width="1.4" opacity=".6"/>'
};
YJ.icon=(k,cls='')=>{const big=['normal','skillslot','ult','talent'].includes(k);return `<svg class="ic ${cls}" viewBox="0 0 ${big?48:24} ${big?48:24}" aria-hidden="true">${I[k]||''}</svg>`};
YJ.slotIcon=s=>YJ.icon(s==='skill'?'skillslot':s);
})();
