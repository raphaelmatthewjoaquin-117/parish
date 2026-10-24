import { describe, expect, it } from 'vitest'
import { API_BASE_URL, getMediaUrl } from './client'

describe('getMediaUrl', () => {
  it('serves legacy private Azure image URLs through the API', () => {
    expect(getMediaUrl('https://parishuploads.blob.core.windows.net/uploads/64d456bb-dcbd-4e7b-947f-9852d7f5c060.jpg'))
      .toBe(`${API_BASE_URL}/uploads/64d456bb-dcbd-4e7b-947f-9852d7f5c060.jpg`)
  })

  it('serves relative uploaded image paths through the API', () => {
    expect(getMediaUrl('/uploads/photo.jpg')).toBe(`${API_BASE_URL}/uploads/photo.jpg`)
  })

  it('leaves app assets on the frontend origin', () => {
    expect(getMediaUrl('/assets/photo.jpg')).toBe('/assets/photo.jpg')
  })

  it('leaves unrelated external image URLs unchanged', () => {
    expect(getMediaUrl('https://example.com/photo.jpg')).toBe('https://example.com/photo.jpg')
  })
})
