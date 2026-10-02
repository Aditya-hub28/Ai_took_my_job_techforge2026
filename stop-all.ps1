# Stop All MuleHunter Services
Write-Host "Stopping MuleHunter services..." -ForegroundColor Yellow

# Kill node (Next.js)
Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object { $_.CommandLine -like "*next*" -or $_.Path -like "*nodejs*" } | Stop-Process -Force -ErrorAction SilentlyContinue

# Kill python (FastAPI services)
Get-Process -Name "python" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*MULETRACE*" } | Stop-Process -Force -ErrorAction SilentlyContinue

# Kill java (Spring Boot jars)
Get-Process -Name "java" -ErrorAction SilentlyContinue | Where-Object { $_.Path -like "*MULETRACE*" } | Stop-Process -Force -ErrorAction SilentlyContinue

# Kill mongod
Get-Process -Name "mongod" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue

Write-Host "All MuleHunter services stopped." -ForegroundColor Green
