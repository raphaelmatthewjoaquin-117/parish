/* The embedded operations markup still consumes legacy SQL-shaped payloads. */
/* eslint-disable @typescript-eslint/no-explicit-any */
import { useEffect, useState } from 'react'
import { API_BASE_URL, apiClient, useApiError as formatApiError } from '../api/client'
import { AdminFeedback } from '../components/AdminFeedback'
import type { ModuleOverrides } from '../utils/rbac'
import { AdminBookingAvailabilityPage } from './AdminBookingAvailabilityPage'
import '../PagesCSS/AdminOperationsPage.css'


export type AdminOperationsTab = 'schedule' | 'intentions' | 'availability' | 'finance' | 'applications' | 'stats' | 'service-fields'

type Schedule = { id: number; title: string; date: string; time: string; location: string; priestUsername: string; notes?: string; status: string }
// type Application = { id: number; firstName: string; lastName: string; email: string; mobileNumber?: string; address?: string; serviceName: string; scheduledDate: string; scheduledTime: string; status: string; notes?: string; attendanceStatus?: string }
type MassIntention = { MassIntentionId: number; IntentionDate: string; IntentionTime: string; IntentionText: string; RequestedBy: string; Offering: number }
type FinanceEntry = { FinancialEntryId: number; EntryDate: string; EntryType: string; Description: string; Amount: number; EnteredBy: string; Status?: string }
type FinanceAudit = { AuditId: number; FinancialEntryId: number; ActionName: string; EntryType: string; Description: string; ChangedBy: string; ChangedAt: string; Details?: string }
type FinanceReportSnapshot = { FinanceReportSnapshotId: number; ReportType: string; PeriodStart: string; PeriodEnd: string; TotalIncome: number; TotalExpenses: number; NetTotal: number; GeneratedAt: string; GeneratedBy: string }
type FinanceReport = { totals?: Array<{ EntryType: string; EntryCount: number; Total: number }> }
type StatisticalReport = {
  targetYear?: number
  summary?: { totalBaptisms?: number; totalConfirmations?: number; totalMarriages?: number; totalDeaths?: number }
  demographics?: { baptisms?: { InfantsUnder1Yr?: number; ChildrenOver1Yr?: number }; marriages?: { AvgGroomAge?: number; AvgBrideAge?: number; Under25?: number; Age25To35?: number; Over35?: number }; deaths?: { AvgDeceasedAge?: number; Under18?: number; Age18To59?: number; Senior60Plus?: number } }
  monthlyBreakdown?: Array<Record<string, number | string>>
}
// type ApplicationHistory = { ApplicationEditLogId: number; ChangedAt: string; ChangedBy: string }
type ServiceOption = { id: number; name: string }
type ServiceField = { id: number; serviceId: number; serviceName: string; key: string; label: string; type: string; options?: string[]; required: boolean; sortOrder: number; active: boolean }

const emptySchedule = { title: '', date: '', time: '', location: '', priestUsername: '', notes: '', status: 'Scheduled' }
const emptyServiceField = { serviceId: '', key: '', label: '', type: 'text', required: false, sortOrder: 0 }
const formatFinanceAmount = (amount: number) => new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(amount)

type AdminOperationsPageProps = {
  initialTab?: AdminOperationsTab
  embedded?: boolean
  staffRole?: string
  overrides?: ModuleOverrides
}

