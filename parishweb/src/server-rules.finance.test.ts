import { describe, expect, it } from 'vitest'
import { financeActionForStatus, financeTransition } from '../server-rules.js'

describe('financeActionForStatus', () => {
  it.each([
    ['Draft', 'Submitted'],
    ['Submitted', 'Rejected'],
    ['Submitted', 'Approved'],
    ['Approved', 'Reconciled'],
  ])('allows a %s entry to move to %s', (currentStatus, nextStatus) => {
    expect(financeTransition(currentStatus, financeActionForStatus(nextStatus))).toBe(nextStatus)
  })
})
