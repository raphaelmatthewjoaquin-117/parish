// ServicePage.tsx
import React, { useCallback, useEffect, useState, useRef } from 'react';
import '../PagesCSS/ServicePage.css';
import { API_BASE_URL as API_URL, apiClient } from '../api/client';

type Service = {
  id: string;
  dbId: number;
  name: string;
  description?: string;
};

type Slot = {
  date: string;
  time: string;
  available: boolean;
  restricted?: boolean;
  message?: string;
};

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

const CERT_TYPES = ['Baptism', 'Confirmation', 'Marriage', 'Death'] as const;

function toDateKey(date: Date): string {
  return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('-');
}

function parseDateKey(value: string): Date {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day);
}

const FALLBACK_SERVICES: Service[] = [
  { id: 'baptism', dbId: 1, name: 'Baptism' },
  { id: 'marriage', dbId: 2, name: 'Marriage' },
  { id: 'confirmation', dbId: 3, name: 'Confirmation' },
  { id: 'first-communion', dbId: 6, name: 'First Communion' },
  { id: 'funeral', dbId: 4, name: 'Funeral Mass' },
  { id: 'house-blessing', dbId: 5, name: 'House Blessing' },
  { id: 'certificate', dbId: 0, name: 'Certificate' },
];

function formatSlotRange(startTime: string): string {
  const [hours, minutes] = startTime.split(':').map(Number);
  const endHours = hours + 1;
  const format = (value: number) => {
    const period = value >= 12 ? 'PM' : 'AM';
    const hour = value % 12 || 12;
    return `${hour}:${minutes.toString().padStart(2, '0')} ${period}`;
  };
  return `${format(hours)} - ${format(endHours)}`;
}

function getInitialTab(): string {
  if (typeof window === 'undefined') return FALLBACK_SERVICES[0].id;
  const hash = window.location.hash.replace('#', '');
  const found = FALLBACK_SERVICES.find(s => s.id === hash);
  return found ? found.id : FALLBACK_SERVICES[0].id;
}

type CertConfirmation = { requestId: number; referenceCode: string };
type LookupResult = { certificateType: string; preferredDate: string; preferredTime: string; status: string; notes?: string };
type FieldDef = { key: string; label: string; type: string; options?: string[]; required: boolean };

