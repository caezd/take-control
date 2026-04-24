<template>
    <div class="tc-notif" v-click-outside="close">
        <button class="tc-notif__bell" @click="toggle" :aria-label="`${unreadCount} notifications`">
            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                <path d="M13.73 21a2 2 0 0 1-3.46 0" />
            </svg>
            <span v-if="unreadCount > 0" class="tc-notif__badge">
                {{ unreadCount > 99 ? '99+' : unreadCount }}
            </span>
        </button>

        <div v-if="open" class="tc-notif__panel">
            <div class="tc-notif__header">
                <span>Notifications</span>
                <button v-if="unreadCount > 0" class="tc-notif__mark-all" @click="markAllRead">
                    Tout marquer lu
                </button>
            </div>

            <div class="tc-notif__list">
                <div v-if="loading" class="tc-notif__state">Chargement…</div>

                <div v-else-if="notifications.length === 0" class="tc-notif__state">
                    Aucune notification
                </div>

                <div v-else>
                    <div
                        v-for="n in notifications"
                        :key="n.id"
                        class="tc-notif__item"
                        :class="{ 'tc-notif__item--unread': !n.read_at }"
                        @click="handleClick(n)"
                    >
                        <span class="tc-notif__type-dot" :data-type="n.type"></span>
                        <div class="tc-notif__item-content">
                            <span class="tc-notif__item-title">{{ n.title }}</span>
                            <span v-if="n.body" class="tc-notif__item-body">{{ n.body }}</span>
                            <span class="tc-notif__item-time">{{ formatTime(n.created_at) }}</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script>
import { defineComponent, ref, computed, onMounted, onUnmounted } from 'vue';

export default defineComponent({
    name: 'NotificationCenter',

    props: {
        supabase: { type: Object, required: true },
        forumUserId: { type: Number, required: true },
    },

    setup(props) {
        const open = ref(false);
        const loading = ref(true);
        const notifications = ref([]);
        let realtimeChannel = null;

        const unreadCount = computed(() =>
            notifications.value.filter((n) => !n.read_at).length
        );

        function toggle() {
            open.value = !open.value;
        }

        function close() {
            open.value = false;
        }

        async function fetchNotifications() {
            loading.value = true;
            const { data, error } = await props.supabase
                .from('notifications')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(30);

            if (!error) notifications.value = data;
            loading.value = false;
        }

        async function handleClick(n) {
            if (!n.read_at) await markRead(n.id);
            if (n.url) window.location.href = n.url;
        }

        async function markRead(id) {
            const now = new Date().toISOString();
            await props.supabase
                .from('notifications')
                .update({ read_at: now })
                .eq('id', id);

            const target = notifications.value.find((n) => n.id === id);
            if (target) target.read_at = now;
        }

        async function markAllRead() {
            const now = new Date().toISOString();
            const unreadIds = notifications.value
                .filter((n) => !n.read_at)
                .map((n) => n.id);

            if (unreadIds.length === 0) return;

            await props.supabase
                .from('notifications')
                .update({ read_at: now })
                .in('id', unreadIds);

            notifications.value.forEach((n) => {
                if (!n.read_at) n.read_at = now;
            });
        }

        function formatTime(iso) {
            const diff = Date.now() - new Date(iso).getTime();
            const m = Math.floor(diff / 60000);
            if (m < 1) return "À l'instant";
            if (m < 60) return `il y a ${m} min`;
            const h = Math.floor(m / 60);
            if (h < 24) return `il y a ${h}h`;
            return new Date(iso).toLocaleDateString('fr-FR');
        }

        function subscribeRealtime() {
            realtimeChannel = props.supabase
                .channel(`notif:${props.forumUserId}`)
                .on(
                    'postgres_changes',
                    {
                        event: 'INSERT',
                        schema: 'public',
                        table: 'notifications',
                        filter: `forum_user_id=eq.${props.forumUserId}`,
                    },
                    (payload) => {
                        notifications.value.unshift(payload.new);
                    }
                )
                .subscribe();
        }

        onMounted(async () => {
            await fetchNotifications();
            subscribeRealtime();
        });

        onUnmounted(() => {
            if (realtimeChannel) props.supabase.removeChannel(realtimeChannel);
        });

        return {
            open, loading, notifications, unreadCount,
            toggle, close, handleClick, markAllRead, formatTime,
        };
    },

    directives: {
        'click-outside': {
            mounted(el, binding) {
                el._clickOutside = (e) => {
                    if (!el.contains(e.target)) binding.value();
                };
                document.addEventListener('click', el._clickOutside);
            },
            unmounted(el) {
                document.removeEventListener('click', el._clickOutside);
            },
        },
    },
});
</script>

<style>
.tc-notif {
    position: relative;
    display: inline-block;
}

.tc-notif__bell {
    position: relative;
    background: none;
    border: none;
    cursor: pointer;
    padding: 6px;
    color: #555;
    line-height: 1;
}

.tc-notif__bell:hover {
    color: #000099;
}

.tc-notif__badge {
    position: absolute;
    top: 0;
    right: 0;
    background: #e53e3e;
    color: #fff;
    font-size: 10px;
    font-weight: 700;
    min-width: 16px;
    height: 16px;
    border-radius: 8px;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 0 3px;
    line-height: 1;
}

.tc-notif__panel {
    position: absolute;
    right: 0;
    top: calc(100% + 8px);
    width: 320px;
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.12);
    z-index: 9999;
    overflow: hidden;
}

.tc-notif__header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 12px 16px;
    border-bottom: 1px solid #e2e8f0;
    font-weight: 600;
    font-size: 14px;
    color: #1a202c;
}

.tc-notif__mark-all {
    background: none;
    border: none;
    cursor: pointer;
    font-size: 12px;
    color: #000099;
    padding: 0;
}

.tc-notif__mark-all:hover {
    text-decoration: underline;
}

.tc-notif__list {
    max-height: 400px;
    overflow-y: auto;
}

.tc-notif__state {
    padding: 24px 16px;
    text-align: center;
    color: #718096;
    font-size: 13px;
}

.tc-notif__item {
    display: flex;
    gap: 10px;
    padding: 12px 16px;
    cursor: pointer;
    border-bottom: 1px solid #f7fafc;
    transition: background 0.1s;
}

.tc-notif__item:hover {
    background: #f7fafc;
}

.tc-notif__item--unread {
    background: #ebf4ff;
}

.tc-notif__item--unread:hover {
    background: #dbeafe;
}

.tc-notif__type-dot {
    flex-shrink: 0;
    width: 8px;
    height: 8px;
    border-radius: 50%;
    margin-top: 5px;
    background: #cbd5e0;
}

.tc-notif__type-dot[data-type="reply"]   { background: #48bb78; }
.tc-notif__type-dot[data-type="quote"]   { background: #4299e1; }
.tc-notif__type-dot[data-type="mention"] { background: #ed8936; }
.tc-notif__type-dot[data-type="pm"]      { background: #9f7aea; }
.tc-notif__type-dot[data-type="system"]  { background: #fc8181; }

.tc-notif__item-content {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
}

.tc-notif__item-title {
    font-size: 13px;
    font-weight: 500;
    color: #2d3748;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.tc-notif__item-body {
    font-size: 12px;
    color: #718096;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}

.tc-notif__item-time {
    font-size: 11px;
    color: #a0aec0;
}
</style>
