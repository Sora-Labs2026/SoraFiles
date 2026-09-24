; File-manager actions default on; native preference loading preserves opt-out.
; Sign-in startup remains opt-in. Registry changes are owned and transactional.
!macro NSIS_HOOK_POSTINSTALL
  ExecWait '"$INSTDIR\sorafiles-desktop.exe" --sync-explorer-entry' $R1
  StrCmp $R1 0 +2
  DetailPrint "File-manager actions could not be updated. Try enabling them in SoraFiles Settings."
!macroend
!macro NSIS_HOOK_PREUNINSTALL
  ; The native module checks exact executable ownership and transacts removal.
  ; Unfamiliar entries are preserved. A failed transaction aborts uninstall.
  ExecWait '"$INSTDIR\sorafiles-desktop.exe" --remove-explorer-entry' $R1
  StrCmp $R1 0 +3
  SetErrorLevel 1
  Abort "Explorer entries could not be removed safely. Turn off Explorer integration in SoraFiles Settings before uninstalling."
  ReadRegStr $R0 HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "SoraFilesDesktop"
  StrCmp $R0 '"$INSTDIR\sorafiles-desktop.exe" --background' 0 +2
  DeleteRegValue HKCU "Software\Microsoft\Windows\CurrentVersion\Run" "SoraFilesDesktop"
!macroend
