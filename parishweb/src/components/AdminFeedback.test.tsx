import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { AdminFeedback } from './AdminFeedback'

describe('AdminFeedback', () => {
  it('renders success feedback in a viewport-level portal', () => {
    const onDismiss = vi.fn()
    const { container } = render(<AdminFeedback message="User created." onDismiss={onDismiss} />)
    const notification = screen.getByRole('status')

    expect(notification.textContent).toContain('User created.')
    expect(container.childElementCount).toBe(0)
    expect(notification.closest('.admin-feedback-layer')?.parentElement).toBe(document.body)

    fireEvent.click(screen.getByRole('button', { name: 'Dismiss notification' }))
    expect(onDismiss).toHaveBeenCalledOnce()
  })

  it('announces error feedback as an alert', () => {
    render(<AdminFeedback error="Unable to create user." onDismiss={() => {}} />)

    expect(screen.getByRole('alert').textContent).toContain('Unable to create user.')
  })
})
