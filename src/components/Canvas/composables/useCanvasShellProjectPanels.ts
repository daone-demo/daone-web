import { ref, watch, type Ref } from 'vue'
import { message } from 'ant-design-vue'
import api from '@/services/api'
import type { ProjectVersionDetailResponse, ProjectVersionRecord } from '@/services/api'
import { type ProjectTabKey } from '@/views/Project/projectData'
import type { ElementGroupRecord, AssetCenterTabKey } from '../assetCenterData'
import type { CanvasAssetDragPayload } from '../constants'
import {
  createLatestRequestGuard,
  isPanelResponseCurrent,
} from '../lib/latestRequestGuard'

const HISTORY_PAGE_SIZE = 50

export type CanvasShellProjectPanelsEmit = {
  (e: 'add-asset-to-chat', payload: { id: string; role: string; name: string }): void
}

export type UseCanvasShellProjectPanelsOptions = {
  emit: CanvasShellProjectPanelsEmit
  canvasRuntime: {
    batchInsertAssetsFromLibrary?: (assets: CanvasAssetDragPayload[]) => number
    loadProjectCanvasFromVersion?: (detail: ProjectVersionDetailResponse) => boolean
  }
  activeProjectId: Ref<string>
  assetsTab: Ref<ProjectTabKey>
  assetsDate: Ref<unknown>
  assetsType: Ref<'all' | 'image' | 'video'>
  assetCenterTab: Ref<AssetCenterTabKey>
  assetCenterLoading: Ref<boolean>
  showAssetCenterPanel: Ref<boolean>
  showHistoryPanel: Ref<boolean>
  addElementGroupFromRecord: (item: ElementGroupRecord) => void
  closeHistoryPanel: () => void
}

type PageRecords<T> = { records?: T[] }

