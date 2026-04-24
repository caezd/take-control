-- Table des notifications
create table public.notifications (
    id            uuid primary key default gen_random_uuid(),
    forum_user_id integer not null,
    type          text not null,   -- 'reply' | 'quote' | 'mention' | 'pm' | 'system'
    title         text not null,
    body          text,
    url           text,
    read_at       timestamptz,
    created_at    timestamptz not null default now()
);

-- Index pour les requêtes fréquentes
create index notifications_forum_user_id_idx
    on public.notifications (forum_user_id, created_at desc);

-- RLS
alter table public.notifications enable row level security;

-- Un utilisateur ne voit que ses propres notifications
-- forum_user_id est stocké dans app_metadata du JWT (injecté par l'Edge Function)
create policy "select own notifications"
    on public.notifications for select
    using (
        forum_user_id = (auth.jwt() -> 'app_metadata' ->> 'forum_user_id')::integer
    );

-- Marquer comme lu : uniquement ses propres notifications
create policy "update own notifications"
    on public.notifications for update
    using (
        forum_user_id = (auth.jwt() -> 'app_metadata' ->> 'forum_user_id')::integer
    )
    with check (
        forum_user_id = (auth.jwt() -> 'app_metadata' ->> 'forum_user_id')::integer
    );

-- Insert réservé au service role (Edge Functions / triggers FA)
create policy "service role insert"
    on public.notifications for insert
    with check (auth.role() = 'service_role');
