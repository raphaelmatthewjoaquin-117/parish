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
