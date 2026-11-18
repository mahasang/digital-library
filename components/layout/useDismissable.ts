import { useEffect, useRef, type RefObject } from "react";

export type DismissReason = "outside" | "escape";

/**
 * ปิดเมนู dropdown (เมนูผู้ใช้ / กระดิ่งแจ้งเตือน / เมนูมือถือ) เมื่อกดหรือแตะนอกกรอบ
 * หรือกด Esc — ทำงานเฉพาะตอนเมนูเปิดอยู่
 *
 * ทำไมไม่ใช้แผ่นโปร่งใส `fixed inset-0` แบบเดิม: <header> มี `backdrop-blur`
 * (backdrop-filter) ซึ่งทำให้ `position: fixed` ของลูกหลานอ้างอิงกรอบ header แทน
 * viewport แผ่นนั้นจึงคลุมแค่แถบ header สูง 64px การกดที่เนื้อหาด้านล่างจึงไม่ถูกจับ
 * เมนูเลยค้างอยู่ — listener ระดับ document ไม่ขึ้นกับ stacking context/containing
 * block และการกดนอกกรอบยังทำงานกับสิ่งที่กดตามปกติ (ไม่ถูกแผ่นโปร่งใสกลืนการกดครั้งแรก)
 *
 * `containerRef` ต้องครอบทั้งปุ่มเปิดและตัวเมนู เพื่อให้การกดปุ่มเดิมซ้ำยังเป็น
 * การสลับเปิด/ปิดตามปกติ (ไม่ถูกนับเป็น "นอกกรอบ")
 */
export function useDismissable(
  containerRef: RefObject<HTMLElement | null>,
  open: boolean,
  onDismiss: (reason: DismissReason) => void
): void {
  // เก็บ callback ล่าสุดไว้ใน ref เพื่อไม่ต้องสมัคร/ถอน listener ใหม่ทุกครั้งที่ render
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  });

  useEffect(() => {
    if (!open) return;

    function handlePointerDown(event: PointerEvent) {
      const container = containerRef.current;
      if (!container || !(event.target instanceof Node)) return;
      if (!container.contains(event.target)) onDismissRef.current("outside");
    }

    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") onDismissRef.current("escape");
    }

    document.addEventListener("pointerdown", handlePointerDown);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [open, containerRef]);
}
