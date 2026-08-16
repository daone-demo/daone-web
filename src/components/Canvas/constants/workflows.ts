export type WorkflowRecord = {
  id: string | number
  name: string
  description?: string
  type?: string
  buttonType?: string
  categoryId?: string | number | null
  categoryName?: string
  category?: { id?: string | number; name?: string } | null
  workflowJson?: string
  [key: string]: unknown
}

/** 工作流按钮类型：我的模特（弹出数字人选择器） */
export const WORKFLOW_BUTTON_TYPE_MY_MODEL = 'MY_MODEL'

export function resolveWorkflowButtonType(
  workflow: WorkflowRecord | null | undefined,
): string {
  if (!workflow) return ''
  const raw = workflow.buttonType ?? workflow.button_type
  return String(raw ?? '').trim().toUpperCase()
}

export function isMyModelWorkflow(
  workflow: WorkflowRecord | null | undefined,
): boolean {
  return resolveWorkflowButtonType(workflow) === WORKFLOW_BUTTON_TYPE_MY_MODEL
}

/** 创建生成任务时：MY_MODEL 工作流不传 workflowId */
export function resolveGenerationTaskWorkflowId(
  workflowId?: string | number | null,
  workflow?: WorkflowRecord | null,
): string | null {
  if (isMyModelWorkflow(workflow)) return null
  if (workflowId === undefined || workflowId === null || workflowId === '') return null
  return String(workflowId)
}

export type WorkflowCategoryGroup = {
  categoryId: string
  categoryName: string
  workflows: WorkflowRecord[]
}

export type ImageWorkflowOption = WorkflowRecord & { id: string; name: string }

export type ImageWorkflowOptionGroup = {
  categoryId: string
  categoryName: string
  children: ImageWorkflowOption[]
}

const UNCATEGORIZED_WORKFLOW_CATEGORY_ID = '__uncategorized__'

function resolveWorkflowCategoryId(workflow: WorkflowRecord): string {
  const raw = workflow.categoryId ?? workflow.category?.id
  if (raw === undefined || raw === null || raw === '') {
    return UNCATEGORIZED_WORKFLOW_CATEGORY_ID
  }
  return String(raw)
}

function resolveWorkflowCategoryName(workflow: WorkflowRecord, categoryId: string): string {
  if (categoryId === UNCATEGORIZED_WORKFLOW_CATEGORY_ID) return '未分类'
  const raw = workflow.categoryName ?? workflow.category?.name
  if (raw !== undefined && raw !== null && String(raw).trim()) {
    return String(raw)
  }
  return `分类 ${categoryId}`
}

function normalizeWorkflowOption(workflow: WorkflowRecord): ImageWorkflowOption {
  return {
    ...workflow,
    id: String(workflow.id),
    name: String(workflow.name || workflow.description || workflow.id),
  }
}

export function isWorkflowCategoryGroup(
  value: WorkflowRecord | WorkflowCategoryGroup,
): value is WorkflowCategoryGroup {
  return Array.isArray((value as WorkflowCategoryGroup).workflows)
}

/** 将工作流列表按 categoryId 聚合为二级菜单结构 */
export function groupWorkflowsByCategory(
  workflows: WorkflowRecord[] | null | undefined,
): WorkflowCategoryGroup[] {
  const groups = new Map<string, WorkflowCategoryGroup>()

  for (const workflow of Array.isArray(workflows) ? workflows : []) {
    if (workflow?.id === undefined || workflow?.id === null) continue
    const categoryId = resolveWorkflowCategoryId(workflow)
    let group = groups.get(categoryId)
    if (!group) {
      group = {
        categoryId,
        categoryName: resolveWorkflowCategoryName(workflow, categoryId),
        workflows: [],
      }
      groups.set(categoryId, group)
    }
    group.workflows.push(workflow)
  }

  return Array.from(groups.values())
}

export function flattenWorkflowCategoryGroups(
  workflows: WorkflowCategoryGroup[] | WorkflowRecord[] | null | undefined,
): WorkflowRecord[] {
  if (!Array.isArray(workflows) || !workflows.length) return []
  if (isWorkflowCategoryGroup(workflows[0])) {
    return (workflows as WorkflowCategoryGroup[]).flatMap((group) => group.workflows)
  }
  return workflows as WorkflowRecord[]
}

/** 仅保留 type 为 IMAGE 的工作流（兼容大小写与 TYPE 字段） */
export function isImageWorkflowRecord(workflow: WorkflowRecord | null | undefined): boolean {
  if (!workflow) return false
  const type = String(workflow.type ?? workflow.TYPE ?? '').trim().toUpperCase()
  return type === 'IMAGE'
}

/** 仅保留 type 为 VIDEO 的工作流（兼容大小写与 TYPE 字段） */
export function isVideoWorkflowRecord(workflow: WorkflowRecord | null | undefined): boolean {
  if (!workflow) return false
  const type = String(workflow.type ?? workflow.TYPE ?? '').trim().toUpperCase()
  return type === 'VIDEO'
}

