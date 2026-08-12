export type ActionResult =
  | { status: "idle" }
  | { status: "error"; message: string; fieldErrors?: Record<string, string[]> }
  | { status: "success"; message?: string };

export const idleActionResult: ActionResult = { status: "idle" };
