import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { UnifiedAdminPage } from './UnifiedAdminPage'

describe('UnifiedAdminPage local preview login', () => {
  beforeEach(() => {
    window.localStorage.removeItem('adminToken')
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input)
      const body = url.endsWith('/api/admin/login')
        ? { token: 'local-token', user: { id: 0, role: 'Admin', localPreview: true } }
        : url.endsWith('/api/admin/verify')
          ? { user: { id: 0, role: 'Admin', userName: 'localadmin', email: '', mustChangePassword: false, overrides: {} } }
          : []
      return { ok: true, json: async () => body } as Response
    }))
  })

  it('explains that local preview access has no database-backed data or actions', async () => {
    render(<UnifiedAdminPage />)

    fireEvent.change(await screen.findByRole('textbox', { name: 'Email or username' }), {
      target: { value: 'localadmin' },
    })
    fireEvent.change(screen.getByLabelText('Password'), { target: { value: 'local-password' } })
    fireEvent.click(screen.getByRole('button', { name: 'Sign in' }))

    expect(await screen.findByText(/Local preview sign-in only/)).toBeTruthy()
    expect(await screen.findByText('Santo Domingo Parish · localadmin')).toBeTruthy()
  })
})
