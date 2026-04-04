@echo off
setlocal

set "ROOT=%~dp0"
set "NPM="

for %%P in (npm.cmd) do set "NPM=%%~$PATH:P"

if not defined NPM (
  if exist "%ProgramFiles%\nodejs\npm.cmd" set "NPM=%ProgramFiles%\nodejs\npm.cmd"
)

if not defined NPM (
  if exist "%AppData%\npm\npm.cmd" set "NPM=%AppData%\npm\npm.cmd"
)

if not defined NPM (
  echo npm.cmd not found. Please ensure Node.js is installed and npm is on PATH.
  exit /b 1
)

pushd "%ROOT%"
if errorlevel 1 exit /b 1

call "%NPM%" run lint
if errorlevel 1 (
  popd
  exit /b 1
)

call "%NPM%" run build
set "ERR=%errorlevel%"
popd
exit /b %ERR%
