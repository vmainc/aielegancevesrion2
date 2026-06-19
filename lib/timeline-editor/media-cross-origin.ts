/** Set crossOrigin before assigning src so canvas export can drawImage the frame. */
export function applyCrossOriginForMediaSrc (el: HTMLMediaElement, src: string) {
  try {
    const u = new URL(src, window.location.href)
    if (u.origin !== window.location.origin) {
      el.crossOrigin = 'anonymous'
    } else {
      el.removeAttribute('crossorigin')
    }
  } catch {
    el.removeAttribute('crossorigin')
  }
}
