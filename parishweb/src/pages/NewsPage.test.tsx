import { act, render, screen } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { NewsPage } from './NewsPage'

vi.mock('@fullcalendar/react', () => ({ default: () => null }))
vi.mock('@fullcalendar/daygrid', () => ({ default: {} }))
vi.mock('@fullcalendar/timegrid', () => ({ default: {} }))
vi.mock('@fullcalendar/interaction', () => ({ default: {} }))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('NewsPage content refresh', () => {
  it('updates published events and church news without reloading the page', async () => {
    let refreshed = false
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.includes('/api/site-content/news')
        ? { content: { articles: [{ id: 'news-1', title: refreshed ? 'New parish news' : 'Old parish news', body: 'News update' }] } }
        : [{ id: 'event-1', title: refreshed ? 'New parish event' : 'Old parish event', date: '2027-01-15', description: 'Parish event' }]
      return new Response(JSON.stringify(body), {
        headers: { 'content-type': 'application/json' },
      })
    }))
    const setIntervalSpy = vi.spyOn(window, 'setInterval')

    render(<NewsPage />)

    expect(await screen.findByText('Old parish event')).toBeTruthy()
    expect(await screen.findByText('Old parish news')).toBeTruthy()
    const refresh = setIntervalSpy.mock.calls.find(([, delay]) => delay === 30_000)?.[0]
    expect(refresh).toEqual(expect.any(Function))

    refreshed = true
    await act(async () => {
      if (typeof refresh === 'function') refresh()
    })

    expect(await screen.findByText('New parish event')).toBeTruthy()
    expect(await screen.findByText('New parish news')).toBeTruthy()
  })
})
