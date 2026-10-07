!include "WinMessages.nsh"

; Removes $INSTDIR from the current user's PATH on uninstall (HKCU, since this installer
; is per-user).
;
; Through 0.6.1 Unstrung had a command line interface, and this script also added $INSTDIR
; to PATH on install so `unstrung` could be run from a terminal. The command line and the
; install step are gone. The uninstall step stays so a PATH entry left by one of those
; versions is still cleaned up.
;
; PathListRemove operates on a semicolon-delimited list purely as a string (no registry
; access). It treats entries as whole ;-delimited segments (matching ";$0;" against
; ";entry;") so "C:\App" is never confused with "C:\App2".
;
; electron-builder compiles this script twice: once with BUILD_UNINSTALLER defined, to
; produce the standalone uninstaller stub (only uninstaller.nsh's customUnInstall hook
; is reachable there), and once without it, for the real installer. Each pass fatals on
; any Function that isn't called from a reachable macro in that pass, so the functions
; below must stay inside the BUILD_UNINSTALLER block.

!ifdef BUILD_UNINSTALLER

Function un.StrStr
  Exch $R0
  Exch
  Exch $R1
  Push $R2
  Push $R3
  Push $R4
  Push $R5

  StrLen $R2 $R0
  StrLen $R3 $R1
  StrCpy $R4 0

  loop:
    StrCpy $R5 $R1 $R2 $R4
    StrCmp $R5 $R0 done
    IntCmp $R4 $R3 done 0 done
    IntOp $R4 $R4 + 1
    Goto loop
  done:

  StrCpy $R0 $R1 "" $R4

  Pop $R5
  Pop $R4
  Pop $R3
  Pop $R2
  Pop $R1
  Exch $R0
FunctionEnd

; Stack: Push existingList, Push entry, Call, Pop result. Removes every occurrence.
Function un.PathListRemove
  Exch $R0
  Exch
  Exch $R1
  Push $R2
  Push $R3
  Push $R4
  Push $R5
  Push $R6

  PathListRemove_loop:
  StrCmp $R1 "" PathListRemove_end

  StrCpy $R2 ";$R1;"
  Push $R2
  Push ";$R0;"
  Call un.StrStr
  Pop $R3
  StrCmp $R3 "" PathListRemove_end

  StrLen $R4 $R2
  StrLen $R5 $R3
  IntOp $R6 $R4 - $R5
  StrCpy $R4 $R2 $R6

  StrLen $R5 ";$R0;"
  IntOp $R5 $R5 - 1
  StrCpy $R3 $R3 "" $R5

  StrCpy $R1 "$R4$R3"

  StrCmp $R1 ";" PathListRemove_setEmpty
  StrLen $R4 $R1
  IntOp $R4 $R4 - 2
  StrCpy $R1 $R1 $R4 1
  Goto PathListRemove_loop

  PathListRemove_setEmpty:
  StrCpy $R1 ""
  Goto PathListRemove_loop

  PathListRemove_end:
  StrCpy $R0 $R1

  Pop $R6
  Pop $R5
  Pop $R4
  Pop $R3
  Pop $R2
  Pop $R1
  Exch $R0
FunctionEnd

; customUnInstall is spliced inline into electron-builder's own uninstall Section, not
; called as an isolated Function, so $0/$1 here may be values the surrounding vendor
; code is still relying on afterward. Save and restore them rather than clobbering them.
!macro customUnInstall
  Push $0
  Push $1
  ReadRegStr $0 HKCU "Environment" "Path"
  Push $0
  Push "$INSTDIR"
  Call un.PathListRemove
  Pop $1
  StrCmp $1 $0 customUnInstall_pathDone
    WriteRegExpandStr HKCU "Environment" "Path" "$1"
    SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
  customUnInstall_pathDone:
  Pop $1
  Pop $0
!macroend

!endif ; BUILD_UNINSTALLER
