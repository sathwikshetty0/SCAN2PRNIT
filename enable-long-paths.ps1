# Run this script as Administrator in PowerShell
# Right-click PowerShell -> "Run as Administrator", then run this file

Write-Host "Enabling Windows Long Path support..." -ForegroundColor Cyan
New-ItemProperty `
  -Path "HKLM:\SYSTEM\CurrentControlSet\Control\FileSystem" `
  -Name "LongPathsEnabled" `
  -Value 1 `
  -PropertyType DWORD `
  -Force

Write-Host "Done! Long paths enabled." -ForegroundColor Green
Write-Host ""
Write-Host "Now run in your normal terminal:" -ForegroundColor Yellow
Write-Host "  cd C:\Projects\scan2p" -ForegroundColor White
Write-Host "  Remove-Item -Recurse -Force node_modules" -ForegroundColor White
Write-Host "  npm install" -ForegroundColor White
Write-Host "  npm run dev" -ForegroundColor White
