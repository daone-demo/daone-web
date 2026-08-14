/**
 * 职责：导出 DerivedState 域的真实运行时注册函数。
 * 依赖：对应 runtime 安装器；副作用由调用方显式触发。
 */
export { installDerivedState as registerDerivedState } from './runtime/installDerivedState'
