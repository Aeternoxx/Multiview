import type { ElectronAPI } from '@electron-toolkit/preload'
import type { MultiviewApi } from '../shared/api'

declare global {
  interface Window {
    electron: ElectronAPI
    api: MultiviewApi
  }
}
