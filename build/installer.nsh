; Menu klik kanan Folder Frog (tanpa hak admin, HKCU)
!define FFK "Software\Classes\Directory\shell\FolderFrog"
!macro FF id verb color label flags
  WriteRegStr HKCU "${FFK}\shell\${id}" "MUIVerb" "${verb}"
  WriteRegDWORD HKCU "${FFK}\shell\${id}" "CommandFlags" ${flags}
  WriteRegStr HKCU "${FFK}\shell\${id}\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --quick "%1" ${color} "${label}"'
!macroend
!macro customInstall
  ; Simpan bahasa pilihan installer
  Push $R9
  StrCpy $R9 "en"
  StrCmp $LANGUAGE 1057 0 +2
    StrCpy $R9 "id"
  StrCmp $LANGUAGE 2052 0 +2
    StrCpy $R9 "zh"
  StrCmp $LANGUAGE 1041 0 +2
    StrCpy $R9 "ja"
  StrCmp $LANGUAGE 1042 0 +2
    StrCpy $R9 "ko"
  StrCmp $LANGUAGE 3082 0 +2
    StrCpy $R9 "es"
  StrCmp $LANGUAGE 1034 0 +2
    StrCpy $R9 "es"
  StrCmp $LANGUAGE 1036 0 +2
    StrCpy $R9 "fr"
  StrCmp $LANGUAGE 1031 0 +2
    StrCpy $R9 "de"
  StrCmp $LANGUAGE 1046 0 +2
    StrCpy $R9 "pt"
  StrCmp $LANGUAGE 2070 0 +2
    StrCpy $R9 "pt"
  StrCmp $LANGUAGE 1025 0 +2
    StrCpy $R9 "ar"
  WriteRegStr HKCU "Software\FolderFrog" "Lang" "$R9"
  Pop $R9
  WriteRegStr HKCU "${FFK}" "MUIVerb" "Folder Frog"
  WriteRegStr HKCU "${FFK}" "Icon" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}",0'
  WriteRegStr HKCU "${FFK}" "SubCommands" ""
  WriteRegStr HKCU "${FFK}\shell\01open" "MUIVerb" "Choose color and label..."
  WriteRegStr HKCU "${FFK}\shell\01open\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" "%1"'
  !insertmacro FF "02todo" "To Do" "#3b82f6" "To Do" 32
  !insertmacro FF "03prog" "On Progress" "#f97316" "On Progress" 0
  !insertmacro FF "04wait" "Waiting Feedback" "#eab308" "Waiting Feedback" 0
  !insertmacro FF "05rev" "Revision" "#a855f7" "Revision" 0
  !insertmacro FF "06cancel" "Cancel" "#ef4444" "Cancel" 0
  !insertmacro FF "07fa" "FA" "#22c55e" "FA" 0
  WriteRegStr HKCU "${FFK}\shell\08reset" "MUIVerb" "Reset to default"
  WriteRegDWORD HKCU "${FFK}\shell\08reset" "CommandFlags" 32
  WriteRegStr HKCU "${FFK}\shell\08reset\command" "" '"$INSTDIR\${APP_EXECUTABLE_FILENAME}" --reset "%1"'
!macroend
!macro customUnInstall
  DeleteRegKey HKCU "${FFK}"
  DeleteRegKey HKCU "Software\FolderFrog"
!macroend
