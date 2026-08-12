import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/lib/supabase/database.types";
import { isSupabaseConfigured } from "@/lib/supabase/config";

/** ต้องเข้าสู่ระบบเท่านั้น (บทบาทใดก็ได้) */
const LOGIN_REQUIRED_PREFIXES = [
  "/account",
  "/favorites",
  "/reading-history",
  "/mfa-challenge",
  "/setup-mfa",
];

/**
 * ต้องเข้าสู่ระบบและมี rank >= ค่าที่กำหนด (member=10, staff=20, librarian=30, admin=40)
 * เรียงจากเจาะจงที่สุดไปกว้างที่สุด — ใช้ prefix ที่ตรงและยาวที่สุดเป็นตัวตัดสิน
 * (เช่น /dashboard/users ต้องใช้กฎ admin แม้ /dashboard ทั่วไปจะอนุญาต librarian)
 */
const ROLE_REQUIRED_PREFIXES: { prefix: string; minRank: number }[] = [
  { prefix: "/submit-research", minRank: 20 },
  { prefix: "/my-submissions", minRank: 20 },
  { prefix: "/dashboard/users", minRank: 40 },
  { prefix: "/dashboard/audit-logs", minRank: 40 },
  { prefix: "/dashboard/settings", minRank: 40 },
  { prefix: "/dashboard", minRank: 30 },
  { prefix: "/superadmin", minRank: 50 },
];

/**
 * ถอดรหัส claim `iat` จาก JWT โดยไม่ตรวจลายเซ็น (ใช้เฉพาะเทียบเวลาคร่าวๆ
 * เท่านั้น) — ใช้ atob() (Web API มาตรฐาน) แทน Buffer เพราะ middleware รันบน
 * Edge Runtime ที่ไม่มี Buffer ของ Node.js ให้ใช้เสมอ
 */
function decodeJwtIat(token: string): number | null {
  try {
    const payloadSegment = token.split(".")[1];
    if (!payloadSegment) return null;
    const base64 = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    const json = decodeURIComponent(
      atob(padded)
        .split("")
        .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
        .join("")
    );
    const payload = JSON.parse(json) as { iat?: number };
    return typeof payload.iat === "number" ? payload.iat : null;
  } catch {
    return null;
  }
}

function matchRoleRequirement(pathname: string) {
  const matches = ROLE_REQUIRED_PREFIXES.filter(({ prefix }) =>
    pathname.startsWith(prefix)
  );
  if (matches.length === 0) return undefined;
  // เลือก prefix ที่ยาวที่สุด (เจาะจงที่สุด) เมื่อมีหลายกฎที่ตรงกัน
  return matches.reduce((longest, current) =>
    current.prefix.length > longest.prefix.length ? current : longest
  );
}

