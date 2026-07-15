import { generateRegistryThankYouEmail } from '@/lib/email-templates'

it('renders a warm receipt with tier + amount and no tax language', () => {
  const r = generateRegistryThankYouEmail({ name: 'Aunt Sue', tierTitle: 'Buy us Dinner', amount: 100 })
  expect(r.subject).toMatch(/thank you/i)
  expect(r.html).toContain('Buy us Dinner')
  expect(r.html).toContain('$100')
  expect(r.text).toContain('Aunt Sue')
  expect(`${r.html} ${r.text}`.toLowerCase()).not.toContain('tax-deductible')
})
