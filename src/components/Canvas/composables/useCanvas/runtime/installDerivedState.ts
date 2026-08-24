/**
 * 职责：安装 DerivedState 域的真实画布业务实现。
 * 依赖：共享 ctx（bind 状态与跨域惰性函数）；不导入其他安装器。
 * 副作用：向 ctx 注册方法/派生状态，部分域会绑定监听或更新画布状态。
 */
import type { Node } from '@antv/x6';
import { useUserInfo } from '@stores/useUserInfo';
import { message } from 'ant-design-vue';
import { computed,ref } from 'vue';
import { hasPersistedImageDialogueProvenance,isPendingImageGenDialogueTarget,isVideoNodeGenerating,toVideoApiClarity,VIDEO_GENERAL_CAPABILITY_CODE,type VideoDialogueSettings,type VideoGenAspectRatio,type VideoGenDuration,type VideoGenResolution } from '../../../constants';
import { buildVideoGenerationParams,persistNodeGenerationSnapshot } from '../../../generationParams';
import { areAllGridSplitResultNodes } from '../../../gridSplitUtils';
import { collectDialogueElementMarks,isImageMarkAnalyzing } from '../../../imageMarkUtils';
import { filterUploadFiles as filterUploadFilesHelper,isImageUploadFile as isImageUploadFileHelper,isVideoUploadFile as isVideoUploadFileHelper,normalizeCutoutMode as normalizeCutoutModeHelper,plainTextToEditorHtml as plainTextToEditorHtmlHelper,resolveGenerationResultFileName as resolveGenerationResultFileNameHelper,resolveVideoResultLayoutSize as resolveVideoResultLayoutSizeHelper,} from '.././coreHelpers';
import type { CanvasNodeData,ImageSourceRef,UserMenuKey } from '.././sharedImports';
import { collectUpstreamImageSourceRefs,getCanvasBgThemeMeta,getCompleteGroupSelection,getGroupSelectionForNodeIds,getVideoSourceRefs,getVideoTextSourceRefs,hydrateImageNodeDimensions,isVideoGenerationFailedNode,resolveVideoSourceRefsForNode,toPersistedVideoSourceRefs } from '.././sharedImports';
import type { CoreRuntimeContext } from './context';

