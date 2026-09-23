import {
  generateFinalHeadcountEmail,
  FINAL_HEADCOUNT_DEFAULTS,
  FINAL_HEADCOUNT_DEADLINE,
} from '@/lib/email-templates'

// Nicolle, 2026-09-04: "We have to give BRR (and Serendipity) our final numbers
// on 9-10 ... I'd like to prompt everyone to consider what they RSVP'd."
describe('the default wording', () => {
  it('carries her message, the guest’s count and the deadline', () => {
    const t = generateFinalHeadcountEmail('Jean', 2)
    expect(t.text).toContain('Hi Jean!')
    expect(t.text).toContain("almost two weeks away and we can't wait to celebrate with you!")
    expect(t.text).toContain('We have you down for 2 guests.')
    expect(t.text).toContain(FINAL_HEADCOUNT_DEADLINE)
    expect(t.html).toContain('<strong>2</strong> guests')
  })

  // Pinned literally: the weekday is derived from the date, so a wrong date shows
  // up here rather than in 63 inboxes. Nicolle: "9-10 (next Thursday)".
  it('spells the deadline out as the Thursday she named', () => {
    expect(FINAL_HEADCOUNT_DEADLINE).toBe('Thursday, September 10, 2026')
  })

  // Removed deliberately (Whitney, 2026-09-13): the email carries no RSVP link or
  // button. Anyone needing to change their answer goes through Nicolle or the site
  // itself, so nothing here should invite a self-service edit.
  it('carries no RSVP button or link', () => {
    const t = generateFinalHeadcountEmail('Jean', 2)
    expect(t.html).not.toContain('/rsvp')
    expect(t.text).not.toContain('/rsvp')
    expect(t.html).not.toContain('Update your RSVP')
    expect(t.text).not.toContain('Update your RSVP')
  })

  it('says "guest" for a party of one', () => {
    const t = generateFinalHeadcountEmail('Sam', 1)
    expect(t.text).toContain('We have you down for 1 guest.')
    expect(t.text).not.toContain('1 guests')
  })

  // Inventing a number would be worse than omitting the line: the guest may
  // correct themselves against it.
  it.each([null, 0])('omits the count line when the number on record is %p', (count) => {
    const t = generateFinalHeadcountEmail('Sam', count)
    expect(t.text).not.toContain('We have you down for')
    expect(t.html).not.toContain('We have you down for')
  })

  it('falls back to a greeting that still reads as English with no name', () => {
    expect(generateFinalHeadcountEmail('', 2).text).toContain('Hi there!')
  })
})

// The point of the review step: what she types is what goes out.
describe('her edits', () => {
  it('replace the subject, headline and both paragraphs', () => {
    const t = generateFinalHeadcountEmail('Jean', 2, {
      subject: 'Two weeks!',
      heading: 'Nearly there',
      intro: 'We are so close now.',
      ask: 'Let us know by Friday.',
    })
    expect(t.subject).toBe('Two weeks!')
    expect(t.html).toContain('Nearly there')
    expect(t.text).toContain('Hi Jean!\n\nWe are so close now.')
    expect(t.text).toContain('Let us know by Friday.')
    expect(t.text).not.toContain(FINAL_HEADCOUNT_DEFAULTS.intro)
  })

  it('turns a blank line into a new paragraph', () => {
    const t = generateFinalHeadcountEmail('Jean', null, { intro: 'First thought.\n\nSecond thought.' })
    expect(t.html).toContain('<p>First thought.</p>')
    expect(t.html).toContain('<p>Second thought.</p>')
  })

  // Nicolle, 2026-09-13, of the highway-closure email: "Could you please put
  // 'Hi [insert name here]' on a line and then new paragraph". Run together, her
  // opening sentence read as part of the salutation.
  it('puts the greeting on its own line, above the opening', () => {
    const t = generateFinalHeadcountEmail('Matt & Brie', null, {
      intro: 'We have updated information regarding highway closures.',
    })
    expect(t.html).toContain('<p>Hi Matt &amp; Brie!</p>')
    expect(t.html).toContain('<p>We have updated information regarding highway closures.</p>')
    expect(t.html).not.toContain('Brie! We have updated')
    // The plain-text part has to break the same way, or the two read differently.
    expect(t.text).toContain('Hi Matt & Brie!\n\nWe have updated information')
  })

  it('drops the count line when she unticks it', () => {
    const t = generateFinalHeadcountEmail('Jean', 2, { includeCount: false })
    expect(t.text).not.toContain('We have you down for')
  })

  // A field she cleared should not silently send an empty email; the suggested
  // wording is the floor.
  it('falls back to the default when a box is left empty', () => {
    const t = generateFinalHeadcountEmail('Jean', 2, { subject: '   ', intro: '' })
    expect(t.subject).toBe(FINAL_HEADCOUNT_DEFAULTS.subject)
    expect(t.text).toContain(FINAL_HEADCOUNT_DEFAULTS.intro)
  })

  // She is editing a template bound for 63 inboxes, so her prose is escaped.
  it('escapes markup rather than rendering it', () => {
    const t = generateFinalHeadcountEmail('Jean', null, {
      intro: 'Bring <b>everyone</b> & their "plus ones"',
    })
    expect(t.html).toContain('&lt;b&gt;everyone&lt;/b&gt;')
    expect(t.html).toContain('&amp;')
    expect(t.html).not.toContain('<b>everyone</b>')
  })

  it('escapes a guest name too', () => {
    const t = generateFinalHeadcountEmail('<script>', 1)
    expect(t.html).not.toContain('<script>')
    expect(t.html).toContain('&lt;script&gt;')
  })
})

