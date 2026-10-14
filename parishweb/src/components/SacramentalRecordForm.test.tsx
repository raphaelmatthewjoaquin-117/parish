import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SacramentalRecordForm } from './SacramentalRecordForm'
import { apiClient } from '../api/client'

vi.mock('../api/client', () => ({
  apiClient: {
    sacramental: {
      create: vi.fn(),
      update: vi.fn(),
    },
  },
}))

describe('SacramentalRecordForm', () => {
  beforeEach(() => {
    vi.mocked(apiClient.sacramental.create).mockResolvedValue({})
    vi.mocked(apiClient.sacramental.update).mockResolvedValue({})
  })

  it('uses the selected sacrament when creating a record', async () => {
    render(
      <SacramentalRecordForm
        type="baptism"
        adminToken="token"
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    fireEvent.change(screen.getByLabelText('Sacrament type'), { target: { value: 'marriage' } })
    fireEvent.change(screen.getByLabelText('Groom first name'), { target: { value: 'Maria' } })
    expect(screen.getByLabelText('Groom first name')).toBeTruthy()
    expect(screen.queryByLabelText('Child first name')).toBeNull()

    fireEvent.change(screen.getByLabelText('Sacrament type'), { target: { value: 'baptism' } })
    fireEvent.change(screen.getByLabelText('Sacrament type'), { target: { value: 'marriage' } })
    expect((screen.getByLabelText('Groom first name') as HTMLInputElement).value).toBe('Maria')

    fireEvent.submit(screen.getByRole('form'))
    await waitFor(() => expect(apiClient.sacramental.create).toHaveBeenCalledWith('marriage', expect.any(Object), 'token'))
  })

  it('does not allow changing the sacrament when editing an existing record', () => {
    render(
      <SacramentalRecordForm
        type="baptism"
        record={{ Id: 1, RegistryNumber: 'B-1' }}
        adminToken="token"
        onSaved={vi.fn()}
        onCancel={vi.fn()}
      />,
    )

    expect(screen.queryByLabelText('Sacrament type')).toBeNull()
    expect(screen.getByRole('heading', { name: 'Edit Baptism record' })).toBeTruthy()
  })
})
