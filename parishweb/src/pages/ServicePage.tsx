// ServicePage.tsx
import React, { useEffect, useState, useRef } from 'react';
import '../PagesCSS/ServicePage.css';



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
};

const WEEKDAYS = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

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
  { id: 'funeral', dbId: 4, name: 'Funeral Mass' },
  { id: 'house-blessing', dbId: 5, name: 'House Blessing' },
  { id: 'anointing', dbId: 6, name: 'Anointing' },
];

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000';

function getInitialTab(): string | number {
  if (typeof window === 'undefined') return FALLBACK_SERVICES[0].id;
  const hash = window.location.hash.replace('#', '');
  const found = FALLBACK_SERVICES.find(s => String(s.id) === hash);
  return found ? found.id : FALLBACK_SERVICES[0].id;
}

export default function ServicePage(): React.JSX.Element {
  const [active, setActive] = useState<string>(() => String(getInitialTab()));
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
  const tabsRef = useRef<(HTMLButtonElement | null)[]>([]);

  const selectedService = services.find(s => s.id === active) ?? FALLBACK_SERVICES[0];

  const loadServices = () => {
    fetch(`${API_URL}/api/services`)
      .then(response => response.ok ? response.json() : Promise.reject())
      .then((data: unknown) => {
        if (!Array.isArray(data)) return;

        const nextServices = data.reduce<Service[]>((servicesList, item) => {
          if (!item || typeof item !== 'object') return servicesList;
          const row = item as Record<string, unknown>;

          const rawId = row.id ?? row.serviceId;
          const dbId = typeof rawId === 'number' ? rawId : Number(rawId);
          const name = typeof row.name === 'string' ? row.name : undefined;
          const description = typeof row.description === 'string' ? row.description : undefined;

          if (!Number.isFinite(dbId) || dbId <= 0 || !name) return servicesList;

          const slug = name.toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
          servicesList.push({ id: slug, dbId, name, description });
          return servicesList;
        }, []);

        if (nextServices.length > 0) {
          setServices(nextServices);
          setServicesLoaded(true);
          if (!nextServices.some(s => s.id === active)) {
            setActive(nextServices[0].id);
          }
        } else {
          setServicesLoaded(false);
        }
      })
      .catch(() => {
        setServices(FALLBACK_SERVICES);
        setServicesLoaded(false);
      });
  };

  const loadSlots = (serviceSlug: string) => {
    setSlotsLoading(true);
    const service = services.find(s => s.id === serviceSlug);
    const dbId = service?.dbId;
    if (!dbId) {
      setSlots([]);
      setSlotsLoading(false);
      return;
    }
    fetch(`${API_URL}/api/services/${dbId}/slots`)
      .then(response => response.ok ? response.json() : Promise.reject())
      .then((data: unknown) => {
        if (!data || typeof data !== 'object' || !Array.isArray((data as any).slots)) {
          setSlots([]);
          setSelectedDate('');
          return;
        }

        const nextSlots = (data as any).slots as Slot[];
        setSlots(nextSlots);

        const uniqueDates = Array.from(new Set(nextSlots.map(slot => slot.date)));
        if (uniqueDates.length > 0) {
          setSelectedDate(prevDate => {
            if (prevDate && uniqueDates.includes(prevDate)) {
              return prevDate;
            }
            setCalendarMonth(() => {
              const firstDate = parseDateKey(uniqueDates[0]);
              return new Date(firstDate.getFullYear(), firstDate.getMonth(), 1);
            });
            return uniqueDates[0];
          });
        } else {
          setSelectedDate('');
        }
      })
      .catch(() => {
        setSlots([]);
        setSelectedDate('');
      })
      .finally(() => setSlotsLoading(false));
  };

  useEffect(() => {
    loadServices();
  }, []);

  useEffect(() => {
    setSelectedSlot('');
    setSelectedDate('');
    loadSlots(active);
  }, [active]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      if (window.location.hash.replace('#', '') !== active) {
        window.history.replaceState(null, '', `#${active}`);
      }
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

    if (e.key === 'ArrowRight') {
      const next = index === max ? 0 : index + 1;
      const node = tabsRef.current[next];
      if (node) node.focus();
      setActive(services[next].id);
    } else if (e.key === 'ArrowLeft') {
      const prev = index === 0 ? max : index - 1;
      const node = tabsRef.current[prev];
      if (node) node.focus();
      setActive(services[prev].id);
    } else if (e.key === 'Home') {
      const node = tabsRef.current[0];
      if (node) node.focus();
      setActive(services[0].id);
    } else if (e.key === 'End') {
      const node = tabsRef.current[max];
      if (node) node.focus();
      setActive(services[max].id);
    }
  };

  const submitBooking = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setBookingMessage(null);
    if (!servicesLoaded) {
      setBookingMessage('Unable to create booking: services not loaded. Please refresh the page.');
      return;
    }


    fetch(`${API_URL}/api/service-requests`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        serviceId: selectedService.dbId,
        firstName,
        lastName,
        email,
        mobileNumber,
        address,
        scheduledDate: selectedSlot.split(' ')[0],
        scheduledTime: selectedSlot.split(' ')[1],
        notes,
      }),
    })
      .then(response => response.json())
      .then((data: any) => {
        if (data.requestId) {
          setBookingMessage(`Booking created. Verify it by visiting: ${data.verificationLink}`);
        } else {
          setBookingMessage(data.message || 'Unable to book appointment.');
        }
      })
      .catch(() => {
        setBookingMessage('Unable to submit booking. Please try again later.');
      });
  };

  const calendarStart = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), 1);
  const calendarEnd = new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 0);
  const calendarDays = Array.from({ length: calendarStart.getDay() + calendarEnd.getDate() }, (_, index) => {
    const dayNumber = index - calendarStart.getDay() + 1;
    return dayNumber > 0 && dayNumber <= calendarEnd.getDate()
      ? new Date(calendarMonth.getFullYear(), calendarMonth.getMonth(), dayNumber)
      : null;
  });
  const slotsByDate = new Map<string, Slot[]>();
  slots.forEach(slot => {
    const dateSlots = slotsByDate.get(slot.date) ?? [];
    dateSlots.push(slot);
    slotsByDate.set(slot.date, dateSlots);
  });

  return (
    <div className="services-tabs">
      <div role="tablist" aria-label="Parish services" className="tablist">
        {services.map((s, i) => (
          <button
            key={s.id}
            ref={(el: HTMLButtonElement | null) => {
              tabsRef.current[i] = el;
            }}
            id={`tab-${s.id}`}
            role="tab"
            aria-selected={active === s.id}
            aria-controls={`panel-${s.id}`}
            tabIndex={active === s.id ? 0 : -1}
            className={`tab ${active === s.id ? 'active' : ''}`}
            onClick={() => setActive(s.id)}
            onKeyDown={e => onKeyDown(e, i)}
            type="button"
          >
            {s.name}
          </button>
        ))}
      </div>

      <div className="service-detail">
        <h2>{selectedService.name}</h2>
        <p>{selectedService.description || 'Choose a service and book an appointment.'}</p>
      </div>

      <div className="booking-grid">
        <section className="slot-list">
          <div className="slot-header">
            <h3>Date</h3>
            <div className="slot-legend">
              <span className="legend-item available">Available</span>
              <span className="legend-item fully-booked">Fully booked</span>
            </div>
          </div>

          <div className="date-picker">
            <div className="date-picker-nav">
              <button
                type="button"
                className="month-nav"
                aria-label="Previous month"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() - 1, 1))}
              >
                ‹
              </button>
              <strong>{calendarMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}</strong>
              <button
                type="button"
                className="month-nav"
                aria-label="Next month"
                onClick={() => setCalendarMonth(new Date(calendarMonth.getFullYear(), calendarMonth.getMonth() + 1, 1))}
              >
                »
              </button>
            </div>

            <div className="date-picker-weekdays">
              {WEEKDAYS.map(day => <span key={day}>{day}</span>)}
            </div>

            <div className="date-picker-days">
              {calendarDays.map((day, index) => {
                if (!day) return <span key={`empty-${index}`} className="date-picker-empty" />;

                const date = toDateKey(day);
                const dateSlots = slotsByDate.get(date) ?? [];
                const hasAvailability = dateSlots.some(slot => slot.available);
                const isWeekday = day.getDay() > 0 && day.getDay() < 6;

                return (
                  <button
                    key={date}
                    type="button"
                    disabled={slotsLoading || !isWeekday || !hasAvailability}
                    className={`date-picker-day ${hasAvailability ? 'available' : ''} ${dateSlots.length > 0 && !hasAvailability ? 'fully-booked' : ''} ${selectedDate === date ? 'selected' : ''}`}
                    onClick={() => {
                      setSelectedDate(date);
                      setSelectedSlot('');
                    }}
                  >
                    {day.getDate()}
                  </button>
                );
              })}
            </div>

            {slotsLoading && <p className="slot-status">Loading calendar...</p>}
            {!slotsLoading && slots.length === 0 && <p className="slot-status">No dates available right now.</p>}
          </div>

          {selectedDate && !slotsLoading && (
            <div className="time-slots">
              <p className="slot-status">Select a time on {new Date(selectedDate).toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' })}.</p>
              <div className="slots">
                {slots
                  .filter(slot => slot.date === selectedDate)
                  .map(slot => (
                    <button
                      key={`${slot.date}-${slot.time}`}
                      type="button"
                      disabled={!slot.available}
                      className={`slot ${slot.available ? 'available' : 'disabled'} ${selectedSlot === `${slot.date} ${slot.time}` ? 'selected' : ''}`}
                      onClick={() => setSelectedSlot(`${slot.date} ${slot.time}`)}
                    >
                      <span>{slot.time}</span>
                      <strong>{slot.available ? 'Choose this time' : 'No availability'}</strong>
                    </button>
                  ))}
              </div>
            </div>
          )}
        </section>

        <section className="booking-form">
          <h3>Book this service</h3>
          <form onSubmit={submitBooking}>
            <label>
              First name
              <input value={firstName} onChange={e => setFirstName(e.target.value)} required />
            </label>
            <label>
              Last name
              <input value={lastName} onChange={e => setLastName(e.target.value)} required />
            </label>
            <label>
              Email
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required />
            </label>
            <label>
              Phone
              <input value={mobileNumber} onChange={e => setMobileNumber(e.target.value)} required />
            </label>
            <label>
              Address
              <input value={address} onChange={e => setAddress(e.target.value)} />
            </label>
            <label>
              Notes
              <textarea value={notes} onChange={e => setNotes(e.target.value)} />
            </label>
            <div>
              <button type="submit" disabled={!selectedSlot || !servicesLoaded}>Book appointment</button>
            </div>
          </form>
          {bookingMessage && <div className="booking-message">{bookingMessage}</div>}
        </section>
      </div>
    </div>
  );
}