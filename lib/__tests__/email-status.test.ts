import { deriveEmailStatus, emailTypeLabel, EMAIL_STATUS_META } from '@/lib/email-status'

describe('deriveEmailStatus', () => {
  it('prioritizes failed over everything', () => {
    expect(deriveEmailStatus({ status: 'failed', openedAt: new Date(), bouncedAt: null })).toBe('failed')
  })
  it('reports bounced from bouncedAt or status', () => {
    expect(deriveEmailStatus({ status: 'sent', openedAt: null, bouncedAt: new Date() })).toBe('bounced')
    expect(deriveEmailStatus({ status: 'bounced', openedAt: null, bouncedAt: null })).toBe('bounced')
  })
  it('reports spam complaints', () => {
    expect(deriveEmailStatus({ status: 'complained', openedAt: null, bouncedAt: null })).toBe('complained')
  })
  it('reports opened when openedAt is set (and not bounced)', () => {
    expect(deriveEmailStatus({ status: 'delivered', openedAt: new Date(), bouncedAt: null })).toBe('opened')
  })
  it('reports delivered from status', () => {
    expect(deriveEmailStatus({ status: 'delivered', openedAt: null, bouncedAt: null })).toBe('delivered')
  })
  it('falls back to sent (pending)', () => {
    expect(deriveEmailStatus({ status: 'sent', openedAt: null, bouncedAt: null })).toBe('sent')
    expect(deriveEmailStatus({ status: null, openedAt: null, bouncedAt: null })).toBe('sent')
  })
})

describe('emailTypeLabel', () => {
  it('maps known raw types to friendly labels', () => {
    expect(emailTypeLabel('gated_rsvp_yes')).toBe('RSVP Yes')
    expect(emailTypeLabel('gated_rsvp_over_count')).toBe('Incorrect RSVP')
    expect(emailTypeLabel('save_the_date')).toBe('Save-the-Date')
    expect(emailTypeLabel('rsvp_notification')).toBe('New-RSVP alert (to you)')
  })
  it('falls back to the raw type, and to "Other" for null', () => {
    expect(emailTypeLabel('some_new_type')).toBe('some_new_type')
    expect(emailTypeLabel(null)).toBe('Other')
  })
})

it('EMAIL_STATUS_META covers every status with a label + className', () => {
  for (const k of ['failed', 'bounced', 'complained', 'opened', 'delivered', 'sent'] as const) {
    expect(EMAIL_STATUS_META[k].label).toBeTruthy()
    expect(EMAIL_STATUS_META[k].className).toContain('bg-')
  }
})
