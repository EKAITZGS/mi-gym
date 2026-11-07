// Fotos de progreso: se guardan en IndexedDB (en localStorage no caben). Solo en este móvil.
const DB = 'migym-photos'
const STORE = 'photos'

function open() {
  return new Promise((res, rej) => {
    const r = indexedDB.open(DB, 1)
    r.onupgradeneeded = () => r.result.createObjectStore(STORE)
    r.onsuccess = () => res(r.result)
    r.onerror = () => rej(r.error)
  })
}

async function tx(mode, fn) {
  const db = await open()
  return new Promise((res, rej) => {
    const t = db.transaction(STORE, mode)
    const out = fn(t.objectStore(STORE))
    t.oncomplete = () => res(out?.result ?? out)
    t.onerror = () => rej(t.error)
    t.onabort = () => rej(t.error)
  })
}

export const savePhoto = (id, dataUrl) => tx('readwrite', (s) => s.put(dataUrl, id))
export const deletePhoto = (id) => tx('readwrite', (s) => s.delete(id))
export const loadPhoto = (id) => tx('readonly', (s) => s.get(id))

// Reduce la foto a ~900 px y JPEG para que ocupe poco (≈100 KB)
export function compressImage(file, max = 900, quality = 0.78) {
  return new Promise((res, rej) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas')
      c.width = Math.round(img.width * k)
      c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      URL.revokeObjectURL(url)
      res(c.toDataURL('image/jpeg', quality))
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      rej(new Error('img'))
    }
    img.src = url
  })
}
