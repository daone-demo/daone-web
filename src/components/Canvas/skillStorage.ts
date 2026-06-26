import type { GroupSkillSubgraph } from './groupSkill';
import api from '@/services/api';

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

export function saveCanvasSkill(skill: SavedCanvasSkill) {
  console.log('saveCanvasSkill', skill)
  let {
    workflow,
    name,
    description
  } = skill;

  const skills = readSkills()
  skills.unshift(skill)
  writeSkills(skills)
}

export function mergeCanvasSkill(
  skillId: string,
  patch: {
    markdown: string
    workflow: GroupSkillSubgraph
    addedNodeCount: number
    addedFileCount: number
  },
): SavedCanvasSkill | null {
  const skills = readSkills()
  const index = skills.findIndex((item) => item.id === skillId)
  if (index < 0) return null

  const current = skills[index]
  const next: SavedCanvasSkill = {
    ...current,
    markdown: patch.markdown,
    workflow: patch.workflow,
    nodeCount: current.nodeCount + patch.addedNodeCount,
    fileCount: current.fileCount + patch.addedFileCount,
    updatedAt: new Date().toISOString(),
  }
  skills[index] = next
  writeSkills(skills)
  return next
}

export function createSkillId() {
  return `skill_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
}
