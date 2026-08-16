// @ts-nocheck -- 动态共享上下文保持原闭包的运行时类型；公开契约仍由 CanvasBindings 校验。
/**
 * 职责：安装 Groups 整组布局 / 确认执行 / groupExecuting 到 ctx。
 */
import type { Node } from '@antv/x6';
import { message,Modal } from 'ant-design-vue';
import { h } from 'vue';
import { buildGroupExecuteConfirmContent,coalesceSharedGenerationTasks,collectGroupAiTasks,estimateGroupExecuteCredits,sortGroupAiTasksByDependency,} from '../../../../groupExecute';
import type { GroupLayoutDirection } from '../../sharedImports';
import { fitStoredGroupSelectionBoxToMembers,layoutNodesInGroup } from '../../sharedImports';
import type { CoreRuntimeContext } from '../context';

export function installGroupExecuteConfirm(ctx: CoreRuntimeContext) {
  ctx.handleGroupLayout = function handleGroupLayout(direction: GroupLayoutDirection = 'horizontal') {
      const g = ctx.graph.value;
      const group = ctx.activeGroupSelection.value;
      if (!g || !group)
          return;
      const nodes = group.nodeIds
          .map((id) => g.getCellById(id))
          .filter((cell): cell is Node => cell != null && cell.isNode());
      layoutNodesInGroup(nodes, direction);
      fitStoredGroupSelectionBoxToMembers(g, group.groupId);
      ctx.updateNodeToolbar();
      ctx.scheduleHistoryPush();
  };
  
  ctx.handleGroupExecute = function handleGroupExecute() {
      const g = ctx.graph.value;
      const group = ctx.overlayGroupSelection.value;
      if (!g || !group || ctx.groupExecuting)
          return;
      const tasks = coalesceSharedGenerationTasks(g, sortGroupAiTasksByDependency(collectGroupAiTasks(g, group.groupId)));
      const credits = estimateGroupExecuteCredits(tasks);
      const content = buildGroupExecuteConfirmContent(tasks.length, credits);
      Modal.confirm({
          title: '整组执行',
          okText: '开始执行',
          cancelText: '取消',
          centered: true,
          content: h('div', [
              h('p', { style: { margin: '0 0 8px', lineHeight: '1.6', color: '#111827' } }, content.main),
              h('p', { style: { margin: 0, color: '#9ca3af', fontSize: '13px', lineHeight: '1.5' } }, content.hint),
          ]),
          onOk: () => {
              if (!tasks.length)
                  return;
              void (async () => {
                  ctx.groupExecuting = true;
                  try {
                      await ctx.runGroupAiGenerationPipeline(g, group.groupId, tasks);
                      message.success('整组执行已完成');
                  }
                  catch {
                      message.error('整组执行未完成，请检查节点状态后重试');
                  }
                  finally {
                      ctx.groupExecuting = false;
                      ctx.bumpToolbarRevision();
                      ctx.updateNodeToolbar();
                  }
              })();
          },
      });
  };
  
  ctx.groupExecuting = false;
  
}
