@echo off
setlocal
if "%VCToolsInstallDir%"=="" (
  if exist "C:\SoraFilesBuildTools\VC\Auxiliary\Build\vcvars64.bat" (
    call "C:\SoraFilesBuildTools\VC\Auxiliary\Build\vcvars64.bat"
  ) else (
    if exist "%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" (
      for /f "usebackq tokens=*" %%i in (`"%ProgramFiles(x86)%\Microsoft Visual Studio\Installer\vswhere.exe" -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath`) do call "%%i\VC\Auxiliary\Build\vcvars64.bat"
    ) else (
      echo Run from an x64 Visual Studio Developer Command Prompt.
      exit /b 1
    )
  )
)
if errorlevel 1 exit /b 1
set "SORA_SHELL_SOURCE=%~dp0"
set "SORA_SHELL_OUTPUT=%~dp0..\..\..\.artifacts\windows-shell"
if not "%~1"=="" set "SORA_SHELL_OUTPUT=%~f1"
if not exist "%SORA_SHELL_OUTPUT%" mkdir "%SORA_SHELL_OUTPUT%"
if errorlevel 1 exit /b 1
cl /nologo /std:c++17 /EHsc /W4 /O2 /MT /DUNICODE /D_UNICODE /guard:cf /LD "%SORA_SHELL_SOURCE%explorer_command.cpp" /Fo"%SORA_SHELL_OUTPUT%\explorer_command.obj" /link /DEF:"%SORA_SHELL_SOURCE%sorafiles-explorer.def" /OUT:"%SORA_SHELL_OUTPUT%\sorafiles-explorer.dll" /IMPLIB:"%SORA_SHELL_OUTPUT%\sorafiles-explorer.lib" /DYNAMICBASE /NXCOMPAT /guard:cf ole32.lib shell32.lib shlwapi.lib uuid.lib
if errorlevel 1 exit /b 1
cl /nologo /std:c++17 /EHsc /W4 /O2 /MT /DUNICODE /D_UNICODE "%SORA_SHELL_SOURCE%tests.cpp" /Fo"%SORA_SHELL_OUTPUT%\tests.obj" /Fe"%SORA_SHELL_OUTPUT%\shell-tests.exe" /link ole32.lib shell32.lib shlwapi.lib uuid.lib
if errorlevel 1 exit /b 1
"%SORA_SHELL_OUTPUT%\shell-tests.exe" "%SORA_SHELL_OUTPUT%\sorafiles-explorer.dll"
exit /b %ERRORLEVEL%
