export function mount(host, options, callbacks) {
  const canvas = document.createElement('canvas');
  const offscreen = canvas.transferControlToOffscreen();
  const worker = new Worker(new URL('./ascend-worker.js', import.meta.url), {type:'module'});
  canvas.className = 'as3d';
  host.prepend(canvas);

  let playing = false;
  let rect = host.getBoundingClientRect();
  const size = () => ({width:Math.max(1,rect.width), height:Math.max(1,rect.height), dpr:devicePixelRatio || 1});
  function resize() {
    rect = host.getBoundingClientRect();
    worker.postMessage({type:'resize', size:size()});
  }
  function pointer(event) {
    if (!playing || !rect.width || !rect.height) return;
    worker.postMessage({type:'pointer', x:(event.clientX-rect.left)*2/rect.width-1, y:(event.clientY-rect.top)*2/rect.height-1});
  }
  function play(value) {
    if (playing === value) return;
    playing = value;
    worker.postMessage({type:'play', playing});
  }
  worker.onmessage = ({data}) => {
    if (data.type === 'ready') callbacks.ready();
    if (data.type === 'slow') callbacks.slow();
    if (data.type === 'error') callbacks.failed(data.message);
  };
  worker.onerror = event => {event.preventDefault(); callbacks.failed(event.message)};
  const observer = new ResizeObserver(resize);
  observer.observe(host);
  window.addEventListener('resize', resize);
  window.addEventListener('pointermove', pointer, {passive:true});
  worker.postMessage({type:'init', canvas:offscreen, options, size:size()}, [offscreen]);
  return {
    start:() => play(true), stop:() => play(false), select:index => worker.postMessage({type:'select', index}),
    destroy() {
      observer.disconnect();
      window.removeEventListener('resize', resize);
      window.removeEventListener('pointermove', pointer);
      worker.onmessage = worker.onerror = null;
      worker.terminate();
      canvas.remove();
    }
  };
}
