<script setup lang="ts">
import { computed } from 'vue';
import { useRouter, useRoute } from 'vue-router'

const router = useRouter()
const route = useRoute()

const props = defineProps<{
    post: {
        id: number
        image: string | ""
        title: string
        description: string | null
        price: number | null
        master_name: string | null
        temple: string | null
        has_certificate: boolean
    }

}>()
const goDetail = () => {
    router.push(`/product/${props.post.id}`)
}
const isDetailPage = computed
    (() => route.path.includes('/product/'))

const formatPrice = (val: number | null) => {
    const num = Number(val)
    if (!Number.isFinite(num)) return '-'
    return num.toLocaleString()
}
</script>

<template>
    <div class="w-full overflow-hidden bg-[#EEEEEE]" @click="goDetail">

        <img :src="post.image" loading="lazy" :class="[isDetailPage ? 'w-full h-[20vh] object-cover' : 'object-cover']">

        <div class="p-3 flex flex-row">
            <!-- 左侧 -->
            <div class="w-1/2 flex flex-col overflow-hidden">

                <div class="text-base truncate">
                    {{ post.title }}
                </div>

                <div class="text-xs truncate text-gray-500">
                    {{ post.master_name }} {{ post.temple }} {{ post.has_certificate ? "有卡" : "无卡" }}
                </div>

                <div class="text-xs truncate text-gray-500">
                    {{ post.description }}
                </div>
            </div>

            <!-- 右侧 -->
            <div class="w-1/2 flex justify-end items-center">
                <div class="price font-bold text-2xl">
                    {{ post.price ? formatPrice(post.price) : "仅展示" }}
                </div>
            </div>
        </div>

    </div>
</template>