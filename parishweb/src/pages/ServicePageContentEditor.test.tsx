import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { apiClient } from '../api/client'
import { ServicePageContentEditor } from './ServicePageContentEditor'

vi.mock('../api/client', () => ({
  API_BASE_URL: '',
  getMediaUrl: (url: string) => url,
  apiClient: {
    siteContent: {
      get: vi.fn(),
      save: vi.fn(),
      uploadImage: vi.fn(),
    },
  },
}))

describe('ServicePageContentEditor', () => {
  beforeEach(() => {
    vi.mocked(apiClient.siteContent.get).mockResolvedValue({
      content: { '1': { description: 'Current baptism copy' } },
    })
    vi.mocked(apiClient.siteContent.save).mockResolvedValue({ content: {} })
    vi.mocked(apiClient.siteContent.uploadImage).mockResolvedValue({ photoUrl: '/uploads/baptism.jpg' })
    vi.stubGlobal('fetch', vi.fn(async () => new Response(
      JSON.stringify([{ id: 1, name: 'Baptism' }, { id: 2, name: 'Marriage' }]),
      { status: 200, headers: { 'Content-Type': 'application/json' } },
    )))
    window.localStorage.setItem('adminToken', 'admin-token')
  })

  it('loads the service copy and saves staff edits', async () => {
    const user = userEvent.setup()
    render(<ServicePageContentEditor />)

    const description = await screen.findByLabelText('Description')
    expect(description).toHaveProperty('value', 'Current baptism copy')
    await user.clear(description)
    await user.type(description, 'Updated baptism copy')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(apiClient.siteContent.save).toHaveBeenCalledWith(
      'services',
      { '1': { description: 'Updated baptism copy' } },
      'admin-token',
    ))
    expect(await screen.findByText('Changes saved and published.')).toBeTruthy()
  })

  it('keeps content scoped to the selected service page', async () => {
    const user = userEvent.setup()
    render(<ServicePageContentEditor />)

    await user.selectOptions(await screen.findByLabelText('Service page'), '2')
    const description = screen.getByLabelText('Description')
    await user.type(description, 'Marriage information')
    await user.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(apiClient.siteContent.save).toHaveBeenCalledWith(
      'services',
      {
        '1': { description: 'Current baptism copy' },
        '2': { description: 'Marriage information' },
      },
      'admin-token',
    ))
  })

  it('uploads and previews a background image for the selected service', async () => {
    const user = userEvent.setup()
    render(<ServicePageContentEditor />)

    const imageInput = await screen.findByLabelText(/Background image/)
    await user.upload(imageInput, new File(['image'], 'baptism.jpg', { type: 'image/jpeg' }))

    expect(await screen.findByRole('img', { name: 'Baptism background preview' })).toBeTruthy()
    expect(apiClient.siteContent.uploadImage).toHaveBeenCalled()
  })
})
