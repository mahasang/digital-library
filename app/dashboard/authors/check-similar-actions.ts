"use server";

import { findSimilarAuthors } from "@/lib/data/authors-admin.server";
import { findSimilarOrganizations } from "@/lib/data/organizations.server";

export async function checkSimilarAuthorsAction(
  name: string,
  excludeId?: string
): Promise<{ id: string; name: string; similarity: number }[]> {
  if (!name || name.trim().length < 2) return [];
  return findSimilarAuthors(name, excludeId);
}

export async function checkSimilarOrganizationsAction(
  nameTh: string,
  excludeId?: string
): Promise<{ id: string; nameTh: string; similarity: number }[]> {
  if (!nameTh || nameTh.trim().length < 2) return [];
  return findSimilarOrganizations(nameTh, excludeId);
}
