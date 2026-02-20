@echo off
SETLOCAL ENABLEDELAYEDEXPANSION


SET APP_DIR=C:\agenda-aziendale
SET BRANCH=MIGRAZIONE_POSTGRESSQL
SET PORT=3000
SET NODE_ENV=production
SET LOG_FILE=%APP_DIR%\update-server.log


echo ============================================================ >> "%LOG_FILE%"
echo [%DATE% %TIME%] Avvio controllo aggiornamenti >> "%LOG_FILE%"
echo ============================================================
echo  AGENDA AZIENDALE - Script di aggiornamento server
echo ============================================================

:: Vai nella cartella del progetto
cd /d "%APP_DIR%"
IF ERRORLEVEL 1 (
    echo [ERRORE] Cartella %APP_DIR% non trovata.
    echo [%DATE% %TIME%] ERRORE: Cartella %APP_DIR% non trovata >> "%LOG_FILE%"
    pause
    exit /b 1
)

:: Recupera l'ultimo commit REMOTO
echo [1/5] Recupero informazioni dal repository remoto...
git fetch origin %BRANCH% >nul 2>&1
IF ERRORLEVEL 1 (
    echo [ERRORE] git fetch fallito. Controlla la connessione e le credenziali.
    echo [%DATE% %TIME%] ERRORE: git fetch fallito >> "%LOG_FILE%"
    pause
    exit /b 1
)

:: Leggi commit locale e remoto
FOR /F "delims=" %%i IN ('git rev-parse HEAD') DO SET LOCAL_COMMIT=%%i
FOR /F "delims=" %%i IN ('git rev-parse origin/%BRANCH%') DO SET REMOTE_COMMIT=%%i

echo  Commit locale:  %LOCAL_COMMIT%
echo  Commit remoto: %REMOTE_COMMIT%
echo [%DATE% %TIME%] Locale: %LOCAL_COMMIT% - Remoto: %REMOTE_COMMIT% >> "%LOG_FILE%"

IF "%LOCAL_COMMIT%"=="%REMOTE_COMMIT%" (
    echo.
    echo [OK] Il progetto e' gia' aggiornato all'ultimo commit.
    echo [%DATE% %TIME%] Progetto aggiornato, nessuna azione necessaria >> "%LOG_FILE%"
    GOTO :AVVIA
)

::AGGIORNAMENTO NECESSARIO 
echo.
echo [!] Trovato nuovo commit. Avvio aggiornamento...
echo [%DATE% %TIME%] Nuovo commit trovato, avvio aggiornamento >> "%LOG_FILE%"

:: Ferma eventuale processo node in esecuzione sulla porta
echo [2/5] Fermo il server in esecuzione (se attivo)...
FOR /F "tokens=5" %%a IN ('netstat -aon ^| findstr :%PORT% ^| findstr LISTENING') DO (
    echo  Termino processo PID: %%a
    taskkill /PID %%a /F >nul 2>&1
)

:: Git pull
echo [3/5] Scarico aggiornamenti (git pull)...
git pull origin %BRANCH%
IF ERRORLEVEL 1 (
    echo [ERRORE] git pull fallito.
    echo [%DATE% %TIME%] ERRORE: git pull fallito >> "%LOG_FILE%"
    pause
    exit /b 1
)
echo [%DATE% %TIME%] git pull completato >> "%LOG_FILE%"

:: npm install (solo se package.json e' cambiato)
echo [4/5] Installo/aggiorno dipendenze (npm install)...
call npm install --production
IF ERRORLEVEL 1 (
    echo [ERRORE] npm install fallito.
    echo [%DATE% %TIME%] ERRORE: npm install fallito >> "%LOG_FILE%"
    pause
    exit /b 1
)
echo [%DATE% %TIME%] npm install completato >> "%LOG_FILE%"

:: Build Next.js
echo [5/5] Build del progetto (npm run build)...
call npm run build
IF ERRORLEVEL 1 (
    echo [ERRORE] Build fallita. Controlla i log qui sopra.
    echo [%DATE% %TIME%] ERRORE: npm run build fallito >> "%LOG_FILE%"
    pause
    exit /b 1
)
echo [%DATE% %TIME%] Build completata >> "%LOG_FILE%"

::  AVVIO 
:AVVIA
echo.
echo [AVVIO] Avvio il server Next.js sulla porta %PORT%...
echo [%DATE% %TIME%] Avvio server su porta %PORT% >> "%LOG_FILE%"

:: Carica le variabili d'ambiente dal file .env.local (se esiste)
IF EXIST "%APP_DIR%\.env.local" (
    FOR /F "usebackq tokens=1,2 delims==" %%a IN ("%APP_DIR%\.env.local") DO (
        IF NOT "%%a"=="" IF NOT "%%a:~0,1%"=="#" SET %%a=%%b
    )
    echo  Variabili d'ambiente caricate da .env.local
)

SET PORT=%PORT%
SET NODE_ENV=%NODE_ENV%

:: Avvia in una nuova finestra cmd che rimane aperta
start "Agenda Aziendale" cmd /k "cd /d %APP_DIR% && npm run start -- -p %PORT%"

echo.
echo ============================================================
echo  Server avviato! Apri il browser su: http://localhost:%PORT%
echo  Chiudi la finestra 'Agenda Aziendale' per fermare il server.
echo ============================================================
echo [%DATE% %TIME%] Server avviato con successo >> "%LOG_FILE%"

ENDLOCAL
exit /b 0
