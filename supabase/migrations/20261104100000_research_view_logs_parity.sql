-- Parity: research_view_logs and increment_research_views(uuid, uuid).
-- Both were created directly on production for commit 06c5921 (never via
-- migration), so the web and mobile callers that pass p_user_id fail with
-- PGRST202 on any database built from this repo, and views stay at 0.
-- Reconstructed from the production catalog (2026-09-29).
--
-- Guards: each block is skipped when its object already exists, so this file
-- is a no-op on production. It does not touch production's function body or
-- policies, and the one-argument overload stays on both, matching
-- database.types.ts.
--
-- Deliberate differences from production, for databases built from this repo:
--   * No "anyone can insert view logs" policy (WITH CHECK true). Every write
--     goes through the SECURITY DEFINER function below, so direct inserts
--     would only let clients forge rows.
--   * p_user_id is accepted but not trusted. The function is callable by anon,
--     so the logged user comes from auth.uid(), as in log_research_download().
--     Both callers pass the session user, so the logged value is the same.
--   * The read policy's definition is not in the catalog dump (hash only). The
--     rank threshold below comes from its name, "staff and above".

do $$
begin
  if to_regclass('public.research_view_logs') is not null then
    raise notice 'research_view_logs exists - skipped';
    return;
  end if;

  create table public.research_view_logs (
    id          uuid        not null default gen_random_uuid(),
    research_id uuid        not null,
    user_id     uuid,
    viewed_at   timestamptz not null default now(),
    constraint research_view_logs_pkey primary key (id),
    constraint research_view_logs_research_id_fkey foreign key (research_id)
      references public.research_items (id) on delete cascade,
    constraint research_view_logs_user_id_fkey foreign key (user_id)
      references auth.users (id) on delete set null
  );

  create index research_view_logs_research_id_idx
    on public.research_view_logs (research_id);
  create index research_view_logs_viewed_at_idx
    on public.research_view_logs (viewed_at);

  alter table public.research_view_logs enable row level security;

  grant select on public.research_view_logs to authenticated;

  create policy "staff and above can read view logs"
    on public.research_view_logs
    for select using (public.user_max_role_rank() >= 20);
end;
$$;

do $$
begin
  if to_regprocedure('public.increment_research_views(uuid, uuid)') is not null then
    raise notice 'increment_research_views(uuid, uuid) exists - skipped';
    return;
  end if;

  create function public.increment_research_views(
    p_research_id uuid,
    p_user_id uuid default null
  )
  returns void
  language plpgsql
  security definer
  set search_path = public
  as $fn$
  begin
    update public.research_items
    set views = views + 1
    where id = p_research_id and status = 'published';

    if found then
      insert into public.research_view_logs (research_id, user_id)
      values (p_research_id, auth.uid());
    end if;
  end;
  $fn$;

  grant execute on function public.increment_research_views(uuid, uuid)
    to anon, authenticated;
end;
$$;
