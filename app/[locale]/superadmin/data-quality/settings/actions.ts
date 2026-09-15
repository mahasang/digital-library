"use server";

import { revalidatePath } from "next/cache";
import { getTranslations } from "next-intl/server";
import { createClient } from "@/lib/supabase/server";
import { requireMinRank } from "@/lib/data/admin-guard.server";
import { logAudit } from "@/lib/data/audit.server";
import { toSafeErrorMessage } from "@/lib/errors/safe-message.server";
import { DEFAULT_DUPLICATE_DETECTION_WEIGHTS } from "@/lib/data/duplicate-detection-rules.server";
import { getDuplicateScanCandidatesCount } from "@/lib/data/duplicate-scan-candidates.server";
import { createBulkJobBatch } from "@/lib/jobs/bulk-batch.server";
import type { ActionResult } from "@/lib/actions/types";

const WEIGHT_FIELDS = [
  "weightTitle",
  "weightAuthor",
  "weightYear",
  "weightIdentifier",
  "weightFileHash",
] as const;

const THRESHOLD_LEVELS = ["low", "medium", "high"] as const;

type ParsedRuleValues = Record<string, number>;
type ParseResult = { ok: true; values: ParsedRuleValues } | { ok: false; result: ActionResult };

async function parseWeightsAndThresholds(formData: FormData): Promise<ParseResult> {
  const tSettings = await getTranslations("actionMessages.superadmin.dataQualitySettings");
  const values: ParsedRuleValues = {};

  for (const field of WEIGHT_FIELDS) {
    const raw = Number(formData.get(field));
    if (!Number.isFinite(raw) || raw < 0 || raw > 100) {
      return {
        ok: false,
        result: {
          status: "error",
          message: tSettings("weightOutOfRange", { field: tSettings(`weightFields.${field}`) }),
          fieldErrors: { [field]: [tSettings("mustBeNumber0to100")] },
        },
      };
    }
    values[field] = raw;
  }

  const sum = WEIGHT_FIELDS.reduce((total, field) => total + values[field], 0);
  if (Math.round(sum) !== 100) {
    return {
      ok: false,
      result: { status: "error", message: tSettings("weightSumInvalid", { sum }) },
    };
  }

  const thresholdLow = Number(formData.get("thresholdLow"));
  const thresholdMedium = Number(formData.get("thresholdMedium"));
  const thresholdHigh = Number(formData.get("thresholdHigh"));
  const thresholdValues = [thresholdLow, thresholdMedium, thresholdHigh];
  for (let i = 0; i < THRESHOLD_LEVELS.length; i++) {
    const v = thresholdValues[i];
    if (!Number.isFinite(v) || v < 0 || v > 100) {
      return {
        ok: false,
        result: {
          status: "error",
          message: tSettings("thresholdOutOfRange", {
            label: tSettings(`thresholdLabels.${THRESHOLD_LEVELS[i]}`),
          }),
        },
      };
    }
  }
  if (!(thresholdLow <= thresholdMedium && thresholdMedium <= thresholdHigh)) {
    return {
      ok: false,
      result: { status: "error", message: tSettings("thresholdOrder") },
    };
  }

  values.thresholdLow = thresholdLow;
  values.thresholdMedium = thresholdMedium;
  values.thresholdHigh = thresholdHigh;
  return { ok: true, values };
}

type CreateRuleVersionResult =
  | { ok: true; ruleId: string; version: number }
  | { ok: false; result: ActionResult };

async function createRuleVersion(
  auth: { userId: string },
  values: Record<string, number>
): Promise<CreateRuleVersionResult> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_duplicate_detection_rule_version", {
    p_weight_title: values.weightTitle,
    p_weight_author: values.weightAuthor,
    p_weight_year: values.weightYear,
    p_weight_identifier: values.weightIdentifier,
    p_weight_file_hash: values.weightFileHash,
    p_threshold_low: values.thresholdLow,
    p_threshold_medium: values.thresholdMedium,
    p_threshold_high: values.thresholdHigh,
  });

  if (error || !data) {
    const tSettings = await getTranslations("actionMessages.superadmin.dataQualitySettings");
    return {
      ok: false,
      result: {
        status: "error",
        message: toSafeErrorMessage(error, tSettings("ruleSaveFailed"), "createRuleVersion failed"),
      },
    };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "duplicate_detection_rules_update",
    entityType: "duplicate_detection_rules",
    entityId: data.id,
    metadata: { version: data.version, ...values },
  });

  revalidatePath("/superadmin/data-quality/settings");
  return { ok: true, ruleId: data.id, version: data.version };
}

