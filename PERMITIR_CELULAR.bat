@echo off
chcp 65001 >nul
title Permitir celular
net session >nul 2>&1
if errorlevel 1 (
  echo Este archivo se abre con CLIC DERECHO - Ejecutar como administrador.
  pause
  exit /b
)
netsh advfirewall firewall delete rule name="MediTurno 3000" >nul 2>&1
netsh advfirewall firewall add rule name="MediTurno 3000" dir=in action=allow protocol=TCP localport=3000 profile=any
echo.
echo Listo: el celular ya puede entrar al puerto 3000 de esta compu.
pause
