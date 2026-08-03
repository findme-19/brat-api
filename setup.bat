@echo off
REM Brat API - setup script (Windows)
setlocal

echo ==> Brat API setup

REM Node >= 18 required
where node >nul 2>nul
if errorlevel 1 (
  echo ERROR: Node.js not found. Install Node 18+ first: https://nodejs.org
  exit /b 1
)
for /f "tokens=*" %%i in ('node -v') do echo Node: %%i

REM Install npm deps
echo ==> npm install
call npm install

REM Playwright chromium
echo ==> playwright install chromium
call npx playwright install chromium

REM ffmpeg (needed for /bratvid, /bratvid-realtime, /canvas)
where ffmpeg >nul 2>nul
if errorlevel 1 (
  echo ==> ffmpeg not found. Video endpoints ^(/bratvid, /canvas^) need it.
  echo    Install from https://ffmpeg.org/download.html and add to PATH.
  echo    Continuing anyway — image endpoints will work without it.
) else (
  echo ffmpeg found
)

echo.
echo ==> Setup done. Run with:
echo    npm start          REM production (node app.js)
echo    npm run dev        REM dev (same, PORT env optional)
echo.
echo    Open http://localhost:3000/dashboard for the live playground.
endlocal
