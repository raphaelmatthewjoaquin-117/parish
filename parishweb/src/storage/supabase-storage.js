function encodeObjectName(name) {
  if (
    typeof name !== 'string'
    || !name
    || name.startsWith('/')
    || name.split('/').some(part => !part || part === '.' || part === '..')
    || !/^[A-Za-z0-9._/-]+$/.test(name)
  ) {
    throw new Error('Invalid Supabase Storage object name.')
  }
  return name.split('/').map(encodeURIComponent).join('/')
}

export function createSupabaseStorage(env = process.env, fetcher = fetch) {
  const rawUrl = env.SUPABASE_URL?.trim()
  const serviceKey = env.SUPABASE_SERVICE_ROLE_KEY?.trim()
  if (!rawUrl || !serviceKey) {
    throw new Error('SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY must be configured.')
  }

  let baseUrl
  try {
    baseUrl = new URL(rawUrl)
  } catch {
    throw new Error('SUPABASE_URL must be a valid HTTPS URL.')
  }
  if (
    baseUrl.protocol !== 'https:'
    || baseUrl.pathname !== '/'
    || baseUrl.username
    || baseUrl.password
    || baseUrl.search
    || baseUrl.hash
  ) {
    throw new Error('SUPABASE_URL must be a valid HTTPS URL.')
  }

  const buckets = {
    public: env.SUPABASE_PUBLIC_BUCKET?.trim() || 'parish-public-assets',
    private: env.SUPABASE_PRIVATE_BUCKET?.trim() || 'parish-private-documents',
  }
  const headers = {
    apikey: serviceKey,
    Authorization: `Bearer ${serviceKey}`,
  }

  function objectUrl(kind, name) {
    const bucket = buckets[kind]
    if (!bucket) throw new Error('Invalid Supabase Storage bucket.')
    return `${baseUrl.origin}/storage/v1/object/${encodeURIComponent(bucket)}/${encodeObjectName(name)}`
  }

  async function checkResponse(response, operation) {
    if (response.ok) return
    const error = new Error(`Supabase Storage ${operation} failed with status ${response.status}.`)
    error.statusCode = response.status
    throw error
  }

  return {
    async upload(kind, name, contents, contentType) {
      const response = await fetcher(objectUrl(kind, name), {
        method: 'POST',
        headers: {
          ...headers,
          'Content-Type': contentType || 'application/octet-stream',
          'x-upsert': 'false',
        },
        body: contents,
      })
      await checkResponse(response, 'upload')
    },

    async download(kind, name, maxBytes) {
      const response = await fetcher(objectUrl(kind, name), { headers })
      await checkResponse(response, 'download')
      const contentLength = Number(response.headers.get('content-length'))
      if (Number.isFinite(contentLength) && contentLength > maxBytes) {
        throw new Error('Supabase Storage object exceeds the allowed size.')
      }
      const contents = Buffer.from(await response.arrayBuffer())
      if (contents.length > maxBytes) {
        throw new Error('Supabase Storage object exceeds the allowed size.')
      }
      return {
        contents,
        contentType: response.headers.get('content-type') || 'application/octet-stream',
      }
    },

    async remove(kind, name) {
      const bucket = buckets[kind]
      if (!bucket) throw new Error('Invalid Supabase Storage bucket.')
      const response = await fetcher(
        `${baseUrl.origin}/storage/v1/object/${encodeURIComponent(bucket)}`,
        {
          method: 'DELETE',
          headers: { ...headers, 'Content-Type': 'application/json' },
          body: JSON.stringify({ prefixes: [encodeObjectName(name)] }),
        },
      )
      await checkResponse(response, 'delete')
    },

    async checkBucket(kind, shouldBePublic) {
      const bucket = buckets[kind]
      if (!bucket) throw new Error('Invalid Supabase Storage bucket.')
      const response = await fetcher(
        `${baseUrl.origin}/storage/v1/bucket/${encodeURIComponent(bucket)}`,
        { headers },
      )
      await checkResponse(response, 'bucket check')
      const details = await response.json()
      if (details.public !== shouldBePublic) {
        throw new Error(`Supabase Storage bucket "${bucket}" has incorrect public access settings.`)
      }
    },
  }
}
