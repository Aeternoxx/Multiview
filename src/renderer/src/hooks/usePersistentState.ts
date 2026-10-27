import { useEffect, useState, type Dispatch, type SetStateAction } from 'react'
import { readJson, writeJson } from '../lib/storage'

export function usePersistentState<T>(
  key: string,
  parse: (raw: string | null) => T,
  fallback: T
): [T, Dispatch<SetStateAction<T>>] {
  const [value, setValue] = useState<T>(() => readJson(key, parse, fallback))

  useEffect(() => {
    writeJson(key, value)
  }, [key, value])

  return [value, setValue]
}
