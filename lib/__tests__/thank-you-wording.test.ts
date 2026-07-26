import { generateRegistryThankYouEmail } from '@/lib/email-templates'

// A Stripe contribution always has both a tier and an amount. Its wording must not
// have shifted — this is the note guests already receive automatically.
it('is unchanged for a Honeymoon Fund gift', () => {
  const t = generateRegistryThankYouEmail({ name: 'Eleanor', tierTitle: 'Buy us Coffee', amount: 50 })
  expect(t.subject).toBe('Thank you for your honeymoon gift, Eleanor!')
  expect(t.text).toContain('generous gift of $50 toward Buy us Coffee')
  expect(t.html).toContain('<strong>$50</strong>')
  expect(t.html).toContain('<strong>Buy us Coffee</strong>')
})

it('formats a large amount with a thousands separator', () => {
  const t = generateRegistryThankYouEmail({ name: 'Jo', tierTitle: 'The whole trip', amount: 1500 })
  expect(t.text).toContain('$1,500')
})

// The reason the amount had to become optional: Nicolle records a physical present
// at 0, and "your generous gift of $0 toward crystal bowl" is not a note you send
// your grandmother.
describe('a gift with no cash value', () => {
  it('names the gift instead of a figure', () => {
    const t = generateRegistryThankYouEmail({ name: 'Grandma', tierTitle: 'crystal bowl', amount: 0 })
    expect(t.text).toContain('generous gift of crystal bowl')
    expect(t.text).not.toContain('$0')
    expect(t.html).not.toContain('$0')
  })

  it('falls back to plain "gift" with neither amount nor description', () => {
    const t = generateRegistryThankYouEmail({ name: 'Sue', tierTitle: null, amount: null })
    expect(t.text).toContain('your generous gift.')
    expect(t.text).not.toContain('$')
    expect(t.text).not.toContain('toward')
  })

  it('treats a missing amount the same as zero', () => {
    const t = generateRegistryThankYouEmail({ name: 'Sue', tierTitle: 'a cheque' })
    expect(t.text).toContain('generous gift of a cheque')
    expect(t.text).not.toContain('$')
  })
})

it('names the amount without a description when only the amount is known', () => {
  const t = generateRegistryThankYouEmail({ name: 'Sue', amount: 200 })
  expect(t.text).toContain('generous gift of $200.')
  expect(t.text).not.toContain('toward')
})

it('escapes a name and description supplied by hand', () => {
  const t = generateRegistryThankYouEmail({
    name: '<img src=x onerror=alert(1)>',
    tierTitle: '<script>evil()</script>',
    amount: 10,
  })
  expect(t.html).not.toContain('<img src=x')
  expect(t.html).not.toContain('<script>')
})
