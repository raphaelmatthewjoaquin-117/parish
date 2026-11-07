import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
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
    details: {
      birthCertificate: {
        fieldKey: 'birthCertificate',
        fileName: 'birth-certificate.pdf',
        label: 'Birth certificate',
      },
    },
  },
]

afterEach(() => {
  vi.restoreAllMocks()
})

describe('AdminEventsPage service request status filter', () => {
  beforeEach(() => {
    window.localStorage.setItem('adminToken', 'staff-token')
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      if (url.includes('/documents/')) {
        return { ok: true, blob: async () => new Blob(['%PDF-1.7'], { type: 'application/pdf' }) } as Response
      }
      const body = url.endsWith('/api/admin/verify')
        ? { user: { role: 'Secretary' } }
        : requests
      return { ok: true, json: async () => body } as Response
    }))
  })

  it('displays service requests in a table with clear scan-friendly columns', async () => {
    render(<AdminEventsPage initialTab="service-requests" embedded />)

    const requestTable = await screen.findByRole('table', { name: 'Service requests' })

    expect(within(requestTable).getAllByRole('row')).toHaveLength(3)
    expect(within(requestTable).getByRole('columnheader', { name: 'Service' })).toBeTruthy()
    expect(within(requestTable).getByRole('columnheader', { name: 'Request ID' })).toBeTruthy()
    expect(within(requestTable).getByRole('columnheader', { name: 'Name' })).toBeTruthy()
    expect(within(requestTable).getByRole('columnheader', { name: 'Scheduled' })).toBeTruthy()
    expect(within(requestTable).getByRole('columnheader', { name: 'Email' })).toBeTruthy()
    expect(within(requestTable).getByRole('columnheader', { name: 'Status' })).toBeTruthy()
    expect(within(requestTable).getByRole('columnheader', { name: 'Actions' })).toBeTruthy()
    expect(within(requestTable).getByText('Baptism')).toBeTruthy()
    expect(within(requestTable).getByText('Baptism').className).toContain('service-baptism')
    expect(within(requestTable).getByText('Marriage').className).toContain('service-marriage')
    expect(within(requestTable).getByText('#11')).toBeTruthy()
    expect(within(requestTable).getByText('Alex Confirmed')).toBeTruthy()
    expect(within(requestTable).getByRole('button', { name: 'View request from Alex Confirmed' })).toBeTruthy()
    expect(within(requestTable).queryAllByRole('button', { name: /Confirm request|Delete request/ })).toHaveLength(0)
  })

  it('keeps confirm and delete actions in the service request detail modal', async () => {
    render(<AdminEventsPage initialTab="service-requests" embedded />)
    const requestTable = await screen.findByRole('table', { name: 'Service requests' })

    fireEvent.click(within(requestTable).getByRole('button', { name: 'View request from Taylor Pending' }))

    const dialog = screen.getByRole('dialog', { name: 'Service Request Detail' })
    expect(within(dialog).getByRole('button', { name: 'Confirm Booking' })).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Delete Request' })).toBeTruthy()
  })

  it('previews an uploaded service document in the detail modal', async () => {
    vi.spyOn(window.URL, 'createObjectURL').mockReturnValue('about:blank')
    const revokeObjectURL = vi.spyOn(window.URL, 'revokeObjectURL')
    render(<AdminEventsPage initialTab="service-requests" embedded />)
    const requestTable = await screen.findByRole('table', { name: 'Service requests' })

    fireEvent.click(within(requestTable).getByRole('button', { name: 'View request from Taylor Pending' }))
    const dialog = screen.getByRole('dialog', { name: 'Service Request Detail' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'View birth-certificate.pdf' }))

    expect(await within(dialog).findByTitle('Preview birth-certificate.pdf')).toBeTruthy()
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/service-requests/12/documents/birthCertificate'),
      expect.objectContaining({ headers: { 'x-admin-token': 'staff-token' } }),
    )
    fireEvent.click(within(dialog).getByRole('button', { name: 'Close preview of birth-certificate.pdf' }))
    await waitFor(() => expect(revokeObjectURL).toHaveBeenCalledWith('about:blank'))
  })

  it('shows only requests matching the selected status', async () => {
    render(<AdminEventsPage initialTab="service-requests" embedded />)
    const requestTable = await screen.findByRole('table', { name: 'Service requests' })
    await waitFor(() => expect(within(requestTable).getAllByRole('row')).toHaveLength(3))

    fireEvent.change(screen.getByRole('combobox', { name: 'Filter service requests by status' }), {
      target: { value: 'Confirmed' },
    })

    expect(within(requestTable).getAllByRole('row')).toHaveLength(2)
    expect(within(requestTable).getByText('Alex Confirmed')).toBeTruthy()
    expect(within(requestTable).queryByText('Taylor Pending')).toBeNull()
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

describe('AdminEventsPage prayer details', () => {
  beforeEach(() => {
    window.localStorage.setItem('adminToken', 'staff-token')
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.endsWith('/api/admin/verify')
        ? { user: { role: 'Admin' } }
        : url.endsWith('/api/admin/prayers')
          ? [{
            id: 21,
            name: 'Jordan Parishioner',
            category: 'healing',
            request: 'Please pray for a full recovery.',
            anonymous: false,
            shareWithCommunity: true,
            isApproved: false,
            createdAt: '2026-10-28T08:00:00.000Z',
          }]
          : []
      return { ok: true, json: async () => body } as Response
    }))
  })

  it('uses the client prayer details modal while retaining admin status and actions', async () => {
    render(<AdminEventsPage initialTab="prayers" embedded />)

    fireEvent.click(await screen.findByRole('button', { name: 'View' }))

    const dialog = screen.getByRole('dialog', { name: 'Prayer Request' })
    expect(dialog.classList.contains('prayer-modal-card')).toBe(true)
    expect(within(dialog).getByText('Please pray for a full recovery.')).toBeTruthy()
    expect(within(dialog).getByText('Shared with community')).toBeTruthy()
    expect(within(dialog).getByText('Pending Approval')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Delete Prayer' })).toBeTruthy()
    fireEvent.click(within(dialog).getByRole('button', { name: 'Approve Prayer' }))
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/prayers/21/approve'),
      expect.objectContaining({ method: 'POST' }),
    )
  })
})

