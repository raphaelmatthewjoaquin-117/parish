import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SiteContentEditorPage } from './SiteContentEditorPage'

const { mockGet, mockSave, mockUploadImage } = vi.hoisted(() => ({
  mockGet: vi.fn(),
  mockSave: vi.fn(),
  mockUploadImage: vi.fn(),
}))

vi.mock('../api/client', () => ({
  API_BASE_URL: '',
  apiClient: {
    siteContent: {
      get: mockGet,
      save: mockSave,
      uploadImage: mockUploadImage,
    },
  },
}))

describe('SiteContentEditorPage', () => {
  beforeEach(() => {
    mockGet.mockResolvedValue({ content: null })
    mockSave.mockResolvedValue({})
    mockUploadImage.mockResolvedValue({ photoUrl: '/uploads/new-photo.jpg' })
  })

  it.each([
    ['about', '/about'],
    ['contact', '/contact'],
    ['gallery', '/gallery'],
    ['footer', '/'],
  ] as const)('opens a preview of the %s public page', async (page, path) => {
    render(<SiteContentEditorPage page={page} />)

    fireEvent.click(await screen.findByRole('button', { name: 'View page' }))

    const dialog = await screen.findByRole('dialog', { name: 'Page preview' })
    expect(dialog.querySelector('iframe')?.getAttribute('src')).toBe(path)

    fireEvent.click(screen.getByRole('button', { name: 'Close preview' }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('closes the preview when Escape is pressed', async () => {
    render(<SiteContentEditorPage page="about" />)
    fireEvent.click(await screen.findByRole('button', { name: 'View page' }))
    await screen.findByRole('dialog', { name: 'Page preview' })

    fireEvent.keyDown(window, { key: 'Escape' })

    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('previews an uploaded banner locally before it is published', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:banner-preview')
    render(<SiteContentEditorPage page="about" />)
    const uploadLabel = await screen.findByLabelText('Upload banner image')
    const fileInput = uploadLabel.querySelector('input[type="file"]')
    if (!fileInput) throw new Error('Banner image input was not rendered.')

    fireEvent.change(fileInput, {
      target: { files: [new File(['photo'], 'banner.jpg', { type: 'image/jpeg' })] },
    })

    expect((await screen.findByRole('img', { name: 'Banner preview' })).getAttribute('src')).toBe('blob:banner-preview')
    expect(mockUploadImage).toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: 'Save and publish' }))
    await screen.findByText('Changes saved and published.')
    expect(screen.getByRole('img', { name: 'Banner preview' }).getAttribute('src')).toBe('/uploads/new-photo.jpg')
    vi.restoreAllMocks()
  })

  it('previews an uploaded album photo locally before it is published', async () => {
    vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:album-preview')
    mockGet.mockResolvedValue({
      content: {
        heading: 'Gallery',
        items: [{ id: 'faith', title: 'Faith', image: '/assets/faith.jpg' }],
      },
    })
    render(<SiteContentEditorPage page="gallery" />)

    fireEvent.click(await screen.findByRole('button', { name: /Faith/ }))
    const uploadLabel = screen.getByLabelText('Add a photo to Faith')
    const fileInput = uploadLabel.querySelector('input[type="file"]')
    if (!fileInput) throw new Error('Album photo input was not rendered.')
    fireEvent.change(fileInput, {
      target: { files: [new File(['photo'], 'second.jpg', { type: 'image/jpeg' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Add a photo to Faith' }))

    expect((await screen.findByRole('img', { name: 'Faith photo 2' })).getAttribute('src')).toBe('blob:album-preview')
    expect(mockUploadImage).toHaveBeenCalled()
    vi.restoreAllMocks()
  })

  it('creates an album with its first uploaded photo as the cover', async () => {
    mockGet.mockResolvedValue({
      content: { heading: 'Gallery', items: [] },
    })
    render(<SiteContentEditorPage page="gallery" />)

    fireEvent.change(await screen.findByRole('textbox', { name: 'New album title' }), {
      target: { value: 'Parish Feast' },
    })
    fireEvent.change(screen.getByLabelText('New album photo'), {
      target: { files: [new File(['photo'], 'feast.jpg', { type: 'image/jpeg' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Create album' }))

    expect(await screen.findByRole('img', { name: 'Parish Feast cover' })).toBeTruthy()
    fireEvent.click(screen.getByRole('button', { name: 'Save and publish' }))

    expect(mockSave).toHaveBeenCalledWith('gallery', expect.objectContaining({
      items: [expect.objectContaining({
        title: 'Parish Feast',
        image: '/uploads/new-photo.jpg',
        photos: ['/uploads/new-photo.jpg'],
      })],
    }), expect.any(String))
  })

  it('adds photos to an existing album without changing its cover', async () => {
    mockGet.mockResolvedValue({
      content: {
        heading: 'Gallery',
        items: [{ id: 'faith', title: 'Faith', image: '/assets/faith.jpg' }],
      },
    })
    render(<SiteContentEditorPage page="gallery" />)

    fireEvent.change(await screen.findByLabelText('Add photo to Faith'), {
      target: { files: [new File(['photo'], 'second.jpg', { type: 'image/jpeg' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Upload photo to Faith' }))

    expect(await screen.findByRole('img', { name: 'Faith photo 2' })).toBeTruthy()
    expect((screen.getByLabelText('Cover photo for Faith') as HTMLSelectElement).value).toBe('/assets/faith.jpg')
    fireEvent.click(screen.getByRole('button', { name: 'Save and publish' }))
    await screen.findByText('Changes saved and published.')
    expect(mockSave).toHaveBeenLastCalledWith('gallery', expect.objectContaining({
      items: [expect.objectContaining({
        image: '/assets/faith.jpg',
        photos: ['/assets/faith.jpg', '/uploads/new-photo.jpg'],
      })],
    }), expect.any(String))
  })

  it('allows changing the album title and cover, and prevents removing its final photo', async () => {
    mockGet.mockResolvedValue({
      content: {
        heading: 'Gallery',
        items: [{
          id: 'faith',
          title: 'Faith',
          image: '/assets/faith.jpg',
          photos: ['/assets/faith.jpg', '/uploads/second.jpg', '/assets/third.jpg'],
        }],
      },
    })
    render(<SiteContentEditorPage page="gallery" />)

    fireEvent.change(await screen.findByRole('textbox', { name: 'Album title' }), {
      target: { value: 'Parish Life' },
    })
    fireEvent.change(screen.getByLabelText('Cover photo for Parish Life'), {
      target: { value: '/uploads/second.jpg' },
    })

    expect(screen.getByRole('img', { name: 'Parish Life cover' }).getAttribute('src')).toContain('/uploads/second.jpg')
    fireEvent.click(screen.getByRole('button', { name: 'Save and publish' }))
    await screen.findByText('Changes saved and published.')
    expect(mockSave).toHaveBeenLastCalledWith('gallery', expect.objectContaining({
      items: [expect.objectContaining({
        title: 'Parish Life',
        image: '/uploads/second.jpg',
      })],
    }), expect.any(String))

    fireEvent.click(screen.getByRole('button', { name: 'Remove photo 2 from Parish Life' }))

    expect((screen.getByLabelText('Cover photo for Parish Life') as HTMLSelectElement).value).toBe('/assets/faith.jpg')
    expect(screen.getByRole('img', { name: 'Parish Life photo 2' }).getAttribute('src')).toContain('/assets/third.jpg')
    fireEvent.click(screen.getByRole('button', { name: 'Remove photo 2 from Parish Life' }))
    expect((screen.getByRole('button', { name: 'Remove photo 1 from Parish Life' }) as HTMLButtonElement).disabled).toBe(true)
  })
})
