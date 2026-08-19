/**
 * 职责：安装 HistoryClipboard 域的真实画布业务实现。
 * 依赖：共享 ctx（bind 状态与跨域惰性函数）；不导入其他安装器。
 * 副作用：向 ctx 注册方法/派生状态，部分域会绑定监听或更新画布状态。
 */
import type { Node } from '@antv/x6';
import { message } from 'ant-design-vue';
import { nextTick } from 'vue';
import { buildCanvasMediaDownloadItems,downloadCanvasMediaBatch } from '../../../mediaDownload';
import type { CanvasNodeData,GroupLayoutDirection } from '.././sharedImports';
import { assignGroupId,fitStoredGroupSelectionBoxToMembers,getNodesInGroup,layoutNodesInGroup,mergeStoryboardGroup,ungroupSelection } from '.././sharedImports';
import type { CoreRuntimeContext } from './context';

export function installHistoryState(ctx: CoreRuntimeContext) {
  ctx.canvasHistory = null;
  ctx.historyPushTimer = null;
}

export function installHistoryClipboard(ctx: CoreRuntimeContext) {
  ctx.syncHistoryState = function syncHistoryState() {
      ctx.canUndo.value = ctx.canvasHistory?.canUndo() ?? false;
      ctx.canRedo.value = ctx.canvasHistory?.canRedo() ?? false;
  };
  
  ctx.scheduleHistoryPush = function scheduleHistoryPush(options: {
      autoSave?: boolean;
  } = {}) {
      // 同步标记 dirty，不等待 280ms 历史防抖，避免「保存并离开」跳过窗口内修改
      if (typeof ctx.markLocalCanvasChange === 'function') {
          ctx.markLocalCanvasChange();
      }
      const shouldAutoSave = options.autoSave !== false;
      const g = ctx.graph.value;
      if (g && ctx.canvasHistory) {
          if (ctx.historyPushTimer)
              clearTimeout(ctx.historyPushTimer);
          ctx.historyPushTimer = setTimeout(() => {
              ctx.canvasHistory?.push(g);
              ctx.syncHistoryState();
              ctx.historyPushTimer = null;
              if (shouldAutoSave) {
                  ctx.triggerAutoSaveIfReady();
              }
          }, 280);
      }
      else if (shouldAutoSave) {
          ctx.triggerAutoSaveIfReady();
      }
  };
  
  ctx.notifyTextNodeUpdated = function notifyTextNodeUpdated() {
      const imageNodeId = ctx.activeImageGenPromptNodeId.value;
      if (imageNodeId) {
          const upstream = ctx.resolveImageGenTextSourcePreview(imageNodeId);
          ctx.imageGenSourceTextPreview.value = upstream;
          if (upstream && !ctx.imageDialogueText.value.trim()) {
              ctx.imageDialogueText.value = upstream;
              ctx.imageGenPromptText.value = upstream;
          }
      }
      const videoNodeId = ctx.activeVideoGenPromptNodeId.value;
      if (videoNodeId && ctx.videoGenActiveTab.value === 'text2video') {
          const upstream = ctx.resolveVideoUpstreamPrompt(videoNodeId);
          if (upstream && !ctx.videoGenPromptText.value.trim()) {
              ctx.videoGenPromptText.value = upstream;
              ctx.persistVideoGenPrompt();
          }
      }
      ctx.bumpToolbarRevision();
      ctx.scheduleHistoryPush();
  };
  
  ctx.handleUndo = function handleUndo() {
      const g = ctx.graph.value;
      if (!g || !ctx.canvasHistory?.undo(g))
          return;
      if (typeof ctx.markLocalCanvasChange === 'function') {
          ctx.markLocalCanvasChange();
      }
      ctx.syncHistoryState();
      ctx.syncNodeCount();
      ctx.resetCanvasInteractionState();
      ctx.triggerAutoSaveIfReady();
      nextTick(() => ctx.updateNodeToolbar());
  };
  
  ctx.handleRedo = function handleRedo() {
      const g = ctx.graph.value;
      if (!g || !ctx.canvasHistory?.redo(g))
          return;
      if (typeof ctx.markLocalCanvasChange === 'function') {
          ctx.markLocalCanvasChange();
      }
      ctx.syncHistoryState();
      ctx.syncNodeCount();
      ctx.resetCanvasInteractionState();
      ctx.triggerAutoSaveIfReady();
      nextTick(() => ctx.updateNodeToolbar());
  };
  
  ctx.getActiveSelectedNodeIds = function getActiveSelectedNodeIds() {
      if (ctx.selectedNodeIds.value.length >= 2)
          return [...ctx.selectedNodeIds.value];
      if (ctx.selectedNodeId.value)
          return [ctx.selectedNodeId.value];
      return [];
  };
  
  ctx.copySelectedNode = function copySelectedNode() {
      const g = ctx.graph.value;
      const ids = ctx.getActiveSelectedNodeIds();
      if (!g || !ids.length)
          return;
      if (ids.length === 1) {
          const cell = g.getCellById(ids[0]);
          if (!cell?.isNode())
              return;
          ctx.nodeClipboard.value = (cell as Node).toJSON();
          return;
      }
      ctx.nodeClipboard.value = ids
          .map((id) => g.getCellById(id))
          .filter((cell): cell is Node => cell != null && cell.isNode())
          .map((cell) => (cell as Node).toJSON());
  };
  
  ctx.copySelectedNodes = function copySelectedNodes() {
      ctx.copySelectedNode();
  };
  
  ctx.createPastedCanvasNodeId = function createPastedCanvasNodeId() {
      return `node_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;
  };
  
  ctx.sanitizePastedNodeData = function sanitizePastedNodeData(data: CanvasNodeData, options?: {
      oldId?: string;
      idMap?: Map<string, string>;
  }): CanvasNodeData {
      const { groupId: _groupId, groupSelectionBox: _box, groupTitle: _title, isSelected: _selected, generationTaskId: _taskId, generationResultIndex: _resultIndex, ...rest } = data;
      const next: CanvasNodeData = { ...rest };
      if (options?.oldId && next.sourceNodeId === options.oldId) {
          const remapped = options.idMap?.get(options.oldId);
          if (remapped)
              next.sourceNodeId = remapped;
          else
              delete next.sourceNodeId;
      }
      else if (next.sourceNodeId && options?.idMap?.has(next.sourceNodeId)) {
          next.sourceNodeId = options.idMap.get(next.sourceNodeId)!;
      }
      if (next.linkedImageNodeId && options?.idMap?.has(next.linkedImageNodeId)) {
          next.linkedImageNodeId = options.idMap.get(next.linkedImageNodeId)!;
      }
      if (Array.isArray(next.imageSourceRefs) && options?.idMap?.size) {
          next.imageSourceRefs = next.imageSourceRefs.map((ref) => {
              if (!ref.nodeId || !options.idMap?.has(ref.nodeId))
                  return { ...ref };
              return { ...ref, nodeId: options.idMap.get(ref.nodeId)! };
          });
      }
      if (Array.isArray(next.imageElementMarks) && options?.idMap?.size) {
          next.imageElementMarks = next.imageElementMarks.map((mark) => {
              if (!mark.sourceNodeId || !options.idMap?.has(mark.sourceNodeId))
                  return { ...mark };
              return { ...mark, sourceNodeId: options.idMap.get(mark.sourceNodeId)! };
          });
      }
      if (Array.isArray(next.elementMarks) && options?.idMap?.size) {
          next.elementMarks = next.elementMarks.map((mark) => {
              if (!mark.sourceNodeId || !options.idMap?.has(mark.sourceNodeId))
                  return { ...mark };
              return { ...mark, sourceNodeId: options.idMap.get(mark.sourceNodeId)! };
          });
      }
      return next;
  };
  
  ctx.duplicateSelectedNodes = function duplicateSelectedNodes() {
      const g = ctx.graph.value;
      const ids = ctx.getActiveSelectedNodeIds();
      if (!g || !ids.length)
          return;
      const idSet = new Set(ids);
      const idMap = new Map<string, string>();
      const newNodes: Node[] = [];
      ids.forEach((id) => {
          const cell = g.getCellById(id);
          if (!cell?.isNode())
              return;
          const json = (cell as Node).toJSON() as Record<string, unknown>;
          const oldId = String(json.id ?? id);
          const newId = ctx.createPastedCanvasNodeId();
          idMap.set(oldId, newId);
          const x = typeof json.x === 'number' ? json.x : (cell as Node).getPosition().x;
          const y = typeof json.y === 'number' ? json.y : (cell as Node).getPosition().y;
          const rawData = (json.data ?? (cell as Node).getData()) as CanvasNodeData;
          const data = ctx.sanitizePastedNodeData(rawData, { oldId, idMap });
          const { id: _id, data: _data, x: _x, y: _y, ...rest } = json;
          const clone = g.addNode({
              ...rest,
              id: newId,
              x: x + 32,
              y: y + 32,
              data,
          });
          newNodes.push(clone);
      });
      // 二次回写：idMap 已齐全，修正引用旧 id 的字段
      newNodes.forEach((node, index) => {
          const oldId = ids[index];
          if (!oldId)
              return;
          const data = ctx.sanitizePastedNodeData(node.getData() as CanvasNodeData, { oldId, idMap });
          node.setData(data, { overwrite: true });
      });
      g.getEdges().forEach((edge) => {
          const sourceId = edge.getSourceCellId();
          const targetId = edge.getTargetCellId();
          if (!sourceId || !targetId || !idSet.has(sourceId) || !idSet.has(targetId))
              return;
          const nextSourceId = idMap.get(sourceId);
          const nextTargetId = idMap.get(targetId);
          if (!nextSourceId || !nextTargetId)
              return;
          g.addEdge({
              source: { cell: nextSourceId, port: 'right' },
              target: { cell: nextTargetId, port: 'left' },
              attrs: edge.getAttrs(),
              zIndex: edge.getZIndex(),
          });
      });
      if (!newNodes.length)
          return;
      ctx.selectGraphNodes(newNodes);
      ctx.syncNodeCount();
      ctx.scheduleHistoryPush();
  };
  
  ctx.handleMultiSelectLayout = function handleMultiSelectLayout(direction: GroupLayoutDirection = 'horizontal') {
      const g = ctx.graph.value;
      const ids = ctx.selectedNodeIds.value;
      if (!g || ids.length < 2)
          return;
      const nodes = ids
          .map((id) => g.getCellById(id))
          .filter((cell): cell is Node => cell != null && cell.isNode());
      layoutNodesInGroup(nodes, direction);
      const touchedGroupIds = new Set<string>();
      nodes.forEach((node) => {
          const groupId = (node.getData() as CanvasNodeData).groupId;
          if (groupId)
              touchedGroupIds.add(groupId);
      });
      touchedGroupIds.forEach((groupId) => fitStoredGroupSelectionBoxToMembers(g, groupId));
      ctx.updateNodeToolbar();
      ctx.scheduleHistoryPush();
  };
  
  ctx.handleMultiSelectSaveToAssets = function handleMultiSelectSaveToAssets() {
      ctx.showAssetsPanel.value = true;
  };
  
  ctx.runBatchDownloadForNodeIds = async function runBatchDownloadForNodeIds(nodeIds: string[]) {
      const g = ctx.graph.value;
      if (!g || !nodeIds.length)
          return;
      const nodes = nodeIds
          .map((id) => g.getCellById(id))
          .filter((cell): cell is Node => cell != null && cell.isNode())
          .map((node) => node.getData() as CanvasNodeData);
      const items = buildCanvasMediaDownloadItems(nodes);
      if (!items.length) {
          message.warning('当前选中没有可下载的图片、视频或模型文件');
          return;
      }
      const hideLoading = message.loading('正在下载', 0);
      try {
          const result = await downloadCanvasMediaBatch(items);
          hideLoading();
          if (!result.success) {
              message.error('批量下载失败：资源无法读取，请检查网络或稍后重试');
              return;
          }
          if (result.failed > 0) {
              message.warning(result.packagedAsZip
                  ? `已打包下载 ${result.success}/${result.total} 个文件`
                  : `已下载 ${result.success}/${result.total} 个文件`);
              return;
          }
          message.success(result.packagedAsZip
              ? `已成功打包下载 ${result.success} 个文件`
              : `已成功下载 ${result.success} 个文件`);
      }
      catch {
          hideLoading();
          message.error('批量下载失败，请稍后重试');
      }
  };
  
  ctx.handleMultiSelectBatchDownload = function handleMultiSelectBatchDownload() {
      const ids = ctx.selectedNodeIds.value;
      if (ids.length < 2)
          return;
      void ctx.runBatchDownloadForNodeIds(ids);
  };
  
  ctx.handleMultiSelectGroup = function handleMultiSelectGroup() {
      const g = ctx.graph.value;
      const ids = ctx.selectedNodeIds.value;
      if (!g || ids.length < 2)
          return;
      ungroupSelection(g, ids);
      const groupId = assignGroupId(g, ids);
      if (!groupId)
          return;
      ctx.selectGraphNodes(ids);
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
      ctx.scheduleHistoryPush();
  };
  
  ctx.handleMergeStoryboardGroup = function handleMergeStoryboardGroup() {
      const g = ctx.graph.value;
      const ids = ctx.selectedNodeIds.value;
      if (!g || ids.length < 2)
          return;
      const groupId = mergeStoryboardGroup(g, ids);
      if (!groupId)
          return;
      const memberIds = getNodesInGroup(g, groupId).map((node) => node.id);
      ctx.selectGraphNodes(memberIds);
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
      ctx.scheduleHistoryPush();
  };
  
  ctx.handleUngroup = function handleUngroup() {
      const g = ctx.graph.value;
      const group = ctx.activeGroupSelection.value;
      if (!g || !group)
          return;
      const memberIds = [...group.nodeIds];
      ungroupSelection(g, memberIds);
      ctx.selectGraphNodes(memberIds);
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
      ctx.scheduleHistoryPush();
  };
}
