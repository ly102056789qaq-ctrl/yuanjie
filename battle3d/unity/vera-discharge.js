// The camera is already on the enemy formation when the ultimate lands.
// Draw one projected circuit for the cast, with the same cost for every damage tick.
const svgNS = 'http://www.w3.org/2000/svg';
function shape(parent, name, attributes) {
  const node = document.createElementNS(svgNS, name);
  for (const [key, value] of Object.entries(attributes)) node.setAttribute(key, value);
  parent.appendChild(node);
  return node;
}

export function createVeraDischarge(positionOf) {
  let overlay;
  function reset() {
    overlay?.remove();
    overlay = null;
  }
  function play(targets, speed = 1) {
    reset();
    const width = 1280, height = width * innerHeight / innerWidth;
    const points = targets.map(node => positionOf(node, .53)).filter(Boolean)
      .map(p => ({x:p.x * width, y:p.y * height})).sort((a,b) => a.x - b.x);
    if (!points.length) return;
    const surface = shape(document.body, 'svg', {viewBox:`0 0 ${width} ${height}`, 'aria-hidden':'true'});
    overlay = surface;
    surface.style.cssText = 'position:absolute;inset:0;width:100%;height:100%;pointer-events:none;overflow:hidden;fill:none';
    const interval = 105 / speed;
    let start = {x:points[0].x - width * .16, y:-16};
    for (const [index, end] of points.entries()) {
      const dx = end.x - start.x, dy = end.y - start.y;
      const length = Math.max(1, Math.hypot(dx, dy));
      const corners = [[0,0],[.22,2],[.33,-8],[.45,10],[.48,-6],[.69,5],[.81,-3],[1,0]];
      const path = corners.map(([t,offset],i) =>
        `${i ? 'L' : 'M'}${start.x + dx*t - dy/length*offset} ${start.y + dy*t + dx/length*offset}`).join(' ');
      const bolt = shape(surface, 'g', {'stroke-linejoin':'bevel'});
      for (const [stroke, weight, opacity] of [['#686cff',12,.23],['#7cdfff',5,.9],['#f6fffe',2,1]]) {
        shape(bolt, 'path', {d:path,stroke,'stroke-width':weight,opacity});
      }
      bolt.animate([{opacity:0},{opacity:1,offset:.12},{opacity:.8,offset:.40},{opacity:0}],
        {duration:350/speed,delay:index*interval,fill:'both'});
      const aperture = shape(surface,'g',{transform:`translate(${end.x} ${end.y})`});
      const iris = shape(aperture,'g',{stroke:'#b8f7ff','stroke-width':2});
      shape(iris,'circle',{r:23,'stroke-dasharray':'28 8','stroke-width':3});
      shape(iris,'path',{d:'M-37 0h13 M24 0h13 M0 -37v13 M0 24v13',stroke:'#ecffff'});
      shape(iris,'circle',{r:16,stroke:'#9c9aff','stroke-width':1});
      iris.animate([{opacity:0,transform:'scale(1.45) rotate(-24deg)'},{opacity:1,transform:'scale(.8) rotate(0)',offset:.27},
        {opacity:0,transform:'scale(1.22) rotate(12deg)'}],{duration:470/speed,delay:index*interval,fill:'both'});
      start = end;
    }
    const fade = surface.animate([{opacity:1},{opacity:0}],{
      delay:(points.length-1)*interval + 400/speed,duration:100/speed,fill:'forwards'
    });
    fade.onfinish = () => { if (overlay === surface) reset(); };
  }
  return {play,reset};
}
