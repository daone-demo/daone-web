const SLIDE_VERIFY_IMAGE_NAMES = ['bg-1.png', 'bg-2.png', 'bg-3.png', 'bg-4.png', 'bg-5.png'] as const

export const SLIDE_VERIFY_IMAGES = SLIDE_VERIFY_IMAGE_NAMES.map(
  (name) => `${import.meta.env.BASE_URL}slide-verify/${name}`,
)

let preloadPromise: Promise<void> | null = null

export function preloadSlideVerifyImages(): Promise<void> {
  if (typeof window === 'undefined') return Promise.resolve()
  if (preloadPromise) return preloadPromise

  preloadPromise = Promise.all(
    SLIDE_VERIFY_IMAGES.map(
      (src) =>
        new Promise<void>((resolve) => {
          const img = new Image()
          img.onload = () => resolve()
          img.onerror = () => resolve()
          img.src = src
        }),
    ),
  ).then(() => undefined)

  return preloadPromise
}
