import { generateRegistryThankYouEmail } from '@/lib/email-templates'

// A Stripe contribution always has both a tier and an amount. Its wording must not
// have shifted — this is the note guests already receive automatically.
it('is unchanged for a Honeymoon Fund gift', () => {
  const t = generateRegistryThankYouEmail({ name: 'Eleanor', gifts: [{ label: 'Buy us Coffee', amount: 50 }] })
  expect(t.subject).toBe('Thank you for your honeymoon gift, Eleanor!')
  expect(t.text).toContain('generous gift of $50 toward Buy us Coffee')
  expect(t.html).toContain('<strong>$50</strong>')
  expect(t.html).toContain('<strong>Buy us Coffee</strong>')
})

it('formats a large amount with a thousands separator', () => {
  const t = generateRegistryThankYouEmail({ name: 'Jo', gifts: [{ label: 'The whole trip', amount: 1500 }] })
  expect(t.text).toContain('$1,500')
})

// The reason the amount had to become optional: Nicolle records a physical present
// at 0, and "your generous gift of $0 toward crystal bowl" is not a note you send
// your grandmother.
describe('a gift with no cash value', () => {
  it('names the gift instead of a figure', () => {
    const t = generateRegistryThankYouEmail({ name: 'Grandma', gifts: [{ label: 'crystal bowl', amount: 0 }] })
    expect(t.text).toContain('generous gift of crystal bowl')
    expect(t.text).not.toContain('$0')
    expect(t.html).not.toContain('$0')
  })

  it('falls back to plain "gift" with neither amount nor description', () => {
    const t = generateRegistryThankYouEmail({ name: 'Sue', gifts: [{ label: null, amount: null }] })
    expect(t.text).toContain('your generous gift.')
    expect(t.text).not.toContain('$')
    expect(t.text).not.toContain('toward')
  })

  it('treats a missing amount the same as zero', () => {
    const t = generateRegistryThankYouEmail({ name: 'Sue', gifts: [{ label: 'a cheque' }] })
    expect(t.text).toContain('generous gift of a cheque')
    expect(t.text).not.toContain('$')
  })
})

it('names the amount without a description when only the amount is known', () => {
  const t = generateRegistryThankYouEmail({ name: 'Sue', gifts: [{ amount: 200 }] })
  expect(t.text).toContain('generous gift of $200.')
  expect(t.text).not.toContain('toward')
})

// Nicolle: Aunt Marilyn gave a cake serving set AND cash — "it should be a combined
// thank you note". Each gift is recorded separately; one note acknowledges them all.
describe('several gifts in one note', () => {
  const marilyn = () =>
    generateRegistryThankYouEmail({
      name: 'Aunt Marilyn',
      gifts: [
        { label: 'beautiful cake serving set', amount: 0 },
        { label: 'our AirBNB', amount: 100 },
      ],
    })

  it('acknowledges both, joined with "as well as"', () => {
    expect(marilyn().text).toContain(
      'your generous gifts — beautiful cake serving set, as well as $100 toward our AirBNB'
    )
  })

  it('still shows no figure for the present', () => {
    const t = marilyn()
    expect(t.text).not.toContain('$0')
    expect(t.html).not.toContain('$0')
  })

  it('reads as a list for three or more', () => {
    const t = generateRegistryThankYouEmail({
      name: 'Sue',
      gifts: [{ label: 'the vase' }, { label: 'the linens' }, { amount: 50 }],
    })
    expect(t.text).toContain('the vase, the linens, as well as $50')
  })

  // Her stated requirement: "If there's nothing in the second gift field, only the
  // one gift will be acknowledged."
  it('falls back to the single-gift wording for one gift', () => {
    const t = generateRegistryThankYouEmail({ name: 'Sue', gifts: [{ label: 'the vase' }] })
    expect(t.text).toContain('your generous gift of the vase')
    expect(t.text).not.toContain('as well as')
    expect(t.text).not.toContain('gifts')
  })

  it('ignores a gift with nothing to say about it', () => {
    const t = generateRegistryThankYouEmail({
      name: 'Sue',
      gifts: [{ label: 'the vase' }, { label: null, amount: 0 }],
    })
    // the empty one must not become a stray comma or a dangling "as well as"
    expect(t.text).toContain('your generous gift of the vase')
    expect(t.text).not.toContain('as well as')
  })

  it('handles no gifts at all without breaking the sentence', () => {
    const t = generateRegistryThankYouEmail({ name: 'Sue', gifts: [] })
    expect(t.text).toContain('for your generous gift.')
  })

  it('bolds each gift separately in the HTML', () => {
    const t = marilyn()
    expect(t.html).toContain('<strong>beautiful cake serving set</strong>')
    expect(t.html).toContain('<strong>$100</strong>')
    expect(t.html).toContain('<strong>our AirBNB</strong>')
  })
})

it('escapes a name and description supplied by hand', () => {
  const t = generateRegistryThankYouEmail({ name: '<img src=x onerror=alert(1)>', gifts: [{ label: '<script>evil()</script>', amount: 10, }] })
  expect(t.html).not.toContain('<img src=x')
  expect(t.html).not.toContain('<script>')
})
