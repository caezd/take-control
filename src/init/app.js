import { createApp } from "vue";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_URL, SUPABASE_ANON_KEY } from "../config.js";
import { authenticateForumUser } from "../auth/forumAuth.js";
import NotificationCenter from "../components/NotificationCenter.vue";

function domCleanUp() {
    document
        .querySelectorAll('div[style^="height:"')
        .forEach((el) => el.remove());
    document
        .querySelectorAll('[style="overflow:visible"]')
        .forEach((el) => el.remove());
}

function mountNotificationCenter(supabase, forumUserId) {
    const container = document.createElement("div");
    container.id = "tc-notification-center";
    document.body.appendChild(container);

    createApp(NotificationCenter, { supabase, forumUserId }).mount(container);
}

export async function initUI() {
    domCleanUp();

    if (!window._userdata?.session_logged_in) return;

    const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

    const user = await authenticateForumUser(supabase);
    if (!user) return;

    mountNotificationCenter(supabase, window._userdata.user_id);
}