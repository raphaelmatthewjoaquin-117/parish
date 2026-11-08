import { describe, expect, it, vi } from 'vitest'
import { createSupabaseStorage } from './supabase-storage.js'

describe('Supabase Storage', () => {
  it('uploads and downloads private objects with the server-side service key', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(new Response(null, { status: 200 }))
      .mockResolvedValueOnce(new Response('document', {
        status: 200,
        headers: { 'Content-Length': '8', 'Content-Type': 'application/pdf' },
      }))
    const storage = createSupabaseStorage({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'server-only-key',
      SUPABASE_PUBLIC_BUCKET: 'public-assets',
      SUPABASE_PRIVATE_BUCKET: 'private-documents',
    }, fetcher)

    await storage.upload('private', 'report.pdf', Buffer.from('document'), 'application/pdf')
    const result = await storage.download('private', 'report.pdf', 20)

    expect(fetcher.mock.calls[0][0]).toBe(
      'https://project.supabase.co/storage/v1/object/private-documents/report.pdf',
    )
    expect(fetcher.mock.calls[0][1].headers).toMatchObject({
      apikey: 'server-only-key',
      Authorization: 'Bearer server-only-key',
    })
    expect(result.contents.toString()).toBe('document')
    expect(result.contentType).toBe('application/pdf')
  })

  it('rejects unsafe object names before making a request', async () => {
    const fetcher = vi.fn()
    const storage = createSupabaseStorage({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'server-only-key',
    }, fetcher)

    await expect(storage.download('private', '../secret', 100)).rejects.toThrow(
      'Invalid Supabase Storage object name.',
    )
    expect(fetcher).not.toHaveBeenCalled()
  })

  it('deletes an object using the Storage API bucket-prefix endpoint', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 200 }))
    const storage = createSupabaseStorage({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'server-only-key',
      SUPABASE_PRIVATE_BUCKET: 'private-documents',
    }, fetcher)

    await storage.remove('private', 'report.pdf')

    expect(fetcher).toHaveBeenCalledWith(
      'https://project.supabase.co/storage/v1/object/private-documents',
      expect.objectContaining({
        method: 'DELETE',
        body: JSON.stringify({ prefixes: ['report.pdf'] }),
      }),
    )
  })

  it('requires public and private buckets to have the intended access modes', async () => {
    const fetcher = vi.fn()
      .mockResolvedValueOnce(Response.json({ public: true }))
      .mockResolvedValueOnce(Response.json({ public: false }))
    const storage = createSupabaseStorage({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'server-only-key',
    }, fetcher)

    await expect(storage.checkBucket('public', true)).resolves.toBeUndefined()
    await expect(storage.checkBucket('private', false)).resolves.toBeUndefined()
    expect(fetcher).toHaveBeenCalledTimes(2)
  })

  it('rejects downloads above the caller-provided size limit', async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response('too large', {
      status: 200,
      headers: { 'Content-Length': '9' },
    }))
    const storage = createSupabaseStorage({
      SUPABASE_URL: 'https://project.supabase.co',
      SUPABASE_SERVICE_ROLE_KEY: 'server-only-key',
    }, fetcher)

    await expect(storage.download('public', 'photo.jpg', 8)).rejects.toThrow(
      'Supabase Storage object exceeds the allowed size.',
    )
  })
})
