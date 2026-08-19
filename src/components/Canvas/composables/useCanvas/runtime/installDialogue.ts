/**
 * 职责：安装 Dialogue 域的真实画布业务实现。
 * 依赖：共享 ctx（bind 状态与跨域惰性函数）；不导入其他安装器。
 * 副作用：向 ctx 注册方法/派生状态，部分域会绑定监听或更新画布状态。
 */
import {isRequestError} from '@/utils/request';
import type {Node} from '@antv/x6';
import {message} from 'ant-design-vue';
import {nextTick,provide} from 'vue';
import {createDefaultVideoDialogueSettings,IMAGE_GENERAL_CAPABILITY_CODE,isNodeFileUploading,resolveGenerationTaskWorkflowId,resolveImageAssetId,toVideoApiClarity,VIDEO_GENERAL_CAPABILITY_CODE,type ImageDialogueSubmitPayload,type VideoDialogueSubmitPayload} from '../../../constants';
import {buildImageGenerationParams,buildTextGenerationParams,imageDialogueSettingsFromPayload,persistNodeGenerationSnapshot} from '../../../generationParams';
import {bindGenerationTaskId,followTextGenerationTaskOnNode,markTextGenerationNodeFailed,markVideoGenerationNodeFailed,normalizeGenerationTaskDetail,runImageGenerationOnNode,startImageGenerationOnNode,startVideoGenerationTaskFollow,type GenerationTaskDetail} from '../../../generationTask';
import {createIdempotencyKey} from '../../../idempotency';
import {toVideoApiPrompt} from '../../../promptMention';
import {getBoundingBoxCenter} from '../../../viewport';
import type {CanvasNodeData} from '.././sharedImports';
import {api,getNodeSize,getScroller,isImageGenerationFailedNode,isVideoGenerationFailedNode,planOutgoingResultPoints,prepareImageNodeForInPlaceGeneration,resetImageGenerationNodeForRetry,resolveText2ImageGenerationTargetNode,runUploadSimulation,spawnGenerationResultNode,spawnVideoGenerationResultNode,syncTextNodeImageSource} from '.././sharedImports';
import type {CoreRuntimeContext} from './context';
import {installDialoguePromptFieldState} from './dialogue/promptFieldState';
import {installDialogueElementMarkMode} from './dialogue/elementMarkMode';

export function installDialogue(ctx: CoreRuntimeContext) {
  installDialoguePromptFieldState(ctx);
  installDialogueElementMarkMode(ctx);

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
  
  ctx.openVideoGenPromptBar = function openVideoGenPromptBar(nodeId: string, tab: string = 'text2video') {
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
  
}
