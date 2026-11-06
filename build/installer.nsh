; MultiView installer hooks.
;
; Older builds used the default Electron appId (com.electron.app), which made
; electron-builder write a second uninstall entry:
;   UUID.v5("com.electron.app") = f8941786-352c-5c22-bea5-7886c3ac4a8f
; Installing a current build leaves that orphan behind, so Windows keeps showing
; two "MultiView" lines in Settings > Apps. Delete it once, on every install.
; DeleteRegKey is a no-op when the key does not exist.

!macro customInstall
  DeleteRegKey HKCU "Software\Microsoft\Windows\CurrentVersion\Uninstall\f8941786-352c-5c22-bea5-7886c3ac4a8f"
  DeleteRegKey HKLM "Software\Microsoft\Windows\CurrentVersion\Uninstall\f8941786-352c-5c22-bea5-7886c3ac4a8f"
  DeleteRegKey HKLM "Software\WOW6432Node\Microsoft\Windows\CurrentVersion\Uninstall\f8941786-352c-5c22-bea5-7886c3ac4a8f"
!macroend
