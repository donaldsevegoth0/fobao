<script>
import AmuletCard from '../components/AmuletCard.vue'
import NavBar from '../components/NavBar.vue'

import { supabase } from '../lib/supabase'
import { feedCache } from '../cache/feedCache'

export default {

    components: {
        NavBar,
        AmuletCard
    },

    data() {

        return {

            // =====================
            // feed
            // =====================
            posts: [],

            // =====================
            // states
            // =====================
            loading: false,
            refreshing: false,
            finished: false,

            // =====================
            // pagination
            // =====================
            pageSize: 10,

            // newest feed time
            lastSeenTime: null,

            // cursor pagination
            cursorCreatedAt: null,
            cursorId: null,

            // =====================
            // pull refresh
            // =====================
            pullDistance: 0,
            pulling: false,
            startY: 0,

            // =====================
            // scroll throttle
            // =====================
            ticking: false
        }
    },

    async mounted() {

        // =====================
        // GLOBAL CACHE HIT
        // =====================
        if (feedCache.posts.length > 0) {

            this.posts =
                [...feedCache.posts]

            this.finished =
                feedCache.finished

            this.lastSeenTime =
                feedCache.lastSeenTime

            this.cursorCreatedAt =
                feedCache.cursorCreatedAt

            this.cursorId =
                feedCache.cursorId

            // restore scroll
            setTimeout(() => {

                window.scrollTo(
                    0,
                    feedCache.scrollY || 0
                )

            }, 50)

        }

        // =====================
        // NO CACHE
        // =====================
        else {

            await this.loadInitial()
        }

        window.addEventListener(
            'scroll',
            this.handleScroll
        )
    },

    beforeUnmount() {

        // save scroll
        feedCache.scrollY =
            window.scrollY

        window.removeEventListener(
            'scroll',
            this.handleScroll
        )
    },

    methods: {

        // =====================
        // INITIAL LOAD
        // =====================
        async loadInitial() {

            this.loading = true

            const { data, error } =
                await supabase
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
                        has_certificate,
                        product_images(image_url)
                    `)
                    .order(
                        'created_at',
                        { ascending: false }
                    )
                    .order(
                        'id',
                        { ascending: false }
                    )
                    .limit(this.pageSize)

            if (error) {



                this.loading = false

                return
            }

            const mapped =
                (data || []).map(
                    item => this.transform(item)
                )

            this.posts = mapped

            this.finished =
                mapped.length < this.pageSize

            this.lastSeenTime =
                this.getLatestTime(mapped)

            // =====================
            // cursor
            // =====================
            const last =
                mapped[mapped.length - 1]

            if (last) {

                this.cursorCreatedAt =
                    last.created_at

                this.cursorId =
                    last.id
            }

            // =====================
            // sync global cache
            // =====================
            this.syncCache()

            this.loading = false
        },

        // =====================
        // CURSOR PAGINATION
        // =====================
        async loadMore() {

            if (
                this.loading ||
                this.finished
            ) return

            if (
                !this.cursorCreatedAt ||
                !this.cursorId
            ) return

            this.loading = true

            // =====================
            // TRUE CURSOR PAGINATION
            // =====================
            const { data, error } =
                await supabase
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
                        has_certificate,
                        product_images(image_url)
                    `)

                    .or(`created_at.lt.${this.cursorCreatedAt},and(created_at.eq.${this.cursorCreatedAt},id.lt.${this.cursorId})`)

                    .order(
                        'created_at',
                        { ascending: false }
                    )

                    .order(
                        'id',
                        { ascending: false }
                    )

                    .limit(this.pageSize)

            if (error) {



                this.loading = false

                return
            }

            const mapped =
                (data || []).map(
                    item => this.transform(item)
                )

            // =====================
            // dedupe
            // =====================
            const exist =
                new Set(
                    this.posts.map(
                        p => p.id
                    )
                )

            const filtered =
                mapped.filter(
                    p => !exist.has(p.id)
                )

            this.posts.push(...filtered)

            // =====================
            // update cursor
            // =====================
            const last =
                mapped[mapped.length - 1]

            if (last) {

                this.cursorCreatedAt =
                    last.created_at

                this.cursorId =
                    last.id
            }

            // =====================
            // end
            // =====================
            if (
                mapped.length <
                this.pageSize
            ) {

                this.finished = true
            }

            this.syncCache()

            this.loading = false
        },

        // =====================
        // INCREMENTAL REFRESH
        // =====================
        async refreshNew() {

            if (
                this.refreshing ||
                !this.lastSeenTime
            ) return

            this.refreshing = true

            const time = this.lastSeenTime


            const { data, error } =
                await supabase
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
                        has_certificate,
                        product_images(image_url)
                    `)

                    .or(
                        `created_at.gt.${time},updated_at.gt.${time}`
                    )

                    .order(
                        'created_at',
                        { ascending: false }
                    )

                    .order(
                        'id',
                        { ascending: false }
                    )

            if (error) {



                this.refreshing = false

                return
            }

            const mapped =
                (data || []).map(
                    item => this.transform(item)
                )

            // =====================
            // dedupe
            // =====================
            const exist =
                new Set(
                    this.posts.map(
                        p => p.id
                    )
                )

            const filtered =
                mapped.filter(
                    p => !exist.has(p.id)
                )

            if (filtered.length > 0) {

                this.posts = [
                    ...filtered,
                    ...this.posts
                ]

                this.lastSeenTime =
                    this.getLatestTime(
                        this.posts
                    )

                this.syncCache()
            }

            this.refreshing = false
        },

        // =====================
        // PULL REFRESH
        // =====================
        touchStart(e) {

            if (
                window.scrollY > 0
            ) return

            this.startY =
                e.touches[0].clientY

            this.pulling = true
        },

        touchMove(e) {

            if (!this.pulling)
                return

            const diff =
                e.touches[0].clientY -
                this.startY

            this.pullDistance =
                Math.max(
                    0,
                    Math.min(diff, 120)
                )
        },

        async touchEnd() {

            if (!this.pulling)
                return

            if (
                this.pullDistance > 80
            ) {

                await this.refreshNew()
            }

            this.pullDistance = 0

            this.pulling = false
        },

        // =====================
        // RAF SCROLL
        // =====================
        handleScroll() {

            feedCache.scrollY =
                window.scrollY

            if (this.ticking)
                return

            this.ticking = true

            requestAnimationFrame(() => {

                const scrollTop =
                    window.scrollY

                const windowHeight =
                    window.innerHeight

                const docHeight =
                    document.documentElement
                        .scrollHeight

                if (
                    scrollTop +
                    windowHeight >=
                    docHeight - 100
                ) {

                    this.loadMore()
                }

                this.ticking = false
            })
        },

        // =====================
        // TRANSFORM
        // =====================
        transform(item) {

            return {

                id: item.id,

                image:
                    item.product_images?.[0]
                        ?.image_url || '',

                title:
                    item.title,

                price:
                    item.price,

                description:
                    item.description,

                master_name:
                    item.master_name,

                temple:
                    item.temple,

                created_at:
                    item.created_at,

                updated_at:
                    item.updated_at,

                has_certificate:
                    item.has_certificate
            }
        },

        // =====================
        // latest feed time
        // =====================
        getLatestTime(list) {

            if (!list.length)
                return null

            return list[0].created_at
        },

        // =====================
        // GLOBAL CACHE SYNC
        // =====================
        syncCache() {

            feedCache.posts =
                [...this.posts]

            feedCache.finished =
                this.finished

            feedCache.lastSeenTime =
                this.lastSeenTime

            feedCache.cursorCreatedAt =
                this.cursorCreatedAt

            feedCache.cursorId =
                this.cursorId
        }
    }
}
</script>

<template>

    <div @touchstart="touchStart" @touchmove="touchMove" @touchend="touchEnd">

        <NavBar />

        <!-- =====================
        PULL REFRESH UI
        ====================== -->

        <div class="
                fixed
                top-16
                left-0
                w-full
                z-50
                flex
                justify-center
                pointer-events-none
                transition-all
                duration-200
            " :style="{
                transform:
                    `translateY(${pullDistance}px)`
            }">

            <div v-if="
                pullDistance > 0 ||
                refreshing
            " class="
                    bg-white
                    shadow-md
                    px-4
                    py-2
                    rounded-full
                    text-sm
                ">

                {{
                    refreshing
                        ? '刷新中...'
                        : pullDistance > 80
                            ? '释放刷新'
                            : '下拉刷新'
                }}

            </div>
        </div>

        <!-- =====================
        FEED
        ====================== -->

        <div class="
                pt-20
                columns-2
                gap-2
                mx-2
            ">

            <AmuletCard v-for="post in posts" :key="post.id" :post="post" class="
                    mb-2
                    break-inside-avoid
                " />

        </div>

        <!-- =====================
        LOADING
        ====================== -->

        <div v-if="loading" class="
                text-center
                py-4
                text-gray-400
            ">
            加载中...
        </div>

        <!-- =====================
        END
        ====================== -->

        <div v-if="finished" class="
                text-center
                py-4
                text-gray-400
            ">
            没有更多了
        </div>

    </div>

</template>