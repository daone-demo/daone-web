// @ts-nocheck -- 动态共享上下文保持原闭包的运行时类型；公开契约仍由 CanvasBindings 校验。
/**
 * 职责：安装 Connections 域的边连线 / 来源关联 / 删除节点 / 文本展开格式化 / picker / handleNodeEdgeLinked。
 */
import { sanitizeRichTextHtml } from '@/utils/sanitizeHtml';
import type { Edge,Graph,Node } from '@antv/x6';
import { computed,nextTick,provide } from 'vue';
import type { CanvasGraph,CanvasNodeData,ImageResizeCorner,ImageSourceRef,NodeKind,TextFormatCommand } from '../../sharedImports';
import { addCanvasNode,canImageNodeAcceptIncoming,centerGraphContent,connectGenEdge,detachEdgeRelation,disconnectImageFromVideo,findImageToVideoEdge,findIncomingTextNodes,formatDimensions,getEdgeDeleteButtonPosition,getGroupBoxNodeIds,getGroupDisplayMemberCount,getGroupScreenBoxFromGraphBox,getImageExpandOverlayLayout,getImageNodeMediaScreenBox,getMultiSelectionToolbarPosition,getNodeCropOverlayPosition,getNodeDialoguePosition,getNodeImageGenPromptPosition,getNodePromptPosition,getNodeSidePanelPosition,getNodeTextDownloadPosition,getNodeTextFormatToolbarPosition,getNodeToolbarPosition,getNodeVideoGenPromptPosition,getVideoSourceRefs,getViewportCenterLocal,graphLocalToContainerOffset,hasVisibleNodesInViewport,IMG2PROMPT_DEFAULT_INSTRUCTION,isPersistedEdge,listCanvasGroups,normalizeGroupMembership,resolveGroupDisplayTitle,resolveGroupGraphBBox,shouldOpenImageGenPromptBar,startImageNodeCornerResize,syncEdgeSelectionHighlight,syncImageNodeSizeToMediaAspect,syncPendingImageTargetFromSources,syncTextNodeImageSource,toPersistedVideoSourceRefs,VIDEO_GEN_TAB_IMAGE_RULES } from '../../sharedImports';
import type { CoreRuntimeContext } from '../context';

