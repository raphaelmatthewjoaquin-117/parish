import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { ChangePasswordForm } from './ChangePasswordForm'

describe('ChangePasswordForm', () => {
  it('reveals each password independently without changing its value', () => {
    render(<ChangePasswordForm onChanged={() => {}} />)

    const currentPassword = screen.getByLabelText('Current password') as HTMLInputElement
    const newPassword = screen.getByLabelText('New password') as HTMLInputElement
    const confirmPassword = screen.getByLabelText('Confirm new password') as HTMLInputElement

    fireEvent.change(currentPassword, { target: { value: 'current-secret' } })
    fireEvent.change(newPassword, { target: { value: 'new-secret' } })
    fireEvent.change(confirmPassword, { target: { value: 'new-secret' } })

    fireEvent.click(screen.getByRole('button', { name: 'Show current password' }))

    expect(currentPassword.getAttribute('type')).toBe('text')
    expect(currentPassword.value).toBe('current-secret')
    expect(newPassword.getAttribute('type')).toBe('password')
    expect(confirmPassword.getAttribute('type')).toBe('password')

    fireEvent.click(screen.getByRole('button', { name: 'Show new password' }))

    expect(newPassword.getAttribute('type')).toBe('text')
    expect(confirmPassword.getAttribute('type')).toBe('password')

    fireEvent.click(screen.getByRole('button', { name: 'Show confirm new password' }))

    expect(confirmPassword.getAttribute('type')).toBe('text')
    expect(confirmPassword.value).toBe('new-secret')

    fireEvent.click(screen.getByRole('button', { name: 'Hide current password' }))

    expect(currentPassword.getAttribute('type')).toBe('password')
    expect(currentPassword.value).toBe('current-secret')
  })
})
