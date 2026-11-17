/* 《源界》战斗逻辑层入口。纯 ES Module，浏览器和 Node 都能直接用。 */
export { EventBus } from './core/EventBus.js';
export { Timeline } from './core/Timeline.js';
export { StatusSystem } from './core/Status.js';
export { DomainSystem } from './core/Domain.js';
export { DamageSystem, defFactor } from './core/Damage.js';
export { Battle } from './core/Battle.js';
export { makeUnit } from './core/Unit.js';
export { registerKit, getKit, listKits } from './core/registry.js';
export { skillView } from './view.js';
import './kits/index.js';
