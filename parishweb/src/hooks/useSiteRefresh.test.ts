import { act, renderHook } from '@testing-library/react'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { useSiteRefresh } from './useSiteRefresh'

afterEach(() => {
  vi.useRealTimers()
})

describe('useSiteRefresh', () => {
  it('updates the refresh key every 30 seconds and stops after unmount', () => {
    vi.useFakeTimers()
    const { result, unmount } = renderHook(() => useSiteRefresh())

    expect(result.current).toBe(0)
    act(() => vi.advanceTimersByTime(30_000))
    expect(result.current).toBe(1)

    unmount()
    act(() => vi.advanceTimersByTime(30_000))
    expect(result.current).toBe(1)
  })
})
