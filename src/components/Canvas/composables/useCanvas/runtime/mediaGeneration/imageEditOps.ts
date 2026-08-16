// @ts-nocheck -- 动态共享上下文保持原闭包的运行时类型；公开契约仍由 CanvasBindings 校验。
/**
 * 职责：安装图片编辑 open/complete 相关动作到 ctx。
 */
import { isRequestError } from '@/utils/request';
import type { Graph,Node } from '@antv/x6';
import { message } from 'ant-design-vue';
import { nextTick } from 'vue';
import { resolveVideoTaskTypeLabel } from '../../../../canvasDescription';
import { buildImageActionResultTitle,buildVideoActionResultTitle,IMAGE_GENERAL_CAPABILITY_CODE,resolveGenerationTaskWorkflowId,resolveImageAssetId,resolveVideoAssetId,resolveVideoToolbarUiKey,toVideoApiClarity,VIDEO_GENERAL_CAPABILITY_CODE,type ImageDialogueSubmitPayload,type ImageToolbarClickEvent,type ImageToolbarClickPayload,type VideoDialogueSubmitPayload,type VideoGenAspectRatio,type VideoGenPromptSubmitPayload,type VideoToolbarClickEvent,type VideoToolbarClickPayload } from '../../../../constants';
import { normalizeOcrRecognizeResult,type ImageEditTextChange,} from '../../../../editTextUtils';
import { buildImageGenerationParams,buildModelGenerationParams,buildTextGenerationParams,persistNodeGenerationSnapshot } from '../../../../generationParams';
import { bindGenerationTaskId,bindSharedGenerationTaskId,followModelGenerationTaskOnNode,followTextGenerationTaskOnNode,markGenerationNodeFailed,markTextGenerationNodeFailed,markVideoGenerationNodeFailed,normalizeGenerationTaskDetail,startImageGenerationOnNode,startVideoGenerationTaskFollow,type GenerationTaskDetail } from '../../../../generationTask';
import { splitImageIntoGrid } from '../../../../gridSplitUtils';
import { createIdempotencyKey } from '../../../../idempotency';
import { applyImageMarkTaskParameters,canSubmitImageDialogueTask } from '../../../../imageMarkUtils';
import { loadImageToolbarCustomizeSettings,saveImageToolbarCustomizeSettings,type ImageToolbarCustomizeSettings,} from '../../../../imageToolbarCustomize';
import { downloadCanvasMedia } from '../../../../mediaDownload';
import { toVideoApiPrompt } from '../../../../promptMention';
import { getBoundingBoxCenter } from '../../../../viewport';
import type { CanvasNodeData } from '../../sharedImports';
import { normalizeCutoutMode } from '../../coreHelpers';
import { api,applyVideoFirstLastFrameParameters,connectGenEdge,findImageToVideoEdge,findReusableImageGenerationNode,findReusableVideoGenerationNode,getImageGenerationPlaceholderSize,getNodeSize,getScroller,getVideoSourceRefs,isImageGenerationFailedNode,planOutgoingResultPoints,prepareImageNodeForInPlaceGeneration,previewUrlToUploadFile,resetImageGenerationNodeForRetry,resetVideoGenerationNodeForRetry,resolveVideoGenerationSubmitContext,shouldGenerateImageInPlaceOnNode,spawnErasedImageNode,spawnGenerationResultNode,spawnGridSplitResultNodes,spawnModel3DResultNode,spawnTextPromptResultNode,spawnVideoGenerationResultNode,syncNodeShapeFromData,toPersistedVideoSourceRefs,uploadAssetFile } from '../../sharedImports';
import type { CoreRuntimeContext } from '../context';
export function installMediaImageEditOps(ctx: CoreRuntimeContext) {
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
  
}
