# Start All MuleHunter Services
$ROOT = Split-Path -Parent $MyInvocation.MyCommand.Path

$JAVA_HOME = "$ROOT\.tools\jdk-17.0.20.1+1"
$JAVA_EXE = "$JAVA_HOME\bin\java.exe"

Write-Host "=========================================" -ForegroundColor Cyan
Write-Host "   Starting MULE_HUNTER Stack" -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

# 1. MongoDB (Port 27017)
Write-Host "[1/6] Starting MongoDB (Port 27017)..." -ForegroundColor Yellow
Start-Process -FilePath "$ROOT\.tools\mongodb-win32-x86_64-windows-7.0.14\bin\mongod.exe" `
    -ArgumentList "--dbpath `"$ROOT\.tools\data\db`" --port 27017 --bind_ip 127.0.0.1" `
    -WindowStyle Hidden

Start-Sleep -Seconds 2

# 2. AI Engine (Port 8001)
Write-Host "[2/6] Starting AI Engine (Port 8001)..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c set PYTHONUTF8=1 && cd /d `"$ROOT\ai-engine`" && `".venv\Scripts\python.exe`" -m uvicorn inference_service:app --host 0.0.0.0 --port 8001" `
    -WindowStyle Hidden

# 3. Visual Analytics (Port 8000)
Write-Host "[3/6] Starting Visual Analytics (Port 8000)..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c set PYTHONUTF8=1 && cd /d `"$ROOT\visual-analytics\eif_v_2`" && `".venv\Scripts\python.exe`" -m uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload" `
    -WindowStyle Hidden

# 4. Security Forensics (Port 8081)
Write-Host "[4/6] Starting Security Forensics (Port 8081)..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c set JAVA_HOME=$JAVA_HOME && cd /d `"$ROOT\security-forensics`" && `"$JAVA_EXE`" -jar target\security-forensics-1.0.0.jar" `
    -WindowStyle Hidden

# 5. Backend Orchestrator (Port 8082)
Write-Host "[5/6] Starting Backend Orchestrator (Port 8082)..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c set JAVA_HOME=$JAVA_HOME && cd /d `"$ROOT\backend`" && `"$JAVA_EXE`" -jar target\backend-0.0.1-SNAPSHOT.jar" `
    -WindowStyle Hidden

# 6. Control Tower Frontend (Port 3000)
Write-Host "[6/6] Starting Control Tower UI (Port 3000)..." -ForegroundColor Yellow
Start-Process -FilePath "cmd.exe" `
    -ArgumentList "/c cd /d `"$ROOT\control-tower`" && npm run dev" `
    -WindowStyle Hidden

Write-Host "`nAll services started! Access Dashboard at: http://localhost:3000" -ForegroundColor Green
Write-Host "Demo Credentials: user@test.com / userPassword" -ForegroundColor Cyan
