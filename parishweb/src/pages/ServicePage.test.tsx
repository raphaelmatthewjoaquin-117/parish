import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import ServicePage from './ServicePage'

describe('ServicePage document uploads', () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    fetchMock.mockClear()
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      let body: unknown = {}
      if (url.endsWith('/api/services')) body = [{ id: 1, name: 'Baptism' }]
      else if (url.endsWith('/api/site-content/services')) {
        body = { content: { '1': { description: 'Baptism details from CMS', backgroundImage: '/uploads/baptism.jpg' } } }
      }
      else if (url.endsWith('/api/services/1/slots')) {
        body = { slots: [{ date: '2026-11-07', time: '09:00', available: true }] }
      } else if (url.endsWith('/api/services/1/fields')) {
        body = { fields: [
          { key: 'birthCertificate', label: 'Birth certificate', type: 'file', required: true },
          { key: 'permissionLetter', label: 'Letter of permission', type: 'file', required: false },
        ] }
      } else if (url.endsWith('/api/service-requests') && init?.method === 'POST') {
        body = { requestId: 42, status: 'PendingVerification' }
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
    const result = await screen.findByRole('dialog')
    expect(result.textContent).toContain('Booking request submitted')
    expect(result.textContent).not.toContain('42')
    expect(result.textContent).not.toContain('Pending Verification')
    expect(result.closest('.booking-result-backdrop')?.parentElement).toBe(document.body)
    expect((screen.getByLabelText('First name') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Last name') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Email') as HTMLInputElement).value).toBe('')
    expect((screen.getByLabelText('Phone') as HTMLInputElement).value).toBe('')
    expect((birthCertificate as HTMLInputElement).value).toBe('')

    const submission = fetchMock.mock.calls.find(([url, init]) => String(url).endsWith('/api/service-requests') && init?.method === 'POST')
    expect(submission).toBeTruthy()
    const formData = submission?.[1]?.body as FormData
    expect(formData.get('documentKeys')).toBe('["birthCertificate"]')
    expect(formData.get('documents')).toBe(file)
  })

  it('submits only one booking when the client rapidly clicks twice', async () => {
    let resolveBooking: (response: Response) => void = () => {
      throw new Error('Booking response was not requested')
    }
    fetchMock.mockImplementation((input: RequestInfo | URL, init?: RequestInit) => {
      if (String(input).endsWith('/api/service-requests') && init?.method === 'POST') {
        return new Promise<Response>(resolve => { resolveBooking = resolve })
      }
      return Promise.resolve(new Response(JSON.stringify(
        String(input).endsWith('/api/services') ? [{ id: 1, name: 'Baptism' }]
          : String(input).endsWith('/api/site-content/services') ? { content: {} }
            : String(input).endsWith('/api/services/1/slots') ? { slots: [{ date: '2026-11-07', time: '09:00', available: true }] }
              : String(input).endsWith('/api/services/1/fields') ? { fields: [] }
                : {}
      ), { status: 200, headers: { 'Content-Type': 'application/json' } }))
    })

    const user = userEvent.setup()
    render(<ServicePage />)
    await user.type(await screen.findByLabelText('First name'), 'Maria')
    await user.type(screen.getByLabelText('Last name'), 'Santos')
    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Phone'), '09123456789')
    await user.click(await screen.findByRole('button', { name: /Choose this time/ }))

    await user.dblClick(screen.getByRole('button', { name: 'Book appointment' }))
    await waitFor(() => expect(fetchMock.mock.calls.filter(([url, init]) =>
      String(url).endsWith('/api/service-requests') && init?.method === 'POST'
    )).toHaveLength(1))

    resolveBooking(new Response(JSON.stringify({ requestId: 42 }), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }))
    expect(await screen.findByRole('dialog')).toBeTruthy()
  })

  it('shows booking errors in the modal and keeps the form values for retry', async () => {
    fetchMock.mockImplementation(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/api/service-requests') && init?.method === 'POST') {
        return new Response(JSON.stringify({ message: 'Unable to create booking.' }), {
          status: 500,
          headers: { 'Content-Type': 'application/json' },
        })
      }
      const body = url.endsWith('/api/services') ? [{ id: 1, name: 'Baptism' }]
        : url.endsWith('/api/site-content/services') ? { content: {} }
          : url.endsWith('/api/services/1/slots') ? { slots: [{ date: '2026-11-07', time: '09:00', available: true }] }
            : url.endsWith('/api/services/1/fields') ? { fields: [] }
              : {}
      return new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } })
    })

    const user = userEvent.setup()
    render(<ServicePage />)
    const firstName = await screen.findByLabelText('First name') as HTMLInputElement
    await user.type(firstName, 'Maria')
    await user.type(screen.getByLabelText('Last name'), 'Santos')
    await user.type(screen.getByLabelText('Email'), 'maria@example.com')
    await user.type(screen.getByLabelText('Phone'), '09123456789')
    await user.click(await screen.findByRole('button', { name: /Choose this time/ }))
    await user.click(screen.getByRole('button', { name: 'Book appointment' }))

    const result = await screen.findByRole('dialog')
    expect(result.textContent).toContain('Booking could not be completed')
    expect(result.textContent).toContain('Unable to create booking.')
    expect(firstName.value).toBe('Maria')
  })

  it('uses the saved service description and background image', async () => {
    render(<ServicePage />)

    expect(await screen.findByText('Baptism details from CMS')).toBeTruthy()
    const serviceDetail = screen.getByRole('heading', { name: 'Baptism' }).closest('.service-detail')
    expect(serviceDetail?.getAttribute('style')).toContain('baptism.jpg')
  })
})
