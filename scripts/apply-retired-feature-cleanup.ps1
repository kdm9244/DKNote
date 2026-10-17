$ErrorActionPreference='Stop'
$cleanupProjectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$cleanupJar=Join-Path $cleanupProjectRoot 'target\travel-planner-0.0.1-SNAPSHOT.jar'
$cleanupListeners=@(Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
if($cleanupListeners.Count){
    if($cleanupListeners.Count -ne 1){throw '여러 프로세스가 포트를 사용합니다. 중지하지 않았습니다.'}
    $cleanupProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$($cleanupListeners[0])"
    $cleanupMatch=[regex]::Match($cleanupProcess.CommandLine,'(?i)-jar\s+(?:"([^"]+)"|(\S+))')
    $cleanupRunningJar=if($cleanupMatch.Groups[1].Success){$cleanupMatch.Groups[1].Value}else{$cleanupMatch.Groups[2].Value}
    if($cleanupProcess.Name -ne 'java.exe' -or -not $cleanupMatch.Success -or -not [IO.Path]::IsPathRooted($cleanupRunningJar) -or [IO.Path]::GetFullPath($cleanupRunningJar) -ine $cleanupJar){throw '다른 프로그램이 포트를 사용합니다. 중지하지 않았습니다.'}
    Stop-Process -Id $cleanupListeners[0]
    Wait-Process -Id $cleanupListeners[0] -Timeout 10 -ErrorAction SilentlyContinue
}
Push-Location $cleanupProjectRoot
try {
    & (Join-Path $PSScriptRoot 'backup-local.ps1')
    Copy-Item -LiteralPath $cleanupJar -Destination (Join-Path $cleanupProjectRoot '.local\backups\20261011-181938\previous-server.jar') -Force
    $cleanupPreviousPassword=$env:PGPASSWORD
    try {
        $env:PGPASSWORD=[Environment]::GetEnvironmentVariable('DB_PASSWORD','User')
        if(-not $env:PGPASSWORD){$env:PGPASSWORD=$env:DB_PASSWORD}
        & 'C:\Program Files\PostgreSQL\16\bin\psql.exe' -h localhost -U postgres -d travel_planner -v ON_ERROR_STOP=1 -f (Join-Path $PSScriptRoot 'migrations\20261011-remove-retired-features.sql')
        if($LASTEXITCODE -ne 0){throw 'DB 정리 실패. 새 서버를 시작하지 않았습니다.'}
    } finally {$env:PGPASSWORD=$cleanupPreviousPassword}
    & (Join-Path $PSScriptRoot 'start-workspace.ps1') -Build
} finally {Pop-Location}
