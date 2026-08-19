/**
 * 职责：安装多图结果 ensure/distribute/spawn 与 runImageGenerationTask 到 ctx。
 */
import {isRequestError} from '@/utils/request';
import type {Graph,Node} from '@antv/x6';
import {message} from 'ant-design-vue';
import {nextTick} from 'vue';
import {IMAGE_GENERAL_CAPABILITY_CODE,resolveGenerationTaskWorkflowId,resolveSubmittableCapabilityCode,type ImageToolbarClickEvent} from '../../../../constants';
import {buildImageGenerationParams,cloneNodeGenerationSnapshot} from '../../../../generationParams';
import {applyGenerationResultToNode,bindGenerationTaskId,bindSharedGenerationTaskId,markGenerationNodeFailed,pickImageGenerationResults,readGenerationResultIndex,resolveGenerationResultPreview,startImageGenerationOnNode,type GenerationTaskDetail,type GenerationTaskResult} from '../../../../generationTask';
import type {CanvasNodeData} from '../../sharedImports';
import {api,getImageGenerationPlaceholderSize,getScroller,planOutgoingResultPoints,spawnCompletedImageResultNode,spawnGenerationResultNode} from '../../sharedImports';
import type {CoreRuntimeContext} from '../context';

export function installPromptMultiResultGeneration(ctx: CoreRuntimeContext) {
  ctx.ensureGenerationResultLoadingNodes = function ensureGenerationResultLoadingNodes(g: Graph, sourceNode: Node, resultNodes: Node[], totalCount: number, config: {
      title: string;
      sourceFileName: string;
      buildFileName: (sourceFileName: string) => string;
      placement?: import('../../../../imageGen').ResultPlacement;
      snapshotSourceNode?: Node;
  }) {
      if (totalCount <= resultNodes.length)
          return;
      const batchPreviewSize = getImageGenerationPlaceholderSize(sourceNode);
      const plannedPoints = planOutgoingResultPoints(g, sourceNode, batchPreviewSize, totalCount, config.placement ?? 'right');
      const snapshotSource = config.snapshotSourceNode ?? resultNodes[0];
      for (let index = resultNodes.length; index < totalCount; index += 1) {
          const node = spawnGenerationResultNode(g, sourceNode, {
              title: config.title,
              fileName: ctx.resolveGenerationResultFileName(config.buildFileName, config.sourceFileName, index, totalCount),
              centerPoint: plannedPoints[index],
              layoutSlot: index,
              layoutTotal: totalCount,
          });
          if (snapshotSource) {
              cloneNodeGenerationSnapshot(snapshotSource, node);
              const sharedTaskId = String((snapshotSource.getData() as CanvasNodeData).generationTaskId ?? '').trim();
              if (sharedTaskId) {
                  bindGenerationTaskId(node, sharedTaskId, 'IMAGE', index);
              }
              else {
                  const data = { ...(node.getData() as CanvasNodeData), generationResultIndex: index };
                  node.setData(data, { overwrite: true });
              }
          }
          resultNodes.push(node);
      }
  };
  
  ctx.distributeMultiImageGenerationResults = async function distributeMultiImageGenerationResults(g: Graph, sourceNode: Node, resultNodes: Node[], allResults: GenerationTaskResult[], config: {
      title: string;
      sourceFileName: string;
      buildFileName: (sourceFileName: string) => string;
      placement?: import('../../../../imageGen').ResultPlacement;
  }): Promise<Node[]> {
      const totalCount = allResults.length;
      if (totalCount <= 1)
          return [];
      ctx.ensureGenerationResultLoadingNodes(g, sourceNode, resultNodes, totalCount, {
          ...config,
          snapshotSourceNode: resultNodes[0],
      });
      const appliedNodes: Node[] = [];
      const failedResults: {
          result: GenerationTaskResult;
          index: number;
      }[] = [];
      for (let index = 1; index < totalCount; index += 1) {
          const node = resultNodes[index];
          const result = allResults[index];
          if (!node || !result)
              continue;
          const data = node.getData() as CanvasNodeData;
          if (data.previewUrl?.trim() && data.imageGenState !== 'loading') {
              appliedNodes.push(node);
              continue;
          }
          const resolved = await resolveGenerationResultPreview(result);
          if (!resolved?.previewUrl?.trim()) {
              failedResults.push({ result, index });
              continue;
          }
          const didApply = await applyGenerationResultToNode(node, resolved, {
              title: config.title,
              fileName: ctx.resolveGenerationResultFileName(config.buildFileName, config.sourceFileName, index, totalCount),
          });
          if (didApply) {
              appliedNodes.push(node);
          }
          else {
              failedResults.push({ result, index });
          }
      }
      for (const item of failedResults) {
          const spawnedNodes = await ctx.spawnNodesForExtraGenerationResults(g, sourceNode, [item.result], {
              title: config.title,
              sourceFileName: config.sourceFileName,
              buildFileName: config.buildFileName,
              resultIndexOffset: item.index,
              totalCount,
              placement: config.placement,
              snapshotSourceNode: resultNodes[0],
          });
          appliedNodes.push(...spawnedNodes);
      }
      // 多结果共享同一 taskId，便于整组执行时只跑一次
      const primary = resultNodes[0];
      const sharedTaskId = primary
          ? String((primary.getData() as CanvasNodeData).generationTaskId ?? '').trim()
          : '';
      if (sharedTaskId) {
          const members: Array<{
              node: Node;
              resultIndex: number;
          }> = [];
          for (let index = 0; index < resultNodes.length; index += 1) {
              const node = resultNodes[index];
              if (!node)
                  continue;
              members.push({ node, resultIndex: index });
          }
          for (const node of appliedNodes) {
              if (members.some((item) => item.node.id === node.id))
                  continue;
              const idx = readGenerationResultIndex(node.getData() as CanvasNodeData);
              members.push({ node, resultIndex: idx });
          }
          bindSharedGenerationTaskId(members, sharedTaskId, 'IMAGE');
      }
      return appliedNodes;
  };
  
  ctx.spawnNodesForExtraGenerationResults = async function spawnNodesForExtraGenerationResults(g: Graph, sourceNode: Node, extraResults: GenerationTaskResult[], config: {
      title: string;
      sourceFileName: string;
      buildFileName: (sourceFileName: string) => string;
      resultIndexOffset: number;
      totalCount: number;
      placement?: import('../../../../imageGen').ResultPlacement;
      snapshotSourceNode?: Node;
  }): Promise<Node[]> {
      const nodes: Node[] = [];
      if (!extraResults.length)
          return nodes;
      const batchPreviewSize = getImageGenerationPlaceholderSize(sourceNode);
      const plannedPoints = planOutgoingResultPoints(g, sourceNode, batchPreviewSize, extraResults.length, config.placement ?? 'right');
      let pointIndex = 0;
      for (let index = 0; index < extraResults.length; index += 1) {
          const resolved = await resolveGenerationResultPreview(extraResults[index]);
          if (!resolved?.previewUrl?.trim())
              continue;
          const node = spawnCompletedImageResultNode(g, sourceNode, {
              title: config.title,
              fileName: ctx.resolveGenerationResultFileName(config.buildFileName, config.sourceFileName, config.resultIndexOffset + index, config.totalCount),
              previewUrl: resolved.previewUrl,
              assetId: resolved.assetId,
              mediaWidth: resolved.width ?? undefined,
              mediaHeight: resolved.height ?? undefined,
              centerPoint: plannedPoints[pointIndex],
          });
          if (config.snapshotSourceNode) {
              cloneNodeGenerationSnapshot(config.snapshotSourceNode, node);
          }
          const sharedTaskId = String(((config.snapshotSourceNode?.getData() as CanvasNodeData | undefined) ??
              (sourceNode.getData() as CanvasNodeData)).generationTaskId ?? '').trim();
          const resultIndex = config.resultIndexOffset + index;
          if (sharedTaskId) {
              bindGenerationTaskId(node, sharedTaskId, 'IMAGE', resultIndex);
          }
          const extraData = { ...(node.getData() as CanvasNodeData) };
          extraData.imageGenState = 'done';
          extraData.imageGenProgress = 100;
          if (!sharedTaskId) {
              extraData.generationResultIndex = resultIndex;
          }
          node.setData(extraData, { overwrite: true });
          pointIndex += 1;
          nodes.push(node);
      }
      return nodes;
  };
  
  ctx.applyToolbarImageGenerationSnapshot = function applyToolbarImageGenerationSnapshot(targetNode: Node, sourceNode: Node, sourceData: CanvasNodeData, config: {
      capabilityCode: string;
      prompt: string;
      parameters: Record<string, unknown>;
      referenceAssetIds?: string[];
      workflowId?: string | number | null;
  }) {
      const provenanceRefs = ctx.getImageDialoguePreviewsForNode(sourceNode.id);
      const provenancePrompt = config.prompt.trim() ||
          sourceData.imageDialogueText?.trim() ||
          sourceData.genPrompt?.trim() ||
          '';
      const provenanceSettings = ctx.normalizeImageDialogueSettings(sourceData.imageDialogueSettings);
      ctx.applyImageDialogueProvenance(targetNode, {
          prompt: provenancePrompt,
          settings: provenanceSettings,
          sourceRefs: provenanceRefs.length
              ? provenanceRefs
              : ctx.seedImageDialogueRefs(sourceData, sourceNode.id),
          generationParams: buildImageGenerationParams({
              prompt: provenancePrompt,
              capabilityCode: config.capabilityCode,
              parameters: config.parameters,
              workflowId: resolveGenerationTaskWorkflowId(config.workflowId) ?? undefined,
              referenceAssetIds: config.referenceAssetIds?.length ? config.referenceAssetIds : undefined,
          }),
      });
  };
  
  ctx.runImageGenerationTask = async function runImageGenerationTask(event: ImageToolbarClickEvent, config: {
      capabilityCode: string;
      title: string;
      prompt?: string;
      workflowId?: string | number | null;
      requireAssetId?: boolean;
      requireSourcePreview?: boolean;
      resultPlacement?: import('../../../../imageGen').ResultPlacement;
      buildFileName: (sourceFileName: string) => string;
      buildParameters: (event: ImageToolbarClickEvent) => Record<string, unknown>;
      resolveReferenceAssetIds?: (event: ImageToolbarClickEvent) => string[];
  }) {
      const requireAssetId = config.requireAssetId !== false;
      if (requireAssetId && !event.assetId) {
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
      const requireSourcePreview = config.requireSourcePreview !== false;
      if (requireSourcePreview && !sourceData.previewUrl)
          return;
      if (sourceData.uploadState === 'uploading')
          return;
      // if (findOutgoingLoadingGenerationNode(g, sourceNodeId)) {
      //   message.info('当前图片已有进行中的生成任务')
      //   return
      // }
      ctx.resetImageDialogue();
      const sourceFileName = sourceData.fileName || sourceData.title || '';
      const capabilityCode = resolveSubmittableCapabilityCode(
          config.capabilityCode,
          IMAGE_GENERAL_CAPABILITY_CODE,
      );
      const taskParameters = config.buildParameters(event);
      const requestedCount = Math.max(1, Math.floor(Number(taskParameters.count)) || 1);
      const singleTaskParameters = { ...taskParameters, count: 1 };
      const resultNodes: Node[] = [];
      const batchPreviewSize = getImageGenerationPlaceholderSize(sourceNode);
      const plannedPoints = planOutgoingResultPoints(g, sourceNode, batchPreviewSize, requestedCount, config.resultPlacement ?? 'right');
      for (let index = 0; index < requestedCount; index += 1) {
          resultNodes.push(spawnGenerationResultNode(g, sourceNode, {
              title: config.title,
              fileName: ctx.resolveGenerationResultFileName(config.buildFileName, sourceFileName, index, requestedCount),
              centerPoint: plannedPoints[index],
          }));
      }
      const referenceAssetIds = config.resolveReferenceAssetIds?.(event) ??
          (event.assetId ? [event.assetId] : []);
      ctx.recordCanvasDescription(config.title, '');
      resultNodes.forEach((resultNode) => {
          ctx.applyToolbarImageGenerationSnapshot(resultNode, sourceNode, sourceData, {
              capabilityCode,
              prompt: config.prompt ?? '',
              parameters: singleTaskParameters,
              referenceAssetIds: referenceAssetIds.length ? referenceAssetIds : undefined,
              workflowId: config.workflowId,
          });
      });
      const primaryNode = resultNodes[0];
      ctx.selectedNodeId.value = primaryNode.id;
      ctx.selectedKind.value = 'image';
      ctx.syncNodeSelectionHighlight(primaryNode.id);
      ctx.syncNodeCount();
      ctx.bumpToolbarRevision();
      ctx.updateNodeToolbar();
      ctx.scheduleHistoryPush();
      const distributionConfig = {
          title: config.title,
          sourceFileName,
          buildFileName: config.buildFileName,
          placement: config.resultPlacement,
      };
      const runners = resultNodes.map((resultNode, index) => {
          const fileName = ctx.resolveGenerationResultFileName(config.buildFileName, sourceFileName, index, requestedCount);
          return startImageGenerationOnNode(resultNode, {
              title: config.title,
              fileName,
              createTask: async () => {
                  const idempotencyKey = typeof crypto !== 'undefined' && 'randomUUID' in crypto
                      ? crypto.randomUUID()
                      : `gen-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 8)}`;
                  const created = await api.createGenerationTask<GenerationTaskDetail>({
                      taskType: 'IMAGE',
                      capabilityCode,
                      prompt: config.prompt?.trim() ?? '',
                      parameters: singleTaskParameters,
                      projectId: ctx.activeProjectId.value,
                      nodeId: resultNode.id,
                      referenceAssetIds: referenceAssetIds.length ? referenceAssetIds : undefined,
                      workflowId: resolveGenerationTaskWorkflowId(config.workflowId),
                  }, idempotencyKey);
                  ctx.userInfoStore.queryPointAccount();
                  return created;
              },
              onTaskCreated: (created) => {
                  if (index !== 0)
                      return;
                  const apiResultCount = pickImageGenerationResults(created).length;
                  if (apiResultCount <= 1)
                      return;
                  ctx.ensureGenerationResultLoadingNodes(g, sourceNode, resultNodes, apiResultCount, {
                      ...distributionConfig,
                      snapshotSourceNode: primaryNode,
                  });
                  ctx.syncNodeCount();
                  ctx.bumpToolbarRevision();
                  ctx.updateNodeToolbar();
              },
              onTaskBound: () => ctx.persistGenerationTaskBinding(resultNode, {
                  detail: config.prompt?.trim() ||
                      (resultNode.getData() as CanvasNodeData).genPrompt?.trim() ||
                      config.title,
                  taskType: config.title,
              }),
              onError: (reason) => message.error(reason),
              onComplete: async (result) => {
                  ctx.resetSourceImageDialogueAfterSuccess(sourceNode, resultNode, result);
                  if (!result.success || index !== 0)
                      return;
                  const allResults = result.allResults ?? [];
                  if (allResults.length <= 1)
                      return;
                  const extraNodes = await ctx.distributeMultiImageGenerationResults(g, sourceNode, resultNodes, allResults, distributionConfig);
                  if (!extraNodes.length)
                      return;
                  ctx.syncNodeCount();
                  ctx.bumpToolbarRevision();
                  ctx.updateNodeToolbar();
                  ctx.scheduleHistoryPush();
                  nextTick(() => {
                      const scroller = getScroller(g);
                      if (!scroller)
                          return;
                      const boxes = [primaryNode, ...extraNodes].map((node) => node.getBBox());
                      const minX = Math.min(...boxes.map((box) => box.x));
                      const maxX = Math.max(...boxes.map((box) => box.x + box.width));
                      const minY = Math.min(...boxes.map((box) => box.y));
                      const maxY = Math.max(...boxes.map((box) => box.y + box.height));
                      scroller.transitionToPoint((minX + maxX) / 2, (minY + maxY) / 2, {
                          duration: '280ms',
                      });
                  });
              },
          });
      });
      try {
          const outcomes = await Promise.allSettled(runners);
          const started = outcomes.some((outcome) => outcome.status === 'fulfilled' && outcome.value.started);
          if (!started)
              return;
          ctx.resetImageDialogue();
      }
      catch (error) {
          resultNodes.forEach((node) => markGenerationNodeFailed(node));
          message.error(isRequestError(error) ? error.message : '生成失败，请稍后重试');
      }
  };
}