describe('AdminEventsPage sacramental record details', () => {
  it('switches between register records and the digital archive within the module', async () => {
    window.localStorage.setItem('adminToken', 'staff-token')
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.endsWith('/api/admin/verify')
        ? { user: { role: 'Admin' } }
        : url.includes('/api/admin/sacramental/search')
          ? { records: [], pagination: { total: 0 } }
          : { archives: [] }
      return { ok: true, json: async () => body } as Response
    }))

    render(<AdminEventsPage initialTab="sacramental-ledger" embedded />)
    expect(await screen.findByText('No sacramental records found matching your criteria.')).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Digital Archives' }))
    expect(await screen.findByRole('heading', { name: 'Archive collection' })).toBeTruthy()
    fireEvent.click(screen.getByRole('tab', { name: 'Records' }))
    expect(await screen.findByText('No sacramental records found matching your criteria.')).toBeTruthy()
  })

  it.each([
    {
      type: 'Baptism',
      expectedLabel: "Child's Name:",
      expectedName: 'Jordan Rivera',
      details: { ChildFirstName: 'Jordan', ChildLastName: 'Rivera' },
    },
    {
      type: 'Confirmation',
      expectedLabel: 'Candidate:',
      expectedName: 'Avery Lee',
      details: { CandidateFirstName: 'Avery', CandidateLastName: 'Lee' },
    },
    {
      type: 'Marriage',
      expectedLabel: 'Groom:',
      expectedName: 'Sam Rivera',
      details: { GroomFirstName: 'Sam', GroomLastName: 'Rivera' },
    },
    {
      type: 'Death',
      expectedLabel: 'Deceased:',
      expectedName: 'Morgan Lee',
      details: { DeceasedFirstName: 'Morgan', DeceasedLastName: 'Lee' },
    },
  ])('presents $type record details in the shared labeled layout', async ({ type, expectedLabel, expectedName, details }) => {
    window.localStorage.setItem('adminToken', 'staff-token')
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.endsWith('/api/admin/verify')
        ? { user: { role: 'Admin' } }
        : url.includes('/api/admin/sacramental/search')
          ? {
            records: [{
              Id: 7,
              RecordType: type,
              RegistryNumber: 'R-102',
              Name: expectedName,
              RecordDate: '2026-10-21',
              Priest: 'Fr. Santos',
            }],
            pagination: { total: 1 },
          }
          : url.endsWith('/7/audit')
            ? [{
              AuditId: 1,
              ActionName: 'Create',
              ChangedBy: 'Admin',
              ChangedAt: '2026-10-21T15:46:09.000Z',
              Changes: '{"RegistryNumber":"R-102"}',
            }]
            : url.includes(`/api/admin/sacramental/${type.toLowerCase()}/7`)
              ? details
              : { archives: [] }
      return { ok: true, json: async () => body } as Response
    }))

    render(<AdminEventsPage initialTab="sacramental-ledger" embedded />)
    fireEvent.click(await screen.findByRole('button', { name: 'View' }))

    const dialog = await screen.findByRole('dialog', { name: `${type} Record Detail` })
    expect(dialog.classList.contains('sacramental-detail-modal')).toBe(true)
    expect(within(dialog).getByText('R-102')).toBeTruthy()
    expect(within(dialog).getByText(expectedLabel)).toBeTruthy()
    expect(within(dialog).getByText(expectedName)).toBeTruthy()
    expect(within(dialog).getByText('Change history')).toBeTruthy()
    expect(within(dialog).getByRole('button', { name: 'Close record details' })).toBeTruthy()
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
