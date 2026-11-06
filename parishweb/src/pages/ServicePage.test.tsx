import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ServicePage from './ServicePage'

describe('ServicePage document uploads', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      let body: unknown = {}
      if (url.endsWith('/api/services')) body = [{ id: 1, name: 'Baptism' }]
      else if (url.endsWith('/api/services/1/slots')) {
        body = { slots: [{ date: '2026-11-07', time: '09:00', available: true }] }
      } else if (url.endsWith('/api/services/1/fields')) {
        body = { fields: [
          { key: 'birthCertificate', label: 'Birth certificate', type: 'file', required: true },
          { key: 'permissionLetter', label: 'Letter of permission', type: 'file', required: false },
        ] }
      } else if (url.endsWith('/api/service-requests') && init?.method === 'POST') {
        body = { requestId: 42 }
      }

      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })
    vi.stubGlobal('fetch', fetchMock)
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('blocks submission without required documents and includes uploaded files in the request', async () => {
    const user = userEvent.setup()
    render(<ServicePage />)

    const birthCertificate = await screen.findByLabelText(/Birth certificate/)
    const permissionLetter = await screen.findByLabelText(/Letter of permission/)
    expect(birthCertificate).toHaveProperty('required', true)
    expect(permissionLetter).toHaveProperty('required', false)

    await user.type(screen.getByLabelText('First name'), 'Maria')
    await user.type(screen.getByLabelText('Last name'), 'Santos')
    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Phone'), '09123456789')
    await user.click(await screen.findByRole('button', { name: /Choose this time/ }))

    const submit = screen.getByRole('button', { name: 'Book appointment' })
    expect((submit as HTMLButtonElement).disabled).toBe(true)

    const file = new File(['%PDF-1.7'], 'birth-certificate.pdf', { type: 'application/pdf' })
    await user.upload(birthCertificate, file)
    expect((submit as HTMLButtonElement).disabled).toBe(false)

    await user.click(submit)
    await waitFor(() => expect(screen.getByText(/parish staff will review it/i)).toBeTruthy())

    const submission = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith('/api/service-requests') && init?.method === 'POST')
    expect(submission).toBeTruthy()
    const formData = submission?.[1]?.body as FormData
    expect(formData.get('documentKeys')).toBe('["birthCertificate"]')
    expect(formData.get('documents')).toBe(file)
  })
})