/**
 * บันทึกเกณฑ์เวอร์ชันใหม่ — รองรับ 2 intent ผ่านปุ่ม submit สองปุ่มในฟอร์มเดียว
 * (name="intent" คนละ value, มาตรฐาน HTML ธรรมดา ไม่ต้องมี state/JS เพิ่ม):
 * "save_only" (ค่าเริ่มต้น พฤติกรรมเดิมทุกประการ) หรือ "save_and_rescan" ที่
 * สั่งสร้าง background job แบบ batch ให้สแกนงานวิจัยทั้งระบบซ้ำด้วยเกณฑ์ใหม่
 * ทันที (ไม่จำกัด 500 รายการ — ใช้โครงสร้าง bulk_enqueue coordinator เดิมจาก
 * ช่วงที่ 25 กับ filter ว่างเปล่า = ทุกรายการที่ไม่ถูกรวมไปแล้ว) **ไม่มีการรวม
 * หรือแก้ไขงานวิจัยอัตโนมัติใดๆ ทั้งสิ้น — เป็นแค่การตรวจสอบ+บันทึกคู่ที่น่าสงสัย
 * ใหม่เท่านั้น ผลตรวจเดิมจากเวอร์ชันก่อนหน้ายังคงอยู่ครบ ไม่ถูกลบ**
 */
export async function updateDuplicateDetectionRulesAction(
  _prevState: ActionResult,
  formData: FormData
): Promise<ActionResult> {
  const tSettings = await getTranslations("actionMessages.superadmin.dataQualitySettings");
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const parsed = await parseWeightsAndThresholds(formData);
  if (!parsed.ok) return parsed.result;

  const created = await createRuleVersion(auth, parsed.values);
  if (!created.ok) return created.result;

  const intent = formData.get("intent") === "save_and_rescan" ? "save_and_rescan" : "save_only";
  if (intent === "save_only") {
    return { status: "success", message: tSettings("savedVersion", { version: created.version }) };
  }

  const totalItems = await getDuplicateScanCandidatesCount({});
  if (totalItems === null) {
    return {
      status: "success",
      message: tSettings("savedVersionScanFailed", { version: created.version }),
    };
  }
  if (totalItems === 0) {
    return {
      status: "success",
      message: tSettings("savedVersionNoItems", { version: created.version }),
    };
  }

  const supabase = await createClient();
  const batchResult = await createBulkJobBatch({
    supabase,
    jobType: "duplicate_scan",
    filterSnapshot: { ruleVersionId: created.ruleId, ruleVersion: created.version },
    totalItems,
    createdBy: auth.userId,
  });

  if (!batchResult.ok) {
    return {
      status: "success",
      message: tSettings("savedVersionRetryFailed", { version: created.version }),
    };
  }
  if (!batchResult.isNew) {
    return {
      status: "success",
      message: tSettings("savedVersionAlreadyRunning", { version: created.version }),
    };
  }

  await logAudit(supabase, {
    actorId: auth.userId,
    action: "duplicate_scan_rescan_after_rule_change",
    entityType: "job_batches",
    entityId: batchResult.batchId,
    metadata: { ruleVersionId: created.ruleId, ruleVersion: created.version, totalItems },
  });

  revalidatePath("/superadmin/data-quality");
  return {
    status: "success",
    message: tSettings("savedVersionWithScan", { version: created.version, total: totalItems }),
  };
}

export async function resetDuplicateDetectionRulesToDefaultAction(
  _prevState: ActionResult,
  _formData: FormData
): Promise<ActionResult> {
  const tSettings = await getTranslations("actionMessages.superadmin.dataQualitySettings");
  const auth = await requireMinRank(50);
  if (!auth.ok) return auth.result;

  const created = await createRuleVersion(auth, { ...DEFAULT_DUPLICATE_DETECTION_WEIGHTS });
  if (!created.ok) return created.result;
  return { status: "success", message: tSettings("savedVersion", { version: created.version }) };
}
