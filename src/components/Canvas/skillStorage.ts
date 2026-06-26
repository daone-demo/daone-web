import type { GroupSkillSubgraph } from './groupSkill'
import { buildElementGroupStructure } from './groupSkill'
import api from '@/services/api'

export interface SavedCanvasSkill {
  id: string
  name: string
  role?: string
  description: string
  tags?: string[]
  markdown?: string
  workflow: GroupSkillSubgraph
  nodeCount: number
  fileCount: number
  createdAt: string
  updatedAt: string
  projectId: string
}

const STORAGE_KEY = 'daone-canvas-skills'

function readSkills(): SavedCanvasSkill[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as SavedCanvasSkill[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function writeSkills(skills: SavedCanvasSkill[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(skills))
}

export function listSavedCanvasSkills(): SavedCanvasSkill[] {
  return readSkills().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
}

export async function saveCanvasSkill(skill: SavedCanvasSkill) {
  if (!skill.projectId) {
    throw new Error('保存元素组缺少 projectId')
  }

  await api.saveElementGroups(skill.projectId, {
    projectName: skill.name,
    projectDescription: skill.description,
    projectStructure: buildElementGroupStructure(skill.workflow),
  })

  const skills = readSkills()
  skills.unshift(skill)
  writeSkills(skills)
}

export async function mergeCanvasSkill(
  skillId: string,
  patch: {
    markdown: string
    workflow: GroupSkillSubgraph
    addedNodeCount: number
    addedFileCount: number
  },
): Promise<SavedCanvasSkill | null> {
  const skills = readSkills()
  const index = skills.findIndex((item) => item.id === skillId)
  if (index < 0) return null

  const current = skills[index]
  const next: SavedCanvasSkill = {
    ...current,
    markdown: patch.markdown,
    workflow: patch.workflow,
    nodeCount: (current.nodeCount ?? 0) + patch.addedNodeCount,
    fileCount: (current.fileCount ?? 0) + patch.addedFileCount,
    updatedAt: new Date().toISOString(),
  }

  await api.saveElementGroups(next.projectId, {
    projectName: next.name,
    projectDescription: next.description,
    projectStructure: buildElementGroupStructure(next.workflow),
  })

  skills[index] = next
  writeSkills(skills)
  return next
}

export function createSkillId() {
  return `skill_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
