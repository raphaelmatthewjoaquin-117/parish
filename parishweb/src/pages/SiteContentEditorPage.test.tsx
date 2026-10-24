import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import { SiteContentEditorPage } from './SiteContentEditorPage'

vi.mock('../api/client', () => ({
  API_BASE_URL: '',
  getMediaUrl: (url: string) => url,
  apiClient: {
    siteContent: {
      get: vi.fn().mockResolvedValue({ content: null }),
    },
  },
}))

describe('SiteContentEditorPage View page link', () => {
  it.each([
    ['about', '/about'],
    ['gallery', '/gallery'],
    ['contact', '/contact'],
    ['footer', '/'],
    ['news', '/news'],
  ] as const)('opens the %s page in a new tab', async (page, path) => {
    render(<SiteContentEditorPage page={page} />)

    const link = await screen.findByRole('link', { name: 'View page' })
    expect(link.getAttribute('href')).toBe(path)
    expect(link.getAttribute('target')).toBe('_blank')
    expect(link.getAttribute('rel')).toBe('noopener noreferrer')
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(apiClient.siteContent.get).toHaveBeenCalledWith(page)
  })
})
