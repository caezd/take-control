import { SUPABASE_URL, FORUM_SHARED_SECRET } from "../config.js";

const EDGE_FUNCTION_URL = `${SUPABASE_URL}/functions/v1/forum-auth`;

async function computeHmac(data, secret) {
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
        "raw",
        encoder.encode(secret),
        { name: "HMAC", hash: "SHA-256" },
        false,
        ["sign"],
    );
    const sig = await crypto.subtle.sign("HMAC", key, encoder.encode(data));
    return Array.from(new Uint8Array(sig))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

export async function authenticateForumUser(supabase) {
    const ud = window._userdata;

    if (!ud?.session_logged_in) return null;

    const { user_id, username, user_level, user_lang } = ud;
    const timestamp = Date.now();
    const hmac = await computeHmac(`${user_id}:${timestamp}`, FORUM_SHARED_SECRET);

    let response;
    try {
        response = await fetch(EDGE_FUNCTION_URL, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ user_id, username, user_level, user_lang, hmac, timestamp }),
        });
    } catch (err) {
        console.error("[take-control] Edge Function unreachable:", err);
        return null;
    }

    if (!response.ok) {
        console.error("[take-control] Auth failed:", await response.text());
        return null;
    }

    const { access_token, refresh_token } = await response.json();

    const { data, error } = await supabase.auth.setSession({ access_token, refresh_token });
    if (error) {
        console.error("[take-control] Session error:", error);
        return null;
    }

    return data.user;
}
