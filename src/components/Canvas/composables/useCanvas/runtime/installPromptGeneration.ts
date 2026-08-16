/**
 * 职责：安装 PromptGeneration 域的真实画布业务实现。
 * 依赖：共享 ctx（bind 状态与跨域惰性函数）；不导入其他安装器。
 * 副作用：向 ctx 注册方法/派生状态，部分域会绑定监听或更新画布状态。
 */
import type { CoreRuntimeContext } from './context';
import { installPromptMultiResultGeneration } from './promptGeneration/multiResultGeneration';
import { installPromptImageCropActions } from './promptGeneration/imageCropActions';
import { installPromptDialoguePanelLifecycle } from './promptGeneration/dialoguePanelLifecycle';
import { installPromptImageDialogueRefs } from './promptGeneration/imageDialogueRefs';

export function installPromptGeneration(ctx: CoreRuntimeContext) {
  installPromptMultiResultGeneration(ctx)
  installPromptImageCropActions(ctx)
  installPromptDialoguePanelLifecycle(ctx)
  installPromptImageDialogueRefs(ctx)
}
