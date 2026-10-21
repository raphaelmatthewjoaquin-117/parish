import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { ResetPasswordPage } from './ResetPasswordPage'

describe('ResetPasswordPage', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'Your password has been reset.' }),
    }))
  })

  it('submits the reset token and new password', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/reset-password?token=abc123']}>
        <Routes>
          <Route path="/admin/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewSecurePassword1' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'NewSecurePassword1' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }))

    await waitFor(() => expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/reset-password'),
      expect.objectContaining({
        method: 'POST',
        body: JSON.stringify({ token: 'abc123', newPassword: 'NewSecurePassword1' }),
      }),
    ))
    expect(await screen.findByText('Your password has been reset.')).toBeTruthy()
  })

  it('requires matching password entries before sending', async () => {
    render(
      <MemoryRouter initialEntries={['/admin/reset-password?token=abc123']}>
        <Routes>
          <Route path="/admin/reset-password" element={<ResetPasswordPage />} />
        </Routes>
      </MemoryRouter>,
    )

    fireEvent.change(screen.getByLabelText('New password'), { target: { value: 'NewSecurePassword1' } })
    fireEvent.change(screen.getByLabelText('Confirm new password'), { target: { value: 'different' } })
    fireEvent.click(screen.getByRole('button', { name: 'Set new password' }))

    expect((await screen.findByRole('alert')).textContent).toContain('Passwords do not match.')
    expect(fetch).not.toHaveBeenCalled()
  })
})
