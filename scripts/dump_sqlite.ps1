$stamp = Get-Date -Format "yyyy-MM-dd_HHmmss"
$src = "data\catalog.sqlite"
$dst = "exports\backup_$stamp.sqlite"
New-Item -ItemType Directory -Force exports | Out-Null
Copy-Item $src $dst -Force
Write-Host "Backup written to $dst"