/**
 * รีเฟรช Supabase session cookie ในทุกคำขอ (แนวทางมาตรฐานของ @supabase/ssr)
 * และป้องกันหน้าที่ต้องเข้าสู่ระบบ/ต้องมีสิทธิ์ระดับหนึ่งก่อนเข้าถึง
 * (Server-side authorization ผ่าน middleware — ทำงานก่อนหน้าเว็บ render เสมอ)
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  if (!isSupabaseConfigured()) {
    return response;
  }

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user: fetchedUser },
    error: userError,
  } = await supabase.auth.getUser();

  let user = fetchedUser;
  let corrupted = Boolean(userError);
  if (userError) {
    console.error("updateSession: getUser() ล้มเหลว:", userError.message);
  }

  // ตรวจ "JWT issued at future" เอง — GoTrue เองไม่ปฏิเสธ token แบบนี้ (แค่
  // session_id ยังมีอยู่จริงก็ถือว่าผ่าน getUser() ข้างบนได้ปกติ) แต่ PostgREST
  // (ที่ query ข้อมูลทุกตัวใน Server Component ใช้งานอยู่ เช่น getCategories())
  // ตรวจสอบ iat เข้มกว่าและจะปฏิเสธคำขอทันทีด้วย error นี้ — เป็นผลจากนาฬิกา
  // Docker/WSL2 คลาดเคลื่อนชั่วคราวตอนออก token (เช่นหลังเครื่องพักการทำงาน)
  // แล้วภายหลังนาฬิกากลับมาตรงจึงเห็น token เดิมว่า "ออกในอนาคต" ต้องตรวจเอง
  // ที่นี่เพราะไม่มีทางรู้จาก getUser() ได้เลย
  if (!corrupted && user) {
    const { data: sessionData } = await supabase.auth.getSession();
    const accessToken = sessionData.session?.access_token;
    const iat = accessToken ? decodeJwtIat(accessToken) : null;
    const nowSeconds = Math.floor(Date.now() / 1000);
    const CLOCK_SKEW_TOLERANCE_SECONDS = 60;
    if (iat !== null && iat > nowSeconds + CLOCK_SKEW_TOLERANCE_SECONDS) {
      console.error(
        `updateSession: token มี iat (${iat}) ล้ำหน้าเวลาปัจจุบัน (${nowSeconds}) เกิน ${CLOCK_SKEW_TOLERANCE_SECONDS} วินาที ถือว่าเสียหายจากนาฬิกาคลาดเคลื่อน`
      );
      corrupted = true;
    }
  }

  // เซสชันที่เสียหาย/ใช้งานไม่ได้จริง (ทั้งสองกรณีข้างต้น) ถ้าปล่อย cookie ที่
  // เสียนี้ค้างไว้ต่อ ทุก query ของ Server Component ที่ตามมาในคำขอเดียวกันจะ
  // พังตามไปด้วยเพราะแนบ token เดิมซ้ำ จึงต้องล้างเซสชันทิ้งทันทีที่นี่ (setAll
  // ด้านบนจะอัปเดตทั้ง request.cookies ที่ส่งต่อให้หน้าเว็บ render และ response
  // cookies ที่ส่งกลับ browser) ให้คำขอนี้เดินหน้าต่อในฐานะผู้เยี่ยมชมทั่วไป
  // แทนที่จะพังทั้งหน้า
  if (corrupted) {
    await supabase.auth.signOut();
    user = null;
  }

  const pathname = request.nextUrl.pathname;

  const requiresLogin = LOGIN_REQUIRED_PREFIXES.some((prefix) =>
    pathname.startsWith(prefix)
  );
  const roleRequirement = matchRoleRequirement(pathname);

  if ((requiresLogin || roleRequirement) && !user) {
    const redirectUrl = new URL("/login", request.url);
    redirectUrl.searchParams.set("redirect", pathname);
    return NextResponse.redirect(redirectUrl);
  }

  if (roleRequirement && user) {
    const { data: rank, error } = await supabase.rpc("user_max_role_rank", {});
    if (error || (rank ?? 0) < roleRequirement.minRank) {
      return NextResponse.redirect(new URL("/403", request.url));
    }

    // Super Admin ต้องตั้งค่า MFA ก่อนเข้า /superadmin/* เสมอ (บังคับ — ต่างจาก
    // บทบาทอื่นที่ยังเป็นทางเลือก) ใช้ getAuthenticatorAssuranceLevel() ตัดสิน
    // ทั้งสองกรณีจากค่าเดียว (ไม่ต้องเรียก listFactors() เพิ่ม):
    //   - nextLevel === "aal1" หมายถึงไม่มี verified factor เลย (ตาม docstring
    //     ของ Supabase: "If the user has a verified factor, nextLevel จะเป็น
    //     aal2 เสมอ มิเช่นนั้นเป็น aal1") → บังคับไปตั้งค่าที่ /setup-mfa ก่อน
    //   - currentLevel==="aal1" && nextLevel==="aal2" หมายถึงมี verified factor
    //     แล้วแต่เซสชันนี้ยังไม่ได้ยืนยันขั้นที่สอง → ไปยืนยันที่ /mfa-challenge
    if (roleRequirement.prefix === "/superadmin") {
      const { data: aal } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
      if (aal?.nextLevel === "aal1") {
        const setupUrl = new URL("/setup-mfa", request.url);
        setupUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(setupUrl);
      }
      if (aal?.currentLevel === "aal1" && aal.nextLevel === "aal2") {
        const challengeUrl = new URL("/mfa-challenge", request.url);
        challengeUrl.searchParams.set("redirect", pathname);
        return NextResponse.redirect(challengeUrl);
      }
    }
  }

  return response;
}
