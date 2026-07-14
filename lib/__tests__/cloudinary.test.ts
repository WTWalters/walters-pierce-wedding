const mockApiSignRequest = jest.fn().mockReturnValue('sig123')
const mockResource = jest.fn()
const mockDestroy = jest.fn()

jest.mock('cloudinary', () => ({
  v2: {
    config: jest.fn(),
    utils: { api_sign_request: (...a: unknown[]) => mockApiSignRequest(...a) },
    api: { resource: (...a: unknown[]) => mockResource(...a) },
    uploader: { destroy: (...a: unknown[]) => mockDestroy(...a) },
  },
}))

describe('with env configured', () => {
  let cl: typeof import('@/lib/cloudinary')
  beforeEach(() => {
    jest.resetModules()
    jest.clearAllMocks()
    mockApiSignRequest.mockReturnValue('sig123')
    process.env.CLOUDINARY_CLOUD_NAME = 'testcloud'
    process.env.CLOUDINARY_API_KEY = 'key'
    process.env.CLOUDINARY_API_SECRET = 'secret'
    cl = require('@/lib/cloudinary')
  })

  it('isCloudinaryConfigured is true', () => {
    expect(cl.isCloudinaryConfigured()).toBe(true)
  })

  it('signUploadParams signs timestamp+preset+folder', () => {
    const p = cl.signUploadParams()
    expect(p).toMatchObject({
      cloudName: 'testcloud',
      apiKey: 'key',
      uploadPreset: 'guest-photos-signed',
      folder: 'guest-photos',
      signature: 'sig123',
    })
    expect(typeof p.timestamp).toBe('number')
    expect(mockApiSignRequest).toHaveBeenCalledWith(
      { timestamp: p.timestamp, upload_preset: 'guest-photos-signed', folder: 'guest-photos' },
      'secret'
    )
  })

  it('verifyGuestPhoto accepts assets under guest-photos/', async () => {
    mockResource.mockResolvedValue({ secure_url: 'https://res.cloudinary.com/x.jpg' })
    await expect(cl.verifyGuestPhoto('guest-photos/abc')).resolves.toEqual({
      secureUrl: 'https://res.cloudinary.com/x.jpg',
    })
  })

  it('verifyGuestPhoto rejects folder escapes without calling the API', async () => {
    await expect(cl.verifyGuestPhoto('other/abc')).resolves.toBeNull()
    expect(mockResource).not.toHaveBeenCalled()
  })

  it('verifyGuestPhoto returns null when the asset does not exist', async () => {
    mockResource.mockRejectedValue(new Error('not found'))
    await expect(cl.verifyGuestPhoto('guest-photos/missing')).resolves.toBeNull()
  })

  it('photoUrls builds full + thumbnail delivery URLs', () => {
    expect(cl.photoUrls('guest-photos/abc')).toEqual({
      fileUrl: 'https://res.cloudinary.com/testcloud/image/upload/f_auto,q_auto/guest-photos/abc',
      thumbnailUrl: 'https://res.cloudinary.com/testcloud/image/upload/w_600,f_auto,q_auto/guest-photos/abc',
    })
  })
})

describe('without env', () => {
  it('isCloudinaryConfigured is false', () => {
    jest.resetModules()
    delete process.env.CLOUDINARY_CLOUD_NAME
    delete process.env.CLOUDINARY_API_KEY
    delete process.env.CLOUDINARY_API_SECRET
    const cl = require('@/lib/cloudinary')
    expect(cl.isCloudinaryConfigured()).toBe(false)
  })
})
