import type { TranslationKey } from '../i18n'
import type { WhepError } from './whep'

type Translate = (key: TranslationKey, vars?: Record<string, string | number>) => string

export function describeWhepError(error: WhepError, t: Translate): string {
  switch (error.code) {
    case 'http':
      return t('error.http', { status: error.status ?? 0 })
    case 'timeout':
      return t('error.timeout')
    case 'network':
      return t('error.network')
    case 'protocol':
      return t('error.protocol', { message: error.message })
    default:
      return t('error.unknown', { message: error.message })
  }
}
