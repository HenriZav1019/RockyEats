import { supabase } from './supabase.js'

// Owner photo uploads (logo and dishes) into the public "photos" bucket.
// Photos from a phone camera are 3 to 8 MB; we shrink them in the browser
// first so they upload fast on mobile data and load fast for customers.

const BUCKET = 'photos'

const SIZES = {
  logo: { max: 512, quality: 0.9 },
  menu: { max: 1200, quality: 0.82 },
}

function loadImage(file) {
  // createImageBitmap respects the photo's rotation (EXIF) in current browsers.
  if (window.createImageBitmap) {
    return createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => loadWithImg(file))
  }
  return loadWithImg(file)
}

function loadWithImg(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('PHOTO_UNREADABLE'))
    }
    img.src = url
  })
}

const toBlob = (canvas, type, quality) => new Promise((resolve) => canvas.toBlob(resolve, type, quality))

export async function shrinkPhoto(file, kind = 'menu') {
  const { max, quality } = SIZES[kind] || SIZES.menu
  const img = await loadImage(file)
  const w = img.width
  const h = img.height
  const scale = Math.min(1, max / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * scale)
  canvas.height = Math.round(h * scale)
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  img.close?.()

  // WebP keeps logos' transparent backgrounds and is small. Older iPhones
  // can't encode it and hand back a PNG instead; use JPEG there for dishes.
  let blob = await toBlob(canvas, 'image/webp', quality)
  if (!blob || blob.type !== 'image/webp') {
    blob = kind === 'logo' ? await toBlob(canvas, 'image/png') : await toBlob(canvas, 'image/jpeg', quality)
  }
  if (!blob) throw new Error('PHOTO_UNREADABLE')
  return blob
}

const EXT = { 'image/webp': 'webp', 'image/jpeg': 'jpg', 'image/png': 'png' }

// Returns the public URL of the uploaded photo.
export async function uploadPhoto({ restaurantId, file, kind = 'menu' }) {
  if (!file.type.startsWith('image/')) throw new Error('PHOTO_NOT_IMAGE')
  const blob = await shrinkPhoto(file, kind)
  const id = crypto.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`
  const path = `${restaurantId || 'admin'}/${kind}/${id}.${EXT[blob.type] || 'jpg'}`
  const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
    contentType: blob.type,
    cacheControl: '31536000', // file names never repeat, so cache for a year
    upsert: false,
  })
  if (error) throw error
  return supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl
}
