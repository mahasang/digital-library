-- ============================================================================
-- Local-dev parity only — production already has equivalent coverage
--
-- Production (live) already has BOTH of these via other paths (confirmed by
-- dumping the live schema on 2026-09-02):
--   - "users can edit own comment"        FOR UPDATE USING (auth.uid() = user_id)
--   - "comments_delete_own_or_staff"      FOR DELETE (own OR staff rank >= 30)
--   - "users can delete own comment"      FOR DELETE USING (auth.uid() = user_id)
-- (See earlier finding: this project's ratings/comments schema has drifted
-- across two repos' migrations plus manual Dashboard edits — production is
-- not a clean match to either migration file.)
--
-- This LOCAL dev database was built purely from this repo's own
-- 20260901090000_ratings_comments.sql, which only had select+insert for
-- comments (edit/delete wasn't in scope yet at the time). Adding update/delete
-- here purely so local dev/testing has parity with what's actually already
-- live in production — NOT meant to be reconciled/pushed as-is, since pushing
-- would collide with the differently-named policies already on the remote.
-- ============================================================================
create policy "comments_update_own" on public.comments
  for update using (user_id = auth.uid()) with check (user_id = auth.uid());

create policy "comments_delete_own" on public.comments
  for delete using (user_id = auth.uid());
