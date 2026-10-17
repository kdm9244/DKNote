param([switch]$Build,[switch]$Restart,[ValidateRange(1024,65535)][int]$Port=8080)
$ErrorActionPreference='Stop'
$projectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$jarPath=Join-Path $projectRoot 'target\travel-planner-0.0.1-SNAPSHOT.jar'
$runtimeRoot=Join-Path $projectRoot '.local\runtime'
# Refresh only this launch process; do not change Windows user or system variables.
foreach($name in @('JAVA_HOME','JWT_SECRET','DB_JDBC_URL','DB_USERNAME','DB_PASSWORD','GOOGLE_CLIENT_ID','GOOGLE_CLIENT_SECRET','GEMINI_API_KEY','OLLAMA_BASE_URL','OLLAMA_AUTH_TOKEN','OLLAMA_ALLOWED_MODELS','OLLAMA_MAX_OUTPUT_TOKENS','OLLAMA_CONTEXT_TOKENS','OLLAMA_GENERATION_TIMEOUT_SECONDS','APP_PUBLIC_URL','APP_ALLOWED_ORIGINS','KIS_APP_KEY','KIS_APP_SECRET','FEED_UPLOAD_DIR','CHECKLIST_UPLOAD_DIR','LEARNING_UPLOAD_DIR','ALLOWED_LOGIN_EMAILS','SIGNUP_ENABLED','CLOUDFLARE_ACCESS_REQUIRED','CLOUDFLARE_ACCESS_ISSUER','CLOUDFLARE_ACCESS_AUDIENCE')) {
    $value=[Environment]::GetEnvironmentVariable($name,'User')
    if(-not [string]::IsNullOrWhiteSpace($value)){[Environment]::SetEnvironmentVariable($name,$value,'Process')}
}
if($Build) {
    # Build the browser first; leave the running server available if the build fails.
    Push-Location (Join-Path $projectRoot 'frontend')
    try {
        & npm.cmd run build
        if($LASTEXITCODE -ne 0){throw 'Frontend build failed; the running server was not stopped.'}
    } finally {Pop-Location}
}
$listeners=@(Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -Unique)
if($listeners.Count) {
    if(-not $Restart){throw "Port $Port is already in use. Use -Restart only to restart this project's JAR."}
    if($listeners.Count -ne 1){throw 'Multiple processes own the port; no process was stopped.'}
    $candidate=Get-CimInstance Win32_Process -Filter "ProcessId = $($listeners[0])"
    $match=[regex]::Match($candidate.CommandLine,'(?i)-jar\s+(?:"([^"]+)"|(\S+))')
    $candidateJar=if($match.Groups[1].Success){$match.Groups[1].Value}else{$match.Groups[2].Value}
    if($candidate.Name -ne 'java.exe' -or -not $match.Success -or -not [IO.Path]::IsPathRooted($candidateJar) -or [IO.Path]::GetFullPath($candidateJar) -ine $jarPath){throw 'The port belongs to another application; no process was stopped.'}
    Stop-Process -Id $listeners[0]
    Wait-Process -Id $listeners[0] -Timeout 10 -ErrorAction SilentlyContinue
}
# Windows keeps a running executable JAR locked, so package after the checked restart.
if($Build) {
    Push-Location $projectRoot
    try {
        & (Join-Path $projectRoot 'mvnw.cmd') '-DskipTests' 'clean' 'package'
        if($LASTEXITCODE -ne 0){throw 'Maven packaging failed; server was not started. Check the build output.'}
    } finally {Pop-Location}
}
if(-not(Test-Path -LiteralPath $jarPath)){throw 'Build the project before starting the server.'}
$javaPath=if($env:JAVA_HOME -and (Test-Path -LiteralPath (Join-Path $env:JAVA_HOME 'bin\java.exe'))){Join-Path $env:JAVA_HOME 'bin\java.exe'}else{(Get-Command java.exe).Source}
New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
$stdout=Join-Path $runtimeRoot 'workspace.out.log'
$stderr=Join-Path $runtimeRoot 'workspace.err.log'
$process=Start-Process -FilePath $javaPath -ArgumentList '-jar',('"'+$jarPath+'"'),("--server.port=$Port") -WorkingDirectory $projectRoot -WindowStyle Hidden -RedirectStandardOutput $stdout -RedirectStandardError $stderr -PassThru
[pscustomobject]@{Pid=$process.Id;URL="http://localhost:$Port";Stdout=$stdout;Stderr=$stderr}
