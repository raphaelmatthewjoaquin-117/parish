import { fireEvent, render, screen } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { AdminUsersPage } from './AdminUsersPage'

describe('AdminUsersPage password visibility', () => {
  beforeEach(() => {
    window.localStorage.setItem('adminToken', 'staff-token')
    vi.stubGlobal('fetch', vi.fn(async (input: RequestInfo | URL) => ({
      ok: true,
      json: async () => String(input).endsWith('/api/admin/users')
        ? [{
            userId: 1,
            userName: 'Test Staff',
            email: 'staff@example.com',
            emailConfirmed: true,
            lockoutEnabled: false,
            accessFailedCount: 0,
            roles: ['Staff'],
          }]
        : [],
    }) as Response))
  })

  it('shows and hides the temporary password while creating a staff account', () => {
    render(<AdminUsersPage currentRole="Admin" />)

    const passwordInput = screen.getByLabelText('Temporary password')
    expect(passwordInput.getAttribute('type')).toBe('password')

    fireEvent.click(screen.getByRole('button', { name: 'Show temporary password' }))
    expect(passwordInput.getAttribute('type')).toBe('text')
    expect(screen.getByRole('button', { name: 'Hide temporary password' })).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'Hide temporary password' }))
    expect(passwordInput.getAttribute('type')).toBe('password')
  })

  it('shows and hides a new password while resetting a staff account', async () => {
    render(<AdminUsersPage currentRole="Admin" />)
    fireEvent.click(await screen.findByRole('button', { name: 'Reset password' }))

    const passwordInput = screen.getByLabelText('New password')
    expect(passwordInput.getAttribute('type')).toBe('password')

    fireEvent.click(screen.getByRole('button', { name: 'Show new password' }))
    expect(passwordInput.getAttribute('type')).toBe('text')

    fireEvent.click(screen.getByRole('button', { name: 'Hide new password' }))
    expect(passwordInput.getAttribute('type')).toBe('password')
  })
})
