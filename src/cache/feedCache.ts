export interface FeedPost {
    id: number
    image: string
    title: string
    description: string
    price: number
    master_name: string
    temple: string
    has_certificate: boolean
}

export const feedCache: {
    posts: FeedPost[]
    scrollY: number
    finished: boolean
    lastSeenTime: string | null
    cursorCreatedAt: string | null
    cursorId: number | null
} = {

    posts: [],

    scrollY: 0,

    finished: false,

    lastSeenTime: null,

    cursorCreatedAt: null,

    cursorId: null
}