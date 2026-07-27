/* src/lib/analytics.ts — thin wrapper over Vercel Analytics.
   Safe to call anywhere: if analytics hasn't loaded (ad blocker, local
   dev, preview build) it quietly does nothing rather than throwing. */
import { track as vercelTrack } from "@vercel/analytics";

type Props = Record<string, string | number | boolean | null>;

export function track(event: string, props?: Props) {
  try {
    vercelTrack(event, props);
  } catch {
    /* analytics is never worth breaking a page over */
  }
}

/* The handful of moments that actually matter for the funnel. */
export const EVENTS = {
  startCheck: "check_started",
  submitCheck: "check_submitted",
  viewMembership: "membership_viewed",
  clickMembership: "membership_clicked",
  viewSession: "session_viewed",
  bookSessionOpened: "session_calendar_opened",
  viewTalks: "talks_viewed",
  startTalkEnquiry: "talk_enquiry_started",
  submitTalkEnquiry: "talk_enquiry_submitted",
} as const;
