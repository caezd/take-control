import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SHARED_SECRET = Deno.env.get("FORUM_SHARED_SECRET")!;
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const CORS = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type",
};

async function computeHmac(data: string, secret: string): Promise<string> {
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

function json(body: unknown, status = 200) {
    return new Response(JSON.stringify(body), {
        status,
        headers: { ...CORS, "Content-Type": "application/json" },
    });
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method !== "POST") return new Response("Method not allowed", { status: 405 });

    let payload: {
        user_id: number;
        username: string;
        user_level: number;
        user_lang: string;
        hmac: string;
        timestamp: number;
    };

    try {
        payload = await req.json();
    } catch {
        return json({ error: "Invalid JSON" }, 400);
    }

    const { user_id, username, user_level, user_lang, hmac, timestamp } = payload;

    if (!user_id || !hmac || !timestamp) {
        return json({ error: "Missing required fields" }, 400);
    }

    // Fenêtre anti-replay de 5 minutes
    if (Math.abs(Date.now() - timestamp) > 5 * 60 * 1000) {
        return json({ error: "Token expired" }, 401);
    }

    const expected = await computeHmac(`${user_id}:${timestamp}`, SHARED_SECRET);
    if (hmac !== expected) {
        return json({ error: "Invalid signature" }, 401);
    }

    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
        auth: { autoRefreshToken: false, persistSession: false },
    });

    const email = `${user_id}@fa.internal`;
    // Mot de passe déterministe lié au secret — jamais exposé côté client
    const password = await computeHmac(`pwd:${user_id}`, SHARED_SECRET);

    const app_metadata = { forum_user_id: user_id, username, user_level, user_lang };

    // Tentative de connexion (utilisateur déjà existant)
    const { data: signIn } = await admin.auth.signInWithPassword({ email, password });

    if (signIn?.session) {
        await admin.auth.admin.updateUserById(signIn.user.id, { app_metadata });
        return json({
            access_token: signIn.session.access_token,
            refresh_token: signIn.session.refresh_token,
        });
    }

    // Premier login — création du compte
    const { data: created, error: createError } = await admin.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata,
    });

    if (createError || !created?.user) {
        console.error("createUser error:", createError);
        return json({ error: "Failed to create user" }, 500);
    }

    const { data: newSignIn, error: newSignInError } = await admin.auth.signInWithPassword({
        email,
        password,
    });

    if (newSignInError || !newSignIn?.session) {
        console.error("signIn after create error:", newSignInError);
        return json({ error: "Failed to create session" }, 500);
    }

    return json({
        access_token: newSignIn.session.access_token,
        refresh_token: newSignIn.session.refresh_token,
    });
});
