!include "WinMessages.nsh"

; Adds/removes $INSTDIR to/from the current user's PATH (HKCU, since this installer
; is per-user: oneClick + perMachine:false in package.json). If the install mode ever
; changes to per-machine, this needs to target HKLM's Environment key instead.
;
; PathListAdd/PathListRemove operate on a semicolon-delimited list purely as a string
; (no registry access), so the logic can be exercised in isolation. They treat entries
; as whole ;-delimited segments (matching ";$0;" against ";entry;") so "C:\App" is never
; confused with "C:\App2". Verified against 12 cases (empty list, first/middle/last
; add-or-remove, no-op when already present/absent, duplicate cleanup, prefix false
; matches) with a standalone NSIS test harness before wiring this in.
;
; electron-builder compiles this script twice: once with BUILD_UNINSTALLER defined, to
; produce the standalone uninstaller stub (only uninstaller.nsh's customUnInstall hook
; is reachable there), and once without it, for the real installer (only
; installSection.nsh's customInstall hook is reachable there). Each pass fatals on any
; Function that isn't called from a reachable macro in that pass, so the install-side
; and uninstall-side functions must each be scoped to the pass that actually uses them.

!ifndef BUILD_UNINSTALLER

Function StrStr
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

; Stack: Push existingList, Push entry, Call, Pop result.
Function PathListAdd
  Exch $R0
  Exch
  Exch $R1
  Push $R2
  Push $R3

  StrCmp $R1 "" PathListAdd_empty

  StrCpy $R2 ";$R1;"
  Push $R2
  Push ";$R0;"
  Call StrStr
  Pop $R3
  StrCmp $R3 "" PathListAdd_append PathListAdd_existing

  PathListAdd_empty:
  Goto PathListAdd_end

  PathListAdd_append:
  StrCpy $R0 "$R1;$R0"
  Goto PathListAdd_end

  PathListAdd_existing:
  StrCpy $R0 "$R1"

  PathListAdd_end:
  Pop $R3
  Pop $R2
  Pop $R1
  Exch $R0
FunctionEnd

; customInstall is spliced inline into electron-builder's own install Section, not
; called as an isolated Function, so $0/$1 here may be values the surrounding vendor
; code is still relying on afterward. Save and restore them rather than clobbering them.
!macro customInstall
  Push $0
  Push $1
  ReadRegStr $0 HKCU "Environment" "Path"
  Push $0
  Push "$INSTDIR"
  Call PathListAdd
  Pop $1
  StrCmp $1 $0 customInstall_pathDone
    WriteRegExpandStr HKCU "Environment" "Path" "$1"
    SendMessage ${HWND_BROADCAST} ${WM_WININICHANGE} 0 "STR:Environment" /TIMEOUT=5000
  customInstall_pathDone:
  Pop $1
  Pop $0
!macroend

!endif ; !BUILD_UNINSTALLER

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

; See the comment on customInstall above: this runs inline in vendor code too.
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
