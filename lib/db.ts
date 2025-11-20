import type { GenerationResult } from "./api-client"

const DB_NAME = "ai-image-tool"
const DB_VERSION = 2
const STORE_NAME = "history"
const MAX_HISTORY_ITEMS = 20

function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result

      if (event.oldVersion < 1) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" })
        store.createIndex("timestamp", "timestamp", { unique: false })
      }

      if (event.oldVersion < 2) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          const store = db.createObjectStore(STORE_NAME, { keyPath: "id" })
          store.createIndex("timestamp", "timestamp", { unique: false })
        } else {
          const store = (event.target as IDBOpenDBRequest).transaction?.objectStore(STORE_NAME)
          if (store) {
            store.clear()
          }
        }
      }
    }
  })
}

export async function saveToHistory(result: GenerationResult): Promise<void> {
  const db = await openDB()
  const transaction = db.transaction([STORE_NAME], "readwrite")
  const store = transaction.objectStore(STORE_NAME)

  await new Promise<void>((resolve, reject) => {
    const request = store.put(result)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })

  // Clean up old entries
  const allRequest = store.index("timestamp").openCursor(null, "prev")
  let count = 0

  allRequest.onsuccess = (event) => {
    const cursor = (event.target as IDBRequest).result
    if (cursor) {
      count++
      if (count > MAX_HISTORY_ITEMS) {
        cursor.delete()
      }
      cursor.continue()
    }
  }

  db.close()
}

export async function loadHistory(): Promise<GenerationResult[]> {
  const db = await openDB()
  const transaction = db.transaction([STORE_NAME], "readonly")
  const store = transaction.objectStore(STORE_NAME)
  const index = store.index("timestamp")

  return new Promise((resolve, reject) => {
    const request = index.openCursor(null, "prev")
    const results: GenerationResult[] = []

    request.onsuccess = (event) => {
      const cursor = (event.target as IDBRequest).result
      if (cursor) {
        results.push(cursor.value)
        cursor.continue()
      } else {
        db.close()
        resolve(results)
      }
    }

    request.onerror = () => {
      db.close()
      reject(request.error)
    }
  })
}

export async function deleteFromHistory(id: string): Promise<void> {
  const db = await openDB()
  const transaction = db.transaction([STORE_NAME], "readwrite")
  const store = transaction.objectStore(STORE_NAME)

  await new Promise<void>((resolve, reject) => {
    const request = store.delete(id)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })

  db.close()
}

export async function clearHistory(): Promise<void> {
  const db = await openDB()
  const transaction = db.transaction([STORE_NAME], "readwrite")
  const store = transaction.objectStore(STORE_NAME)

  await new Promise<void>((resolve, reject) => {
    const request = store.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })

  db.close()
}
