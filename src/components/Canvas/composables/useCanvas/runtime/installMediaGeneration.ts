/**
 * 职责：安装 MediaGeneration 域的真实画布业务实现。
 * 依赖：共享 ctx（bind 状态与跨域惰性函数）；不导入其他安装器。
 * 副作用：向 ctx 注册方法/派生状态，部分域会绑定监听或更新画布状态。
 */
import type { CoreRuntimeContext } from './context';
import { installMediaToolbarActions } from './mediaGeneration/toolbarActions';
import { installMediaImageEditOps } from './mediaGeneration/imageEditOps';
import { installMediaVideoToolbarGeneration } from './mediaGeneration/videoToolbarGeneration';
import { installMediaImageCapabilityTasks } from './mediaGeneration/imageCapabilityTasks';
import { installMediaDialogueSubmits } from './mediaGeneration/dialogueSubmits';

export function installMediaGeneration(ctx: CoreRuntimeContext) {
  installMediaToolbarActions(ctx)
  installMediaImageEditOps(ctx)
  installMediaVideoToolbarGeneration(ctx)
  installMediaImageCapabilityTasks(ctx)
  installMediaDialogueSubmits(ctx)
}
