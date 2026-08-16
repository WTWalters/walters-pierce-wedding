import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import PhotosPage from '../page'

// Nicolle asked for captions on the gallery, and for a way to edit one "just in
// case". Both are the same control: you caption a photo after it's up, because ten
// prompts during a ten-photo upload from a phone is how you get no captions at all.

const photo = (over: Record<string, unknown> = {}) => ({
  id: 'p1', uploadedByName: 'Marilyn', caption: null,
  fileUrl: 'https://img/1.jpg', thumbnailUrl: null, createdAt: '2026-09-05T00:00:00.000Z',
  likeCount: 0, likedByMe: false, mine: true, comments: [],
  ...over,
})

const mockApi = (photos: Array<Record<string, unknown>>, opts: { admin?: boolean } = {}) => {
  global.fetch = jest.fn((url: string, init?: RequestInit) => {
    const href = String(url)
    if (href.includes('/api/auth/session')) {
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve(opts.admin ? { user: { role: 'admin' } } : {}),
      })
    }
    if (init?.method === 'PATCH') {
      const body = JSON.parse(String(init.body))
      return Promise.resolve({
        ok: true,
        json: () => Promise.resolve({ ok: true, caption: body.caption || null }),
      })
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ photos }) })
  }) as jest.Mock
}

const patchCalls = () =>
  (global.fetch as jest.Mock).mock.calls.filter(([, init]) => init?.method === 'PATCH')

// Waits on the uploader line, not the image's alt text: a captioned photo uses its
// caption as the alt, so "Wedding photo" is only there while there is no caption.
async function loadGallery(photos = [photo()], opts: { admin?: boolean } = {}) {
  mockApi(photos, opts)
  render(<PhotosPage />)
  await waitFor(() => expect(screen.getByText(/Shared by Marilyn/)).toBeInTheDocument())
}

describe('adding a caption', () => {
  it('offers to caption a photo that has none', async () => {
    await loadGallery()
    expect(await screen.findByRole('button', { name: 'Add a caption' })).toBeInTheDocument()
  })

  it('saves what was typed', async () => {
    await loadGallery()
    await userEvent.click(await screen.findByRole('button', { name: 'Add a caption' }))
    await userEvent.type(screen.getByLabelText('Photo caption'), 'The first dance')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(() => expect(patchCalls()).toHaveLength(1))
    expect(JSON.parse(String(patchCalls()[0][1].body)).caption).toBe('The first dance')
  })

  it('shows the new caption without reloading the gallery', async () => {
    await loadGallery()
    await userEvent.click(await screen.findByRole('button', { name: 'Add a caption' }))
    await userEvent.type(screen.getByLabelText('Photo caption'), 'The first dance')
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText('The first dance')).toBeInTheDocument()
  })
})

describe('editing one that is already there', () => {
  it('offers to edit instead of to add', async () => {
    await loadGallery([photo({ caption: 'Cuttin the cake' })])
    expect(await screen.findByRole('button', { name: 'Edit caption' })).toBeInTheDocument()
  })

  it('opens with the existing wording to correct', async () => {
    await loadGallery([photo({ caption: 'Cuttin the cake' })])
    await userEvent.click(await screen.findByRole('button', { name: 'Edit caption' }))
    expect(screen.getByLabelText('Photo caption')).toHaveValue('Cuttin the cake')
  })

  it('leaves the caption alone when cancelled', async () => {
    await loadGallery([photo({ caption: 'Cuttin the cake' })])
    await userEvent.click(await screen.findByRole('button', { name: 'Edit caption' }))
    await userEvent.type(screen.getByLabelText('Photo caption'), ' — oops')
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(patchCalls()).toHaveLength(0)
    expect(screen.getByText('Cuttin the cake')).toBeInTheDocument()
  })
})

describe('who gets the control', () => {
  it("does not offer it on somebody else's photo", async () => {
    await loadGallery([photo({ mine: false })])
    expect(screen.queryByRole('button', { name: /caption/i })).not.toBeInTheDocument()
  })

  // Same reach as delete: Nicolle can fix a typo or take down something unwelcome.
  it('offers it to an admin on any photo', async () => {
    await loadGallery([photo({ mine: false })], { admin: true })
    expect(await screen.findByRole('button', { name: 'Add a caption' })).toBeInTheDocument()
  })
})

describe('when it goes wrong', () => {
  it('says so and keeps what was typed, rather than losing it silently', async () => {
    await loadGallery()
    await userEvent.click(await screen.findByRole('button', { name: 'Add a caption' }))
    await userEvent.type(screen.getByLabelText('Photo caption'), 'The first dance')
    ;(global.fetch as jest.Mock).mockImplementationOnce(() =>
      Promise.resolve({ ok: false, json: () => Promise.resolve({ error: 'nope' }) })
    )
    await userEvent.click(screen.getByRole('button', { name: 'Save' }))
    expect(await screen.findByText(/couldn't be saved/i)).toBeInTheDocument()
    expect(screen.getByLabelText('Photo caption')).toHaveValue('The first dance')
  })
})
