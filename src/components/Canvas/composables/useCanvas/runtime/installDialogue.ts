// @ts-nocheck -- 动态共享上下文保持原闭包的运行时类型；公开契约仍由 CanvasBindings 校验。
/**
 * 职责：安装 Dialogue 域的真实画布业务实现。
 * 依赖：共享 ctx（bind 状态与跨域惰性函数）；不导入其他安装器。
 * 副作用：向 ctx 注册方法/派生状态，部分域会绑定监听或更新画布状态。
 */
import { isRequestError } from '@/utils/request';
import type { Node } from '@antv/x6';
import { message } from 'ant-design-vue';
import { nextTick,provide } from 'vue';
import { createDefaultVideoDialogueSettings,IMAGE_GENERAL_CAPABILITY_CODE,isNodeFileUploading,normalizeImageDialogueSettingsForModel,pickImageDialogueSettingsInput,resolveGenerationTaskWorkflowId,resolveImageAssetId,toVideoApiClarity,VIDEO_GENERAL_CAPABILITY_CODE,type ImageDialogueSubmitPayload,type ImageMarkItem,type VideoDialogueSubmitPayload,type VideoGenAspectRatio } from '../../../constants';
import { buildImageGenerationParams,buildTextGenerationParams,imageDialogueSettingsFromPayload,persistNodeGenerationSnapshot } from '../../../generationParams';
import { bindGenerationTaskId,followTextGenerationTaskOnNode,isGenerationTaskTerminal,markTextGenerationNodeFailed,markVideoGenerationNodeFailed,normalizeGenerationTaskDetail,pollGenerationTask,runImageGenerationOnNode,startImageGenerationOnNode,startVideoGenerationTaskFollow,type GenerationTaskDetail } from '../../../generationTask';
import { createIdempotencyKey } from '../../../idempotency';
import { appendElementMarkToNode,appendImageMarkToNode,buildImageMarkItem,clientPointToImageNaturalCoords,isImageMarkAnalyzing,parseImageMarkRecognizeResult,removeImageMarkFromGraph,replaceImageMarkOnGraph,setImageMarkAnalyzing,syncNodeImageMarkLists,updateImageMarkLabelOnNode } from '../../../imageMarkUtils';
import { toVideoApiPrompt } from '../../../promptMention';
import { getBoundingBoxCenter } from '../../../viewport';
import type { CanvasNodeData,ImageSourceRef } from '.././sharedImports';
import { api,ensureImageTextEdge,findIncomingTextNodes,getImageMarkHintPosition,getNodeSize,getScroller,getVideoSourceRefs,IMG2PROMPT_DEFAULT_INSTRUCTION,isImageGenerationFailedNode,isVideoGenerationFailedNode,plainTextFromNodeContent,planOutgoingResultPoints,prepareImageNodeForInPlaceGeneration,resetImageGenerationNodeForRetry,resolveText2ImageGenerationTargetNode,resolveVideoSourceRefsForNode,runUploadSimulation,spawnGenerationResultNode,spawnVideoGenerationResultNode,syncNodeShapeFromData,syncTextNodeImageSource,toPersistedVideoSourceRefs,uploadAssetFile } from '.././sharedImports';
import type { CoreRuntimeContext } from './context';

