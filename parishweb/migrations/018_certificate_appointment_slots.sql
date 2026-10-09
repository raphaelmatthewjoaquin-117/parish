/* Prevent multiple active certificate appointments from occupying one slot. */

IF OBJECT_ID(N'dbo.trg_CertificateRequests_ActiveSlot', N'TR') IS NOT NULL
    DROP TRIGGER dbo.trg_CertificateRequests_ActiveSlot;

EXEC sys.sp_executesql N'
    CREATE TRIGGER dbo.trg_CertificateRequests_ActiveSlot
    ON dbo.CertificateRequests
    AFTER INSERT, UPDATE
    AS
    BEGIN
        SET NOCOUNT ON;
        IF EXISTS (
            SELECT 1
            FROM inserted i
            INNER JOIN dbo.CertificateRequests existing
                ON existing.CertificateRequestId <> i.CertificateRequestId
               AND existing.PreferredDate = i.PreferredDate
               AND existing.PreferredTime = i.PreferredTime
               AND existing.Status IN (''Confirmed'', ''ReadyForClaim'', ''Claimed'')
            WHERE i.Status IN (''Confirmed'', ''ReadyForClaim'', ''Claimed'')
        )
        BEGIN
            ROLLBACK TRANSACTION;
            THROW 51001, ''Certificate appointment slot is already confirmed.'', 1;
        END;
    END;';

PRINT 'Certificate appointment slot protection migration completed successfully.';