param([switch]$WhatIf)
$ErrorActionPreference='SilentlyContinue'
$all=@(Get-CimInstance Win32_Process)
$roots=@($all | Where-Object {
  $_.Name -in @('powershell.exe','pwsh.exe') -and
  $_.CommandLine -match '(?i)E:\\projetos\\K4Bot\\iniciar-bot\.ps1'
})
if(-not $roots.Count){Write-Output 'Nenhum iniciador do K4Bot foi encontrado.';exit 0}

$depth=@{}
foreach($root in $roots){$depth[[int]$root.ProcessId]=0}
$changed=$true
while($changed){
  $changed=$false
  foreach($proc in $all){
    $parent=[int]$proc.ParentProcessId
    if($depth.ContainsKey($parent) -and -not $depth.ContainsKey([int]$proc.ProcessId)){
      $depth[[int]$proc.ProcessId]=$depth[$parent]+1
      $changed=$true
    }
  }
}

$targets=@($depth.Keys | Sort-Object {-$depth[$_]})
if($WhatIf){
  foreach($id in $targets){$proc=$all | Where-Object ProcessId -eq $id | Select-Object -First 1;Write-Output ("SIMULAÇÃO PID {0} [{1}]: {2}" -f $id,$proc.Name,$proc.CommandLine)}
  exit 0
}
foreach($id in $targets){Stop-Process -Id $id -Force}
Start-Sleep -Seconds 2
$remaining=Get-CimInstance Win32_Process | Where-Object {
  $_.Name -in @('powershell.exe','pwsh.exe') -and
  $_.CommandLine -match '(?i)E:\\projetos\\K4Bot\\iniciar-bot\.ps1'
}
if($remaining){Write-Output 'Ainda há processos de inicialização do K4Bot ativos.';exit 1}
Write-Output ('K4Bot encerrado. Processos parados: '+$targets.Count)
