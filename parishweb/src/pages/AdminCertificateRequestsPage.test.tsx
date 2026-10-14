import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminCertificateRequestsPage } from './AdminCertificateRequestsPage'
import { apiClient } from '../api/client'

vi.mock('../api/client', () => ({
  API_BASE_URL: 'http://localhost:5000',
  apiClient: {
    admin: {
      certificateRequests: vi.fn(),
      certificateRequestDocuments: vi.fn(),
      updateCertificateRequest: vi.fn(),
      deleteCertificateRequest: vi.fn(),
    },
  },
  useApiError: (error: unknown) => error instanceof Error ? error.message : 'Request failed',
}))

describe('AdminCertificateRequestsPage', () => {
  afterEach(() => vi.unstubAllGlobals())

  beforeEach(() => {
    vi.clearAllMocks()
    window.localStorage.setItem('adminToken', 'staff-token')
    vi.mocked(apiClient.admin.certificateRequests).mockResolvedValue([{
      CertificateRequestId: 17,
      CertificateType: 'Baptism',
      PreferredDate: '2026-10-22T00:00:00.000Z',
      PreferredTime: '10:00',
      Status: 'Requested',
      Notes: 'Please call before the appointment.',
      FirstName: 'Reiley',
      LastName: 'Espino',
      EmailAddress: 'reiley@example.com',
      ReferenceCode: 'A0366C',
      DocumentCount: 1,
    }])
    vi.mocked(apiClient.admin.certificateRequestDocuments).mockResolvedValue([])
    vi.mocked(apiClient.admin.updateCertificateRequest).mockResolvedValue({ message: 'Updated' })
    vi.mocked(apiClient.admin.deleteCertificateRequest).mockResolvedValue({ message: 'Certificate request deleted.' })
  })

  it('opens request details in a dialog when View request is selected', async () => {
    render(<AdminCertificateRequestsPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'View request' }))

    const dialog = await screen.findByRole('dialog', { name: 'Baptism certificate request' })
    expect(within(dialog).getByText('Reiley Espino')).toBeTruthy()
    expect(within(dialog).getByText('Please call before the appointment.')).toBeTruthy()
    expect(await screen.findByText('No documents uploaded.')).toBeTruthy()
  })

  it('keeps status updates available from the request details dialog', async () => {
    render(<AdminCertificateRequestsPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'View request' }))

    fireEvent.change(await screen.findByRole('combobox', { name: 'Update Baptism request status' }), {
      target: { value: 'Confirmed' },
    })

    await waitFor(() => {
      expect(apiClient.admin.updateCertificateRequest).toHaveBeenCalledWith(17, 'Confirmed', 'staff-token')
    })
  })

  it('asks for confirmation before deleting a request and closes the dialog after success', async () => {
    const confirm = vi.fn().mockReturnValue(true)
    vi.stubGlobal('confirm', confirm)
    render(<AdminCertificateRequestsPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'View request' }))

    const dialog = await screen.findByRole('dialog', { name: 'Baptism certificate request' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete request' }))

    expect(confirm).toHaveBeenCalled()
    await waitFor(() => {
      expect(apiClient.admin.deleteCertificateRequest).toHaveBeenCalledWith(17, 'staff-token')
      expect(screen.queryByRole('dialog')).toBeNull()
    })
  })

  it('leaves a request unchanged when deletion is cancelled', async () => {
    const confirm = vi.fn().mockReturnValue(false)
    vi.stubGlobal('confirm', confirm)
    render(<AdminCertificateRequestsPage />)
    fireEvent.click(await screen.findByRole('button', { name: 'View request' }))

    const dialog = await screen.findByRole('dialog', { name: 'Baptism certificate request' })
    fireEvent.click(within(dialog).getByRole('button', { name: 'Delete request' }))

    expect(confirm).toHaveBeenCalled()
    expect(apiClient.admin.deleteCertificateRequest).not.toHaveBeenCalled()
    expect(screen.getByRole('dialog', { name: 'Baptism certificate request' })).toBeTruthy()
  })

  it('shows uploaded documents inside the request details dialog', async () => {
    vi.mocked(apiClient.admin.certificateRequestDocuments).mockResolvedValue([{
      CertificateRequestDocumentId: 3,
      OriginalFileName: 'Baptism-record.pdf',
      FileUrl: '/api/admin/certificate-requests/17/documents/3/file',
      MimeType: 'application/pdf',
      FileSizeBytes: 2048,
      UploadedAt: '2026-09-01T12:00:00.000Z',
    }])
    render(<AdminCertificateRequestsPage />)

    fireEvent.click(await screen.findByRole('button', { name: 'View request' }))

    expect(await screen.findByRole('link', { name: 'Baptism-record.pdf' })).toBeTruthy()
  })
})
