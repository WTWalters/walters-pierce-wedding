import {
  generateRsvpNotificationEmail,
  generateBlockedAttemptEmail,
  generateVenueDetailsEmail,
  generateGraciousRegretsEmail,
  generateWeddingIcs,
} from '@/lib/email-templates'

const submission = {
  firstName: 'Jane', lastName: 'Smith', email: 'jane@x.com',
  attending: true, partySize: 2,
  dietaryRestrictions: 'vegetarian', songRequest: 'September - EWF',
}

describe('generateRsvpNotificationEmail', () => {
  it('includes all response fields and the matched flag in subject', () => {
    const t = generateRsvpNotificationEmail({ ...submission, matched: true })
    expect(t.subject).toContain('matched')
    expect(t.subject).toContain('Jane Smith')
    for (const s of ['jane@x.com', 'party of 2', 'vegetarian', 'September - EWF']) {
      expect(t.html).toContain(s)
    }
    expect(t.text).toContain('jane@x.com')
  })
  it('marks unmatched yeses for review', () => {
    const t = generateRsvpNotificationEmail({ ...submission, matched: false })
    expect(t.subject.toLowerCase()).toContain('unmatched')
    expect(t.html.toLowerCase()).toContain('not on the original list')
  })
  it('handles declines', () => {
    const t = generateRsvpNotificationEmail({ ...submission, attending: false, matched: true })
    expect(t.subject).toContain('declined')
  })
  it('flags name-only matches with the email on file', () => {
    const t = generateRsvpNotificationEmail({
      ...submission, matched: true, matchedBy: 'name', emailOnFile: 'old-address@x.com',
    })
    expect(t.subject).toContain('matched by NAME')
    expect(t.html).toContain('old-address@x.com')
    expect(t.text).toContain('email on file')
  })
  it('escapes guest-supplied HTML', () => {
    const t = generateRsvpNotificationEmail({
      ...submission,
      firstName: '<img src=x onerror=alert(1)>',
      songRequest: '<script>evil()</script>',
      matched: false,
    })
    expect(t.html).not.toContain('<img src=x')
    expect(t.html).not.toContain('<script>')
    expect(t.html).toContain('&lt;script&gt;')
  })
})

describe('generateBlockedAttemptEmail', () => {
  it('is discreet but complete', () => {
    const t = generateBlockedAttemptEmail(submission)
    expect(t.subject.toLowerCase()).toContain('blocked')
    expect(t.html).toContain('Jane Smith')
    expect(t.html).toContain('jane@x.com')
  })
})

describe('generateVenueDetailsEmail', () => {
  it('renders guest name and all wedding details', () => {
    const t = generateVenueDetailsEmail('Jane', {
      date: 'September 12, 2026', time: '4:00 PM',
      venueName: 'The Grove', venueAddress: '1 Grove Ln, Denver CO',
    })
    for (const s of ['Jane', 'September 12, 2026', '4:00 PM', 'The Grove', '1 Grove Ln, Denver CO']) {
      expect(t.html).toContain(s)
      expect(t.text).toContain(s)
    }
  })
})

describe('generateGraciousRegretsEmail', () => {
  it('renders guest name, never mentions venue or date', () => {
    const t = generateGraciousRegretsEmail('Jane')
    expect(t.html).toContain('Jane')
    expect(t.html.toLowerCase()).not.toContain('venue')
  })
})

describe('generateWeddingIcs', () => {
  it('builds a valid VEVENT from parseable details', () => {
    const ics = generateWeddingIcs({
      date: 'September 20, 2026', time: '4:00 PM',
      venueName: 'The Grove', venueAddress: '1 Grove Ln, Denver CO',
    })
    expect(ics).toContain('DTSTART:20260920T160000')
    expect(ics).toContain('DTEND:20260920T220000')
    expect(ics).toContain('LOCATION:The Grove\\, 1 Grove Ln\\, Denver CO')
    expect(ics).toContain('BEGIN:VEVENT')
  })
  it('returns null while details are still TBA', () => {
    expect(
      generateWeddingIcs({ date: 'TBA', time: 'TBA', venueName: 'TBA', venueAddress: '' })
    ).toBeNull()
  })
})
