$ErrorActionPreference = 'Stop'
$root = $PSScriptRoot
$archive = Join-Path $root 'N_AnhVN-bot.zip'
$files = @('src', 'package.json', '.env.example', '.gitignore', 'README.md', 'create-zip.ps1') | ForEach-Object { Join-Path $root $_ }
Compress-Archive -LiteralPath $files -DestinationPath $archive -Force
Write-Host "Da tao: $archive"
Write-Host 'File .env khong duoc dong goi de bao ve token va mat khau.'