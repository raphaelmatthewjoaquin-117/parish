process.env.NODE_ENV = 'development'
process.env.LOCAL_ADMIN_PREVIEW_ONLY = '1'
await import('../server.js')
