import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import api, { type ProjectListQuery } from '@/services/api'

/** 项目列表项，与后端 `/projects` 返回结构一致。 */
export interface Project {
  id: string
  title: string
  coverAssetId?: string | null
  coverUrl?: string | null
  revision?: number
  createdAt: string
  updatedAt: string
}

export const useProject = defineStore('project', () => {
  /** 当前页项目列表。 */
  const projects = ref<Project[]>([])

  /** 当前分页页码。 */
  const page = ref(1)

  /** 每页条数。 */
  const pageSize = ref(10)

  /** 项目总数。 */
  const total = ref(0)

  /** 列表加载中。 */
  const loading = ref(false)

  /** 是否存在项目数据。 */
  const hasProjects = computed(() => projects.value.length > 0)

  /** 分页查询项目列表并写入 store。 */
  async function loadProjects(params?: ProjectListQuery) {
    const query: ProjectListQuery = {
      page: params?.page ?? page.value,
      pageSize: params?.pageSize ?? pageSize.value,
      keyword: params?.keyword,
    }

    loading.value = true
    try {
      const res = await api.getProjects<Project>(query)
      projects.value = res.records
      page.value = res.page
      pageSize.value = res.pageSize
      total.value = res.total
      return res
    } finally {
      loading.value = false
    }
  }

  /** 按当前分页参数重新加载项目列表。 */
  function refreshProjects() {
    return loadProjects({ page: page.value, pageSize: pageSize.value })
  }

  /** 从本地列表中移除指定项目。 */
  function removeProject(projectId: string) {
    projects.value = projects.value.filter((item) => item.id !== projectId)
    total.value = Math.max(0, total.value - 1)
  }

  /** 更新本地列表中的项目名称。 */
  function updateProjectTitle(projectId: string, title: string) {
    const target = projects.value.find((item) => item.id === projectId)
    if (target) {
      target.title = title
    }
  }

  return {
    projects,
    page,
    pageSize,
    total,
    loading,
    hasProjects,
    loadProjects,
    refreshProjects,
    removeProject,
    updateProjectTitle,
  }
})
