type StorageBucketKind = 'public' | 'private'

interface SupabaseStorageFile {
  contents: Buffer
  contentType: string
}

export function createSupabaseStorage(
  env?: Record<string, string | undefined>,
  fetcher?: typeof fetch,
): {
  upload(
    kind: StorageBucketKind,
    name: string,
    contents: Buffer,
    contentType: string,
  ): Promise<void>
  download(
    kind: StorageBucketKind,
    name: string,
    maxBytes: number,
  ): Promise<SupabaseStorageFile>
  remove(kind: StorageBucketKind, name: string): Promise<void>
  checkBucket(kind: StorageBucketKind, shouldBePublic: boolean): Promise<void>
}
