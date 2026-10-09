import { fireEvent, render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { GalleryPage } from './GalleryPage'

const { mockGet } = vi.hoisted(() => ({
  mockGet: vi.fn().mockResolvedValue({ content: null }),
}))

vi.mock('../api/client', () => ({
  API_BASE_URL: '',
  apiClient: {
    siteContent: {
      get: mockGet,
    },
  },
}))

describe('GalleryPage', () => {
  it('opens the selected photo album and provides a link back to the gallery', async () => {
    render(
      <MemoryRouter initialEntries={['/gallery']}>
        <Routes>
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/gallery/:albumId" element={<GalleryPage />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.click(await screen.findByRole('link', { name: 'Open Faith album' }))

    expect(await screen.findByRole('heading', { name: 'Faith' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Faith photo 1' })).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to gallery' }).getAttribute('href')).toBe('/gallery')
  })

  it('shows a not-found message for an unknown album', async () => {
    render(
      <MemoryRouter initialEntries={['/gallery/missing']}>
        <Routes>
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/gallery/:albumId" element={<GalleryPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByText('Album not found.')).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Back to gallery' }).getAttribute('href')).toBe('/gallery')
  })

  it('shows every photo in a multi-photo album', async () => {
    mockGet.mockResolvedValue({
      content: {
        heading: 'Gallery',
        items: [{
          id: 'faith',
          title: 'Faith',
          image: '/assets/cover.jpg',
          photos: ['/assets/cover.jpg', '/assets/second.jpg'],
        }],
      },
    })
    render(
      <MemoryRouter initialEntries={['/gallery/faith']}>
        <Routes>
          <Route path="/gallery/:albumId" element={<GalleryPage />} />
        </Routes>
      </MemoryRouter>,
    )

    expect(await screen.findByRole('img', { name: 'Faith photo 1' })).toBeTruthy()
    expect(screen.getByRole('img', { name: 'Faith photo 2' })).toBeTruthy()
  })
})
