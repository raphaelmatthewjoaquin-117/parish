import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { ForgotPasswordForm } from './ForgotPasswordForm'

describe('ForgotPasswordForm', () => {
  afterEach(() => vi.restoreAllMocks())

  it('shows the same confirmation message after requesting a reset', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ message: 'If a staff account matches that email, password reset instructions will be sent when email delivery is enabled.' }),
    }))

    render(<ForgotPasswordForm onBack={() => {}} />)

    fireEvent.change(screen.getByLabelText('Email address'), { target: { value: 'staff@example.com' } })
    fireEvent.click(screen.getByRole('button', { name: 'Request password reset' }))

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toContain('If a staff account matches that email')
    })
    expect(fetch).toHaveBeenCalledWith(
      expect.stringContaining('/api/admin/forgot-password'),
      expect.objectContaining({ method: 'POST' }),
    )
  })
})
