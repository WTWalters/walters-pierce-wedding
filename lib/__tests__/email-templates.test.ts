import {
  generateRsvpNotificationEmail,
  generateRsvpYesEmail,
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
    const t = generateRsvpNotificationEmail({ ...submission, status: 'matched' })
    expect(t.subject).toContain('matched')
    expect(t.subject).toContain('Jane Smith')
    expect(t.html).toContain('Matched — on your guest list')
    for (const s of ['jane@x.com', 'party of 2', 'vegetarian', 'September - EWF']) {
      expect(t.html).toContain(s)
    }
    expect(t.text).toContain('jane@x.com')
  })
  it('marks unmatched yeses for review', () => {
    const t = generateRsvpNotificationEmail({ ...submission, status: 'unmatched' })
    expect(t.subject.toLowerCase()).toContain('unmatched')
    expect(t.html.toLowerCase()).toContain('not on the original list')
  })
  it('shows approved guests as added on the date you approved them', () => {
    const t = generateRsvpNotificationEmail({
      ...submission, status: 'added', addedAt: new Date('2026-07-18T18:00:00Z'),
    })
    expect(t.subject).toContain('added')
    expect(t.subject).not.toContain('UNMATCHED')
    expect(t.html).toContain('Added by you on Jul 18, 2026')
    expect(t.html.toLowerCase()).not.toContain('not on the original list')
  })
  it('handles declines', () => {
    const t = generateRsvpNotificationEmail({ ...submission, attending: false, status: 'matched' })
    expect(t.subject).toContain('declined')
  })
  it('flags name-only matches with the email on file', () => {
    const t = generateRsvpNotificationEmail({
      ...submission, status: 'matched', matchedBy: 'name', emailOnFile: 'old-address@x.com',
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
      status: 'unmatched',
    })
    expect(t.html).not.toContain('<img src=x')
    expect(t.html).not.toContain('<script>')
    expect(t.html).toContain('&lt;script&gt;')
  })
})

describe('generateRsvpYesEmail', () => {
  const details = {
    date: 'September 12, 2026', time: '4:00 PM',
    venueName: 'Blackstone Rivers Ranch',
    venueAddress: '3673 Chicago Creek Road, Idaho Springs, Colorado 80452',
  }
  it('uses the warm "thank you" copy, not "locked in"', () => {
    const t = generateRsvpYesEmail('Jill', details)
    expect(t.subject).toBe('Thank you for your RSVP — Emme & Connor')
    expect(t.html).toContain('Thank you so much for your RSVP!')
    expect(t.html).toContain('Get ready for an amazing night!')
    expect(t.html.toLowerCase()).not.toContain('locked in')
    expect(t.text.toLowerCase()).not.toContain('locked in')
  })
  it('stacks the venue name and address on their own lines (no "The address is:")', () => {
    const t = generateRsvpYesEmail('Jill', details)
    expect(t.html).toContain('Our venue is')
    expect(t.html).toContain('<strong>Blackstone Rivers Ranch</strong>')
    expect(t.html).toContain('3673 Chicago Creek Road<br>Idaho Springs, Colorado 80452')
    expect(t.html).not.toContain('The address is')
    // plain-text mirror is stacked too
    expect(t.text).toContain('Blackstone Rivers Ranch\n3673 Chicago Creek Road\nIdaho Springs, Colorado 80452')
  })
  it('confirms the guest count (plural), and omits it when unknown', () => {
    const t = generateRsvpYesEmail('Jill', details, 4)
    expect(t.html).toContain('We have you down for <strong>4</strong> guests.')
    expect(t.text).toContain('We have you down for 4 guests.')
    const none = generateRsvpYesEmail('Jill', details, null)
    expect(none.html).not.toContain('We have you down for')
  })
  it('uses the singular "guest" for a party of one', () => {
    const t = generateRsvpYesEmail('Jill', details, 1)
    expect(t.html).toContain('We have you down for <strong>1</strong> guest.')
    expect(t.html).not.toContain('1</strong> guests')
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
