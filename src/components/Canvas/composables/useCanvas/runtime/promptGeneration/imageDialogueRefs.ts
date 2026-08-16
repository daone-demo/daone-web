// @ts-nocheck -- 动态共享上下文保持原闭包的运行时类型；公开契约仍由 CanvasBindings 校验。
/**
 * 职责：安装 sourceRefs / provenance / upload / digital-human / file input click helpers 到 ctx。
 */
import { isRequestError } from '@/utils/request';
import type { Graph,Node } from '@antv/x6';
import { message } from 'ant-design-vue';
import { nextTick } from 'vue';
import { canOpenImageDialogueOnNode,createDefaultImageDialogueSettings,isPendingImageGenDialogueTarget,isVideoNodeGenerating,resolveGenerationTaskWorkflowId,resolveImageAssetId,type CanvasGenerationParams,type ImageDialogueSettings,type ImageMarkItem,type ImageToolbarClickEvent } from '../../../../constants';
import { buildImageGenerationParams,cloneNodeGenerationSnapshot,persistNodeGenerationSnapshot } from '../../../../generationParams';
import { applyGenerationResultToNode,bindGenerationTaskId,bindSharedGenerationTaskId,markGenerationNodeFailed,pickImageGenerationResults,readGenerationResultIndex,resolveGenerationResultPreview,startImageGenerationOnNode,type GenerationTaskDetail,type GenerationTaskResult } from '../../../../generationTask';
import { syncNodeImageMarkLists } from '../../../../imageMarkUtils';
import { downloadCanvasMedia } from '../../../../mediaDownload';
import type { CanvasNodeData,ImageSourceRef } from '../../sharedImports';
import { api,connectGenEdge,getImageGenerationPlaceholderSize,getNodeDialoguePosition,getScroller,isVideoGenerationFailedNode,planOutgoingResultPoints,spawnCompletedImageResultNode,spawnCroppedImageNode,spawnGenerationResultNode,syncPendingImageTargetFromSources } from '../../sharedImports';
import type { UploadFilter } from '../../state';
import type { CoreRuntimeContext } from '../context';
export function installPromptImageDialogueRefs(ctx: CoreRuntimeContext) {
  ctx.hasImageDialogueSourceRef = function hasImageDialogueSourceRef(targetNodeId: string, imageNodeId: string, previewUrl: string) {
      const g = ctx.graph.value;
      if (!g || !targetNodeId)
          return false;
      const cell = g.getCellById(targetNodeId);
      if (!cell?.isNode())
          return false;
      const data = cell.getData() as CanvasNodeData;
      const refs = ctx.seedImageDialogueRefs(data, targetNodeId);
      return refs.some((item) => item.nodeId === imageNodeId || item.previewUrl === previewUrl);
  };
  
  ctx.seedImageDialogueRefs = function seedImageDialogueRefs(data: CanvasNodeData, targetNodeId: string): ImageSourceRef[] {
      return ctx.resolveImageDialogueRefs(data, targetNodeId);
  };

  ctx.syncImageDialogueSourceRefs = function syncImageDialogueSourceRefs(targetNode: Node, sourceRefs: ImageSourceRef[]) {
      const data = { ...(targetNode.getData() as CanvasNodeData) };
      data.imageSourceRefs = sourceRefs
          .filter((item) => item.previewUrl?.trim())
          .map((item) => ({
          nodeId: item.nodeId,
          assetId: item.assetId,
          previewUrl: item.previewUrl,
          fileName: item.fileName ?? '',
      }));
      data.inputUpdated = data.imageSourceRefs.some((item) => Boolean(item.previewUrl));
      targetNode.setData(data, { overwrite: true });
      const g = ctx.graph.value;
      if (g)
          syncPendingImageTargetFromSources(g, targetNode);
  };
  
  ctx.applyImageDialogueProvenance = function applyImageDialogueProvenance(targetNode: Node, options: {
      prompt: string;
      settings?: ImageDialogueSettings;
      sourceRefs: ImageSourceRef[];
      elementMarks?: ImageMarkItem[];
      generationParams?: CanvasGenerationParams;
  }) {
      const refs = options.sourceRefs
          .map(ctx.enrichImageSourceRefPreview)
          .filter((item) => item.previewUrl?.trim() || item.assetId?.trim())
          .map((item) => ({
          nodeId: item.nodeId,
          assetId: item.assetId,
          previewUrl: item.previewUrl,
          fileName: item.fileName ?? '',
      }));
      const prompt = options.prompt.trim();
      if (options.generationParams) {
          persistNodeGenerationSnapshot(targetNode, {
              ...options.generationParams,
              prompt: options.generationParams.prompt || prompt,
              imageDialogueText: prompt,
              imageDialogueSettings: options.settings,
              imageSourceRefs: refs,
              elementMarks: options.elementMarks?.length
                  ? options.elementMarks.map((mark) => ({ ...mark }))
                  : undefined,
              genPrompt: prompt,
          });
          return;
      }
      const data = { ...(targetNode.getData() as CanvasNodeData) };
      data.imageSourceRefs = refs;
      const latest = refs[refs.length - 1];
      if (latest) {
          data.sourceNodeId = latest.nodeId;
          data.sourcePreviewUrl = latest.previewUrl;
          data.sourceFileName = latest.fileName;
          data.sourceAssetId = latest.assetId;
      }
      data.inputUpdated = refs.length > 0;
      if (prompt) {
          data.imageDialogueText = prompt;
          data.genPrompt = prompt;
      }
      if (options.settings) {
          data.imageDialogueSettings = { ...options.settings };
      }
      if (options.elementMarks?.length) {
          data.elementMarks = options.elementMarks.map((mark) => ({ ...mark }));
      }
      targetNode.setData(data, { overwrite: true });
  };
  
  ctx.addImageDialogueSourceRef = function addImageDialogueSourceRef(payload: {
      nodeId?: string;
      assetId?: string;
      previewUrl: string;
      fileName?: string;
  }, targetNodeId?: string) {
      const g = ctx.graph.value;
      const id = targetNodeId ?? ctx.selectedNodeId.value;
      if (!g || !id || !payload.previewUrl)
          return;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return;
      const data = { ...(cell.getData() as CanvasNodeData) };
      if (!ctx.canNodeHostImageDialogue(data, id))
          return;
      if (payload.nodeId && payload.nodeId === id)
          return;
      const ref: ImageSourceRef = {
          nodeId: payload.nodeId || payload.assetId || `upload-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          assetId: payload.assetId,
          previewUrl: payload.previewUrl,
          fileName: payload.fileName ?? '',
      };
      let refs = ctx.seedImageDialogueRefs(data, id);
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
      data.inputUpdated = refs.some((item) => Boolean(item.previewUrl));
      cell.setData(data, { overwrite: true });
      ctx.bumpToolbarRevision();
      ctx.scheduleHistoryPush();
  };
  
  ctx.linkImageNodeToImageDialogue = async function linkImageNodeToImageDialogue(imageNodeId: string, targetNodeId = ctx.selectedNodeId.value) {
      const g = ctx.graph.value;
      if (!g || !targetNodeId || !imageNodeId || imageNodeId === targetNodeId)
          return false;
      const source = g.getCellById(imageNodeId);
      const target = g.getCellById(targetNodeId);
      if (!source?.isNode() || !target?.isNode())
          return false;
      const sourceData = source.getData() as CanvasNodeData;
      const targetData = target.getData() as CanvasNodeData;
      if (sourceData.kind !== 'image' ||
          !ctx.canNodeHostImageDialogue(targetData, targetNodeId) ||
          !sourceData.previewUrl ||
          sourceData.uploadState === 'uploading' ||
          sourceData.imageGenTask === 'picker') {
          return false;
      }
      const hasEdge = g.getEdges().some((edge) => edge.getSourceCellId() === imageNodeId && edge.getTargetCellId() === targetNodeId);
      if (!hasEdge) {
          connectGenEdge(g, imageNodeId, targetNodeId);
      }
      ctx.addImageDialogueSourceRef({
          nodeId: imageNodeId,
          assetId: sourceData.assetId,
          previewUrl: sourceData.previewUrl,
          fileName: sourceData.fileName || sourceData.title || '',
      }, targetNodeId);
      ctx.bumpToolbarRevision();
      ctx.scheduleHistoryPush();
      return true;
  };
  
  ctx.onImageDialogueUploadFiles = async function onImageDialogueUploadFiles(files: File[]) {
      const g = ctx.graph.value;
      const targetNodeId = ctx.getActiveImageDialogueTargetNodeId() || ctx.selectedNodeId.value;
      if (!g || !targetNodeId)
          return;
      const targetCell = g.getCellById(targetNodeId);
      if (!targetCell?.isNode())
          return;
      const targetData = targetCell.getData() as CanvasNodeData;
      if (!ctx.canNodeHostImageDialogue(targetData, targetNodeId))
          return;
      const imageFiles = files.filter((file) => file.type.startsWith('image/'));
      if (!imageFiles.length)
          return;
      const wasDialogueOpen = ctx.showImageDialogue.value;
      const bbox = targetCell.getBBox();
      for (let index = 0; index < imageFiles.length; index += 1) {
          const point = {
              x: bbox.x - 200 - index * 48,
              y: bbox.y + index * 36,
          };
          const node = await ctx.addImageFromFile(imageFiles[index], point, { select: false });
          if (!node)
              continue;
          await ctx.linkImageNodeToImageDialogue(node.id, targetNodeId);
      }
      ctx.selectGraphNodes(targetNodeId);
      if (wasDialogueOpen) {
          ctx.openImageDialogue(targetNodeId);
      }
      else {
          ctx.updateNodeToolbar();
      }
      ctx.bumpToolbarRevision();
      ctx.scheduleHistoryPush();
  };
  
  ctx.onImageDialogueAddCanvasNode = function onImageDialogueAddCanvasNode(sourceNodeId: string) {
      const targetNodeId = ctx.getActiveImageDialogueTargetNodeId() || ctx.selectedNodeId.value;
      const wasDialogueOpen = ctx.showImageDialogue.value;
      void ctx.linkImageNodeToImageDialogue(sourceNodeId, targetNodeId).then((linked) => {
          if (!linked)
              return;
          if (targetNodeId) {
              ctx.selectGraphNodes(targetNodeId);
              if (wasDialogueOpen) {
                  ctx.openImageDialogue(targetNodeId);
              }
              else {
                  ctx.updateNodeToolbar();
              }
          }
          ctx.bumpToolbarRevision();
          ctx.scheduleHistoryPush();
      });
  };
  
  ctx.appendImageDialogueDigitalHumanRef = function appendImageDialogueDigitalHumanRef(payload: {
      assetId: string;
      previewUrl: string;
  }, targetNodeId?: string): boolean {
      const g = ctx.graph.value;
      const id = targetNodeId ?? ctx.selectedNodeId.value;
      if (!g || !id || !payload.previewUrl?.trim() || !payload.assetId)
          return false;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return false;
      const data = { ...(cell.getData() as CanvasNodeData) };
      if (!ctx.canNodeHostImageDialogue(data, id))
          return false;
      const ref: ImageSourceRef = {
          nodeId: `digital-human-${payload.assetId}`,
          assetId: payload.assetId,
          previewUrl: payload.previewUrl,
          fileName: '我的数字人',
      };
      const refs = Array.isArray(data.imageSourceRefs)
          ? data.imageSourceRefs.filter((item) => item.previewUrl?.trim())
          : [];
      if (refs.some((item) => item.assetId === payload.assetId)) {
          return true;
      }
      data.imageSourceRefs = [...refs, ref];
      data.inputUpdated = data.imageSourceRefs.some((item) => Boolean(item.previewUrl));
      const selfRef = ctx.buildNodeSelfDialogueRef(data, id);
      if (!selfRef) {
          data.sourceNodeId = ref.nodeId;
          data.sourcePreviewUrl = ref.previewUrl;
          data.sourceFileName = ref.fileName;
          data.sourceAssetId = ref.assetId;
      }
      cell.setData(data, { overwrite: true });
      ctx.bumpToolbarRevision();
      ctx.scheduleHistoryPush();
      return true;
  };
  
  ctx.onImageDialogueAddDigitalHumanRef = function onImageDialogueAddDigitalHumanRef(payload: {
      assetId: string;
      previewUrl: string;
  }) {
      const targetNodeId = ctx.getActiveImageDialogueTargetNodeId() || ctx.selectedNodeId.value;
      const appended = ctx.appendImageDialogueDigitalHumanRef(payload, targetNodeId);
      if (!appended)
          return;
      if (ctx.activeImageGenPromptNodeId.value === targetNodeId) {
          ctx.loadImageGenPromptFields(targetNodeId);
      }
      if (ctx.showImageDialogue.value && ctx.getActiveImageDialogueTargetNodeId() === targetNodeId) {
          ctx.loadImageDialogueFields(targetNodeId);
          ctx.persistImageDialogueFields(targetNodeId);
      }
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
  };
  
  ctx.clearImageDialoguePreview = function clearImageDialoguePreview(sourceNodeId?: string) {
      const g = ctx.graph.value;
      const id = ctx.getActiveImageDialogueTargetNodeId() || ctx.selectedNodeId.value;
      if (!g || !id)
          return;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return;
      const data = { ...(cell.getData() as CanvasNodeData) };
      let refs = Array.isArray(data.imageSourceRefs) ? [...data.imageSourceRefs] : [];
      if (sourceNodeId) {
          const removed = refs.filter((item) => item.nodeId === sourceNodeId);
          removed.forEach((item) => {
              if (item.previewUrl.startsWith('blob:'))
                  URL.revokeObjectURL(item.previewUrl);
          });
          refs = refs.filter((item) => item.nodeId !== sourceNodeId);
          // 同步删除该来源连入的连线
          g.getEdges().forEach((edge) => {
              if (edge.getSourceCellId() === sourceNodeId && edge.getTargetCellId() === id) {
                  g.removeEdge(edge.id);
              }
          });
      }
      else {
          refs.forEach((item) => {
              if (item.previewUrl.startsWith('blob:'))
                  URL.revokeObjectURL(item.previewUrl);
          });
          refs = [];
      }
      data.imageSourceRefs = refs;
      const latest = refs[refs.length - 1];
      data.sourceNodeId = latest?.nodeId ?? '';
      data.sourcePreviewUrl = latest?.previewUrl ?? '';
      data.sourceFileName = latest?.fileName ?? '';
      data.sourceAssetId = latest?.assetId ?? '';
      data.inputUpdated = refs.some((item) => Boolean(item.previewUrl));
      // overwrite: true —— X6 默认深合并数组不会缩短，删除元素必须整体替换
      cell.setData(data, { overwrite: true });
      ctx.toolbarRevision.value += 1;
      ctx.scheduleHistoryPush();
  };

  ctx.triggerFileInputClick = function triggerFileInputClick(accept: string, filter: UploadFilter, multiple: boolean, nodeId = '') {
      const now = Date.now();
      if (now - ctx.lastCanvasFileInputClickAt < ctx.CANVAS_FILE_INPUT_CLICK_DEBOUNCE_MS)
          return;
      ctx.lastCanvasFileInputClickAt = now;
      ctx.pendingUploadNodeId.value = nodeId;
      ctx.fileInputAccept.value = accept;
      ctx.fileInputMultiple.value = multiple;
      ctx.pendingUploadFilter.value = filter;
      const input = ctx.fileInputRef.value;
      if (!input)
          return;
      // 同步写入 DOM，避免首次点击时 :accept 尚未更新导致文件类型无限制
      input.value = '';
      input.accept = accept;
      input.multiple = multiple;
      input.click();
  };
}
