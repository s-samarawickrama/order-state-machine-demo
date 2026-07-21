# Start Backend
Write-Host "Starting Backend..."
Start-Process -NoNewWindow -FilePath ".venv\Scripts\python.exe" -ArgumentList "main.py"

# Start Frontend
Write-Host "Starting Frontend..."
Set-Location -Path "frontend"
Start-Process -NoNewWindow -FilePath "npm.cmd" -ArgumentList "run dev"
