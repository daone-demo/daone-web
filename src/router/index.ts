import { createRouter, createWebHistory } from 'vue-router'

const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('@views/Home/index.vue'),
    },
    {
      path: '/project',
      name: 'project',
      component: () => import('@views/Project/index.vue'),
    },
    {
      path: '/project/:id',
      name: 'projectDetail',
      component: () => import('@views/CreateOrEdit/index.vue'),
    },
    {
      path: '/create/:id',
      name: 'createProject',
      component: () => import('@views/CreateOrEdit/index.vue'),
    },
    {
      path: '/userInfo',
      name: 'userInfo',
      component: () => import('@views/UserInfo/index.vue'),
    },
    {
      path: '/pdf',
      name: 'pdf',
      component: () => import('@views/PDF/index.vue'),
    },
  ],
})

export default router
