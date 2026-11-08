$ErrorActionPreference = 'Stop'
$hostsPath = Join-Path $env:WINDIR 'System32\drivers\etc\hosts'
$content = [IO.File]::ReadAllText($hostsPath)
$matching = @($content -split "`r?`n" | Where-Object { ($_ -split '#')[0] -match '(?i)(^|\s)k4binho\.js(\s|$)' })
if ($matching.Count) {
  if ($matching | Where-Object { $_ -notmatch '^\s*127\.0\.0\.1\s' }) { throw 'k4binho.js já está associado a outro endereço no hosts.' }
  Write-Host 'Endereço já configurado: http://k4binho.js'
  exit 0
}
Add-Content -LiteralPath $hostsPath -Value "`r`n127.0.0.1 k4binho.js # K4Bot local" -Encoding ASCII
Write-Host 'Endereço configurado: http://k4binho.js'
