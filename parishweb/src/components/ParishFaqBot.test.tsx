import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { MemoryRouter } from 'react-router-dom'
import { ParishFaqBot } from './ParishFaqBot'

function renderBot(language: 'en' | 'tl' = 'en') {
  return render(
    <MemoryRouter>
      <ParishFaqBot language={language} />
    </MemoryRouter>,
  )
}

describe('ParishFaqBot', () => {
  it('opens and answers a suggested parish question', () => {
    renderBot()

    fireEvent.click(screen.getByRole('button', { name: 'Open parish FAQ chat' }))
    fireEvent.click(screen.getByRole('button', { name: 'How do I book a parish service?' }))

    expect(screen.getByText(/Open Services, choose the service you need/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Go to Services' }).getAttribute('href')).toBe('/services')
  })

  it('offers the Contact Us page when it cannot match a question', () => {
    renderBot()

    fireEvent.click(screen.getByRole('button', { name: 'Open parish FAQ chat' }))
    fireEvent.change(screen.getByRole('textbox', { name: 'Ask a question' }), {
      target: { value: 'What is the weather tomorrow?' },
    })
    fireEvent.click(screen.getByRole('button', { name: 'Send question' }))

    expect(screen.getByText(/I couldn’t find that in the parish FAQs/)).toBeTruthy()
    expect(screen.getByRole('link', { name: 'Contact Us' }).getAttribute('href')).toBe('/contact')
  })

  it('shows the chat in Tagalog when selected', () => {
    renderBot('tl')

    fireEvent.click(screen.getByRole('button', { name: 'Buksan ang chat ng parokya' }))

    expect(screen.getByRole('textbox', { name: 'Magtanong' })).toBeTruthy()
  })
})
