/**
 * 职责：SelectionOverlays 域入口。
 * 说明：选中同步 / 浮层定位 / RAF 与连线域强耦合，实现位于
 * runtime/installConnections.ts，此处再导出以保持计划中的模块面。
 * 后续若解耦，可拆出独立 installSelectionOverlays。
 */
export { installConnections as registerSelectionOverlays } from './runtime/installConnections'
