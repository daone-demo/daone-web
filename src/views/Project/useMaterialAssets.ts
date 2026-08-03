import { computed, ref, watch, type Ref } from 'vue'
import { message } from 'ant-design-vue'
import api from '@/services/api'
import type { ProjectTabKey } from './projectData'
import {
  MATERIAL_PAGE_SIZE,
  isMaterialListScope,
  type AssetItem,
  type MaterialItem,
  buildMaterialColumns,
  normalizeAssetItem,
  resolveAssetMediaUrl,
  resolveAssetTitle,
  isVideoAsset,
  type PreviewItem,
} from './materialAssets'
import { normalizeAssetDateValue, type AssetsFileType } from './projectData'

export function useMaterialAssets(
  scope: Ref<ProjectTabKey>,
  columnCount: Ref<number>,
  assetType: Ref<AssetsFileType> = ref('all'),
  assetDate: Ref<unknown> = ref(null),
  projectId: Ref<string | undefined> = ref(undefined),
) {
  const materialCategories = ref<any[]>([])
  const materialCode = ref('')
  const activeCategoryCode = ref('')
  const materialSubCategories = ref<any[]>([])
  const activeSubCategoryCode = ref('')
  const materialList = ref<MaterialItem[]>([])
  const materialPage = ref(1)
  const materialHasMore = ref(true)
  const materialLoading = ref(false)

  const assetList = ref<AssetItem[]>([])
  const assetPage = ref(1)
  const assetHasMore = ref(true)
  const assetLoading = ref(false)

  const previewOpen = ref(false)
  const previewItem = ref<PreviewItem | null>(null)

  const showAssetUpload = computed(() => scope.value === 'FILES')

  const materialColumns = computed(() =>
    buildMaterialColumns(materialList.value, columnCount.value),
  )

  const assetColumns = computed(() =>
    buildMaterialColumns(assetList.value, columnCount.value),
  )

  function resetMaterialList() {
    materialPage.value = 1
    materialHasMore.value = true
    materialList.value = []
    materialLoading.value = false
  }

  function resetAssetList() {
    assetPage.value = 1
    assetHasMore.value = true
    assetList.value = []
    assetLoading.value = false
  }

  function resolveMaterialTypeParam(): 'IMAGE' | 'VIDEO' | undefined {
    if (assetType.value === 'image') return 'IMAGE'
    if (assetType.value === 'video') return 'VIDEO'
    return undefined
  }

  function resolveAssetDateParam(): string | undefined {
    return normalizeAssetDateValue(assetDate.value) ?? undefined
  }

  function reloadForFilters() {
    if (isMaterialListScope(scope.value)) {
      resetMaterialList()
      void onLoadMaterials()
      return
    }
    if (scope.value === 'FILES') {
      resetAssetList()
      void onLoadAssets()
    }
  }

  async function onLoadMaterialCategories() {
    const res: any = await api.queryMaterialCategories()
    materialCategories.value = res
    activeCategoryCode.value = res[0]?.code ?? ''
    materialSubCategories.value =
      materialCategories.value.find((item: any) => item.code === res[0]?.code)?.children ?? []
    if (materialSubCategories.value.length > 0) {
      materialSubCategories.value = [
        { code: 'all', name: '全部' },
        ...materialSubCategories.value.filter((item: any) => item.code !== 'all'),
      ]
      activeSubCategoryCode.value = 'all'
      materialCode.value = activeCategoryCode.value
    } else {
      materialCode.value = activeCategoryCode.value
    }
    resetMaterialList()
    await onLoadMaterials()
  }

  async function onLoadMaterials() {
    if (materialLoading.value || !materialHasMore.value) return
    if (scope.value === 'CENTER' && !materialCode.value) return
    materialLoading.value = true
    try {
      const typeParam = resolveMaterialTypeParam()
      const res: any = scope.value === 'FAVORITE'
        ? await api.queryMaterialFavorites({
          ...(typeParam ? { type: typeParam } : {}),
          pageSize: MATERIAL_PAGE_SIZE,
          page: materialPage.value,
        })
        : await api.queryMaterials({
          categoryId: materialCode.value,
          ...(typeParam ? { type: typeParam } : {}),
          pageSize: MATERIAL_PAGE_SIZE,
          page: materialPage.value,
        })
      const records = (Array.isArray(res) ? res : res.records ?? []) as MaterialItem[]
      const total = Array.isArray(res) ? records.length : Number(res.total ?? records.length)

      if (materialPage.value === 1) {
        materialList.value = records
      } else {
        materialList.value = [...materialList.value, ...records]
      }

      materialPage.value += 1
      materialHasMore.value =
        !Array.isArray(res)
        && materialList.value.length < total
        && records.length > 0
    } finally {
      materialLoading.value = false
    }
  }

  async function onLoadAssets() {
    if (assetLoading.value || !assetHasMore.value) return
    assetLoading.value = true
    try {
      const typeParam = resolveMaterialTypeParam()
      const dateParam = resolveAssetDateParam()
      const projectIdParam = projectId.value?.trim()
      const res: any = await api.getAssets({
        scope: scope.value,
        ...(projectIdParam ? { projectId: projectIdParam } : {}),
        ...(typeParam ? { type: typeParam } : {}),
        ...(dateParam ? { date: dateParam } : {}),
        pageSize: MATERIAL_PAGE_SIZE,
        page: assetPage.value,
      })
      const records = ((res.records ?? []) as AssetItem[]).map(normalizeAssetItem)
      const total = Number(res.total ?? records.length)

      if (assetPage.value === 1) {
        assetList.value = records
      } else {
        assetList.value = [...assetList.value, ...records]
      }

      assetPage.value += 1
      assetHasMore.value = assetList.value.length < total && records.length > 0
    } finally {
      assetLoading.value = false
    }
  }

  function selectPrimaryCategory(code: string) {
    activeCategoryCode.value = code
    materialSubCategories.value =
      materialCategories.value.find((item: any) => item.id === code)?.children ?? []
    if (materialSubCategories.value.length > 0) {
      materialSubCategories.value = [
        { id: 'all', name: '全部' },
        ...materialSubCategories.value.filter((item: any) => item.id !== 'all'),
      ]
      activeSubCategoryCode.value = 'all'
      materialCode.value = activeCategoryCode.value
    } else {
      materialCode.value = activeCategoryCode.value
    }
    resetMaterialList()
    void onLoadMaterials()
  }

  function selectSubCategory(code: string) {
    activeSubCategoryCode.value = code
    materialCode.value = code === 'all' ? activeCategoryCode.value : code
    resetMaterialList()
    void onLoadMaterials()
  }

  function openMaterialPreview(item: MaterialItem) {
    previewItem.value = {
      id: item.id,
      type: item.type,
      resourceUrl: item.resourceUrl || item.coverUrl || '',
      title: item.title || item.authorName || '素材',
    }
    previewOpen.value = true
  }

  function openAssetPreview(file: AssetItem) {
    const isVideo = isVideoAsset(file)
    previewItem.value = {
      id: file.id,
      type: isVideo ? 'VIDEO' : 'IMAGE',
      resourceUrl: resolveAssetMediaUrl(file),
      title: resolveAssetTitle(file),
    }
    previewOpen.value = true
  }

  function setMaterialFavorited(id: string, favorited: boolean) {
    if (scope.value === 'FAVORITE' && !favorited) {
      materialList.value = materialList.value.filter((item) => item.id !== id)
      return
    }
    materialList.value = materialList.value.map((item) =>
      item.id === id ? { ...item, favorited } : item,
    )
  }

  function setAssetFavorited(id: string, favorited: boolean) {
    assetList.value = assetList.value.map((item) =>
      item.id === id ? { ...item, favorited } : item,
    )
  }

  async function toggleMaterialFavorite(item: MaterialItem) {
    const favorited = Boolean(item.favorited)
    try {
      if (favorited) {
        await api.unfavoriteMaterial(item.id)
        setMaterialFavorited(item.id, false)
        message.success('已取消收藏')
      } else {
        await api.favoriteMaterial(item.id)
        setMaterialFavorited(item.id, true)
        message.success('收藏成功')
      }
    } catch (error) {
      console.error('[MaterialAssets] toggle material favorite failed', error)
    }
  }

  async function toggleAssetFavorite(item: AssetItem) {
    const favorited = Boolean(item.favorited)
    try {
      if (favorited) {
        await api.unfavoriteAsset(item.id)
        setAssetFavorited(item.id, false)
        message.success('已取消收藏')
      } else {
        await api.favoriteAsset(item.id)
        setAssetFavorited(item.id, true)
        message.success('收藏成功')
      }
    } catch (error) {
      console.error('[MaterialAssets] toggle asset favorite failed', error)
    }
  }

  async function loadForScope(nextScope: ProjectTabKey) {
    if (nextScope === 'CENTER') {
      resetMaterialList()
      await onLoadMaterialCategories()
      return
    }
    if (nextScope === 'FAVORITE') {
      resetMaterialList()
      await onLoadMaterials()
      return
    }
    resetAssetList()
    await onLoadAssets()
  }

  function onMaterialGridScroll(event: Event) {
    if (!isMaterialListScope(scope.value) || materialLoading.value || !materialHasMore.value) return
    const el = event.target as HTMLElement
    if (!el) return
    const reachedBottom =
      el.scrollTop + el.clientHeight >= el.scrollHeight - 120
    if (reachedBottom) {
      void onLoadMaterials()
    }
  }

  function onAssetGridScroll(event: Event) {
    if (isMaterialListScope(scope.value) || assetLoading.value || !assetHasMore.value) return
    const el = event.target as HTMLElement
    if (!el) return
    const reachedBottom =
      el.scrollTop + el.clientHeight >= el.scrollHeight - 120
    if (reachedBottom) {
      void onLoadAssets()
    }
  }

  watch(scope, (nextScope) => {
    void loadForScope(nextScope)
  })

  watch(assetType, () => {
    reloadForFilters()
  })

  watch(assetDate, () => {
    if (scope.value === 'FILES') {
      reloadForFilters()
    }
  })

  watch(projectId, () => {
    if (scope.value === 'FILES') {
      reloadForFilters()
    }
  })

  return {
    materialCategories,
    materialSubCategories,
    activeCategoryCode,
    activeSubCategoryCode,
    materialList,
    materialColumns,
    materialLoading,
    materialHasMore,
    assetList,
    assetColumns,
    assetLoading,
    assetHasMore,
    showAssetUpload,
    previewOpen,
    previewItem,
    onLoadMaterialCategories,
    onLoadMaterials,
    onLoadAssets,
    loadForScope,
    selectPrimaryCategory,
    selectSubCategory,
    openMaterialPreview,
    openAssetPreview,
    toggleMaterialFavorite,
    toggleAssetFavorite,
    onMaterialGridScroll,
    onAssetGridScroll,
    resetAssetList,
    reloadForFilters,
  }
}
