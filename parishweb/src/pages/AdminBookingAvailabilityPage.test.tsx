import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminBookingAvailabilityPage } from './AdminBookingAvailabilityPage'

const apiMocks = vi.hoisted(() => ({
  blockedSlots: vi.fn(),
  createBlockedSlot: vi.fn(),
  deleteBlockedSlot: vi.fn(),
  listServices: vi.fn(),
}))

vi.mock('@fullcalendar/react', () => ({
  default: ({ dateClick }: { dateClick?: (arg: { dateStr: string }) => void }) => (
    <button type="button" onClick={() => dateClick?.({ dateStr: nextOfficeDate() })}>Select an office date</button>
  ),
}))

vi.mock('../api/client', () => ({
  apiClient: {
    admin: {
      blockedSlots: apiMocks.blockedSlots,
      createBlockedSlot: apiMocks.createBlockedSlot,
      deleteBlockedSlot: apiMocks.deleteBlockedSlot,
    },
    services: { list: apiMocks.listServices },
  },
  useApiError: (reason: unknown) => reason instanceof Error ? reason.message : String(reason),
}))

function nextOfficeDate() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  while (date.getDay() === 1) date.setDate(date.getDate() + 1)
  return [
    date.getFullYear(),
    String(date.getMonth() + 1).padStart(2, '0'),
    String(date.getDate()).padStart(2, '0'),
  ].join('-')
}

describe('AdminBookingAvailabilityPage', () => {
  beforeEach(() => {
    window.localStorage.setItem('adminToken', 'test-token')
    apiMocks.blockedSlots.mockResolvedValue([])
    apiMocks.createBlockedSlot.mockResolvedValue({ id: 1 })
    apiMocks.deleteBlockedSlot.mockResolvedValue({ success: true })
    apiMocks.listServices.mockResolvedValue([])
  })

  it('lets staff click an office date on the calendar and create a block for that date', async () => {
    render(<AdminBookingAvailabilityPage />)

    fireEvent.click(screen.getByRole('button', { name: 'Select an office date' }))
    expect(screen.getByText(`Selected: ${new Date(`${nextOfficeDate()}T00:00:00`).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric', year: 'numeric' })}`)).toBeTruthy()

    fireEvent.change(screen.getByLabelText('Time'), { target: { value: '09:00' } })
    fireEvent.click(screen.getByRole('button', { name: 'Block date' }))

    await waitFor(() => expect(apiMocks.createBlockedSlot).toHaveBeenCalledWith({
      date: nextOfficeDate(),
      time: '09:00',
      scope: 'All',
      serviceId: null,
      reason: '',
    }, 'test-token'))
  })
})
