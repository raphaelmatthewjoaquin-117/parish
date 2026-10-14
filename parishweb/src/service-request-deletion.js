import sql from 'mssql'

export async function deleteServiceRequest(transaction, requestId) {
  let transactionStarted = false
  try {
    await transaction.begin()
    transactionStarted = true
    await transaction.request()
      .input('requestId', sql.Int, requestId)
      .query(`
        DELETE FROM dbo.VerificationTokens WHERE ServiceRequestId = @requestId;
        DELETE FROM dbo.BaptismRequestDetail WHERE ServiceRequestId = @requestId;
        DELETE FROM dbo.MarriageRequestDetail WHERE ServiceRequestId = @requestId;
        DELETE FROM dbo.ConfirmationRequestDetail WHERE ServiceRequestId = @requestId;
        DELETE FROM dbo.FuneralRequestDetail WHERE ServiceRequestId = @requestId;
        DELETE FROM dbo.HouseBlessingRequestDetail WHERE ServiceRequestId = @requestId;
        DELETE FROM dbo.ServiceRequest WHERE ServiceRequestId = @requestId;
      `)
    await transaction.commit()
  } catch (error) {
    if (transactionStarted) {
      try {
        await transaction.rollback()
      } catch (rollbackError) {
        throw new AggregateError([error, rollbackError], 'Service request deletion and rollback failed.')
      }
    }
    throw error
  }
}
