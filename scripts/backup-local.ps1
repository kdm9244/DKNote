param([string]$OutputDirectory)
$ErrorActionPreference='Stop'
$backupRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
if(-not $OutputDirectory){$OutputDirectory=Join-Path $backupRoot '.local\backups'}
$backupDirectory=Join-Path ([IO.Path]::GetFullPath($OutputDirectory)) (Get-Date -Format 'yyyyMMdd-HHmmss')
New-Item -ItemType Directory -Path $backupDirectory -Force | Out-Null
$backupJdbcRoot=Join-Path $env:USERPROFILE '.m2\repository\org\postgresql\postgresql'
$backupJdbc=Get-ChildItem -LiteralPath $backupJdbcRoot -Filter 'postgresql-*.jar' -File -Recurse | Where-Object {$_.Name -notmatch '-(sources|javadoc)\.jar$'} | Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
if(-not $backupJdbc){throw 'PostgreSQL JDBC 드라이버를 찾을 수 없습니다. 프로젝트를 먼저 빌드하세요.'}
$backupJava=(Get-Command java.exe -ErrorAction Stop).Source
$backupOldPassword=$env:DB_PASSWORD
try {
    $backupPassword=[Environment]::GetEnvironmentVariable('DB_PASSWORD','User')
    if(-not $backupPassword){$backupPassword=$env:DB_PASSWORD}
    $env:DB_PASSWORD=$backupPassword
    # Explicit streams avoid PowerShell native-output redirection failures in nested scripts.
    $backupStart=[Diagnostics.ProcessStartInfo]::new()
    $backupStart.FileName=$backupJava
    $backupStart.UseShellExecute=$false
    $backupStart.CreateNoWindow=$true
    $backupStart.RedirectStandardOutput=$true
    $backupStart.RedirectStandardError=$true
    foreach($backupArg in @('--class-path',$backupJdbc,(Join-Path $PSScriptRoot 'DatabaseSnapshot.java'),'backup',(Join-Path $backupDirectory 'database.sql'))){[void]$backupStart.ArgumentList.Add($backupArg)}
    $backupDump=[Diagnostics.Process]::Start($backupStart)
    try {
        $backupStdout=$backupDump.StandardOutput.ReadToEndAsync()
        $backupStderr=$backupDump.StandardError.ReadToEndAsync()
        $backupDump.WaitForExit()
        $backupDiagnostic=$backupStderr.GetAwaiter().GetResult()
        if($backupDump.ExitCode -ne 0){$backupDiagnostic | Set-Content -LiteralPath (Join-Path $backupDirectory 'backup-error.log') -Encoding utf8;throw 'DB 백업에 실패했습니다. backup-error.log를 확인하세요.'}
        [void]$backupStdout.GetAwaiter().GetResult()
    } finally {$backupDump.Dispose()}
} finally {$env:DB_PASSWORD=$backupOldPassword}
foreach($backupKind in @('learning','feed','checklist')){
    $backupVariable=@{learning='LEARNING_UPLOAD_DIR';feed='FEED_UPLOAD_DIR';checklist='CHECKLIST_UPLOAD_DIR'}[$backupKind]
    $backupSource=[Environment]::GetEnvironmentVariable($backupVariable,'User')
    if(-not $backupSource){$backupSource=[Environment]::GetEnvironmentVariable($backupVariable,'Process')}
    if(-not $backupSource){$backupSource=@{learning=(Join-Path $backupRoot '.local\learning-files');feed=(Join-Path $env:USERPROFILE 'Desktop\project\개인프로젝트\saveData\feed');checklist=(Join-Path $env:USERPROFILE 'Desktop\project\개인프로젝트\saveData\checklist')}[$backupKind]}
    if(Test-Path -LiteralPath $backupSource){Copy-Item -LiteralPath $backupSource -Destination (Join-Path $backupDirectory $backupKind) -Recurse}
}
@{created=(Get-Date).ToString('o');database='travel_planner';format='jdbc-sql';note='Private table schema/data/constraints/indexes. Environment variables are not exported. Database rows can include OAuth tokens.'} | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $backupDirectory 'manifest.json') -Encoding utf8
Write-Output "Backup saved: $backupDirectory"
