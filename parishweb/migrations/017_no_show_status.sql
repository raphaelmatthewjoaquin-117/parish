/* Use a dedicated status for appointments voided because the applicant did not appear. */

UPDATE dbo.ServiceRequest
SET Status = 'VoidedNoShow'
WHERE Status = 'Voided'
  AND AttendanceStatus = 'NoShow';

PRINT 'No-show status migration completed successfully.';