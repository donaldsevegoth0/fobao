import { createRouter, createWebHistory } from 'vue-router'

import Login from '../views/Login.vue'
import Register from '../views/Register.vue'
import Forget from '../views/Forget.vue'
import UpdatePass from '../views/UpdatePass.vue'
import { supabase } from '../lib/supabase'

const routes = [
    {
      path:'/',
      component: ()=>import('../views/Home.vue'),
      meta:{
        requiresAuth: true
      }
    },
    {
      path: '/login',
      component: Login
    },
    {
      path: '/register',
      component: Register
    },
    {
      path:'/forget',
      component: Forget
    },
    {
      path:'/update-password',
      component: UpdatePass
    },
    {
      path: '/product/:id',
      component: () => import('../views/ProductDetail.vue'),
      meta:{
        requiresAuth: true
      }
    }
  ]

const router = createRouter({
  history: createWebHistory(),
  routes
})

router.beforeEach(async (to, _from, next) => {
  const {
    data: { session }
  } = await supabase.auth.getSession()
  if (to.meta.requiresAuth && !session) {
    next('/login')
  } else {
    next()
  }
})

export default router
