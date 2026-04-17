import axios from 'axios'

function resolveApiBaseUrl() {
  const configuredUrl = import.meta.env.VITE_API_URL
  if (configuredUrl) return configuredUrl

  if (typeof window !== 'undefined') {
    const { hostname, origin } = window.location
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1'
    return isLocal ? 'http://localhost:5000' : origin
  }

  return 'http://localhost:5000'
}

const baseURL = resolveApiBaseUrl()

const api = axios.create({
  baseURL,
  timeout: 10000,
  headers: { 'Content-Type': 'application/json' }
})

if (import.meta.env.DEV) {
  console.log('[API] Base URL:', baseURL)
}

export default api