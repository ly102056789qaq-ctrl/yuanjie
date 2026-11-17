'use strict';
/* 场景进程里的方法。eval 只用于开发期由本机 cmd/ 文件驱动的搭建脚本，不进构建产物。 */
exports.load = function () {};
exports.unload = function () {};
exports.methods = {
  ping() {
    const { director } = require('cc');
    const scene = director.getScene();
    return { scene: scene ? scene.name : null, children: scene ? scene.children.map(n => n.name) : [] };
  },
  /* 执行一段搭建代码：code 是函数体，可用 cc、scene 两个变量，返回值会写回 out/ */
  async run(code) {
    const cc = require('cc');
    const scene = cc.director.getScene();
    const fn = new Function('cc', 'scene', 'return (async () => {' + code + '\n})()');
    return await fn(cc, scene);
  },
};
