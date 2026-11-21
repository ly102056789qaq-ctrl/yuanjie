import {mount} from './ascend3d.js';

let scene;
let size;
let selected = -1;
let playing = false;

self.onmessage = async ({data}) => {
  try {
    switch (data.type) {
      case 'init':
        size = data.size;
        selected = data.options.sel;
        data.canvas.addEventListener('webglcontextlost', () => self.postMessage({type:'error', message:'升格绘图上下文已中断'}));
        scene = await mount(data.canvas, data.options);
        scene.onFirstFrame = () => self.postMessage({type:'ready'});
        scene.onSlow = () => self.postMessage({type:'slow'});
        scene.resize(size);
        scene.select(selected);
        if (playing) scene.start();
        break;
      case 'resize':
        size = data.size;
        scene?.resize(size);
        break;
      case 'select':
        selected = data.index;
        scene?.select(selected);
        break;
      case 'play':
        playing = data.playing;
        if (playing) scene?.start(); else scene?.stop();
        break;
      case 'pointer':
        scene?.pointer(data);
        break;
    }
  } catch (error) {
    self.postMessage({type:'error', message:error.message});
  }
};
