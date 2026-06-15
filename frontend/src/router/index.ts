import { createRouter, createWebHistory, RouteRecordRaw } from 'vue-router'

const routes: RouteRecordRaw[] = [
  {
    path: '/',
    redirect: '/books'
  },
  {
    path: '/books',
    name: 'Books',
    component: () => import('@/views/Books.vue'),
    meta: { title: '绘本档案' }
  },
  {
    path: '/borrow',
    name: 'Borrow',
    component: () => import('@/views/Borrow.vue'),
    meta: { title: '借阅记录' }
  },
  {
    path: '/rotation',
    name: 'Rotation',
    component: () => import('@/views/RotationPlan.vue'),
    meta: { title: '轮换计划' }
  },
  {
    path: '/recommend',
    name: 'Recommend',
    component: () => import('@/views/Recommend.vue'),
    meta: { title: '月龄推荐' }
  },
  {
    path: '/reading',
    name: 'Reading',
    component: () => import('@/views/Reading.vue'),
    meta: { title: '阅读打卡' }
  },
  {
    path: '/statistics',
    name: 'Statistics',
    component: () => import('@/views/Statistics.vue'),
    meta: { title: '统计分析' }
  },
  {
    path: '/sharing',
    name: 'Sharing',
    component: () => import('@/views/Sharing.vue'),
    meta: { title: '共享换书' }
  }
]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach((to, from, next) => {
  document.title = `${to.meta.title || '宝宝绘本借阅平台'} - 宝宝绘本借阅平台`
  next()
})

export default router