export function useCanvasShellProjectPanels(options: UseCanvasShellProjectPanelsOptions) {
  const {
    emit,
    canvasRuntime,
    activeProjectId,
    assetsTab,
    assetsDate,
    assetsType,
    assetCenterTab,
    assetCenterLoading,
    showAssetCenterPanel,
    showHistoryPanel,
    addElementGroupFromRecord,
    closeHistoryPanel,
  } = options

  const skillList = ref<ElementGroupRecord[]>([])
  const historyList = ref<ProjectVersionRecord[]>([])
  const historyPage = ref(1)
  const historyLoading = ref(false)
  const historyHasMore = ref(true)
  const historyRestoring = ref(false)

  const skillRequestGuard = createLatestRequestGuard()
  const historyRequestGuard = createLatestRequestGuard()

  const onChangeAssetsTab = (tab: ProjectTabKey) => {
    assetsTab.value = tab
  }

  const onChangeAssetsType = (type: 'all' | 'image' | 'video') => {
    assetsType.value = type
  }

  const onChangeAssetsDate = (date: unknown) => {
    assetsDate.value = date
  }

  const onBatchInsertAssets = (assets: CanvasAssetDragPayload[]) => {
    canvasRuntime.batchInsertAssetsFromLibrary?.(assets)
  }

  const onChangeAssetCenterTab = (tab: AssetCenterTabKey) => {
    assetCenterTab.value = tab
  }

  const onSelectAssetCenterItem = (item: ElementGroupRecord) => {
    addElementGroupFromRecord(item)
  }

  const onAddAssetCenterToChat = (payload: { id: string; role: string; name: string }) => {
    emit('add-asset-to-chat', payload)
  }

  const clearSkillPanelState = () => {
    skillRequestGuard.invalidate()
    skillList.value = []
    assetCenterLoading.value = false
  }

  const clearHistoryPanelState = () => {
    historyRequestGuard.invalidate()
    historyList.value = []
    historyPage.value = 1
    historyHasMore.value = true
    historyLoading.value = false
  }

  const onLoadSkill = () => {
    const projectId = activeProjectId.value
    if (!projectId) return

    const isCurrent = skillRequestGuard.begin()
    assetCenterLoading.value = true
    api
      .queryElementGroups<PageRecords<ElementGroupRecord>>(projectId, { pageSize: 50, page: 1 })
      .then((res) => {
        if (
          !isPanelResponseCurrent({
            isCurrent,
            requestedProjectId: projectId,
            activeProjectId: activeProjectId.value,
          })
        ) {
          return
        }
        skillList.value = res.records ?? []
      })
      .finally(() => {
        if (
          isPanelResponseCurrent({
            isCurrent,
            requestedProjectId: projectId,
            activeProjectId: activeProjectId.value,
          })
        ) {
          assetCenterLoading.value = false
        }
      })
  }

  const onDeleteAssetCenterItem = async (item: ElementGroupRecord) => {
    const groupId = item.id
    const projectId = activeProjectId.value
    if (!projectId || !groupId) return

    try {
      await api.deleteProjectElementGroup(projectId, String(groupId))
      if (activeProjectId.value !== projectId) return
      message.success('删除成功')
      onLoadSkill()
    } catch (error) {
      console.error('[Canvas] delete element group failed', error)
      if (activeProjectId.value !== projectId) return
      message.error('删除失败，请稍后重试')
    }
  }

  const onLoadHistory = async (reset = false) => {
    const projectId = activeProjectId.value
    if (!projectId) return
    // reset 可抢占进行中的请求（begin 会使旧响应失效）；加载更多仍需串行
    if (!reset) {
      if (historyLoading.value || !historyHasMore.value) return
    }

    // 失败时不推进页码：reset 固定请求第 1 页；加载更多请求下一页
    const pageToLoad = reset ? 1 : historyPage.value + 1
    if (reset) {
      historyHasMore.value = true
    }

    const isCurrent = historyRequestGuard.begin()
    historyLoading.value = true
    try {
      const res = await api.getProjectVersions<ProjectVersionRecord>(projectId, {
        pageSize: HISTORY_PAGE_SIZE,
        page: pageToLoad,
      })
      if (
        !isPanelResponseCurrent({
          isCurrent,
          requestedProjectId: projectId,
          activeProjectId: activeProjectId.value,
        })
      ) {
        return
      }
      const records = res.records ?? []
      if (reset) {
        historyList.value = records
        historyPage.value = 1
      } else {
        const existingIds = new Set(historyList.value.map((item) => String(item.id)))
        historyList.value.push(...records.filter((item) => !existingIds.has(String(item.id))))
        historyPage.value = pageToLoad
      }
      historyHasMore.value = records.length >= HISTORY_PAGE_SIZE
    } catch (error) {
      if (
        isPanelResponseCurrent({
          isCurrent,
          requestedProjectId: projectId,
          activeProjectId: activeProjectId.value,
        })
      ) {
        console.error('[Canvas] load history failed', error)
        // 页码未推进，重试仍会请求同一页
      }
    } finally {
      if (
        isPanelResponseCurrent({
          isCurrent,
          requestedProjectId: projectId,
          activeProjectId: activeProjectId.value,
        })
      ) {
        historyLoading.value = false
      }
    }
  }

  const onLoadMoreHistory = () => {
    if (!historyHasMore.value || historyLoading.value) return
    void onLoadHistory(false)
  }

  const onSelectHistoryVersion = async (versionId: string) => {
    const projectId = activeProjectId.value
    if (!projectId || historyRestoring.value || !versionId) return

    historyRestoring.value = true
    try {
      const detail = await api.getProjectVersion<ProjectVersionDetailResponse>(projectId, versionId)
      if (activeProjectId.value !== projectId) return
      const loaded = canvasRuntime.loadProjectCanvasFromVersion?.(detail)
      if (!loaded) {
        message.error('恢复历史版本失败')
        return
      }
      closeHistoryPanel()
    } catch (error) {
      console.error('[Canvas] restore history version failed', error)
      if (activeProjectId.value !== projectId) return
      message.error('加载历史版本失败')
    } finally {
      historyRestoring.value = false
    }
  }

  // 联合监听：面板打开或项目切换时清空并重载，避免旧项目列表残留
  watch([showAssetCenterPanel, activeProjectId], ([open, projectId]) => {
    if (open && projectId) {
      skillList.value = []
      onLoadSkill()
      return
    }
    clearSkillPanelState()
  })

  watch([showHistoryPanel, activeProjectId], ([open, projectId]) => {
    if (open && projectId) {
      historyList.value = []
      historyPage.value = 1
      historyHasMore.value = true
      void onLoadHistory(true)
      return
    }
    clearHistoryPanelState()
  })

  return {
    skillList,
    historyList,
    historyLoading,
    historyHasMore,
    historyRestoring,
    onChangeAssetsTab,
    onChangeAssetsType,
    onChangeAssetsDate,
    onBatchInsertAssets,
    onChangeAssetCenterTab,
    onSelectAssetCenterItem,
    onAddAssetCenterToChat,
    onDeleteAssetCenterItem,
    onLoadMoreHistory,
    onSelectHistoryVersion,
  }
}
