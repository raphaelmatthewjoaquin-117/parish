import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminOperationsPage } from './AdminOperationsPage'

const apiMocks = vi.hoisted(() => ({
  serviceFields: vi.fn(),
  deleteServiceField: vi.fn(),
}))

vi.mock('../api/client', () => ({
  API_BASE_URL: 'http://localhost',
  apiClient: { admin: { serviceFields: apiMocks.serviceFields, deleteServiceField: apiMocks.deleteServiceField } },
  useApiError: (reason: unknown) => reason instanceof Error ? reason.message : String(reason),
}))

describe('AdminOperationsPage booking fields', () => {
  beforeEach(() => {
    window.localStorage.setItem('adminToken', 'test-token')
    apiMocks.serviceFields.mockResolvedValue([
      { id: 1, serviceId: 1, serviceName: 'Confirmation', key: 'birthCertificate', label: 'Birth certificate', type: 'file', required: true, sortOrder: 100, active: true },
      { id: 2, serviceId: 1, serviceName: 'Confirmation', key: 'customQuestion', label: 'Custom question', type: 'text', required: false, sortOrder: 103, active: true },
    ])
    apiMocks.deleteServiceField.mockResolvedValue({ message: 'Field definition deleted.' })
    Object.defineProperty(window, 'confirm', { configurable: true, value: vi.fn(() => true) })
    vi.stubGlobal('fetch', vi.fn(async () => ({
      json: async () => [{ id: 1, name: 'Confirmation' }],
    })))
  })

  it('keeps delete off built-in fields and shows it for custom fields', async () => {
    render(<AdminOperationsPage initialTab="service-fields" />)

    await screen.findByText('Birth certificate')
    const builtInField = screen.getByText('Birth certificate').closest('article')
    const customField = screen.getByText('Custom question').closest('article')
    expect(builtInField).not.toBeNull()
    expect(customField).not.toBeNull()
    await waitFor(() => {
      expect(within(builtInField as HTMLElement).getByRole('button', { name: 'Edit' })).toBeTruthy()
      expect(within(builtInField as HTMLElement).getByRole('button', { name: 'Hide' })).toBeTruthy()
    })
    expect(within(builtInField as HTMLElement).queryByRole('button', { name: 'Delete' })).toBeNull()
    expect(within(customField as HTMLElement).getByRole('button', { name: 'Delete' })).toBeTruthy()
  })

  it('deletes a custom booking field after confirmation', async () => {
    render(<AdminOperationsPage initialTab="service-fields" />)

    await screen.findByText('Custom question')
    const customField = screen.getByText('Custom question').closest('article')
    expect(customField).not.toBeNull()
    fireEvent.click(within(customField as HTMLElement).getByRole('button', { name: 'Delete' }))

    await waitFor(() => expect(apiMocks.deleteServiceField).toHaveBeenCalledWith(2, 'test-token'))
  })
})
