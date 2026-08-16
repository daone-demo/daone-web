// @ts-nocheck -- 动态共享上下文保持原闭包的运行时类型；公开契约仍由 CanvasBindings 校验。
/**
 * 职责：安装 MediaGeneration 域的真实画布业务实现。
 * 依赖：共享 ctx（bind 状态与跨域惰性函数）；不导入其他安装器。
 * 副作用：向 ctx 注册方法/派生状态，部分域会绑定监听或更新画布状态。
 */
import { isRequestError } from '@/utils/request';
import type { Graph,Node } from '@antv/x6';
import { message } from 'ant-design-vue';
import { nextTick } from 'vue';
import { resolveVideoTaskTypeLabel } from '../../../canvasDescription';
import { buildImageActionResultTitle,buildVideoActionResultTitle,IMAGE_GENERAL_CAPABILITY_CODE,resolveGenerationTaskWorkflowId,resolveImageAssetId,resolveVideoAssetId,resolveVideoToolbarUiKey,toVideoApiClarity,VIDEO_GENERAL_CAPABILITY_CODE,type ImageDialogueSubmitPayload,type ImageToolbarClickEvent,type ImageToolbarClickPayload,type VideoDialogueSubmitPayload,type VideoGenAspectRatio,type VideoGenPromptSubmitPayload,type VideoToolbarClickEvent,type VideoToolbarClickPayload } from '../../../constants';
import { normalizeOcrRecognizeResult,type ImageEditTextChange,} from '../../../editTextUtils';
import { buildImageGenerationParams,buildModelGenerationParams,buildTextGenerationParams,persistNodeGenerationSnapshot } from '../../../generationParams';
import { bindGenerationTaskId,bindSharedGenerationTaskId,followModelGenerationTaskOnNode,followTextGenerationTaskOnNode,markGenerationNodeFailed,markTextGenerationNodeFailed,markVideoGenerationNodeFailed,normalizeGenerationTaskDetail,startImageGenerationOnNode,startVideoGenerationTaskFollow,type GenerationTaskDetail } from '../../../generationTask';
import { splitImageIntoGrid } from '../../../gridSplitUtils';
import { createIdempotencyKey } from '../../../idempotency';
import { applyImageMarkTaskParameters,canSubmitImageDialogueTask } from '../../../imageMarkUtils';
import { loadImageToolbarCustomizeSettings,saveImageToolbarCustomizeSettings,type ImageToolbarCustomizeSettings,} from '../../../imageToolbarCustomize';
import { downloadCanvasMedia } from '../../../mediaDownload';
import { toVideoApiPrompt } from '../../../promptMention';
import { getBoundingBoxCenter } from '../../../viewport';
import type { CanvasNodeData } from '.././sharedImports';
import { normalizeCutoutMode } from '../coreHelpers';
import { api,applyVideoFirstLastFrameParameters,connectGenEdge,findImageToVideoEdge,findReusableImageGenerationNode,findReusableVideoGenerationNode,getImageGenerationPlaceholderSize,getNodeSize,getScroller,getVideoSourceRefs,isImageGenerationFailedNode,planOutgoingResultPoints,prepareImageNodeForInPlaceGeneration,previewUrlToUploadFile,resetImageGenerationNodeForRetry,resetVideoGenerationNodeForRetry,resolveVideoGenerationSubmitContext,shouldGenerateImageInPlaceOnNode,spawnErasedImageNode,spawnGenerationResultNode,spawnGridSplitResultNodes,spawnModel3DResultNode,spawnTextPromptResultNode,spawnVideoGenerationResultNode,syncNodeShapeFromData,toPersistedVideoSourceRefs,uploadAssetFile } from '.././sharedImports';
import type { CoreRuntimeContext } from './context';

