import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["th", "en", "lo", "vi"] as const,
  defaultLocale: "lo",
  localePrefix: "always", // ทุก locale มี prefix: /th/, /en/, /lo/
});

export type Locale = (typeof routing.locales)[number];
