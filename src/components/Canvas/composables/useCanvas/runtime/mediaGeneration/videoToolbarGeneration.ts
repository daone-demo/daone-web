/**
 * 职责：安装 MediaGeneration 视频工具栏生成任务到 ctx。
 */
import {isRequestError} from '@/utils/request';
import type {Node} from '@antv/x6';
import {message} from 'ant-design-vue';
import {type VideoToolbarClickEvent} from '../../../../constants';
import {bindGenerationTaskId,markVideoGenerationNodeFailed,normalizeGenerationTaskDetail,startVideoGenerationTaskFollow,type GenerationTaskDetail} from '../../../../generationTask';
import {createIdempotencyKey} from '../../../../idempotency';
import {toVideoApiPrompt} from '../../../../promptMention';
import type {CanvasNodeData} from '../../sharedImports';
import {api,applyVideoFirstLastFrameParameters,connectGenEdge,findImageToVideoEdge,findReusableVideoGenerationNode,getVideoSourceRefs,planOutgoingResultPoints,resetVideoGenerationNodeForRetry,spawnVideoGenerationResultNode,toPersistedVideoSourceRefs} from '../../sharedImports';
import type {CoreRuntimeContext} from '../context';

export function installMediaVideoToolbarGeneration(ctx: CoreRuntimeContext) {
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
}