export function installConnectionEdgeLinking(ctx: CoreRuntimeContext) {
  ctx.applyIncomingImageSource = function applyIncomingImageSource(target: Node, source: Node) {
      if (source.id === target.id)
          return false;
      const sourceData = source.getData() as CanvasNodeData;
      const data = { ...(target.getData() as CanvasNodeData) };
      const ref: ImageSourceRef = {
          nodeId: source.id,
          assetId: sourceData.assetId,
          previewUrl: sourceData.previewUrl ?? '',
          fileName: sourceData.fileName ?? '',
      };
      const refs = Array.isArray(data.imageSourceRefs) ? [...data.imageSourceRefs] : [];
      // 兼容生成节点时写入的单一来源（如节点3 由节点1 连线生成），首次追加时先补回原始来源
      if (!refs.length && data.sourceNodeId && data.sourcePreviewUrl) {
          refs.push({
              nodeId: data.sourceNodeId,
              assetId: data.sourceAssetId,
              previewUrl: data.sourcePreviewUrl,
              fileName: data.sourceFileName ?? '',
          });
      }
      const existingIdx = refs.findIndex((item) => item.nodeId === source.id);
      if (existingIdx >= 0)
          refs.splice(existingIdx, 1, ref);
      else
          refs.push(ref);
      data.imageSourceRefs = refs;
      // 兼容旧逻辑：主来源保留为最新连入的一张
      data.sourceNodeId = source.id;
      data.sourcePreviewUrl = ref.previewUrl;
      data.sourceFileName = ref.fileName;
      data.sourceAssetId = ref.assetId;
      data.inputUpdated = refs.some((item) => Boolean(item.previewUrl));
      // overwrite: true —— 避免 X6 默认深合并对 imageSourceRefs 数组按索引合并导致脏数据
      target.setData(data, { overwrite: true });
      const g = ctx.graph.value;
      if (g)
          syncPendingImageTargetFromSources(g, target);
      return true;
  };
  
  ctx.linkImageSourceFromEdge = function linkImageSourceFromEdge(g: Graph, edge: Edge, target: Node) {
      const source = edge.getSourceCell();
      if (!source?.isNode() || !ctx.applyIncomingImageSource(target, source)) {
          g.removeEdge(edge.id);
          return;
      }
      if (ctx.showImageDialogue.value && ctx.getActiveImageDialogueTargetNodeId() === target.id) {
          ctx.loadImageDialogueFields(target.id);
      }
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
      ctx.scheduleHistoryPush();
  };
  
  ctx.onRemoveImageGenSourceRef = function onRemoveImageGenSourceRef(sourceNodeId: string) {
      const g = ctx.graph.value;
      const imageNodeId = ctx.activeImageGenPromptNodeId.value;
      if (!g || !imageNodeId || !sourceNodeId)
          return;
      g.getEdges().forEach((edge) => {
          if (edge.getSourceCellId() === sourceNodeId &&
              edge.getTargetCellId() === imageNodeId) {
              g.removeEdge(edge.id);
          }
      });
      if (ctx.activeImageGenPromptNodeId.value === imageNodeId) {
          ctx.loadImageGenPromptFields(imageNodeId);
      }
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
      ctx.scheduleHistoryPush();
  };
  
  ctx.onRemoveVideoSourceRef = function onRemoveVideoSourceRef(sourceNodeId: string) {
      const g = ctx.graph.value;
      const videoNodeId = ctx.getActiveVideoTargetNodeId();
      if (!g || !videoNodeId || !sourceNodeId)
          return;
      const cell = g.getCellById(videoNodeId);
      if (!cell?.isNode())
          return;
      const data = { ...(cell.getData() as CanvasNodeData) };
      const sourceCell = g.getCellById(sourceNodeId);
      const sourceData = sourceCell?.isNode()
          ? (sourceCell.getData() as CanvasNodeData)
          : undefined;
      if (sourceData?.kind === 'text') {
          const upstreamText = ctx.getTextNodePlainContent(sourceCell as Node);
          g.getEdges().forEach((edge) => {
              if (edge.getSourceCellId() === sourceNodeId &&
                  edge.getTargetCellId() === videoNodeId) {
                  g.removeEdge(edge.id);
              }
          });
          if (upstreamText &&
              ctx.videoGenPromptText.value.trim() === upstreamText.trim()) {
              ctx.videoGenPromptText.value = '';
              data.genPrompt = '';
              data.videoDialogueText = '';
              cell.setData(data, { overwrite: true });
          }
      }
      else {
          disconnectImageFromVideo(g, sourceNodeId, videoNodeId);
          const fromStored = Array.isArray(data.videoSourceRefs) ? data.videoSourceRefs : [];
          const live = getVideoSourceRefs(g, videoNodeId);
          const base = fromStored.length ? fromStored : toPersistedVideoSourceRefs(live);
          data.videoSourceRefs = base.filter((item) => item.nodeId !== sourceNodeId);
          cell.setData(data, { overwrite: true });
      }
      if (ctx.activeVideoGenPromptNodeId.value === videoNodeId) {
          ctx.loadVideoGenPromptFields(videoNodeId);
      }
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
      ctx.scheduleHistoryPush();
  };
  
  ctx.getVideoGenSourceLimit = function getVideoGenSourceLimit() {
      const tab = ctx.activeVideoGenPromptNodeId.value ? ctx.videoGenActiveTab.value : 'reference';
      const rule = VIDEO_GEN_TAB_IMAGE_RULES[tab];
      return rule?.max ?? 9;
  };
  
  ctx.linkImageNodeToVideoGen = async function linkImageNodeToVideoGen(imageNodeId: string) {
      const g = ctx.graph.value;
      const videoNodeId = ctx.getActiveVideoTargetNodeId();
      if (!g || !videoNodeId || !imageNodeId || imageNodeId === videoNodeId)
          return false;
      const source = g.getCellById(imageNodeId);
      if (!source?.isNode())
          return false;
      const sourceData = source.getData() as CanvasNodeData;
      if (sourceData.kind !== 'image' ||
          !sourceData.previewUrl ||
          sourceData.uploadState === 'uploading' ||
          sourceData.imageGenTask === 'picker') {
          return false;
      }
      if (findImageToVideoEdge(g, imageNodeId, videoNodeId))
          return false;
      const currentCount = getVideoSourceRefs(g, videoNodeId).length;
      if (currentCount >= ctx.getVideoGenSourceLimit())
          return false;
      connectGenEdge(g, imageNodeId, videoNodeId);
      ctx.syncVideoSourceRefsSnapshot(videoNodeId);
      ctx.bumpToolbarRevision();
      ctx.scheduleHistoryPush();
      return true;
  };
  
  ctx.onVideoGenUploadFiles = async function onVideoGenUploadFiles(files: File[]) {
      const g = ctx.graph.value;
      const videoNodeId = ctx.getActiveVideoTargetNodeId();
      if (!g || !videoNodeId)
          return;
      const videoCell = g.getCellById(videoNodeId);
      if (!videoCell?.isNode())
          return;
      const imageFiles = files.filter((file) => file.type.startsWith('image/'));
      if (!imageFiles.length)
          return;
      let currentCount = getVideoSourceRefs(g, videoNodeId).length;
      const limit = ctx.getVideoGenSourceLimit();
      const bbox = videoCell.getBBox();
      for (let index = 0; index < imageFiles.length; index += 1) {
          if (currentCount >= limit)
              break;
          const point = {
              x: bbox.x - 200 - index * 48,
              y: bbox.y + index * 36,
          };
          const node = await ctx.addImageFromFile(imageFiles[index], point);
          if (!node)
              continue;
          const linked = await ctx.linkImageNodeToVideoGen(node.id);
          if (linked)
              currentCount += 1;
      }
      ctx.updateNodeToolbar();
  };
  
  ctx.onVideoGenAddCanvasNode = function onVideoGenAddCanvasNode(sourceNodeId: string) {
      void ctx.linkImageNodeToVideoGen(sourceNodeId).then((linked) => {
          if (linked)
              ctx.updateNodeToolbar();
      });
  };
  
  ctx.detachImageSourceFromDownstream = function detachImageSourceFromDownstream(g: Graph, deletedNodeId: string) {
      g.getNodes().forEach((node) => {
          if (node.id === deletedNodeId)
              return;
          const data = node.getData() as CanvasNodeData;
          if (data.kind !== 'image' && data.kind !== 'text')
              return;
          const refs = Array.isArray(data.imageSourceRefs) ? data.imageSourceRefs : [];
          const hasRef = refs.some((item) => item.nodeId === deletedNodeId);
          const hasSingle = data.sourceNodeId === deletedNodeId || data.linkedImageNodeId === deletedNodeId;
          if (!hasRef && !hasSingle)
              return;
          const next = { ...data };
          const filtered = refs.filter((item) => item.nodeId !== deletedNodeId);
          next.imageSourceRefs = filtered;
          const latest = filtered[filtered.length - 1];
          next.sourceNodeId = latest?.nodeId ?? '';
          next.sourcePreviewUrl = latest?.previewUrl ?? '';
          next.sourceFileName = latest?.fileName ?? '';
          next.sourceAssetId = latest?.assetId ?? '';
          next.inputUpdated = filtered.some((item) => Boolean(item.previewUrl));
          if (data.kind === 'text')
              next.linkedImageNodeId = latest?.nodeId ?? '';
          node.setData(next, { overwrite: true });
      });
  };
  
  ctx.removeNodeById = function removeNodeById(nodeId: string) {
      const g = ctx.graph.value;
      if (!g || !nodeId)
          return;
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      normalizeGroupMembership(g, nodeId);
      ctx.detachImageSourceFromDownstream(g, nodeId);
      g.removeCell(cell);
      ctx.bumpToolbarRevision();
      ctx.textEditorApis.delete(nodeId);
      if (ctx.activePickerNodeId.value === nodeId) {
          ctx.activePickerNodeId.value = '';
      }
      if (ctx.activeImageGenPromptNodeId.value === nodeId) {
          ctx.closeImageGenPromptBar();
      }
      if (ctx.activeVideoGenPromptNodeId.value === nodeId) {
          ctx.closeVideoGenPromptBar();
      }
      ctx.syncSelectionFromGraph();
      ctx.syncNodeCount();
      ctx.scheduleHistoryPush();
  };
  
  provide('deleteCanvasNode', ctx.removeNodeById);
  
  ctx.openTextExpand = function openTextExpand(nodeId: string) {
      const g = ctx.graph.value;
      if (!g)
          return;
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      const data = cell.getData() as CanvasNodeData;
      ctx.textExpandNodeId.value = nodeId;
      ctx.textExpandTitle.value = data.title || '文本节点';
      ctx.textExpandOpen.value = true;
      nextTick(() => {
          const el = ctx.textExpandEditorRef.value;
          if (!el)
              return;
          const html = sanitizeRichTextHtml(data.content || '');
          el.innerHTML = html;
          if (html !== data.content) {
              cell.setData({ ...data, content: html });
          }
          el.focus();
      });
  };
  
  ctx.closeTextExpand = function closeTextExpand() {
      ctx.persistTextExpandContent();
      ctx.textExpandOpen.value = false;
      ctx.textExpandNodeId.value = '';
  };
  
  ctx.onTextExpandInput = function onTextExpandInput() {
      ctx.persistTextExpandContent();
  };
  
  ctx.persistTextExpandContent = function persistTextExpandContent() {
      const g = ctx.graph.value;
      const nodeId = ctx.textExpandNodeId.value;
      const el = ctx.textExpandEditorRef.value;
      if (!g || !nodeId || !el)
          return;
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      const content = sanitizeRichTextHtml(el.innerHTML);
      if (content !== el.innerHTML) {
          el.innerHTML = content;
      }
      const data = { ...(cell.getData() as CanvasNodeData), content };
      cell.setData(data);
  };
  
  ctx.onTextFormatAction = function onTextFormatAction(cmd: TextFormatCommand, value?: string) {
      if (cmd === 'download') {
          ctx.downloadSelectedTextNode();
          return;
      }
      if (cmd === 'delete') {
          ctx.removeSelectedNodes();
          return;
      }
      const api = ctx.textEditorApis.get(ctx.selectedNodeId.value);
      if (!api)
          return;
      if (cmd === 'expand') {
          ctx.openTextExpand(ctx.selectedNodeId.value);
          return;
      }
      api.execFormat(cmd, value);
  };
  
  ctx.downloadSelectedTextNode = function downloadSelectedTextNode() {
      const api = ctx.textEditorApis.get(ctx.selectedNodeId.value);
      const text = api?.getPlainText() ?? '';
      if (!text.trim())
          return;
      const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `${ctx.getSelectedNodeData()?.title || '文本节点'}.txt`;
      link.click();
      URL.revokeObjectURL(url);
  };
  
  ctx.handleVideoPickerAction = function handleVideoPickerAction(key: string, nodeId: string) {
      const g = ctx.graph.value;
      if (!g)
          return;
      ctx.selectedNodeId.value = nodeId;
      ctx.selectedKind.value = 'video';
      ctx.syncNodeSelectionHighlight(nodeId);
      ctx.openVideoGenPromptBar(nodeId, key);
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
  };
  
  ctx.handleTextPickerAction = function handleTextPickerAction(key: string, nodeId: string) {
      const g = ctx.graph.value;
      if (!g)
          return;
      ctx.selectedNodeId.value = nodeId;
      ctx.selectedKind.value = 'text';
      ctx.syncNodeSelectionHighlight(nodeId);
      ctx.dismissTextPickerPanels();
      if (key === 'write') {
          ctx.activePickerNodeId.value = '';
          ctx.modelType.value = 'free';
          ctx.setTextEditorToolbarActive(false);
          ctx.bumpToolbarRevision();
          ctx.updateNodeToolbar();
          ctx.scheduleHistoryPush();
          return;
      }
      if (key === 'text2image') {
          const source = g.getCellById(nodeId);
          if (!source?.isNode())
              return;
          const textNode = source as Node;
          const data = { ...(textNode.getData() as CanvasNodeData) };
          data.mode = 'picker';
          data.textPickerTask = key;
          data.textGenState = 'idle';
          textNode.setData(data);
          ctx.openImageGenPromptBar(nodeId);
          ctx.bumpToolbarRevision();
          ctx.updateNodeToolbar();
          ctx.scheduleHistoryPush();
          return;
      }
      if (key === 'text2video') {
          const cell = g.getCellById(nodeId);
          if (!cell?.isNode())
              return;
          const data = { ...(cell.getData() as CanvasNodeData) };
          data.mode = 'picker';
          data.textPickerTask = key;
          data.textGenState = 'idle';
          cell.setData(data);
          ctx.modelType.value = 'text2video';
          ctx.activePickerNodeId.value = nodeId;
          ctx.loadPromptBarContext(nodeId);
          ctx.bumpToolbarRevision();
          ctx.updateNodeToolbar();
          ctx.scheduleHistoryPush();
          return;
      }
      if (key === 'img2prompt') {
          const cell = g.getCellById(nodeId);
          if (!cell?.isNode())
              return;
          const data = { ...(cell.getData() as CanvasNodeData) };
          data.mode = 'picker';
          data.textPickerTask = key;
          data.textGenState = 'idle';
          if (!data.genPrompt?.trim()) {
              data.genPrompt = IMG2PROMPT_DEFAULT_INSTRUCTION;
          }
          cell.setData(data);
          syncTextNodeImageSource(g, cell as Node);
          ctx.modelType.value = 'img2prompt';
          ctx.activePickerNodeId.value = nodeId;
          ctx.loadPromptBarContext(nodeId);
          ctx.bumpToolbarRevision();
          ctx.updateNodeToolbar();
          ctx.scheduleHistoryPush();
          return;
      }
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      const data = { ...(cell.getData() as CanvasNodeData) };
      data.content = '';
      data.mode = 'editor';
      cell.setData(data);
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
  };
  
  ctx.handleNodeEdgeLinked = function handleNodeEdgeLinked(targetNodeId: string, sourceNodeId?: string) {
      const g = ctx.graph.value;
      if (!g)
          return;
      const cell = g.getCellById(targetNodeId);
      if (!cell?.isNode())
          return;
      const data = cell.getData() as CanvasNodeData;
      if (data.kind === 'text') {
          syncTextNodeImageSource(g, cell as Node);
          if (ctx.activePickerNodeId.value === targetNodeId) {
              ctx.loadPromptBarContext(targetNodeId);
          }
      }
      else if (data.kind === 'video') {
          ctx.syncVideoSourceRefsSnapshot(targetNodeId);
          let source = sourceNodeId && g.getCellById(sourceNodeId)?.isNode()
              ? (g.getCellById(sourceNodeId) as Node)
              : null;
          if (!source) {
              const textNodes = findIncomingTextNodes(g, targetNodeId);
              if (textNodes.length)
                  source = textNodes[textNodes.length - 1] ?? null;
          }
          const sourceData = source?.getData() as CanvasNodeData | undefined;
          if (sourceData?.kind === 'text' &&
              data.mode === 'picker' &&
              !data.previewUrl &&
              data.uploadState !== 'uploading') {
              ctx.selectedNodeId.value = targetNodeId;
              ctx.selectedKind.value = 'video';
              ctx.syncNodeSelectionHighlight(targetNodeId);
              ctx.openVideoGenPromptBar(targetNodeId, 'text2video');
          }
          if (ctx.activeVideoGenPromptNodeId.value === targetNodeId) {
              ctx.loadVideoGenPromptFields(targetNodeId);
          }
      }
      else if (data.kind === 'image') {
          const source = sourceNodeId && g.getCellById(sourceNodeId)?.isNode()
              ? (g.getCellById(sourceNodeId) as Node)
              : null;
          const sourceData = source?.getData() as CanvasNodeData | undefined;
          if (sourceData?.kind === 'text' &&
              shouldOpenImageGenPromptBar(g, targetNodeId, data)) {
              ctx.selectedNodeId.value = targetNodeId;
              ctx.selectedKind.value = 'image';
              ctx.syncNodeSelectionHighlight(targetNodeId);
              ctx.openImageGenPromptBar(targetNodeId);
          }
          else if (canImageNodeAcceptIncoming(data) &&
              source?.isNode() &&
              sourceData?.kind === 'image') {
              ctx.applyIncomingImageSource(cell as Node, source);
              ctx.openImageDialogue(targetNodeId);
          }
          if (ctx.activeImageGenPromptNodeId.value === targetNodeId) {
              ctx.loadImageGenPromptFields(targetNodeId);
          }
      }
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
      ctx.scheduleHistoryPush();
  };
}
