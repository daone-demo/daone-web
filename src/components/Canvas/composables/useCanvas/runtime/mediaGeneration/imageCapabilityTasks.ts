/**
 * 职责：安装图片反推提示词与图转 3D 能力任务到 ctx。
 */
import {isRequestError} from '@/utils/request';
import type {Node} from '@antv/x6';
import {message} from 'ant-design-vue';
import {nextTick} from 'vue';
import {buildImageActionResultTitle,type ImageToolbarClickEvent} from '../../../../constants';
import {buildModelGenerationParams,buildTextGenerationParams,persistNodeGenerationSnapshot} from '../../../../generationParams';
import {bindGenerationTaskId,followModelGenerationTaskOnNode,followTextGenerationTaskOnNode,markGenerationNodeFailed,markTextGenerationNodeFailed,normalizeGenerationTaskDetail,type GenerationTaskDetail} from '../../../../generationTask';
import {createIdempotencyKey} from '../../../../idempotency';
import type {CanvasNodeData} from '../../sharedImports';
import {api,getScroller,spawnModel3DResultNode,spawnTextPromptResultNode} from '../../sharedImports';
import type {CoreRuntimeContext} from '../context';

export function installMediaImageCapabilityTasks(ctx: CoreRuntimeContext) {
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
}