export function AdminOperationsPage({ initialTab = 'schedule', embedded = false, staffRole = '', overrides }: AdminOperationsPageProps) {
  const [token, setToken] = useState(() => window.localStorage.getItem('adminToken') || '')
  const [tab, setTab] = useState<AdminOperationsTab>(initialTab)
  const [schedules, setSchedules] = useState<Schedule[]>([])
  const [scheduleForm, setScheduleForm] = useState(emptySchedule)
  const [editingSchedule, setEditingSchedule] = useState<number | null>(null)
  const [intentions, setIntentions] = useState<MassIntention[]>([])
  const [intentionForm, setIntentionForm] = useState({ date: '', time: '', offering: '0', requestedBy: '', intentionText: '' })
  const [finance, setFinance] = useState<FinanceEntry[]>([])
  const [financeAudit, setFinanceAudit] = useState<FinanceAudit[]>([])
  const [financeReportHistory, setFinanceReportHistory] = useState<FinanceReportSnapshot[]>([])
  const [financeForm, setFinanceForm] = useState({ date: '', entryType: 'StoleFee', description: '', amount: '' })
  const [report, setReport] = useState<FinanceReport | null>(null)
  const [editingFinanceId, setEditingFinanceId] = useState<number | null>(null)
  const [reportStart, setReportStart] = useState('')
  const [reportEnd, setReportEnd] = useState('')
  const [reportType, setReportType] = useState('')
  const [statsReport, setStatsReport] = useState<StatisticalReport | null>(null)
  const [statsYear, setStatsYear] = useState<number>(new Date().getFullYear())
  // const [_applications, setApplications] = useState<Application[]>([])
  // const [selectedApplication, setSelectedApplication] = useState<Application | null>(null)
  // const [_history, setHistory] = useState<ApplicationHistory[]>([])
  const [serviceOptions, setServiceOptions] = useState<ServiceOption[]>([])
  const [serviceFields, setServiceFields] = useState<ServiceField[]>([])
  const [serviceFieldForm, setServiceFieldForm] = useState(emptyServiceField)
  const [editingFieldId, setEditingFieldId] = useState<number | null>(null)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  const financeOverride = staffRole === 'Admin' ? undefined : overrides?.Finance
  const scheduleOverride = staffRole === 'Admin' ? undefined : overrides?.MassSchedule
  const canViewFinanceRecords = financeOverride ? financeOverride.view : ['Admin', 'ParishPriest', 'Secretary', 'Bookkeeper'].includes(staffRole)
  const canManageSchedule = scheduleOverride ? scheduleOverride.edit : ['Admin', 'ParishPriest', 'Secretary', 'Staff'].includes(staffRole)
  const canCreateSchedule = scheduleOverride ? scheduleOverride.edit : ['Admin', 'ParishPriest', 'Secretary'].includes(staffRole)
  const canDeleteSchedule = scheduleOverride ? scheduleOverride.edit : ['Admin', 'ParishPriest', 'Secretary'].includes(staffRole)
  const canManageFinance = financeOverride ? financeOverride.edit : canViewFinanceRecords
  const canReviewFinance = financeOverride ? financeOverride.edit : ['Admin', 'ParishPriest', 'Secretary'].includes(staffRole)
  const canReconcileFinance = financeOverride ? financeOverride.edit : ['Admin', 'Bookkeeper'].includes(staffRole)
  const canManageBookingAvailability = overrides?.ServiceRequest ? overrides.ServiceRequest.edit : ['Admin', 'ParishPriest', 'Secretary'].includes(staffRole)

  const showError = (reason: unknown) => setError(formatApiError(reason))
  const run = async (operation: () => Promise<void>) => {
    setError('')
    setMessage('')
    try { await operation() } catch (reason) { showError(reason) }
  }

  const loadStats = (year?: number) => run(async () => {
    const reportData = await apiClient.admin.statisticalReport(token, year || statsYear)
    setStatsReport(reportData)
  })

  const loadFinanceAudit = () => run(async () => {
    const historyItems = await apiClient.admin.financeReportHistory(token)
    setFinanceReportHistory(historyItems)
    if (canViewFinanceRecords) setFinanceAudit(await apiClient.admin.financeAudit(token))
  })

  const loadServiceFields = () => run(async () => {
    const [fields, services] = await Promise.all([
      apiClient.admin.serviceFields(token),
      fetch(`${API_BASE_URL}/api/services`).then(response => response.json()),
    ])
    setServiceFields(fields)
    setServiceOptions(services.map((s: { id: number; name: string }) => ({ id: s.id, name: s.name })))
  })

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!token) return
      if (tab === 'schedule') void run(async () => setSchedules(await apiClient.admin.operationSchedule(token)))
      if (tab === 'intentions') void run(async () => setIntentions(await apiClient.admin.massIntentions(token)))
      if (tab === 'finance') void run(async () => {
        const [nextReport, nextHistory] = await Promise.all([
          apiClient.admin.financeReport(token),
          apiClient.admin.financeReportHistory(token),
        ])
        setReport(nextReport)
        setFinanceReportHistory(nextHistory)
        if (canViewFinanceRecords) {
          const [nextFinance, nextAudit] = await Promise.all([
            apiClient.admin.financeEntries(token),
            apiClient.admin.financeAudit(token),
          ])
          setFinance(nextFinance)
          setFinanceAudit(nextAudit)
        }
      })
      if (tab === 'stats') void loadStats()
      if (tab === 'service-fields') void loadServiceFields()
    }, 0)
    return () => window.clearTimeout(timer)
  // The loaders are intentionally scoped to this tab and token effect.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tab])

  const saveSchedule = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    run(async () => {
      if (editingSchedule) await apiClient.admin.updateSchedule(editingSchedule, scheduleForm, token)
      else await apiClient.admin.createSchedule(scheduleForm, token)
      setScheduleForm(emptySchedule)
      setEditingSchedule(null)
      setMessage('Schedule saved.')
      setSchedules(await apiClient.admin.operationSchedule(token))
    })
  }

  const saveIntention = (event: React.FormEvent) => {
    event.preventDefault()
    run(async () => {
      await apiClient.admin.createMassIntention(intentionForm, token)
      setIntentionForm({ date: '', time: '', offering: '0', requestedBy: '', intentionText: '' })
      setMessage('Mass intention saved.')
      setIntentions(await apiClient.admin.massIntentions(token))
    })
  }

  const reportFilters = () => ({ start: reportStart || undefined, end: reportEnd || undefined, type: reportType || undefined })

  const saveFinance = (event: React.FormEvent) => {
    event.preventDefault()
    run(async () => {
      if (editingFinanceId) {
        await apiClient.admin.updateFinanceEntry(editingFinanceId, financeForm, token)
        setEditingFinanceId(null)
        setMessage('Financial entry updated and returned to the correct workflow state.')
      } else {
        await apiClient.admin.createFinanceEntry(financeForm, token)
        setMessage('Financial entry saved.')
      }
      setFinanceForm({ date: '', entryType: 'StoleFee', description: '', amount: '' })
      setFinance(await apiClient.admin.financeEntries(token))
      setReport(await apiClient.admin.financeReport(token, reportFilters()))
    })
  }

  const editFinance = (entry: FinanceEntry) => {
    setEditingFinanceId(entry.FinancialEntryId)
    setFinanceForm({ date: String(entry.EntryDate).slice(0, 10), entryType: entry.EntryType, description: entry.Description, amount: String(entry.Amount) })
  }

  const submitFinance = (id: number) => run(async () => {
    await apiClient.admin.submitFinanceEntry(id, token)
    setMessage('Financial entry submitted for approval.')
    setFinance(await apiClient.admin.financeEntries(token))
  })

  const rejectFinance = (id: number) => run(async () => {
    await apiClient.admin.rejectFinanceEntry(id, token)
    setMessage('Financial entry rejected.')
    setFinance(await apiClient.admin.financeEntries(token))
  })

  const deleteFinance = (id: number) => run(async () => {
    if (!window.confirm('Delete this draft entry? This cannot be undone.')) return
    await apiClient.admin.deleteFinanceEntry(id, token)
    setMessage('Draft entry deleted.')
    setFinance(await apiClient.admin.financeEntries(token))
  })

  const deleteSchedule = (id: number) => run(async () => {
    if (!window.confirm('Delete this schedule entry?')) return
    await apiClient.admin.deleteSchedule(id, token)
    setMessage('Schedule deleted.')
    setSchedules(await apiClient.admin.operationSchedule(token))
  })

  const cancelIntention = (id: number) => run(async () => {
    await apiClient.admin.updateMassIntention(id, 'Cancelled', token)
    setMessage('Mass intention cancelled; the slot is released.')
    setIntentions(await apiClient.admin.massIntentions(token))
  })

  const exportFinanceCsv = () => run(async () => {
    const params = new URLSearchParams({ format: 'csv' })
    if (reportStart) params.set('start', reportStart)
    if (reportEnd) params.set('end', reportEnd)
    if (reportType) params.set('type', reportType)
    const response = await fetch(`${API_BASE_URL}/api/admin/operations/finance/report?${params.toString()}`, { headers: { 'x-admin-token': token } })
    if (!response.ok) throw new Error('Unable to export finance report')
    const blob = await response.blob()
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'finance-report.csv'
    link.click()
    URL.revokeObjectURL(link.href)
    setMessage('Finance report exported as CSV.')
  })

  const approveFinance = (id: number) => run(async () => {
    await apiClient.admin.approveFinanceEntry(id, token)
    setMessage('Financial entry approved.')
    setFinance(await apiClient.admin.financeEntries(token))
  })

  const reconcileFinance = (id: number) => run(async () => {
    await apiClient.admin.reconcileFinanceEntry(id, token)
    setMessage('Financial entry reconciled.')
    setFinance(await apiClient.admin.financeEntries(token))
    setReport(await apiClient.admin.financeReport(token))
  })

  /*
  const _selectApplication = (application: Application) => run(async () => {
    setSelectedApplication(application)
    setHistory(await apiClient.admin.applicationHistory(application.id, token))
  })

  const _updateApplication = (event: React.FormEvent) => {
    event.preventDefault()
    if (!selectedApplication) return
    run(async () => {
      await apiClient.admin.updateApplication(selectedApplication.id, selectedApplication, token)
      setMessage('Application updated and change logged.')
      setApplications(await apiClient.serviceRequests.list(token))
      setHistory(await apiClient.admin.applicationHistory(selectedApplication.id, token))
    })
  }
  */

  const saveServiceField = (event: React.FormEvent) => {
    event.preventDefault()
    run(async () => {
      const payload = {
        serviceId: Number(serviceFieldForm.serviceId),
        key: serviceFieldForm.key.trim(),
        label: serviceFieldForm.label.trim(),
        type: serviceFieldForm.type,
        required: serviceFieldForm.required,
        sortOrder: Number(serviceFieldForm.sortOrder) || 0,
      }
      if (editingFieldId) {
        await apiClient.admin.updateServiceField(editingFieldId, { ...payload, active: true }, token)
        setMessage('Field updated.')
      } else {
        await apiClient.admin.createServiceField(payload, token)
        setMessage('Field added.')
      }
      setServiceFieldForm(emptyServiceField)
      setEditingFieldId(null)
      await loadServiceFields()
    })
  }

  const editServiceField = (field: ServiceField) => {
    setEditingFieldId(field.id)
    setServiceFieldForm({ serviceId: String(field.serviceId), key: field.key, label: field.label, type: field.type, required: field.required, sortOrder: field.sortOrder })
  }

  const toggleServiceFieldActive = (field: ServiceField) => run(async () => {
    await apiClient.admin.updateServiceField(field.id, { label: field.label, type: field.type, required: field.required, sortOrder: field.sortOrder, active: !field.active }, token)
    setMessage(field.active ? 'Field hidden from the booking form.' : 'Field re-enabled.')
    await loadServiceFields()
  })

  const deleteServiceField = (id: number) => run(async () => {
    if (!window.confirm('Delete this field permanently? Past bookings already saved it, so this only affects future submissions.')) return
    await apiClient.admin.deleteServiceField(id, token)
    setMessage('Field deleted.')
    await loadServiceFields()
  })

  const getBarWidth = (value: number | undefined, maxValue: number) => {
    const amount = Number(value ?? 0)
    if (!maxValue || amount <= 0) return 12
    return Math.max(12, (amount / maxValue) * 100)
  }

  const marriageBreakdown = [
    { label: 'Under 25', value: statsReport?.demographics?.marriages?.Under25 ?? 0 },
    { label: 'Age 25 - 35', value: statsReport?.demographics?.marriages?.Age25To35 ?? 0 },
    { label: 'Over 35', value: statsReport?.demographics?.marriages?.Over35 ?? 0 },
  ]
  const deceasedBreakdown = [
    { label: 'Under 18', value: statsReport?.demographics?.deaths?.Under18 ?? 0 },
    { label: 'Age 18 - 59', value: statsReport?.demographics?.deaths?.Age18To59 ?? 0 },
    { label: 'Senior 60+', value: statsReport?.demographics?.deaths?.Senior60Plus ?? 0 },
  ]
  const marriageMax = Math.max(1, ...marriageBreakdown.map(item => item.value))
  const deceasedMax = Math.max(1, ...deceasedBreakdown.map(item => item.value))

  if (!token) {
    return <section className="operations-page container py-5"><h1>Administrative Operations</h1><p>Enter an authorized staff token to continue.</p><input className="form-control mb-3" value={token} onChange={event => setToken(event.target.value)} placeholder="Staff token" /><button className="btn btn-dark" onClick={() => window.localStorage.setItem('adminToken', token)}>Continue</button></section>
  }

  return <section className={`operations-page container-fluid py-4 ${embedded ? 'admin-embedded-page' : ''}`}>
    {!embedded && <div className="operations-heading"><div><p className="eyebrow">Staff workspace</p><h1>Administrative Operations</h1></div></div>}
    {!embedded && <nav className="operations-tabs nav nav-tabs mb-4" aria-label="Administrative operations">
      {([['schedule', 'Service schedule'], ['intentions', 'Mass intentions'], ['availability', 'Booking availability'], ['finance', 'Finance and reports'], ['stats', 'Statistical & Demographic Reports'], ['service-fields', 'Booking form fields']] as const).map(([value, label]) => <button key={value} className={`nav-link ${tab === value ? 'active' : ''}`} onClick={() => setTab(value)}>{label}</button>)}
    </nav>}
    <AdminFeedback message={message} error={error} onDismiss={() => { setMessage(''); setError('') }} />

    {tab === 'schedule' && <div className="operations-grid">
      {(canCreateSchedule || editingSchedule !== null) && <form className="operations-form" onSubmit={saveSchedule}>
        <h2>{editingSchedule ? 'Edit schedule' : 'New schedule'}</h2>
        <label>Title<input required value={scheduleForm.title} onChange={event => setScheduleForm({ ...scheduleForm, title: event.target.value })} /></label>
        <label>Date<input required type="date" value={scheduleForm.date} onChange={event => setScheduleForm({ ...scheduleForm, date: event.target.value })} /></label>
        <label>Time<input required type="time" value={scheduleForm.time} onChange={event => setScheduleForm({ ...scheduleForm, time: event.target.value })} /></label>
        <label>Location<input required value={scheduleForm.location} onChange={event => setScheduleForm({ ...scheduleForm, location: event.target.value })} /></label>
        <label>Priest / minister<input required value={scheduleForm.priestUsername} onChange={event => setScheduleForm({ ...scheduleForm, priestUsername: event.target.value })} /></label>
        <label>Notes<textarea value={scheduleForm.notes} onChange={event => setScheduleForm({ ...scheduleForm, notes: event.target.value })} /></label>
        <button type="submit">{editingSchedule ? 'Save changes' : 'Add schedule'}</button>
        {editingSchedule !== null && <button type="button" onClick={() => { setEditingSchedule(null); setScheduleForm(emptySchedule) }}>Cancel edit</button>}
      </form>}
      <div className="operations-list schedule-list">
        <h2>{canManageSchedule ? 'Service schedules' : 'Schedule overview'}</h2>
        {schedules.map(item => <article key={item.id}>
          <div><strong>{item.title}</strong><span>{item.date} at {item.time} · {item.location}</span><small>{item.priestUsername} · {item.status}</small></div>
          <div className="schedule-actions">
            {canManageSchedule && <button type="button" onClick={() => { setEditingSchedule(item.id); setScheduleForm({ title: item.title, date: String(item.date).slice(0, 10), time: item.time, location: item.location, priestUsername: item.priestUsername, notes: item.notes || '', status: item.status }) }}>Edit</button>}
            {canDeleteSchedule && <button type="button" onClick={() => deleteSchedule(item.id)}>Delete</button>}
          </div>
        </article>)}
      </div>
    </div>}

    {tab === 'intentions' && <div className="operations-grid"><form className="operations-form" onSubmit={saveIntention}><h2>Record Mass intention</h2><label>Date<input required type="date" value={intentionForm.date} onChange={event => setIntentionForm({ ...intentionForm, date: event.target.value })} /></label><label>Time<input required type="time" value={intentionForm.time} onChange={event => setIntentionForm({ ...intentionForm, time: event.target.value })} /></label><label>Offering<input type="number" min="0" step="0.01" value={intentionForm.offering} onChange={event => setIntentionForm({ ...intentionForm, offering: event.target.value })} /></label><label>Requested by<input required value={intentionForm.requestedBy} onChange={event => setIntentionForm({ ...intentionForm, requestedBy: event.target.value })} /></label><label>Intention<textarea required value={intentionForm.intentionText} onChange={event => setIntentionForm({ ...intentionForm, intentionText: event.target.value })} /></label><button type="submit">Save intention</button></form><div className="operations-list"><h2>Mass intentions</h2>{intentions.map(item => <article key={item.MassIntentionId}><div><strong>{item.IntentionDate} at {item.IntentionTime}</strong><span>{item.IntentionText}</span><small>{item.RequestedBy} · Offering {item.Offering}</small></div><button type="button" onClick={() => cancelIntention(item.MassIntentionId)}>Cancel</button></article>)}</div></div>}

    {tab === 'availability' && <AdminBookingAvailabilityPage canEdit={canManageBookingAvailability} />}

    {tab === 'finance' && <>
      <div className="operations-grid">
        {canManageFinance && <form className="operations-form" onSubmit={saveFinance}>
          <p className="finance-eyebrow">{editingFinanceId ? 'Update record' : 'New record'}</p>
          <h2>{editingFinanceId ? 'Edit financial entry' : 'Record financial entry'}</h2>
          <p className="finance-card-description">Add parish income or expenses. New entries are saved as drafts until submitted.</p>
          <label>Date<input required type="date" value={financeForm.date} onChange={event => setFinanceForm({ ...financeForm, date: event.target.value })} /></label>
          <label>Type<select value={financeForm.entryType} onChange={event => setFinanceForm({ ...financeForm, entryType: event.target.value })}><option value="StoleFee">Stole fee</option><option value="MassOffering">Mass offering</option><option value="OtherIncome">Other income</option><option value="Expense">Expense</option></select></label>
          <label>Description<input required value={financeForm.description} onChange={event => setFinanceForm({ ...financeForm, description: event.target.value })} /></label>
          <label>Amount<input required type="number" min="0.01" step="0.01" value={financeForm.amount} onChange={event => setFinanceForm({ ...financeForm, amount: event.target.value })} /></label>
          <button className="accent" type="submit">{editingFinanceId ? 'Save changes' : 'Save draft'}</button>
          {editingFinanceId && <button type="button" onClick={() => { setEditingFinanceId(null); setFinanceForm({ date: '', entryType: 'StoleFee', description: '', amount: '' }) }}>Cancel edit</button>}
        </form>}
        <div className="operations-list finance-summary-panel">
          <div className="finance-summary-heading">
            <div>
              <p className="finance-eyebrow">Reports</p>
              <h2>Finance summary</h2>
              <p className="finance-card-description">Review approved and reconciled entries, then export the filtered results.</p>
            </div>
            <button type="button" className="secondary" onClick={exportFinanceCsv}>Export CSV</button>
          </div>
          <div className="finance-report-filters">
            <label>From<input type="date" value={reportStart} onChange={event => setReportStart(event.target.value)} /></label>
            <label>To<input type="date" value={reportEnd} onChange={event => setReportEnd(event.target.value)} /></label>
            <label>Category<select value={reportType} onChange={event => setReportType(event.target.value)}><option value="">All</option><option value="StoleFee">Stole fee</option><option value="MassOffering">Mass offering</option><option value="Donation">Donation</option><option value="Rental">Rental</option><option value="OtherIncome">Other income</option><option value="Expense">Expense</option></select></label>
            <button type="button" onClick={() => run(async () => setReport(await apiClient.admin.financeReport(token, reportFilters())))}>Apply filters</button>
          </div>
          <div className="finance-category-grid" aria-live="polite">
            {report?.totals?.map(item => <article className="finance-category-card" key={item.EntryType}>
              <span>{item.EntryType.replace(/([A-Z])/g, ' $1').trim()}</span>
              <strong>{formatFinanceAmount(Number(item.Total))}</strong>
              <small>{item.EntryCount} approved or reconciled {item.EntryCount === 1 ? 'entry' : 'entries'}</small>
            </article>)}
            {report && report.totals?.length === 0 && <p className="finance-empty-state">No approved or reconciled entries match these filters.</p>}
          </div>
          {canViewFinanceRecords && <div className="finance-records">
            <div className="finance-section-heading">
              <div><h2>Recent entries</h2><p>Review each item and take the next available workflow action.</p></div>
              <span>{finance.length} {finance.length === 1 ? 'entry' : 'entries'}</span>
            </div>
            {finance.length === 0 && <p className="finance-empty-state">No financial entries have been recorded yet.</p>}
            {finance.map(item => <article key={item.FinancialEntryId}>
              <div className="finance-entry-details">
                <strong>{item.Description}</strong>
                <span>{String(item.EntryDate).slice(0, 10)} · {item.EntryType.replace(/([A-Z])/g, ' $1').trim()} · {item.EnteredBy}</span>
                <span className="finance-entry-status" data-status={item.Status || 'Legacy'}>{item.Status || 'Legacy'}</span>
              </div>
              <div className="finance-entry-actions">
                <strong className="finance-entry-amount">{formatFinanceAmount(Number(item.Amount))}</strong>
                {['Draft', 'Rejected'].includes(item.Status || 'Draft') && <button type="button" onClick={() => editFinance(item)}>Edit</button>}
                {['Draft', 'Rejected'].includes(item.Status || 'Draft') && canReconcileFinance && <button type="button" onClick={() => submitFinance(item.FinancialEntryId)}>Submit</button>}
                {item.Status === 'Draft' && <button type="button" onClick={() => deleteFinance(item.FinancialEntryId)}>Delete</button>}
                {item.Status === 'Submitted' && canReviewFinance && <button type="button" onClick={() => approveFinance(item.FinancialEntryId)}>Approve</button>}
                {item.Status === 'Submitted' && canReviewFinance && <button type="button" onClick={() => rejectFinance(item.FinancialEntryId)}>Reject</button>}
                {item.Status === 'Approved' && canReconcileFinance && <button type="button" onClick={() => reconcileFinance(item.FinancialEntryId)}>Reconcile</button>}
              </div>
            </article>)}
          </div>}
        </div>
      </div>
      <div className="finance-history-grid">
      {canViewFinanceRecords && <div className="operations-list finance-audit-panel">
        <div className="finance-section-heading">
          <div><h2>Finance audit history</h2><p>A record of changes made to financial entries.</p></div>
          <button type="button" className="secondary" onClick={loadFinanceAudit}>Refresh</button>
        </div>
        {financeAudit.length === 0 ? <p className="finance-empty-state">No finance audit entries found.</p> : financeAudit.map(item => <article key={item.AuditId}><div><strong>{item.ActionName} · Entry #{item.FinancialEntryId}</strong><span>{item.EntryType.replace(/([A-Z])/g, ' $1').trim()} · {item.Description}</span><small>{item.ChangedBy} · {new Date(item.ChangedAt).toLocaleString()} · {item.Details}</small></div></article>)}
      </div>}
      <div className="operations-list finance-audit-panel">
        <div className="finance-section-heading">
          <div><h2>Generated finance reports</h2><p>Previously generated report snapshots.</p></div>
          <button type="button" className="secondary" onClick={loadFinanceAudit}>Refresh</button>
        </div>
        {financeReportHistory.length === 0 ? <p className="finance-empty-state">No scheduled reports have been generated yet.</p> : financeReportHistory.map(item => <article key={item.FinanceReportSnapshotId}><div><strong>{item.ReportType} report · {String(item.PeriodStart).slice(0, 10)} to {String(item.PeriodEnd).slice(0, 10)}</strong><span>Income {formatFinanceAmount(Number(item.TotalIncome))} · Expenses {formatFinanceAmount(Number(item.TotalExpenses))} · Net {formatFinanceAmount(Number(item.NetTotal))}</span><small>Generated {new Date(item.GeneratedAt).toLocaleString()} by {item.GeneratedBy}</small></div></article>)}
      </div>
      </div>
    </>}



    {tab === 'stats' && (
      <div className="stats-container">
        <div className="list-heading">
          <div>
            <h2>Sacramental & Demographic Analytics</h2>
            <p style={{ margin: 0, color: '#64675f' }}>Annual sacramental rates, demographic breakdowns, and monthly trends.</p>
          </div>
          <div style={{ display: 'flex', gap: '.5rem', alignItems: 'center' }}>
            <label style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '.5rem' }}>
              Year:
              <input
                type="number"
                value={statsYear}
                onChange={e => setStatsYear(Number(e.target.value))}
                style={{ width: '90px', padding: '.4rem' }}
              />
            </label>
            <button type="button" onClick={() => loadStats(statsYear)}>Generate Report</button>
          </div>
        </div>

        {statsReport && (
          <>
            <div className="stats-cards">
              <div className="stat-card">
                <h3>Total Baptisms</h3>
                <div className="stat-number">{statsReport.summary?.totalBaptisms || 0}</div>
                <p>Infants: {statsReport.demographics?.baptisms?.InfantsUnder1Yr || 0} | Children: {statsReport.demographics?.baptisms?.ChildrenOver1Yr || 0}</p>
              </div>
              <div className="stat-card">
                <h3>Total Confirmations</h3>
                <div className="stat-number">{statsReport.summary?.totalConfirmations || 0}</div>
                <p>Sacramental confirmations to date</p>
              </div>
              <div className="stat-card">
                <h3>Total Marriages</h3>
                <div className="stat-number">{statsReport.summary?.totalMarriages || 0}</div>
                <p>Avg Groom Age: {Math.round(statsReport.demographics?.marriages?.AvgGroomAge || 0)} | Bride: {Math.round(statsReport.demographics?.marriages?.AvgBrideAge || 0)}</p>
              </div>
              <div className="stat-card">
                <h3>Total Funeral/Deaths</h3>
                <div className="stat-number">{statsReport.summary?.totalDeaths || 0}</div>
                <p>Deceased Avg Age: {Math.round(statsReport.demographics?.deaths?.AvgDeceasedAge || 0)} yrs</p>
              </div>
            </div>

            <div className="stats-grid-2">
              <div className="stats-box">
                <h2>Monthly Sacramental Trend ({statsReport.targetYear})</h2>
                <table className="stats-table">
                  <thead>
                    <tr>
                      <th>Month</th>
                      <th>Baptisms</th>
                      <th>Confirmations</th>
                      <th>Marriages</th>
                      <th>Deaths</th>
                    </tr>
                  </thead>
                  <tbody>
                    {statsReport.monthlyBreakdown?.map((m: any) => (
                      <tr key={m.month}>
                        <td><strong>{m.monthName}</strong></td>
                        <td>{m.baptisms}</td>
                        <td>{m.confirmations}</td>
                        <td>{m.marriages}</td>
                        <td>{m.deaths}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="stats-box">
                <h2>Demographic Analytics</h2>
                <div style={{ display: 'grid', gap: '1.25rem' }}>
                  <div>
                    <h3 style={{ margin: '0 0 .5rem', fontSize: '.95rem' }}>Marriage Age Distribution</h3>
                    <div style={{ display: 'grid', gap: '.4rem' }}>
                      {marriageBreakdown.map((item) => (
                        <div key={item.label} className="chart-bar-container">
                          <span style={{ width: '100px', fontSize: '.85rem' }}>{item.label}</span>
                          <div className="chart-bar-bg">
                            <div className="chart-bar-fill" style={{ width: `${getBarWidth(item.value, marriageMax)}%` }}></div>
                          </div>
                          <span className="chart-bar-val">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 style={{ margin: '0 0 .5rem', fontSize: '.95rem' }}>Deceased Age Demographics</h3>
                    <div style={{ display: 'grid', gap: '.4rem' }}>
                      {deceasedBreakdown.map((item) => (
                        <div key={item.label} className="chart-bar-container">
                          <span style={{ width: '100px', fontSize: '.85rem' }}>{item.label}</span>
                          <div className="chart-bar-bg">
                            <div className="chart-bar-fill" style={{ width: `${getBarWidth(item.value, deceasedMax)}%` }}></div>
                          </div>
                          <span className="chart-bar-val">{item.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    )}

    {tab === 'service-fields' && <div className="operations-grid">
      <form className="operations-form" onSubmit={saveServiceField}>
        <h2>{editingFieldId ? 'Edit field' : 'New booking field'}</h2>
        <label>Sacrament<select required disabled={!!editingFieldId} value={serviceFieldForm.serviceId} onChange={event => setServiceFieldForm({ ...serviceFieldForm, serviceId: event.target.value })}>
          <option value="">Select a sacrament…</option>
          {serviceOptions.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
        </select></label>
        <label>Field key <small>(no spaces, used internally)</small><input required disabled={!!editingFieldId} value={serviceFieldForm.key} onChange={event => setServiceFieldForm({ ...serviceFieldForm, key: event.target.value.replace(/\s+/g, '') })} placeholder="e.g. childFirstName" /></label>
        <label>Label shown to parishioners<input required value={serviceFieldForm.label} onChange={event => setServiceFieldForm({ ...serviceFieldForm, label: event.target.value })} placeholder="e.g. Child first name" /></label>
        <label>Field type<select value={serviceFieldForm.type} onChange={event => setServiceFieldForm({ ...serviceFieldForm, type: event.target.value })}>
          <option value="text">Text</option>
          <option value="textarea">Text area</option>
          <option value="date">Date</option>
          <option value="number">Number</option>
        </select></label>
        <label>Sort order<input type="number" value={serviceFieldForm.sortOrder} onChange={event => setServiceFieldForm({ ...serviceFieldForm, sortOrder: Number(event.target.value) })} /></label>
        <label className="checkbox-label"><input type="checkbox" checked={serviceFieldForm.required} onChange={event => setServiceFieldForm({ ...serviceFieldForm, required: event.target.checked })} /> Required</label>
        <button type="submit">{editingFieldId ? 'Save changes' : 'Add field'}</button>
        {editingFieldId && <button type="button" onClick={() => { setEditingFieldId(null); setServiceFieldForm(emptyServiceField) }}>Cancel edit</button>}
      </form>
      <div className="operations-list scrollable">
        <h2>Sacrament booking fields</h2>
        {serviceOptions.map(service => {
          const fieldsForService = serviceFields.filter(f => f.serviceId === service.id)
          if (fieldsForService.length === 0) return null
          return <details key={service.id} style={{ margin: '.75rem 0' }}>
            <summary style={{ cursor: 'pointer', fontWeight: 600, fontSize: '1.1rem', padding: '.5rem 0' }}>{service.name} <small>({fieldsForService.length} fields)</small></summary>
            {fieldsForService.map(field => <article key={field.id} style={{ opacity: field.active ? 1 : 0.5 }}>
              <div><strong>{field.label}</strong><span> · {field.type}{field.required ? ' · required' : ''}</span><small>key: {field.key} · order {field.sortOrder} · {field.active ? 'visible' : 'hidden'}</small></div>
              <button type="button" onClick={() => editServiceField(field)}>Edit</button>
              <button type="button" onClick={() => toggleServiceFieldActive(field)}>{field.active ? 'Hide' : 'Show'}</button>
              <button type="button" onClick={() => deleteServiceField(field.id)}>Delete</button>
            </article>)}
          </details>
        })}
      </div>
    </div>}
  </section>
}
