import type { AccessLevel } from "@/types/research";

export function canDownload(accessLevel: AccessLevel): boolean {
  return accessLevel !== "read_only" && accessLevel !== "metadata_only";
}

export function canReadOnline(accessLevel: AccessLevel): boolean {
  return accessLevel !== "metadata_only";
}
