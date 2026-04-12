import type { GenerationResult } from "./api-client"

const DB_NAME = "ai-image-tool"
const DB_VERSION = 4
const STORE_NAME = "history"
const SOURCE_IMAGE_STORE_NAME = "history-source-images"
const MAX_HISTORY_ITEMS = 100

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

      if (event.oldVersion < 3) {
        const store = (event.target as IDBOpenDBRequest).transaction?.objectStore(STORE_NAME)
        if (store) {
          // Add new indexes for favorites and rating
          if (!store.indexNames.contains("isFavorite")) {
            store.createIndex("isFavorite", "isFavorite", { unique: false })
          }
          if (!store.indexNames.contains("rating")) {
            store.createIndex("rating", "rating", { unique: false })
          }
        }
      }

      if (event.oldVersion < 4) {
        if (!db.objectStoreNames.contains(SOURCE_IMAGE_STORE_NAME)) {
          db.createObjectStore(SOURCE_IMAGE_STORE_NAME, { keyPath: "historyId" })
        }
      }
    }
  })
}

interface SourceImagesRecord {
  historyId: string
  images: string[]
  updatedAt: number
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

  // Clean up old entries (excluding favorites)
  const allRequest = store.index("timestamp").openCursor(null, "prev")
  let count = 0

  allRequest.onsuccess = (event) => {
    const cursor = (event.target as IDBRequest).result
    if (cursor) {
      const value = cursor.value as { isFavorite?: boolean }
      // Don't count favorites towards the limit
      if (!value.isFavorite) {
        count++
      }
      // Delete non-favorite items beyond the limit
      if (count > MAX_HISTORY_ITEMS && !value.isFavorite) {
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
  const transaction = db.transaction([STORE_NAME, SOURCE_IMAGE_STORE_NAME], "readwrite")
  const store = transaction.objectStore(STORE_NAME)
  const sourceImageStore = transaction.objectStore(SOURCE_IMAGE_STORE_NAME)

  await new Promise<void>((resolve, reject) => {
    const request = store.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })

  await new Promise<void>((resolve, reject) => {
    const request = sourceImageStore.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })

  db.close()
}

export async function saveHistorySourceImages(historyId: string, images: string[]): Promise<void> {
  const db = await openDB()
  const transaction = db.transaction([SOURCE_IMAGE_STORE_NAME], "readwrite")
  const store = transaction.objectStore(SOURCE_IMAGE_STORE_NAME)

  await new Promise<void>((resolve, reject) => {
    const request = store.put({
      historyId,
      images,
      updatedAt: Date.now(),
    } satisfies SourceImagesRecord)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })

  db.close()
}

export async function loadHistorySourceImages(historyId: string): Promise<string[]> {
  const db = await openDB()
  const transaction = db.transaction([SOURCE_IMAGE_STORE_NAME], "readonly")
  const store = transaction.objectStore(SOURCE_IMAGE_STORE_NAME)

  const images = await new Promise<string[]>((resolve, reject) => {
    const request = store.get(historyId)
    request.onsuccess = () => {
      const record = request.result as SourceImagesRecord | undefined
      resolve(record?.images ?? [])
    }
    request.onerror = () => reject(request.error)
  })

  db.close()
  return images
}

export async function deleteHistorySourceImages(historyId: string): Promise<void> {
  const db = await openDB()
  const transaction = db.transaction([SOURCE_IMAGE_STORE_NAME], "readwrite")
  const store = transaction.objectStore(SOURCE_IMAGE_STORE_NAME)

  await new Promise<void>((resolve, reject) => {
    const request = store.delete(historyId)
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })

  db.close()
}

export async function clearAllHistorySourceImages(): Promise<void> {
  const db = await openDB()
  const transaction = db.transaction([SOURCE_IMAGE_STORE_NAME], "readwrite")
  const store = transaction.objectStore(SOURCE_IMAGE_STORE_NAME)

  await new Promise<void>((resolve, reject) => {
    const request = store.clear()
    request.onsuccess = () => resolve()
    request.onerror = () => reject(request.error)
  })

  db.close()
}

export async function favoriteHistory(id: string): Promise<void> {
  const db = await openDB()
  const transaction = db.transaction([STORE_NAME], "readwrite")
  const store = transaction.objectStore(STORE_NAME)

  await new Promise<void>((resolve, reject) => {
    const getRequest = store.get(id)
    getRequest.onsuccess = () => {
      const item = getRequest.result
      if (item) {
        const updated = { ...item, isFavorite: true }
        const putRequest = store.put(updated)
        putRequest.onsuccess = () => resolve()
        putRequest.onerror = () => reject(putRequest.error)
      } else {
        reject(new Error("Item not found"))
      }
    }
    getRequest.onerror = () => reject(getRequest.error)
  })

  db.close()
}

export async function unfavoriteHistory(id: string): Promise<void> {
  const db = await openDB()
  const transaction = db.transaction([STORE_NAME], "readwrite")
  const store = transaction.objectStore(STORE_NAME)

  await new Promise<void>((resolve, reject) => {
    const getRequest = store.get(id)
    getRequest.onsuccess = () => {
      const item = getRequest.result
      if (item) {
        const updated = { ...item, isFavorite: false }
        const putRequest = store.put(updated)
        putRequest.onsuccess = () => resolve()
        putRequest.onerror = () => reject(putRequest.error)
      } else {
        reject(new Error("Item not found"))
      }
    }
    getRequest.onerror = () => reject(getRequest.error)
  })

  db.close()
}

export async function updateHistoryRating(id: string, rating: number | null): Promise<void> {
  const db = await openDB()
  const transaction = db.transaction([STORE_NAME], "readwrite")
  const store = transaction.objectStore(STORE_NAME)

  await new Promise<void>((resolve, reject) => {
    const getRequest = store.get(id)
    getRequest.onsuccess = () => {
      const item = getRequest.result
      if (item) {
        const updated = { ...item, rating: rating ?? undefined }
        const putRequest = store.put(updated)
        putRequest.onsuccess = () => resolve()
        putRequest.onerror = () => reject(putRequest.error)
      } else {
        reject(new Error("Item not found"))
      }
    }
    getRequest.onerror = () => reject(getRequest.error)
  })

  db.close()
}

export async function updateHistoryTags(id: string, tags: string[]): Promise<void> {
  const db = await openDB()
  const transaction = db.transaction([STORE_NAME], "readwrite")
  const store = transaction.objectStore(STORE_NAME)

  await new Promise<void>((resolve, reject) => {
    const getRequest = store.get(id)
    getRequest.onsuccess = () => {
      const item = getRequest.result
      if (item) {
        const updated = { ...item, tags }
        const putRequest = store.put(updated)
        putRequest.onsuccess = () => resolve()
        putRequest.onerror = () => reject(putRequest.error)
      } else {
        reject(new Error("Item not found"))
      }
    }
    getRequest.onerror = () => reject(getRequest.error)
  })

  db.close()
}
