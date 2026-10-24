import React, { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import FullCalendar from '@fullcalendar/react'
import dayGridPlugin from '@fullcalendar/daygrid'
import timeGridPlugin from '@fullcalendar/timegrid'
import interactionPlugin from '@fullcalendar/interaction'
import { SacramentalRecordForm } from '../components/SacramentalRecordForm'
import { AdminFeedback } from '../components/AdminFeedback'
import { EventDetailsModal } from '../components/EventDetailsModal'
import { API_BASE_URL as API_URL, getMediaUrl } from '../api/client'
import { ForgotPasswordForm } from '../components/ForgotPasswordForm'
import type { ModuleOverrides } from '../utils/rbac'
import '../PagesCSS/AdminEventsPage.css'

type EventItem = {
  id: string
  title: string
  titleTl?: string
  description: string
  descriptionTl?: string
  detail: string
  detailTl?: string
  date: string
  time?: string
  location?: string
  locationTl?: string
  photoUrl?: string
}

type EventForm = {
  title: string
  titleTl: string
  description: string
  descriptionTl: string
  detail: string
  detailTl: string
  date: string
  time: string
  location: string
  locationTl: string
  photoUrl: string
}

type PrayerItem = {
  id: number
  name: string
  category: string
  request: string
  anonymous: boolean
  shareWithCommunity: boolean
  isApproved: boolean
  createdAt: string
}

type ServiceRequestItem = {
  id: number
  parishionerId: number
  serviceId: number
  firstName: string
  lastName: string
  email: string
  mobileNumber: string
  address: string
  serviceName: string
  scheduledDate: string
  scheduledTime: string
  status: string
  notes: string
  createdAt: string
  details?: Record<string, unknown>
}

type SacramentalRecordItem = {
  RecordType: string
  Id: number
  RegistryNumber: string
  Name: string
  RecordDate: string
  Priest: string
  ScannedDocumentUrl?: string
}

type SacramentalArchiveItem = {
  ArchiveId: number
  SacramentType: string
  BookNumber: number
  PageNumber: number
  FileUrl: string
  Notes?: string
  UploadedAt: string
  UploadedBy: string
}

type SacramentalSearchParams = {
  type: string
  q: string
  startDate: string
  endDate: string
  priest: string
  page: number
  limit: number
}

function detailLabel(key: string): string {
  return key.replace(/([A-Z])/g, ' $1').replace(/^./, character => character.toUpperCase())
}

function detailValue(value: unknown): string {
  if (value === null || value === undefined || value === '') return 'Not provided'
  if (typeof value === 'object') return JSON.stringify(value)
  return String(value)
}

type MassScheduleItem = {
  id: number
  title: string
  date: string
  time: string
  location: string
  priestUsername: string
  notes: string
  status: string
}

export type AdminEventsTab = 'dashboard' | 'events' | 'prayers' | 'service-requests' | 'mass-schedule' | 'sacramental-ledger'

type AdminEventsPageProps = {
  initialTab?: AdminEventsTab
  embedded?: boolean
  onAuthenticated?: (authenticated: boolean) => void
  overrides?: ModuleOverrides
}

const initialForm: EventForm = {
  title: '',
  titleTl: '',
  description: '',
  descriptionTl: '',
  detail: '',
  detailTl: '',
  date: '',
  time: '',
  location: '',
  locationTl: '',
  photoUrl: '',
}

const formatServiceRequestStatus = (status: string) => ({
  PendingVerification: 'Pending verification',
  VoidedNoShow: 'No-show',
  ConflictVoided: 'Schedule conflict',
}[status] || status.replace(/([a-z])([A-Z])/g, '$1 $2'))

const getPhotoUrl = getMediaUrl

export function AdminEventsPage({ initialTab = 'dashboard', embedded = false, onAuthenticated, overrides }: AdminEventsPageProps) {
  // Tab state
  const [activeTab, setActiveTab] = useState<AdminEventsTab>(initialTab)

  // Event states
  const [events, setEvents] = useState<EventItem[]>([])
  const [selectedEvent, setSelectedEvent] = useState<EventItem | null>(null)
  const [form, setForm] = useState<EventForm>(initialForm)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [editingId, setEditingId] = useState<string | null>(null)

  // Prayer states
  const [prayers, setPrayers] = useState<PrayerItem[]>([])
  const [selectedPrayer, setSelectedPrayer] = useState<PrayerItem | null>(null)
  const [prayersLoading, setPrayersLoading] = useState(false)

  // Service Request states
  const [serviceRequests, setServiceRequests] = useState<ServiceRequestItem[]>([])
  const [selectedServiceRequest, setSelectedServiceRequest] = useState<ServiceRequestItem | null>(null)
  const [serviceRequestsLoading, setServiceRequestsLoading] = useState(false)
  const [serviceRequestStatusFilter, setServiceRequestStatusFilter] = useState('All')
  const [adminNotes, setAdminNotes] = useState('')
  const [masses, setMasses] = useState<MassScheduleItem[]>([])
  const [massesLoading, setMassesLoading] = useState(false)

  // Sacramental Records states
  const [sacramentalRecords, setSacramentalRecords] = useState<SacramentalRecordItem[]>([])
  const [selectedSacramentalRecord, setSelectedSacramentalRecord] = useState<SacramentalRecordItem | null>(null)
  const [sacramentalLoading, setSacramentalLoading] = useState(false)
  const [sacramentalPagination, setSacramentalPagination] = useState({ page: 1, limit: 50, total: 0 })
  const [sacramentalSearch, setSacramentalSearch] = useState<SacramentalSearchParams>({
    type: '', q: '', startDate: '', endDate: '', priest: '', page: 1, limit: 50
  })
  const [showAdvancedSacramentalFilters, setShowAdvancedSacramentalFilters] = useState(false)
  const [sacramentalArchives, setSacramentalArchives] = useState<SacramentalArchiveItem[]>([])
  const [archivesLoading, setArchivesLoading] = useState(false)
  const [showArchiveModal, setShowArchiveModal] = useState(false)
  const [archiveBookNumber, setArchiveBookNumber] = useState('')
  const [archivePageNumber, setArchivePageNumber] = useState('')
  const [archiveNotes, setArchiveNotes] = useState('')
  const [archiveFile, setArchiveFile] = useState<File | null>(null)
  const [archiveFilterBook, setArchiveFilterBook] = useState('')
  const [archiveFilterPage, setArchiveFilterPage] = useState('')
  const [archiveFilterRegistry, setArchiveFilterRegistry] = useState('')
  const [editingArchiveId, setEditingArchiveId] = useState<number | null>(null)
  const [recordAudit, setRecordAudit] = useState<Array<{ AuditId: number; ActionName: string; ChangedBy: string; ChangedAt: string; Changes?: string }>>([])
  const [showRecordForm, setShowRecordForm] = useState(false)
  const [recordFormType, setRecordFormType] = useState<'baptism' | 'confirmation' | 'marriage' | 'death'>('baptism')
  const [recordFormRecord, setRecordFormRecord] = useState<Record<string, unknown> | null>(null)

  // Common states
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [errorState, setErrorState] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const setError = (nextError: string | null) => {
    setErrorState(nextError)
    setMessage(null)
  }
  const [adminToken, setAdminToken] = useState<string>(() => {
    if (typeof window === 'undefined') return ''
    return window.localStorage.getItem('adminToken') ?? ''
  })
  const [authenticated, setAuthenticated] = useState(false)
  const [authLoading, setAuthLoading] = useState(true)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showForgotPassword, setShowForgotPassword] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)
  const [staffRole, setStaffRole] = useState('')
  const canManagePrayerRequests = overrides?.PrayerRequest && staffRole !== 'Admin' ? overrides.PrayerRequest.edit : ['Admin', 'ParishPriest', 'Secretary'].includes(staffRole)
  const canManageSacramentalRecords = overrides?.SacramentalRecords && staffRole !== 'Admin' ? overrides.SacramentalRecords.edit : ['Admin', 'ParishPriest', 'Secretary'].includes(staffRole)

  const adminHeaders = {
    'Content-Type': 'application/json',
    ...(adminToken ? { 'x-admin-token': adminToken } : {}),
  }

  const verifyAdmin = () => {
    if (!adminToken) {
      setAuthLoading(false)
      setAuthenticated(false)
      return
    }

    setAuthError(null)
    setAuthLoading(true)

    fetch(`${API_URL}/api/admin/verify`, {
      headers: { 'x-admin-token': adminToken },
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Invalid admin token')
        }
        return response.json()
      })
      .then(body => {
        setStaffRole(body?.user?.role || '')
        setAuthenticated(true)
        onAuthenticated?.(true)
      })
      .catch(() => {
        setAuthenticated(false)
        onAuthenticated?.(false)
        setAuthError('Invalid stored admin token. Please log in again.')
      })
      .finally(() => setAuthLoading(false))
  }

  useEffect(() => {
    const timer = window.setTimeout(() => verifyAdmin(), 0)
    return () => window.clearTimeout(timer)
  // The verifier reads the current token from component state at mount time.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Event functions
  const loadEvents = () => {
    setLoading(true)
    setErrorState(null)

    fetch(`${API_URL}/api/events`)
      .then(response => {
        if (!response.ok) {
          throw new Error('Unable to load events')
        }
        return response.json()
      })
      .then((data: unknown) => {
        if (!Array.isArray(data)) {
          throw new Error('Invalid events response')
        }
        setEvents(data as EventItem[])
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to load events')
      })
      .finally(() => setLoading(false))
  }

  // Prayer functions
  const loadPrayers = () => {
    setPrayersLoading(true)
    setError(null)

    fetch(`${API_URL}/api/admin/prayers`, {
      headers: { 'x-admin-token': adminToken },
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Unable to load prayers')
        }
        return response.json()
      })
      .then((data: unknown) => {
        if (!Array.isArray(data)) {
          throw new Error('Invalid prayers response')
        }
        setPrayers(data as PrayerItem[])
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to load prayers')
      })
      .finally(() => setPrayersLoading(false))
  }

  const approvePrayer = (prayerId: number) => {
    setSaving(true)
    setError(null)

    fetch(`${API_URL}/api/prayers/${prayerId}/approve`, {
      method: 'POST',
      headers: adminHeaders,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Unable to approve prayer')
        }
        loadPrayers()
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to approve prayer')
      })
      .finally(() => setSaving(false))
  }

  const rejectPrayer = (prayerId: number) => {
    if (!window.confirm('Delete this prayer?')) return
    setSaving(true)
    setError(null)

    fetch(`${API_URL}/api/prayers/${prayerId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Unable to delete prayer')
        }
        loadPrayers()
        setSelectedPrayer(null)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to delete prayer')
      })
      .finally(() => setSaving(false))
  }

  // Service Request functions
  const loadServiceRequests = () => {
    setServiceRequestsLoading(true)
    setError(null)

    fetch(`${API_URL}/api/admin/service-requests`, {
      headers: { 'x-admin-token': adminToken },
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Unable to load service requests')
        }
        return response.json()
      })
      .then((data: unknown) => {
        if (!Array.isArray(data)) {
          throw new Error('Invalid service requests response')
        }
        setServiceRequests(data as ServiceRequestItem[])
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to load service requests')
      })
      .finally(() => setServiceRequestsLoading(false))
  }

  const loadMasses = () => {
    setMassesLoading(true)
    setError(null)

    fetch(`${API_URL}/api/admin/operations/schedule`, {
      headers: { 'x-admin-token': adminToken },
    })
      .then(response => {
        if (!response.ok) throw new Error('Unable to load Mass schedule')
        return response.json()
      })
      .then((data: unknown) => {
        if (!Array.isArray(data)) throw new Error('Invalid Mass schedule response')
        setMasses((data as Array<Record<string, unknown>>).map(row => ({
          id: Number(row.id ?? row.MassScheduleId ?? 0),
          title: String(row.title ?? row.Title ?? ''),
          date: String(row.date ?? row.MassDate ?? ''),
          time: String(row.time ?? row.MassTime ?? ''),
          location: String(row.location ?? row.Location ?? ''),
          priestUsername: String(row.priestUsername ?? row.PriestUsername ?? ''),
          notes: String(row.notes ?? row.Notes ?? ''),
          status: String(row.status ?? row.Status ?? 'Scheduled'),
        })))
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to load Mass schedule')
      })
      .finally(() => setMassesLoading(false))
  }

  const massCalendarEvents = masses
    .filter(mass => mass.date)
    .map(mass => {
      const dateOnly = mass.date.includes('T') ? new Date(mass.date).toISOString().slice(0, 10) : mass.date
      return {
        id: String(mass.id),
        title: mass.title || 'Mass',
        start: mass.time ? `${dateOnly}T${mass.time}` : dateOnly,
        allDay: !mass.time,
        backgroundColor: '#c9941f',
        borderColor: '#c9941f',
        textColor: '#ffffff',
        extendedProps: {
          location: mass.location,
          priestUsername: mass.priestUsername,
          notes: mass.notes,
        },
      }
    })

  const loadSacramentalRecords = (search = sacramentalSearch) => {
    setSacramentalLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (search.type) params.set('type', search.type)
    if (search.q) params.set('q', search.q)
    if (search.startDate) params.set('startDate', search.startDate)
    if (search.endDate) params.set('endDate', search.endDate)
    if (search.priest) params.set('priest', search.priest)
    params.set('page', String(search.page))
    params.set('limit', String(search.limit))

    fetch(`${API_URL}/api/admin/sacramental/search?${params.toString()}`, {
      headers: { 'x-admin-token': adminToken },
    })
      .then(response => {
        if (!response.ok) throw new Error('Unable to load sacramental records')
        return response.json()
      })
      .then((data: unknown) => {
        if (!data || typeof data !== 'object') throw new Error('Invalid sacramental records response')
        const result = data as { records?: SacramentalRecordItem[], pagination?: { total?: number } }
        setSacramentalRecords(result.records || [])
        setSacramentalPagination(prev => ({ ...prev, total: result.pagination?.total || 0 }))
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to load sacramental records')
      })
      .finally(() => setSacramentalLoading(false))
  }

  useEffect(() => {
    if (authenticated && activeTab === 'sacramental-ledger') {
      const timer = window.setTimeout(() => void loadSacramentalRecords(), 0)
      return () => window.clearTimeout(timer)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, activeTab, sacramentalSearch.page])

  const clearSacramentalSearch = () => {
    const clearedSearch = { ...sacramentalSearch, type: '', q: '', startDate: '', endDate: '', priest: '', page: 1 }
    setSacramentalSearch(clearedSearch)
    setShowAdvancedSacramentalFilters(false)
    loadSacramentalRecords(clearedSearch)
  }

  const loadSacramentalArchives = () => {
    setArchivesLoading(true)
    setError(null)

    const params = new URLSearchParams()
    if (selectedSacramentalRecord) params.set('sacramentType', selectedSacramentalRecord.RecordType.toLowerCase())
    if (archiveFilterBook) params.set('bookNumber', archiveFilterBook)
    if (archiveFilterPage) params.set('pageNumber', archiveFilterPage)
    if (archiveFilterRegistry) params.set('registryNumber', archiveFilterRegistry)
    const suffix = params.toString() ? `?${params.toString()}` : ''

    fetch(`${API_URL}/api/admin/sacramental/archives${suffix}`, {
      headers: { 'x-admin-token': adminToken },
    })
      .then(response => {
        if (!response.ok) throw new Error('Unable to load sacramental archives')
        return response.json()
      })
      .then((data: unknown) => {
        if (!data || typeof data !== 'object') throw new Error('Invalid archives response')
        const result = data as { archives?: SacramentalArchiveItem[] }
        setSacramentalArchives(result.archives || [])
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to load sacramental archives')
      })
      .finally(() => setArchivesLoading(false))
  }

  const openSacramentalRecord = async (record: SacramentalRecordItem) => {
    setSelectedSacramentalRecord(record)
    setShowArchiveModal(true)
    setError(null)
    try {
      const [detail, audit] = await Promise.all([
        fetch(`${API_URL}/api/admin/sacramental/${record.RecordType.toLowerCase()}/${record.Id}`, { headers: { 'x-admin-token': adminToken } }).then(response => response.ok ? response.json() : Promise.reject(new Error('Unable to load record detail'))),
        fetch(`${API_URL}/api/admin/sacramental/${record.RecordType.toLowerCase()}/${record.Id}/audit`, { headers: { 'x-admin-token': adminToken } }).then(response => response.ok ? response.json() : Promise.reject(new Error('Unable to load record history'))),
      ])
      setSelectedSacramentalRecord({ ...record, ...detail })
      setRecordAudit(Array.isArray(audit) ? audit : [])
      loadSacramentalArchives()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to load sacramental record')
    }
  }

  const uploadSacramentalArchive = async () => {
    if (editingArchiveId) {
      if (!archiveBookNumber || !archivePageNumber) {
        setError('Provide the book and page number.')
        return
      }
      setSaving(true)
      setError(null)
      try {
        await fetch(`${API_URL}/api/admin/sacramental/archives/${editingArchiveId}`, { method: 'PUT', headers: adminHeaders, body: JSON.stringify({ bookNumber: Number(archiveBookNumber), pageNumber: Number(archivePageNumber), notes: archiveNotes || null }) }).then(response => response.ok ? response.json() : response.json().then(body => Promise.reject(new Error(body.message || 'Unable to update archive entry'))))
        setEditingArchiveId(null)
        setArchiveBookNumber('')
        setArchivePageNumber('')
        setArchiveNotes('')
        setMessage('Archive entry updated.')
        loadSacramentalArchives()
      } catch (reason) {
        setError(reason instanceof Error ? reason.message : 'Unable to update archive')
      } finally {
        setSaving(false)
      }
      return
    }
    if (!selectedSacramentalRecord || !archiveFile || !archiveBookNumber || !archivePageNumber) {
      setError('Choose a scan and provide the book and page number.')
      return
    }
    if (archiveFile.size > 20 * 1024 * 1024) {
      setError('Archive files must be 20 MB or smaller.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      const uploaded = await fetch(`${API_URL}/api/admin/sacramental/upload-archive`, { method: 'POST', headers: { 'x-admin-token': adminToken }, body: (() => { const body = new FormData(); body.append('document', archiveFile); return body })() }).then(response => response.ok ? response.json() : response.json().then(body => Promise.reject(new Error(body.message || 'Unable to upload archive')))) as { fileUrl: string }
      await fetch(`${API_URL}/api/admin/sacramental/archives`, { method: 'POST', headers: adminHeaders, body: JSON.stringify({ sacramentType: selectedSacramentalRecord.RecordType.toLowerCase(), bookNumber: Number(archiveBookNumber), pageNumber: Number(archivePageNumber), fileUrl: uploaded.fileUrl, notes: archiveNotes || null }) }).then(response => response.ok ? response.json() : response.json().then(body => Promise.reject(new Error(body.message || 'Unable to save archive entry'))))
      setArchiveBookNumber('')
      setArchivePageNumber('')
      setArchiveNotes('')
      setArchiveFile(null)
      setMessage('Archive uploaded and linked to the ledger.')
      loadSacramentalArchives()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to upload archive')
    } finally {
      setSaving(false)
    }
  }

  const deleteSacramentalArchive = async (archiveId: number) => {
    if (!window.confirm('Delete this archive entry and its scanned file?')) return
    setSaving(true)
    setError(null)
    try {
      await fetch(`${API_URL}/api/admin/sacramental/archives/${archiveId}`, { method: 'DELETE', headers: { 'x-admin-token': adminToken } }).then(response => response.ok ? response.json() : response.json().then(body => Promise.reject(new Error(body.message || 'Unable to delete archive entry'))))
      setMessage('Archive entry removed.')
      loadSacramentalArchives()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete archive')
    } finally {
      setSaving(false)
    }
  }

  const deleteSacramentalRecord = async () => {
    if (!selectedSacramentalRecord) return
    if (!window.confirm('Remove this sacramental record? The removal stays in the audit log.')) return
    setSaving(true)
    setError(null)
    try {
      await fetch(`${API_URL}/api/admin/sacramental/${selectedSacramentalRecord.RecordType.toLowerCase()}/${selectedSacramentalRecord.Id}`, { method: 'DELETE', headers: { 'x-admin-token': adminToken } }).then(response => response.ok ? response.json() : response.json().then(body => Promise.reject(new Error(body.message || 'Unable to delete record'))))
      setSelectedSacramentalRecord(null)
      setShowArchiveModal(false)
      setMessage('Record removed and archived in the audit log.')
      loadSacramentalRecords()
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : 'Unable to delete record')
    } finally {
      setSaving(false)
    }
  }

  const confirmServiceRequest = (requestId: number) => {
    setSaving(true)
    setError(null)

    fetch(`${API_URL}/api/admin/service-requests/${requestId}`, {
      method: 'PUT',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'Confirmed', adminNotes: adminNotes || null }),
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Unable to confirm request')
        }
        loadServiceRequests()
        setSelectedServiceRequest(null)
        setAdminNotes('')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to confirm request')
      })
      .finally(() => setSaving(false))
  }

  const deleteServiceRequest = (requestId: number) => {
    if (!window.confirm('Delete this service request? This cannot be undone.')) return

    setSaving(true)
    setError(null)

    fetch(`${API_URL}/api/admin/service-requests/${requestId}`, {
      method: 'DELETE',
      headers: adminHeaders,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Unable to delete service request')
        }
        loadServiceRequests()
        setSelectedServiceRequest(null)
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to delete service request')
      })
      .finally(() => setSaving(false))
  }

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!authenticated) return

      if (activeTab === 'dashboard') {
        if (['Admin', 'Secretary'].includes(staffRole)) loadEvents()
        if (['Admin', 'Secretary', 'ParishPriest', 'Staff'].includes(staffRole)) {
          loadPrayers()
          loadServiceRequests()
        }
        return
      }

      if (activeTab === 'events') {
        loadEvents()
      } else if (activeTab === 'prayers') {
        loadPrayers()
      } else if (activeTab === 'service-requests') {
        loadServiceRequests()
      } else if (activeTab === 'mass-schedule') {
        loadMasses()
      } else if (activeTab === 'sacramental-ledger') {
        loadSacramentalArchives()
      }
    }, 0)
    return () => window.clearTimeout(timer)
  // These loaders are selected by the active tab and role at runtime.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authenticated, activeTab, staffRole])

  const saveAdminToken = (token: string) => {
    setAdminToken(token)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem('adminToken', token)
    }
  }

  const handleLogin = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setAuthLoading(true)
    setAuthError(null)

    fetch(`${API_URL}/api/admin/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    })
      .then(async response => {
        const body = await response.json().catch(() => null)
        if (!response.ok) {
          throw new Error(body?.message || 'Invalid email or password.')
        }

        const token = body?.token || adminToken
        if (!token) {
          throw new Error('No admin token was returned by the server.')
        }

        saveAdminToken(token)
        setStaffRole(body?.user?.role || '')
        setAuthenticated(true)
        onAuthenticated?.(true)
      })
      .catch((err: unknown) => {
        setAuthError(err instanceof Error ? err.message : 'Invalid admin credentials. Please try again.')
        setAuthenticated(false)
        onAuthenticated?.(false)
      })
      .finally(() => setAuthLoading(false))
  }

  const resetForm = () => {
    setEditingId(null)
    setForm(initialForm)
    setPhotoFile(null)
    setError(null)
  }

  const startEdit = (event: EventItem) => {
    setEditingId(event.id)
    setForm({
      title: event.title,
      titleTl: event.titleTl ?? '',
      description: event.description,
      descriptionTl: event.descriptionTl ?? '',
      detail: event.detail,
      detailTl: event.detailTl ?? '',
      date: event.date,
      time: event.time ?? '',
      location: event.location ?? '',
      locationTl: event.locationTl ?? '',
      photoUrl: event.photoUrl ?? '',
    })
    setError(null)
  }

  const deleteEvent = (id: string) => {
    if (!window.confirm('Delete this event?')) return
    setSaving(true)
    setError(null)
    fetch(`${API_URL}/api/events/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: adminHeaders,
    })
      .then(response => {
        if (!response.ok) {
          throw new Error('Unable to delete event')
        }
        loadEvents()
        setMessage('Event deleted successfully.')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to delete event')
      })
      .finally(() => setSaving(false))
  }

  const submitForm = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const title = form.title.trim()
    if (!title || !form.date) {
      setError(`Please fill in the required field${!title && !form.date ? 's: Title and Date' : !title ? ': Title' : ': Date'}.`)
      return
    }
    if (title.length < 3) {
      setError('Event title must be at least 3 characters.')
      return
    }
    setSaving(true)
    setError(null)

    const url = editingId ? `${API_URL}/api/events/${encodeURIComponent(editingId)}` : `${API_URL}/api/events`
    const method = editingId ? 'PUT' : 'POST'

    const uploadPhoto = photoFile
      ? fetch(`${API_URL}/api/admin/uploads`, {
          method: 'POST',
          headers: { 'x-admin-token': adminToken },
          body: (() => {
            const data = new FormData()
            data.append('photo', photoFile)
            return data
          })(),
        }).then(response => {
          return response.text().then(text => {
            let body: { message?: string; photoUrl?: string }
            try {
              body = JSON.parse(text) as { message?: string; photoUrl?: string }
            } catch {
              throw new Error('The upload server returned an unexpected response. Restart the backend and try again.')
            }

            if (!response.ok) {
              throw new Error(body.message || 'Unable to upload photo')
            }
            if (!body.photoUrl) {
              throw new Error('The upload server did not return a photo path.')
            }
            return { photoUrl: body.photoUrl }
          })
        })
      : Promise.resolve({ photoUrl: form.photoUrl })

    uploadPhoto
      .then(({ photoUrl }) => fetch(url, {
        method,
        headers: adminHeaders,
        body: JSON.stringify({ ...form, photoUrl }),
      }))
      .then(response => {
        if (!response.ok) {
          return response.json().then(body => { throw new Error(body?.message || 'Unable to save event') })
        }
        return response.json()
      })
      .then(() => {
        resetForm()
        loadEvents()
        setMessage(editingId ? 'Event updated successfully.' : 'Event added successfully.')
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Unable to save event')
      })
      .finally(() => setSaving(false))
  }

  const dashboardPending = serviceRequests.filter(request => request.status !== 'Confirmed' && request.status !== 'Rejected').length
  const dashboardApproved = serviceRequests.filter(request => request.status === 'Confirmed').length
  const dashboardRejected = serviceRequests.filter(request => request.status === 'Rejected').length
  const serviceRequestStatuses = [...new Set(serviceRequests.map(request => request.status))]
    .sort((a, b) => formatServiceRequestStatus(a).localeCompare(formatServiceRequestStatus(b)))
  const visibleServiceRequests = serviceRequestStatusFilter === 'All'
    ? serviceRequests
    : serviceRequests.filter(request => request.status === serviceRequestStatusFilter)

  const serviceTypeBreakdown = Object.entries(
    serviceRequests.reduce<Record<string, number>>((totals, request) => {
      const label = request.serviceName || 'Unspecified'
      totals[label] = (totals[label] || 0) + 1
      return totals
    }, {}),
  )
    .sort(([, totalA], [, totalB]) => totalB - totalA)
    .slice(0, 5)

  const hasSacramentalSearch = Boolean(
    sacramentalSearch.type || sacramentalSearch.q.trim() || sacramentalSearch.startDate ||
    sacramentalSearch.endDate || sacramentalSearch.priest.trim(),
  )
  const advancedSacramentalFilterCount = [
    sacramentalSearch.startDate,
    sacramentalSearch.endDate,
    sacramentalSearch.priest.trim(),
  ].filter(Boolean).length

  const recentActivity = [
    ...serviceRequests.map(request => ({
      title: `${request.firstName} ${request.lastName} requested ${request.serviceName}`,
      meta: `${request.status} • ${new Date(request.createdAt).toLocaleDateString()}`,
      type: 'booking',
    })),
    ...prayers.map(prayer => ({
      title: prayer.anonymous ? 'Anonymous prayer request' : `${prayer.name} submitted a prayer request`,
      meta: `${prayer.isApproved ? 'Approved' : 'Pending review'} • ${new Date(prayer.createdAt).toLocaleDateString()}`,
      type: 'prayer',
    })),
    ...events.map(event => ({
      title: `${event.title} is scheduled`,
      meta: `${new Date(event.date).toLocaleDateString()} • ${event.location || 'Parish'}`,
      type: 'event',
    })),
  ]
    .sort((a, b) => new Date(b.meta.includes('•') ? b.meta.split('•')[1].trim() : '').getTime() - new Date(a.meta.includes('•') ? a.meta.split('•')[1].trim() : '').getTime())
    .slice(0, 6)

  if (authLoading) {
    return (
      <section className="content-section simple-page">
        <p>Checking admin access…</p>
      </section>
    )
  }

  if (!authenticated) {
    return (
      <section className="content-section simple-page admin-login-page">
        <div className="section-heading">
          <p className="eyebrow">Admin login required</p>
          <h2>{showForgotPassword ? 'Reset your password' : 'Staff administration'}</h2>
        </div>
        {showForgotPassword
          ? <ForgotPasswordForm onBack={() => setShowForgotPassword(false)} />
          : <form onSubmit={handleLogin} className="admin-login-form">
          <label>
            Email or username
            <input
              type="text"
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="admin@parish.local"
              required
            />
          </label>
          <label htmlFor="admin-login-password">
            Password
          </label>
          <div className="admin-password-field">
            <input
              id="admin-login-password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter your password"
              required
            />
            <button
              type="button"
              className="password-visibility-btn"
              aria-label={`${showPassword ? 'Hide' : 'Show'} password`}
              aria-pressed={showPassword}
              onClick={() => setShowPassword(value => !value)}
              title={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="password-visibility-icon">
                  <path d="M3 12s3.5-6 9-6 9 6 9 6-3.5 6-9 6-9-6-9-6Zm9 3.25A3.25 3.25 0 1 0 12 8.5a3.25 3.25 0 0 0 0 6.75Zm0-1.5A1.75 1.75 0 1 1 12 9.75a1.75 1.75 0 0 1 0 3.5Z" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true" className="password-visibility-icon">
                  <path d="M2.5 2.5 21.5 21.5M10.5 10.5A3.25 3.25 0 0 0 13.5 13.5M9.3 5.9A10.7 10.7 0 0 1 12 5.5c5.5 0 9 6.5 9 6.5a17 17 0 0 1-3.5 4.8M7.2 7.2A15.6 15.6 0 0 0 3 12s3.5 6.5 9 6.5a10.1 10.1 0 0 0 4.3-.95" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              )}
            </button>
          </div>
          {authError && <p className="error-message">{authError}</p>}
          <button type="submit" disabled={authLoading}>
            {authLoading ? 'Signing in...' : 'Sign in'}
          </button>
          <button type="button" className="forgot-password-link" onClick={() => setShowForgotPassword(true)}>
            Forgot password?
          </button>
        </form>}
        {!showForgotPassword && <p>Use your parish email or username and password. If the ASP.NET Identity tables are connected, the app will validate the role from <code>AspNetUserRoles</code> and <code>AspNetRoles</code>.</p>}
      </section>
    )
  }

  return (
    <section className={`content-section simple-page ${embedded ? 'admin-embedded-page' : ''}`}>
      <div className="section-heading">
        <p className="eyebrow">Administration</p>
        <h2>{staffRole} administration</h2>
        <p>Signed in as {staffRole}. Access is limited by staff role.</p>
      </div>

      {!embedded && <div className="admin-tabs nav nav-tabs flex-wrap mb-4">
        <button
          className={`admin-tab nav-link ${activeTab === 'dashboard' ? 'active' : ''}`}
          onClick={() => setActiveTab('dashboard')}
        >
          Dashboard
        </button>
        <button
          className={`admin-tab nav-link ${activeTab === 'events' ? 'active' : ''}`}
          onClick={() => setActiveTab('events')}
          disabled={!['Admin', 'Secretary'].includes(staffRole)}
        >
          Events
        </button>
        <button
          className={`admin-tab nav-link ${activeTab === 'prayers' ? 'active' : ''}`}
          onClick={() => setActiveTab('prayers')}
          disabled={!['Admin', 'Secretary', 'ParishPriest', 'Staff'].includes(staffRole)}
        >
          Prayer Requests
        </button>
        <button
          className={`admin-tab nav-link ${activeTab === 'service-requests' ? 'active' : ''}`}
          onClick={() => setActiveTab('service-requests')}
          disabled={!['Admin', 'Secretary', 'ParishPriest', 'Staff'].includes(staffRole)}
        >
          Service Requests
        </button>
        {['Admin', 'Secretary', 'ParishPriest', 'Staff'].includes(staffRole) && (
          <button
            className={`admin-tab nav-link ${activeTab === 'mass-schedule' ? 'active' : ''}`}
            onClick={() => setActiveTab('mass-schedule')}
          >
            Mass Schedule
          </button>
        )}
        {['Admin', 'ParishPriest', 'Secretary', 'Staff'].includes(staffRole) && (
          <button
            className={`admin-tab nav-link ${activeTab === 'sacramental-ledger' ? 'active' : ''}`}
            onClick={() => setActiveTab('sacramental-ledger')}
          >
            Sacramental Records
          </button>
        )}
      </div>}

      {staffRole === 'Bookkeeper' && (
        <div className="admin-panel role-notice">
          <h3>Bookkeeper workspace</h3>
          <p>Financial tracking and reporting are available under Finance & Reports. This role cannot access sacramental or scheduling records.</p>
        </div>
      )}

      {activeTab === 'dashboard' && (
        <div className="admin-dashboard">
          <div className="dashboard-summary">
            <div className="dashboard-card pending">
              <span className="card-label">Pending requests</span>
              <strong>{dashboardPending}</strong>
            </div>
            <div className="dashboard-card approved">
              <span className="card-label">Approved</span>
              <strong>{dashboardApproved}</strong>
            </div>
            <div className="dashboard-card rejected">
              <span className="card-label">Rejected</span>
              <strong>{dashboardRejected}</strong>
            </div>
            <div className="dashboard-card total">
              <span className="card-label">Total service requests</span>
              <strong>{serviceRequests.length}</strong>
            </div>
          </div>

          <div className="dashboard-grid">
            <div className="dashboard-panel">
              <h3>Requests by service</h3>
              {serviceTypeBreakdown.length === 0 ? (
                <p>No service request data yet.</p>
              ) : (
                <ul className="breakdown-list">
                  {serviceTypeBreakdown.map(([name, count]) => (
                    <li key={name}>
                      <span>{name}</span>
                      <strong>{count}</strong>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="dashboard-panel">
              <h3>Recent activity</h3>
              {recentActivity.length === 0 ? (
                <p>No recent activity.</p>
              ) : (
                <ul className="activity-list">
                  {recentActivity.map((item, index) => (
                    <li key={`${item.title}-${index}`}>
                      <span className={`activity-dot ${item.type}`}></span>
                      <div>
                        <strong>{item.title}</strong>
                        <small>{item.meta}</small>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="dashboard-panel quick-links-panel">
            <h3>Quick links</h3>
            <div className="quick-links">
              <button type="button" className="quick-link" onClick={() => setActiveTab('service-requests')}>
                View service requests
              </button>
              <button type="button" className="quick-link" onClick={() => setActiveTab('events')}>
                Manage events
              </button>
              <button type="button" className="quick-link" onClick={() => setActiveTab('prayers')}>
                Review prayer requests
              </button>
              <button type="button" className="quick-link" onClick={() => setActiveTab('service-requests')}>
                Scheduling overview
              </button>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'events' && (
        <div className="admin-panel events-workspace">
          <div className="admin-form">
            <h3>{editingId ? 'Edit event' : 'Add new event'}</h3>
            <p className="events-form-intro">Share the details parishioners need to plan their visit.</p>
            <form onSubmit={submitForm}>
              <label>
                Title
                <input
                  type="text"
                  value={form.title}
                  onChange={e => setForm({ ...form, title: e.target.value })}
                  required
                />
              </label>
              <label>
                Title (Tagalog)
                <input
                  type="text"
                  value={form.titleTl}
                  onChange={e => setForm({ ...form, titleTl: e.target.value })}
                />
              </label>
              <label>
                Description
                <textarea
                  value={form.description}
                  onChange={e => setForm({ ...form, description: e.target.value })}
                />
              </label>
              <label>
                Description (Tagalog)
                <textarea
                  value={form.descriptionTl}
                  onChange={e => setForm({ ...form, descriptionTl: e.target.value })}
                />
              </label>
              <label>
                Detail
                <textarea
                  value={form.detail}
                  onChange={e => setForm({ ...form, detail: e.target.value })}
                />
              </label>
              <label>
                Detail (Tagalog)
                <textarea
                  value={form.detailTl}
                  onChange={e => setForm({ ...form, detailTl: e.target.value })}
                />
              </label>
              <label>
                Date
                <input
                  type="date"
                  value={form.date}
                  onChange={e => setForm({ ...form, date: e.target.value })}
                  required
                />
              </label>
              <label>
                Time
                <input
                  type="time"
                  value={form.time}
                  onChange={e => setForm({ ...form, time: e.target.value })}
                />
              </label>
              <label>
                Location
                <input
                  type="text"
                  value={form.location}
                  onChange={e => setForm({ ...form, location: e.target.value })}
                />
              </label>
              <label>
                Location (Tagalog)
                <input
                  type="text"
                  value={form.locationTl}
                  onChange={e => setForm({ ...form, locationTl: e.target.value })}
                />
              </label>
              <div className="upload-field">
                <span className="upload-field-label">Event photo</span>
                <label className={`upload-tile${photoFile ? ' upload-tile--ready' : ''}`} aria-label="Upload event photo">
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp"
                    onChange={e => setPhotoFile(e.target.files?.[0] ?? null)}
                  />
                  <span className="upload-tile-icon" aria-hidden="true">{photoFile ? '✓' : '+'}</span>
                  <span className="upload-tile-name">{photoFile ? photoFile.name : 'Choose photo'}</span>
                  {photoFile && (
                    <button
                      type="button"
                      className="upload-tile-clear"
                      aria-label="Clear selected photo"
                      onClick={e => { e.preventDefault(); setPhotoFile(null) }}
                    >✕</button>
                  )}
                </label>
              </div>
              <AdminFeedback message={message} error={errorState} onDismiss={() => setError(null)} />
              <div className="button-row">
                <button type="submit" disabled={saving}>
                  {editingId ? 'Save changes' : 'Add event'}
                </button>
                {editingId && (
                  <button type="button" onClick={resetForm} disabled={saving}>
                    Cancel
                  </button>
                )}
              </div>
            </form>
          </div>

          <div className="admin-list">
            <div className="events-list-heading">
              <div>
                <span className="events-section-kicker">Published calendar</span>
                <h3>Existing events</h3>
              </div>
              <span className="events-count">{events.length}</span>
            </div>
            {loading && <p>Loading events…</p>}
            {!loading && events.length === 0 && (
              <div className="events-empty-state">
                <span className="events-empty-icon" aria-hidden="true">+</span>
                <strong>Your calendar is clear</strong>
                <p>New events will appear here after you publish them.</p>
              </div>
            )}
            <ul>
              {events.map(event => (
                <li key={event.id} className="admin-event-row">
                  <div>
                    <strong>{event.title}</strong>
                    <div>{new Date(event.date).toLocaleDateString()}</div>
                    {event.location && <div>{event.location}</div>}
                  </div>
                  <div className="admin-buttons">
                    <button type="button" onClick={() => setSelectedEvent(event)} className="secondary-btn">
                      View
                    </button>
                    <button type="button" onClick={() => startEdit(event)} disabled={saving}>
                      Edit
                    </button>
                    <button type="button" onClick={() => deleteEvent(event.id)} disabled={saving}>
                      Delete
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {selectedEvent && (
        <EventDetailsModal
          event={{ ...selectedEvent, location: selectedEvent.location || '', photoUrl: selectedEvent.photoUrl || '' }}
          photoUrl={getPhotoUrl(selectedEvent.photoUrl || '')}
          language="en"
          onClose={() => setSelectedEvent(null)}
        />
      )}

      {activeTab === 'prayers' && (
        <div className="admin-panel">
          <div className="admin-prayers-list">
            <h3>Prayer Requests</h3>
            <AdminFeedback message={message} error={errorState} onDismiss={() => setError(null)} />
            {prayersLoading && <p>Loading prayers…</p>}
            {!prayersLoading && prayers.length === 0 && <p>No prayer requests found.</p>}
            {!prayersLoading && prayers.length > 0 && (
              <ul className="admin-prayers-scrollable">
                {prayers.map(prayer => (
                  <li
                    key={prayer.id}
                    className={`admin-prayer-row ${prayer.isApproved ? 'approved' : 'pending'}`}
                  >
                    <div className="prayer-info">
                      <div className="prayer-header">
                        <strong>{prayer.anonymous ? 'Anonymous' : prayer.name}</strong>
                        <span className="prayer-category">{prayer.category}</span>
                        <span className={`badge ${prayer.isApproved ? 'approved-badge' : 'pending-badge'}`}>
                          {prayer.isApproved ? 'Approved' : 'Pending approval'}
                        </span>
                      </div>
                      <div className="prayer-text">{prayer.request.substring(0, 100)}...</div>
                      <div className="prayer-meta">
                        <small>{new Date(prayer.createdAt).toLocaleDateString()}</small>
                        {prayer.shareWithCommunity && <small>• Shared with community</small>}
                      </div>
                    </div>
                    <div className="admin-buttons">
                      <button
                        type="button"
                        onClick={() => setSelectedPrayer(prayer)}
                        className="secondary-btn"
                      >
                        View
                      </button>
                      {canManagePrayerRequests && !prayer.isApproved && (
                        <button
                          type="button"
                          onClick={() => approvePrayer(prayer.id)}
                          disabled={saving}
                          className="primary-btn"
                        >
                          Approve
                        </button>
                      )}
                      {canManagePrayerRequests && <button
                        type="button"
                        onClick={() => rejectPrayer(prayer.id)}
                        disabled={saving}
                        className="danger-btn"
                      >
                        Delete
                      </button>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedPrayer && createPortal(
            <div className="prayer-modal-overlay" onClick={() => setSelectedPrayer(null)}>
              <div className="prayer-modal-card prayer-modal-card-enhanced" onClick={(e) => e.stopPropagation()}>
                <div className="prayer-modal-header-enhanced">
                  <div className="prayer-modal-header-content">
                    <div className="prayer-modal-title-section">
                      <h3 className="prayer-modal-title">Prayer Request</h3>
                      <div className="prayer-modal-meta">
                        <span 
                          className="prayer-modal-category-enhanced"
                          style={{
                            backgroundColor: selectedPrayer.category === 'healing' ? '#4a7c59' : 
                                           selectedPrayer.category === 'thanksgiving' ? '#b47b24' : 
                                           selectedPrayer.category === 'guidance' ? '#5b7a9d' : '#8b5a3c'
                          }}
                        >
                          {selectedPrayer.category}
                        </span>
                        <span className="prayer-modal-date-enhanced">
                          {new Date(selectedPrayer.createdAt).toLocaleDateString('en-US', { 
                            month: 'long', 
                            day: 'numeric', 
                            year: 'numeric' 
                          })}
                        </span>
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedPrayer(null)}
                    className="prayer-modal-close-enhanced"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>
                
                <div className="prayer-modal-body-enhanced">
                  <div className="prayer-modal-request-section">
                    <p className="prayer-modal-text-enhanced">{selectedPrayer.request}</p>
                  </div>
                  
                  <div className="prayer-modal-info-section">
                    <div className="prayer-info-item">
                      <svg className="prayer-info-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path>
                        <circle cx="12" cy="7" r="4"></circle>
                      </svg>
                      <span className="prayer-info-label">Requested by:</span>
                      <span className="prayer-info-value">{selectedPrayer.anonymous ? 'Anonymous' : selectedPrayer.name}</span>
                    </div>
                    
                    <div className="prayer-info-item">
                      <svg className="prayer-info-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {selectedPrayer.shareWithCommunity ? (
                          <><circle cx="12" cy="12" r="10"></circle><path d="M12 16v-4M12 8h.01"></path></>
                        ) : (
                          <><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></>
                        )}
                      </svg>
                      <span className="prayer-info-label">Privacy:</span>
                      <span className="prayer-info-value">{selectedPrayer.shareWithCommunity ? 'Shared with community' : 'Private'}</span>
                    </div>
                    
                    <div className="prayer-info-item">
                      <svg className="prayer-info-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        {selectedPrayer.isApproved ? (
                          <><polyline points="20 6 9 17 4 12"></polyline></>
                        ) : (
                          <><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="8" x2="12" y2="12"></line><line x1="12" y1="16" x2="12.01" y2="16"></line></>
                        )}
                      </svg>
                      <span className="prayer-info-label">Status:</span>
                      <span className={`prayer-status-badge ${selectedPrayer.isApproved ? 'status-approved' : 'status-pending'}`}>
                        {selectedPrayer.isApproved ? '✓ Approved' : '⏱ Pending Approval'}
                      </span>
                    </div>
                  </div>
                </div>
                
                {canManagePrayerRequests && <div className="prayer-modal-footer-enhanced">
                  <div className="prayer-modal-actions">
                    {!selectedPrayer.isApproved && (
                      <button
                        type="button"
                        onClick={() => {
                          approvePrayer(selectedPrayer.id)
                          setSelectedPrayer(null)
                        }}
                        disabled={saving}
                        className="prayer-action-btn prayer-approve-btn"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                          <polyline points="20 6 9 17 4 12"></polyline>
                        </svg>
                        Approve Prayer
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        rejectPrayer(selectedPrayer.id)
                        setSelectedPrayer(null)
                      }}
                      disabled={saving}
                      className="prayer-action-btn prayer-delete-btn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                        <polyline points="3 6 5 6 21 6"></polyline>
                        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
                      </svg>
                      Delete Prayer
                    </button>
                  </div>
                </div>}
              </div>
            </div>,
            document.body,
          )}
        </div>
      )}

      {activeTab === 'service-requests' && (
        <div className="admin-panel">
          <div className="admin-service-list service-requests-list">
            <div className="service-list-heading">
              <div>
                <p className="section-kicker">Parish office</p>
                <h3>Service requests</h3>
                <p className="service-list-description">Review booking details and confirm upcoming parish services.</p>
              </div>
              <button
                type="button"
                className="service-request-refresh"
                onClick={loadServiceRequests}
                disabled={serviceRequestsLoading}
              >
                {serviceRequestsLoading ? 'Refreshing…' : 'Refresh requests'}
              </button>
            </div>
            <AdminFeedback message={message} error={errorState} onDismiss={() => setError(null)} />
            <div className="service-request-toolbar">
              <label>
                Filter by status
                <select
                  aria-label="Filter service requests by status"
                  value={serviceRequestStatusFilter}
                  onChange={event => setServiceRequestStatusFilter(event.target.value)}
                >
                  <option value="All">All statuses</option>
                  {serviceRequestStatuses.map(status => (
                    <option key={status} value={status}>{formatServiceRequestStatus(status)}</option>
                  ))}
                </select>
              </label>
              {!serviceRequestsLoading && (
                <span className="request-count" aria-live="polite">
                  Showing {visibleServiceRequests.length} of {serviceRequests.length} {serviceRequests.length === 1 ? 'request' : 'requests'}
                </span>
              )}
            </div>
            {serviceRequestsLoading && <p className="service-request-state">Loading service requests…</p>}
            {!serviceRequestsLoading && serviceRequests.length === 0 && (
              <div className="service-request-state">
                <strong>No service requests yet</strong>
                <span>New parish bookings will appear here.</span>
              </div>
            )}
            {!serviceRequestsLoading && serviceRequests.length > 0 && visibleServiceRequests.length === 0 && (
              <div className="service-request-state">
                <strong>No requests with this status</strong>
                <span>Choose another status to see more bookings.</span>
              </div>
            )}
            {!serviceRequestsLoading && visibleServiceRequests.length > 0 && (
              <ul className="service-request-cards">
                {visibleServiceRequests.map(request => (
                  <li
                    key={request.id}
                    className={`admin-service-row status-${request.status.toLowerCase()}`}
                  >
                    <div className="service-info">
                      <div className="service-header">
                        <div>
                          <strong>{request.firstName} {request.lastName}</strong>
                          <span className="service-type">{request.serviceName}</span>
                        </div>
                        <span className={`badge status-badge ${request.status === 'Confirmed' ? 'confirmed' : request.status === 'Rejected' ? 'rejected' : 'pending'}`}>
                          {formatServiceRequestStatus(request.status)}
                        </span>
                      </div>
                      <div className="service-details">
                        <small><span aria-hidden="true">📅</span> {new Date(request.scheduledDate).toLocaleDateString()} at {request.scheduledTime}</small>
                        <small><span aria-hidden="true">📧</span> {request.email}</small>
                      </div>
                    </div>
                    <div className="admin-buttons">
                      <button
                        type="button"
                        onClick={() => setSelectedServiceRequest(request)}
                        className="secondary-btn"
                      >
                        View
                      </button>
                      {request.status !== 'Confirmed' && (
                        <button
                          type="button"
                          onClick={() => confirmServiceRequest(request.id)}
                          disabled={saving}
                          className="primary-btn"
                        >
                          Confirm
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => deleteServiceRequest(request.id)}
                        disabled={saving}
                        className="danger-btn"
                      >
                        Delete
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>

          {selectedServiceRequest && createPortal(
            <div className="service-request-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelectedServiceRequest(null) }}>
            <div className="admin-service-detail service-request-modal-card">
              <div className="detail-header">
                <h3>Service Request Detail</h3>
                <button
                  type="button"
                  onClick={() => setSelectedServiceRequest(null)}
                  className="close-btn"
                >
                  ✕
                </button>
              </div>
              <div className="detail-content">
                <div className="detail-row">
                  <label>Name:</label>
                  <span>{selectedServiceRequest.firstName} {selectedServiceRequest.lastName}</span>
                </div>
                <div className="detail-row">
                  <label>Email:</label>
                  <span>{selectedServiceRequest.email}</span>
                </div>
                <div className="detail-row">
                  <label>Phone:</label>
                  <span>{selectedServiceRequest.mobileNumber}</span>
                </div>
                <div className="detail-row">
                  <label>Address:</label>
                  <span>{selectedServiceRequest.address}</span>
                </div>
                <div className="detail-row">
                  <label>Service:</label>
                  <span>{selectedServiceRequest.serviceName}</span>
                </div>
                <div className="detail-row">
                  <label>Scheduled:</label>
                  <span>{new Date(selectedServiceRequest.scheduledDate).toLocaleDateString()} at {selectedServiceRequest.scheduledTime}</span>
                </div>
                <div className="detail-row">
                  <label>Status:</label>
                  <span>{selectedServiceRequest.status}</span>
                </div>
                <div className="detail-row">
                  <label>Request ID:</label>
                  <span>#{selectedServiceRequest.id}</span>
                </div>
                <div className="detail-row">
                  <label>Submitted:</label>
                  <span>{new Date(selectedServiceRequest.createdAt).toLocaleString()}</span>
                </div>
                {selectedServiceRequest.notes && (
                  <div className="detail-row">
                    <label>Notes:</label>
                    <span>{selectedServiceRequest.notes}</span>
                  </div>
                )}
                {selectedServiceRequest.details && Object.keys(selectedServiceRequest.details).length > 0 && (
                  <div className="service-specific-details">
                    <h4>Service Information</h4>
                    {Object.entries(selectedServiceRequest.details).map(([key, value]) => (
                      <div className="detail-row" key={key}>
                        <label>{detailLabel(key)}:</label>
                        <span>{detailValue(value)}</span>
                      </div>
                    ))}
                  </div>
                )}
                <div className="detail-request">
                  <label>Add Admin Notes:</label>
                  <textarea
                    value={adminNotes}
                    onChange={e => setAdminNotes(e.target.value)}
                    placeholder="Add internal notes about this booking..."
                    rows={3}
                  />
                </div>
                <div className="detail-actions">
                  {selectedServiceRequest.status !== 'Confirmed' && (
                    <button
                      type="button"
                      onClick={() => {
                        confirmServiceRequest(selectedServiceRequest.id)
                        setSelectedServiceRequest(null)
                      }}
                      disabled={saving}
                      className="primary-btn"
                    >
                      Confirm Booking
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => deleteServiceRequest(selectedServiceRequest.id)}
                    disabled={saving}
                    className="danger-btn"
                  >
                    Delete Request
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedServiceRequest(null)}
                    className="secondary-btn"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
            </div>,
            document.body,
          )}
        </div>
      )}

      {activeTab === 'mass-schedule' && (
        <div className="admin-panel">
          <div className="admin-service-list">
            <div className="service-list-heading">
              <div>
                <p className="section-kicker">Assigned duties</p>
                <h3>{staffRole === 'ParishPriest' ? 'Masses assigned to you' : 'Mass Schedule'}</h3>
              </div>
              {!massesLoading && <span className="request-count">{masses.length} upcoming</span>}
            </div>

            <div className="mass-calendar-wrapper">
              <FullCalendar
                plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
                initialView="dayGridMonth"
                headerToolbar={{
                  left: 'prev,next today',
                  center: 'title',
                  right: 'dayGridMonth,timeGridWeek,timeGridDay',
                }}
                events={massCalendarEvents}
                eventTimeFormat={{ hour: 'numeric', minute: '2-digit', meridiem: true }}
                contentHeight="auto"
                eventDisplay="block"
                dayMaxEvents={3}
                eventContent={arg => (
                  <div className="mass-calendar-event">
                    {arg.timeText && <span className="mass-calendar-event-time">{arg.timeText}</span>}
                    <span className="mass-calendar-event-title">{arg.event.title}</span>
                  </div>
                )}
              />
            </div>

            <AdminFeedback message={message} error={errorState} onDismiss={() => setError(null)} />
            {massesLoading && <p>Loading Mass schedule...</p>}
            {!massesLoading && masses.length === 0 && <p>No upcoming Masses are assigned.</p>}
            {!massesLoading && masses.length > 0 && (
              <ul className="service-request-cards">
                {masses.map(mass => (
                  <li key={mass.id} className="admin-service-row">
                    <div className="service-info">
                      <div className="service-header">
                        <div>
                          <strong>{mass.title}</strong>
                          <span className="service-type">{mass.location}</span>
                        </div>
                        <span className="badge status-badge confirmed">{mass.status}</span>
                      </div>
                      <div className="service-details">
                        <small>{new Date(mass.date).toLocaleDateString()} at {mass.time}</small>
                        <small>Priest: {mass.priestUsername}</small>
                      </div>
                      {mass.notes && <p>{mass.notes}</p>}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {activeTab === 'sacramental-ledger' && (
        <div className="admin-panel">
          <div className="sacramental-ledger">
            <div className="ledger-heading">
              <div>
                <h3>Sacramental Records</h3>
                <p className="ledger-description">Search the parish register or add a new entry.</p>
              </div>
              {canManageSacramentalRecords && <button type="button" className="primary-btn" onClick={() => { setRecordFormType((sacramentalSearch.type || 'baptism') as 'baptism' | 'confirmation' | 'marriage' | 'death'); setRecordFormRecord(null); setShowRecordForm(true) }}>Add a record</button>}
            </div>

            <form
              className="sacramental-search"
              aria-label="Search sacramental records"
              onSubmit={event => {
                event.preventDefault()
                loadSacramentalRecords({ ...sacramentalSearch, page: 1 })
              }}
            >
              <div className="sacramental-search-row">
                <label className="sacramental-search-field sacramental-name-field">
                  <span>Name or registry number</span>
                  <input
                    type="text"
                    value={sacramentalSearch.q}
                    onChange={e => setSacramentalSearch(prev => ({ ...prev, q: e.target.value, page: 1 }))}
                    className="search-input"
                    placeholder="e.g. Maria Santos or B-1024"
                  />
                </label>
                <label className="sacramental-search-field sacramental-type-field">
                  <span>Sacrament</span>
                  <select
                    value={sacramentalSearch.type}
                    onChange={e => setSacramentalSearch(prev => ({ ...prev, type: e.target.value, page: 1 }))}
                    className="search-select"
                  >
                    <option value="">All types</option>
                    <option value="baptism">Baptism</option>
                    <option value="confirmation">Confirmation</option>
                    <option value="marriage">Marriage</option>
                    <option value="death">Death</option>
                  </select>
                </label>
                <div className="sacramental-search-actions">
                  <button type="submit" className="primary-btn">Search records</button>
                  <button
                    type="button"
                    className="filter-toggle"
                    aria-expanded={showAdvancedSacramentalFilters}
                    aria-controls="sacramental-advanced-filters"
                    onClick={() => setShowAdvancedSacramentalFilters(open => !open)}
                  >
                    {showAdvancedSacramentalFilters ? 'Fewer filters' : 'More filters'}
                    {advancedSacramentalFilterCount > 0 && <span> ({advancedSacramentalFilterCount} active)</span>}
                  </button>
                  {hasSacramentalSearch && (
                    <button type="button" onClick={clearSacramentalSearch} className="secondary-btn">Clear</button>
                  )}
                </div>
              </div>
              <div
                id="sacramental-advanced-filters"
                className="sacramental-advanced-filters"
                hidden={!showAdvancedSacramentalFilters}
              >
                <label className="sacramental-search-field">
                  <span>From date</span>
                  <input
                    type="date"
                    value={sacramentalSearch.startDate}
                    onChange={e => setSacramentalSearch(prev => ({ ...prev, startDate: e.target.value, page: 1 }))}
                    className="search-date"
                  />
                </label>
                <label className="sacramental-search-field">
                  <span>To date</span>
                  <input
                    type="date"
                    value={sacramentalSearch.endDate}
                    onChange={e => setSacramentalSearch(prev => ({ ...prev, endDate: e.target.value, page: 1 }))}
                    className="search-date"
                  />
                </label>
                <label className="sacramental-search-field">
                  <span>Minister or priest</span>
                  <input
                    type="text"
                    value={sacramentalSearch.priest}
                    onChange={e => setSacramentalSearch(prev => ({ ...prev, priest: e.target.value, page: 1 }))}
                    className="search-input"
                    placeholder="Name of minister"
                  />
                </label>
              </div>
            </form>

            <AdminFeedback message={message} error={errorState} onDismiss={() => setError(null)} />

            {/* Records Table */}
            <div className="sacramental-table-container">
              {sacramentalLoading && <div className="loading-overlay">Loading records…</div>}
              {!sacramentalLoading && sacramentalRecords.length === 0 && (
                <div className="empty-state">No sacramental records found matching your criteria.</div>
              )}
              {!sacramentalLoading && sacramentalRecords.length > 0 && (
                <table className="sacramental-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Registry No.</th>
                      <th>Name</th>
                      <th>Date</th>
                      <th>Minister</th>
                      <th>Scanned</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sacramentalRecords.map(record => (
                      <tr key={`${record.RecordType}-${record.Id}`}>
                        <td>
                          <span className={`sacrament-badge ${record.RecordType.toLowerCase()}`}>
                            {record.RecordType.charAt(0).toUpperCase() + record.RecordType.slice(1)}
                          </span>
                        </td>
                        <td>{record.RegistryNumber}</td>
                        <td>{record.Name}</td>
                        <td>{new Date(record.RecordDate).toLocaleDateString()}</td>
                        <td>{record.Priest}</td>
                        <td>
                          {record.ScannedDocumentUrl ? (
                            <span className="has-scan" title="View scanned document">📄</span>
                          ) : (
                            <span className="no-scan">—</span>
                          )}
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => {
                              void openSacramentalRecord(record)
                            }}
                            className="secondary-btn"
                            disabled={saving}
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}

              {/* Pagination */}
              {!sacramentalLoading && sacramentalRecords.length > 0 && sacramentalPagination.total > sacramentalPagination.limit && (
                <div className="pagination">
                  <button
                    onClick={() => setSacramentalSearch(prev => ({ ...prev, page: prev.page - 1 }))}
                    disabled={sacramentalPagination.page <= 1}
                    className="pagination-btn"
                  >
                    Previous
                  </button>
                  <span className="pagination-info">
                    Page {sacramentalPagination.page} of {Math.ceil(sacramentalPagination.total / sacramentalPagination.limit)}
                    ({sacramentalPagination.total} total)
                  </span>
                  <button
                    onClick={() => setSacramentalSearch(prev => ({ ...prev, page: prev.page + 1 }))}
                    disabled={sacramentalPagination.page >= Math.ceil(sacramentalPagination.total / sacramentalPagination.limit)}
                    className="pagination-btn"
                  >
                    Next
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Sacramental Record Detail Modal */}
      {selectedSacramentalRecord && createPortal(
        <div className="service-request-modal-overlay" onClick={e => { if (e.target === e.currentTarget) setSelectedSacramentalRecord(null) }}>
        <div className="admin-prayer-detail sacramental-detail-modal service-request-modal-card">
          <div className="detail-header">
            <h3>{selectedSacramentalRecord.RecordType.charAt(0).toUpperCase() + selectedSacramentalRecord.RecordType.slice(1)} Record Detail</h3>
            {canManageSacramentalRecords && <>
              <button type="button" className="secondary-btn" onClick={() => { setRecordFormType(selectedSacramentalRecord.RecordType.toLowerCase() as 'baptism' | 'confirmation' | 'marriage' | 'death'); setRecordFormRecord(selectedSacramentalRecord); setShowRecordForm(true) }}>Edit</button>
              <button type="button" className="secondary-btn" onClick={() => void deleteSacramentalRecord()} disabled={saving}>Delete</button>
            </>}
            <button
              type="button"
              onClick={() => setSelectedSacramentalRecord(null)}
              className="close-btn"
            >
              ✕
            </button>
          </div>
          <div className="detail-content">
            {/* Common */}
            <div className="detail-row">
              <label>Registry No.:</label>
              <span>{(selectedSacramentalRecord as Record<string, unknown>).RegistryNumber as string}</span>
            </div>

            {/* Baptism */}
            {selectedSacramentalRecord.RecordType.toLowerCase() === 'baptism' && (() => {
              const r = selectedSacramentalRecord as Record<string, unknown>
              return <>
                <div className="detail-row"><label>Child's Name:</label><span>{[r.ChildFirstName, r.ChildMiddleName, r.ChildLastName].filter(Boolean).join(' ')}</span></div>
                <div className="detail-row"><label>Date of Birth:</label><span>{r.DateOfBirth ? new Date(r.DateOfBirth as string).toLocaleDateString() : '—'}</span></div>
                <div className="detail-row"><label>Place of Birth:</label><span>{(r.PlaceOfBirth as string) || '—'}</span></div>
                <div className="detail-row"><label>Date of Baptism:</label><span>{r.DateOfBaptism ? new Date(r.DateOfBaptism as string).toLocaleDateString() : '—'}</span></div>
                <div className="detail-row"><label>Father:</label><span>{(r.FatherFullName as string) || '—'}</span></div>
                <div className="detail-row"><label>Mother:</label><span>{(r.MotherFullName as string) || '—'}</span></div>
                <div className="detail-row"><label>Sponsors:</label><span>{(r.Sponsors as string) || '—'}</span></div>
                <div className="detail-row"><label>Minister:</label><span>{(r.MinisterName as string) || '—'}</span></div>
                {r.Remarks && <div className="detail-row"><label>Remarks:</label><span>{r.Remarks as string}</span></div>}
              </>
            })()}

            {/* Confirmation */}
            {selectedSacramentalRecord.RecordType.toLowerCase() === 'confirmation' && (() => {
              const r = selectedSacramentalRecord as Record<string, unknown>
              return <>
                <div className="detail-row"><label>Candidate:</label><span>{[r.CandidateFirstName, r.CandidateMiddleName, r.CandidateLastName].filter(Boolean).join(' ')}</span></div>
                <div className="detail-row"><label>Date of Birth:</label><span>{r.DateOfBirth ? new Date(r.DateOfBirth as string).toLocaleDateString() : '—'}</span></div>
                <div className="detail-row"><label>Date of Confirmation:</label><span>{r.DateOfConfirmation ? new Date(r.DateOfConfirmation as string).toLocaleDateString() : '—'}</span></div>
                <div className="detail-row"><label>Father:</label><span>{(r.FatherFullName as string) || '—'}</span></div>
                <div className="detail-row"><label>Mother:</label><span>{(r.MotherFullName as string) || '—'}</span></div>
                <div className="detail-row"><label>Sponsor:</label><span>{(r.SponsorName as string) || '—'}</span></div>
                <div className="detail-row"><label>Bishop / Minister:</label><span>{(r.BishopOrMinister as string) || '—'}</span></div>
                <div className="detail-row"><label>Parish of Baptism:</label><span>{(r.ParishOfBaptism as string) || '—'}</span></div>
              </>
            })()}

            {/* Marriage */}
            {selectedSacramentalRecord.RecordType.toLowerCase() === 'marriage' && (() => {
              const r = selectedSacramentalRecord as Record<string, unknown>
              return <>
                <div className="detail-row"><label>Groom:</label><span>{[r.GroomFirstName, r.GroomMiddleName, r.GroomLastName].filter(Boolean).join(' ')}{r.GroomAge ? `, age ${r.GroomAge}` : ''}</span></div>
                <div className="detail-row"><label>Groom's Parents:</label><span>{(r.GroomParents as string) || '—'}</span></div>
                <div className="detail-row"><label>Bride:</label><span>{[r.BrideFirstName, r.BrideMiddleName, r.BrideLastName].filter(Boolean).join(' ')}{r.BrideAge ? `, age ${r.BrideAge}` : ''}</span></div>
                <div className="detail-row"><label>Bride's Parents:</label><span>{(r.BrideParents as string) || '—'}</span></div>
                <div className="detail-row"><label>Date of Marriage:</label><span>{r.DateOfMarriage ? new Date(r.DateOfMarriage as string).toLocaleDateString() : '—'}</span></div>
                <div className="detail-row"><label>Witnesses:</label><span>{(r.Witnesses as string) || '—'}</span></div>
                <div className="detail-row"><label>Solemnizing Priest:</label><span>{(r.SolemnizingPriest as string) || '—'}</span></div>
              </>
            })()}

            {/* Death */}
            {selectedSacramentalRecord.RecordType.toLowerCase() === 'death' && (() => {
              const r = selectedSacramentalRecord as Record<string, unknown>
              return <>
                <div className="detail-row"><label>Deceased:</label><span>{[r.DeceasedFirstName, r.DeceasedMiddleName, r.DeceasedLastName].filter(Boolean).join(' ')}{r.Age ? `, age ${r.Age}` : ''}</span></div>
                <div className="detail-row"><label>Date of Death:</label><span>{r.DateOfDeath ? new Date(r.DateOfDeath as string).toLocaleDateString() : '—'}</span></div>
                <div className="detail-row"><label>Date of Burial:</label><span>{r.DateOfBurial ? new Date(r.DateOfBurial as string).toLocaleDateString() : '—'}</span></div>
                <div className="detail-row"><label>Cause of Death:</label><span>{(r.CauseOfDeath as string) || '—'}</span></div>
                <div className="detail-row"><label>Place of Burial:</label><span>{(r.PlaceOfBurial as string) || '—'}</span></div>
                <div className="detail-row"><label>Sacraments Received:</label><span>{(r.SacramentsReceived as string) || '—'}</span></div>
                <div className="detail-row"><label>Officiating Priest:</label><span>{(r.OfficiatingPriest as string) || '—'}</span></div>
              </>
            })()}

            {selectedSacramentalRecord.ScannedDocumentUrl && (
              <div className="detail-row">
                <label>Scanned Document:</label>
                <a href={selectedSacramentalRecord.ScannedDocumentUrl} target="_blank" rel="noopener noreferrer" className="scanned-link">
                  View Scanned Document
                </a>
              </div>
            )}
            <h4>Change history</h4>
            {recordAudit.length === 0 ? <p>No changes recorded.</p> : recordAudit.map(item => { let changedFields: string[]; try { changedFields = Object.keys(JSON.parse(item.Changes || '{}')) } catch { changedFields = [] } return <p key={item.AuditId}><strong>{item.ActionName}</strong> by {item.ChangedBy} on {new Date(item.ChangedAt).toLocaleString()}{changedFields.length > 0 && <small> — fields: {changedFields.join(', ')}</small>}</p> })}
          </div>
        </div>
        </div>,
        document.body,
      )}

      {showRecordForm && createPortal(
        <div
          className="service-request-modal-overlay sacramental-form-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="sacramental-form-title"
          onClick={event => { if (event.target === event.currentTarget) setShowRecordForm(false) }}
          onKeyDown={event => { if (event.key === 'Escape') setShowRecordForm(false) }}
        >
          <SacramentalRecordForm
            key={`${recordFormType}-${recordFormRecord?.Id ?? 'new'}`}
            type={recordFormType}
            record={recordFormRecord}
            adminToken={adminToken}
            onCancel={() => setShowRecordForm(false)}
            onSaved={() => { setShowRecordForm(false); setSelectedSacramentalRecord(null); loadSacramentalRecords() }}
          />
        </div>,
        document.body,
      )}

      {/* Archive Upload Modal */}
      {showArchiveModal && (
        <div className="admin-prayer-detail archive-upload-modal">
          <div className="detail-header">
            <h3>Digital Archives</h3>
            <button
              type="button"
              onClick={() => setShowArchiveModal(false)}
              className="close-btn"
            >
              ✕
            </button>
          </div>
          <div className="detail-content">
            {canManageSacramentalRecords && <div className="archive-upload-form">
              <label>
                Sacrament Type
                <select disabled value={selectedSacramentalRecord?.RecordType || ''} className="archive-select">
                  <option value="baptism">Baptism</option>
                  <option value="confirmation">Confirmation</option>
                  <option value="marriage">Marriage</option>
                  <option value="death">Death</option>
                </select>
              </label>
              <label>
                Book Number
                <input type="number" min="1" className="archive-input" placeholder="e.g., 1" value={archiveBookNumber} onChange={event => setArchiveBookNumber(event.target.value)} />
              </label>
              <label>
                Page Number
                <input type="number" min="1" className="archive-input" placeholder="e.g., 45" value={archivePageNumber} onChange={event => setArchivePageNumber(event.target.value)} />
              </label>
              <label>
                Notes
                <textarea rows={3} placeholder="Optional notes about this archival page..." value={archiveNotes} onChange={event => setArchiveNotes(event.target.value)} />
              </label>
              <div className="upload-field">
                <span className="upload-field-label">Scan File <span style={{ fontWeight: 400, color: '#7a8a80' }}>(PDF, PNG, JPG, TIFF · max 20 MB)</span></span>
                <label className={`upload-tile${archiveFile ? ' upload-tile--ready' : ''}`} aria-label="Upload scan file">
                  <input type="file" accept=".pdf,.png,.jpg,.jpeg,.tiff" onChange={event => setArchiveFile(event.target.files?.[0] || null)} />
                  <span className="upload-tile-icon" aria-hidden="true">{archiveFile ? '✓' : '+'}</span>
                  <span className="upload-tile-name">{archiveFile ? archiveFile.name : 'Choose file'}</span>
                  {archiveFile && (
                    <button
                      type="button"
                      className="upload-tile-clear"
                      aria-label="Clear selected file"
                      onClick={e => { e.preventDefault(); setArchiveFile(null) }}
                    >✕</button>
                  )}
                </label>
              </div>
              <div className="button-row">
                <button type="button" className="primary-btn" disabled={saving} onClick={() => void uploadSacramentalArchive()}>
                  {editingArchiveId ? 'Save archive changes' : 'Upload Archive'}
                </button>
                {editingArchiveId && (
                  <button type="button" className="secondary-btn" disabled={saving} onClick={() => { setEditingArchiveId(null); setArchiveBookNumber(''); setArchivePageNumber(''); setArchiveNotes('') }}>
                    Cancel edit
                  </button>
                )}
                <button type="button" onClick={() => setShowArchiveModal(false)} className="secondary-btn" disabled={saving}>
                  Cancel
                </button>
              </div>
            </div>}

            {/* Archives List */}
            <div className="archives-list">
              <h4>Existing Archives</h4>
              <div className="button-row">
                <input type="number" min="1" className="archive-input" placeholder="Book #" value={archiveFilterBook} onChange={event => setArchiveFilterBook(event.target.value)} />
                <input type="number" min="1" className="archive-input" placeholder="Page #" value={archiveFilterPage} onChange={event => setArchiveFilterPage(event.target.value)} />
                <input type="text" className="archive-input" placeholder="Registry #" value={archiveFilterRegistry} onChange={event => setArchiveFilterRegistry(event.target.value)} />
                <button type="button" className="secondary-btn" onClick={() => loadSacramentalArchives()}>Search</button>
              </div>
              {archivesLoading && <p>Loading archives…</p>}
              {!archivesLoading && sacramentalArchives.length === 0 && <p>No archived documents for this record.</p>}
              {!archivesLoading && sacramentalArchives.length > 0 && (
                <ul>
                  {sacramentalArchives.map(archive => (
                    <li key={archive.ArchiveId} className="archive-item">
                      <div className="archive-info">
                        <strong>Book {archive.BookNumber}, Page {archive.PageNumber}</strong>
                        <small>Uploaded by {archive.UploadedBy} on {new Date(archive.UploadedAt).toLocaleDateString()}</small>
                        {archive.Notes && <p>{archive.Notes}</p>}
                      </div>
                      <div className="button-row">
                        <a href={`${API_URL}/api/admin/sacramental/archives/${archive.ArchiveId}/file?token=${encodeURIComponent(adminToken)}`} target="_blank" rel="noopener noreferrer" className="archive-link">
                          View
                        </a>
                        {canManageSacramentalRecords && <>
                          <button type="button" className="secondary-btn" onClick={() => { setEditingArchiveId(archive.ArchiveId); setArchiveBookNumber(String(archive.BookNumber)); setArchivePageNumber(String(archive.PageNumber)); setArchiveNotes(archive.Notes || '') }} disabled={saving}>
                            Edit
                          </button>
                          <button type="button" className="secondary-btn" onClick={() => void deleteSacramentalArchive(archive.ArchiveId)} disabled={saving}>
                            Delete
                          </button>
                        </>}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  )
}
