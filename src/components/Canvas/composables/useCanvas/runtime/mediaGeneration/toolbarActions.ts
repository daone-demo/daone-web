/**
 * 职责：安装 MediaGeneration 工具栏相关动作到 ctx。
 */
import {isRequestError} from '@/utils/request';
import {message} from 'ant-design-vue';
import {buildImageActionResultTitle,buildVideoActionResultTitle,resolveImageAssetId,resolveSubmittableCapabilityCode,resolveVideoAssetId,resolveVideoToolbarUiKey,type ImageToolbarClickEvent,type ImageToolbarClickPayload,type VideoToolbarClickEvent,type VideoToolbarClickPayload} from '../../../../constants';
import {loadImageToolbarCustomizeSettings,saveImageToolbarCustomizeSettings,type ImageToolbarCustomizeSettings} from '../../../../imageToolbarCustomize';
import {downloadCanvasMedia} from '../../../../mediaDownload';
import {normalizeCutoutMode} from '../../coreHelpers';
import {api} from '../../sharedImports';
import type {CoreRuntimeContext} from '../context';

export function installMediaToolbarActions(ctx: CoreRuntimeContext) {
  ctx.openImageToolbarMore = function openImageToolbarMore() {
      ctx.showImageToolbarMore.value = !ctx.showImageToolbarMore.value;
      ctx.showImageToolbarMoreMenu.value = false;
      ctx.showImageHdMenu.value = false;
  };
  
  ctx.closeImageToolbarMore = function closeImageToolbarMore() {
      ctx.showImageToolbarMore.value = false;
      ctx.showImageToolbarMoreMenu.value = false;
  };
  
  ctx.toggleImageToolbarMoreMenu = function toggleImageToolbarMoreMenu() {
      ctx.showImageToolbarMoreMenu.value = !ctx.showImageToolbarMoreMenu.value;
  };
  
  ctx.toggleImageHdMenu = function toggleImageHdMenu() {
      ctx.showImageHdMenu.value = !ctx.showImageHdMenu.value;
      if (ctx.showImageHdMenu.value) {
          ctx.showImageToolbarMoreMenu.value = false;
      }
  };
  
  ctx.onImageToolbarAction = function onImageToolbarAction(payload: ImageToolbarClickPayload) {
      const data = ctx.getSelectedNodeData();
      const event: ImageToolbarClickEvent = {
          key: payload.key,
          option: payload.option,
          label: payload.label,
          assetId: resolveImageAssetId(data),
      };
      if (event.key !== 'hd') {
          ctx.showImageHdMenu.value = false;
      }
      if (event.key === 'chat') {
          ctx.toggleImageDialogue();
      }
      else if (event.key === 'IMAGE_CROP') {
          ctx.openImageCrop();
      }
      else if (event.key === 'IMAGE_REMOVE_BG') {
          if (event.option === 'erase') {
              ctx.handleImageEraseAction(event);
          }
          else {
              ctx.handleImageCapabilityAction(event);
          }
      }
      else if (event.key === 'more') {
          ctx.openImageToolbarMore();
      }
      else if (event.key === 'addToDialog') {
          ctx.toggleImageAddToDialogMenu();
      }
      else if (event.key === 'download') {
          ctx.handleImageDownloadAction(event);
      }
      else if (event.key === 'IMAGE_TO_3D') {
          void ctx.runImageTo3DTask(event);
      }
      else if (event.key === 'IMAGE_PROMPT_REVERSE') {
          ctx.handleImagePromptReverseAction(event);
      }
      else if (event.key === 'IMAGE_PREVIEW' || event.key === 'preview') {
          ctx.openImagePreview();
      }
      else if (event.key === 'IMAGE_GRID_SPLIT') {
          ctx.handleImageGridSplitAction(event);
      }
      else if (event.key === 'erase') {
          ctx.handleImageEraseAction(event);
      }
      else if (event.key === 'IMAGE_INPAINT') {
          ctx.handleImageInpaintAction(event);
      }
      else if (event.key === 'IMAGE_EDIT_TEXT') {
          ctx.handleImageEditTextAction(event);
      }
      else if (event.key === 'IMAGE_EXPAND') {
          ctx.handleImageExpandAction(event);
      }
      else if (event.key === 'annotate') {
          ctx.handleImageAnnotateAction();
      }
      else if (event.key === 'IMAGE_CUSTOM' || event.key === 'customize') {
          ctx.handleImageCustomAction(event);
      }
      else {
          ctx.handleImageCapabilityAction(event);
      }
      // switch (event.key) {
      //   case 'chat':
      //     toggleImageDialogue()
      //     return
      //   case 'more':
      //     openImageToolbarMore()
      //     return
      //   case 'crop':
      //     openImageCrop()
      //     return
      //   case 'hd':
      //     if (event.option) {
      //       handleImageHdAction(event)
      //     } else {
      //       toggleImageHdMenu()
      //     }
      //     return
      //   case 'IMAGE_REMOVE_BG':
      //     // dropdown：必须选择 mode 后才执行
      //     if (!event.option) return
      //     handleImageCutoutAction(event)
      //     return
      //   case 'preview':
      //     openImagePreview()
      //     return
      //   case 'addToDialog':
      //     toggleImageAddToDialogMenu()
      //     return
      //   case 'download':
      //     handleImageDownloadAction(event)
      //     return
      //   case 'inpaint':
      //     handleImageInpaintAction(event)
      //     return
      //   default:
      //     break
      // }
  };
  
  ctx.handleImageCustomAction = (_event: ImageToolbarClickEvent) => {
      void ctx.openImageCustom();
  };
  
  ctx.handleImageExpandAction = (_event: ImageToolbarClickEvent) => {
      void ctx.openImageExpand();
  };
  
  ctx.handleImageEditTextAction = (_event: ImageToolbarClickEvent) => {
      void ctx.openImageEditText();
  };
  
  ctx.openImageCustom = async function openImageCustom() {
      const ready = await ctx.ensureImageEditorReady('进行自定义');
      if (!ready)
          return;
      ctx.showImageHdMenu.value = false;
      ctx.showImageToolbarMore.value = false;
      ctx.showImageToolbarMoreMenu.value = false;
      ctx.showImageToolbarCustomize.value = true;
  };
  
  ctx.closeImageToolbarCustomize = function closeImageToolbarCustomize() {
      ctx.showImageToolbarCustomize.value = false;
  };
  
  ctx.saveImageToolbarCustomize = async function saveImageToolbarCustomize(settings: ImageToolbarCustomizeSettings) {
      try {
          await api.updateToolbarPreferences({
              nodeType: 'IMAGE',
              orderedCodes: [...settings.orderedKeys],
              hiddenCodes: [],
          });
      }
      catch (error) {
          console.error('[Canvas] save toolbar preferences failed', error);
          message.error('工具栏偏好保存失败，请稍后重试');
          return;
      }
      ctx.imageToolbarCustomizeSettings.value = {
          orderedKeys: [...settings.orderedKeys],
          showToolNames: settings.showToolNames,
      };
      saveImageToolbarCustomizeSettings(ctx.imageToolbarCustomizeSettings.value);
      ctx.closeImageToolbarCustomize();
      ctx.bumpToolbarRevision();
      ctx.emit('toolbar-preferences-saved', { nodeType: 'IMAGE' });
  };
  
  ctx.resetImageToolbarCustomize = function resetImageToolbarCustomize() {
      ctx.imageToolbarCustomizeSettings.value = loadImageToolbarCustomizeSettings();
      ctx.bumpToolbarRevision();
  };
  
  ctx.onVideoToolbarAction = function onVideoToolbarAction(payload: VideoToolbarClickPayload) {
      const data = ctx.getSelectedNodeData();
      const event: VideoToolbarClickEvent = {
          key: payload.key,
          option: payload.option,
          label: payload.label,
          assetId: resolveVideoAssetId(data),
      };
      const uiKey = resolveVideoToolbarUiKey(event.key);
      if (event.key === 'chat') {
          ctx.toggleVideoDialogue();
          return;
      }
      if (event.key === 'addToDialog') {
          ctx.addVideoToDialog();
          return;
      }
      if (event.key === 'download') {
          ctx.handleVideoDownloadAction(event);
          return;
      }
      if (uiKey === 'hd' || event.key === 'VIDEO_HD') {
          // 工具栏点击只打开高清面板；真正开任务由面板「开始高清」触发（带 magnification）
          if (event.option) {
              ctx.handleVideoCapabilityAction({
                  ...event,
                  key: 'VIDEO_HD',
                  label: event.label || '高清补帧',
              });
          }
          else {
              ctx.toggleVideoHdPanel();
          }
          return;
      }
      if (uiKey === 'frames' || event.key.includes('FRAME')) {
          ctx.toggleVideoFramesPanel();
          return;
      }
      ctx.handleVideoCapabilityAction(event);
  };
  
  ctx.handleVideoCapabilityAction = function handleVideoCapabilityAction(event: VideoToolbarClickEvent) {
      const title = buildVideoActionResultTitle(event.label);
      const namePrefix = event.label?.trim() || '视频处理';
      void ctx.runVideoGenerationTask(event, {
          capabilityCode: event.key,
          title,
          buildFileName: (sourceFileName) => sourceFileName ? `${namePrefix}-${sourceFileName}` : `${title}.mp4`,
          buildParameters: (ctx) => {
              const params: Record<string, unknown> = {
                  assetId: ctx.assetId,
              };
              if (ctx.key === 'VIDEO_HD' && ctx.option) {
                  params.magnification = ctx.option;
              }
              else if (ctx.option) {
                  params.mode = ctx.option;
              }
              return params;
          },
      });
  };
  
  ctx.handleVideoDownloadAction = function handleVideoDownloadAction(event: VideoToolbarClickEvent) {
      void event.assetId;
      const data = ctx.getSelectedNodeData();
      const url = data?.previewUrl;
      if (!url) {
          message.warning('视频尚未生成完成，无法下载');
          return;
      }
      void downloadCanvasMedia({
          url,
          fallbackName: 'video.mp4',
      }).catch((error) => {
          message.error(isRequestError(error) ? error.message : '视频下载失败，请稍后重试');
      });
  };
  
  ctx.handleImageGridSplitAction = function handleImageGridSplitAction(_event: ImageToolbarClickEvent) {
      void ctx.openImageGridSplit();
  };
  
  ctx.handleImagePromptReverseAction = function handleImagePromptReverseAction(event: ImageToolbarClickEvent) {
      void ctx.runImagePromptReverseTask(event);
  };
  
  ctx.handleImageEraseAction = function handleImageEraseAction(_event: ImageToolbarClickEvent) {
      void ctx.openImageErase();
  };
  
  ctx.handleImageInpaintAction = function handleImageInpaintAction(_event: ImageToolbarClickEvent) {
      void ctx.openImageInpaint();
  };
  
  ctx.handleImageCapabilityAction = function handleImageCapabilityAction(event: ImageToolbarClickEvent) {
      // 禁止把 panorama / hd 等前端 UI key 原样当作 capabilityCode 提交
      const capabilityCode = resolveSubmittableCapabilityCode(event.key, '');
      if (!capabilityCode) {
          message.warning('该能力暂未开放');
          return;
      }
      const title = buildImageActionResultTitle(event.label);
      const namePrefix = event.label?.trim() || '生成';
      void ctx.runImageGenerationTask(event, {
          capabilityCode,
          title,
          buildFileName: (sourceFileName) => sourceFileName ? `${namePrefix}-${sourceFileName}` : `${title}.png`,
          buildParameters: (ctx) => {
              const params: Record<string, unknown> = {
                  assetId: ctx.assetId,
              };
              if (ctx.option) {
                  // 此处 ctx 是回调参数（遮蔽外层运行时 ctx），只能用模块级纯函数
                  params.mode = normalizeCutoutMode(ctx.option);
              }
              return params;
          },
      });
  };
  
}
