import type { HttpMethod } from '@/lib/api'

export interface ParsedCurl {
  method: HttpMethod
  url: string
  baseUrl: string
  endpoint: string
  headers: Record<string, string>
  body?: string
  suggestedName: string
  authType: 'none' | 'bearer' | 'apiKey' | 'custom'
  bearerToken?: string
  apiKeyName?: string
  apiKeyValue?: string
}

export function parseCurlCommand(rawCommand: string): ParsedCurl {
  const text = rawCommand.trim()
  if (!text) {
    throw new Error('Please enter or paste a cURL command.')
  }

  // Normalize line breaks and backslashes
  const singleLine = text.replace(/\\\r?\n/g, ' ').replace(/\s+/g, ' ')

  // 1. Extract method (-X POST, --request POST)
  let method: HttpMethod = 'GET'
  const methodMatch = singleLine.match(/(?:-X|--request)\s+([A-Z]+)/i)
  if (methodMatch) {
    method = methodMatch[1].toUpperCase() as HttpMethod
  }

  // 2. Extract headers (-H 'Key: Value' or --header 'Key: Value' or unquoted)
  const headers: Record<string, string> = {}
  const headerRegex = /(?:-H|--header)\s+(?:'([^']+)'|"([^"]+)"|([^\s]+))/g
  let hMatch: RegExpExecArray | null
  while ((hMatch = headerRegex.exec(singleLine)) !== null) {
    const headerStr = hMatch[1] || hMatch[2] || hMatch[3]
    if (!headerStr) continue
    const colonIdx = headerStr.indexOf(':')
    if (colonIdx > 0) {
      const key = headerStr.slice(0, colonIdx).trim()
      const val = headerStr.slice(colonIdx + 1).trim()
      headers[key] = val
    }
  }

  // 3. Extract body (-d '...', --data '...', --data-raw '...', --data-binary '...')
  let body: string | undefined
  const dataMatch = singleLine.match(
    /(?:-d|--data|--data-raw|--data-binary)\s+(?:'([^']*)'|"([^"]*)"|([^\s]+))/,
  )
  if (dataMatch) {
    body = dataMatch[1] ?? dataMatch[2] ?? dataMatch[3]
    if (!methodMatch) {
      method = 'POST' // Default to POST if body is provided without explicit -X
    }
  }

  // 4. Extract URL
  let url = ''
  const explicitUrlMatch = singleLine.match(/--url\s+['"]?([^'"\s]+)['"]?/)
  if (explicitUrlMatch) {
    url = explicitUrlMatch[1]
  } else {
    // Find token with http://, https://, or {{
    const tokens = singleLine.split(/\s+/)
    for (const token of tokens) {
      const cleanToken = token.replace(/^['"]|['"]$/g, '')
      if (
        cleanToken.startsWith('http://') ||
        cleanToken.startsWith('https://') ||
        cleanToken.startsWith('{{')
      ) {
        url = cleanToken
        break
      }
    }
  }

  if (!url) {
    throw new Error('Could not find a valid URL in the cURL command. Ensure it has an http:// or https:// URL.')
  }

  // 5. Parse Base URL and Endpoint
  let baseUrl = ''
  let endpoint = '/'
  let suggestedName = 'New API'

  try {
    const parsedUrl = new URL(url)
    baseUrl = parsedUrl.origin
    endpoint = parsedUrl.pathname + parsedUrl.search

    // Derive suggested name from path segments
    const pathParts = parsedUrl.pathname.split('/').filter(Boolean)
    if (pathParts.length > 0) {
      const lastPart = pathParts[pathParts.length - 1]
      // clean up UUID or ID in path if any
      if (/^[0-9a-f-]{10,}$/i.test(lastPart) && pathParts.length > 1) {
        suggestedName = `${pathParts[pathParts.length - 2]}-item`
      } else {
        suggestedName = lastPart
      }
    } else {
      suggestedName = parsedUrl.hostname.split('.')[0] || 'api'
    }
    // Capitalize / format suggestedName
    suggestedName = suggestedName
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, (c) => c.toUpperCase())
  } catch {
    // If URL contains variables like {{baseUrl}}/path
    baseUrl = url
    endpoint = '/'
    suggestedName = 'Imported API'
  }

  // 6. Detect Auth
  let authType: 'none' | 'bearer' | 'apiKey' | 'custom' = 'none'
  let bearerToken: string | undefined
  let apiKeyName: string | undefined
  let apiKeyValue: string | undefined

  for (const [key, value] of Object.entries(headers)) {
    const lowerKey = key.toLowerCase()
    if (lowerKey === 'authorization') {
      if (value.toLowerCase().startsWith('bearer ')) {
        authType = 'bearer'
        bearerToken = value.slice(7).trim()
      } else {
        authType = 'custom'
      }
    } else if (
      lowerKey === 'x-api-key' ||
      lowerKey === 'api-key' ||
      lowerKey === 'apikey'
    ) {
      authType = 'apiKey'
      apiKeyName = key
      apiKeyValue = value
    }
  }

  return {
    method,
    url,
    baseUrl,
    endpoint,
    headers,
    body,
    suggestedName,
    authType,
    bearerToken,
    apiKeyName,
    apiKeyValue,
  }
}