// Nicolle, 2026-09-22: the venue had no signal, so only a few people could post on
// the night. Her next send asks everyone for their photos, and she wants a button.
describe('the photos button', () => {
  const url = 'https://walters-pierce-wedding.com/photos'

  // The email was born as an RSVP check; a button appears only when she ticks it.
  it('is not there unless she asks for it', () => {
    const t = generateFinalHeadcountEmail('Jean', 2)
    expect(t.html).not.toContain('/photos')
    expect(t.text).not.toContain('/photos')
  })

  it('links to the gallery, in the gold-on-green style the other buttons use', () => {
    const t = generateFinalHeadcountEmail('Jean', 2, { photosButton: true })
    expect(t.html).toContain(`href="${url}"`)
    expect(t.html).toContain('>Share your wedding photos</a>')
    expect(t.html).toContain('background:#00330a; color:#D4AF37')
    // The plain-text part gets the same link, since it has no button to tap.
    expect(t.text).toContain(`Share your wedding photos: ${url}`)
  })

  it('says what she typed on it', () => {
    const t = generateFinalHeadcountEmail('Jean', 2, { photosButton: true, photosButtonLabel: 'Add your photos!' })
    expect(t.html).toContain('>Add your photos!</a>')
    expect(t.text).toContain(`Add your photos!: ${url}`)
  })

  it('falls back to the suggested label when hers is blank', () => {
    const t = generateFinalHeadcountEmail('Jean', 2, { photosButton: true, photosButtonLabel: '   ' })
    expect(t.html).toContain('>Share your wedding photos</a>')
  })

  it('comes after the ask, as the thing to do about it', () => {
    const t = generateFinalHeadcountEmail('Jean', 2, { ask: 'Please send us your pictures.', photosButton: true })
    expect(t.html.indexOf('Please send us your pictures.')).toBeLessThan(t.html.indexOf(`href="${url}"`))
    expect(t.text.indexOf('Please send us your pictures.')).toBeLessThan(t.text.indexOf(url))
  })

  // Her label is template text bound for every inbox, escaped like the rest.
  it('escapes markup in the label rather than rendering it', () => {
    const t = generateFinalHeadcountEmail('Jean', 2, { photosButton: true, photosButtonLabel: 'Photos <b>now</b> & more' })
    expect(t.html).toContain('Photos &lt;b&gt;now&lt;/b&gt; &amp; more')
    expect(t.html).not.toContain('<b>now</b>')
  })

  // Still Whitney's rule from 2026-09-13: a gallery button is not an RSVP button.
  it('adds no RSVP link alongside it', () => {
    const t = generateFinalHeadcountEmail('Jean', 2, { photosButton: true })
    expect(t.html).not.toContain('/rsvp')
  })
})
