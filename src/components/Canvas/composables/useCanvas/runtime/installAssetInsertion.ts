/**
 * 职责：安装 AssetInsertion 域的真实画布业务实现。
 * 依赖：共享 ctx（bind 状态与跨域惰性函数）；不导入其他安装器。
 * 副作用：向 ctx 注册方法/派生状态，部分域会绑定监听或更新画布状态。
 */
import type { CoreRuntimeContext } from './context';
import { installAssetDropUpload } from './assetInsertion/canvasDropUpload';
import { installAssetShellPanels } from './assetInsertion/shellPanelsToggle';
import { installAssetViewportChrome } from './assetInsertion/viewportChrome';
import { installAssetCanvasInteraction } from './assetInsertion/canvasInteractionDismiss';

export function installAssetInsertion(ctx: CoreRuntimeContext) {
  installAssetDropUpload(ctx)
  installAssetShellPanels(ctx)
  installAssetViewportChrome(ctx)
  installAssetCanvasInteraction(ctx)
}
