export function isLocalAdminLoginAllowed(input: {
  nodeEnv: string
  remoteAddress: string
  login: string
  password: string
  configuredUsername: string
  configuredPassword: string
  tokenSecret: string
}): boolean

export function isLocalAdminPreviewRequestAllowed(input: {
  nodeEnv: string
  remoteAddress: string
  requestPath: string
}): boolean