export function installDialogue(ctx: CoreRuntimeContext) {
  ctx.requestCanvasUpload = function requestCanvasUpload(nodeId: string) {
      const g = ctx.graph.value;
      const cell = g?.getCellById(nodeId);
      const data = cell?.getData() as CanvasNodeData | undefined;
      if (isNodeFileUploading(data))
          return;
      const isVideo = data?.kind === 'video';
      ctx.triggerFileInputClick(isVideo ? 'video/*' : 'image/*', isVideo ? 'video' : 'image', false, nodeId);
  };
  
  provide('requestCanvasUpload', ctx.requestCanvasUpload);
  
  ctx.uploadFileToCanvasNode = function uploadFileToCanvasNode(nodeId: string, file: File) {
      const g = ctx.graph.value;
      if (!g)
          return;
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      const node = cell as Node;
      const data = { ...(node.getData() as CanvasNodeData) };
      if (isNodeFileUploading(data))
          return;
      data.mode = 'editor';
      node.setData(data);
      ctx.pendingUploadNodeId.value = '';
      ctx.selectedNodeId.value = nodeId;
      ctx.selectedKind.value = data.kind;
      runUploadSimulation(node, file);
      ctx.updateNodeToolbar();
      ctx.scheduleHistoryPush({ autoSave: false });
  };
  
  provide('uploadFileToCanvasNode', ctx.uploadFileToCanvasNode);
  
  provide('updateImageMarkLabel', ctx.updateImageMarkLabel);
  
  ctx.resolveImageGenTextSourcePreview = function resolveImageGenTextSourcePreview(nodeId: string): string {
      const g = ctx.graph.value;
      if (!g)
          return '';
      const cell = g.getCellById(nodeId);
      if (cell?.isNode()) {
          const data = cell.getData() as CanvasNodeData;
          if (data.kind === 'text') {
              return ctx.getTextNodePlainContent(cell as Node);
          }
      }
      for (const textNode of findIncomingTextNodes(g, nodeId)) {
          const text = ctx.getTextNodePlainContent(textNode);
          if (text)
              return text;
      }
      return '';
  };
  
  ctx.loadImageGenPromptFields = function loadImageGenPromptFields(nodeId: string) {
      const g = ctx.graph.value;
      if (!g)
          return;
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      const data = cell.getData() as CanvasNodeData;
      const textPreview = ctx.resolveImageGenTextSourcePreview(nodeId);
      ctx.imageGenSourceTextPreview.value = textPreview;
      ctx.imageGenSourcePreviewUrl.value = textPreview ? '' : (data.sourcePreviewUrl ?? '');
      ctx.imageGenSeed.value = data.genSeed ?? 58;
      let prompt = '';
      if (data.kind === 'text') {
          if (data.imageDialogueText != null) {
              prompt = data.imageDialogueText.trim();
          }
          else if (textPreview) {
              prompt = textPreview;
          }
      }
      else {
          prompt = data.imageDialogueText?.trim() || data.genPrompt?.trim() || '';
          if (!prompt && textPreview) {
              prompt = textPreview;
          }
      }
      ctx.imageGenPromptText.value = prompt;
      ctx.imageDialogueText.value = prompt;
      ctx.imageDialogueSettings.value = ctx.normalizeImageDialogueSettings(data.imageDialogueSettings);
      if (data.kind === 'text') {
          if (data.imageDialogueText == null && prompt) {
              cell.setData({
                  ...data,
                  imageDialogueText: prompt,
              });
          }
          return;
      }
      if (prompt && (prompt !== data.genPrompt || (!data.imageDialogueText?.trim() && prompt !== data.imageDialogueText))) {
          cell.setData({
              ...data,
              genPrompt: prompt,
              imageDialogueText: data.imageDialogueText?.trim() ? data.imageDialogueText : prompt,
          });
      }
  };
  
  ctx.normalizeImageDialogueSettings = function normalizeImageDialogueSettings(saved?: CanvasNodeData['imageDialogueSettings']) {
      return normalizeImageDialogueSettingsForModel(pickImageDialogueSettingsInput(saved ?? {}));
  };
  
  ctx.loadImageDialogueFields = function loadImageDialogueFields(nodeId: string) {
      const g = ctx.graph.value;
      if (!g)
          return;
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      const data = cell.getData() as CanvasNodeData;
      if (data.kind !== 'image')
          return;
      ctx.activeImageDialogueNodeId = nodeId;
      ctx.imageDialogueText.value =
          data.imageDialogueText?.trim() || data.genPrompt?.trim() || '';
      ctx.imageDialogueSettings.value = ctx.normalizeImageDialogueSettings(data.imageDialogueSettings);
  };
  
  ctx.persistImageDialogueFields = function persistImageDialogueFields(nodeId?: string) {
      const g = ctx.graph.value;
      const id = nodeId ||
          ctx.activeImageGenPromptNodeId.value || ctx.activeImageDialogueNodeId ||
          (ctx.showImageDialogue.value ? ctx.selectedNodeId.value : '');
      if (!g || !id)
          return;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return;
      const data = { ...(cell.getData() as CanvasNodeData) };
      if (!ctx.canNodeHostImageDialogue(data, id))
          return;
      data.imageDialogueText = ctx.imageDialogueText.value;
      data.imageDialogueSettings = { ...ctx.imageDialogueSettings.value };
      if (ctx.imageDialogueText.value.trim() && data.kind !== 'text') {
          data.genPrompt = ctx.imageDialogueText.value;
      }
      cell.setData(data, { overwrite: true });
  };
  
  ctx.normalizeVideoDialogueSettings = function normalizeVideoDialogueSettings(saved?: CanvasNodeData['videoDialogueSettings']) {
      const defaults = createDefaultVideoDialogueSettings();
      if (!saved)
          return defaults;
      return {
          modelKey: saved.modelKey?.trim() ? saved.modelKey : defaults.modelKey,
          aspectRatio: saved.aspectRatio ?? defaults.aspectRatio,
          resolution: saved.resolution ?? defaults.resolution,
          duration: saved.duration ?? defaults.duration,
          generateAudio: saved.generateAudio ?? defaults.generateAudio,
          mode: saved.mode ?? defaults.mode,
          videoCount: saved.videoCount ?? defaults.videoCount,
      };
  };
  
  ctx.loadVideoDialogueFields = function loadVideoDialogueFields(nodeId: string) {
      const g = ctx.graph.value;
      if (!g)
          return;
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      const data = cell.getData() as CanvasNodeData;
      if (data.kind !== 'video')
          return;
      ctx.activeVideoDialogueNodeId = nodeId;
      // 优先对话框字段；旧节点/底部面板生成的结果回退到 genPrompt
      ctx.videoDialogueText.value = data.videoDialogueText?.trim()
          ? data.videoDialogueText
          : data.genPrompt ?? '';
      ctx.videoDialogueSettings.value = ctx.normalizeVideoDialogueSettings(data.videoDialogueSettings);
      // 打开对话框时若尚无快照，把当前连线参考图落盘，保证刷新后可溯源
      const liveRefs = getVideoSourceRefs(g, nodeId);
      if (liveRefs.length && !(data.videoSourceRefs?.length)) {
          ctx.syncVideoSourceRefsSnapshot(nodeId);
      }
      const ratio = ctx.videoDialogueSettings.value.aspectRatio;
      if (ratio && ratio !== 'auto') {
          ctx.syncVideoNodeAspectRatio(nodeId, ratio as VideoGenAspectRatio);
      }
  };
  
  ctx.persistVideoDialogueFields = function persistVideoDialogueFields(nodeId?: string) {
      const g = ctx.graph.value;
      const id = nodeId || ctx.activeVideoDialogueNodeId ||
          (ctx.showVideoDialogue.value ? ctx.selectedNodeId.value : '');
      if (!g || !id)
          return;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return;
      const data = { ...(cell.getData() as CanvasNodeData) };
      if (data.kind !== 'video')
          return;
      data.videoDialogueText = ctx.videoDialogueText.value;
      data.videoDialogueSettings = { ...ctx.videoDialogueSettings.value };
      // 同步 genPrompt，便于与底部生成面板共用溯源
      if (ctx.videoDialogueText.value.trim()) {
          data.genPrompt = ctx.videoDialogueText.value;
      }
      cell.setData(data, { overwrite: true });
      ctx.syncVideoSourceRefsSnapshot(id);
      const ratio = ctx.videoDialogueSettings.value.aspectRatio;
      if (ratio && ratio !== 'auto') {
          ctx.syncVideoNodeAspectRatio(id, ratio as VideoGenAspectRatio);
      }
  };
  
  ctx.persistImageGenPrompt = function persistImageGenPrompt() {
      const g = ctx.graph.value;
      const nodeId = ctx.activeImageGenPromptNodeId.value;
      if (!g || !nodeId)
          return;
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      const data = { ...(cell.getData() as CanvasNodeData) };
      if (!ctx.canNodeHostImageDialogue(data, nodeId))
          return;
      data.genSeed = ctx.imageGenSeed.value;
      if (data.kind === 'text') {
          data.imageDialogueText = ctx.imageDialogueText.value;
          data.imageDialogueSettings = { ...ctx.imageDialogueSettings.value };
      }
      else {
          data.imageDialogueText = ctx.imageDialogueText.value || ctx.imageGenPromptText.value;
          data.imageDialogueSettings = { ...ctx.imageDialogueSettings.value };
          data.genPrompt = ctx.imageGenPromptText.value || ctx.imageDialogueText.value;
      }
      cell.setData(data);
  };
  
  ctx.syncVideoNodeAspectRatio = function syncVideoNodeAspectRatio(nodeId: string, ratio: VideoGenAspectRatio) {
      const g = ctx.graph.value;
      if (!g)
          return;
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      const data = { ...(cell.getData() as CanvasNodeData) };
      if (data.kind !== 'video')
          return;
      const node = cell as Node;
      const pos = node.position();
      const oldSize = node.getSize();
      const anchorBottomY = pos.y + oldSize.height;
      const anchorCenterX = pos.x + oldSize.width / 2;
      data.videoGenAspectRatio = ratio;
      cell.setData(data);
      syncNodeShapeFromData(node);
      const size = getNodeSize(data.kind, data.mode, data);
      node.resize(size.width, size.height);
      node.position(anchorCenterX - size.width / 2, anchorBottomY - size.height);
      ctx.updateVideoGenPromptBarPosition();
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
  };
  
  ctx.onVideoGenAspectRatioChange = function onVideoGenAspectRatioChange(ratio: VideoGenAspectRatio) {
      ctx.videoGenAspectRatio.value = ratio;
      const nodeId = ctx.activeVideoGenPromptNodeId.value;
      if (!nodeId)
          return;
      ctx.syncVideoNodeAspectRatio(nodeId, ratio);
      ctx.persistVideoGenPrompt();
  };
  
  ctx.loadVideoGenPromptFields = function loadVideoGenPromptFields(nodeId: string) {
      const g = ctx.graph.value;
      if (!g)
          return;
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      const data = cell.getData() as CanvasNodeData;
      const upstreamText = ctx.resolveVideoUpstreamPrompt(nodeId);
      let prompt = data.genPrompt?.trim() ?? '';
      if (!prompt) {
          prompt = data.videoDialogueText?.trim() ?? '';
      }
      if (!prompt && upstreamText) {
          prompt = upstreamText;
      }
      ctx.videoGenPromptText.value = prompt;
      ctx.videoGenActiveTab.value = data.videoGenTab ?? 'text2video';
      ctx.videoGenAspectRatio.value =
          (data.videoGenAspectRatio as VideoGenAspectRatio) ||
              (data.videoDialogueSettings?.aspectRatio as VideoGenAspectRatio) ||
              '16:9';
      if (prompt && prompt !== data.genPrompt) {
          cell.setData({ ...data, genPrompt: prompt });
      }
      ctx.syncVideoNodeAspectRatio(nodeId, ctx.videoGenAspectRatio.value as VideoGenAspectRatio);
  };
  
  ctx.getTextNodePlainContent = function getTextNodePlainContent(node: Node): string {
      const api = ctx.textEditorApis.get(node.id);
      if (api) {
          const live = api.getPlainText().trim();
          if (live)
              return live;
      }
      const data = node.getData() as CanvasNodeData;
      return plainTextFromNodeContent(data.content);
  };
  
  ctx.resolveVideoUpstreamPrompt = function resolveVideoUpstreamPrompt(videoNodeId: string): string {
      const g = ctx.graph.value;
      if (!g)
          return '';
      for (const textNode of findIncomingTextNodes(g, videoNodeId)) {
          const text = ctx.getTextNodePlainContent(textNode);
          if (text)
              return text;
      }
      return '';
  };
  
  ctx.persistVideoGenPrompt = function persistVideoGenPrompt() {
      const g = ctx.graph.value;
      const nodeId = ctx.activeVideoGenPromptNodeId.value;
      if (!g || !nodeId)
          return;
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      const data = { ...(cell.getData() as CanvasNodeData) };
      data.genPrompt = ctx.videoGenPromptText.value;
      data.videoGenTab = ctx.videoGenActiveTab.value;
      data.videoGenAspectRatio = ctx.videoGenAspectRatio.value;
      // 底部面板输入同步到对话框溯源字段，生成后点「对话」可回显
      if (ctx.videoGenPromptText.value.trim()) {
          data.videoDialogueText = ctx.videoGenPromptText.value;
      }
      const liveRefs = getVideoSourceRefs(g, nodeId);
      if (liveRefs.length) {
          data.videoSourceRefs = toPersistedVideoSourceRefs(liveRefs);
      }
      cell.setData(data, { overwrite: true });
  };
  
  ctx.seedPromptImageRefs = function seedPromptImageRefs(data: CanvasNodeData): ImageSourceRef[] {
      const refs = Array.isArray(data.imageSourceRefs) ? [...data.imageSourceRefs] : [];
      if (refs.length)
          return refs;
      if (data.sourcePreviewUrl) {
          refs.push({
              nodeId: data.linkedImageNodeId || data.sourceNodeId || '',
              assetId: data.sourceAssetId,
              previewUrl: data.sourcePreviewUrl,
              fileName: data.sourceFileName ?? '',
          });
      }
      return refs;
  };
  
  ctx.resolvePromptReferenceAssetIds = function resolvePromptReferenceAssetIds(data: CanvasNodeData): string[] {
      const g = ctx.graph.value;
      if (!g)
          return [];
      return ctx.seedPromptImageRefs(data)
          .map((item) => {
          if (item.assetId)
              return item.assetId;
          if (item.nodeId) {
              const imageCell = g.getCellById(item.nodeId);
              if (imageCell?.isNode()) {
                  return resolveImageAssetId(imageCell.getData() as CanvasNodeData);
              }
          }
          return '';
      })
          .filter((id): id is string => Boolean(id));
  };
  
  ctx.refreshPromptSourcePreviews = function refreshPromptSourcePreviews(data: CanvasNodeData) {
      ctx.promptSourcePreviewUrl.value = data.sourcePreviewUrl ?? '';
      ctx.promptSourceFileName.value = data.sourceFileName ?? '';
      ctx.promptSourcePreviews.value = Array.isArray(data.imageSourceRefs)
          ? data.imageSourceRefs.filter((item) => item.previewUrl)
          : [];
  };
  
  ctx.addPromptImageSourceRef = function addPromptImageSourceRef(payload: {
      nodeId?: string;
      assetId?: string;
      previewUrl: string;
      fileName?: string;
  }) {
      const g = ctx.graph.value;
      const textNodeId = ctx.activePickerNodeId.value;
      if (!g || !textNodeId || !payload.previewUrl)
          return;
      const cell = g.getCellById(textNodeId);
      if (!cell?.isNode())
          return;
      const data = { ...(cell.getData() as CanvasNodeData) };
      if (data.kind !== 'text')
          return;
      const ref: ImageSourceRef = {
          nodeId: payload.nodeId || payload.assetId || `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          assetId: payload.assetId,
          previewUrl: payload.previewUrl,
          fileName: payload.fileName ?? '',
      };
      let refs = ctx.seedPromptImageRefs(data);
      const existingIdx = payload.nodeId
          ? refs.findIndex((item) => item.nodeId === payload.nodeId)
          : refs.findIndex((item) => item.previewUrl === payload.previewUrl);
      if (existingIdx >= 0) {
          refs.splice(existingIdx, 1, ref);
      }
      else if (!refs.some((item) => item.previewUrl === payload.previewUrl)) {
          refs.push(ref);
      }
      else {
          return;
      }
      data.imageSourceRefs = refs;
      const latest = refs[refs.length - 1];
      data.sourceNodeId = latest?.nodeId ?? '';
      data.sourcePreviewUrl = latest?.previewUrl ?? '';
      data.sourceFileName = latest?.fileName ?? '';
      data.sourceAssetId = latest?.assetId ?? '';
      data.linkedImageNodeId = latest?.nodeId ?? '';
      cell.setData(data, { overwrite: true });
      ctx.refreshPromptSourcePreviews(data);
      ctx.scheduleHistoryPush();
  };
  
  ctx.onPromptUploadFiles = function onPromptUploadFiles(files: File[]) {
      const imageFiles = files.filter((file) => file.type.startsWith('image/'));
      if (!imageFiles.length)
          return;
      void Promise.all(imageFiles.map(async (file) => {
          try {
              const result = await uploadAssetFile(file, { projectId: ctx.activeProjectId.value });
              ctx.addPromptImageSourceRef({
                  assetId: result.assetId,
                  previewUrl: result.url,
                  fileName: file.name,
              });
          }
          catch (error) {
              console.error('[Canvas] prompt image upload failed', error);
          }
      }));
  };
  
  ctx.onPromptAddCanvasNode = function onPromptAddCanvasNode(sourceNodeId: string) {
      const g = ctx.graph.value;
      const textNodeId = ctx.activePickerNodeId.value;
      if (!g || !textNodeId || !sourceNodeId || sourceNodeId === textNodeId)
          return;
      const source = g.getCellById(sourceNodeId);
      const textCell = g.getCellById(textNodeId);
      if (!source?.isNode() || !textCell?.isNode())
          return;
      const sourceData = source.getData() as CanvasNodeData;
      if (sourceData.kind !== 'image' || !sourceData.previewUrl || sourceData.uploadState === 'uploading') {
          return;
      }
      ensureImageTextEdge(g, sourceNodeId, textNodeId);
      const synced = syncTextNodeImageSource(g, textCell as Node, source as Node);
      ctx.refreshPromptSourcePreviews(synced);
      ctx.scheduleHistoryPush();
  };
  
  ctx.removePromptImageSource = function removePromptImageSource(sourceNodeId?: string) {
      const g = ctx.graph.value;
      const textNodeId = ctx.activePickerNodeId.value;
      if (!g || !textNodeId)
          return;
      const cell = g.getCellById(textNodeId);
      if (!cell?.isNode())
          return;
      const data = { ...(cell.getData() as CanvasNodeData) };
      let refs = ctx.seedPromptImageRefs(data);
      if (!sourceNodeId) {
          refs.forEach((item) => {
              if (item.previewUrl.startsWith('blob:'))
                  URL.revokeObjectURL(item.previewUrl);
          });
          refs = [];
      }
      else {
          const removed = refs.filter((item) => item.nodeId === sourceNodeId);
          removed.forEach((item) => {
              if (item.previewUrl.startsWith('blob:'))
                  URL.revokeObjectURL(item.previewUrl);
          });
          refs = refs.filter((item) => item.nodeId !== sourceNodeId);
          g.getEdges().forEach((edge) => {
              const s = edge.getSourceCellId();
              const t = edge.getTargetCellId();
              if ((s === sourceNodeId && t === textNodeId) ||
                  (s === textNodeId && t === sourceNodeId)) {
                  g.removeEdge(edge.id);
              }
          });
      }
      data.imageSourceRefs = refs;
      const latest = refs[refs.length - 1];
      data.sourceNodeId = latest?.nodeId ?? '';
      data.sourcePreviewUrl = latest?.previewUrl ?? '';
      data.sourceFileName = latest?.fileName ?? '';
      data.sourceAssetId = latest?.assetId ?? '';
      data.linkedImageNodeId = latest?.nodeId ?? '';
      cell.setData(data, { overwrite: true });
      ctx.refreshPromptSourcePreviews(data);
      ctx.scheduleHistoryPush();
  };
  
  ctx.loadPromptBarContext = function loadPromptBarContext(nodeId: string) {
      const g = ctx.graph.value;
      if (!g)
          return;
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      const synced = syncTextNodeImageSource(g, cell as Node);
      ctx.promptSourcePreviewUrl.value = synced.sourcePreviewUrl ?? '';
      ctx.promptSourceFileName.value = synced.sourceFileName ?? '';
      ctx.promptSourcePreviews.value = Array.isArray(synced.imageSourceRefs)
          ? synced.imageSourceRefs.filter((item) => item.previewUrl)
          : [];
      if (synced.textPickerTask === 'img2prompt') {
          ctx.modelType.value = 'img2prompt';
          ctx.promptText.value = synced.genPrompt?.trim() || IMG2PROMPT_DEFAULT_INSTRUCTION;
          return;
      }
      if (synced.textPickerTask === 'text2video') {
          ctx.modelType.value = 'text2video';
          ctx.promptText.value = synced.videoDialogueText ?? '';
          return;
      }
      if (synced.textPickerTask === 'text2image') {
          ctx.modelType.value = 'text2image';
          ctx.promptText.value = synced.imageDialogueText ?? '';
          return;
      }
      ctx.modelType.value = 'free';
      ctx.promptText.value = synced.genPrompt ?? '';
  };
  
  ctx.persistPromptBarDraft = function persistPromptBarDraft() {
      const g = ctx.graph.value;
      const nodeId = ctx.activePickerNodeId.value;
      if (!g || !nodeId)
          return;
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      const data = { ...(cell.getData() as CanvasNodeData) };
      const task = data.textPickerTask;
      if (task === 'text2video') {
          data.videoDialogueText = ctx.promptText.value;
      }
      else if (task === 'img2prompt') {
          data.genPrompt = ctx.promptText.value;
      }
      else {
          data.genPrompt = ctx.promptText.value;
      }
      cell.setData(data);
  };
  
  ctx.submitTextPrompt = async function submitTextPrompt(payload?: VideoDialogueSubmitPayload | ImageDialogueSubmitPayload) {
      if (!ctx.canSubmitTextPrompt.value)
          return;
      const g = ctx.graph.value;
      const nodeId = ctx.activePickerNodeId.value;
      if (!g || !nodeId)
          return;
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      const isSpawnResultTask = ctx.modelType.value === 'text2video' ||
          ctx.isText2VideoTask.value ||
          ctx.modelType.value === 'text2image' ||
          ctx.isText2ImageTask.value;
      if (!isSpawnResultTask && ctx.promptSubmitting.value)
          return;
      if (!isSpawnResultTask)
          ctx.promptSubmitting.value = true;
      ctx.persistPromptBarDraft();
      const promptFromPayload = (payload && typeof payload === 'object' && 'prompt' in payload
          ? String((payload as {
              prompt?: string;
          }).prompt ?? '')
          : '').trim();
      const promptTaskType = (() => {
          if (ctx.modelType.value === 'img2prompt' || ctx.isImg2PromptTask.value)
              return '反推提示词';
          if (ctx.modelType.value === 'text2video' || ctx.isText2VideoTask.value)
              return '文生视频';
          if (ctx.modelType.value === 'text2image' || ctx.isText2ImageTask.value)
              return '文生图';
          return '自由创作';
      })();
      const promptDetail = promptFromPayload || ctx.promptText.value;
      ctx.recordCanvasDescription(promptDetail, promptTaskType);
      try {
          if (ctx.modelType.value === 'img2prompt' || ctx.isImg2PromptTask.value) {
              const syncedData = syncTextNodeImageSource(g, cell as Node);
              const referenceAssetIds = ctx.resolvePromptReferenceAssetIds(syncedData);
              const assetId = referenceAssetIds[0] || resolveImageAssetId(syncedData) || '';
              if (!assetId) {
                  message.warning('请先连接或上传参考图片');
                  return;
              }
              const loadingData = {
                  ...(cell.getData() as CanvasNodeData),
                  mode: 'editor' as const,
                  textGenState: 'loading' as const,
                  textGenProgress: 0,
              };
              cell.setData(loadingData, { overwrite: true });
              persistNodeGenerationSnapshot(cell as Node, {
                  ...buildTextGenerationParams({
                      prompt: ctx.promptText.value.trim(),
                      capabilityCode: IMAGE_GENERAL_CAPABILITY_CODE,
                      parameters: {
                          assetId,
                          prompt: ctx.promptText.value.trim(),
                      },
                  }),
                  genPrompt: ctx.promptText.value.trim(),
              });
              const idempotencyKey = createIdempotencyKey('img2prompt');
              try {
                  const created = normalizeGenerationTaskDetail(await api.createGenerationTask<GenerationTaskDetail>({
                      taskType: 'TEXT',
                      capabilityCode: IMAGE_GENERAL_CAPABILITY_CODE,
                      prompt: ctx.promptText.value.trim(),
                      parameters: {
                          assetId,
                          prompt: ctx.promptText.value.trim(),
                      },
                      projectId: ctx.activeProjectId.value,
                      nodeId,
                      referenceAssetIds: referenceAssetIds.length ? referenceAssetIds : [assetId],
                  }, idempotencyKey));
                  const taskId = created.id;
                  if (!taskId) {
                      throw new Error('创建反推提示词任务失败');
                  }
                  ctx.userInfoStore.queryPointAccount();
                  bindGenerationTaskId(cell as Node, taskId, 'TEXT');
                  ctx.persistGenerationTaskBinding(cell as Node, {
                      detail: promptDetail,
                      taskType: promptTaskType,
                  });
                  const succeeded = await followTextGenerationTaskOnNode(cell as Node, taskId, {
                      toHtml: ctx.plainTextToEditorHtml,
                      onError: (reason) => message.error(reason),
                  });
                  if (!succeeded)
                      return;
                  const data = { ...(cell.getData() as CanvasNodeData) };
                  data.genPrompt = ctx.promptText.value;
                  cell.setData(data, { overwrite: true });
              }
              catch (error) {
                  markTextGenerationNodeFailed(cell as Node);
                  message.error(isRequestError(error) ? error.message : '反推提示词失败，请稍后重试');
                  return;
              }
              ctx.selectedNodeId.value = nodeId;
              ctx.selectedKind.value = 'text';
              ctx.syncNodeSelectionHighlight(nodeId);
              ctx.activePickerNodeId.value = '';
              ctx.bumpToolbarRevision();
              ctx.updateNodeToolbar();
              ctx.scheduleHistoryPush();
              return;
          }
          if (ctx.modelType.value === 'text2video' || ctx.isText2VideoTask.value) {
              const videoPayload = payload as VideoDialogueSubmitPayload | undefined;
              const trimmedPrompt = (videoPayload?.prompt ?? ctx.promptText.value).trim();
              if (!trimmedPrompt) {
                  message.warning('请输入视频描述');
                  return;
              }
              ctx.persistPromptBarDraft();
              const text2videoSettings = videoPayload
                  ? ctx.buildVideoDialogueSettingsFromPayload({
                      model: videoPayload.model,
                      ratio: videoPayload.ratio,
                      clarity: videoPayload.clarity,
                      duration: videoPayload.duration,
                      generateAudio: videoPayload.generateAudio,
                      videoCount: videoPayload.videoCount,
                      mode: videoPayload.mode ?? 'text-to-video',
                  })
                  : {
                      ...createDefaultVideoDialogueSettings(),
                      mode: 'text-to-video' as const,
                  };
              const sourceData = cell.getData() as CanvasNodeData;
              const requestedCount = Math.max(1, Math.floor(Number(text2videoSettings.videoCount)) || 1);
              const layoutSize = ctx.resolveVideoResultLayoutSize({
                  ...sourceData,
                  videoGenAspectRatio: text2videoSettings.aspectRatio,
                  videoDialogueSettings: text2videoSettings,
              });
              const plannedPoints = planOutgoingResultPoints(g, cell as Node, layoutSize, requestedCount, 'right');
              const resultNode = spawnVideoGenerationResultNode(g, cell as Node, {
                  title: '文生视频',
                  fileName: '文生视频.mp4',
                  videoDialogueText: trimmedPrompt,
                  videoDialogueSettings: text2videoSettings,
                  genPrompt: trimmedPrompt,
                  centerPoint: plannedPoints[0],
              });
              const videoParameters: Record<string, unknown> = {
                  mode: videoPayload?.mode ?? 'text-to-video',
                  model: videoPayload?.model,
                  ratio: videoPayload?.ratio ?? '16:9',
                  clarity: toVideoApiClarity(videoPayload?.clarity ?? '720P'),
                  duration: videoPayload?.duration ?? 5,
                  generateAudio: videoPayload?.generateAudio ?? true,
                  videoCount: videoPayload?.videoCount ?? 1,
              };
              ctx.applyVideoGenerationProvenance(resultNode, {
                  prompt: trimmedPrompt,
                  model: text2videoSettings.modelKey,
                  ratio: text2videoSettings.aspectRatio,
                  clarity: text2videoSettings.resolution,
                  duration: text2videoSettings.duration,
                  generateAudio: text2videoSettings.generateAudio,
                  videoCount: text2videoSettings.videoCount,
                  mode: text2videoSettings.mode,
              }, [], {
                  capabilityCode: VIDEO_GENERAL_CAPABILITY_CODE,
                  parameters: videoParameters,
              });
              ctx.closeTextPromptBar();
              const idempotencyKey = createIdempotencyKey('text2video');
              try {
                  const created = normalizeGenerationTaskDetail(await api.createGenerationTask<GenerationTaskDetail>({
                      taskType: 'VIDEO',
                      capabilityCode: VIDEO_GENERAL_CAPABILITY_CODE,
                      prompt: toVideoApiPrompt(trimmedPrompt),
                      parameters: videoParameters,
                      projectId: ctx.activeProjectId.value,
                      nodeId: resultNode.id,
                  }, idempotencyKey));
                  const taskId = created.id;
                  if (!taskId) {
                      throw new Error('创建文生视频任务失败');
                  }
                  ctx.userInfoStore.queryPointAccount();
                  bindGenerationTaskId(resultNode, taskId, 'VIDEO');
                  ctx.persistGenerationTaskBinding(resultNode, {
                      detail: trimmedPrompt,
                      taskType: promptTaskType,
                  });
                  startVideoGenerationTaskFollow(resultNode, taskId, {
                      title: '文生视频',
                      fileName: '文生视频.mp4',
                      onError: (reason) => message.error(reason),
                      onComplete: (success) => ctx.handleVideoGenerationTaskComplete(resultNode.id, success),
                  });
                  ctx.selectedNodeId.value = resultNode.id;
                  ctx.selectedKind.value = 'video';
                  ctx.syncNodeSelectionHighlight(resultNode.id);
                  ctx.syncNodeCount();
                  ctx.bumpToolbarRevision();
                  ctx.updateNodeToolbar();
                  ctx.scheduleHistoryPush();
              }
              catch (error) {
                  markVideoGenerationNodeFailed(resultNode);
                  ctx.revealVideoDialogueAfterGenerationFailure(resultNode.id);
                  message.error(isRequestError(error) ? error.message : '文生视频失败，请稍后重试');
              }
              return;
          }
          if (ctx.modelType.value === 'text2image' || ctx.isText2ImageTask.value) {
              const imagePayload = payload as ImageDialogueSubmitPayload | undefined;
              const trimmedPrompt = (imagePayload?.prompt ?? ctx.promptText.value).trim();
              if (!trimmedPrompt) {
                  message.warning('请输入图片描述');
                  return;
              }
              ctx.persistPromptBarDraft();
              ctx.closeTextPromptBar();
              const sourceNode = cell as Node;
              const existingTarget = resolveText2ImageGenerationTargetNode(g, sourceNode);
              let resultNode: Node;
              if (existingTarget) {
                  resultNode = existingTarget;
                  if (isImageGenerationFailedNode(resultNode.getData() as CanvasNodeData)) {
                      resetImageGenerationNodeForRetry(resultNode, {
                          title: '文生图',
                          fileName: '文生图.png',
                          prompt: trimmedPrompt,
                      });
                  }
                  else {
                      prepareImageNodeForInPlaceGeneration(resultNode, {
                          title: '文生图',
                          fileName: '文生图.png',
                          prompt: trimmedPrompt,
                      });
                  }
              }
              else {
                  const imagePreviewSize = getNodeSize('image', 'editor', {
                      kind: 'image',
                      mode: 'editor',
                      imageGenState: 'loading',
                  });
                  const [imageCenterPoint] = planOutgoingResultPoints(g, sourceNode, imagePreviewSize, 1, 'right');
                  resultNode = spawnGenerationResultNode(g, sourceNode, {
                      title: '文生图',
                      fileName: '文生图.png',
                      centerPoint: imageCenterPoint,
                  });
              }
              const imageParameters: Record<string, unknown> = {
                  model: imagePayload?.model,
                  aspectRatio: imagePayload?.aspectRatio,
                  count: imagePayload?.count ?? 1,
              };
              if (imagePayload?.resolution) {
                  imageParameters.resolution = imagePayload.resolution;
              }
              const text2ImageSettings = ctx.normalizeImageDialogueSettings(imageDialogueSettingsFromPayload(imagePayload));
              const text2ImageGenerationParams = buildImageGenerationParams({
                  prompt: trimmedPrompt,
                  capabilityCode: IMAGE_GENERAL_CAPABILITY_CODE,
                  parameters: imageParameters,
                  workflowId: resolveGenerationTaskWorkflowId(imagePayload?.workflowId, imagePayload?.workflow) ?? undefined,
              });
              ctx.applyImageDialogueProvenance(resultNode, {
                  prompt: trimmedPrompt,
                  settings: text2ImageSettings,
                  sourceRefs: [],
                  generationParams: text2ImageGenerationParams,
              });
              try {
                  const sourceFileName = '文生图.png';
                  const started = await startImageGenerationOnNode(resultNode, {
                      title: '文生图',
                      fileName: '文生图.png',
                      createTask: async () => {
                          const idempotencyKey = createIdempotencyKey('text2image');
                          const created = await api.createGenerationTask<GenerationTaskDetail>({
                              taskType: 'IMAGE',
                              capabilityCode: IMAGE_GENERAL_CAPABILITY_CODE,
                              prompt: trimmedPrompt,
                              parameters: imageParameters,
                              projectId: ctx.activeProjectId.value,
                              nodeId: resultNode.id,
                              workflowId: resolveGenerationTaskWorkflowId(imagePayload?.workflowId, imagePayload?.workflow),
                          }, idempotencyKey);
                          ctx.userInfoStore.queryPointAccount();
                          return created;
                      },
                      onTaskBound: () => ctx.persistGenerationTaskBinding(resultNode, {
                          detail: trimmedPrompt,
                          taskType: promptTaskType,
                      }),
                      onError: (reason) => message.error(reason),
                      onComplete: async (result) => {
                          ctx.resetSourceImageDialogueAfterSuccess(sourceNode, resultNode, result);
                          if (!result.success)
                              return;
                          const extraResults = result.extraResults ?? [];
                          if (extraResults.length) {
                              const totalCount = 1 + extraResults.length;
                              const extraNodes = await ctx.spawnNodesForExtraGenerationResults(g, sourceNode, extraResults, {
                                  title: '文生图',
                                  sourceFileName,
                                  buildFileName: () => sourceFileName,
                                  resultIndexOffset: 1,
                                  totalCount,
                                  snapshotSourceNode: resultNode,
                              });
                              if (extraNodes.length) {
                                  ctx.syncNodeCount();
                                  nextTick(() => {
                                      const scroller = getScroller(g);
                                      if (!scroller)
                                          return;
                                      const center = getBoundingBoxCenter([resultNode, ...extraNodes].map((node) => node.getBBox()));
                                      scroller.transitionToPoint(center.x, center.y, {
                                          duration: '280ms',
                                      });
                                  });
                              }
                          }
                          ctx.bumpToolbarRevision();
                          ctx.updateNodeToolbar();
                          ctx.scheduleHistoryPush();
                      },
                  });
                  if (!started.started)
                      return;
                  ctx.selectedNodeId.value = resultNode.id;
                  ctx.selectedKind.value = 'image';
                  ctx.syncNodeSelectionHighlight(resultNode.id);
                  ctx.syncNodeCount();
                  ctx.bumpToolbarRevision();
                  ctx.updateNodeToolbar();
                  ctx.scheduleHistoryPush();
              }
              catch (error) {
                  message.error(isRequestError(error) ? error.message : '文生图失败，请稍后重试');
              }
              return;
          }
          if (ctx.modelType.value == 'free') {
              const trimmedPrompt = ctx.promptText.value.trim();
              const loadingData = {
                  ...(cell.getData() as CanvasNodeData),
                  mode: 'editor' as const,
                  textGenState: 'loading' as const,
                  textGenProgress: 0,
                  genPrompt: trimmedPrompt,
                  promptBarPinned: true,
                  textPickerTask: '' as const,
              };
              cell.setData(loadingData, { overwrite: true });
              persistNodeGenerationSnapshot(cell as Node, {
                  ...buildTextGenerationParams({
                      prompt: trimmedPrompt,
                      capabilityCode: 'TEXT_COPY_V1',
                      parameters: { style: 'creative' },
                  }),
                  genPrompt: trimmedPrompt,
              });
              const idempotencyKey = createIdempotencyKey('text-copy');
              try {
                  const created = normalizeGenerationTaskDetail(await api.createGenerationTask<GenerationTaskDetail>({
                      taskType: 'TEXT',
                      capabilityCode: 'TEXT_COPY_V1',
                      prompt: trimmedPrompt,
                      parameters: {
                          style: 'creative',
                      },
                      projectId: ctx.activeProjectId.value,
                      nodeId,
                  }, idempotencyKey));
                  const taskId = created.id;
                  if (!taskId) {
                      throw new Error('创建文案生成任务失败');
                  }
                  ctx.userInfoStore.queryPointAccount();
                  bindGenerationTaskId(cell as Node, taskId, 'TEXT');
                  ctx.persistGenerationTaskBinding(cell as Node, {
                      detail: promptDetail,
                      taskType: promptTaskType,
                  });
                  const succeeded = await followTextGenerationTaskOnNode(cell as Node, taskId, {
                      toHtml: ctx.plainTextToEditorHtml,
                      onError: (reason) => message.error(reason),
                  });
                  if (!succeeded)
                      return;
                  const data = { ...(cell.getData() as CanvasNodeData) };
                  data.genPrompt = trimmedPrompt;
                  data.promptBarPinned = true;
                  cell.setData(data, { overwrite: true });
              }
              catch (error) {
                  markTextGenerationNodeFailed(cell as Node);
                  message.error(isRequestError(error) ? error.message : '文案生成失败，请稍后重试');
                  return;
              }
              ctx.selectedNodeId.value = nodeId;
              ctx.selectedKind.value = 'text';
              ctx.syncNodeSelectionHighlight(nodeId);
              ctx.bumpToolbarRevision();
              ctx.updateNodeToolbar();
              ctx.scheduleHistoryPush();
          }
      }
      finally {
          if (!isSpawnResultTask)
              ctx.promptSubmitting.value = false;
      }
  };
  
  ctx.generateImageFromPrompt = async function generateImageFromPrompt() {
      const g = ctx.graph.value;
      const nodeId = ctx.activeImageGenPromptNodeId.value;
      if (!g || !nodeId)
          return;
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      const node = cell as Node;
      const prompt = ctx.imageGenPromptText.value.trim();
      if (!prompt) {
          message.warning('请输入提示词');
          return;
      }
      ctx.recordCanvasDescription(prompt, '文生图');
      const currentData = node.getData() as CanvasNodeData;
      if (currentData.imageGenState === 'loading')
          return;
      ctx.imageGenSubmitting.value = true;
      ctx.persistImageGenPrompt();
      const syncedData = node.getData() as CanvasNodeData;
      const settings = ctx.normalizeImageDialogueSettings(syncedData.imageDialogueSettings ?? ctx.imageDialogueSettings.value);
      const taskParameters: Record<string, unknown> = {
          model: settings.modelKey,
          aspectRatio: settings.aspectRatio,
          count: Math.max(1, settings.imageCount ?? 1),
      };
      if (settings.resolution) {
          taskParameters.resolution = settings.resolution;
      }
      const referenceAssetIds = ctx.resolvePromptReferenceAssetIds(syncedData);
      persistNodeGenerationSnapshot(node, {
          ...buildImageGenerationParams({
              prompt,
              capabilityCode: IMAGE_GENERAL_CAPABILITY_CODE,
              parameters: taskParameters,
              workflowId: settings.workflowId,
              referenceAssetIds: referenceAssetIds.length ? referenceAssetIds : undefined,
          }),
          imageDialogueText: prompt,
          imageDialogueSettings: settings,
          genPrompt: prompt,
          genSeed: syncedData.genSeed ?? ctx.imageGenSeed.value,
      });
      node.setData({
          ...(node.getData() as CanvasNodeData),
          imageGenState: 'loading',
          imageGenProgress: 0,
          genPrompt: prompt,
      }, { overwrite: true });
      ctx.closeImageGenPromptBar();
      const fileName = syncedData.fileName || syncedData.title || '文生图.png';
      try {
          const outcome = await runImageGenerationOnNode(node, {
              title: syncedData.title || '文生图',
              fileName,
              createTask: async () => {
                  const idempotencyKey = createIdempotencyKey('img-prompt');
                  const created = await api.createGenerationTask<GenerationTaskDetail>({
                      taskType: 'IMAGE',
                      capabilityCode: IMAGE_GENERAL_CAPABILITY_CODE,
                      prompt,
                      parameters: { count: 1 },
                      projectId: ctx.activeProjectId.value,
                      nodeId: node.id,
                      referenceAssetIds: referenceAssetIds.length ? referenceAssetIds : undefined,
                  }, idempotencyKey);
                  ctx.userInfoStore.queryPointAccount();
                  return created;
              },
              onTaskBound: () => ctx.persistGenerationTaskBinding(node, { detail: prompt, taskType: '文生图' }),
              onError: (reason) => message.error(reason),
          });
          if (!outcome.success)
              return;
          ctx.selectedNodeId.value = nodeId;
          ctx.selectedKind.value = 'image';
          ctx.syncNodeSelectionHighlight(nodeId);
          ctx.scheduleHistoryPush();
      }
      finally {
          ctx.imageGenSubmitting.value = false;
          ctx.bumpToolbarRevision();
          ctx.updateNodeToolbar();
      }
  };
  
  ctx.openVideoGenPromptBar = function openVideoGenPromptBar(nodeId: string, tab = 'text2video') {
      ctx.closeTextPromptBar();
      if (ctx.activeImageGenPromptNodeId.value) {
          ctx.persistImageGenPrompt();
          ctx.persistImageDialogueFields(ctx.activeImageGenPromptNodeId.value);
      }
      ctx.closeImageGenPromptBar();
      const g = ctx.graph.value;
      if (g) {
          const cell = g.getCellById(nodeId);
          if (cell?.isNode()) {
              const data = { ...(cell.getData() as CanvasNodeData) };
              if (data.kind === 'video' && data.mode === 'editor' && !data.previewUrl && !isVideoGenerationFailedNode(data)) {
                  data.mode = 'picker';
              }
              data.videoGenTab = tab;
              cell.setData(data);
          }
      }
      ctx.activeVideoGenPromptNodeId.value = nodeId;
      ctx.videoGenActiveTab.value = tab;
      ctx.loadVideoGenPromptFields(nodeId);
      ctx.updateVideoGenPromptBarPosition();
  };
  
  ctx.closeVideoGenPromptBar = function closeVideoGenPromptBar() {
      ctx.activeVideoGenPromptNodeId.value = '';
      ctx.exitVideoGenCanvasPickMode();
  };
  
  ctx.dismissTextPickerPanels = function dismissTextPickerPanels() {
      ctx.closeTextPromptBar();
      if (ctx.activeImageGenPromptNodeId.value) {
          ctx.persistImageGenPrompt();
          ctx.persistImageDialogueFields(ctx.activeImageGenPromptNodeId.value);
      }
      ctx.closeImageGenPromptBar();
      if (ctx.activeVideoGenPromptNodeId.value) {
          ctx.persistVideoGenPrompt();
      }
      ctx.closeVideoGenPromptBar();
  };
  
  ctx.imageMarkHintTimer = null;
  
  ctx.hideImageMarkHint = function hideImageMarkHint() {
      if (ctx.imageMarkHintTimer) {
          clearTimeout(ctx.imageMarkHintTimer);
          ctx.imageMarkHintTimer = null;
      }
      ctx.imageMarkHintVisible.value = false;
      ctx.imageMarkHints.value = [];
  };
  
  ctx.computeImageMarkHintPositions = function computeImageMarkHintPositions() {
      const g = ctx.graph.value;
      const overlayRoot = ctx.canvasRef.value;
      if (!g || !overlayRoot)
          return [];
      return ctx.resolveMarkableImageNodeIds()
          .map((nodeId) => {
          const cell = g.getCellById(nodeId);
          if (!cell?.isNode())
              return null;
          return getImageMarkHintPosition(g, cell as Node, overlayRoot);
      })
          .filter((item): item is {
          left: number;
          top: number;
      } => item != null);
  };
  
  ctx.updateImageMarkHintPositions = function updateImageMarkHintPositions() {
      if (!ctx.imageMarkHintVisible.value)
          return;
      ctx.imageMarkHints.value = ctx.computeImageMarkHintPositions();
  };
  
  ctx.showImageMarkHint = function showImageMarkHint() {
      ctx.hideImageMarkHint();
      const positions = ctx.computeImageMarkHintPositions();
      if (!positions.length)
          return;
      ctx.imageMarkHints.value = positions;
      ctx.imageMarkHintVisible.value = true;
      ctx.imageMarkHintTimer = setTimeout(() => {
          ctx.imageMarkHintVisible.value = false;
          ctx.imageMarkHints.value = [];
          ctx.imageMarkHintTimer = null;
      }, 3000);
  };
  
  ctx.resolveMarkableImageNodeIds = function resolveMarkableImageNodeIds(): string[] {
      const g = ctx.graph.value;
      const returnId = ctx.elementSelectReturnNodeId.value;
      if (!g || !returnId)
          return [];
      const returnCell = g.getCellById(returnId);
      const returnData = returnCell?.isNode() ? (returnCell.getData() as CanvasNodeData) : undefined;
      const ids = new Set<string>();
      if (ctx.elementSelectContext.value === 'image-dialogue') {
          const previews = ctx.getImageDialoguePreviewsForNode(returnId);
          for (const item of previews) {
              if (item.nodeId)
                  ids.add(item.nodeId);
          }
          if (!ids.size && returnData?.kind === 'image' && returnData.previewUrl?.trim()) {
              ids.add(returnId);
          }
          if (!ids.size) {
              for (const item of previews) {
                  const previewUrl = item.previewUrl?.trim();
                  if (!previewUrl)
                      continue;
                  g.getNodes().forEach((cell) => {
                      const data = cell.getData() as CanvasNodeData;
                      if (data.kind === 'image' && data.previewUrl === previewUrl) {
                          ids.add(cell.id);
                      }
                  });
              }
          }
      }
      else if (ctx.elementSelectContext.value === 'video-gen' && returnData) {
          const refs = resolveVideoSourceRefsForNode(g, returnId, returnData.videoSourceRefs, true);
          for (const item of refs) {
              if (item.nodeId)
                  ids.add(item.nodeId);
          }
      }
      if (!ids.size) {
          g.getNodes().forEach((cell) => {
              const data = cell.getData() as CanvasNodeData;
              if (data.kind === 'image' && data.previewUrl?.trim()) {
                  ids.add(cell.id);
              }
          });
      }
      return [...ids];
  };
  
  ctx.syncImageMarkTargets = function syncImageMarkTargets(active: boolean) {
      const g = ctx.graph.value;
      if (!g)
          return;
      const markableIds = active ? new Set(ctx.resolveMarkableImageNodeIds()) : new Set<string>();
      g.getNodes().forEach((cell) => {
          if (!cell.isNode())
              return;
          const data = cell.getData() as CanvasNodeData;
          if (data.kind !== 'image')
              return;
          const isTarget = active && markableIds.has(cell.id);
          if (Boolean(data.imageMarkTarget) === isTarget)
              return;
          cell.setData({ ...data, imageMarkTarget: isTarget });
      });
  };
  
  ctx.enterElementSelectMode = function enterElementSelectMode(context: 'image-dialogue' | 'video-gen' = 'video-gen', options?: {
      coordinateOnly?: boolean;
  }) {
      const returnId = context === 'image-dialogue'
          ? ctx.getActiveImageDialogueTargetNodeId()
          : ctx.activeVideoGenPromptNodeId.value;
      if (!returnId)
          return;
      ctx.elementSelectContext.value = context;
      ctx.elementSelectReturnNodeId.value = returnId;
      // 默认只采坐标；显式传 false 时才走 AI 识别（当前 UI 不启用）
      ctx.imageMarkCoordinateOnly.value = options?.coordinateOnly !== false;
      ctx.exitVideoGenCanvasPickMode();
      ctx.exitImageDialogueCanvasPickMode();
      ctx.showElementSelectMode.value = true;
      ctx.syncImageMarkTargets(true);
      ctx.showImageMarkHint();
      ctx.bumpToolbarRevision();
  };
  
  ctx.isImageMarkAnalysisInProgress = function isImageMarkAnalysisInProgress() {
      if (ctx.imageMarkRecognizing.value)
          return true;
      const g = ctx.graph.value;
      return Boolean(g && isImageMarkAnalyzing(g));
  };
  
  ctx.exitElementSelectMode = function exitElementSelectMode(options?: {
      force?: boolean;
  }) {
      ctx.hideImageMarkHint();
      ctx.syncImageMarkTargets(false);
      ctx.showElementSelectMode.value = false;
      ctx.elementSelectContext.value = null;
      ctx.elementSelectReturnNodeId.value = '';
      ctx.imageMarkCoordinateOnly.value = false;
      if (!options?.force && ctx.isImageMarkAnalysisInProgress()) {
          // 分析进行中：仅退出元素选择 UI，保留节点「分析中」状态直至任务结束
          ctx.bumpToolbarRevision();
          return;
      }
      ctx.imageMarkRecognizing.value = false;
      const g = ctx.graph.value;
      if (!g)
          return;
      g.getNodes().forEach((cell) => {
          const node = cell as Node;
          const data = node.getData() as CanvasNodeData;
          if (data.imageMarkAnalyzing) {
              setImageMarkAnalyzing(node, null);
          }
      });
      ctx.bumpToolbarRevision();
  };
  
  ctx.handleImageMarkRecognize = async function handleImageMarkRecognize(sourceNode: Node, event?: MouseEvent) {
      const g = ctx.graph.value;
      if (!g || !ctx.showElementSelectMode.value || !event)
          return;
      // 标记功能一律只采坐标，绝不请求 IMAGE_MARK_RECOGNIZE
      const coordinateOnly = true;
      if (!coordinateOnly && (ctx.imageMarkRecognizing.value || isImageMarkAnalyzing(g))) {
          message.warning('正在分析标记，请等待完成后再试');
          return;
      }
      const returnNodeId = ctx.elementSelectReturnNodeId.value;
      if (!returnNodeId)
          return;
      const sourceData = sourceNode.getData() as CanvasNodeData;
      if (sourceData.kind !== 'image' || !sourceData.previewUrl)
          return;
      const assetId = resolveImageAssetId(sourceData);
      if (!assetId) {
          message.warning('图片素材 ID 不存在，请等待上传完成');
          return;
      }
      const point = clientPointToImageNaturalCoords(g, sourceNode, event.clientX, event.clientY);
      if (!point) {
          message.warning('请点击图片区域进行标记');
          return;
      }
      const existingCount = (sourceData.imageElementMarks?.length ?? 0);
      const markIndex = existingCount + 1;
      const markLabel = `标记${markIndex}`;
      const markItem = buildImageMarkItem({
          sourceNodeId: sourceNode.id,
          assetId,
          x: point.x,
          y: point.y,
          imageWidth: point.imageWidth,
          imageHeight: point.imageHeight,
          label: markLabel,
          labelOptions: [markLabel],
      });
      // 标记：只保留坐标钉点并显示在图片上，不调用 AI 识别；标记一次后退出
      if (coordinateOnly) {
          markItem.pending = false;
          // 坐标标记不写 bbox，避免钉点下方出现红色选区框
          delete markItem.bbox;
          appendImageMarkToNode(sourceNode, markItem);
          const returnCell = g.getCellById(returnNodeId);
          if (returnCell?.isNode()) {
              appendElementMarkToNode(returnCell as Node, markItem);
          }
          syncNodeImageMarkLists(sourceNode);
          if (returnCell?.isNode() && returnCell.id !== sourceNode.id) {
              syncNodeImageMarkLists(returnCell as Node);
          }
          if (ctx.showImageDialogue.value)
              ctx.persistImageDialogueFields(returnNodeId);
          ctx.bumpToolbarRevision();
          ctx.scheduleHistoryPush();
          ctx.exitElementSelectMode({ force: true });
          return;
      }
      markItem.pending = true;
      appendImageMarkToNode(sourceNode, markItem);
      const returnCell = g.getCellById(returnNodeId);
      if (returnCell?.isNode()) {
          appendElementMarkToNode(returnCell as Node, markItem);
      }
      const markDetail = markLabel;
      ctx.recordCanvasDescription(markDetail, '标记识别');
      ctx.imageMarkRecognizing.value = true;
      ctx.bumpToolbarRevision();
      const idempotencyKey = createIdempotencyKey('image-mark');
      try {
          const created = normalizeGenerationTaskDetail(await api.createGenerationTask<GenerationTaskDetail>({
              taskType: 'TEXT',
              capabilityCode: 'IMAGE_MARK_RECOGNIZE',
              prompt: '',
              parameters: {
                  assetId,
                  x: point.x,
                  y: point.y,
                  imageWidth: point.imageWidth,
                  imageHeight: point.imageHeight,
              },
              referenceAssetIds: [],
              projectId: ctx.activeProjectId.value,
              nodeId: '',
              workflowId: null,
          }, idempotencyKey));
          const taskId = created.id;
          if (!taskId) {
              throw new Error('创建标记识别任务失败');
          }
          ctx.userInfoStore.queryPointAccount();
          ctx.persistGenerationTaskBinding(sourceNode, { detail: markDetail, taskType: '标记识别' });
          const finalTask = isGenerationTaskTerminal(created.status)
              ? created
              : await pollGenerationTask(taskId);
          if (finalTask.status !== 'SUCCEEDED') {
              throw new Error(finalTask.error?.message || '标记识别失败');
          }
          const parsed = parseImageMarkRecognizeResult(finalTask, point);
          if (!parsed?.label) {
              throw new Error('未返回标记识别结果');
          }
          const labelOptions = parsed.labelOptions?.length
              ? parsed.labelOptions
              : [parsed.label];
          const completedMark: ImageMarkItem = {
              ...markItem,
              label: labelOptions[0],
              labelOptions,
              selectedLabelIndex: 0,
              description: parsed.description,
              bbox: parsed.bbox,
              pending: false,
              mentionToken: markItem.mentionToken,
          };
          replaceImageMarkOnGraph(g, markItem.id, completedMark);
          syncNodeImageMarkLists(sourceNode);
          if (returnCell?.isNode() && returnCell.id !== sourceNode.id) {
              syncNodeImageMarkLists(returnCell as Node);
          }
          ctx.recordCanvasDescription(completedMark.label, '标记识别');
          message.success(`已识别：${completedMark.label}`);
          ctx.exitElementSelectMode({ force: true });
      }
      catch (error) {
          removeImageMarkFromGraph(g, markItem.id);
          message.error(error instanceof Error ? error.message : '标记识别失败，请稍后重试');
      }
      finally {
          ctx.imageMarkRecognizing.value = false;
          ctx.bumpToolbarRevision();
          ctx.persistGenerationTaskBinding(sourceNode, { detail: markDetail, taskType: '标记识别' });
      }
  };
  
  ctx.updateImageMarkLabel = function updateImageMarkLabel(markId: string, selectedLabelIndex: number) {
      const g = ctx.graph.value;
      if (!g || !markId)
          return;
      let changed = false;
      g.getNodes().forEach((cell) => {
          if (!cell.isNode())
              return;
          if (updateImageMarkLabelOnNode(cell as Node, markId, selectedLabelIndex)) {
              changed = true;
          }
      });
      if (!changed)
          return;
      ctx.bumpToolbarRevision();
      ctx.scheduleHistoryPush();
      if (ctx.showImageDialogue.value)
          ctx.persistImageDialogueFields();
      if (ctx.showVideoGenPromptBar.value)
          ctx.persistVideoGenPrompt();
  };
  
  ctx.getElementMarkOwnerNodeId = function getElementMarkOwnerNodeId() {
      return (ctx.elementSelectReturnNodeId.value
          || ctx.activeImageGenPromptNodeId.value
          || (ctx.showImageDialogue.value ? ctx.getActiveImageDialogueTargetNodeId() : '')
          || (ctx.showVideoGenPromptBar.value ? ctx.activeVideoGenPromptNodeId.value : ''));
  };
  
  ctx.findElementMarkById = function findElementMarkById(markId: string) {
      const g = ctx.graph.value;
      if (!g || !markId)
          return null;
      const ownerId = ctx.getElementMarkOwnerNodeId();
      if (ownerId) {
          const data = g.getCellById(ownerId)?.getData() as CanvasNodeData | undefined;
          const mark = data?.elementMarks?.find((item) => item.id === markId);
          if (mark)
              return mark;
      }
      for (const cell of g.getNodes()) {
          const data = cell.getData() as CanvasNodeData;
          const marks = [...(data.elementMarks ?? []), ...(data.imageElementMarks ?? [])];
          const found = marks.find((item) => item.id === markId);
          if (found)
              return found;
      }
      return null;
  };
}
