import { generateRsvpYesEmail, generateRsvpNoEmail, generateRsvpOverCountEmail } from '@/lib/email-templates'

const details = { date: 'TBA', time: 'TBA', venueName: 'Blackstone Rivers Ranch', venueAddress: '3673 Chicago Creek Rd\nIdaho Springs, CO 80452' }

it('RSVP Yes includes the confirmation line and the venue from details', () => {
  const m = generateRsvpYesEmail('Sam', details)
  expect(m.subject).toMatch(/locked in|You're|invited/i)
  expect(m.html).toContain('Blackstone Rivers Ranch')
  expect(m.html).toContain('Idaho Springs')
  expect(m.text).toContain('locked in')
})

it('RSVP No is the sorry-to-miss-you acknowledgement, with no venue', () => {
  const m = generateRsvpNoEmail('Sam')
  expect(m.html).toMatch(/sorry to miss you/i)
  expect(m.html).not.toContain('Blackstone Rivers Ranch')
})

it('Over-count is personalized with name, submitted count, and invited seats', () => {
  const m = generateRsvpOverCountEmail('Sam', 5, 4)
  expect(m.html).toContain('Sam')
  expect(m.html).toContain('included 5 guests')
  expect(m.html).toContain('the 4 spots')
  expect(m.html).not.toContain('Blackstone Rivers Ranch')
})

it('Over-count degrades gracefully when invited seats are unknown', () => {
  const m = generateRsvpOverCountEmail('Sam', 5, null)
  expect(m.html).not.toContain('null')
})

it('RSVP Yes escapes guest-supplied HTML in the name', () => {
  expect(generateRsvpYesEmail('<script>x</script>', details).html).not.toContain('<script>')
})
