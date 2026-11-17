/* 角色机制注册表：核心不认识任何具体角色。每个角色 = 一份数据(data/skills/<id>.json) + 可选的机制模块(kits/<id>.js)。
   没有专属机制的角色用 genericKit（按数据里的倍率打普攻/战技/终结技）。 */
const kits = new Map();
export function registerKit(id, factory) { kits.set(id, factory); }
export function getKit(id) { return kits.get(id) || null; }
export function listKits() { return [...kits.keys()]; }
