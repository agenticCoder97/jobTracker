/**
 * Typed catalogue of analytics events.
 *
 * Adding an event here is the single place to declare it; the `track()`
 * helper is structurally restricted to keys defined in `AnalyticsEventMap`.
 */

export type AnalyticsEventMap = {
  // Navigation
  'nav.tab_changed': { from: string; to: string };
  'nav.modal_opened': { name: string };

  // Board
  'board.card_dragged': { fromStatus: string; toStatus: string };
  'board.filter_applied': { filterId: string; value: string | number | boolean };
  'board.search_submitted': { query: string };

  // Apply / docs
  'apply.resume_picked': { resumeId: string };
  'apply.cover_letter_picked': { coverLetterId: string };
  'apply.submitted': { applicationId: string };

  // Research
  'research.daily_pick_clicked': { externalJobId: string };
  'research.subscription_created': { subscriptionId: string };
  'research.provider_search_failed': { providerId: string; reason: string };

  // Profile
  'profile.section_edited': { section: string };
};

export type AnalyticsEventName = keyof AnalyticsEventMap;