export default function ServicePage(): React.JSX.Element {
  const [active, setActive] = useState<string>(() => getInitialTab());
  const [services, setServices] = useState<Service[]>(FALLBACK_SERVICES);
  const [servicesLoaded, setServicesLoaded] = useState(false);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [slotsLoading, setSlotsLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [calendarMonth, setCalendarMonth] = useState(() => {
    const today = new Date();
    return new Date(today.getFullYear(), today.getMonth(), 1);
  });
  const [selectedSlot, setSelectedSlot] = useState<string>('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [mobileNumber, setMobileNumber] = useState('');
  const [address, setAddress] = useState('');
  const [notes, setNotes] = useState('');
  const [bookingMessage, setBookingMessage] = useState<string | null>(null);
  const [restrictionMessage, setRestrictionMessage] = useState<string | null>(null);
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);

  // The booking widget picks its own sacrament via a dropdown; the tabs above are info-only previews.
  const [bookingServiceId, setBookingServiceId] = useState<string>('');
  const [fieldDefs, setFieldDefs] = useState<FieldDef[]>([]);
  const [fieldValues, setFieldValues] = useState<Record<string, string>>({});

  // Certificate-specific state
  const [certType, setCertType] = useState<string>('Baptism');
  const [certDate, setCertDate] = useState('');
  const [certTime, setCertTime] = useState('');
  const [certNotes, setCertNotes] = useState('');
  const [certFiles, setCertFiles] = useState<File[]>([]);
  const [certLoading, setCertLoading] = useState(false);
  const [certConfirmation, setCertConfirmation] = useState<CertConfirmation | null>(null);
  // Computed once at mount: the earliest selectable claiming date is tomorrow.
  const [minCertDate] = useState(() => new Date(Date.now() + 86400000).toISOString().slice(0, 10));
  const [certError, setCertError] = useState('');
  // Lookup state
  const [lookupOpen, setLookupOpen] = useState(false);
  const [lookupEmail, setLookupEmail] = useState('');
  const [lookupRef, setLookupRef] = useState('');
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupError, setLookupError] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);

  const isCertificateTab = active === 'certificate';
  const selectedService = services.find(s => s.id === active) ?? FALLBACK_SERVICES[0];
  const bookableServices = services.filter(s => s.id !== 'certificate');
  const bookingService = bookableServices.find(s => s.id === bookingServiceId);

  const loadServices = useCallback(() => {
    fetch(`${API_URL}/api/services`)
      .then(response => response.ok ? response.json() : Promise.reject())
      .then((data: unknown) => {
        if (!Array.isArray(data)) return;
        const nextServices = data.reduce<Service[]>((acc, item) => {
          if (!item || typeof item !== 'object') return acc;
          const row = item as Record<string, unknown>;
          const rawId = row.id ?? row.serviceId;
          const dbId = typeof rawId === 'number' ? rawId : Number(rawId);
          const name = typeof row.name === 'string' ? row.name : undefined;
          const description = typeof row.description === 'string' ? row.description : undefined;
          if (!Number.isFinite(dbId) || dbId <= 0 || !name) return acc;
          const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          acc.push({ id: slug, dbId, name, description });
          return acc;
        }, []);
        // Always keep the certificate tab at the end
        const withCert = [...nextServices, { id: 'certificate', dbId: 0, name: 'Certificate' }];
        if (nextServices.length > 0) {
          setServices(withCert);
          setServicesLoaded(true);
          if (!withCert.some(s => s.id === active)) setActive(withCert[0].id);
          setBookingServiceId(prev => (prev && nextServices.some(s => s.id === prev)) ? prev : nextServices[0].id);
        } else {
          setServicesLoaded(false);
        }
      })
      .catch(() => {
        setServices(FALLBACK_SERVICES);
        setServicesLoaded(false);
        setBookingServiceId(prev => prev || FALLBACK_SERVICES[0].id);
      });
  }, [active]);

  const loadSlots = useCallback((serviceSlug: string) => {
    if (serviceSlug === 'certificate') {
      setSlots([]);
      setSlotsLoading(false);
      return;
    }
    setSlotsLoading(true);
    setRestrictionMessage(null);
    const service = services.find(s => s.id === serviceSlug);
    const dbId = service?.dbId;
    if (!dbId) { setSlots([]); setSlotsLoading(false); return; }
    fetch(`${API_URL}/api/services/${dbId}/slots`)
      .then(response => response.ok ? response.json() : Promise.reject())
      .then((data: unknown) => {
        const raw = data as { slots?: unknown; restrictionMessage?: string } | null;
        if (!raw || !Array.isArray(raw.slots)) { setSlots([]); setSelectedDate(''); return; }
        const nextSlots = raw.slots as Slot[];
        setSlots(nextSlots);
        if (raw.restrictionMessage) setRestrictionMessage(raw.restrictionMessage);
        const uniqueDates = Array.from(new Set(nextSlots.map(s => s.date)));
        if (uniqueDates.length > 0) {
          setSelectedDate(prev => {
            if (prev && uniqueDates.includes(prev)) return prev;
            setCalendarMonth(() => {
              const first = parseDateKey(uniqueDates[0]);
              return new Date(first.getFullYear(), first.getMonth(), 1);
            });
            return uniqueDates[0];
          });
        } else {
          setSelectedDate('');
        }
      })
      .catch(() => { setSlots([]); setSelectedDate(''); })
      .finally(() => setSlotsLoading(false));
  }, [services]);

  useEffect(() => {
    const t = window.setTimeout(() => loadServices(), 0);
    return () => window.clearTimeout(t);
  }, [loadServices]);

  useEffect(() => {
    if (!bookingServiceId) return;
    const t = window.setTimeout(() => {
      setSelectedSlot('');
      setSelectedDate('');
      loadSlots(bookingServiceId);
    }, 0);
    return () => window.clearTimeout(t);
  }, [bookingServiceId, loadSlots]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      setFieldValues({});
      if (!bookingService?.dbId) { setFieldDefs([]); return; }
      fetch(`${API_URL}/api/services/${bookingService.dbId}/fields`)
        .then(response => response.ok ? response.json() : Promise.reject())
        .then((data: unknown) => {
          const raw = data as { fields?: FieldDef[] } | null;
          setFieldDefs(Array.isArray(raw?.fields) ? raw.fields : []);
        })
        .catch(() => setFieldDefs([]));
    }, 0);
    return () => window.clearTimeout(timer);
  }, [bookingService?.dbId]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.location.hash.replace('#', '') !== active) {
      window.history.replaceState(null, '', `#${active}`);
    }
  }, [active]);

  useEffect(() => {
    const onHashChange = () => {
      const id = window.location.hash.replace('#', '');
      if (id && services.some(s => s.id === id)) setActive(id);
    };
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
  }, [services]);

  const onKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>, index: number) => {
    const max = services.length - 1;
    if (e.key === 'ArrowRight') { const n = index === max ? 0 : index + 1; tabsRef.current[n]?.focus(); setActive(services[n].id); }
    else if (e.key === 'ArrowLeft') { const p = index === 0 ? max : index - 1; tabsRef.current[p]?.focus(); setActive(services[p].id); }
    else if (e.key === 'Home') { tabsRef.current[0]?.focus(); setActive(services[0].id); }
    else if (e.key === 'End') { tabsRef.current[max]?.focus(); setActive(services[max].id); }
  };

  const sanitizeText = (text: string): string => text.trim().slice(0, 500).replace(/[<>&"']/g, '');

  const submitBooking = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBookingMessage(null);
    if (!servicesLoaded) { setBookingMessage('Unable to create booking: services not loaded. Please refresh the page.'); return; }
    if (!bookingService) { setBookingMessage('Please choose a sacrament to book.'); return; }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) { setBookingMessage('Please provide a valid email address.'); return; }
    const phoneDigits = mobileNumber.replace(/\D/g, '');
    if (phoneDigits.length < 10 || phoneDigits.length > 15) { setBookingMessage('Please provide a valid phone number (10-15 digits).'); return; }
    if (!firstName.trim() || !lastName.trim()) { setBookingMessage('First and Last name are required.'); return; }
    if (notes && notes.length > 500) { setBookingMessage('Notes cannot exceed 500 characters.'); return; }
    const missingField = fieldDefs.find(f => f.required && !fieldValues[f.key]?.trim());
    if (missingField) { setBookingMessage(`Please fill in "${missingField.label}".`); return; }
    try {
      const response = await fetch(`${API_URL}/api/service-requests`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          serviceId: bookingService.dbId,
          firstName: sanitizeText(firstName),
          lastName: sanitizeText(lastName),
          email,
          mobileNumber,
          address: sanitizeText(address),
          scheduledDate: selectedSlot.split(' ')[0],
          scheduledTime: selectedSlot.split(' ')[1],
          notes: sanitizeText(notes),
          details: fieldValues,
        }),
      });
      const data = await response.json();
      if (data.requestId) setBookingMessage('Booking created.');
      else setBookingMessage(data.message || 'Unable to book appointment.');
    } catch {
      setBookingMessage('Unable to submit booking. Please try again later.');
    }
  };

  const submitCertificateRequest = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setCertError('');
    setCertLoading(true);
    try {
      const result = await apiClient.certificates.create({
        firstName: sanitizeText(firstName),
        lastName: sanitizeText(lastName),
        email,
        phone: mobileNumber,
        certificateType: certType,
        preferredDate: certDate,
        preferredTime: certTime,
        notes: certNotes ? sanitizeText(certNotes) : undefined,
      });
      if (certFiles.length > 0) {
        await apiClient.certificates.uploadDocuments(result.requestId, result.referenceCode, certFiles);
      }
      setCertConfirmation(result);
      // Reset form fields
      setFirstName(''); setLastName(''); setEmail(''); setMobileNumber('');
      setCertDate(''); setCertTime(''); setCertNotes(''); setCertFiles([]);
    } catch (reason) {
      setCertError(reason instanceof Error ? reason.message : 'Unable to submit certificate request. Please try again.');
    } finally {
      setCertLoading(false);
    }
  };

  const submitLookup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setLookupError('');
    setLookupResult(null);
    setLookupLoading(true);
    try {
      const result = await apiClient.certificates.lookup(lookupEmail, lookupRef);
      setLookupResult(result);
    } catch (reason) {
      setLookupError(reason instanceof Error ? reason.message : 'No matching request found. Check your email and reference code.');
    } finally {
      setLookupLoading(false);
    }
  };

  // Calendar helpers
  const calendarStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const calendarEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
  const calendarDays = Array.from({ length: calendarStart.getDay() + calendarEnd.getDate() }, (_, i) => {
    const d = i - calendarStart.getDay() + 1;
    return d > 0 && d <= calendarEnd.getDate() ? new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), d) : null;
  });
  const slotsByDate = new Map<string, Slot[]>();
  slots.forEach(slot => {
    const existing = slotsByDate.get(slot.date) ?? [];
    existing.push(slot);
    slotsByDate.set(slot.date, existing);
  });

  return (
    <div className="services-tabs container py-5">
      <div role="tablist" aria-label="Parish services" className="tablist nav nav-pills flex-wrap gap-2 mb-4">
        {services.map((s, i) => (
          <button
            key={s.id}
            ref={el => { tabsRef.current[i] = el; }}
            id={`tab-${s.id}`}
            role="tab"
            aria-selected={active === s.id}
            aria-controls={`panel-${s.id}`}
            tabIndex={active === s.id ? 0 : -1}
            className={`tab nav-link ${active === s.id ? 'active' : ''}`}
            onClick={() => setActive(s.id)}
            onKeyDown={e => onKeyDown(e, i)}
            type="button"
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="service-detail card border-0 shadow-sm p-4 mb-4">
        <h2>{isCertificateTab ? 'Certificate Request' : selectedService.name}</h2>
        <p>
          {isCertificateTab
            ? 'Request an appointment to claim an official certificate (Baptism, Confirmation, Marriage, or Death) from the parish office. No account needed — you\'ll receive a reference code to track your request.'
            : (selectedService.description || 'Choose a service and book an appointment.')}
        </p>
      </div>

      {restrictionMessage && !isCertificateTab && (
        <div className="restriction-message alert alert-warning" role="alert">{restrictionMessage}</div>
      )}

      {/* ── Certificate Tab ── */}
      {isCertificateTab ? (
        <div className="booking-grid booking-grid--certificate row g-4">
          {/* Left: info panel */}
          <section className="col-lg-7">
            <div className="cert-info card border-0 shadow-sm p-4 mb-4">
              <h3 className="mb-3">How it works</h3>
              <ol className="cert-steps">
                <li>Fill out the form with your contact details, the certificate type, and your preferred pick-up date and time.</li>
                <li>Attach any supporting documents if required (e.g., baptism record, marriage contract).</li>
                <li>Submit — you'll receive a <strong>reference code</strong> to track your request status.</li>
                <li>The parish office will review your request and confirm the appointment.</li>
              </ol>
              <p className="cert-note mt-3">Certificates are prepared by the parish office. This form reserves your claiming appointment only — it does not issue the certificate itself.</p>
            </div>

            {/* Status lookup */}
            <div className="cert-lookup card border-0 shadow-sm p-4">
              <button
                type="button"
                className="cert-lookup-toggle"
                onClick={() => { setLookupOpen(o => !o); setLookupResult(null); setLookupError(''); }}
                aria-expanded={lookupOpen}
              >
                <span>Check request status</span>
                <span className="cert-lookup-arrow">{lookupOpen ? '▲' : '▼'}</span>
              </button>
              {lookupOpen && (
                <form className="cert-lookup-form" onSubmit={submitLookup}>
                  <label>
                    Email address
                    <input className="form-control" type="email" required value={lookupEmail} onChange={e => setLookupEmail(e.target.value)} placeholder="you@example.com" />
                  </label>
                  <label>
                    Reference code
                    <input className="form-control" required value={lookupRef} onChange={e => setLookupRef(e.target.value.toUpperCase())} placeholder="e.g. A1B2C3" maxLength={10} style={{ textTransform: 'uppercase', letterSpacing: '0.1em' }} />
                  </label>
                  <button className="btn btn-dark" type="submit" disabled={lookupLoading}>{lookupLoading ? 'Looking up…' : 'Check status'}</button>
                  {lookupError && <p className="booking-message" style={{ background: 'rgba(180,60,40,0.1)', color: '#7a2a1a' }} role="alert">{lookupError}</p>}
                  {lookupResult && (
                    <div className="cert-lookup-result">
                      <p><strong>Type:</strong> {lookupResult.certificateType} certificate</p>
                      <p><strong>Preferred date:</strong> {String(lookupResult.preferredDate).slice(0, 10)} at {lookupResult.preferredTime}</p>
                      <p><strong>Status:</strong> <span className={`cert-status cert-status--${(lookupResult.status || '').toLowerCase()}`}>{lookupResult.status ?? 'Unknown'}</span></p>
                      {lookupResult.notes && <p><strong>Notes:</strong> {lookupResult.notes}</p>}
                    </div>
                  )}
                </form>
              )}
            </div>
          </section>

          {/* Right: request form or confirmation */}
          <section className="booking-form-row col-lg-5 card border-0 shadow-sm p-4">
            {certConfirmation ? (
              <div className="cert-confirmation">
                <div className="cert-confirmation-icon" aria-hidden="true">✓</div>
                <h3>Request submitted</h3>
                <p>Save your reference code — you'll need it to check your appointment status.</p>
                <div className="cert-refcode" aria-label="Reference code">
                  {certConfirmation.referenceCode}
                </div>
                <p className="cert-confirmation-note">The parish office will review your request and confirm your appointment schedule.</p>
                <button
                  type="button"
                  className="btn btn-dark mt-3"
                  onClick={() => setCertConfirmation(null)}
                >
                  Submit another request
                </button>
              </div>
            ) : (
              <>
                <h3>Request a certificate</h3>
                <form className="cert-form" onSubmit={submitCertificateRequest}>
                  <div className="form-row">
                    <label>
                      <span className="label-text">First name</span>
                      <div className="field-wrap">
                        <input className="form-control" required value={firstName} onChange={e => setFirstName(e.target.value)} placeholder="First name" />
                      </div>
                    </label>
                    <label>
                      <span className="label-text">Last name</span>
                      <div className="field-wrap">
                        <input className="form-control" required value={lastName} onChange={e => setLastName(e.target.value)} placeholder="Last name" />
                      </div>
                    </label>
                  </div>
                  <label>
                    <span className="label-text">Email</span>
                    <div className="field-wrap">
                      <input className="form-control" type="email" required value={email} onChange={e => setEmail(e.target.value)} placeholder="you@example.com" />
                    </div>
                  </label>
                  <label>
                    <span className="label-text">Phone</span>
                    <div className="field-wrap">
                      <input className="form-control" required value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} placeholder="09XX-XXX-XXXX" />
                    </div>
                  </label>
                  <label>
                    <span className="label-text">Certificate type</span>
                    <div className="field-wrap">
                      <select className="form-select" value={certType} onChange={e => setCertType(e.target.value)}>
                        {CERT_TYPES.map(t => <option key={t}>{t}</option>)}
                      </select>
                    </div>
                  </label>
                  <div className="form-row">
                    <label>
                      <span className="label-text">Preferred date</span>
                      <div className="field-wrap">
                        <input className="form-control" type="date" required value={certDate} min={minCertDate} onChange={e => setCertDate(e.target.value)} />
                      </div>
                    </label>
                    <label>
                      <span className="label-text">Preferred time</span>
                      <div className="field-wrap">
                        <input className="form-control" type="time" required value={certTime} onChange={e => setCertTime(e.target.value)} />
                      </div>
                    </label>
                  </div>
                  <label>
                    <span className="label-text">Supporting documents <span className="cert-optional">(optional)</span></span>
                    <div className="upload-field">
                      <label className={`upload-tile${certFiles.length > 0 ? ' upload-tile--ready' : ''}`} aria-label="Upload supporting documents">
                        <input
                          type="file"
                          accept="application/pdf,image/*"
                          multiple
                          onChange={e => setCertFiles(Array.from(e.target.files || []).slice(0, 5))}
                        />
                        <span className="upload-tile-icon" aria-hidden="true">{certFiles.length > 0 ? '✓' : '+'}</span>
                        <span className="upload-tile-name">
                          {certFiles.length > 0
                            ? certFiles.length === 1
                              ? certFiles[0].name
                              : `${certFiles.length} files selected`
                            : 'Choose files'}
                        </span>
                        {certFiles.length > 0 && (
                          <button
                            type="button"
                            className="upload-tile-clear"
                            aria-label="Clear selected files"
                            onClick={e => { e.preventDefault(); setCertFiles([]) }}
                          >✕</button>
                        )}
                      </label>
                    </div>
                    <small className="cert-file-hint">Up to 5 files — PDF or image, 10 MB each.</small>
                  </label>
                  <label>
                    <span className="label-text">Notes <span className="cert-optional">(optional)</span></span>
                    <div className="field-wrap">
                      <textarea className="form-control" value={certNotes} onChange={e => setCertNotes(e.target.value)} placeholder="Any additional information for the parish office" />
                    </div>
                  </label>
                  <div>
                    <button className="btn btn-dark" type="submit" disabled={certLoading}>
                      {certLoading ? 'Submitting…' : 'Submit request'}
                    </button>
                  </div>
                  {certError && <p className="booking-message" style={{ background: 'rgba(180,60,40,0.1)', color: '#7a2a1a' }} role="alert">{certError}</p>}
                </form>
              </>
            )}
          </section>
        </div>
      ) : (
        /* ── Normal service booking tab ── */
        <div className="booking-grid">

          {/* ── Row 1: Calendar + Time slots ── */}
          <div className="calendar-row">
            <div className="calendar-col">
              <div className="slot-header">
                <h3>Date</h3>
                <div className="slot-legend">
                  <span className="legend-item available">Available</span>
                  <span className="legend-item fully-booked">Fully booked</span>
                </div>
              </div>

              <div className="date-picker">
                <div className="date-picker-nav">
                  <button type="button" className="month-nav btn btn-outline-dark" aria-label="Previous month" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}>‹</button>
                  <strong>{calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong>
                  <button type="button" className="month-nav" aria-label="Next month" onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}>»</button>
                </div>
                <div className="date-picker-weekdays">{WEEKDAYS.map(d => <span key={d}>{d}</span>)}</div>
                <div className="date-picker-days">
                  {calendarDays.map((day, index) => {
                    if (!day) return <span key={`empty-${index}`} className="date-picker-empty" />;
                    const date = toDateKey(day);
                    const dateSlots = slotsByDate.get(date) ?? [];
                    const hasAvailability = dateSlots.some(s => s.available);
                    const isWeekday = day.getDay() > 0 && day.getDay() < 6;
                    const today = new Date(); today.setHours(0, 0, 0, 0);
                    const dayMid = new Date(day); dayMid.setHours(0, 0, 0, 0);
                    const isFuture = dayMid > today;
                    const isSelectable = isWeekday && isFuture && hasAvailability;
                    return (
                      <button
                        key={date}
                        type="button"
                        disabled={slotsLoading || !isSelectable}
                        className={`date-picker-day ${hasAvailability && isWeekday && isFuture ? 'available' : ''} ${dateSlots.length > 0 && !hasAvailability && isWeekday && isFuture ? 'fully-booked' : ''} ${selectedDate === date ? 'selected' : ''}`}
                        onClick={() => { setSelectedDate(date); setSelectedSlot(''); }}
                      >
                        {day.getDate()}
                      </button>
                    );
                  })}
                </div>
                {slotsLoading && <p className="slot-status">Loading calendar...</p>}
                {!slotsLoading && slots.length === 0 && <p className="slot-status">No dates available right now.</p>}
              </div>
            </div>

            <div className="timeslots-col">
              <h3 className="timeslots-heading">Time</h3>
              {!selectedDate && !slotsLoading && (
                <p className="slot-status slot-status--prompt">Select a date to see available times.</p>
              )}
              {slotsLoading && <p className="slot-status">Loading times...</p>}
              {selectedDate && !slotsLoading && (
                <>
                  <p className="slot-status">
                    {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}
                  </p>
                  <div className="slots slots--vertical">
                    {slots.filter(s => s.date === selectedDate).map(slot => (
                      <button
                        key={`${slot.date}-${slot.time}`}
                        type="button"
                        disabled={!slot.available}
                        className={`slot ${slot.available ? 'available' : 'disabled'} ${selectedSlot === `${slot.date} ${slot.time}` ? 'selected' : ''}`}
                        onClick={() => setSelectedSlot(`${slot.date} ${slot.time}`)}
                      >
                        <span>{formatSlotRange(slot.time)}</span>
                        <strong>{slot.available ? 'Choose this time' : 'No availability'}</strong>
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          </div>

          {/* ── Row 2: Booking form ── */}
          <div className="booking-form-row card border-0 shadow-sm p-4">
            <h3 className="booking-form-title">Book this service</h3>
            <form className="booking-form-body" onSubmit={submitBooking}>

              {/* Left column — general info */}
              <div className="booking-general">
                <label>
                  <span className="label-text">Sacrament</span>
                  <div className="field-wrap">
                    <select className="form-select" value={bookingServiceId} onChange={e => setBookingServiceId(e.target.value)} required>
                      {bookableServices.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                </label>

                <div className="form-row">
                  <label>
                    <span className="label-text">First name</span>
                    <div className="field-wrap">
                      <input className="form-control" value={firstName} placeholder="First name" onChange={e => setFirstName(e.target.value)} required />
                    </div>
                  </label>
                  <label>
                    <span className="label-text">Last name</span>
                    <div className="field-wrap">
                      <input className="form-control" value={lastName} placeholder="Last name" onChange={e => setLastName(e.target.value)} required />
                    </div>
                  </label>
                </div>

                <label>
                  <span className="label-text">Email</span>
                  <div className="field-wrap">
                    <input className="form-control" type="email" placeholder="you@example.com" value={email} onChange={e => setEmail(e.target.value)} required />
                  </div>
                </label>
                <label>
                  <span className="label-text">Phone</span>
                  <div className="field-wrap">
                    <input className="form-control" value={mobileNumber} placeholder="09XX-XXX-XXXX" onChange={e => setMobileNumber(e.target.value)} required />
                  </div>
                </label>
                <label>
                  <span className="label-text">Address <span className="cert-optional">(optional)</span></span>
                  <div className="field-wrap">
                    <input className="form-control" value={address} placeholder="Street, city" onChange={e => setAddress(e.target.value)} />
                  </div>
                </label>
              </div>

              {/* Right column — sacrament details + notes + submit */}
              <div className="booking-details">
                {fieldDefs.length > 0 ? (
                  <div className="sacrament-fields">
                    <h4>{bookingService?.name} details</h4>
                    {fieldDefs.map(field => (
                      <label key={field.key}>
                        <span className="label-text">{field.label}{field.required ? '' : <span className="cert-optional"> (optional)</span>}</span>
                        <div className="field-wrap">
                          {field.type === 'textarea' ? (
                            <textarea className="form-control" value={fieldValues[field.key] || ''} required={field.required} onChange={e => setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))} />
                          ) : field.type === 'select' ? (
                            <select className="form-select" value={fieldValues[field.key] || ''} required={field.required} onChange={e => setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))}>
                              <option value="">Select…</option>
                              {(field.options || []).map(opt => <option key={opt} value={opt}>{opt}</option>)}
                            </select>
                          ) : (
                            <input className="form-control" type={field.type === 'date' || field.type === 'number' ? field.type : 'text'} value={fieldValues[field.key] || ''} required={field.required} onChange={e => setFieldValues(prev => ({ ...prev, [field.key]: e.target.value }))} />
                          )}
                        </div>
                      </label>
                    ))}
                  </div>
                ) : (
                  <p className="sacrament-fields-empty">Select a sacrament to see its required details.</p>
                )}

                <label>
                  <span className="label-text">Notes <span className="cert-optional">(optional)</span></span>
                  <div className="field-wrap">
                    <textarea className="form-control" value={notes} placeholder="Any additional information" onChange={e => setNotes(e.target.value)} />
                  </div>
                </label>
                <div>
                  <button
                    className="btn btn-dark"
                    type="submit"
                    disabled={
                      !selectedSlot ||
                      !servicesLoaded ||
                      !firstName.trim() ||
                      !lastName.trim() ||
                      !email.trim() ||
                      !mobileNumber.trim() ||
                      fieldDefs.some(f => f.required && !fieldValues[f.key]?.trim())
                    }
                  >Book appointment</button>
                </div>
                {bookingMessage && <div className="booking-message">{bookingMessage}</div>}
              </div>

            </form>
          </div>

        </div>
      )}
    </div>
  );
}
