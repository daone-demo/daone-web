/**
 * 职责：安装 Dialogue 提示词字段 load/persist/normalize 到 ctx。
 */
import type { Node } from '@antv/x6'
import {
  createDefaultVideoDialogueSettings,
  normalizeImageDialogueSettingsForModel,
  pickImageDialogueSettingsInput,
  resolveImageAssetId,
  type VideoGenAspectRatio,
} from '../../../../constants'
import type { CanvasNodeData, ImageSourceRef } from '../../sharedImports'
import {
  ensureImageTextEdge,
  findIncomingTextNodes,
  getNodeSize,
  getVideoSourceRefs,
  IMG2PROMPT_DEFAULT_INSTRUCTION,
  plainTextFromNodeContent,
  syncNodeShapeFromData,
  syncTextNodeImageSource,
  toPersistedVideoSourceRefs,
  uploadAssetFile,
} from '../../sharedImports'
import type { CoreRuntimeContext } from '../context'

export function installDialoguePromptFieldState(ctx: CoreRuntimeContext) {
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
          .map((item: ImageSourceRef) => {
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
          .filter((id: string): id is string => Boolean(id));
  };
  
  ctx.refreshPromptSourcePreviews = function refreshPromptSourcePreviews(data: CanvasNodeData) {
      ctx.promptSourcePreviewUrl.value = data.sourcePreviewUrl ?? '';
      ctx.promptSourceFileName.value = data.sourceFileName ?? '';
      ctx.promptSourcePreviews.value = Array.isArray(data.imageSourceRefs)
          ? data.imageSourceRefs.filter((item: ImageSourceRef) => item.previewUrl)
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
          ? refs.findIndex((item: ImageSourceRef) => item.nodeId === payload.nodeId)
          : refs.findIndex((item: ImageSourceRef) => item.previewUrl === payload.previewUrl);
      if (existingIdx >= 0) {
          refs.splice(existingIdx, 1, ref);
      }
      else if (!refs.some((item: ImageSourceRef) => item.previewUrl === payload.previewUrl)) {
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
          refs.forEach((item: ImageSourceRef) => {
              if (item.previewUrl.startsWith('blob:'))
                  URL.revokeObjectURL(item.previewUrl);
          });
          refs = [];
      }
      else {
          const removed = refs.filter((item: ImageSourceRef) => item.nodeId === sourceNodeId);
          removed.forEach((item: ImageSourceRef) => {
              if (item.previewUrl.startsWith('blob:'))
                  URL.revokeObjectURL(item.previewUrl);
          });
          refs = refs.filter((item: ImageSourceRef) => item.nodeId !== sourceNodeId);
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
  
}
