@echo off
chcp 65001 >nul
title MediTurno - Servidor (NO cierres esta ventana)
cd /d "%~dp0"
echo ==========================================
echo    MediTurno - iniciando todo...
echo ==========================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [X] Falta Node.js. Instalalo desde https://nodejs.org ^(boton LTS^),
  echo     reinicia la compu y vuelve a abrir este archivo.
  pause
  exit /b
)

rem --- 1) MySQL: si no esta encendido, lo enciende (XAMPP) ---
netstat -ano | findstr ":3306" | findstr "LISTENING" >nul
if errorlevel 1 (
  if exist "C:\xampp\mysql\bin\mysqld.exe" (
    echo Encendiendo MySQL de XAMPP...
    start "MySQL" /min "C:\xampp\mysql\bin\mysqld.exe" --defaults-file="C:\xampp\mysql\bin\my.ini" --standalone --console
    timeout /t 10 /nobreak >nul
  ) else (
    echo [X] No encuentro MySQL. Instala XAMPP ^(apachefriends.org^) en C:\xampp
    echo     y vuelve a abrir este archivo.
    pause
    exit /b
  )
)

rem --- 2) Dependencias: solo la primera vez (necesita internet) ---
if not exist node_modules (
  echo Instalando dependencias ^(solo la primera vez, necesita internet^)...
  call npm install
  if errorlevel 1 (
    echo [X] Fallo la instalacion. Revisa tu internet y vuelve a intentar.
    pause
    exit /b
  )
)

rem --- 3) Configuracion ---
if not exist .env copy .env.example .env >nul

echo.
echo Iniciando servidor... en unos segundos se abre el navegador.
echo.
start "" /min cmd /c "timeout /t 6 /nobreak >nul & start http://localhost:3000"
call npm start
echo.
echo El servidor se detuvo. Si fue por un error, leelo arriba.
pause
