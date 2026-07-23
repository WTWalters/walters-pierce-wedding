export type EmailRowStatus = 'failed' | 'bounced' | 'complained' | 'opened' | 'delivered' | 'sent'

// Email types the admin Emails tab hides — they're not guest-facing gated sends and
// just clutter the grid: the (past) save-the-dates and the internal notifications
// that go to the coordinator. Applied to the list, the stats tiles, and the filter
// options so all three stay consistent.
export const EMAILS_TAB_EXCLUDED_TYPES = [
  'save_the_date',
  'save_the_date_confirmation',
  'rsvp_notification',
  'blocked_attempt_notification',
]

export interface EmailStatusInput {
  status: string | null
  openedAt: Date | string | null
  bouncedAt: Date | string | null
}

// First match wins. A bounce/failure is terminal, so it outranks an open; an open
// implies delivery. Anything unconfirmed is "sent (pending)".
export function deriveEmailStatus(row: EmailStatusInput): EmailRowStatus {
  if (row.status === 'failed') return 'failed'
  if (row.bouncedAt != null || row.status === 'bounced') return 'bounced'
  if (row.status === 'complained') return 'complained'
  if (row.openedAt != null) return 'opened'
  if (row.status === 'delivered') return 'delivered'
  return 'sent'
}

const TYPE_LABELS: Record<string, string> = {
  gated_rsvp_yes: 'RSVP Yes',
  gated_rsvp_no: 'RSVP No',
  gated_rsvp_over_count: 'Incorrect RSVP',
  gated_venue_details: 'Venue Details',
  gated_gracious_regrets: 'Gracious Regrets',
  save_the_date: 'Save-the-Date',
  save_the_date_confirmation: 'Save-the-Date Confirmation',
  registry_thank_you: 'Registry Thank-You',
  rsvp_notification: 'New-RSVP alert (to you)',
  blocked_attempt_notification: 'Blocked attempt (to you)',
}

export function emailTypeLabel(type: string | null): string {
  if (!type) return 'Other'
  return TYPE_LABELS[type] ?? type
}

export const EMAIL_STATUS_META: Record<EmailRowStatus, { label: string; className: string }> = {
  failed: { label: 'Failed to send', className: 'bg-gray-200 text-gray-700' },
  bounced: { label: 'Bounced', className: 'bg-red-100 text-red-800' },
  complained: { label: 'Marked as spam', className: 'bg-orange-100 text-orange-800' },
  opened: { label: 'Opened', className: 'bg-green-100 text-green-800' },
  delivered: { label: 'Delivered', className: 'bg-blue-100 text-blue-800' },
  sent: { label: 'Sent', className: 'bg-gray-100 text-gray-600' },
}
