// Locale-aware crisis resources. Phase 6 expands this table and reviews it on a
// schedule. Keep entries verified; never guess a number.

export interface CrisisResource {
  label: string;
  detail: string;
  /** tel: or sms: URL the app can open. */
  url?: string;
}

export const CRISIS_RESOURCES: Record<string, CrisisResource[]> = {
  US: [
    { label: "Call or text 988", detail: "Suicide & Crisis Lifeline, 24/7", url: "tel:988" },
    { label: "Call 911", detail: "If you or someone else is in immediate danger", url: "tel:911" },
    {
      label: "1-800-799-7233",
      detail: "National Domestic Violence Hotline, 24/7",
      url: "tel:18007997233",
    },
  ],
  DEFAULT: [
    { label: "Contact your local emergency number", detail: "If you are in immediate danger" },
    { label: "Find a local crisis line", detail: "findahelpline.com lists helplines by country" },
  ],
};

export function crisisResourcesFor(locale: string): CrisisResource[] {
  const region = locale.split(/[-_]/)[1]?.toUpperCase();
  return CRISIS_RESOURCES[region ?? ""] ?? CRISIS_RESOURCES.DEFAULT;
}
