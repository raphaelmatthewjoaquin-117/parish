import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SacramentalArchivesTab } from './SacramentalArchivesTab'

describe('SacramentalArchivesTab', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      if (url.endsWith('/api/admin/sacramental/upload-archive')) {
        return { ok: true, json: async () => ({ fileUrl: '/uploads/old-scan.pdf' }) } as Response
      }
      if (url.endsWith('/api/admin/sacramental/archives') && init?.method === 'POST') {
        return { ok: true, json: async () => ({ id: 8 }) } as Response
      }
      return { ok: true, json: async () => ({ archives: [] }) } as Response
    }))
  })

  it('uploads a scan without requiring a registry number', async () => {
    render(<SacramentalArchivesTab adminToken="staff-token" canManage />)

    await screen.findByText('No archived documents match these filters.')
    fireEvent.change(screen.getByLabelText('Sacrament type'), { target: { value: 'baptism' } })
    fireEvent.change(screen.getByLabelText('Book number'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Page number'), { target: { value: '45' } })
    fireEvent.change(screen.getByLabelText(/Scan file/), {
      target: { files: [new File(['scan'], 'old-scan.pdf', { type: 'application/pdf' })] },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Upload archive' }))

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/admin\/sacramental\/archives$/),
      expect.objectContaining({ method: 'POST' }),
    ))
    const metadataRequest = vi.mocked(fetch).mock.calls.find(([url, init]) =>
      String(url).endsWith('/api/admin/sacramental/archives') && init?.method === 'POST')
    expect(JSON.parse(String(metadataRequest?.[1]?.body))).toEqual({
      sacramentType: 'baptism',
      bookNumber: 1,
      pageNumber: 45,
      registryNumber: null,
      fileUrl: '/uploads/old-scan.pdf',
      notes: null,
    })
    expect(await screen.findByText('Archive uploaded.')).toBeTruthy()
  })

  it('can link a previously standalone scan to a register entry', async () => {
    const fetchMock = vi.fn(async (_input: RequestInfo | URL, init?: RequestInit) => {
      if (init?.method === 'PUT') return { ok: true, json: async () => ({ message: 'Archive entry updated.' }) } as Response
      return {
        ok: true,
        json: async () => ({
          archives: [{
            ArchiveId: 8,
            SacramentType: 'baptism',
            BookNumber: 1,
            PageNumber: 45,
            RegistryNumber: null,
            UploadedAt: '2026-10-01',
            UploadedBy: 'Secretary',
          }],
        }),
      } as Response
    })
    vi.stubGlobal('fetch', fetchMock)

    render(<SacramentalArchivesTab adminToken="staff-token" canManage />)
    await screen.findByRole('button', { name: 'Edit' })
    fireEvent.click(screen.getByRole('button', { name: 'Edit' }))
    fireEvent.change(screen.getByLabelText('Registry number (optional)'), { target: { value: 'B-1024' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save changes' }))

    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(
      expect.stringMatching(/\/api\/admin\/sacramental\/archives\/8$/),
      expect.objectContaining({ method: 'PUT' }),
    ))
    const updateRequest = fetchMock.mock.calls.find(([, init]) => init?.method === 'PUT')
    expect(JSON.parse(String(updateRequest?.[1]?.body))).toEqual({
      bookNumber: 1,
      pageNumber: 45,
      registryNumber: 'B-1024',
      notes: null,
    })
    expect(await screen.findByText('Archive entry updated.')).toBeTruthy()
  })
})
