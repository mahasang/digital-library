import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Shared focus behavior for the app's role="dialog" modals (Hallmark Audit
 * Phase 5, Section 3) — every dialog in the app (BulkAllMatchingFilterDialog,
 * JobBatchDetailDrawer, MfaResetConfirmDialog, SuperAdminRoleConfirmDialog,
 * AuthorSidebarActions' merge dialog) previously left focus management to
 * the browser default: Tab could escape into the page behind the backdrop,
 * Escape did nothing, and closing the dialog didn't return focus to the
 * button that opened it. This hook fixes all three without each dialog
 * reimplementing them:
 *  - traps Tab/Shift+Tab within the dialog while `active`
 *  - closes on Escape (unless `disabled`, e.g. mid-submit)
 *  - restores focus to whatever was focused right before the dialog became
 *    active, once it closes
 *
 * `active` must reflect whether the dialog is currently open. Some dialogs
 * unmount entirely when closed (parent renders `{open && <Dialog />}`) —
 * for those `active` can stay `true`, mount/unmount already does the work.
 * Others (BulkAllMatchingFilterDialog, AuthorSidebarActions) are a single
 * component that toggles between a trigger button and the dialog via its
 * own `open` state without unmounting — for those `active` must be that
 * `open` state, since a plain mount-only effect would never see the dialog
 * markup exist yet on the render where it first appears.
 */
export function useDialogA11y(active: boolean, onClose: () => void, disabled = false) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!active) return;
    const container = containerRef.current;
    if (!container) return;

    const previouslyFocused = document.activeElement as HTMLElement | null;

    if (!container.contains(document.activeElement)) {
      const firstFocusable = container.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstFocusable ?? container).focus();
    }

    function handleKeyDown(e: KeyboardEvent) {
      if (disabled || !container) return;

      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }

      if (e.key !== "Tab") return;

      const focusable = Array.from(container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
        (el) => el.offsetParent !== null
      );
      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }

    document.addEventListener("keydown", handleKeyDown, true);
    return () => {
      document.removeEventListener("keydown", handleKeyDown, true);
      previouslyFocused?.focus();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active]);

  return containerRef;
}
