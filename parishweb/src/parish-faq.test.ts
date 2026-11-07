import { describe, expect, it } from 'vitest'
import { findParishFaq } from './parish-faq'

describe('findParishFaq', () => {
  it('finds service booking guidance from a natural question', () => {
    expect(findParishFaq('How do I book a baptism?')?.id).toBe('service-booking')
  })

  it('finds certificate tracking guidance from a reference-code question', () => {
    expect(findParishFaq('How can I check my certificate request status?')?.id).toBe('track-request')
  })

  it('matches Tagalog questions', () => {
    expect(findParishFaq('Paano magpadala ng kahilingan sa panalangin?')?.id).toBe('prayer-request')
  })

  it('does not guess when no FAQ matches', () => {
    expect(findParishFaq('What is the weather tomorrow?')).toBeUndefined()
  })

  it('does not match an empty question', () => {
    expect(findParishFaq('   ')).toBeUndefined()
  })
})
