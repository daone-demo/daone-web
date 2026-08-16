// @ts-nocheck -- 动态共享上下文保持原闭包的运行时类型；公开契约仍由 CanvasBindings 校验。
/**
 * 职责：安装 Dialogue 元素标记模式相关动作到 ctx。
 */
import { isRequestError } from '@/utils/request';
import type { Node } from '@antv/x6';
import { message } from 'ant-design-vue';
import { nextTick,provide } from 'vue';
import { createDefaultVideoDialogueSettings,IMAGE_GENERAL_CAPABILITY_CODE,isNodeFileUploading,normalizeImageDialogueSettingsForModel,pickImageDialogueSettingsInput,resolveGenerationTaskWorkflowId,resolveImageAssetId,toVideoApiClarity,VIDEO_GENERAL_CAPABILITY_CODE,type ImageDialogueSubmitPayload,type ImageMarkItem,type VideoDialogueSubmitPayload,type VideoGenAspectRatio } from '../../../../constants';
import { buildImageGenerationParams,buildTextGenerationParams,imageDialogueSettingsFromPayload,persistNodeGenerationSnapshot } from '../../../../generationParams';
import { bindGenerationTaskId,followTextGenerationTaskOnNode,isGenerationTaskTerminal,markTextGenerationNodeFailed,markVideoGenerationNodeFailed,normalizeGenerationTaskDetail,pollGenerationTask,runImageGenerationOnNode,startImageGenerationOnNode,startVideoGenerationTaskFollow,type GenerationTaskDetail } from '../../../../generationTask';
import { createIdempotencyKey } from '../../../../idempotency';
import { appendElementMarkToNode,appendImageMarkToNode,buildImageMarkItem,clientPointToImageNaturalCoords,isImageMarkAnalyzing,parseImageMarkRecognizeResult,removeImageMarkFromGraph,replaceImageMarkOnGraph,setImageMarkAnalyzing,syncNodeImageMarkLists,updateImageMarkLabelOnNode } from '../../../../imageMarkUtils';
import { toVideoApiPrompt } from '../../../../promptMention';
import { getBoundingBoxCenter } from '../../../../viewport';
import type { CanvasNodeData,ImageSourceRef } from '../../sharedImports';
import { api,ensureImageTextEdge,findIncomingTextNodes,getImageMarkHintPosition,getNodeSize,getScroller,getVideoSourceRefs,IMG2PROMPT_DEFAULT_INSTRUCTION,isImageGenerationFailedNode,isVideoGenerationFailedNode,plainTextFromNodeContent,planOutgoingResultPoints,prepareImageNodeForInPlaceGeneration,resetImageGenerationNodeForRetry,resolveText2ImageGenerationTargetNode,resolveVideoSourceRefsForNode,runUploadSimulation,spawnGenerationResultNode,spawnVideoGenerationResultNode,syncNodeShapeFromData,syncTextNodeImageSource,toPersistedVideoSourceRefs,uploadAssetFile } from '../../sharedImports';
import type { CoreRuntimeContext } from '../context';

export function installDialogueElementMarkMode(ctx: CoreRuntimeContext) {
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