export function installDerivedState(ctx: CoreRuntimeContext) {
  // 端口由薄装配壳创建；运行时只持有同一对象的惰性引用。
  void ctx.ports;
  
  ctx.normalizeCutoutMode = normalizeCutoutModeHelper;
  
  ctx.resolveGenerationResultFileName = resolveGenerationResultFileNameHelper;
  
  ctx.resolveVideoResultLayoutSize = resolveVideoResultLayoutSizeHelper;
  
  ctx.plainTextToEditorHtml = plainTextToEditorHtmlHelper;
  
  ctx.isImageUploadFile = isImageUploadFileHelper;
  
  ctx.isVideoUploadFile = isVideoUploadFileHelper;
  
  ctx.filterUploadFiles = filterUploadFilesHelper;
  
  ctx.userInfoStore = useUserInfo();
  
  ctx.activeImageDialogueNodeId = '';
  
  ctx.activeVideoDialogueNodeId = '';
  
  ctx.lastCanvasFileInputClickAt = 0;
  
  ctx.CANVAS_FILE_INPUT_CLICK_DEBOUNCE_MS = 400;
  
  ctx.scrollerScrollTarget = null;
  
  ctx.videoToolbarDeferTimer = null;
  
  ctx.videoToolbarClickDeferred = ref(false);
  
  ctx.imageMarkRecognizing = ref(false);
  
  ctx.imageMarkCoordinateOnly = ref(true);
  
  ctx.selectedElementMarkId = ref('');
  
  ctx.cancelVideoToolbarDefer = function cancelVideoToolbarDefer() {
      if (ctx.videoToolbarDeferTimer) {
          clearTimeout(ctx.videoToolbarDeferTimer);
          ctx.videoToolbarDeferTimer = null;
      }
      ctx.videoToolbarClickDeferred.value = false;
  };
  
  ctx.toggleUserMenu = function toggleUserMenu() {
      ctx.showUserMenu.value = !ctx.showUserMenu.value;
  };
  
  ctx.closeUserMenu = function closeUserMenu() {
      ctx.showUserMenu.value = false;
  };
  
  ctx.goUserCenter = function goUserCenter() {
      ctx.closeUserMenu();
      ctx.router.push({ name: 'userInfo' });
  };
  
  ctx.openComboModal = function openComboModal() {
      ctx.closeUserMenu();
      ctx.modalStore.openModal('combo');
  };
  
  ctx.handleUserMenuAction = function handleUserMenuAction(key: UserMenuKey) {
      ctx.closeUserMenu();
      if (key === 'assets') {
          ctx.router.push({ name: 'userInfo' });
          return;
      }
      if (key === 'UserAgreement' || key === 'PrivacyPolicy') {
          const { href } = ctx.router.resolve({ name: 'pdf', query: { type: key } });
          window.open(href, '_blank');
          return;
      }
  };
  
  ctx.handleLogout = function handleLogout() {
      ctx.closeUserMenu();
      ctx.modalStore.openModal('login');
  };
  
  ctx.zoomPercent = computed(() => `${Math.round(ctx.zoomLevel.value * 100)}%`);
  
  ctx.currentProjectName = computed(() => ctx.canvasProjects.value.find((project) => project.id === ctx.activeProjectId.value)?.title ?? '未命名创作');
  
  ctx.canvasBgThemeLabel = computed(() => getCanvasBgThemeMeta(ctx.canvasBgTheme.value).label);
  
  ctx.activeGroupSelection = computed(() => {
      void ctx.toolbarRevision.value;
      const g = ctx.graph.value;
      if (!g || ctx.selectedNodeIds.value.length < 2)
          return null;
      return getCompleteGroupSelection(g, ctx.selectedNodeIds.value);
  });
  
  ctx.overlayGroupSelection = computed(() => {
      void ctx.toolbarRevision.value;
      const g = ctx.graph.value;
      if (!g || !ctx.selectedNodeIds.value.length)
          return null;
      return getGroupSelectionForNodeIds(g, ctx.selectedNodeIds.value);
  });
  
  ctx.showGroupOverlay = computed(() => {
      if (ctx.imagePreviewUrl.value)
          return false;
      return ctx.groupOverlayItems.value.length > 0;
  });
  
  ctx.showGroupToolbar = computed(() => {
      if (ctx.imagePreviewUrl.value)
          return false;
      const group = ctx.activeGroupSelection.value;
      if (!group)
          return false;
      const g = ctx.graph.value;
      if (g && areAllGridSplitResultNodes(g, group.nodeIds))
          return false;
      return true;
  });
  
  ctx.showMultiSelectToolbar = computed(() => {
      if (ctx.selectedNodeIds.value.length < 2 || ctx.showGroupToolbar.value || ctx.imagePreviewUrl.value) {
          return false;
      }
      const g = ctx.graph.value;
      if (g && areAllGridSplitResultNodes(g, ctx.selectedNodeIds.value))
          return false;
      return true;
  });
  
  ctx.showPromptBar = computed(() => {
      if (ctx.showMultiSelectToolbar.value || ctx.showGroupToolbar.value)
          return false;
      const id = ctx.activePickerNodeId.value;
      if (!id || ctx.nodeCount.value === 0 || ctx.showImageCrop.value || ctx.showImageGridSplit.value || ctx.showImageErase.value || ctx.showImageInpaint.value || ctx.showImageExpand.value || ctx.showImageEditText.value)
          return false;
      return true;
  });
  
  ctx.showImageGenPromptBar = computed(() => !ctx.showMultiSelectToolbar.value &&
      !ctx.showGroupToolbar.value &&
      Boolean(ctx.activeImageGenPromptNodeId.value) &&
      ctx.nodeCount.value > 0 &&
      !ctx.showImageCrop.value &&
      !ctx.showImageGridSplit.value &&
      !ctx.showImageErase.value &&
      !ctx.showImageInpaint.value &&
      !ctx.showImageExpand.value &&
      !ctx.showImageEditText.value);
  
  ctx.showVideoGenPromptBar = computed(() => {
      if (ctx.showMultiSelectToolbar.value ||
          ctx.showGroupToolbar.value ||
          !ctx.activeVideoGenPromptNodeId.value ||
          ctx.nodeCount.value === 0 ||
          ctx.showImageCrop.value ||
          ctx.showImageGridSplit.value ||
          ctx.showImageErase.value ||
          ctx.showImageInpaint.value ||
          ctx.showImageExpand.value ||
          ctx.showImageEditText.value) {
          return false;
      }
      const g = ctx.graph.value;
      const id = ctx.activeVideoGenPromptNodeId.value;
      if (g && id) {
          const data = g.getCellById(id)?.getData() as CanvasNodeData | undefined;
          if (isVideoNodeGenerating(data))
              return false;
      }
      return true;
  });
  
  ctx.showVideoDialoguePanel = computed(() => {
      if (!ctx.showVideoDialogue.value || ctx.selectedKind.value !== 'video')
          return false;
      const g = ctx.graph.value;
      const id = ctx.selectedNodeId.value;
      if (!g || !id)
          return ctx.showVideoDialogue.value;
      const data = g.getCellById(id)?.getData() as CanvasNodeData | undefined;
      if (isVideoNodeGenerating(data))
          return false;
      return true;
  });
  
  ctx.videoGenSourceRefs = computed(() => {
      void ctx.toolbarRevision.value;
      const g = ctx.graph.value;
      const id = ctx.activeVideoGenPromptNodeId.value;
      if (!g || !id)
          return [];
      const cell = g.getCellById(id);
      const data = cell?.isNode() ? (cell.getData() as CanvasNodeData) : undefined;
      const imageRefs = resolveVideoSourceRefsForNode(g, id, data?.videoSourceRefs, isVideoGenerationFailedNode(data));
      if (imageRefs.length) {
          return imageRefs.map((ref) => ({ ...ref, kind: ref.kind ?? 'image' }));
      }
      if (ctx.videoGenActiveTab.value === 'text2video') {
          return [];
      }
      return getVideoTextSourceRefs(g, id, ctx.getTextNodePlainContent);
  });
  
  ctx.imageGenSourceRefs = computed(() => {
      void ctx.toolbarRevision.value;
      const g = ctx.graph.value;
      const id = ctx.activeImageGenPromptNodeId.value;
      if (!g || !id)
          return [];
      const textRefs = getVideoTextSourceRefs(g, id, ctx.getTextNodePlainContent);
      if (textRefs.length)
          return textRefs;
      const cell = g.getCellById(id);
      const data = cell?.isNode() ? (cell.getData() as CanvasNodeData) : undefined;
      if (data?.sourcePreviewUrl) {
          return [{
                  nodeId: data.sourceNodeId ?? '',
                  kind: 'image' as const,
                  previewUrl: data.sourcePreviewUrl,
                  fileName: data.sourceFileName ?? '',
                  title: data.title || '图片',
                  index: 1,
              }];
      }
      return [];
  });
  
  ctx.videoGenSavedSettings = computed(() => {
      void ctx.toolbarRevision.value;
      const g = ctx.graph.value;
      const id = ctx.activeVideoGenPromptNodeId.value;
      if (!g || !id)
          return undefined;
      const data = g.getCellById(id)?.getData() as CanvasNodeData | undefined;
      // 节点上可能存 Partial；对外契约与 CanvasBindings 保持 VideoDialogueSettings
      return data?.videoDialogueSettings as import('../../../constants').VideoDialogueSettings | undefined;
  });
  
  ctx.videoDialogueSourceRefs = computed(() => {
      void ctx.toolbarRevision.value;
      const g = ctx.graph.value;
      const id = ctx.showVideoDialogue.value && ctx.selectedKind.value === 'video' ? ctx.selectedNodeId.value : '';
      if (!g || !id)
          return [];
      const data = g.getCellById(id)?.getData() as CanvasNodeData | undefined;
      // 对话框优先展示生成溯源快照
      return resolveVideoSourceRefsForNode(g, id, data?.videoSourceRefs, true);
  });
  
  ctx.syncVideoSourceRefsSnapshot = function syncVideoSourceRefsSnapshot(nodeId: string, options?: {
      force?: boolean;
  }) {
      const g = ctx.graph.value;
      if (!g || !nodeId)
          return;
      const cell = g.getCellById(nodeId);
      if (!cell?.isNode())
          return;
      const data = { ...(cell.getData() as CanvasNodeData) };
      if (data.kind !== 'video')
          return;
      const livePersisted = toPersistedVideoSourceRefs(getVideoSourceRefs(g, nodeId));
      const stored = Array.isArray(data.videoSourceRefs) ? data.videoSourceRefs : [];
      if (options?.force) {
          data.videoSourceRefs = livePersisted;
      }
      else if (!data.previewUrl || !stored.length) {
          // 未成片或尚无快照：以当前连线为准
          data.videoSourceRefs = livePersisted;
      }
      else {
          // 已成片：合并追加新连线，不因画布删线收缩溯源
          const map = new Map(stored.map((item) => [item.nodeId, { ...item }]));
          for (const ref of livePersisted) {
              map.set(ref.nodeId, ref);
          }
          data.videoSourceRefs = Array.from(map.values());
      }
      cell.setData(data, { overwrite: true });
  };
  
  ctx.buildVideoDialogueSettingsFromPayload = function buildVideoDialogueSettingsFromPayload(payload: {
      model: string;
      ratio: string;
      clarity: string;
      duration: number;
      generateAudio: boolean;
      videoCount: number;
      mode: VideoDialogueSettings['mode'];
  }): VideoDialogueSettings {
      return {
          modelKey: payload.model,
          aspectRatio: payload.ratio as VideoGenAspectRatio,
          resolution: payload.clarity as VideoGenResolution,
          duration: payload.duration as VideoGenDuration,
          generateAudio: payload.generateAudio,
          videoCount: payload.videoCount,
          mode: payload.mode,
      };
  };
  
  ctx.applyVideoGenerationProvenance = function applyVideoGenerationProvenance(node: Node, payload: {
      prompt: string;
      model: string;
      ratio: string;
      clarity: string;
      duration: number;
      generateAudio: boolean;
      videoCount: number;
      mode: VideoDialogueSettings['mode'];
  }, sourceRefs?: ReturnType<typeof getVideoSourceRefs>, extra?: {
      capabilityCode?: string;
      parameters?: Record<string, unknown>;
      referenceAssetIds?: string[];
  }) {
      const g = ctx.graph.value;
      const refs = sourceRefs ??
          (g ? getVideoSourceRefs(g, node.id) : []);
      const settings = ctx.buildVideoDialogueSettingsFromPayload(payload);
      const parameters = extra?.parameters ?? {
          mode: payload.mode,
          model: payload.model,
          ratio: payload.ratio,
          clarity: toVideoApiClarity(payload.clarity),
          duration: payload.duration,
          generateAudio: payload.generateAudio,
          videoCount: payload.videoCount,
      };
      persistNodeGenerationSnapshot(node, {
          ...buildVideoGenerationParams({
              prompt: payload.prompt,
              capabilityCode: extra?.capabilityCode ?? VIDEO_GENERAL_CAPABILITY_CODE,
              parameters,
              referenceAssetIds: extra?.referenceAssetIds,
          }),
          videoDialogueText: payload.prompt,
          videoDialogueSettings: settings,
          videoSourceRefs: toPersistedVideoSourceRefs(refs),
          genPrompt: payload.prompt,
      });
      node.setData({
          ...(node.getData() as CanvasNodeData),
          videoGenAspectRatio: payload.ratio as VideoGenAspectRatio,
      }, { overwrite: true });
  };
  
  ctx.getActiveVideoTargetNodeId = function getActiveVideoTargetNodeId() {
      if (ctx.activeVideoGenPromptNodeId.value)
          return ctx.activeVideoGenPromptNodeId.value;
      if (ctx.showVideoDialogue.value && ctx.selectedKind.value === 'video' && ctx.selectedNodeId.value) {
          return ctx.selectedNodeId.value;
      }
      return '';
  };
  
  ctx.showImageCreativeToolbar = computed(() => {
      void ctx.toolbarRevision.value;
      if (!ctx.showElementSelectMode.value)
          return false;
      if (ctx.selectedKind.value !== 'image' || !ctx.selectedNodeId.value)
          return false;
      return ctx.canShowImageToolbar(ctx.getSelectedNodeData());
  });
  
  ctx.showElementSelectBar = computed(() => false);
  
  ctx.showTextFormatToolbar = computed(() => {
      void ctx.toolbarRevision.value;
      if (ctx.showMultiSelectToolbar.value || ctx.showGroupToolbar.value)
          return false;
      if (!ctx.selectedNodeId.value ||
          !ctx.textEditorToolbarActive.value ||
          ctx.showConnectMenu.value ||
          ctx.showPromptBar.value ||
          ctx.showImageCrop.value ||
          ctx.showImageGridSplit.value ||
          ctx.showImageErase.value ||
          ctx.showImageInpaint.value ||
          ctx.showImageExpand.value ||
          ctx.showImageEditText.value ||
          ctx.textExpandOpen.value) {
          return false;
      }
      const data = ctx.getSelectedNodeData();
      return (data?.kind === 'text' &&
          data.mode === 'editor' &&
          data.textGenState !== 'loading');
  });
  
  ctx.isImg2PromptTask = computed(() => {
      void ctx.toolbarRevision.value;
      const id = ctx.activePickerNodeId.value;
      if (!id)
          return false;
      const data = ctx.graph.value?.getCellById(id)?.getData() as CanvasNodeData | undefined;
      return data?.textPickerTask === 'img2prompt' || ctx.modelType.value === 'img2prompt';
  });
  
  ctx.isText2VideoTask = computed(() => {
      void ctx.toolbarRevision.value;
      const id = ctx.activePickerNodeId.value;
      if (!id)
          return false;
      const data = ctx.graph.value?.getCellById(id)?.getData() as CanvasNodeData | undefined;
      return data?.textPickerTask === 'text2video' || ctx.modelType.value === 'text2video';
  });
  
  ctx.isText2ImageTask = computed(() => {
      void ctx.toolbarRevision.value;
      const id = ctx.activePickerNodeId.value;
      if (!id)
          return false;
      const data = ctx.graph.value?.getCellById(id)?.getData() as CanvasNodeData | undefined;
      return data?.textPickerTask === 'text2image' || ctx.modelType.value === 'text2image';
  });
  
  ctx.promptSubmitLabel = computed(() => {
      if (ctx.isText2VideoTask.value || ctx.modelType.value === 'text2video')
          return '文生视频';
      if (ctx.isText2ImageTask.value || ctx.modelType.value === 'text2image')
          return '文生图';
      if (ctx.isImg2PromptTask.value || ctx.modelType.value === 'img2prompt')
          return '反推提示词';
      return '自由创作';
  });
  
  ctx.canSubmitTextPrompt = computed(() => {
      const hasPrompt = Boolean(ctx.promptText.value.trim());
      if (ctx.isImg2PromptTask.value) {
          return Boolean(ctx.promptSourcePreviewUrl.value) && !ctx.promptSubmitting.value;
      }
      if (ctx.isText2VideoTask.value || ctx.isText2ImageTask.value) {
          return hasPrompt;
      }
      return hasPrompt && !ctx.promptSubmitting.value;
  });
  
  ctx.imageCropSource = computed(() => {
      const data = ctx.getSelectedNodeData();
      if (!data?.previewUrl || !data.mediaWidth || !data.mediaHeight)
          return null;
      return {
          previewUrl: data.previewUrl,
          mediaWidth: data.mediaWidth,
          mediaHeight: data.mediaHeight,
      };
  });
  
  ctx.imageGridSplitSource = computed(() => {
      const g = ctx.graph.value;
      const id = ctx.gridSplitSourceNodeId.value || ctx.selectedNodeId.value;
      if (!g || !id)
          return null;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return null;
      const data = cell.getData() as CanvasNodeData;
      if (!data?.previewUrl || !data.mediaWidth || !data.mediaHeight)
          return null;
      return {
          previewUrl: data.previewUrl,
          mediaWidth: data.mediaWidth,
          mediaHeight: data.mediaHeight,
      };
  });
  
  ctx.imageEraseSource = computed(() => {
      const g = ctx.graph.value;
      const id = ctx.eraseSourceNodeId.value || ctx.selectedNodeId.value;
      if (!g || !id)
          return null;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return null;
      const data = cell.getData() as CanvasNodeData;
      if (!data?.previewUrl || !data.mediaWidth || !data.mediaHeight)
          return null;
      return {
          previewUrl: data.previewUrl,
          mediaWidth: data.mediaWidth,
          mediaHeight: data.mediaHeight,
      };
  });
  
  ctx.imageInpaintSource = computed(() => {
      const g = ctx.graph.value;
      const id = ctx.inpaintSourceNodeId.value || ctx.selectedNodeId.value;
      if (!g || !id)
          return null;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return null;
      const data = cell.getData() as CanvasNodeData;
      if (!data?.previewUrl || !data.mediaWidth || !data.mediaHeight)
          return null;
      return {
          previewUrl: data.previewUrl,
          mediaWidth: data.mediaWidth,
          mediaHeight: data.mediaHeight,
      };
  });
  
  ctx.imageExpandSource = computed(() => {
      const g = ctx.graph.value;
      const id = ctx.expandSourceNodeId.value || ctx.selectedNodeId.value;
      if (!g || !id)
          return null;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return null;
      const data = cell.getData() as CanvasNodeData;
      if (!data?.previewUrl || !data.mediaWidth || !data.mediaHeight)
          return null;
      return {
          previewUrl: data.previewUrl,
          mediaWidth: data.mediaWidth,
          mediaHeight: data.mediaHeight,
      };
  });
  
  ctx.buildNodeSelfDialogueRef = function buildNodeSelfDialogueRef(data: CanvasNodeData, nodeId: string): ImageSourceRef | null {
      const previewUrl = data.previewUrl?.trim();
      if (!previewUrl)
          return null;
      return {
          nodeId,
          assetId: data.assetId,
          previewUrl,
          fileName: data.fileName || data.title || '',
      };
  };
  
  ctx.isDigitalHumanDialogueRef = function isDigitalHumanDialogueRef(item: ImageSourceRef): boolean {
      return String(item.nodeId ?? '').startsWith('digital-human-');
  };
  
  ctx.enrichImageSourceRefPreview = function enrichImageSourceRefPreview(item: ImageSourceRef): ImageSourceRef {
      if (item.previewUrl?.trim())
          return item;
      const g = ctx.graph.value;
      const refId = String(item.nodeId ?? '').trim();
      if (!g || !refId)
          return item;
      const cell = g.getCellById(refId);
      if (!cell?.isNode())
          return item;
      const data = cell.getData() as CanvasNodeData;
      const previewUrl = data.previewUrl?.trim();
      if (!previewUrl)
          return item;
      return {
          ...item,
          previewUrl,
          assetId: item.assetId || data.assetId,
          fileName: item.fileName || data.fileName || data.title || '',
      };
  };
  
  ctx.resolveImageDialogueRefs = function resolveImageDialogueRefs(data: CanvasNodeData, targetNodeId: string): ImageSourceRef[] {
      const existing = Array.isArray(data.imageSourceRefs)
          ? data.imageSourceRefs
              .map(ctx.enrichImageSourceRefPreview)
              .filter((item) => item.previewUrl?.trim())
          : [];
      // 生成结果节点：保留持久化的图生图输入参考图，不因自身已有预览而折叠为仅自己
      if (hasPersistedImageDialogueProvenance(data) && existing.length) {
          const selfRef = ctx.buildNodeSelfDialogueRef(data, targetNodeId);
          const onlySelfPersisted = selfRef &&
              existing.length === 1 &&
              (existing[0].nodeId === targetNodeId || existing[0].previewUrl === selfRef.previewUrl);
          if (onlySelfPersisted &&
              data.sourceNodeId &&
              data.sourceNodeId !== targetNodeId &&
              data.sourcePreviewUrl?.trim()) {
              return [{
                      nodeId: data.sourceNodeId,
                      assetId: data.sourceAssetId,
                      previewUrl: data.sourcePreviewUrl,
                      fileName: data.sourceFileName ?? '',
                  }];
          }
          return existing.map((item) => ({
              nodeId: item.nodeId,
              assetId: item.assetId,
              previewUrl: item.previewUrl,
              fileName: item.fileName ?? '',
          }));
      }
      const selfRef = ctx.buildNodeSelfDialogueRef(data, targetNodeId);
      if (selfRef) {
          const digitalHumanRefs = existing.filter(ctx.isDigitalHumanDialogueRef);
          const lineageId = data.sourceNodeId && data.sourceNodeId !== targetNodeId
              ? data.sourceNodeId
              : '';
          const lineageUrl = lineageId ? (data.sourcePreviewUrl?.trim() || '') : '';
          const nonSelf = existing.filter((item) => item.nodeId !== targetNodeId &&
              item.previewUrl !== selfRef.previewUrl &&
              !ctx.isDigitalHumanDialogueRef(item));
          const isLineageRef = (item: ImageSourceRef) => Boolean((lineageId && item.nodeId === lineageId) ||
              (lineageUrl && item.previewUrl === lineageUrl));
          // 只有溯源父节点、或无法识别 lineage 时的单张上游图 → 不展示
          const onlyUpstream = nonSelf.length > 0 &&
              (nonSelf.every(isLineageRef) || (!lineageId && nonSelf.length === 1));
          if (!nonSelf.length || onlyUpstream) {
              return digitalHumanRefs.length ? [selfRef, ...digitalHumanRefs] : [selfRef];
          }
          const extras = nonSelf.filter((item) => !isLineageRef(item));
          const mergedExtras = [
              ...extras,
              ...digitalHumanRefs.filter((item) => !extras.some((extra) => extra.assetId === item.assetId)),
          ];
          return mergedExtras.length ? [selfRef, ...mergedExtras] : [selfRef];
      }
      if (existing.length) {
          return existing.map((item) => ({
              nodeId: item.nodeId,
              assetId: item.assetId,
              previewUrl: item.previewUrl,
              fileName: item.fileName ?? '',
          }));
      }
      if (data.sourceNodeId && data.sourcePreviewUrl) {
          return [{
                  nodeId: data.sourceNodeId,
                  assetId: data.sourceAssetId,
                  previewUrl: data.sourcePreviewUrl,
                  fileName: data.sourceFileName ?? '',
              }];
      }
      return [];
  };
  
  ctx.getImageDialoguePreviewsForNode = function getImageDialoguePreviewsForNode(nodeId: string): ImageSourceRef[] {
      const g = ctx.graph.value;
      const cell = g?.getCellById(nodeId);
      if (!cell?.isNode())
          return [];
      const data = cell.getData() as CanvasNodeData;
      return ctx.resolveImageDialogueRefs(data, nodeId);
  };
  
  ctx.imageDialoguePreviews = computed<ImageSourceRef[]>(() => {
      void ctx.toolbarRevision.value;
      let id = '';
      if (ctx.showImageDialogue.value) {
          id = ctx.activeImageDialogueNodeId || (ctx.selectedKind.value === 'image' ? ctx.selectedNodeId.value : '');
      }
      else if (ctx.activeImageGenPromptNodeId.value) {
          id = ctx.activeImageGenPromptNodeId.value;
      }
      else {
          id = ctx.selectedNodeId.value;
      }
      if (!id)
          return [];
      return ctx.getImageDialoguePreviewsForNode(id);
  });
  
  ctx.imageDialogueHideWorkflowAndMark = computed(() => {
      void ctx.toolbarRevision.value;
      if (!ctx.showImageDialogue.value)
          return false;
      const id = ctx.getActiveImageDialogueTargetNodeId();
      if (!id)
          return false;
      const g = ctx.graph.value;
      const data = g?.getCellById(id)?.getData() as CanvasNodeData | undefined;
      return isPendingImageGenDialogueTarget(data);
  });

  ctx.imageDialogueWorkflowDisabled = computed(() => {
      void ctx.toolbarRevision.value;
      const g = ctx.graph.value;
      let id = '';
      if (ctx.showImageDialogue.value) {
          id = ctx.activeImageDialogueNodeId
              || (ctx.selectedKind.value === 'image' ? ctx.selectedNodeId.value : '');
      }
      else if (ctx.activeImageGenPromptNodeId.value) {
          id = ctx.activeImageGenPromptNodeId.value;
      }
      else {
          id = ctx.selectedNodeId.value;
      }
      if (!g || !id)
          return false;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return false;
      const data = cell.getData() as CanvasNodeData;
      return collectUpstreamImageSourceRefs(g, id, data).length > 1;
  });
  
  ctx.imageDialoguePreviewUrl = computed(() => {
      void ctx.toolbarRevision.value;
      const id = ctx.activeImageGenPromptNodeId.value
          || (ctx.showImageDialogue.value
              ? (ctx.activeImageDialogueNodeId || (ctx.selectedKind.value === 'image' ? ctx.selectedNodeId.value : ''))
              : ctx.selectedNodeId.value);
      if (!id)
          return '';
      const data = ctx.graph.value?.getCellById(id)?.getData() as CanvasNodeData | undefined;
      return data?.previewUrl || data?.sourcePreviewUrl || '';
  });
  
  ctx.elementMarks = computed(() => {
      void ctx.toolbarRevision.value;
      const returnId = ctx.elementSelectReturnNodeId.value
          || ctx.activeImageGenPromptNodeId.value
          || (ctx.showImageDialogue.value ? ctx.getActiveImageDialogueTargetNodeId() : '')
          || (ctx.showVideoGenPromptBar.value ? ctx.activeVideoGenPromptNodeId.value : '');
      if (!returnId)
          return [];
      const data = ctx.graph.value?.getCellById(returnId)?.getData() as CanvasNodeData | undefined;
      return collectDialogueElementMarks(data);
  });
  
  ctx.imageMarkAnalyzingActive = computed(() => {
      void ctx.toolbarRevision.value;
      if (ctx.imageMarkRecognizing.value)
          return true;
      const g = ctx.graph.value;
      return Boolean(g && isImageMarkAnalyzing(g));
  });
  
  ctx.showNodeToolbar = computed(() => {
      void ctx.toolbarRevision.value;
      if (ctx.videoToolbarClickDeferred.value)
          return false;
      if (ctx.showVideoGenCanvasPickMode.value || ctx.showImageDialogueCanvasPickMode.value)
          return false;
      if (ctx.showVideoDialogue.value && ctx.selectedKind.value === 'video')
          return false;
      // 左侧素材/工作流/历史打开时隐藏节点操作栏，避免与侧栏叠层
      if (ctx.showAssetsPanel.value || ctx.showAssetCenterPanel.value || ctx.showHistoryPanel.value)
          return false;
      return (Boolean(ctx.selectedNodeId.value) &&
          ctx.selectedNodeIds.value.length <= 1 &&
          !ctx.showGroupToolbar.value &&
          !ctx.imagePreviewUrl.value);
  });
  
  ctx.onGoHome = function onGoHome() {
      ctx.router.push({ name: 'home' });
  };
  
  ctx.getSelectedNodeData = function getSelectedNodeData(): CanvasNodeData | undefined {
      const id = ctx.selectedNodeId.value;
      if (!id)
          return undefined;
      return ctx.graph.value?.getCellById(id)?.getData() as CanvasNodeData | undefined;
  };
  
  ctx.ensureSelectedImageNodeDimensions = async function ensureSelectedImageNodeDimensions(): Promise<CanvasNodeData | null> {
      const g = ctx.graph.value;
      const id = ctx.selectedNodeId.value;
      if (!g || !id)
          return null;
      const cell = g.getCellById(id);
      if (!cell?.isNode())
          return null;
      const data = cell.getData() as CanvasNodeData;
      if (!data.previewUrl?.trim())
          return null;
      if (data.mediaWidth > 0 && data.mediaHeight > 0)
          return data;
      const hydrated = await hydrateImageNodeDimensions(cell as Node);
      if (!hydrated)
          return null;
      ctx.bumpToolbarRevision();
      return cell.getData() as CanvasNodeData;
  };
  
  ctx.ensureImageEditorReady = async function ensureImageEditorReady(actionLabel: string, loadingText = '正在读取图片尺寸...'): Promise<CanvasNodeData | null> {
      const data = ctx.getSelectedNodeData();
      if (!data?.previewUrl) {
          message.warning(`请等待图片加载完成后再${actionLabel}`);
          return null;
      }
      const needsHydration = !(data.mediaWidth > 0 && data.mediaHeight > 0);
      const hideLoading = needsHydration ? message.loading(loadingText, 0) : null;
      try {
          const ready = await Promise.race([
              ctx.ensureSelectedImageNodeDimensions(),
              new Promise<null>((resolve) => {
                  window.setTimeout(() => resolve(null), 15000);
              }),
          ]);
          if (!ready?.mediaWidth || !ready?.mediaHeight) {
              message.warning(needsHydration
                  ? `图片尺寸读取失败，请检查网络后重试`
                  : `请等待图片加载完成后再${actionLabel}`);
              return null;
          }
          return ready;
      }
      finally {
          hideLoading?.();
      }
  };
  
  ctx.isNodeGenerating = function isNodeGenerating(data: CanvasNodeData | undefined) {
      if (!data)
          return false;
      if (data.uploadState === 'uploading')
          return true;
      if (data.imageGenState === 'loading')
          return true;
      if (data.textGenState === 'loading')
          return true;
      return false;
  };
  
  ctx.canShowImageToolbar = function canShowImageToolbar(data: CanvasNodeData | undefined) {
      if (!data || data.kind !== 'image')
          return false;
      if (ctx.isNodeGenerating(data))
          return false;
      if (data.imageGenTask === 'picker')
          return false;
      if (data.imageGenTask === 'img2img' || data.imageGenTask === 'hd')
          return true;
      return data.mode === 'editor';
  };
  
  ctx.canShowVideoToolbar = function canShowVideoToolbar(data: CanvasNodeData | undefined) {
      if (!data || data.kind !== 'video')
          return false;
      if (ctx.isNodeGenerating(data))
          return false;
      if (data.previewUrl)
          return true;
      return data.mode === 'editor';
  };
  
  ctx.bumpToolbarRevision = function bumpToolbarRevision() {
      ctx.toolbarRevision.value += 1;
  };
  
  ctx.setTextEditorToolbarActive = function setTextEditorToolbarActive(active: boolean) {
      if (ctx.textEditorToolbarActive.value === active)
          return;
      ctx.textEditorToolbarActive.value = active;
      ctx.bumpToolbarRevision();
  };
  
  ctx.showToolbarFeatureButtons = computed(() => {
      void ctx.toolbarRevision.value;
      if (ctx.showConnectMenu.value)
          return false;
      const data = ctx.getSelectedNodeData();
      if (ctx.isNodeGenerating(data))
          return false;
      if (ctx.selectedKind.value === 'image' && ctx.selectedNodeId.value) {
          return ctx.canShowImageToolbar(data);
      }
      if (ctx.selectedKind.value === 'video' && ctx.selectedNodeId.value) {
          return ctx.canShowVideoToolbar(data);
      }
      return false;
  });
  
  ctx.isLightNodeToolbar = computed(() => (ctx.selectedKind.value === 'image' || ctx.selectedKind.value === 'video') &&
      ctx.showToolbarFeatureButtons.value);
}
