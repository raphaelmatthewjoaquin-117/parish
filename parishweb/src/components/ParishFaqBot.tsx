import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import type { Language } from '../i18n'
import { findParishFaq, parishFaqs, type ParishFaq } from '../parish-faq'
import './ParishFaqBot.css'

type Message = {
  id: number
  from: 'visitor' | 'bot'
  text: string
  faq?: ParishFaq
}

const copy = {
  en: {
    open: 'Open parish FAQ chat',
    close: 'Close parish FAQ chat',
    title: 'Parish FAQ',
    description: 'Automated answers from a short list of parish FAQs. This chat does not send or store your messages.',
    greeting: 'Hello! I can help with service bookings, certificates, request tracking, prayer requests, and parish contact information.',
    suggestions: 'Suggested questions',
    input: 'Ask a question',
    placeholder: 'Type your question…',
    send: 'Send question',
    visitor: 'You',
    assistant: 'Parish FAQ',
    launcher: 'Ask',
    notFound: 'I couldn’t find that in the parish FAQs. Please check the Contact Us page for help.',
    contact: 'Contact Us',
  },
  tl: {
    open: 'Buksan ang chat ng parokya',
    close: 'Isara ang chat ng parokya',
    title: 'Mga FAQ ng Parokya',
    description: 'Awtomatikong sagot mula sa mga FAQ ng parokya. Hindi ipinapadala o iniimbak ng chat na ito ang iyong mga mensahe.',
    greeting: 'Kumusta! Makakatulong ako tungkol sa pag-book ng serbisyo, mga sertipiko, pagsubaybay ng kahilingan, kahilingan sa panalangin, at pakikipag-ugnayan sa parokya.',
    suggestions: 'Mga mungkahing tanong',
    input: 'Magtanong',
    placeholder: 'I-type ang iyong tanong…',
    send: 'Ipadala ang tanong',
    visitor: 'Ikaw',
    assistant: 'FAQ ng Parokya',
    launcher: 'Tulong',
    notFound: 'Hindi ko makita ang sagot sa mga FAQ ng parokya. Tingnan ang pahina ng Makipag-ugnayan para sa tulong.',
    contact: 'Makipag-ugnayan',
  },
} satisfies Record<Language, Record<string, string>>

export function ParishFaqBot({ language }: { language: Language }) {
  const [isOpen, setIsOpen] = useState(false)
  const [question, setQuestion] = useState('')
  const [messages, setMessages] = useState<Message[]>([])
  const launcherRef = useRef<HTMLButtonElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const conversationRef = useRef<HTMLDivElement>(null)
  const nextMessageId = useRef(1)
  const text = copy[language]

  useEffect(() => {
    const conversation = conversationRef.current
    if (conversation) conversation.scrollTop = conversation.scrollHeight
  }, [messages])

  useEffect(() => {
    if (isOpen) inputRef.current?.focus()
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsOpen(false)
        launcherRef.current?.focus()
      }
    }
    window.addEventListener('keydown', closeOnEscape)
    return () => window.removeEventListener('keydown', closeOnEscape)
  }, [isOpen])

  function submitQuestion(value: string) {
    const trimmed = value.trim()
    if (!trimmed) return

    const faq = findParishFaq(trimmed)
    const nextId = nextMessageId.current
    nextMessageId.current += 2
    setMessages(current => [
      ...current,
      { id: nextId, from: 'visitor', text: trimmed },
      {
        id: nextId + 1,
        from: 'bot',
        text: faq?.answer[language] ?? text.notFound,
        faq,
      },
    ])
    setQuestion('')
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    submitQuestion(question)
  }

  return (
    <div className="parish-faq-bot" data-no-translate>
      {isOpen && (
        <section className="parish-faq-panel" aria-label={text.title}>
          <header className="parish-faq-header">
            <div>
              <h2>{text.title}</h2>
              <p>{text.description}</p>
            </div>
            <button
              className="parish-faq-close"
              type="button"
              onClick={() => {
                setIsOpen(false)
                launcherRef.current?.focus()
              }}
              aria-label={text.close}
            >
              ×
            </button>
          </header>

          <div
            className="parish-faq-conversation"
            ref={conversationRef}
            role="log"
            aria-label={text.title}
            aria-live="polite"
          >
            <article className="parish-faq-message from-bot">
              <span className="parish-faq-speaker">{text.assistant}</span>
              <p>{text.greeting}</p>
            </article>
            {messages.map(message => (
              <article
                className={`parish-faq-message ${message.from === 'visitor' ? 'from-visitor' : 'from-bot'}`}
                key={message.id}
              >
                <span className="parish-faq-speaker">
                  {message.from === 'visitor' ? text.visitor : text.assistant}
                </span>
                <p>{message.text}</p>
                {message.faq && (
                  <Link to={message.faq.href}>{message.faq.link[language]}</Link>
                )}
                {message.from === 'bot' && !message.faq && (
                  <Link to="/contact">{text.contact}</Link>
                )}
              </article>
            ))}
          </div>

          {messages.length === 0 && (
            <div className="parish-faq-suggestions">
              <p>{text.suggestions}</p>
              {parishFaqs.map(faq => (
                <button
                  type="button"
                  key={faq.id}
                  onClick={() => submitQuestion(faq.question[language])}
                >
                  {faq.question[language]}
                </button>
              ))}
            </div>
          )}

          <form className="parish-faq-form" onSubmit={handleSubmit}>
            <label className="parish-faq-visually-hidden" htmlFor="parish-faq-question">
              {text.input}
            </label>
            <input
              id="parish-faq-question"
              ref={inputRef}
              value={question}
              onChange={event => setQuestion(event.target.value)}
              placeholder={text.placeholder}
              maxLength={300}
            />
            <button type="submit" disabled={!question.trim()} aria-label={text.send}>
              {text.send}
            </button>
          </form>
        </section>
      )}

      <button
        className="parish-faq-launcher"
        ref={launcherRef}
        type="button"
        aria-expanded={isOpen}
        aria-label={isOpen ? text.close : text.open}
        onClick={() => setIsOpen(open => !open)}
      >
        {isOpen ? '×' : text.launcher}
      </button>
    </div>
  )
}
