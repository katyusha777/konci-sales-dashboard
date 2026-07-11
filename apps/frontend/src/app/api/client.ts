export class ApiError extends Error {
  constructor(message: string, public info: string | null = null, public status?: number) {
    super(message)
    this.name = 'ApiError'
  }
}

// Unwraps the backend's ApiResponse envelope in ONE place:
//   { success: true, data }            -> data
//   { success: false, message, info }  -> throws ApiError
export const $api = $fetch.create({
  onResponse({ response }) {
    const body = response._data
    if (body && typeof body === 'object' && 'success' in body) {
      if (body.success === true && 'data' in body)
        response._data = body.data
    }
  },
  onResponseError({ response }) {
    const body = response._data
    if (body && typeof body === 'object' && body.success === false)
      throw new ApiError(body.message ?? 'Request failed', body.info ?? null, response.status)
    throw new ApiError(`Request failed (${response.status})`, null, response.status)
  },
})

// FRONTEND-FIRST phase helper: simulates a network round-trip for dummy data so
// loading states are visible. Deleted once all api modules talk to the real API.
export function dummy<T>(data: T, ms = 300): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(structuredClone(data)), ms))
}
