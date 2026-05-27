<script setup lang="ts">
import { ref, onMounted, watch, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { supabase } from '../lib/supabase'
import { useToast } from 'vue-toastification'
import AmuletCard from '../components/AmuletCard.vue'

import { Swiper, SwiperSlide } from 'swiper/vue'
import { Pagination, Zoom } from 'swiper/modules'
import { feedCache } from '../cache/feedCache.ts'

import 'swiper/css'
import 'swiper/css/pagination'
import 'swiper/css/zoom'

const lastVoteTime = ref(0)

// =====================
// router
// =====================
const route = useRoute()
const router = useRouter()
const toast = useToast()

watch(() => route.params.id, async (newId) => {
    if (!newId) return

    loading.value = true

    post.value = null

    await Promise.all([
        loadDetail(),
        loadRecommend(),
        loadVotes()
    ])
})
const id = computed(() => Number(route.params.id))

// =====================
// state
// =====================
const loading = ref(true)

const post = ref<any>(null)

const recommends = ref<any[]>([])

const realCount = ref(0)
const fakeCount = ref(0)
const showVoteModal = ref(false)
const pendingVote = ref<boolean | null>(null)

const getUser = async () => {
    const { data: { session } } = await supabase.auth.getSession()
    return session?.user || null
}

// =====================
// image load
// =====================
const onImgLoad = (e: Event) => {
    const el = e.target as HTMLImageElement
    el.classList.add('loaded')
}

// =====================
// load detail
// =====================
const loadDetail = async () => {
    post.value = null
    // =====================
    // CACHE HIT
    // =====================

    const cached =
        feedCache.posts.find(
            (p: any) => p.id === id.value
        )

    if (cached) {

        post.value = {
            ...cached,
            imageList: [cached.image]
        }

        loading.value = false

    }

    // =====================
    // DB FETCH
    // only for full images
    // =====================

    const { data, error } = await supabase
        .from('products')
        .select(`
        year_be,
        year_ad,
        certificate_type,
        product_images(image_url)
    `)
        .eq('id', id.value)
        .single()

    if (error) {

        loading.value = false
        return
    }

    // merge
    post.value = {

        ...(post.value || {}),

        year_be:
            data.year_be,

        year_ad:
            data.year_ad,

        certificate_type:
            data.certificate_type,

        imageList:
            data.product_images?.map(
                (i: any) => i.image_url
            ) || [post.value.image]
    }

    loading.value = false
}

// =====================
// recommend
// =====================
const loadRecommend = () => {
    const exist = new Set<number>()

    recommends.value =
        [...feedCache.posts]
            .filter(
                (p: any) => {// 不推荐当前帖子
                    if (p.id === id.value) {
                        return false
                    }

                    // 去重
                    if (exist.has(p.id)) {
                        return false
                    }

                    exist.add(p.id)

                    return true
                }
            )
            .sort(() => Math.random() - 0.5)
            .slice(0, 10)
}

// =====================
// load votes
// =====================
const loadVotes = async () => {

    const { data, error } = await supabase
        .from('product_votes')
        .select('vote')
        .eq('product_id', id.value)

    if (error) {

        return
    }

    realCount.value =
        data?.filter((v: any) => v.vote === true).length || 0

    fakeCount.value =
        data?.filter((v: any) => v.vote === false).length || 0
}

const voteTotal = computed(() =>
    realCount.value + fakeCount.value
)

// =====================
// init
// =====================
onMounted(async () => {

    await Promise.all([
        loadDetail(),
        loadRecommend(),
        loadVotes()
    ])

})

// =====================
// vote
// =====================
const vote = async (isReal: boolean) => {
    const user = await getUser()
    if (!user) return

    const { data: existingVote } = await supabase
        .from('product_votes')
        .select('id, vote')
        .eq('product_id', id.value)
        .eq('user_id', user.id)
        .maybeSingle()

    if (!existingVote) {
        await insertVote(user.id, isReal)
        return
    }

    if (existingVote.vote === isReal) {
        toast.clear()
        toast.info('已投过')
        return
    }

    pendingVote.value = isReal
    showVoteModal.value = true
}

const confirmVoteChange = async () => {
    const user = await getUser()
    if (!user) return

    await supabase
        .from('product_votes')
        .update({
            vote: pendingVote.value,
            updated_at: new Date()
        })
        .eq('product_id', id.value)
        .eq('user_id', user.id)

    toast.clear()
    toast.success('已更新')

    showVoteModal.value = false
    pendingVote.value = null

    await loadVotes()
}

const insertVote = async (userId: string, vote: boolean) => {
    await supabase.from('product_votes').insert({
        product_id: id.value,
        user_id: userId,
        vote
    })

    toast.clear()
    toast.success('投票成功')
    await loadVotes()
}

const closeVoteModal = () => {
    showVoteModal.value = false
    pendingVote.value = null
    const now = Date.now()

    if (now - lastVoteTime.value < 10000) {
        const remain =
            Math.ceil(
                (10000 - (now - lastVoteTime.value)) / 1000
            )
        toast.clear()
        toast.info(`${remain}s 后再尝试`)

        return
    }
}
const formatPrice = (val: number | null) => {
    const num = Number(val)
    if (!Number.isFinite(num)) return '-'
    return num.toLocaleString()
}
</script>

<template>

    <div class="min-h-screen bg-[#f5f5f5] pb-28">

        <!-- ================= TOP BAR ================= -->

        <div class="fixed top-0 left-0 w-full h-14 bg-white z-50 flex items-center justify-between px-4 shadow-sm">

            <button @click="router.back()" class="text-base">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke-width="3"
                    stroke="currentColor" class="w-7 h-7">
                    <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                </svg>
            </button>

            <!-- bell -->
            <svg width="30" height="30" viewBox="1 0 35 32" fill="none" xmlns="http://www.w3.org/2000/svg">
                <path
                    d="M20.0229 28C19.7665 28.4041 19.3985 28.7395 18.9557 28.9727C18.513 29.2059 18.011 29.3286 17.5 29.3286C16.989 29.3286 16.487 29.2059 16.0443 28.9727C15.6015 28.7395 15.2335 28.4041 14.9771 28M26.25 10.6667C26.25 8.54493 25.3281 6.5101 23.6872 5.00981C22.0462 3.50952 19.8206 2.66666 17.5 2.66666C15.1794 2.66666 12.9538 3.50952 11.3128 5.00981C9.67187 6.5101 8.75 8.54493 8.75 10.6667C8.75 20 4.375 22.6667 4.375 22.6667H30.625C30.625 22.6667 26.25 20 26.25 10.6667Z"
                    stroke="#1E1E1E" stroke-width="4" stroke-linecap="round" stroke-linejoin="round" />
            </svg>

        </div>

        <!-- ================= LOADING ================= -->

        <div v-if="loading" class="pt-20 p-4">

            <div class="w-full h-80 bg-gray-200 animate-pulse rounded-xl"></div>

            <div class="mt-4 h-6 bg-gray-200 rounded animate-pulse"></div>

            <div class="mt-2 h-4 bg-gray-200 rounded animate-pulse w-1/2"></div>

        </div>

        <!-- ================= CONTENT ================= -->

        <div v-else>

            <!-- ================= IMAGE ================= -->

            <div class="relative mt-14">

                <Swiper :modules="[Pagination, Zoom]" :pagination="{ clickable: true }" :zoom="true" :touch-ratio="1"
                    :simulate-touch="true" class="aspect-square bg-black">

                    <SwiperSlide v-for="img in post.imageList" :key="img">

                        <div class="swiper-zoom-container">

                            <img :src="img" loading="lazy" decoding="async"
                                class="blur-img w-full h-full object-contain" @load="onImgLoad" />

                        </div>

                    </SwiperSlide>

                </Swiper>

                <!-- badge -->
                <div v-if="post.has_certificate"
                    class="absolute top-10 right-2 rotate-35 text-[#FC5555] px-3 py-1 text-base z-20">

                    真假审核通过

                </div>

            </div>

            <!-- ================= INFO ================= -->

            <div class="bg-white p-4 space-y-3">

                <div class="text-4xl font-bold text-red-500">
                    {{ post.price ? '&#3647;' + formatPrice(post.price) : "仅展示" }}
                </div>

                <div class="text-2xl font-bold">
                    {{ post.title }}
                </div>

                <div class="text-sm text-gray-500">
                    佛历 {{ post.year_be }} ｜ 公历 {{ post.year_ad }}
                </div>

                <div class="text-sm">
                    {{ post.master_name }} · {{ post.temple }} · {{ post.certificate_type || '无证书' }}
                </div>

                <div class="text-sm leading-6 text-gray-700 max-h-24 overflow-y-auto pr-1">
                    {{ post.description }}
                </div>

            </div>

            <!-- ================= RECOMMEND ================= -->

            <div class="mt-3 bg-white p-4">

                <div class="font-bold mb-3 text-lg">
                    相关推荐
                </div>

                <div class="flex overflow-x-auto gap-3 no-scrollbar pb-2">

                    <div v-for="r in recommends" :key="r.id" class="w-40 min-w-40 flex-shrink-0">

                        <AmuletCard :post="r" />

                    </div>

                </div>

            </div>

            <!-- ================= VOTE ================= -->

            <div class="my-3 bg-white p-4">

                <div class="font-bold text-lg mb-3">
                    真伪投票
                </div>

                <div class="relative w-full h-14 rounded-full overflow-hidden bg-gray-200">

                    <!-- 视觉层 -->
                    <div class="absolute left-0 top-0 h-full bg-green-500 transition-all duration-300" :style="{
                        width: `${voteTotal
                            ? (realCount / voteTotal) * 100
                            : 50
                            }%`
                    }" />

                    <div class="absolute right-0 top-0 h-full bg-red-500 transition-all duration-300" :style="{
                        width: `${voteTotal
                            ? (fakeCount / voteTotal) * 100
                            : 50
                            }%`
                    }" />

                    <!-- 点击层 -->
                    <button @click="vote(true)" class="absolute left-0 top-0 w-1/2 h-full z-20" />

                    <button @click="vote(false)" class="absolute right-0 top-0 w-1/2 h-full z-20" />

                    <!-- 左 -->
                    <div
                        class="absolute left-4 top-1/2 -translate-y-1/2 text-white font-bold text-sm z-10 pointer-events-none">
                        真
                        {{
                            voteTotal
                                ? Math.round(
                                    (realCount / voteTotal) * 100
                                )
                                : 0
                        }}%
                    </div>

                    <!-- 右 -->
                    <div
                        class="absolute right-4 top-1/2 -translate-y-1/2 text-white font-bold text-sm z-10 pointer-events-none">
                        假
                        {{
                            voteTotal
                                ? Math.round(
                                    (fakeCount / voteTotal) * 100
                                )
                                : 0
                        }}%
                    </div>

                    <!-- 中 -->
                    <div class="absolute inset-0 flex flex-col items-center justify-center z-10 pointer-events-none">

                        <div class="text-xs font-semibold text-white">
                            投票数
                        </div>

                        <div class="text-[10px] text-white/90">
                            {{ voteTotal }} 人参与
                        </div>

                    </div>

                </div>

            </div>

        </div>

        <!-- ================= BOTTOM BAR ================= -->

        <div class="fixed bottom-0 left-0 w-full bg-[#EEEEEE] flex items-center h-16 z-50">

            <button class="flex-1 h-full text-sm">
                联系商家
            </button>

            <button class="flex-1 h-full text-sm">
                咨询问题
            </button>

            <button
                class="flex-[2] h-full bg-gradient-to-r from-[#da6501] via-[#f3811c] to-orange-500 text-white font-bold">
                立即下单
            </button>

        </div>

    </div>
    <Teleport to="body">

        <div v-if="showVoteModal" class="fixed inset-0 z-[999] bg-black/50 flex items-center justify-center">

            <div class="w-[85%] bg-white rounded-2xl p-5">

                <div class="text-lg font-bold">
                    更改投票？
                </div>

                <div class="text-sm text-gray-500 mt-2">
                    你已经投过票，是否更改想法？
                </div>

                <div class="flex gap-3 mt-5">

                    <button @click="closeVoteModal" class="flex-1 h-11 rounded-xl bg-gray-200">
                        取消
                    </button>

                    <button @click="confirmVoteChange" class="flex-1 h-11 rounded-xl bg-black text-white">
                        确认
                    </button>

                </div>

            </div>

        </div>

    </Teleport>

</template>

<style scoped>
.blur-img {
    filter: blur(10px);
    transition: filter 0.3s ease;
}

.blur-img.loaded {
    filter: blur(0);
}

.no-scrollbar::-webkit-scrollbar {
    display: none;
}
</style>