export function installMediaGeneration(ctx: CoreRuntimeContext) {
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
  
  ctx.openImageEditText = async function openImageEditText() {
      const ready = await ctx.ensureImageEditorReady('进行文字编辑');
      if (!ready)
          return;
      const data = ctx.getSelectedNodeData();
      const assetId = resolveImageAssetId(data);
      if (!assetId) {
          message.warning('图片素材 ID 不存在，请等待上传完成');
          return;
      }
      ctx.showImageHdMenu.value = false;
      ctx.showImageDialogue.value = false;
      ctx.showImageToolbarMore.value = false;
      ctx.showImageToolbarMoreMenu.value = false;
      ctx.closeImageCrop();
      ctx.closeImageGridSplit();
      ctx.closeImageErase();
      ctx.closeImageInpaint();
      ctx.closeImageExpand();
      ctx.closeImageEditText();
      ctx.editTextSourceNodeId.value = ctx.selectedNodeId.value;
      ctx.imageEditTextEntries.value = [];
      ctx.imageEditTextRecognizing.value = true;
      ctx.showImageEditText.value = true;
      ctx.updateNodeToolbar();
      try {
          const result = await api.ocrRecognize({ assetId });
          ctx.imageEditTextEntries.value = normalizeOcrRecognizeResult(result);
          if (!ctx.imageEditTextEntries.value.length) {
              message.info('未识别到文字，可手动添加后应用');
          }
      }
      catch (error) {
          console.error('[image-edit-text] ocr failed', error);
          message.error('文字识别失败，请稍后重试');
          ctx.closeImageEditText();
      }
      finally {
          ctx.imageEditTextRecognizing.value = false;
      }
  };
  
  ctx.closeImageEditText = function closeImageEditText() {
      ctx.showImageEditText.value = false;
      ctx.editTextSourceNodeId.value = '';
      ctx.imageEditTextEntries.value = [];
      ctx.imageEditTextRecognizing.value = false;
      ctx.updateNodeToolbar();
  };
  
  ctx.resetImageEditText = function resetImageEditText() {
      ctx.showImageEditText.value = false;
      ctx.editTextSourceNodeId.value = '';
      ctx.imageEditTextEntries.value = [];
      ctx.imageEditTextRecognizing.value = false;
  };
  
  ctx.onImageEditTextApply = function onImageEditTextApply(changes: ImageEditTextChange[]) {
      const g = ctx.graph.value;
      const sourceNodeId = ctx.editTextSourceNodeId.value || ctx.selectedNodeId.value;
      if (!g || !sourceNodeId) {
          ctx.closeImageEditText();
          return;
      }
      const cell = g.getCellById(sourceNodeId);
      if (!cell?.isNode()) {
          ctx.closeImageEditText();
          return;
      }
      const sourceData = cell.getData() as CanvasNodeData;
      const assetId = resolveImageAssetId(sourceData);
      if (!assetId) {
          message.warning('图片素材 ID 不存在，请等待上传完成');
          return;
      }
      if (!changes.length) {
          message.warning('请修改文字后再应用');
          return;
      }
      const editSummary = changes
          .map((change) => change.text.trim() || change.originalText.trim())
          .filter(Boolean)
          .slice(0, 3)
          .join('、');
      ctx.recordCanvasDescription(editSummary || '编辑图片文字', '编辑文字');
      ctx.closeImageEditText();
      ctx.selectedNodeId.value = sourceNodeId;
      ctx.selectedKind.value = 'image';
      ctx.syncNodeSelectionHighlight(sourceNodeId);
      const title = buildImageActionResultTitle('编辑文字');
      const sourceFileName = sourceData.fileName || sourceData.title || '';
      void ctx.runImageGenerationTask({
          key: 'IMAGE_EDIT_TEXT',
          label: '编辑文字',
          assetId,
      }, {
          capabilityCode: 'IMAGE_EDIT_TEXT',
          title,
          buildFileName: (name) => {
              const base = name || sourceFileName;
              return base ? `编辑文字-${base}` : '编辑文字.png';
          },
          buildParameters: () => ({
              assetId,
              edits: changes.map((change) => ({
                  originalText: change.originalText,
                  text: change.text,
                  editAction: change.editAction,
                  ...(change.bbox
                      ? {
                          x: change.bbox.x,
                          y: change.bbox.y,
                          width: change.bbox.width,
                          height: change.bbox.height,
                      }
                      : {}),
              })),
          }),
      });
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
  
  ctx.openImageExpand = async function openImageExpand() {
      const ready = await ctx.ensureImageEditorReady('进行扩图');
      if (!ready)
          return;
      ctx.showImageHdMenu.value = false;
      ctx.showImageDialogue.value = false;
      ctx.showImageToolbarMore.value = false;
      ctx.showImageToolbarMoreMenu.value = false;
      ctx.closeImageCrop();
      ctx.closeImageGridSplit();
      ctx.closeImageErase();
      ctx.closeImageInpaint();
      ctx.closeImageEditText();
      ctx.expandSourceNodeId.value = ctx.selectedNodeId.value;
      ctx.showImageExpand.value = true;
      ctx.updateNodeToolbar();
  };
  
  ctx.closeImageExpand = function closeImageExpand() {
      ctx.showImageExpand.value = false;
      ctx.expandSourceNodeId.value = '';
      ctx.updateNodeToolbar();
  };
  
  ctx.resetImageExpand = function resetImageExpand() {
      ctx.showImageExpand.value = false;
      ctx.expandSourceNodeId.value = '';
  };
  
  ctx.onImageExpandComplete = function onImageExpandComplete(payload: {
      expandDirection: 'TOP' | 'BOTTOM' | 'LEFT' | 'RIGHT' | 'ALL';
      expandRatio: number;
  }) {
      const g = ctx.graph.value;
      const sourceNodeId = ctx.expandSourceNodeId.value || ctx.selectedNodeId.value;
      if (!g || !sourceNodeId) {
          ctx.closeImageExpand();
          return;
      }
      const cell = g.getCellById(sourceNodeId);
      if (!cell?.isNode()) {
          ctx.closeImageExpand();
          return;
      }
      const sourceData = cell.getData() as CanvasNodeData;
      const assetId = resolveImageAssetId(sourceData);
      if (!assetId) {
          message.warning('图片素材 ID 不存在，请等待上传完成');
          return;
      }
      ctx.closeImageExpand();
      ctx.selectedNodeId.value = sourceNodeId;
      ctx.selectedKind.value = 'image';
      ctx.syncNodeSelectionHighlight(sourceNodeId);
      const title = buildImageActionResultTitle('扩图');
      const sourceFileName = sourceData.fileName || sourceData.title || '';
      void ctx.runImageGenerationTask({
          key: 'IMAGE_EXPAND',
          label: '扩图',
          assetId,
      }, {
          capabilityCode: 'IMAGE_EXPAND',
          title,
          buildFileName: (name) => {
              const base = name || sourceFileName;
              return base ? `扩图-${base}` : '扩图.png';
          },
          buildParameters: () => ({
              assetId,
              expandDirection: payload.expandDirection,
              expandRatio: payload.expandRatio,
          }),
      });
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
  
  ctx.runVideoGenerationTask = async function runVideoGenerationTask(event: VideoToolbarClickEvent, config: {
      capabilityCode: string;
      title: string;
      prompt?: string;
      requireAssetId?: boolean;
      requireSourcePreview?: boolean;
      buildFileName: (sourceFileName: string) => string;
      buildParameters: (event: VideoToolbarClickEvent) => Record<string, unknown>;
      resolveReferenceAssetIds?: (event: VideoToolbarClickEvent) => string[];
  }) {
      const requireAssetId = config.requireAssetId !== false;
      if (requireAssetId && !event.assetId) {
          message.warning('视频素材 ID 不存在，请等待上传完成');
          return;
      }
      const g = ctx.graph.value;
      const sourceNodeId = ctx.selectedNodeId.value;
      if (!g || !sourceNodeId)
          return;
      const sourceCell = g.getCellById(sourceNodeId);
      if (!sourceCell?.isNode())
          return;
      const sourceNode = sourceCell as Node;
      const sourceData = sourceNode.getData() as CanvasNodeData;
      if (sourceData.kind !== 'video')
          return;
      const requireSourcePreview = config.requireSourcePreview !== false;
      if (requireSourcePreview && !sourceData.previewUrl)
          return;
      if (sourceData.uploadState === 'uploading') {
          message.warning('视频上传中，请稍后再试');
          return;
      }
      ctx.resetVideoDialogue();
      ctx.resetVideoHdPanel();
      ctx.resetVideoFramesPanel();
      const sourceFileName = sourceData.fileName || sourceData.title || '';
      const taskParameters = config.buildParameters(event);
      const referenceAssetIds = config.resolveReferenceAssetIds?.(event) ??
          (event.assetId ? [event.assetId] : []);
      const prompt = config.prompt?.trim() ?? '';
      ctx.recordCanvasDescription(config.title, '');
      const liveSourceRefs = getVideoSourceRefs(g, sourceNodeId);
      ctx.syncVideoSourceRefsSnapshot(sourceNodeId);
      // 调用方（对话框/能力条）应已写入溯源；此处补齐文案与参考图快照后复制到结果节点
      const midData = { ...(sourceNode.getData() as CanvasNodeData) };
      if (prompt && !midData.videoDialogueText?.trim()) {
          midData.videoDialogueText = prompt;
          midData.genPrompt = prompt;
      }
      if (prompt && !midData.genPrompt?.trim()) {
          midData.genPrompt = prompt;
      }
      midData.videoSourceRefs = toPersistedVideoSourceRefs(liveSourceRefs);
      sourceNode.setData(midData, { overwrite: true });
      const refreshedSource = sourceNode.getData() as CanvasNodeData;
      const requestedCount = Math.max(1, Math.floor(Number(taskParameters.videoCount)) || 1);
      const singleTaskParameters = applyVideoFirstLastFrameParameters({ ...taskParameters, videoCount: 1 }, String(taskParameters.mode ?? ''), referenceAssetIds);
      const buildIndexedFileName = (index: number) => ctx.resolveGenerationResultFileName(config.buildFileName, sourceFileName, index, requestedCount);
      const connectRefsToVideoNode = (node: Node) => {
          for (const ref of liveSourceRefs) {
              if (!findImageToVideoEdge(g, ref.nodeId, node.id)) {
                  connectGenEdge(g, ref.nodeId, node.id);
              }
          }
      };
      const resultNodes: Node[] = [];
      const reusableNode = requestedCount === 1 ? findReusableVideoGenerationNode(g, sourceNode) : null;
      if (reusableNode) {
          resultNodes.push(reusableNode);
          resetVideoGenerationNodeForRetry(reusableNode, {
              title: config.title,
              fileName: buildIndexedFileName(0),
              prompt,
          });
          const retryData = { ...(reusableNode.getData() as CanvasNodeData) };
          retryData.videoDialogueText = refreshedSource.videoDialogueText || prompt;
          retryData.genPrompt = refreshedSource.genPrompt || prompt;
          retryData.videoDialogueSettings = refreshedSource.videoDialogueSettings
              ? { ...refreshedSource.videoDialogueSettings }
              : retryData.videoDialogueSettings;
          retryData.videoSourceRefs = refreshedSource.videoSourceRefs?.length
              ? refreshedSource.videoSourceRefs.map((item) => ({ ...item }))
              : toPersistedVideoSourceRefs(liveSourceRefs);
          reusableNode.setData(retryData, { overwrite: true });
          connectRefsToVideoNode(reusableNode);
      }
      else {
          const layoutSize = ctx.resolveVideoResultLayoutSize(refreshedSource);
          const plannedPoints = planOutgoingResultPoints(g, sourceNode, layoutSize, requestedCount, 'right');
          for (let index = 0; index < requestedCount; index += 1) {
              const resultNode = spawnVideoGenerationResultNode(g, sourceNode, {
                  title: config.title,
                  fileName: buildIndexedFileName(index),
                  videoDialogueText: refreshedSource.videoDialogueText || prompt,
                  videoDialogueSettings: refreshedSource.videoDialogueSettings,
                  videoSourceRefs: refreshedSource.videoSourceRefs,
                  genPrompt: refreshedSource.genPrompt || prompt,
                  centerPoint: plannedPoints[index],
              });
              connectRefsToVideoNode(resultNode);
              resultNodes.push(resultNode);
          }
      }
      const primaryNode = resultNodes[0];
      ctx.selectedNodeId.value = primaryNode.id;
      ctx.selectedKind.value = 'video';
      ctx.syncNodeSelectionHighlight(primaryNode.id);
      ctx.syncNodeCount();
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
      ctx.scheduleHistoryPush();
      resultNodes.forEach((resultNode) => {
          const settings = refreshedSource.videoDialogueSettings;
          ctx.applyVideoGenerationProvenance(resultNode, {
              prompt,
              model: settings?.modelKey ?? '',
              ratio: String(settings?.aspectRatio ?? '16:9'),
              clarity: String(settings?.resolution ?? '720p'),
              duration: Number(settings?.duration ?? 5),
              generateAudio: Boolean(settings?.generateAudio),
              videoCount: Number(settings?.videoCount ?? 1),
              mode: settings?.mode ?? 'text-to-video',
          }, liveSourceRefs, {
              capabilityCode: config.capabilityCode,
              parameters: singleTaskParameters,
              referenceAssetIds,
          });
      });
      void Promise.all(resultNodes.map(async (resultNode, index) => {
          const nodeFileName = buildIndexedFileName(index);
          const idempotencyKey = createIdempotencyKey('video-cap', index);
          try {
              const created = normalizeGenerationTaskDetail(await api.createGenerationTask<GenerationTaskDetail>({
                  taskType: 'VIDEO',
                  capabilityCode: config.capabilityCode,
                  prompt: toVideoApiPrompt(config.prompt?.trim() ?? ''),
                  parameters: singleTaskParameters,
                  projectId: ctx.activeProjectId.value,
                  nodeId: resultNode.id,
                  referenceAssetIds: referenceAssetIds.length ? referenceAssetIds : undefined,
              }, idempotencyKey));
              const taskId = created.id;
              if (!taskId) {
                  throw new Error(`创建${config.title}任务失败`);
              }
              ctx.userInfoStore.queryPointAccount();
              bindGenerationTaskId(resultNode, taskId, 'VIDEO');
              ctx.persistGenerationTaskBinding(resultNode, { detail: prompt, taskType: config.title });
              startVideoGenerationTaskFollow(resultNode, taskId, {
                  title: config.title,
                  fileName: nodeFileName,
                  onError: (reason) => message.error(reason),
                  onComplete: (success) => ctx.handleVideoGenerationTaskComplete(resultNode.id, success),
              });
          }
          catch (error) {
              markVideoGenerationNodeFailed(resultNode);
              ctx.revealVideoDialogueAfterGenerationFailure(resultNode.id);
              message.error(isRequestError(error) ? error.message : `${config.title}失败，请稍后重试`);
          }
      }));
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
  
  ctx.openImageGridSplit = async function openImageGridSplit(rows = 2, cols = 2) {
      const ready = await ctx.ensureImageEditorReady('拆分');
      if (!ready)
          return;
      ctx.showImageHdMenu.value = false;
      ctx.showImageDialogue.value = false;
      ctx.showImageToolbarMore.value = false;
      ctx.showImageToolbarMoreMenu.value = false;
      ctx.closeImageCrop();
      ctx.closeImageErase();
      ctx.closeImageInpaint();
      ctx.closeImageExpand();
      ctx.closeImageEditText();
      ctx.gridSplitSourceNodeId.value = ctx.selectedNodeId.value;
      ctx.gridSplitRows.value = rows;
      ctx.gridSplitCols.value = cols;
      ctx.showImageGridSplit.value = true;
      ctx.updateNodeToolbar();
  };
  
  ctx.closeImageGridSplit = function closeImageGridSplit() {
      ctx.showImageGridSplit.value = false;
      ctx.gridSplitSourceNodeId.value = '';
      ctx.updateNodeToolbar();
  };
  
  ctx.resetImageGridSplit = function resetImageGridSplit() {
      ctx.showImageGridSplit.value = false;
      ctx.gridSplitSourceNodeId.value = '';
  };
  
  ctx.onImageGridSplitComplete = async function onImageGridSplitComplete(payload: {
      rows: number;
      cols: number;
      rowStops: number[];
      colStops: number[];
  }) {
      const g = ctx.graph.value;
      const sourceNodeId = ctx.gridSplitSourceNodeId.value || ctx.selectedNodeId.value;
      if (!g || !sourceNodeId) {
          ctx.closeImageGridSplit();
          return;
      }
      const sourceCell = g.getCellById(sourceNodeId);
      if (!sourceCell?.isNode()) {
          ctx.closeImageGridSplit();
          return;
      }
      const sourceNode = sourceCell as Node;
      const sourceData = sourceNode.getData() as CanvasNodeData;
      if (!sourceData.previewUrl) {
          ctx.closeImageGridSplit();
          return;
      }
      const hide = message.loading(`正在拆分为 ${payload.rows}×${payload.cols} 宫格...`, 0);
      try {
          const tiles = await splitImageIntoGrid(sourceData.previewUrl, payload.rows, payload.cols, {
              rowStops: payload.rowStops,
              colStops: payload.colStops,
          }, {
              width: sourceData.mediaWidth ?? 0,
              height: sourceData.mediaHeight ?? 0,
          });
          if (!tiles.length) {
              message.warning('拆分结果为空');
              return;
          }
          // 先用前端合成图拉出节点，再后台无感上传 OSS
          const nodes = spawnGridSplitResultNodes(g, sourceNode, tiles, {
              titlePrefix: '宫格',
              rows: payload.rows,
              cols: payload.cols,
              rowStops: payload.rowStops,
              colStops: payload.colStops,
          });
          ctx.closeImageGridSplit();
          ctx.selectedNodeId.value = '';
          ctx.selectedNodeIds.value = [];
          ctx.selectedKind.value = null;
          ctx.syncNodeSelectionHighlight([]);
          g.cleanSelection();
          ctx.syncNodeCount();
          ctx.bumpToolbarRevision();
          ctx.updateNodeToolbar();
          ctx.scheduleHistoryPush();
          nextTick(() => {
              const scroller = getScroller(g);
              if (!scroller || !nodes.length)
                  return;
              const center = getBoundingBoxCenter(nodes.map((node) => node.getBBox()));
              scroller.transitionToPoint(center.x, center.y, { duration: '280ms' });
          });
          void ctx.uploadGridSplitImagesInBackground(nodes);
      }
      catch (error) {
          console.error('[grid-split] failed', error);
          message.error(error instanceof Error ? error.message : '宫格拆分失败，请稍后重试');
      }
      finally {
          hide();
      }
  };
  
  ctx.uploadGridSplitImagesInBackground = async function uploadGridSplitImagesInBackground(nodes: Node[]) {
      const uploads = nodes.map(async (node) => {
          const data = node.getData() as CanvasNodeData;
          if (data.assetId)
              return;
          const previewUrl = data.previewUrl?.trim();
          if (!previewUrl)
              return;
          await ctx.uploadLocalImageNodeInBackground(node, previewUrl, data.fileName || '宫格.png', {
              width: data.mediaWidth ?? 0,
              height: data.mediaHeight ?? 0,
              preserveTitle: true,
              silent: true,
          });
      });
      await Promise.allSettled(uploads);
      ctx.scheduleHistoryPush();
  };
  
  ctx.handleImagePromptReverseAction = function handleImagePromptReverseAction(event: ImageToolbarClickEvent) {
      void ctx.runImagePromptReverseTask(event);
  };
  
  ctx.runImagePromptReverseTask = async function runImagePromptReverseTask(event: ImageToolbarClickEvent) {
      if (!event.assetId) {
          message.warning('图片素材 ID 不存在，请等待上传完成');
          return;
      }
      const g = ctx.graph.value;
      const sourceNodeId = ctx.selectedNodeId.value;
      if (!g || !sourceNodeId)
          return;
      const sourceCell = g.getCellById(sourceNodeId);
      if (!sourceCell?.isNode())
          return;
      const sourceNode = sourceCell as Node;
      const sourceData = sourceNode.getData() as CanvasNodeData;
      if (!sourceData.previewUrl || sourceData.uploadState === 'uploading')
          return;
      // if (findOutgoingLoadingGenerationNode(g, sourceNodeId)) {
      //   message.info('当前图片已有进行中的生成任务')
      //   return
      // }
      const title = buildImageActionResultTitle(event.label || '图片反推提示词');
      const reverseDetail = ctx.promptText.value.trim() || sourceData.fileName || sourceData.title || '图片反推';
      ctx.recordCanvasDescription(reverseDetail, '反推提示词');
      const resultNode = spawnTextPromptResultNode(g, sourceNode, { title });
      const reverseInstruction = ctx.promptText.value.trim();
      persistNodeGenerationSnapshot(resultNode, {
          ...buildTextGenerationParams({
              prompt: reverseInstruction,
              capabilityCode: 'IMAGE_PROMPT_REVERSE',
              parameters: {
                  assetId: event.assetId,
                  prompt: reverseInstruction,
              },
          }),
          imageSourceRefs: [
              {
                  nodeId: sourceNode.id,
                  assetId: event.assetId,
                  previewUrl: sourceData.previewUrl ?? '',
                  fileName: sourceData.fileName || sourceData.title || '',
              },
          ],
          genPrompt: reverseInstruction,
      });
      resultNode.setData({
          ...(resultNode.getData() as CanvasNodeData),
          title: '反推提示词',
          textPickerTask: 'img2prompt',
      }, { overwrite: true });
      ctx.selectedNodeId.value = resultNode.id;
      ctx.selectedKind.value = 'text';
      ctx.syncNodeSelectionHighlight(resultNode.id);
      ctx.syncNodeCount();
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
      ctx.scheduleHistoryPush();
      const idempotencyKey = createIdempotencyKey('prompt-reverse');
      try {
          const created = normalizeGenerationTaskDetail(await api.createGenerationTask<GenerationTaskDetail>({
              taskType: 'TEXT',
              capabilityCode: 'IMAGE_PROMPT_REVERSE',
              prompt: '',
              parameters: {
                  assetId: event.assetId,
                  prompt: ctx.promptText.value.trim(),
              },
              projectId: ctx.activeProjectId.value,
              nodeId: resultNode.id,
              referenceAssetIds: [event.assetId],
          }, idempotencyKey));
          const taskId = created.id;
          if (!taskId) {
              throw new Error('创建反推提示词任务失败');
          }
          ctx.userInfoStore.queryPointAccount();
          bindGenerationTaskId(resultNode, taskId, 'TEXT');
          ctx.persistGenerationTaskBinding(resultNode, { detail: reverseDetail, taskType: '反推提示词' });
          const succeeded = await followTextGenerationTaskOnNode(resultNode, taskId, {
              title,
              toHtml: ctx.plainTextToEditorHtml,
              onError: (reason) => message.error(reason),
          });
          if (!succeeded)
              return;
          ctx.selectedNodeId.value = resultNode.id;
          ctx.selectedKind.value = 'text';
          ctx.syncNodeSelectionHighlight(resultNode.id);
          ctx.bumpToolbarRevision();
          ctx.updateNodeToolbar();
          ctx.scheduleHistoryPush();
          nextTick(() => {
              const scroller = getScroller(g);
              const bbox = resultNode.getBBox();
              scroller?.transitionToPoint(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2, {
                  duration: '280ms',
              });
          });
      }
      catch (error) {
          markTextGenerationNodeFailed(resultNode);
          message.error(isRequestError(error) ? error.message : '反推提示词失败，请稍后重试');
      }
  };
  
  ctx.runImageTo3DTask = async function runImageTo3DTask(event: ImageToolbarClickEvent) {
      if (!event.assetId) {
          message.warning('图片素材 ID 不存在，请等待上传完成');
          return;
      }
      const g = ctx.graph.value;
      const sourceNodeId = ctx.selectedNodeId.value;
      if (!g || !sourceNodeId)
          return;
      const sourceCell = g.getCellById(sourceNodeId);
      if (!sourceCell?.isNode())
          return;
      const sourceNode = sourceCell as Node;
      const sourceData = sourceNode.getData() as CanvasNodeData;
      if (!sourceData.previewUrl || sourceData.uploadState === 'uploading')
          return;
      // if (findOutgoingLoadingGenerationNode(g, sourceNodeId)) {
      //   message.info('当前图片已有进行中的生成任务')
      //   return
      // }
      const title = buildImageActionResultTitle(event.label || '图片转3D');
      const modelDetail = sourceData.fileName || sourceData.title || event.label || '图片转3D';
      ctx.recordCanvasDescription(title, '');
      const resultNode = spawnModel3DResultNode(g, sourceNode, {
          title,
          fileName: `${event.label?.trim() || '图片转3D'}.glb`,
      });
      persistNodeGenerationSnapshot(resultNode, {
          ...buildModelGenerationParams({
              prompt: '',
              capabilityCode: 'IMAGE_TO_3D',
              parameters: { assetId: event.assetId },
              referenceAssetIds: [event.assetId],
          }),
          imageSourceRefs: [
              {
                  nodeId: sourceNode.id,
                  assetId: event.assetId,
                  previewUrl: sourceData.previewUrl ?? '',
                  fileName: sourceData.fileName || sourceData.title || '',
              },
          ],
      });
      ctx.selectedNodeId.value = resultNode.id;
      ctx.selectedKind.value = 'model3d';
      ctx.syncNodeSelectionHighlight(resultNode.id);
      ctx.syncNodeCount();
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
      ctx.scheduleHistoryPush();
      const idempotencyKey = createIdempotencyKey('model3d');
      try {
          const created = normalizeGenerationTaskDetail(await api.createGenerationTask<GenerationTaskDetail>({
              taskType: 'MODEL',
              capabilityCode: 'IMAGE_TO_3D',
              prompt: '',
              parameters: {
                  assetId: event.assetId,
              },
              projectId: ctx.activeProjectId.value,
              nodeId: resultNode.id,
              referenceAssetIds: [event.assetId],
          }, idempotencyKey));
          const taskId = created.id;
          if (!taskId) {
              throw new Error('创建 3D 生成任务失败');
          }
          ctx.userInfoStore.queryPointAccount();
          bindGenerationTaskId(resultNode, taskId, 'MODEL');
          ctx.persistGenerationTaskBinding(resultNode, { detail: modelDetail, taskType: '图生3D' });
          const succeeded = await followModelGenerationTaskOnNode(resultNode, taskId, {
              title,
              onError: (reason) => message.error(reason),
          });
          if (!succeeded)
              return;
          ctx.selectedNodeId.value = resultNode.id;
          ctx.selectedKind.value = 'model3d';
          ctx.syncNodeSelectionHighlight(resultNode.id);
          ctx.bumpToolbarRevision();
          ctx.updateNodeToolbar();
          ctx.scheduleHistoryPush();
          nextTick(() => {
              const scroller = getScroller(g);
              const bbox = resultNode.getBBox();
              scroller?.transitionToPoint(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2, {
                  duration: '280ms',
              });
          });
      }
      catch (error) {
          markGenerationNodeFailed(resultNode);
          message.error(isRequestError(error) ? error.message : '3D 生成失败，请稍后重试');
      }
  };
  
  ctx.handleImageEraseAction = function handleImageEraseAction(_event: ImageToolbarClickEvent) {
      void ctx.openImageErase();
  };
  
  ctx.handleImageInpaintAction = function handleImageInpaintAction(_event: ImageToolbarClickEvent) {
      void ctx.openImageInpaint();
  };
  
  ctx.openImageInpaint = async function openImageInpaint() {
      const ready = await ctx.ensureImageEditorReady('进行局部修改');
      if (!ready)
          return;
      ctx.showImageHdMenu.value = false;
      ctx.showImageDialogue.value = false;
      ctx.showImageToolbarMore.value = false;
      ctx.showImageToolbarMoreMenu.value = false;
      ctx.closeImageCrop();
      ctx.closeImageGridSplit();
      ctx.closeImageErase();
      ctx.closeImageExpand();
      ctx.closeImageEditText();
      ctx.inpaintSourceNodeId.value = ctx.selectedNodeId.value;
      ctx.showImageInpaint.value = true;
      ctx.updateNodeToolbar();
  };
  
  ctx.closeImageInpaint = function closeImageInpaint() {
      ctx.showImageInpaint.value = false;
      ctx.inpaintSourceNodeId.value = '';
      ctx.updateNodeToolbar();
  };
  
  ctx.dataUrlToFile = async function dataUrlToFile(dataUrl: string, fileName: string) {
      return previewUrlToUploadFile(dataUrl, fileName);
  };
  
  ctx.onImageInpaintComplete = async function onImageInpaintComplete(payload: {
      prompt: string;
      mask: {
          dataUrl: string;
          width: number;
          height: number;
      };
      settle?: () => void;
  }) {
      await ctx.handleImageInpaintSubmit(payload);
  };
  
  ctx.handleImageInpaintCapabilityAction = function handleImageInpaintCapabilityAction(event: ImageToolbarClickEvent, options: {
      prompt: string;
      maskAssetId: string;
  }) {
      const title = buildImageActionResultTitle(event.label || '局部修改');
      const namePrefix = event.label?.trim() || '局部修改';
      void ctx.runImageGenerationTask(event, {
          capabilityCode: 'IMAGE_INPAINT',
          title,
          prompt: options.prompt,
          buildFileName: (sourceFileName) => sourceFileName ? `${namePrefix}-${sourceFileName}` : `${title}.png`,
          buildParameters: (ctx) => ({
              assetId: ctx.assetId,
              maskAssetId: options.maskAssetId,
          }),
          resolveReferenceAssetIds: () => [event.assetId, options.maskAssetId].filter(Boolean),
      });
  };
  
  ctx.handleImageInpaintSubmit = async function handleImageInpaintSubmit(payload: {
      prompt: string;
      mask: {
          dataUrl: string;
          width: number;
          height: number;
      };
      settle?: () => void;
  }) {
      const settle = () => payload.settle?.();
      const g = ctx.graph.value;
      const sourceNodeId = ctx.inpaintSourceNodeId.value || ctx.selectedNodeId.value;
      if (!g || !sourceNodeId) {
          ctx.closeImageInpaint();
          settle();
          return;
      }
      const cell = g.getCellById(sourceNodeId);
      if (!cell?.isNode()) {
          ctx.closeImageInpaint();
          settle();
          return;
      }
      const sourceData = cell.getData() as CanvasNodeData;
      const assetId = resolveImageAssetId(sourceData);
      if (!assetId) {
          message.warning('图片素材 ID 不存在，请等待上传完成');
          settle();
          return;
      }
      const hideLoading = message.loading('正在上传遮罩并提交任务...', 0);
      try {
          const maskFile = await ctx.dataUrlToFile(payload.mask.dataUrl, 'inpaint-mask.png');
          const maskUpload = await uploadAssetFile(maskFile, { projectId: ctx.activeProjectId.value });
          if (!maskUpload.assetId) {
              throw new Error('遮罩上传失败');
          }
          ctx.closeImageInpaint();
          ctx.selectedNodeId.value = sourceNodeId;
          ctx.selectedKind.value = 'image';
          ctx.syncNodeSelectionHighlight(sourceNodeId);
          ctx.handleImageInpaintCapabilityAction({
              key: 'IMAGE_INPAINT',
              label: '局部修改',
              assetId,
          }, {
              prompt: payload.prompt,
              maskAssetId: maskUpload.assetId,
          });
      }
      catch (error) {
          message.error(error instanceof Error ? error.message : '局部修改提交失败，请稍后重试');
      }
      finally {
          hideLoading();
          settle();
      }
  };
  
  ctx.openImageErase = async function openImageErase() {
      const ready = await ctx.ensureImageEditorReady('擦除');
      if (!ready)
          return;
      ctx.showImageHdMenu.value = false;
      ctx.showImageDialogue.value = false;
      ctx.showImageToolbarMore.value = false;
      ctx.showImageToolbarMoreMenu.value = false;
      ctx.closeImageCrop();
      ctx.closeImageGridSplit();
      ctx.closeImageInpaint();
      ctx.closeImageExpand();
      ctx.closeImageEditText();
      ctx.eraseSourceNodeId.value = ctx.selectedNodeId.value;
      ctx.showImageErase.value = true;
      ctx.updateNodeToolbar();
  };
  
  ctx.closeImageErase = function closeImageErase() {
      ctx.showImageErase.value = false;
      ctx.eraseSourceNodeId.value = '';
      ctx.updateNodeToolbar();
  };
  
  ctx.focusErasedResultNode = function focusErasedResultNode(g: Graph, erasedNode: Node) {
      ctx.selectedNodeId.value = erasedNode.id;
      ctx.selectedKind.value = 'image';
      ctx.syncNodeSelectionHighlight(erasedNode.id);
      ctx.syncNodeCount();
      ctx.scheduleHistoryPush();
      nextTick(() => {
          const scroller = getScroller(g);
          const bbox = erasedNode.getBBox();
          scroller?.transitionToPoint(bbox.x + bbox.width / 2, bbox.y + bbox.height / 2, {
              duration: '280ms',
          });
          ctx.updateNodeToolbar();
      });
  };
  
  ctx.uploadLocalImageNodeInBackground = async function uploadLocalImageNodeInBackground(node: Node, localPreviewUrl: string, fileName: string, payload: {
      width: number;
      height: number;
      preserveTitle?: boolean;
      silent?: boolean;
  }) {
      try {
          const file = await previewUrlToUploadFile(localPreviewUrl, fileName, {
              width: payload.width,
              height: payload.height,
          });
          const upload = await uploadAssetFile(file, { projectId: ctx.activeProjectId.value });
          if (!upload.url || !upload.assetId)
              return;
          const g = ctx.graph.value;
          if (!g?.getCellById(node.id))
              return;
          const current = { ...(node.getData() as CanvasNodeData) };
          if (current.previewUrl !== localPreviewUrl)
              return;
          const remoteUrl = upload.url;
          if (payload.silent) {
              await new Promise<void>((resolve, reject) => {
                  const img = new Image();
                  img.onload = () => resolve();
                  img.onerror = () => reject(new Error('remote image preload failed'));
                  img.src = remoteUrl;
              });
          }
          const refreshed = { ...(node.getData() as CanvasNodeData) };
          if (refreshed.previewUrl !== localPreviewUrl)
              return;
          const prevTitle = refreshed.title;
          refreshed.assetId = upload.assetId;
          refreshed.previewUrl = remoteUrl;
          refreshed.uploadState = 'done';
          refreshed.uploadProgress = 100;
          refreshed.fileName = fileName || refreshed.fileName;
          refreshed.mediaWidth = upload.width ?? payload.width;
          refreshed.mediaHeight = upload.height ?? payload.height;
          if (payload.preserveTitle && prevTitle) {
              refreshed.title = prevTitle;
          }
          node.setData(refreshed);
          if (!payload.silent) {
              syncNodeShapeFromData(node);
              const size = getNodeSize(refreshed.kind, refreshed.mode, refreshed);
              node.resize(size.width, size.height);
          }
          if (localPreviewUrl.startsWith('blob:')) {
              URL.revokeObjectURL(localPreviewUrl);
          }
      }
      catch (error) {
          console.error('[Canvas] local image background upload failed', error);
      }
  };
  
  ctx.onImageEraseComplete = async function onImageEraseComplete(payload: {
      dataUrl: string;
      width: number;
      height: number;
  }) {
      const g = ctx.graph.value;
      const sourceNodeId = ctx.eraseSourceNodeId.value || ctx.selectedNodeId.value;
      if (!g || !sourceNodeId) {
          ctx.closeImageErase();
          return;
      }
      const cell = g.getCellById(sourceNodeId);
      if (!cell?.isNode()) {
          ctx.closeImageErase();
          return;
      }
      const sourceNode = cell as Node;
      const sourceData = sourceNode.getData() as CanvasNodeData;
      const fileName = sourceData.fileName ? `擦除-${sourceData.fileName}` : '擦除.png';
      const localPreviewUrl = payload.dataUrl;
      ctx.closeImageErase();
      const erasedNode = spawnErasedImageNode(g, sourceNode, payload);
      ctx.focusErasedResultNode(g, erasedNode);
      void ctx.uploadLocalImageNodeInBackground(erasedNode, localPreviewUrl, fileName, payload).then(() => {
          ctx.scheduleHistoryPush();
      });
  };
  
  ctx.handleImageCapabilityAction = function handleImageCapabilityAction(event: ImageToolbarClickEvent) {
      const title = buildImageActionResultTitle(event.label);
      const namePrefix = event.label?.trim() || '生成';
      void ctx.runImageGenerationTask(event, {
          capabilityCode: event.key,
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
  
  ctx.handleImageDialogueSubmit = async function handleImageDialogueSubmit(payload: ImageDialogueSubmitPayload) {
      const g = ctx.graph.value;
      const fromImageGenPrompt = Boolean(ctx.activeImageGenPromptNodeId.value);
      const sourceNodeId = ctx.getActiveImageDialogueTargetNodeId() || ctx.selectedNodeId.value;
      if (!g || !sourceNodeId)
          return;
      const cell = g.getCellById(sourceNodeId);
      if (!cell?.isNode())
          return;
      const sourceNode = cell as Node;
      const sourceData = sourceNode.getData() as CanvasNodeData;
      if (sourceData.kind === 'image' &&
          (sourceData.uploadState === 'uploading' || sourceData.imageGenState === 'loading')) {
          return;
      }
      const prompt = payload.prompt.trim();
      if (!canSubmitImageDialogueTask(prompt, sourceData.elementMarks)) {
          message.warning('请输入提示词或标记需要识别的商品位置');
          return;
      }
      const dialoguePreviews = ctx.getImageDialoguePreviewsForNode(sourceNodeId);
      const provenanceRefs = dialoguePreviews.length
          ? dialoguePreviews
          : ctx.seedImageDialogueRefs(sourceData, sourceNodeId);
      const provenanceSettings = { ...ctx.imageDialogueSettings.value };
      ctx.persistImageDialogueFields(sourceNodeId);
      if (fromImageGenPrompt) {
          ctx.closeImageGenPromptBar();
          ctx.exitImageDialogueCanvasPickMode();
      }
      else {
          ctx.resetImageDialogue();
      }
      const referenceAssetIds = dialoguePreviews
          .map((item) => item.assetId)
          .filter((id): id is string => Boolean(id));
      const assetId = referenceAssetIds[0] || resolveImageAssetId(sourceData) || '';
      const hasReferenceImages = Boolean(referenceAssetIds.length > 0 ||
          assetId ||
          provenanceRefs.some((item) => item.previewUrl?.trim()));
      const isImg2Img = hasReferenceImages;
      const imageDialogueTaskType = isImg2Img ? '图生图' : '文生图';
      // 选中工作流时，结果节点命名用工作流名称；否则回退到图生图/文生图
      const workflowName = payload.workflow?.name?.trim() ||
          (typeof payload.workflow?.description === 'string'
              ? payload.workflow.description.trim()
              : '') ||
          '';
      const resultLabel = workflowName || (isImg2Img ? '图生图' : '文生图');
      ctx.recordCanvasDescription(resultLabel, '');
      const title = buildImageActionResultTitle(resultLabel);
      const sourceFileName = sourceData.fileName || sourceData.title || '';
      const buildFileName = (name: string) => name ? `${resultLabel}-${name}` : `${resultLabel}.png`;
      const requestedCount = Math.max(1, Math.floor(Number(payload.count)) || 1);
      const taskParameters: Record<string, unknown> = {
          model: payload.model,
          aspectRatio: payload.aspectRatio,
          count: 1,
      };
      if (payload.resolution) {
          taskParameters.resolution = payload.resolution;
      }
      const dialogueElementMarks = Array.isArray(sourceData.elementMarks)
          ? sourceData.elementMarks
          : [];
      applyImageMarkTaskParameters(taskParameters, dialogueElementMarks, prompt);
      const buildIndexedFileName = (index: number) => ctx.resolveGenerationResultFileName(buildFileName, sourceFileName, index, requestedCount);
      /** 将对话框中的源图节点连到结果节点（多源多结果时形成多对多，与视频生成一致） */
      const connectImageRefsToResultNode = (resultNode: Node) => {
          for (const ref of provenanceRefs) {
              const refId = String(ref.nodeId ?? '').trim();
              if (!refId || refId === resultNode.id)
                  continue;
              const cell = g.getCellById(refId);
              if (!cell?.isNode())
                  continue;
              if (!findImageToVideoEdge(g, refId, resultNode.id)) {
                  connectGenEdge(g, refId, resultNode.id);
              }
          }
      };
      const disconnectDirectEdge = (fromId: string, toId: string) => {
          const edge = findImageToVideoEdge(g, fromId, toId);
          if (edge)
              g.removeEdge(edge.id);
      };
      /**
       * 多源图生图时，对话框宿主若是空占位节点，复用为第一个生成结果，
       * 避免中间残留「空上传过渡态」节点。
       */
      const reuseEmptyHostAsFirstResult = hasReferenceImages &&
          sourceData.kind === 'image' &&
          !sourceData.previewUrl?.trim() &&
          sourceData.uploadState !== 'uploading' &&
          sourceData.imageGenState !== 'loading';
      const resultNodes: Node[] = [];
      const inPlaceTarget = requestedCount === 1 &&
          shouldGenerateImageInPlaceOnNode(sourceData, { requestedCount, hasReferenceImages })
          ? sourceNode
          : null;
      const inPlaceTitle = inPlaceTarget && !hasReferenceImages && sourceData.kind === 'image'
          ? '文生图'
          : title;
      if (inPlaceTarget) {
          if (isImageGenerationFailedNode(sourceData)) {
              resetImageGenerationNodeForRetry(inPlaceTarget, {
                  title: inPlaceTitle,
                  fileName: buildIndexedFileName(0),
                  prompt,
              });
          }
          else {
              prepareImageNodeForInPlaceGeneration(inPlaceTarget, {
                  title: inPlaceTitle,
                  fileName: buildIndexedFileName(0),
                  prompt,
              });
          }
          resultNodes.push(inPlaceTarget);
      }
      else {
          const reusableNode = requestedCount === 1 ? findReusableImageGenerationNode(g, sourceNode) : null;
          if (reusableNode) {
              resetImageGenerationNodeForRetry(reusableNode, {
                  title,
                  fileName: buildIndexedFileName(0),
                  prompt,
              });
              resultNodes.push(reusableNode);
          }
          else if (reuseEmptyHostAsFirstResult) {
              prepareImageNodeForInPlaceGeneration(sourceNode, {
                  title,
                  fileName: buildIndexedFileName(0),
                  prompt,
              });
              resultNodes.push(sourceNode);
              if (requestedCount > 1) {
                  const batchPreviewSize = getImageGenerationPlaceholderSize(sourceNode);
                  const plannedPoints = planOutgoingResultPoints(g, sourceNode, batchPreviewSize, requestedCount, 'above');
                  for (let index = 1; index < requestedCount; index += 1) {
                      const node = spawnGenerationResultNode(g, sourceNode, {
                          title,
                          fileName: buildIndexedFileName(index),
                          centerPoint: plannedPoints[index],
                          layoutSlot: index,
                          layoutTotal: requestedCount,
                      });
                      // 去掉结果之间的宿主连线，最终由各源图分别连到结果（多对多）
                      disconnectDirectEdge(sourceNode.id, node.id);
                      resultNodes.push(node);
                  }
              }
          }
          else {
              const batchPreviewSize = getImageGenerationPlaceholderSize(sourceNode);
              const plannedPoints = planOutgoingResultPoints(g, sourceNode, batchPreviewSize, requestedCount, 'above');
              for (let index = 0; index < requestedCount; index += 1) {
                  resultNodes.push(spawnGenerationResultNode(g, sourceNode, {
                      title,
                      fileName: buildIndexedFileName(index),
                      centerPoint: plannedPoints[index],
                      layoutSlot: index,
                      layoutTotal: requestedCount,
                  }));
              }
          }
      }
      resultNodes.forEach((resultNode) => {
          ctx.applyImageDialogueProvenance(resultNode, {
              prompt,
              settings: provenanceSettings,
              sourceRefs: provenanceRefs,
              elementMarks: dialogueElementMarks.length ? dialogueElementMarks : undefined,
              generationParams: buildImageGenerationParams({
                  prompt,
                  capabilityCode: IMAGE_GENERAL_CAPABILITY_CODE,
                  parameters: taskParameters,
                  workflowId: resolveGenerationTaskWorkflowId(payload.workflowId, payload.workflow) ?? undefined,
                  referenceAssetIds: referenceAssetIds.length > 0
                      ? referenceAssetIds
                      : assetId
                          ? [assetId]
                          : undefined,
              }),
          });
          connectImageRefsToResultNode(resultNode);
      });
      const primaryNode = resultNodes[0];
      ctx.selectedNodeId.value = primaryNode.id;
      ctx.selectedKind.value = 'image';
      ctx.syncNodeSelectionHighlight(primaryNode.id);
      ctx.syncNodeCount();
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
      ctx.scheduleHistoryPush();
      // 图生图新节点下方对话框默认隐藏，用户点击节点后再打开
      const runners = resultNodes.map((resultNode, index) => {
          const fileName = ctx.resolveGenerationResultFileName(buildFileName, sourceFileName, index, requestedCount);
          return startImageGenerationOnNode(resultNode, {
              title,
              fileName,
              createTask: async () => {
                  const idempotencyKey = createIdempotencyKey('img-dialogue', index);
                  const created = await api.createGenerationTask<GenerationTaskDetail>({
                      taskType: 'IMAGE',
                      capabilityCode: IMAGE_GENERAL_CAPABILITY_CODE,
                      prompt,
                      parameters: taskParameters,
                      projectId: ctx.activeProjectId.value,
                      nodeId: resultNode.id,
                      referenceAssetIds: referenceAssetIds.length > 0
                          ? referenceAssetIds
                          : assetId
                              ? [assetId]
                              : undefined,
                      workflowId: resolveGenerationTaskWorkflowId(payload.workflowId, payload.workflow),
                  }, idempotencyKey);
                  ctx.userInfoStore.queryPointAccount();
                  return created;
              },
              onTaskBound: () => ctx.persistGenerationTaskBinding(resultNode, {
                  detail: prompt,
                  taskType: imageDialogueTaskType,
              }),
              onError: (reason) => message.error(reason),
              onComplete: async (result) => {
                  // 空宿主已复用为结果节点时，禁止当「源」清空溯源（否则 sibling 完成会擦掉第一张结果的参考图）
                  if (!reuseEmptyHostAsFirstResult) {
                      ctx.resetSourceImageDialogueAfterSuccess(sourceNode, resultNode, result);
                  }
                  if (!result.success || index !== 0)
                      return;
                  const extraResults = result.extraResults ?? [];
                  if (!extraResults.length)
                      return;
                  const totalCount = 1 + extraResults.length;
                  const extraNodes = await ctx.spawnNodesForExtraGenerationResults(g, sourceNode, extraResults, {
                      title,
                      sourceFileName,
                      buildFileName,
                      resultIndexOffset: 1,
                      totalCount,
                      placement: 'above',
                      snapshotSourceNode: primaryNode,
                  });
                  if (!extraNodes.length)
                      return;
                  const dialogueSharedTaskId = String((primaryNode.getData() as CanvasNodeData).generationTaskId ?? '').trim();
                  if (dialogueSharedTaskId) {
                      bindSharedGenerationTaskId([
                          { node: primaryNode, resultIndex: 0 },
                          ...extraNodes.map((node, offset) => ({ node, resultIndex: 1 + offset })),
                      ], dialogueSharedTaskId, 'IMAGE');
                  }
                  extraNodes.forEach((node) => {
                      // 用提交时捕获的溯源显式回写，避免 primary 被清空后 clone 得到空 refs
                      ctx.applyImageDialogueProvenance(node, {
                          prompt,
                          settings: provenanceSettings,
                          sourceRefs: provenanceRefs,
                          elementMarks: dialogueElementMarks.length ? dialogueElementMarks : undefined,
                          generationParams: buildImageGenerationParams({
                              prompt,
                              capabilityCode: IMAGE_GENERAL_CAPABILITY_CODE,
                              parameters: taskParameters,
                              workflowId: resolveGenerationTaskWorkflowId(payload.workflowId, payload.workflow) ?? undefined,
                              referenceAssetIds: referenceAssetIds.length > 0
                                  ? referenceAssetIds
                                  : assetId
                                      ? [assetId]
                                      : undefined,
                          }),
                      });
                      // 空宿主已复用为结果时，去掉结果间连线，改为各源图连到新结果
                      if (reuseEmptyHostAsFirstResult) {
                          disconnectDirectEdge(sourceNode.id, node.id);
                      }
                      connectImageRefsToResultNode(node);
                  });
                  ctx.syncNodeCount();
                  ctx.bumpToolbarRevision();
                  ctx.updateNodeToolbar();
                  ctx.scheduleHistoryPush();
                  nextTick(() => {
                      const scroller = getScroller(g);
                      if (!scroller)
                          return;
                      const center = getBoundingBoxCenter([sourceNode, ...extraNodes].map((node) => node.getBBox()));
                      scroller.transitionToPoint(center.x, center.y, {
                          duration: '280ms',
                      });
                  });
              },
          });
      });
      try {
          const outcomes = await Promise.allSettled(runners);
          const started = outcomes.some((outcome) => outcome.status === 'fulfilled' && outcome.value.started);
          if (!started) {
              resultNodes.forEach((node) => {
                  if ((node.getData() as CanvasNodeData).imageGenState === 'loading') {
                      markGenerationNodeFailed(node);
                  }
              });
              return;
          }
          ctx.scheduleHistoryPush();
      }
      catch (error) {
          resultNodes.forEach((node) => {
              if ((node.getData() as CanvasNodeData).imageGenState === 'loading') {
                  markGenerationNodeFailed(node);
              }
          });
          message.error(isRequestError(error) ? error.message : '生成失败，请稍后重试');
      }
      finally {
          ctx.bumpToolbarRevision();
          ctx.updateNodeToolbar();
      }
  };
  
  ctx.handleVideoDialogueSubmit = function handleVideoDialogueSubmit(payload: VideoDialogueSubmitPayload) {
      const prompt = payload.prompt.trim();
      if (!prompt) {
          message.warning('请输入提示词');
          return;
      }
      ctx.recordCanvasDescription(prompt, resolveVideoTaskTypeLabel(payload.mode));
      const g = ctx.graph.value;
      const sourceNodeId = ctx.selectedNodeId.value;
      if (!g || !sourceNodeId)
          return;
      const sourceCell = g.getCellById(sourceNodeId);
      if (!sourceCell?.isNode())
          return;
      const sourceNode = sourceCell as Node;
      const sourceData = sourceNode.getData() as CanvasNodeData;
      const submitCtx = resolveVideoGenerationSubmitContext(g, sourceNodeId, sourceData, {
          payloadMode: payload.mode,
          preferStored: true,
      });
      const { imageAssetIds, videoAssetId, mode } = submitCtx;
      const imageAssetId = imageAssetIds[0] || '';
      ctx.persistVideoDialogueFields(sourceNodeId);
      ctx.applyVideoGenerationProvenance(sourceNode, { ...payload, prompt, mode }, submitCtx.refs);
      ctx.resetVideoDialogue();
      const event: VideoToolbarClickEvent = {
          key: VIDEO_GENERAL_CAPABILITY_CODE,
          label: '视频生成',
          assetId: imageAssetId || videoAssetId,
      };
      void ctx.runVideoGenerationTask(event, {
          capabilityCode: VIDEO_GENERAL_CAPABILITY_CODE,
          title: buildVideoActionResultTitle('视频生成'),
          prompt,
          requireAssetId: false,
          requireSourcePreview: false,
          resolveReferenceAssetIds: () => imageAssetIds,
          buildFileName: (sourceFileName) => sourceFileName ? `视频生成-${sourceFileName}` : '视频生成.mp4',
          buildParameters: () => {
              const params: Record<string, unknown> = {
                  mode,
                  model: payload.model,
                  ratio: payload.ratio,
                  clarity: toVideoApiClarity(payload.clarity),
                  duration: payload.duration,
                  generateAudio: payload.generateAudio,
                  videoCount: payload.videoCount,
              };
              const primaryAssetId = imageAssetId || videoAssetId;
              if (primaryAssetId) {
                  params.assetId = primaryAssetId;
              }
              return params;
          },
      });
  };
  
  ctx.handleVideoGenPromptSubmit = function handleVideoGenPromptSubmit(payload: VideoGenPromptSubmitPayload) {
      const prompt = payload.prompt.trim();
      if (!prompt) {
          message.warning('请输入提示词');
          return;
      }
      ctx.recordCanvasDescription(prompt, resolveVideoTaskTypeLabel(payload.mode));
      const g = ctx.graph.value;
      const sourceNodeId = ctx.activeVideoGenPromptNodeId.value;
      if (!g || !sourceNodeId)
          return;
      const sourceCell = g.getCellById(sourceNodeId);
      if (!sourceCell?.isNode())
          return;
      const sourceNode = sourceCell as Node;
      const sourceData = sourceNode.getData() as CanvasNodeData;
      if (sourceData.kind !== 'video')
          return;
      if (sourceData.uploadState === 'uploading') {
          message.warning('视频上传中，请稍后再试');
          return;
      }
      const submitCtx = resolveVideoGenerationSubmitContext(g, sourceNodeId, sourceData, {
          payloadMode: payload.mode,
          preferStored: true,
      });
      const { imageAssetIds, mode: resolvedMode } = submitCtx;
      const assetId = imageAssetIds[0] || submitCtx.videoAssetId || '';
      const needsImage = payload.mode === 'reference' ||
          payload.mode === 'image-to-video' ||
          payload.mode === 'first-last-frame';
      if (needsImage && !imageAssetIds.length) {
          message.warning('请先连接或上传参考图片');
          return;
      }
      ctx.persistVideoGenPrompt();
      ctx.closeVideoGenPromptBar();
      ctx.applyVideoGenerationProvenance(sourceNode, {
          prompt,
          model: payload.model,
          ratio: payload.ratio,
          clarity: payload.clarity,
          duration: payload.duration,
          generateAudio: payload.generateAudio,
          videoCount: payload.videoCount,
          mode: resolvedMode,
      }, submitCtx.refs);
      ctx.videoGenAspectRatio.value = payload.ratio as VideoGenAspectRatio;
      ctx.syncVideoNodeAspectRatio(sourceNodeId, payload.ratio as VideoGenAspectRatio);
      const title = buildVideoActionResultTitle('视频生成');
      const videoGenTaskType = resolveVideoTaskTypeLabel(payload.mode);
      const sourceFileName = sourceData.fileName || sourceData.title || '';
      const buildFileName = (name: string) => (name ? `视频生成-${name}` : '视频生成.mp4');
      const requestedCount = Math.max(1, Math.floor(Number(payload.videoCount)) || 1);
      const parameters: Record<string, unknown> = {
          mode: resolvedMode,
          model: payload.model,
          ratio: payload.ratio,
          clarity: toVideoApiClarity(payload.clarity),
          duration: payload.duration,
          generateAudio: payload.generateAudio,
          videoCount: 1,
      };
      if (assetId) {
          parameters.assetId = assetId;
      }
      const apiParameters = applyVideoFirstLastFrameParameters(parameters, resolvedMode, imageAssetIds);
      const connectRefsToVideoNode = (node: Node) => {
          for (const ref of submitCtx.refs) {
              if (!findImageToVideoEdge(g, ref.nodeId, node.id)) {
                  connectGenEdge(g, ref.nodeId, node.id);
              }
          }
      };
      if (requestedCount > 1) {
          const refreshedSource = sourceNode.getData() as CanvasNodeData;
          const layoutSize = ctx.resolveVideoResultLayoutSize(refreshedSource);
          const plannedPoints = planOutgoingResultPoints(g, sourceNode, layoutSize, requestedCount, 'right');
          const resultNodes: Node[] = [];
          for (let index = 0; index < requestedCount; index += 1) {
              const resultNode = spawnVideoGenerationResultNode(g, sourceNode, {
                  title,
                  fileName: ctx.resolveGenerationResultFileName(buildFileName, sourceFileName, index, requestedCount),
                  videoDialogueText: prompt,
                  videoDialogueSettings: refreshedSource.videoDialogueSettings,
                  videoSourceRefs: refreshedSource.videoSourceRefs,
                  genPrompt: prompt,
                  centerPoint: plannedPoints[index],
              });
              connectRefsToVideoNode(resultNode);
              resultNodes.push(resultNode);
          }
          const primaryNode = resultNodes[0];
          ctx.selectedNodeId.value = primaryNode.id;
          ctx.selectedKind.value = 'video';
          ctx.syncNodeSelectionHighlight(primaryNode.id);
          ctx.syncNodeCount();
          ctx.bumpToolbarRevision();
          ctx.updateNodeToolbar();
          ctx.scheduleHistoryPush();
          resultNodes.forEach((resultNode) => {
              ctx.applyVideoGenerationProvenance(resultNode, {
                  prompt,
                  model: payload.model,
                  ratio: payload.ratio,
                  clarity: payload.clarity,
                  duration: payload.duration,
                  generateAudio: payload.generateAudio,
                  videoCount: 1,
                  mode: resolvedMode,
              }, submitCtx.refs, {
                  capabilityCode: VIDEO_GENERAL_CAPABILITY_CODE,
                  parameters: apiParameters,
                  referenceAssetIds: imageAssetIds.length ? imageAssetIds : undefined,
              });
          });
          void Promise.all(resultNodes.map(async (resultNode, index) => {
              const nodeFileName = ctx.resolveGenerationResultFileName(buildFileName, sourceFileName, index, requestedCount);
              const idempotencyKey = createIdempotencyKey('video-gen', index);
              try {
                  const created = normalizeGenerationTaskDetail(await api.createGenerationTask<GenerationTaskDetail>({
                      taskType: 'VIDEO',
                      capabilityCode: VIDEO_GENERAL_CAPABILITY_CODE,
                      prompt: toVideoApiPrompt(prompt),
                      parameters: apiParameters,
                      projectId: ctx.activeProjectId.value,
                      nodeId: resultNode.id,
                      referenceAssetIds: imageAssetIds.length ? imageAssetIds : undefined,
                  }, idempotencyKey));
                  const taskId = created.id;
                  if (!taskId) {
                      throw new Error('创建视频生成任务失败');
                  }
                  ctx.userInfoStore.queryPointAccount();
                  bindGenerationTaskId(resultNode, taskId, 'VIDEO');
                  ctx.persistGenerationTaskBinding(resultNode, { detail: prompt, taskType: videoGenTaskType });
                  startVideoGenerationTaskFollow(resultNode, taskId, {
                      title,
                      fileName: nodeFileName,
                      onError: (reason) => message.error(reason),
                      onComplete: (success) => ctx.handleVideoGenerationTaskComplete(resultNode.id, success),
                  });
              }
              catch (error) {
                  markVideoGenerationNodeFailed(resultNode);
                  ctx.revealVideoDialogueAfterGenerationFailure(resultNode.id);
                  message.error(isRequestError(error) ? error.message : '视频生成失败，请稍后重试');
              }
          }));
          return;
      }
      const reusableNode = findReusableVideoGenerationNode(g, sourceNode);
      const targetNode = reusableNode ?? sourceNode;
      const fileName = buildFileName(sourceFileName);
      if (reusableNode) {
          resetVideoGenerationNodeForRetry(reusableNode, { title, fileName, prompt });
      }
      const provenanceData = targetNode.getData() as CanvasNodeData;
      targetNode.setData({
          ...provenanceData,
          kind: 'video',
          mode: 'editor',
          uploadState: 'uploading',
          uploadProgress: 0,
          generationTaskType: 'VIDEO',
          genPrompt: prompt,
          videoDialogueText: prompt,
          title,
          fileName,
          videoGenAspectRatio: payload.ratio,
          videoGenTab: payload.tab,
          generationTaskId: undefined,
      }, { overwrite: true });
      connectRefsToVideoNode(targetNode);
      ctx.applyVideoGenerationProvenance(targetNode, {
          prompt,
          model: payload.model,
          ratio: payload.ratio,
          clarity: payload.clarity,
          duration: payload.duration,
          generateAudio: payload.generateAudio,
          videoCount: payload.videoCount,
          mode: resolvedMode,
      }, submitCtx.refs, {
          capabilityCode: VIDEO_GENERAL_CAPABILITY_CODE,
          parameters: apiParameters,
          referenceAssetIds: imageAssetIds.length ? imageAssetIds : undefined,
      });
      ctx.selectedNodeId.value = targetNode.id;
      ctx.selectedKind.value = 'video';
      ctx.syncNodeSelectionHighlight(targetNode.id);
      ctx.syncNodeCount();
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
      ctx.scheduleHistoryPush();
      const idempotencyKey = createIdempotencyKey('video-gen');
      void (async () => {
          try {
              const created = normalizeGenerationTaskDetail(await api.createGenerationTask<GenerationTaskDetail>({
                  taskType: 'VIDEO',
                  capabilityCode: VIDEO_GENERAL_CAPABILITY_CODE,
                  prompt: toVideoApiPrompt(prompt),
                  parameters: apiParameters,
                  projectId: ctx.activeProjectId.value,
                  nodeId: targetNode.id,
                  referenceAssetIds: imageAssetIds.length ? imageAssetIds : undefined,
              }, idempotencyKey));
              const taskId = created.id;
              if (!taskId) {
                  throw new Error('创建视频生成任务失败');
              }
              ctx.userInfoStore.queryPointAccount();
              bindGenerationTaskId(targetNode, taskId, 'VIDEO');
              ctx.persistGenerationTaskBinding(targetNode, { detail: prompt, taskType: videoGenTaskType });
              startVideoGenerationTaskFollow(targetNode, taskId, {
                  title,
                  fileName,
                  onError: (reason) => message.error(reason),
                  onComplete: (success) => ctx.handleVideoGenerationTaskComplete(targetNode.id, success),
              });
          }
          catch (error) {
              markVideoGenerationNodeFailed(targetNode);
              ctx.revealVideoDialogueAfterGenerationFailure(targetNode.id);
              message.error(isRequestError(error) ? error.message : '视频生成失败，请稍后重试');
          }
      })();
  };
}
