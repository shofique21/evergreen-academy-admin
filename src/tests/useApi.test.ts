import { describe, it, expect, vi } from 'vitest'
import { useApi } from '../composables/useApi'

describe('useApi Composable', () => {
  it('manages successful API execution and updates reactive data', async () => {
    const mockData = { id: 1, name: 'Tanvir Hasan' }
    const mockApi = vi.fn().mockResolvedValue({ data: mockData })

    const { data, loading, error, execute } = useApi(mockApi)

    expect(data.value).toBeNull()
    expect(loading.value).toBe(false)
    expect(error.value).toBeNull()

    const promise = execute()
    expect(loading.value).toBe(true)

    const result = await promise
    expect(loading.value).toBe(false)
    expect(result).toEqual(mockData)
    expect(data.value).toEqual(mockData)
    expect(error.value).toBeNull()
  })

  it('normalizes error and sets error ref on failure', async () => {
    const mockError = {
      message: 'Resource not found',
      status: 404,
    }
    const mockApi = vi.fn().mockRejectedValue(mockError)

    const { data, loading, error, execute } = useApi(mockApi)

    const result = await execute()
    expect(loading.value).toBe(false)
    expect(result).toBeNull()
    expect(data.value).toBeNull()
    expect(error.value).toEqual(mockError)
  })

  it('resets state when reset is called', async () => {
    const mockApi = vi.fn().mockResolvedValue({ data: 'success' })
    const { data, reset, execute } = useApi(mockApi)

    await execute()
    expect(data.value).toBe('success')

    reset()
    expect(data.value).toBeNull()
  })
})
