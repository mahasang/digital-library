-- ============================================================================
-- ห้องสมุดดิจิทัลเพื่อเผยแพร่งานวิจัยขององค์กร — Phase 3: ระบบส่ง/อนุมัติงานวิจัย
--
-- เพิ่ม:
--   1. คอลัมน์ใหม่ใน research_items สำหรับข้อมูลลิขสิทธิ์และไฟล์แนบประกอบ
--   2. ตาราง approval_logs — บันทึกประวัติการเปลี่ยนสถานะทุกครั้งแบบอัตโนมัติ
--      ผ่าน trigger (เขียนไม่ได้โดยตรงจากฝั่งแอป เพื่อรักษาความถูกต้องของ log)
--   3. Trigger ที่บันทึกทั้ง approval_logs และ audit_logs ทุกครั้งที่ status เปลี่ยน
-- ============================================================================

-- ----------------------------------------------------------------------------
-- research_items: คอลัมน์เพิ่มเติมสำหรับฟอร์มส่งงานวิจัย
-- ----------------------------------------------------------------------------
alter table public.research_items
  add column copyright_note text,
  add column copyright_confirmed boolean not null default false,
  add column attachment_file text;

comment on column public.research_items.copyright_note is 'คำชี้แจง/ข้อมูลลิขสิทธิ์ที่ผู้ส่งกรอกในฟอร์มส่งงานวิจัย';
comment on column public.research_items.copyright_confirmed is 'ผู้ส่งยืนยันว่าเป็นเจ้าของลิขสิทธิ์และยินยอมให้เผยแพร่';
comment on column public.research_items.attachment_file is 'พาธไฟล์เอกสารประกอบการส่ง (เช่น หนังสือรับรองลิขสิทธิ์) ใน bucket submission-attachments';

-- ----------------------------------------------------------------------------
-- authors: เพิ่มชื่อหน่วยงานแบบข้อความอิสระ (ฟอร์มส่งงานวิจัยกรอกเป็นข้อความ
-- ไม่ได้เลือกจาก organizations โดยตรง) — organization_id ยังคงไว้สำหรับ
-- การเชื่อมโยงอย่างเป็นทางการในภายหลังโดยผู้ดูแลระบบ
-- ----------------------------------------------------------------------------
alter table public.authors
  add column organization_name text;

comment on column public.authors.organization_name is 'ชื่อหน่วยงานของผู้วิจัยแบบข้อความอิสระ ตามที่กรอกในฟอร์มส่งงานวิจัย';

-- ----------------------------------------------------------------------------
-- approval_logs: ประวัติการเปลี่ยนสถานะเอกสารทุกครั้ง (เขียนผ่าน trigger เท่านั้น)
-- ----------------------------------------------------------------------------
create table public.approval_logs (
  id uuid primary key default gen_random_uuid(),
  research_id uuid not null references public.research_items (id) on delete cascade,
  actor_id uuid references public.profiles (id) on delete set null,
  from_status text,
  to_status text not null,
  note text,
  created_at timestamptz not null default now()
);

comment on table public.approval_logs is 'ประวัติการเปลี่ยนสถานะเอกสารงานวิจัย บันทึกอัตโนมัติผ่าน trigger เมื่อ status เปลี่ยน';

create index idx_approval_logs_research_id on public.approval_logs (research_id, created_at desc);
create index idx_approval_logs_actor_id on public.approval_logs (actor_id);

-- ----------------------------------------------------------------------------
-- log_research_status_change(): บันทึก approval_logs + audit_logs อัตโนมัติ
-- ทุกครั้งที่ research_items.status เปลี่ยนแปลง (ไม่ว่าจะเปลี่ยนจากที่ใดในระบบ)
-- ----------------------------------------------------------------------------
create or replace function public.log_research_status_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if tg_op = 'UPDATE' and old.status is distinct from new.status then
    insert into public.approval_logs (research_id, actor_id, from_status, to_status, note)
    values (new.id, auth.uid(), old.status, new.status, new.review_note);

    insert into public.audit_logs (actor_id, action, entity_type, entity_id, metadata)
    values (
      auth.uid(),
      'research_status_change',
      'research_items',
      new.id,
      jsonb_build_object(
        'from_status', old.status,
        'to_status', new.status,
        'note', new.review_note
      )
    );
  end if;
  return new;
end;
$$;

create trigger trg_research_items_status_change
  after update on public.research_items
  for each row execute function public.log_research_status_change();

-- ----------------------------------------------------------------------------
-- RLS: approval_logs อ่านได้เฉพาะเจ้าของงานหรือ librarian/admin
-- ไม่ให้สิทธิ์ insert/update/delete แก่ anon/authenticated เลย — มีเพียง trigger
-- (ทำงานในฐานะเจ้าของตาราง ซึ่งข้าม RLS โดยธรรมชาติ) เท่านั้นที่เขียนได้
-- ----------------------------------------------------------------------------
alter table public.approval_logs enable row level security;

grant select on public.approval_logs to authenticated;

create policy "approval_logs_select" on public.approval_logs
  for select using (
    exists (
      select 1 from public.research_items ri
      where ri.id = research_id
        and (ri.submitted_by = auth.uid() or public.user_max_role_rank() >= 30)
    )
  );
