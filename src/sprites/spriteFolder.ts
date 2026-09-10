import { SPRITE_FILE } from './library.ts'
import type { SpriteFile } from './loadSprites.ts'

type AccessMode = { mode?: 'read' | 'readwrite' }

// The picker and the per-handle permission calls are the File System Access API, which TypeScript's
// DOM library does not declare yet; `showDirectoryPicker` being optional is also how the fallback
// path detects a browser without it.
declare global {
  interface Window {
    showDirectoryPicker?: (options?: AccessMode) => Promise<FileSystemDirectoryHandle>
  }
  interface FileSystemHandle {
    queryPermission?: (options?: AccessMode) => Promise<PermissionState>
    requestPermission?: (options?: AccessMode) => Promise<PermissionState>
  }
}

// A directory handle is a structured-clonable object, not a string, so localStorage cannot hold
// one and IndexedDB is the only store that survives a reload with the folder still openable.
const DB_NAME = 'wpainter'
const STORE = 'handles'
const KEY = 'spriteFolder'

function openDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDatabase()
  try {
    return await new Promise<T>((resolve, reject) => {
      const request = run(database.transaction(STORE, mode).objectStore(STORE))
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })
  } finally {
    database.close()
  }
}

export function supportsFolderPicker(): boolean {
  return typeof window.showDirectoryPicker === 'function'
}

// Null when the user dismissed the picker, which is a normal outcome rather than an error.
export async function pickFolder(): Promise<FileSystemDirectoryHandle | null> {
  const picker = window.showDirectoryPicker
  if (!picker) return null
  try {
    return await picker({ mode: 'read' })
  } catch {
    return null
  }
}

export async function rememberFolder(handle: FileSystemDirectoryHandle): Promise<void> {
  await withStore('readwrite', (store) => store.put(handle, KEY))
}

export async function recallFolder(): Promise<FileSystemDirectoryHandle | null> {
  try {
    return (await withStore<FileSystemDirectoryHandle | undefined>('readonly', (store) =>
      store.get(KEY),
    )) ?? null
  } catch {
    return null
  }
}

export async function forgetFolder(): Promise<void> {
  await withStore('readwrite', (store) => store.delete(KEY))
}

// A permission granted last session usually comes back as "prompt", and re-asking needs a user
// gesture — hence the split: this one runs on mount, `askFolderAccess` runs from a click.
export async function hasFolderAccess(handle: FileSystemDirectoryHandle): Promise<boolean> {
  return (await handle.queryPermission?.({ mode: 'read' })) === 'granted'
}

export async function askFolderAccess(handle: FileSystemDirectoryHandle): Promise<boolean> {
  return (await handle.requestPermission?.({ mode: 'read' })) === 'granted'
}

const isDirectory = (handle: FileSystemHandle): handle is FileSystemDirectoryHandle =>
  handle.kind === 'directory'

const isFile = (handle: FileSystemHandle): handle is FileSystemFileHandle => handle.kind === 'file'

// Paths start with the picked directory's own name, matching what `webkitRelativePath` reports,
// so both ways of choosing a folder produce the same tree.
export async function readFolder(handle: FileSystemDirectoryHandle): Promise<SpriteFile[]> {
  const found: SpriteFile[] = []
  const walk = async (directory: FileSystemDirectoryHandle, prefix: string) => {
    for await (const entry of directory.values()) {
      const path = `${prefix}/${entry.name}`
      if (isDirectory(entry)) {
        await walk(entry, path)
      } else if (isFile(entry) && SPRITE_FILE.test(entry.name)) {
        found.push({ file: await entry.getFile(), path })
      }
    }
  }
  await walk(handle, handle.name)
  return found
}
