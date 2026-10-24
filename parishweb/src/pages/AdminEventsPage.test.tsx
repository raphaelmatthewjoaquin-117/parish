import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminEventsPage } from './AdminEventsPage'

const requests = [
  {
    id: 11,
    parishionerId: 1,
    serviceId: 2,
    firstName: 'Alex',
    lastName: 'Confirmed',
    email: 'alex@example.com',
    mobileNumber: '09123456789',
    address: 'Manila',
    serviceName: 'Baptism',
    scheduledDate: '2026-10-20',
    scheduledTime: '10:00',
    status: 'Confirmed',
    notes: '',
    createdAt: '2026-10-01T08:00:00.000Z',
  },
  {
    id: 12,
    parishionerId: 2,
    serviceId: 3,
    firstName: 'Taylor',
    lastName: 'Pending',
    email: 'taylor@example.com',
    mobileNumber: '09987654321',
    address: 'Quezon City',
    serviceName: 'Marriage',
    scheduledDate: '2026-10-21',
    scheduledTime: '14:00',
    status: 'PendingVerification',
    notes: '',
    createdAt: '2026-10-02T08:00:00.000Z',
  },
]

describe('AdminEventsPage service request status filter', () => {
  beforeEach(() => {
    window.localStorage.setItem('adminToken', 'staff-token')
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.endsWith('/api/admin/verify')
        ? { user: { role: 'Secretary' } }
        : requests
      return { ok: true, json: async () => body } as Response
    }))
  })

  it('shows only requests matching the selected status', async () => {
    render(<AdminEventsPage initialTab="service-requests" embedded />)
    const requestList = await screen.findByRole('list')
    await waitFor(() => expect(within(requestList).getAllByRole('listitem')).toHaveLength(2))

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter service requests by status' }), {
      target: { value: 'Confirmed' },
    })

    expect(within(requestList).getByText('Alex Confirmed')).toBeTruthy()
    expect(within(requestList).queryByText('Taylor Pending')).toBeNull()
  })
})

describe('AdminEventsPage event details', () => {
  beforeEach(() => {
    window.localStorage.setItem('adminToken', 'staff-token')
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.endsWith('/api/admin/verify')
        ? { user: { role: 'Secretary' } }
        : url.endsWith('/api/events')
          ? [{
            id: 'event-1',
            title: 'Parish Feast',
            description: 'Celebrate together',
            detail: 'Community gathering',
            date: '2026-11-01',
            time: '10:00',
            location: 'Parish grounds',
            photoUrl: '',
          }]
          : []
      return { ok: true, json: async () => body } as Response
    }))
  })

  it('opens the selected event details from the event management list', async () => {
    render(<AdminEventsPage initialTab="events" embedded />)

    fireEvent.click(await screen.findByRole('button', { name: 'View' }))

    const dialog = screen.getByRole('dialog', { name: 'Parish Feast' })
    expect(dialog.parentElement?.parentElement).toBe(document.body)
    expect(within(dialog).getByText('Celebrate together')).toBeTruthy()
    expect(within(dialog).getByText('Community gathering')).toBeTruthy()
    expect(within(dialog).getByText('Parish grounds')).toBeTruthy()
  })
})

describe('AdminEventsPage event action feedback', () => {
  beforeEach(() => {
    window.localStorage.setItem('adminToken', 'staff-token')
    vi.stubGlobal('confirm', vi.fn(() => true))
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.endsWith('/api/admin/verify')
        ? { user: { role: 'Admin' } }
        : url.endsWith('/api/events')
          ? [{
            id: 'event-1',
            title: 'Parish Feast',
            description: 'Celebrate together',
            detail: 'Community gathering',
            date: '2026-11-01',
            time: '10:00',
            location: 'Parish grounds',
            photoUrl: '',
          }]
          : {}
      return { ok: true, json: async () => body } as Response
    }))
  })

  it('confirms when an event is added', async () => {
    render(<AdminEventsPage initialTab="events" embedded />)

    fireEvent.change(await screen.findByLabelText('Title', { selector: 'input' }), { target: { value: 'New event' } })
    fireEvent.change(screen.getByLabelText('Date'), { target: { value: '2026-12-01' } })
    fireEvent.click(screen.getByRole('button', { name: 'Add event' }))

    expect((await screen.findByRole('status')).textContent).toContain('Event added successfully.')
  })

  it('confirms when an event is edited', async () => {
    render(<AdminEventsPage initialTab="events" embedded />)

    fireEvent.click(await screen.findByRole('button', { name: 'Edit' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    expect((await screen.findByRole('status')).textContent).toContain('Event updated successfully.')
  })

  it('confirms when an event is deleted', async () => {
    render(<AdminEventsPage initialTab="events" embedded />)

    fireEvent.click(await screen.findByRole('button', { name: 'Delete' }))

    expect((await screen.findByRole('status')).textContent).toContain('Event deleted successfully.')
  })
})

describe('AdminEventsPage login password visibility', () => {
  beforeEach(() => {
    window.localStorage.removeItem('adminToken')
  })

  it('shows and hides the password on the staff sign-in form', async () => {
    render(<AdminEventsPage />)

    const passwordInput = await screen.findByLabelText('Password')
    expect(passwordInput.getAttribute('type')).toBe('password')

    fireEvent.click(screen.getByRole('button', { name: 'Show password' }))
    expect(passwordInput.getAttribute('type')).toBe('text')
    expect(screen.getByRole('button', { name: 'Hide password' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Hide password' }))
    expect(passwordInput.getAttribute('type')).toBe('password')
  })
})
