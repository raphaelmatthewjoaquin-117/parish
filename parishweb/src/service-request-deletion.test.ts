import { describe, expect, it, vi } from 'vitest'
import { deleteServiceRequest } from './service-request-deletion.js'

function createTransaction(query: (statement: string) => Promise<void> = async () => {}) {
  const transaction = {
    begin: vi.fn().mockResolvedValue(undefined),
    commit: vi.fn().mockResolvedValue(undefined),
    rollback: vi.fn().mockResolvedValue(undefined),
    request: vi.fn(() => {
      const request = {
        input: vi.fn(() => request),
        query: vi.fn(query),
      }
      return request
    }),
  }
  return transaction
}

describe('deleteServiceRequest', () => {
  it('deletes every dependent row before the service request in one transaction', async () => {
    const transaction = createTransaction()

    await deleteServiceRequest(transaction, 3044)

    const statement = vi.mocked(transaction.request.mock.results[0].value.query).mock.calls[0][0]
    const deletionOrder = [
      'dbo.VerificationTokens',
      'dbo.BaptismRequestDetail',
      'dbo.MarriageRequestDetail',
      'dbo.ConfirmationRequestDetail',
      'dbo.FuneralRequestDetail',
      'dbo.HouseBlessingRequestDetail',
      'dbo.ServiceRequest',
    ].map(table => statement.indexOf(`DELETE FROM ${table}`))

    expect(deletionOrder.every(index => index >= 0)).toBe(true)
    expect(deletionOrder).toEqual([...deletionOrder].sort((a, b) => a - b))
    expect(transaction.request.mock.results[0].value.input).toHaveBeenCalledWith(
      'requestId',
      expect.anything(),
      3044,
    )
    expect(transaction.begin).toHaveBeenCalledOnce()
    expect(transaction.commit).toHaveBeenCalledOnce()
    expect(transaction.rollback).not.toHaveBeenCalled()
  })

  it('rolls back the delete transaction when the database rejects the batch', async () => {
    const databaseError = new Error('Foreign key conflict')
    const transaction = createTransaction(async () => { throw databaseError })

    await expect(deleteServiceRequest(transaction, 3044)).rejects.toBe(databaseError)

    expect(transaction.rollback).toHaveBeenCalledOnce()
    expect(transaction.commit).not.toHaveBeenCalled()
  })
})
