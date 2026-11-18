import { describe, expect, it } from "vitest";
import { displayUnreadCount, isShownAsUnread, unreadIdsToMark } from "./notification-state";

const unread = (id: string) => ({ id, readAt: null });
const read = (id: string) => ({ id, readAt: "2026-11-18T00:00:00Z" });

describe("displayUnreadCount", () => {
  it("equals the server count when nothing was marked locally", () => {
    expect(displayUnreadCount(3, [unread("a"), unread("b"), unread("c")], new Set())).toBe(3);
  });

  it("drops immediately for items marked locally that the server has not refreshed yet", () => {
    const list = [unread("a"), unread("b"), unread("c")];
    expect(displayUnreadCount(3, list, new Set(["a", "b", "c"]))).toBe(0);
    expect(displayUnreadCount(3, list, new Set(["a"]))).toBe(2);
  });

  it("does not subtract twice once the server data already shows them as read", () => {
    // เซิร์ฟเวอร์ refresh แล้ว: unreadCount ลดเป็น 0 และ readAt ถูกเติมแล้ว
    const refreshed = [read("a"), read("b"), read("c")];
    expect(displayUnreadCount(0, refreshed, new Set(["a", "b", "c"]))).toBe(0);
  });

  it("keeps the unread beyond the 10 shown (server count is bigger than the list)", () => {
    const shown = Array.from({ length: 10 }, (_, i) => unread(`n${i}`));
    const ids = new Set(shown.map((n) => n.id));
    expect(displayUnreadCount(14, shown, ids)).toBe(4);
  });

  it("never goes below zero", () => {
    expect(displayUnreadCount(0, [unread("a")], new Set(["a"]))).toBe(0);
  });
});

describe("unreadIdsToMark", () => {
  it("returns only unread items that were not already marked", () => {
    const list = [unread("a"), read("b"), unread("c")];
    expect(unreadIdsToMark(list, new Set())).toEqual(["a", "c"]);
    expect(unreadIdsToMark(list, new Set(["a"]))).toEqual(["c"]);
  });

  it("returns an empty list when everything is read", () => {
    expect(unreadIdsToMark([read("a")], new Set())).toEqual([]);
  });
});

describe("isShownAsUnread", () => {
  it("highlights unread rows", () => {
    expect(isShownAsUnread(unread("a"), new Set())).toBe(true);
  });

  it("keeps highlighting rows that were unread when the panel opened", () => {
    expect(isShownAsUnread(read("a"), new Set(["a"]))).toBe(true);
  });

  it("does not highlight rows that were already read", () => {
    expect(isShownAsUnread(read("a"), new Set(["x"]))).toBe(false);
  });
});
