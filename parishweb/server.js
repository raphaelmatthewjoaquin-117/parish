import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import sql from 'mssql';

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

const dbAuth = (process.env.DB_AUTH || '').toLowerCase();
console.log('DB startup config:', {
  authMode: dbAuth || '(default)',
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'ParishDB',
  user: process.env.DB_USER ? process.env.DB_USER : '(none)'
});

// Build config depending on authentication mode.
// DB_AUTH: 'sql' for SQL Server authentication (user/password),
// 'ntlm' for Windows NTLM with explicit credentials,
// empty/default => integrated authentication (when using msnodesqlv8 driver).
const baseConfig = {
  server: process.env.DB_SERVER || 'localhost',
  database: process.env.DB_NAME || 'ParishDB',
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
  port: Number(process.env.DB_PORT || 1433),
};

let config = { ...baseConfig };

if (dbAuth === 'sql') {
  // SQL authentication using username/password
  config = {
    ...baseConfig,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
  };
} else if (dbAuth === 'ntlm') {
  // Explicit Windows credentials over NTLM
  config = {
    ...baseConfig,
    authentication: {
      type: 'ntlm',
      options: {
        domain: process.env.DB_DOMAIN || '',
        userName: process.env.DB_USER,
        password: process.env.DB_PASSWORD,
      },
    },
  };
} else {
  // Leave config as baseConfig; for integrated auth you should use msnodesqlv8 driver
  config = baseConfig;
}

const verificationMap = new Map();
const adminSecret = process.env.ADMIN_TOKEN || 'letmein';

function randomToken(length = 32) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  return Array.from({ length }, () => chars[Math.floor(Math.random() * chars.length)]).join('');
}

function formatTime(date) {
  return date.toISOString().slice(11, 16);
}

function requireAdmin(req, res, next) {
  const token = String(req.headers['x-admin-token'] ?? '')
  if (!token || token !== adminSecret) {
    return res.status(403).json({ message: 'Admin token is required.' })
  }
  next()
}

function formatEventDate(value) {
  if (!value) return null;
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  const text = String(value);
  const parsed = new Date(text);
  if (!Number.isNaN(parsed.valueOf())) return parsed.toISOString().slice(0, 10);
  return parsed.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

}

app.get('/api/services', async (req, res) => {
  try {
    await sql.connect(config);

    const result = await sql.query`
      SELECT ServiceId, Name, Description
      FROM dbo.Service
      ORDER BY Name
    `;

    const services = result.recordset.map(row => ({
      id: row.ServiceId,
      name: row.Name,
      description: row.Description,
    }));

    res.json(services);
  } catch (error) {
    console.error('Database error:', error);
    res.status(500).json({
      message: 'Unable to load services from the database.',
      error: error instanceof Error ? error.message : String(error),
    });
  }
});

