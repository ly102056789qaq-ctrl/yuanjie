/* 源界 · shared UI */
(function(){
const io=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting){e.target.classList.add('in');io.unobserve(e.target)}}),{threshold:.12});
document.querySelectorAll('.scr').forEach(s=>io.observe(s));
/* mobile nav */
const b=document.querySelector('.mbtn'),n=document.getElementById('gnav');
if(b&&n){b.addEventListener('click',()=>{const o=document.body.classList.toggle('nav-open');b.setAttribute('aria-expanded',o)});
 n.querySelectorAll('a').forEach(a=>a.addEventListener('click',()=>{document.body.classList.remove('nav-open');b.setAttribute('aria-expanded','false')}))}
/* tabs on character pages */
const tabs=[...document.querySelectorAll('.tabs a')];
if(tabs.length){const t2=new IntersectionObserver(es=>es.forEach(e=>{if(e.isIntersecting)tabs.forEach(t=>t.classList.toggle('on',t.getAttribute('href')==='#'+e.target.id))}),{rootMargin:'-45% 0px -50% 0px'});
 tabs.forEach(t=>{const s=document.getElementById(t.getAttribute('href').slice(1));s&&t2.observe(s)})}
/* region selector */
if(window.RG){const L=[...document.querySelectorAll('#rgl a')],pl=document.getElementById('rgp'),nm=document.getElementById('rgn'),ln=document.getElementById('rgline'),go=document.getElementById('rgo');let cur=-1;
 function set(i){if(i===cur)return;cur=i;const r=RG[i];L.forEach((a,j)=>a.classList.toggle('on',j===i));pl.classList.add('swap');nm.classList.add('swap');
  setTimeout(()=>{pl.innerHTML=`<img src="assets/cg/${r[0]}.webp" alt="">`;pl.classList.remove('swap');nm.innerHTML=`<span>${r[1]}</span>`;nm.classList.remove('swap')},200);
  ln.textContent=r[2];go.href=`region-${r[0]}.html`}
 L.forEach((a,i)=>{a.addEventListener('mouseenter',()=>set(i));a.addEventListener('focus',()=>set(i))});set(0);
 RG.forEach(r=>{const im=new Image();im.src=`assets/cg/${r[0]}.webp`})}
})();