/** 仅保留 type 为 TEXT 的工作流（兼容大小写与 TYPE 字段） */
export function isTextWorkflowRecord(workflow: WorkflowRecord | null | undefined): boolean {
  if (!workflow) return false
  const type = String(workflow.type ?? workflow.TYPE ?? '').trim().toUpperCase()
  return type === 'TEXT'
}

/** 图片对话/文生图对话框共用：从 workflows 列表解析 IMAGE 类型选项 */
export function buildImageWorkflowOptions(
  workflows: WorkflowCategoryGroup[] | WorkflowRecord[] | null | undefined,
): ImageWorkflowOption[] {
  return flattenWorkflowCategoryGroups(workflows)
    .filter((workflow) => workflow?.id !== undefined && workflow?.id !== null)
    .filter(isImageWorkflowRecord)
    .map(normalizeWorkflowOption)
}

/** 图片对话/文生图对话框共用：按 categoryId 输出二级菜单选项 */
export function buildImageWorkflowOptionGroups(
  workflows: WorkflowCategoryGroup[] | WorkflowRecord[] | null | undefined,
): ImageWorkflowOptionGroup[] {
  if (!Array.isArray(workflows) || !workflows.length) return []

  if (isWorkflowCategoryGroup(workflows[0])) {
    return (workflows as WorkflowCategoryGroup[])
      .map((group) => ({
        categoryId: group.categoryId,
        categoryName: group.categoryName,
        children: group.workflows
          .filter((workflow) => workflow?.id !== undefined && workflow?.id !== null)
          .filter(isImageWorkflowRecord)
          .map(normalizeWorkflowOption),
      }))
      .filter((group) => group.children.length > 0)
  }

  return groupWorkflowsByCategory(buildImageWorkflowOptions(workflows))
    .map((group) => ({
      categoryId: group.categoryId,
      categoryName: group.categoryName,
      children: group.workflows.map(normalizeWorkflowOption),
    }))
    .filter((group) => group.children.length > 0)
}

/** 视频对话面板：从 workflows 列表解析 VIDEO 类型选项 */
export function buildVideoWorkflowOptions(
  workflows: WorkflowCategoryGroup[] | WorkflowRecord[] | null | undefined,
): ImageWorkflowOption[] {
  return flattenWorkflowCategoryGroups(workflows)
    .filter((workflow) => workflow?.id !== undefined && workflow?.id !== null)
    .filter(isVideoWorkflowRecord)
    .map(normalizeWorkflowOption)
}

/** 视频对话面板：按 categoryId 输出二级菜单选项（仅 VIDEO） */
export function buildVideoWorkflowOptionGroups(
  workflows: WorkflowCategoryGroup[] | WorkflowRecord[] | null | undefined,
): ImageWorkflowOptionGroup[] {
  if (!Array.isArray(workflows) || !workflows.length) return []

  if (isWorkflowCategoryGroup(workflows[0])) {
    return (workflows as WorkflowCategoryGroup[])
      .map((group) => ({
        categoryId: group.categoryId,
        categoryName: group.categoryName,
        children: group.workflows
          .filter((workflow) => workflow?.id !== undefined && workflow?.id !== null)
          .filter(isVideoWorkflowRecord)
          .map(normalizeWorkflowOption),
      }))
      .filter((group) => group.children.length > 0)
  }

  return groupWorkflowsByCategory(buildVideoWorkflowOptions(workflows))
    .map((group) => ({
      categoryId: group.categoryId,
      categoryName: group.categoryName,
      children: group.workflows.map(normalizeWorkflowOption),
    }))
    .filter((group) => group.children.length > 0)
}

/** 文本节点提示栏：从 workflows 列表解析 TEXT 类型选项 */
export function buildTextWorkflowOptions(
  workflows: WorkflowCategoryGroup[] | WorkflowRecord[] | null | undefined,
): ImageWorkflowOption[] {
  return flattenWorkflowCategoryGroups(workflows)
    .filter((workflow) => workflow?.id !== undefined && workflow?.id !== null)
    .filter(isTextWorkflowRecord)
    .map(normalizeWorkflowOption)
}

/** 文本节点提示栏：按 categoryId 输出二级菜单选项（仅 TEXT） */
export function buildTextWorkflowOptionGroups(
  workflows: WorkflowCategoryGroup[] | WorkflowRecord[] | null | undefined,
): ImageWorkflowOptionGroup[] {
  if (!Array.isArray(workflows) || !workflows.length) return []

  if (isWorkflowCategoryGroup(workflows[0])) {
    return (workflows as WorkflowCategoryGroup[])
      .map((group) => ({
        categoryId: group.categoryId,
        categoryName: group.categoryName,
        children: group.workflows
          .filter((workflow) => workflow?.id !== undefined && workflow?.id !== null)
          .filter(isTextWorkflowRecord)
          .map(normalizeWorkflowOption),
      }))
      .filter((group) => group.children.length > 0)
  }

  return groupWorkflowsByCategory(buildTextWorkflowOptions(workflows))
    .map((group) => ({
      categoryId: group.categoryId,
      categoryName: group.categoryName,
      children: group.workflows.map(normalizeWorkflowOption),
    }))
    .filter((group) => group.children.length > 0)
}