app.get('/api/services/:serviceId/slots', async (req, res) => {
  const { serviceId } = req.params;
  const date = req.query.date ? String(req.query.date) : null;
  const startDate = date ? new Date(date) : new Date();

  const slotTimes = ['09:00', '11:00', '14:00', '16:00'];
  const daysToShow = 5;
  const requestedDate = new Date(startDate);

  let bookedSet = new Set();
  const numericServiceId = Number(serviceId);
  const useServiceId = Number.isInteger(numericServiceId) && String(numericServiceId) === serviceId;

  try {
    if (useServiceId) {
      await sql.connect(config);

      const bookedResult = await sql.query`
        SELECT ScheduledDate, ScheduledTime
        FROM dbo.ServiceRequest
        WHERE ServiceId = ${numericServiceId}
          AND Status IN ('PendingVerification', 'Confirmed')
      `;

      bookedSet = new Set(bookedResult.recordset.map((row) => `${row.ScheduledDate.toISOString().slice(0,10)}|${row.ScheduledTime.slice(0,5)}`));
    }

    const slots = [];
    const slotDate = new Date(requestedDate);
    let weekdayCount = 0;
    while (weekdayCount < daysToShow) {
      const dayOfWeek = slotDate.getDay();
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        const isoDate = slotDate.toISOString().slice(0, 10);
        slotTimes.forEach(time => {
          const key = `${isoDate}|${time}`;
          slots.push({ date: isoDate, time, available: !bookedSet.has(key) });
        });
        weekdayCount += 1;
      }
      slotDate.setDate(slotDate.getDate() + 1);
    }

    res.json({ serviceId, slots });
  } catch (error) {
    console.error('Slot lookup error:', error);
    res.status(500).json({ message: 'Unable to load available slots.', error: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/api/service-requests', async (req, res) => {
  const { serviceId, firstName, lastName, email, mobileNumber, address, scheduledDate, scheduledTime, notes } = req.body;

  if (!serviceId || !firstName || !lastName || !email || !scheduledDate || !scheduledTime) {
    return res.status(400).json({ message: 'Missing required booking fields.' });
  }

  try {
    await sql.connect(config);

    const existingParishioner = await sql.query`
      SELECT ParishionerId
      FROM dbo.Parishioners
      WHERE EmailAddress = ${email}
      OR MobileNumber = ${mobileNumber}
    `;

    let parishionerId;
    if (existingParishioner.recordset.length > 0) {
      parishionerId = existingParishioner.recordset[0].ParishionerId;
      await sql.query`
        UPDATE dbo.Parishioners
        SET FirstName = ${firstName}, LastName = ${lastName}, Address = ${address}, EmailAddress = ${email}, MobileNumber = ${mobileNumber}
        WHERE ParishionerId = ${parishionerId}
      `;
    } else {
      const insertResult = await sql.query`
        INSERT INTO dbo.Parishioners (FirstName, LastName, EmailAddress, MobileNumber, Address, CreatedAt)
        OUTPUT INSERTED.ParishionerId
        VALUES (${firstName}, ${lastName}, ${email}, ${mobileNumber}, ${address}, GETDATE())
      `;
      parishionerId = insertResult.recordset[0].ParishionerId;
    }

    const insertRequest = await sql.query`
      INSERT INTO dbo.ServiceRequest
        (ParishionerId, ServiceId, RequestDate, ScheduledDate, ScheduledTime, Venue, Status, Notes, CreatedAt)
      OUTPUT INSERTED.ServiceRequestId
      VALUES
        (${parishionerId}, ${serviceId}, GETDATE(), ${scheduledDate}, ${scheduledTime}, N'', N'PendingVerification', ${notes || ''}, GETDATE())
    `;

    const requestId = insertRequest.recordset[0].ServiceRequestId;
    const token = randomToken(24);
    verificationMap.set(token, requestId);

    const verificationLink = `${req.protocol}://${req.get('host')}/api/service-requests/verify?token=${token}`;

    res.json({ requestId, status: 'PendingVerification', verificationLink });
  } catch (error) {
    console.error('Booking error:', error);
    res.status(500).json({ message: 'Unable to create booking.', error: error instanceof Error ? error.message : String(error) });
  }
});

app.get('/api/service-requests/verify', async (req, res) => {
  const token = String(req.query.token || '');
  const requestId = verificationMap.get(token);

  if (!requestId) {
    return res.status(400).json({ message: 'Invalid or expired verification token.' });
  }

  try {
    await sql.connect(config);
    await sql.query`
      UPDATE dbo.ServiceRequest
      SET Status = N'Confirmed'
      WHERE ServiceRequestId = ${requestId}
    `;
    verificationMap.delete(token);

    res.json({ message: 'Booking verified and confirmed.' });
  } catch (error) {
    console.error('Verification error:', error);
    res.status(500).json({ message: 'Unable to verify booking.', error: error instanceof Error ? error.message : String(error) });
  }
});

app.get('/api/events', async (req, res) => {
  try {
    await sql.connect(config);

    const result = await sql.query`SELECT * FROM dbo.Events ORDER BY EventDate`;

    const events = result.recordset
      .map((row, index) => {
        const id = row.EventId ?? row.Id ?? row.ID ?? row.id ?? `event-${index}`;
        const title = row.Title ?? row.Name ?? row.title ?? 'Untitled event';
        const detail = row.Body ?? row.body ?? row.Detail ?? row.detail ?? '';
        const dateValue = row.EventDate ?? row.Date ?? row.eventDate ?? row.date;
        const date = formatEventDate(dateValue);
        const time = String(row.EventTime ?? row.Time ?? row.eventTime ?? row.time ?? '').slice(0, 8);
        const location = row.Location ?? row.Venue ?? row.location ?? '';

        if (!date) return null;

        return {
          id: String(id),
          title: String(title),
          detail: String(detail),
          date,
          time,
          location: String(location),
        };
      })
      .filter(Boolean);

    res.json(events);
  } catch (error) {
    console.error('Events lookup error:', error);
    res.status(500).json({ message: 'Unable to load events.', error: error instanceof Error ? error.message : String(error) });
  }
});

app.post('/api/events', requireAdmin, async (req, res) => {
  const { title, detail, date, time, location } = req.body;
  if (!title || !date) {
    return res.status(400).json({ message: 'Title and date are required.' });
  }

  try {
    await sql.connect(config);
    const result = await sql.query`
      INSERT INTO dbo.Events (Title, Body, EventDate, EventTime, Location)
      OUTPUT INSERTED.EventId
      VALUES (${title}, ${detail || ''}, ${date}, ${time || ''}, ${location || ''})
    `;

    const eventId = result.recordset[0]?.EventId;
    res.status(201).json({ id: String(eventId), title, detail, date, time: time || '', location });
  } catch (error) {
    console.error('Create event error:', error);
    res.status(500).json({ message: 'Unable to create event.', error: error instanceof Error ? error.message : String(error) });
  }
});

app.put('/api/events/:eventId', requireAdmin, async (req, res) => {
  const { eventId } = req.params;
  const { title, detail, date, time, location } = req.body;

  if (!title || !date) {
    return res.status(400).json({ message: 'Title and date are required.' });
  }

  try {
    await sql.connect(config);
    await sql.query`
      UPDATE dbo.Events
      SET Title = ${title}, Body = ${detail || ''}, EventDate = ${date}, EventTime = ${time || ''}, Location = ${location || ''}
      WHERE EventId = ${eventId}
    `;

    res.json({ id: String(eventId), title, detail, date, time: time || '', location });
  } catch (error) {
    console.error('Update event error:', error);
    res.status(500).json({ message: 'Unable to update event.', error: error instanceof Error ? error.message : String(error) });
  }
});

app.delete('/api/events/:eventId', requireAdmin, async (req, res) => {
  const { eventId } = req.params;

  try {
    await sql.connect(config);
    await sql.query`
      DELETE FROM dbo.Events
      WHERE EventId = ${eventId}
    `;

    res.json({ success: true });
  } catch (error) {
    console.error('Delete event error:', error);
    res.status(500).json({ message: 'Unable to delete event.', error: error instanceof Error ? error.message : String(error) });
  }
});

app.get('/api/admin/verify', requireAdmin, (req, res) => {
  res.json({ ok: true })
})

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.listen(5000, () => {
  console.log('API running on http://localhost:5000');
})