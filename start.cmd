@echo off
setlocal
cd /d "%~dp0"
if not exist web\node_modules (
  call npm.cmd --prefix web ci
  if errorlevel 1 exit /b 1
)
call npm.cmd --prefix web run build
if errorlevel 1 exit /b 1
go run ./cmd/server
