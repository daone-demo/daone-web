import { CANVAS_PROJECTS } from '@/components/Canvas/constants'

export const HOME_INSPIRATION_CATEGORIES = [
  { key: 'all', label: '全部' },
  { key: 'brand', label: '品牌设计' },
  { key: 'poster', label: '海报与广告' },
  { key: 'illustration', label: '插画' },
  { key: 'ui', label: 'UI设计' },
  { key: 'character', label: '角色设计' },
  { key: 'software', label: '软件与开发' },
  { key: 'product', label: '产品设计' },
  { key: 'architecture', label: '建筑设计' },
] as const

export type HomeInspirationCategory = (typeof HOME_INSPIRATION_CATEGORIES)[number]['key']

export type HomeRecentProject = {
  id: string
  name: string
  updatedAt: string
}

export type HomeInspirationItem = {
  id: string
  category: Exclude<HomeInspirationCategory, 'all'>
  image: string
  imageHeight: number
  author: string
  avatar: string
  likes: number
  views: number
}

export const HOME_RECENT_PROJECTS: HomeRecentProject[] = CANVAS_PROJECTS.map((project) => ({
  id: project.id,
  name: project.name === '未命名创作' || project.name.startsWith('未命名') ? 'Untitled' : project.name,
  updatedAt: 'Jun 2, 2025',
}))

export const HOME_QUICK_ACTIONS = [
  { key: 'poster', label: '海报宣传', icon: 'poster' },
  { key: 'brand', label: '品牌设计', icon: 'brand' },
  { key: 'illustration', label: '风格插画', icon: 'illustration' },
  { key: 'commerce', label: '电商营销', icon: 'commerce' },
  { key: 'video', label: '视频与分镜', icon: 'video' },
] as const

export const HOME_HERO_PLACEHOLDER = '让星流 设计一个令人惊艳的标志'

export const HOME_INSPIRATION_ITEMS: HomeInspirationItem[] = [
  {
    id: 'insp-1',
    category: 'product',
    image: 'https://picsum.photos/seed/design-lamp/480/360',
    imageHeight: 220,
    author: 'Sophie_Bakes12',
    avatar: 'https://picsum.photos/seed/avatar-sophie/64/64',
    likes: 1140,
    views: 110,
  },
  {
    id: 'insp-2',
    category: 'architecture',
    image: 'https://picsum.photos/seed/design-arch/480/640',
    imageHeight: 300,
    author: 'clvisual',
    avatar: 'https://picsum.photos/seed/avatar-cl/64/64',
    likes: 5160,
    views: 110,
  },
  {
    id: 'insp-3',
    category: 'brand',
    image: 'https://picsum.photos/seed/design-brand/480/520',
    imageHeight: 260,
    author: 'Oliver_Smith',
    avatar: 'https://picsum.photos/seed/avatar-oliver/64/64',
    likes: 892,
    views: 64,
  },
  {
    id: 'insp-4',
    category: 'ui',
    image: 'https://picsum.photos/seed/design-ui/480/380',
    imageHeight: 230,
    author: 'MiaDesign',
    avatar: 'https://picsum.photos/seed/avatar-mia/64/64',
    likes: 2340,
    views: 188,
  },
  {
    id: 'insp-5',
    category: 'poster',
    image: 'https://picsum.photos/seed/design-poster/480/720',
    imageHeight: 340,
    author: 'PosterLab',
    avatar: 'https://picsum.photos/seed/avatar-poster/64/64',
    likes: 760,
    views: 92,
  },
  {
    id: 'insp-6',
    category: 'illustration',
    image: 'https://picsum.photos/seed/design-illu/480/420',
    imageHeight: 250,
    author: 'InkStudio',
    avatar: 'https://picsum.photos/seed/avatar-ink/64/64',
    likes: 1580,
    views: 143,
  },
  {
    id: 'insp-7',
    category: 'product',
    image: 'https://picsum.photos/seed/design-ceramic/480/560',
    imageHeight: 280,
    author: 'ClayWorks',
    avatar: 'https://picsum.photos/seed/avatar-clay/64/64',
    likes: 420,
    views: 56,
  },
  {
    id: 'insp-8',
    category: 'character',
    image: 'https://picsum.photos/seed/design-char/480/680',
    imageHeight: 320,
    author: 'HeroForge',
    avatar: 'https://picsum.photos/seed/avatar-hero/64/64',
    likes: 3310,
    views: 205,
  },
  {
    id: 'insp-9',
    category: 'software',
    image: 'https://picsum.photos/seed/design-soft/480/400',
    imageHeight: 240,
    author: 'DevCraft',
    avatar: 'https://picsum.photos/seed/avatar-dev/64/64',
    likes: 980,
    views: 77,
  },
  {
    id: 'insp-10',
    category: 'architecture',
    image: 'https://picsum.photos/seed/design-house/480/480',
    imageHeight: 270,
    author: 'SpaceForm',
    avatar: 'https://picsum.photos/seed/avatar-space/64/64',
    likes: 1240,
    views: 119,
  },
  {
    id: 'insp-11',
    category: 'brand',
    image: 'https://picsum.photos/seed/design-pack/480/600',
    imageHeight: 290,
    author: 'BrandNest',
    avatar: 'https://picsum.photos/seed/avatar-brand/64/64',
    likes: 670,
    views: 48,
  },
  {
    id: 'insp-12',
    category: 'ui',
    image: 'https://picsum.photos/seed/design-app/480/760',
    imageHeight: 360,
    author: 'PixelFlow',
    avatar: 'https://picsum.photos/seed/avatar-pixel/64/64',
    likes: 2890,
    views: 176,
  },
]
