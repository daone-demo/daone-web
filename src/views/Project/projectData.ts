export const PROJECT_TABS = [
  { key: 'recommend', label: '智能推荐' },
  { key: 'material', label: '素材中心' },
  { key: 'mine', label: '我的素材' },
  { key: 'favorite', label: '我的收藏' },
  { key: 'files', label: '我的文件' },
] as const

export type ProjectTabKey = (typeof PROJECT_TABS)[number]['key']

export type ProjectFileItem = {
  id: string
  type: 'image' | 'dark' | 'scribble' | 'green'
  image?: string
}

const fashionImages = [
  'https://picsum.photos/seed/project-pink-dress/320/420',
  'https://picsum.photos/seed/project-blue-shirt/320/420',
  'https://picsum.photos/seed/project-grey-set/320/420',
  'https://picsum.photos/seed/project-floral/320/420',
  'https://picsum.photos/seed/project-model-a/320/420',
  'https://picsum.photos/seed/project-model-b/320/420',
]

function buildProjectFiles(): ProjectFileItem[] {
  const pattern: Array<ProjectFileItem['type'] | 'image-index' | number> = [
    'image-index',
    0,
    'image-index',
    1,
    'dark',
    'scribble',
    'image-index',
    2,
    'image-index',
    3,
    'green',
    'dark',
    'image-index',
    4,
    'scribble',
    'image-index',
    5,
    'image-index',
    0,
    'dark',
    'image-index',
    1,
    'image-index',
    2,
    'scribble',
    'image-index',
    3,
    'dark',
    'image-index',
    4,
    'image-index',
    5,
    'green',
    'image-index',
    0,
    'scribble',
    'image-index',
    1,
    'dark',
    'image-index',
    2,
    'image-index',
    3,
    'image-index',
    4,
    'dark',
    'scribble',
    'image-index',
    5,
  ]

  let imageCursor = 0

  return pattern.map((entry, index) => {
    if (entry === 'image-index') {
      const image = fashionImages[imageCursor % fashionImages.length]
      imageCursor += 1
      return { id: `file-${index}`, type: 'image', image }
    }

    if (typeof entry === 'number') {
      return { id: `file-${index}`, type: 'image', image: fashionImages[entry] }
    }

    return { id: `file-${index}`, type: entry }
  })
}

export const PROJECT_FILES = buildProjectFiles()
