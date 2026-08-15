/** 首页灵感分类（接口返回） */
export type HomeInspirationCategoryItem = {
  name: string
  id: string
  children?: HomeInspirationCategoryItem[]
}

export type HomeRecentProject = {
  id: string
  name: string
  updatedAt: string
}

export type HomeInspirationItem = {
  id: string
  category: string
  image: string
  imageHeight: number
  author: string
  avatar: string
  likes: number
  views: number
}
