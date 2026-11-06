import { describe, expect, it } from 'vitest'
import { ALLOWED_REQUEST_STATUSES, normalizeBlockedSlotInput, officeHourSlotTimes, shouldDeleteServiceRequestDocuments } from '../server-rules.js'

describe('officeHourSlotTimes', () => {
  it('returns hourly appointment starts from 9 AM through 4 PM Tuesday to Saturday', () => {
    expect(officeHourSlotTimes('2026-11-03')).toEqual([
      '09:00', '10:00', '11:00', '12:00', '13:00', '14:00', '15:00', '16:00',
    ])
    expect(officeHourSlotTimes('2026-11-07')).toHaveLength(8)
  })

  describe('service request review statuses', () => {
    it('allows staff to move email-verified requests into the review queue', () => {
      expect(ALLOWED_REQUEST_STATUSES).toContain('PendingReview')
    })

    it('retains documents until a request reaches a terminal status', () => {
      expect(shouldDeleteServiceRequestDocuments('PendingReview')).toBe(false)
      expect(shouldDeleteServiceRequestDocuments('Confirmed')).toBe(false)
      expect(shouldDeleteServiceRequestDocuments('Completed')).toBe(true)
      expect(shouldDeleteServiceRequestDocuments('Rejected')).toBe(true)
      expect(shouldDeleteServiceRequestDocuments('Cancelled')).toBe(true)
      expect(shouldDeleteServiceRequestDocuments('VoidedNoShow')).toBe(true)
    })
  })

  describe('normalizeBlockedSlotInput', () => {
    it('normalizes a valid service-specific appointment block', () => {
      expect(normalizeBlockedSlotInput({
        date: '2026-11-03',
        time: '10:00',
        scope: 'Service',
        serviceId: '4',
        reason: '  Parish meeting  ',
      })).toEqual({
        date: '2026-11-03',
        time: '10:00',
        scope: 'Service',
        serviceId: 4,
        reason: 'Parish meeting',
      })
    })

    it('rejects invalid dates, closed days, office-hour times, scopes, and service IDs', () => {
      expect(normalizeBlockedSlotInput({ date: '2026-11-02', scope: 'All' })).toBeNull()
      expect(normalizeBlockedSlotInput({ date: '2026-11-03', time: '17:00', scope: 'All' })).toBeNull()
      expect(normalizeBlockedSlotInput({ date: '2026-11-03', scope: 'Service' })).toBeNull()
      expect(normalizeBlockedSlotInput({ date: '2026-11-03', scope: 'All', serviceId: 4 })).toBeNull()
    })
  })

  it('returns morning appointment starts on Sundays', () => {
    expect(officeHourSlotTimes('2026-11-01')).toEqual(['09:00', '10:00', '11:00'])
    expect(normalizeBlockedSlotInput({ date: '2026-11-01', time: '12:00', scope: 'All' })).toBeNull()
  })

  it('returns no appointment times on Mondays or invalid dates', () => {
    expect(officeHourSlotTimes('2026-11-02')).toEqual([])
    expect(officeHourSlotTimes('not-a-date')).toEqual([])
  })
})
