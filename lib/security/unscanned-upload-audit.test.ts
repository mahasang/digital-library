import { describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/database.types";
import {
  UNSCANNED_UPLOAD_AUDIT_ACTION,
  logUnscannedUploads,
} from "@/lib/security/unscanned-upload-audit.server";

function fakeSupabase() {
  const rows: Array<{ table: string; row: Record<string, unknown> }> = [];
  const client = {
    from: (table: string) => ({
      insert: async (row: Record<string, unknown>) => {
        rows.push({ table, row });
        return { error: null };
      },
    }),
  } as unknown as SupabaseClient<Database>;
  return { client, rows };
}

describe("logUnscannedUploads", () => {
  it("บันทึก audit log หนึ่งแถวต่อไฟล์ พร้อมผู้ทำรายการ ชนิดไฟล์ และพาธ (ไม่มีเนื้อไฟล์)", async () => {
    const { client, rows } = fakeSupabase();
    await logUnscannedUploads(client, "user-1", [
      { field: "cover", bucket: "research-covers", path: "user-1/cover.png" },
      { field: "attachment", bucket: "submission-attachments", path: "user-1/doc.pdf" },
    ]);

    expect(rows).toHaveLength(2);
    expect(rows[0].table).toBe("audit_logs");
    expect(rows[0].row).toMatchObject({
      actor_id: "user-1",
      action: UNSCANNED_UPLOAD_AUDIT_ACTION,
      entity_type: "storage_object",
      entity_id: null,
      metadata: {
        field: "cover",
        bucket: "research-covers",
        path: "user-1/cover.png",
        reason: "scanner_not_configured",
      },
    });
    expect(rows[1].row).toMatchObject({
      metadata: { field: "attachment", path: "user-1/doc.pdf" },
    });
  });

  it("ส่ง entityId ต่อให้เมื่อมี (กรณีแก้ไขงานเดิม)", async () => {
    const { client, rows } = fakeSupabase();
    await logUnscannedUploads(
      client,
      "user-1",
      [{ field: "cover", bucket: "research-covers", path: "p.png" }],
      "research-9"
    );
    expect(rows[0].row).toMatchObject({ entity_id: "research-9" });
  });

  it("ไม่มีไฟล์ที่ไม่ได้สแกน → ไม่เขียนอะไรเลย", async () => {
    const { client, rows } = fakeSupabase();
    await logUnscannedUploads(client, "user-1", []);
    expect(rows).toHaveLength(0);
  });

  it("ชื่อ action คงที่ตามที่เขียนไว้ในเอกสาร", () => {
    expect(UNSCANNED_UPLOAD_AUDIT_ACTION).toBe("file_upload_unscanned");
  });
});
