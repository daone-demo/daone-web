/**
 * 职责：导出 ImageMarking 域的真实运行时注册函数。
 * 依赖：对应 runtime 安装器；副作用由调用方显式触发。
 */
export { installImageMarking as registerImageMarking } from './runtime/installImageMarking'
