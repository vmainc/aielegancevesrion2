import { eventHandler, setResponseHeader } from 'h3'

/**
 * Nitro serves `/_nuxt/*` via the public-asset middleware first; missing paths 404 before routes run.
 * Prepend a layer so legacy clients can still load `/_nuxt/builds/meta/<uuid>.json` after appManifest is off.
 */
export default defineNitroPlugin((nitroApp) => {
  nitroApp.h3App.stack.unshift({
    route: '',
    handler: eventHandler((event) => {
      if (event.method !== 'GET' && event.method !== 'HEAD') {
        return
      }
      const path = (event.path || '').split('?')[0] ?? ''
      if (!path.startsWith('/_nuxt/builds/meta/') || !path.endsWith('.json')) {
        return
      }
      setResponseHeader(event, 'Content-Type', 'application/json')
      setResponseHeader(event, 'Cache-Control', 'no-store')
      const file = path.slice('/_nuxt/builds/meta/'.length)
      const id = file.replace(/\.json$/i, '') || 'unknown'
      if (event.method === 'HEAD') {
        return ''
      }
      return {
        id,
        timestamp: Date.now(),
        matcher: { static: {}, wildcard: {}, dynamic: {} },
        prerendered: [] as string[]
      }
    })
  })
})
