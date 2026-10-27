import { useMemo } from 'react'
import { MainApp } from './components/MainApp'
import { PopupApp } from './components/PopupApp'
import { LanguageProvider } from './i18n'

function App(): React.JSX.Element {
  const params = useMemo(() => new URLSearchParams(window.location.search), [])
  const isPopup = params.get('streamPopup') === '1'

  return <LanguageProvider>{isPopup ? <PopupApp params={params} /> : <MainApp />}</LanguageProvider>
}

export default App
