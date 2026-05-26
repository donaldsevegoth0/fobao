<script>
import AmuletCard from '../components/AmuletCard.vue';
import NavBar from '../components/NavBar.vue';
import { supabase } from '../lib/supabase'

export default {
    components: {
        NavBar,
        AmuletCard
    },

    data() {
        return {
            posts: [],

            loading: false,
            refreshing: false,

            page: 0,
            pageSize: 10,
            finished: false,

            lastSeenTime: null,

            cache: {
                pages: {}
            },

            pullDistance: 0,
            pulling: false,
            startY: 0,
        }
    },

    async mounted() {
        await this.loadInitial()
        window.addEventListener('scroll', this.handleScroll)

        window.addEventListener('touchstart', this.touchStart)
        window.addEventListener('touchmove', this.touchMove)
        window.addEventListener('touchend', this.touchEnd)
    },

    beforeUnmount() {
        window.removeEventListener('scroll', this.handleScroll)

        window.removeEventListener('touchstart', this.touchStart)
        window.removeEventListener('touchmove', this.touchMove)
        window.removeEventListener('touchend', this.touchEnd)
    },

    methods: {

        // =====================
        // 初始化加载
        // =====================
        async loadInitial() {
            const { data } = await supabase
                .from('products')
                .select(`
          id,
          title,
          price,
          description,
          master_name,
          temple,
          created_at,
          updated_at,
          product_images(image_url)
        `)
                .order('created_at', { ascending: false })
                .limit(this.pageSize)

            const mapped = (data || []).map(item => this.transform(item))

            this.posts = mapped
            this.cache.pages[0] = mapped

            this.lastSeenTime = this.getLatestTime(mapped)
        },

        // =====================
        // 分页加载（缓存 + 冷加载）
        // =====================
        async loadMore() {
            if (this.loading || this.finished) return

            if (this.cache.pages[this.page]) {
                this.posts.push(...this.cache.pages[this.page])
                this.page++
                return
            }

            this.loading = true

            const from = this.page * this.pageSize
            const to = from + this.pageSize - 1

            const { data } = await supabase
                .from('products')
                .select(`
          id,
          title,
          price,
          description,
          master_name,
          temple,
          created_at,
          updated_at,
          product_images(image_url)
        `)
                .order('created_at', { ascending: false })
                .range(from, to)

            const mapped = (data || []).map(item => this.transform(item))

            this.cache.pages[this.page] = mapped

            this.posts.push(...mapped)

            if (mapped.length < this.pageSize) {
                this.finished = true
            }

            this.page++
            this.loading = false
        },

        // =====================
        // 增量刷新（只拉新数据）
        // =====================
        async refreshNew() {
            if (this.refreshing || !this.lastSeenTime) return

            this.refreshing = true

            const { data } = await supabase
                .from('products')
                .select(`
          id,
          title,
          price,
          description,
          master_name,
          temple,
          created_at,
          updated_at,
          product_images(image_url)
        `)
                .or(`created_at.gt.${this.lastSeenTime},updated_at.gt.${this.lastSeenTime}`)
                .order('created_at', { ascending: false })

            const mapped = (data || []).map(item => this.transform(item))

            if (mapped.length > 0) {

                // 去重
                const exist = new Set(this.posts.map(p => p.id))
                const filtered = mapped.filter(p => !exist.has(p.id))

                this.posts = [...filtered, ...this.posts]

                this.lastSeenTime = this.getLatestTime(this.posts)
            }

            this.refreshing = false
        },

        // =====================
        // touch 下拉刷新
        // =====================
        touchStart(e) {
            if (window.scrollY > 0) return

            this.startY = e.touches[0].clientY
            this.pulling = true
        },

        touchMove(e) {
            if (!this.pulling) return

            const diff = e.touches[0].clientY - this.startY
            this.pullDistance = Math.max(0, Math.min(diff, 120))
        },

        async touchEnd() {
            if (!this.pulling) return

            if (this.pullDistance > 80) {
                await this.refreshNew()
            }

            this.pullDistance = 0
            this.pulling = false
        },

        // =====================
        // scroll 加载
        // =====================
        handleScroll() {
            const scrollTop = window.scrollY
            const windowHeight = window.innerHeight
            const docHeight = document.documentElement.scrollHeight

            if (scrollTop + windowHeight >= docHeight - 100) {
                this.loadMore()
            }
        },

        // =====================
        // 工具函数
        // =====================
        transform(item) {
            return {
                id: item.id,
                image: item.product_images?.[0]?.image_url,
                title: item.title,
                price: item.price,
                master_name: item.master_name,
                temple: item.temple,
                created_at: item.created_at,
                updated_at: item.updated_at,
                description: item.description
            }
        },

        getLatestTime(list) {
            if (!list.length) return null
            return list[0].created_at
        }
    }
}
</script>

<template>
    <div>
        <NavBar />
        <div class="overflow-hidden transition-all duration-300 text-center text-gray-500"
            :style="{ height: pullDistance + 'px' }">
            <div v-if="refreshing">
                刷新中...
            </div>
            <div v-else-if="pullDistance > 80">
                松开刷新
            </div>
            <div v-else>
                下拉刷新
            </div>
        </div>
        <div class="pt-19 columns-2 gap-1 mx-1">

            <AmuletCard v-for="post in posts" :key="post.id" :post=post class="mb-1" />
            <div v-if="loading" class="text-center py-4 text-gray-400">
                加载中...
            </div>

            <!-- end -->
            <div v-if="finished" class="text-center py-4 text-gray-400">
                没有更多了
            </div>
        </div>
    </div>
</template>