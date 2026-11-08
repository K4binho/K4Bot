$ErrorActionPreference='Continue'
$botRoot='E:\projetos\K4Bot'
$mutex=[System.Threading.Mutex]::new($false,'Local\K4Bot-Launcher')
if(-not $mutex.WaitOne(0)){exit 0}
try {
  while ($true) {
    $proc=Start-Process -FilePath 'npm.cmd' -ArgumentList 'start' -WorkingDirectory $botRoot -WindowStyle Hidden -PassThru
    $proc.WaitForExit()
    Start-Sleep -Seconds 10
  }
} finally {
  $mutex.ReleaseMutex()
  $mutex.Dispose()
}
