import { useCallback, useEffect, useState } from 'react'
import { apiClient } from '../api/client'
import { AdminFeedback } from '../components/AdminFeedback'
import '../PagesCSS/SiteContentEditorPage.css'

type ContactMessage = Awaited<ReturnType<typeof apiClient.contactMessages.list>>[number]

export function AdminContactMessagesPage({ canDelete }: { canDelete: boolean }) {
  const [messages, setMessages] = useState<ContactMessage[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<'all' | 'unread'>('all')
  const adminToken = () => window.localStorage.getItem('adminToken') || ''

  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      setMessages(await apiClient.contactMessages.list(adminToken()))
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : 'Unable to load messages.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0)
    return () => window.clearTimeout(timer)
  }, [load])

  const toggleRead = async (message: ContactMessage) => {
    try {
      await apiClient.contactMessages.setRead(message.id, !message.isRead, adminToken())
      setMessages(current => current.map(item => item.id === message.id ? { ...item, isRead: !item.isRead } : item))
    } catch (updateError) {
      setError(updateError instanceof Error ? updateError.message : 'Unable to update message.')
    }
  }

  const remove = async (message: ContactMessage) => {
    if (!window.confirm(`Delete the message from ${message.name}?`)) return
    try {
      await apiClient.contactMessages.remove(message.id, adminToken())
      setMessages(current => current.filter(item => item.id !== message.id))
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : 'Unable to delete message.')
    }
  }

  const unreadCount = messages.filter(message => !message.isRead).length
  const visible = filter === 'unread' ? messages.filter(message => !message.isRead) : messages

  return (
    <section className="site-content-editor site-content-editor--messages">
      <div className="site-content-intro">
        <p>Contact page</p>
        <h2>Messages from visitors</h2>
        <span className="contact-messages-summary">
          <strong>{unreadCount}</strong> unread <span aria-hidden="true">·</span> {messages.length} total
        </span>
      </div>

      <AdminFeedback error={error} onDismiss={() => setError('')} />
      <div className="contact-messages-toolbar">
        <div className="contact-messages-filters" role="group" aria-label="Filter contact messages">
          <button type="button" className={`btn ${filter === 'all' ? 'btn-dark' : 'btn-outline-dark'}`} aria-pressed={filter === 'all'} onClick={() => setFilter('all')}>
            All <span>{messages.length}</span>
          </button>
          <button type="button" className={`btn ${filter === 'unread' ? 'btn-dark' : 'btn-outline-dark'}`} aria-pressed={filter === 'unread'} onClick={() => setFilter('unread')}>
            Unread <span>{unreadCount}</span>
          </button>
        </div>
        <button type="button" className="btn btn-outline-dark contact-messages-refresh" disabled={loading} onClick={() => void load()}>
          {loading ? 'Loading…' : 'Refresh'}
        </button>
      </div>

      {loading && <div className="contact-messages-empty" role="status">Loading messages…</div>}
      {!loading && visible.length === 0 && (
        <div className="contact-messages-empty">
          <strong>{filter === 'unread' ? 'You’re all caught up.' : 'No messages yet.'}</strong>
          <span>{filter === 'unread' ? 'There are no unread messages right now.' : 'Messages sent through the Contact page will appear here.'}</span>
        </div>
      )}

      {visible.map(message => (
        <article className={`contact-message-card ${message.isRead ? '' : 'contact-message-card--unread'}`} key={message.id}>
          <div className="contact-message-heading">
            <div className="contact-message-sender">
              <span className="contact-message-avatar" aria-hidden="true">{message.name.trim().charAt(0).toUpperCase() || '?'}</span>
              <div>
                <h3>{message.name}</h3>
                {!message.isRead && <span className="contact-message-new">New message</span>}
              </div>
            </div>
            <time className="contact-message-date" dateTime={message.createdAt}>{new Date(message.createdAt).toLocaleString()}</time>
          </div>
          <div className="contact-message-contact">
            <a href={`mailto:${message.email}`}>{message.email}</a>
            {message.phone && <a href={`tel:${message.phone}`}>{message.phone}</a>}
          </div>
          <p className="contact-message-body">{message.message}</p>
          <div className="contact-message-actions">
            <button type="button" className="btn btn-outline-dark" onClick={() => void toggleRead(message)}>
              Mark as {message.isRead ? 'unread' : 'read'}
            </button>
            {canDelete && <button type="button" className="btn btn-outline-danger" onClick={() => void remove(message)}>Delete</button>}
          </div>
        </article>
      ))}
    </section>
  )
}
