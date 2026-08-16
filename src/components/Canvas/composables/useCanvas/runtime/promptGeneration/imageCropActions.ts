/**
 * 职责：安装图片下载与裁剪 open/complete 相关动作到 ctx。
 */
import { isRequestError } from '@/utils/request'
import type { Node } from '@antv/x6'
import { message } from 'ant-design-vue'
import type { ImageToolbarClickEvent } from '../../../../constants'
import { downloadCanvasMedia } from '../../../../mediaDownload'
import type { CanvasNodeData } from '../../sharedImports'
import { spawnCroppedImageNode } from '../../sharedImports'
import type { CoreRuntimeContext } from '../context'

export function installPromptImageCropActions(ctx: CoreRuntimeContext) {
  ctx.handleImageDownloadAction = function handleImageDownloadAction(event: ImageToolbarClickEvent) {
    void event.assetId
    const data = ctx.getSelectedNodeData()
    const url = data?.previewUrl
    if (!url) {
      message.warning('图片尚未准备好，无法下载')
      return
    }
    void downloadCanvasMedia({
      url,
      fallbackName: 'image',
    }).catch((error) => {
      message.error(isRequestError(error) ? error.message : '图片下载失败，请稍后重试')
    })
  }

  ctx.openImageCrop = async function openImageCrop() {
    const ready = await ctx.ensureImageEditorReady('裁剪')
    if (!ready) return
    ctx.showImageHdMenu.value = false
    ctx.showImageDialogue.value = false
    ctx.showImageToolbarMore.value = false
    ctx.showImageToolbarMoreMenu.value = false
    ctx.closeImageGridSplit()
    ctx.closeImageErase()
    ctx.closeImageInpaint()
    ctx.closeImageExpand()
    ctx.closeImageEditText()
    ctx.cropSourceNodeId.value = ctx.selectedNodeId.value
    ctx.showImageCrop.value = true
    ctx.updateNodeToolbar()
  }

  ctx.closeImageCrop = function closeImageCrop() {
    ctx.showImageCrop.value = false
    ctx.cropSourceNodeId.value = ''
    ctx.updateNodeToolbar()
  }

  ctx.resetImageCrop = function resetImageCrop() {
    ctx.showImageCrop.value = false
    ctx.cropSourceNodeId.value = ''
  }

  ctx.onImageCropComplete = function onImageCropComplete(payload: {
    dataUrl: string
    width: number
    height: number
  }) {
    const g = ctx.graph.value
    const id = ctx.cropSourceNodeId.value || ctx.selectedNodeId.value
    if (!g || !id) {
      ctx.closeImageCrop()
      return
    }
    const cell = g.getCellById(id)
    if (!cell?.isNode()) {
      ctx.closeImageCrop()
      return
    }
    const sourceNode = cell as Node
    const sourceData = sourceNode.getData() as CanvasNodeData
    const fileName = sourceData.fileName ? `裁剪-${sourceData.fileName}` : '裁剪结果.png'
    const localPreviewUrl = payload.dataUrl
    ctx.closeImageCrop()
    const croppedNode = spawnCroppedImageNode(g, sourceNode, payload)
    ctx.focusErasedResultNode(g, croppedNode)
    void ctx.uploadLocalImageNodeInBackground(croppedNode, localPreviewUrl, fileName, payload).then(() => {
      ctx.scheduleHistoryPush()
    })
  }
}
