/**
 * 职责：安装添加菜单与资产中心 / 资产 / 历史 / 快捷键面板切换相关动作到 ctx。
 */
import type { AssetCenterItem } from '../../../../assetCenterData';
import { listSavedCanvasSkills,type SavedCanvasSkill } from '../../../../skillStorage';
import { api } from '../../sharedImports';
import type { CoreRuntimeContext } from '../context';

export function installAssetShellPanels(ctx: CoreRuntimeContext) {
  ctx.toggleAddMenu = function toggleAddMenu() {
      if (ctx.showAddMenu.value) {
          ctx.closeAddMenu();
          return;
      }
      ctx.clearCanvasTextSelection();
      ctx.addMenuDropPoint.value = null;
      const overlayRoot = ctx.canvasRef.value;
      if (overlayRoot) {
          const rect = overlayRoot.getBoundingClientRect();
          ctx.addMenuPos.value = {
              left: rect.width / 2,
              top: rect.height - 120,
          };
      }
      ctx.showAddMenu.value = true;
      ctx.showAssetsPanel.value = false;
      ctx.closeHistoryPanel();
      ctx.closeConnectMenu();
  };
  
  ctx.mapSkillToAssetCenterItem = function mapSkillToAssetCenterItem(skill: SavedCanvasSkill): AssetCenterItem {
      const previewUrl = skill.workflow.nodes.find((node) => node.previewUrl)?.previewUrl;
      return {
          id: skill.id,
          name: skill.name,
          role: skill.role || '自定义',
          previewUrl,
          description: skill.description,
      };
  };
  
  ctx.mapElementGroupRecord = function mapElementGroupRecord(record: Record<string, unknown>): AssetCenterItem | null {
      const structure = record.projectStructure as {
          cells?: Array<Record<string, unknown>>;
      } | undefined
          ?? record.structure as {
              cells?: Array<Record<string, unknown>>;
          } | undefined;
      const cells = structure?.cells ?? [];
      const imageNode = cells.find((cell) => cell.type === 'node' && cell.previewUrl);
      const name = String(record.projectName ?? record.name ?? '').trim();
      if (!name)
          return null;
      return {
          id: String(record.id ?? record.elementGroupId ?? `${name}-${record.updatedAt ?? ''}`),
          name,
          role: String(record.role ?? '自定义'),
          previewUrl: typeof imageNode?.previewUrl === 'string' ? imageNode.previewUrl : undefined,
          description: String(record.projectDescription ?? record.description ?? ''),
      };
  };
  
  ctx.loadAssetCenterItems = async function loadAssetCenterItems() {
      ctx.assetCenterLoading.value = true;
      try {
          const projectId = ctx.activeProjectId.value;
          const byId = new Map<string, AssetCenterItem>();
          listSavedCanvasSkills()
              .filter((skill) => !projectId || skill.projectId === projectId)
              .forEach((skill) => {
              byId.set(skill.id, ctx.mapSkillToAssetCenterItem(skill));
          });
          if (projectId) {
              try {
                  const res = await api.queryElementGroups(projectId, { pageSize: 50, page: 1 }) as {
                      records?: Array<Record<string, unknown>>;
                  };
                  for (const record of res?.records ?? []) {
                      const item = ctx.mapElementGroupRecord(record);
                      if (item)
                          byId.set(item.id, item);
                  }
              }
              catch (error) {
                  console.warn('[Canvas] load asset center failed', error);
              }
          }
          ctx.assetCenterItems.value = Array.from(byId.values());
      }
      finally {
          ctx.assetCenterLoading.value = false;
      }
  };
  
  ctx.closeAssetCenterPanel = function closeAssetCenterPanel() {
      ctx.showAssetCenterPanel.value = false;
  };
  
  ctx.openAssetCenterPanel = function openAssetCenterPanel() {
      ctx.showAssetCenterPanel.value = true;
      ctx.closeAddMenu();
      ctx.closeHistoryPanel();
      ctx.showAssetsPanel.value = false;
  };
  
  ctx.toggleAssetCenterPanel = function toggleAssetCenterPanel() {
      if (ctx.showAssetCenterPanel.value) {
          ctx.closeAssetCenterPanel();
      }
      else {
          ctx.openAssetCenterPanel();
      }
  };
  
  ctx.openAssetsPanel = function openAssetsPanel() {
      ctx.showAssetsPanel.value = true;
      ctx.closeAssetCenterPanel();
      ctx.closeAddMenu();
      ctx.assetsLoading.value = true;
      window.setTimeout(() => {
          ctx.assetsLoading.value = false;
      }, 800);
  };
  
  ctx.toggleAssetsPanel = function toggleAssetsPanel() {
      if (ctx.showAssetsPanel.value) {
          ctx.showAssetsPanel.value = false;
      }
      else {
          ctx.closeHistoryPanel();
          ctx.openAssetsPanel();
      }
  };
  
  ctx.closeHistoryPanel = function closeHistoryPanel() {
      ctx.showHistoryPanel.value = false;
  };
  
  ctx.toggleHistoryPanel = function toggleHistoryPanel() {
      if (ctx.showHistoryPanel.value) {
          ctx.closeHistoryPanel();
          return;
      }
      ctx.showHistoryPanel.value = true;
      ctx.showAssetsPanel.value = false;
      ctx.closeAssetCenterPanel();
      ctx.closeAddMenu();
      ctx.closeConnectMenu();
      ctx.closeShortcutsPanel();
      ctx.closeZoomMenu();
  };
  
  ctx.closeShortcutsPanel = function closeShortcutsPanel() {
      ctx.showShortcutsPanel.value = false;
  };
  
  ctx.toggleShortcutsPanel = function toggleShortcutsPanel() {
      ctx.showShortcutsPanel.value = !ctx.showShortcutsPanel.value;
      if (!ctx.showShortcutsPanel.value)
          return;
      ctx.showZoomMenu.value = false;
      ctx.closeAddMenu();
      ctx.closeConnectMenu();
      ctx.showAssetsPanel.value = false;
      ctx.closeAssetCenterPanel();
      ctx.closeHistoryPanel();
  };
}
