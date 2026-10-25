import { describe, expect, it } from 'vitest'
import { API_BASE_URL, getMediaUrl, resolveApiBaseUrl } from './client'

describe('resolveApiBaseUrl', () => {
  it('requires an HTTPS API URL for production builds', () => {
    expect(() => resolveApiBaseUrl(undefined, true))
      .toThrow('VITE_API_URL must be set to the public HTTPS API URL in production.')
    expect(resolveApiBaseUrl('https://parish-api.example.com', true))
      .toBe('https://parish-api.example.com')
  })

  it('rejects localhost as a production API URL', () => {
    expect(() => resolveApiBaseUrl('http://localhost:5000', true))
      .toThrow('VITE_API_URL must use a public HTTPS URL in production.')
  })

  it('rejects API URLs that contain a path instead of only the service origin', () => {
    expect(() => resolveApiBaseUrl('https://parish-api.example.com/api', true))
      .toThrow('VITE_API_URL must use a public HTTPS URL in production.')
  })

  it('keeps the localhost default for development', () => {
    expect(resolveApiBaseUrl(undefined, false)).toBe('http://localhost:5000')
  })
})

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
