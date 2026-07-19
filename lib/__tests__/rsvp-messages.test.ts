import { generateRsvpYesEmail, generateRsvpNoEmail, generateRsvpOverCountEmail } from '@/lib/email-templates'

const details = { date: 'TBA', time: 'TBA', venueName: 'Blackstone Rivers Ranch', venueAddress: '3673 Chicago Creek Rd\nIdaho Springs, CO 80452' }

it('RSVP Yes includes the confirmation line and the venue from details', () => {
  const m = generateRsvpYesEmail('Sam', details)
  expect(m.subject).toMatch(/thank you for your rsvp/i)
  expect(m.html).toContain('Thank you so much for your RSVP!')
  expect(m.html).toContain('Blackstone Rivers Ranch')
  expect(m.html).toContain('Idaho Springs')
  expect(m.text).toContain('Thank you so much for your RSVP!')
  expect(m.text.toLowerCase()).not.toContain('locked in')
})

it('RSVP No is the sorry-to-miss-you acknowledgement, with no venue', () => {
  const m = generateRsvpNoEmail('Sam')
  expect(m.html).toMatch(/sorry to miss you/i)
  expect(m.html).not.toContain('Blackstone Rivers Ranch')
})

it('RSVP Yes includes a Honeymoon Fund registry link (html + text)', () => {
  const m = generateRsvpYesEmail('Sam', details)
  expect(m.html).toContain('/registry')
  expect(m.html).toContain('Honeymoon Fund')
  expect(m.text).toContain('/registry')
})

it('RSVP No includes a Honeymoon Fund registry link (html + text)', () => {
  const m = generateRsvpNoEmail('Sam')
  expect(m.html).toContain('/registry')
  expect(m.html).toContain('Honeymoon Fund')
  expect(m.text).toContain('/registry')
})

it('over-count email does NOT include the registry link (tonally excluded)', () => {
  const m = generateRsvpOverCountEmail('Sam', 5, 4)
  expect(m.html).not.toContain('/registry')
  expect(m.text).not.toContain('/registry')
})

it('Over-count is personalized with name, submitted count, and the approved number', () => {
  const m = generateRsvpOverCountEmail('Sam', 5, 4)
  expect(m.html).toContain('Sam')
  expect(m.html).toContain('included 5 guests')
  expect(m.html).toContain('allow 4 guests')
  expect(m.html).not.toContain('listed on your invitation')
  expect(m.html).not.toContain('Blackstone Rivers Ranch')
  expect(m.text).toContain('allow 4 guests')
})

it('Over-count uses the singular "guest" for an approved count of one', () => {
  const m = generateRsvpOverCountEmail('Sam', 3, 1)
  expect(m.html).toContain('allow 1 guest')
  expect(m.html).not.toContain('allow 1 guests')
})

it('Over-count degrades gracefully when the approved number is unknown', () => {
  const m = generateRsvpOverCountEmail('Sam', 5, null)
  expect(m.html).not.toContain('null')
  expect(m.html).toContain('a limited number of guests')
})

it('RSVP Yes escapes guest-supplied HTML in the name', () => {
  expect(generateRsvpYesEmail('<script>x</script>', details).html).not.toContain('<script>')
})
