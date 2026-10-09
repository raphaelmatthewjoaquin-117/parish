import { describe, expect, it } from 'vitest'
import { observeTranslations, translateText } from './i18n'

describe('translateText', () => {
  it('translates known interface copy and preserves surrounding whitespace', () => {
    expect(translateText('  Home\n', 'tl')).toBe('  Tahanan\n')
  })

  it('leaves unknown and user-provided content unchanged', () => {
    expect(translateText('A parishioner-created event title', 'tl')).toBe('A parishioner-created event title')
  })

  it('returns the original text in English', () => {
    expect(translateText('Tahanan', 'en')).toBe('Tahanan')
  })

  it('localizes English-formatted calendar dates', () => {
    expect(translateText('Sunday, October 8, 2026', 'tl')).toBe('Linggo, Oktubre 8, 2026')
    expect(translateText('October 2026', 'tl')).toBe('Oktubre 2026')
  })

  it('translates text fragments surrounding inline technical terms', () => {
    expect(translateText('Use your parish email or username and password. If the ASP.NET Identity tables are connected, the app will validate the role from ', 'tl'))
      .toBe('Gamitin ang iyong parish email o username at password. Kung nakakonekta ang mga talahanayan ng ASP.NET Identity, susuriin ng app ang tungkulin mula sa ')
    expect(translateText(' and ', 'tl')).toBe(' at ')
  })

  it('translates interface text and placeholders, then restores English', () => {
    const root = document.createElement('div')
    root.innerHTML = '<a>Home</a><input placeholder="First name">'

    const stopTagalog = observeTranslations(root, 'tl')
    expect(root.textContent).toBe('Tahanan')
    expect(root.querySelector('input')?.placeholder).toBe('Pangalan')

    stopTagalog()
    const stopEnglish = observeTranslations(root, 'en')
    expect(root.textContent).toBe('Home')
    expect(root.querySelector('input')?.placeholder).toBe('First name')
    stopEnglish()
  })
})
