; File-manager actions default on; native preference loading preserves opt-out.
; Sign-in startup remains opt-in. Registry changes are owned and transactional.
!ifndef SORA_EXPLORER_PAYLOAD
  !define SORA_EXPLORER_PAYLOAD "${__FILEDIR__}\..\..\.artifacts\windows-shell\sorafiles-explorer.dll"
!endif
Var SoraFilesPreviousExplorer

Function .onInstFailed
  ; An abort before resource extraction must not leave registration pointing at
  ; an absent image. Never replace an already extracted file in this callback.
  IfFileExists "$INSTDIR\sorafiles-explorer.dll" sorafiles_restore_done
  StrCmp $SoraFilesPreviousExplorer "" sorafiles_restore_done
  Rename "$SoraFilesPreviousExplorer" "$INSTDIR\sorafiles-explorer.dll"
  sorafiles_restore_done:
FunctionEnd

!macro NSIS_HOOK_PREINSTALL
  !insertmacro CheckIfAppIsRunning "${MAINBINARYNAME}.exe" "${PRODUCTNAME}"
  ; Explorer may keep the old DLL mapped. Rename it before normal extraction;
  ; replacing a mapped image in place can otherwise leave the old bytes behind.
  InitPluginsDir
  File /oname=$PLUGINSDIR\sorafiles-explorer.expected.dll "${SORA_EXPLORER_PAYLOAD}"
  StrCpy $SoraFilesPreviousExplorer ""
  IfFileExists "$INSTDIR\sorafiles-explorer.dll" 0 sorafiles_shell_ready
  ClearErrors
  GetTempFileName $SoraFilesPreviousExplorer "$INSTDIR"
  IfErrors sorafiles_shell_failed
  Delete "$SoraFilesPreviousExplorer"
  ClearErrors
  Rename "$INSTDIR\sorafiles-explorer.dll" "$SoraFilesPreviousExplorer"
  IfErrors 0 sorafiles_shell_ready
  sorafiles_shell_failed:
  StrCpy $SoraFilesPreviousExplorer ""
  SetErrorLevel 1
  Abort "SoraFiles could not replace its Explorer component. Restart Windows and run the installer again."
  sorafiles_shell_ready:
  SetOverwrite on
!macroend

Function SoraFilesVerifyExplorerPayload
  ; Compare the installed image with the exact embedded image. A successful
  ; process exit or registry update alone is not evidence of a completed copy.
  ClearErrors
  FileOpen $R0 "$INSTDIR\sorafiles-explorer.dll" r
  IfErrors sorafiles_verify_failed
  FileOpen $R1 "$PLUGINSDIR\sorafiles-explorer.expected.dll" r
  IfErrors sorafiles_verify_close_actual
  sorafiles_verify_byte:
    ClearErrors
    FileReadByte $R1 $R3
    IfErrors sorafiles_verify_end
    FileReadByte $R0 $R2
    IfErrors sorafiles_verify_close_both
    StrCmp $R2 $R3 sorafiles_verify_byte sorafiles_verify_close_both
  sorafiles_verify_end:
    ClearErrors
    FileReadByte $R0 $R2
    IfErrors sorafiles_verify_ok sorafiles_verify_close_both
  sorafiles_verify_ok:
    FileClose $R1
    FileClose $R0
    Return
  sorafiles_verify_close_both:
    FileClose $R1
  sorafiles_verify_close_actual:
    FileClose $R0
  sorafiles_verify_failed:
    ; Restore the previous path when extraction failed, if it can be restored.
    StrCmp $SoraFilesPreviousExplorer "" sorafiles_verify_abort
    Delete "$INSTDIR\sorafiles-explorer.dll"
    Rename "$SoraFilesPreviousExplorer" "$INSTDIR\sorafiles-explorer.dll"
  sorafiles_verify_abort:
    SetErrorLevel 1
    Abort "SoraFiles could not verify its Explorer component. Restart Windows and run the installer again."
FunctionEnd

!macro NSIS_HOOK_POSTINSTALL
  Call SoraFilesVerifyExplorerPayload
  ; Installation only registers file-manager integration. The app records its
  ; automatic seven-day trial on first launch, consistently across platforms.
  ; Existing local trial deadlines are preserved by prepareTrial on upgrades.
  ClearErrors
  StrCpy $R1 1
  ExecWait '"$INSTDIR\sorafiles-desktop.exe" --sync-explorer-entry' $R1
  IfErrors 0 +2
  StrCpy $R1 1
  StrCmp $R1 0 sorafiles_registered
  SetErrorLevel 1
  Abort "SoraFiles could not register its Explorer actions. Run the installer again or enable them in SoraFiles Settings."
  sorafiles_registered:
  StrCmp $SoraFilesPreviousExplorer "" sorafiles_install_done
  ClearErrors
  Delete "$SoraFilesPreviousExplorer"
  IfErrors 0 sorafiles_install_done
  ; Do not schedule deletion of the canonical DLL path: that would delete the
  ; newly installed image on reboot. Only the uniquely named old image is old.
  Delete /REBOOTOK "$SoraFilesPreviousExplorer"
  SetRebootFlag true
  SetErrorLevel 3010
  DetailPrint "Restart Windows to finish updating SoraFiles Explorer actions."
  sorafiles_install_done:
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
