$ErrorActionPreference='Stop'
$travelProjectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$travelJar=Join-Path $travelProjectRoot 'target\travel-planner-0.0.1-SNAPSHOT.jar'
$travelListeners=@(Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
if($travelListeners.Count){
    if($travelListeners.Count -ne 1){throw '여러 프로세스가 8080을 사용합니다. 중단하지 않았습니다.'}
    $travelProcess=Get-CimInstance Win32_Process -Filter "ProcessId=$($travelListeners[0])"
    $travelMatch=[regex]::Match($travelProcess.CommandLine,'(?i)-jar\s+(?:"([^"]+)"|(\S+))')
    $travelRunningJar=if($travelMatch.Groups[1].Success){$travelMatch.Groups[1].Value}else{$travelMatch.Groups[2].Value}
    if($travelProcess.Name -ne 'java.exe' -or -not $travelMatch.Success -or -not [IO.Path]::IsPathRooted($travelRunningJar) -or [IO.Path]::GetFullPath($travelRunningJar) -ine $travelJar){throw '다른 프로그램이 포트를 사용합니다. 중단하지 않았습니다.'}
    Stop-Process -Id $travelListeners[0]
    Wait-Process -Id $travelListeners[0] -Timeout 10 -ErrorAction SilentlyContinue
}
Push-Location $travelProjectRoot
try {
    & (Join-Path $PSScriptRoot 'backup-local.ps1')
    if(Test-Path -LiteralPath $travelJar){Copy-Item -LiteralPath $travelJar -Destination (Join-Path $travelProjectRoot '.local\backups\20261011-143003\previous-server.jar') -Force}
    $travelPriorPgPassword=$env:PGPASSWORD
    try {
        $env:PGPASSWORD=[Environment]::GetEnvironmentVariable('DB_PASSWORD','User')
        if(-not $env:PGPASSWORD){$env:PGPASSWORD=$env:DB_PASSWORD}
        foreach($travelSql in @('20261011-personal-travel.sql','20261011-personal-checklist.sql')){
            & 'C:\Program Files\PostgreSQL\16\bin\psql.exe' -h localhost -U postgres -d travel_planner -v ON_ERROR_STOP=1 -f (Join-Path $PSScriptRoot "migrations\$travelSql")
            if($LASTEXITCODE -ne 0){throw "여행 DB 전환 실패: $travelSql. 새 서버를 시작하지 않았습니다."}
        }
    } finally {$env:PGPASSWORD=$travelPriorPgPassword}
    & (Join-Path $PSScriptRoot 'start-workspace.ps1') -Build
} finally {Pop-Location}
