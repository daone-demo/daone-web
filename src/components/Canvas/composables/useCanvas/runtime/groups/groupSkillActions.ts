// @ts-nocheck -- 动态共享上下文保持原闭包的运行时类型；公开契约仍由 CanvasBindings 校验。
/**
 * 职责：安装 Groups 工具箱 / 分镜 / 下载 / 保存技能动作到 ctx。
 */
import { message } from 'ant-design-vue';
import { createSkillId,listSavedCanvasSkills,mergeCanvasSkill,saveCanvasSkill,type SavedCanvasSkill,} from '../../../../skillStorage';
import { buildGroupSkillMarkdown,extractGroupSubgraph,getGroupScreenBox,mergeStoryboardGroup } from '../../sharedImports';
import type { CoreRuntimeContext } from '../context';

export function installGroupSkillActions(ctx: CoreRuntimeContext) {
  ctx.handleGroupAddToToolbox = function handleGroupAddToToolbox() {
      ctx.showAssetsPanel.value = true;
  };
  
  ctx.handleGroupToStoryboard = function handleGroupToStoryboard() {
      const g = ctx.graph.value;
      const group = ctx.activeGroupSelection.value;
      if (!g || !group)
          return;
      mergeStoryboardGroup(g, group.nodeIds);
      ctx.selectGraphNodes(group.nodeIds);
      ctx.bumpToolbarRevision();
      ctx.scheduleHistoryPush();
  };
  
  ctx.handleGroupBatchDownload = function handleGroupBatchDownload() {
      const group = ctx.activeGroupSelection.value;
      if (!group)
          return;
      void ctx.runBatchDownloadForNodeIds(group.nodeIds);
  };
  
  ctx.handleGroupSaveToSkill = function handleGroupSaveToSkill() {
      const g = ctx.graph.value;
      const group = ctx.activeGroupSelection.value;
      const overlayRoot = ctx.canvasRef.value;
      if (!g || !group || !overlayRoot)
          return;
      const subgraph = extractGroupSubgraph(g, group.nodeIds);
      if (!subgraph) {
          message.warning('当前分组没有可导出的节点');
          return;
      }
      const box = getGroupScreenBox(g, group.nodeIds, overlayRoot);
      ctx.saveSkillItems.value = subgraph.nodes.map((node) => ({
          nodeId: node.id,
          label: node.fileName || node.title || `节点-${node.id.slice(-4)}`,
      }));
      ctx.saveSkillPopoverPos.value = {
          left: box.centerX,
          top: box.anchorTop + box.height / 2,
      };
      ctx.showSaveSkillPopover.value = true;
  };
  
  // 模板直接调用（:existing-skills="listSavedCanvasSkills()"），必须挂到公开面上
  ctx.listSavedCanvasSkills = listSavedCanvasSkills;
  
  ctx.closeSaveSkillPopover = function closeSaveSkillPopover() {
      ctx.showSaveSkillPopover.value = false;
      ctx.saveSkillItems.value = [];
      ctx.saveSkillSubmitting.value = false;
  };
  
  ctx.countSkillFiles = function countSkillFiles(subgraph: NonNullable<ReturnType<typeof extractGroupSubgraph>>) {
      return subgraph.nodes.filter((node) => node.previewUrl || node.fileName).length;
  };
  
  ctx.handleSubmitSaveSkill = async function handleSubmitSaveSkill(payload: {
      tab: 'new' | 'existing';
      name: string;
      role: string;
      description: string;
      tags: string[];
      existingSkillId?: string;
  }) {
      const g = ctx.graph.value;
      const group = ctx.activeGroupSelection.value;
      if (!g || !group || ctx.saveSkillSubmitting.value)
          return;
      const subgraph = extractGroupSubgraph(g, group.nodeIds);
      if (!subgraph)
          return;
      ctx.saveSkillSubmitting.value = true;
      try {
          const fileCount = Math.max(1, ctx.countSkillFiles(subgraph));
          const { content } = buildGroupSkillMarkdown(subgraph, {
              name: payload.name,
              projectName: ctx.currentProjectName.value,
              description: payload.description,
              role: payload.role,
              tags: payload.tags,
          });
          if (payload.tab === 'existing' && payload.existingSkillId) {
              const existing = listSavedCanvasSkills().find((item) => item.id === payload.existingSkillId);
              if (!existing) {
                  message.warning('目标技能不存在');
                  return;
              }
              const mergedWorkflow = {
                  nodes: [...existing.workflow.nodes, ...subgraph.nodes],
                  edges: [...existing.workflow.edges, ...subgraph.edges],
              };
              const mergedMarkdown = buildGroupSkillMarkdown(mergedWorkflow, {
                  name: existing.name,
                  projectName: ctx.currentProjectName.value,
                  description: existing.description,
                  role: existing.role,
                  tags: existing.tags,
              }).content;
              const updated = await mergeCanvasSkill(payload.existingSkillId, {
                  markdown: mergedMarkdown,
                  workflow: mergedWorkflow,
                  addedNodeCount: subgraph.nodes.length,
                  addedFileCount: fileCount,
              });
              if (!updated) {
                  message.warning('加入技能失败');
                  return;
              }
              message.success(`已更新技能「${updated.name}」(含 ${updated.fileCount} 个文件)`);
              ctx.closeSaveSkillPopover();
              return;
          }
          const skill: SavedCanvasSkill = {
              id: createSkillId(),
              name: payload.name,
              role: payload.role,
              description: payload.description,
              tags: payload.tags,
              markdown: content,
              workflow: subgraph,
              nodeCount: subgraph.nodes.length,
              fileCount,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString(),
              projectId: ctx.activeProjectId.value,
          };
          await saveCanvasSkill(skill);
          message.success(`已创建技能「${skill.name}」(含 ${skill.fileCount} 个文件)`);
          ctx.closeSaveSkillPopover();
      }
      catch (error) {
          console.error('[Canvas] save skill failed', error);
          message.error('保存技能失败，请稍后重试');
      }
      finally {
          ctx.saveSkillSubmitting.value = false;
      }
  };
  
}
