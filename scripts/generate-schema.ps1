$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$generatedSchema = Join-Path $projectRoot 'target\schema-current.sql'
$documentedSchema = Join-Path $projectRoot 'src\main\resources\db\schema-current.sql'
$localRepository = Join-Path $env:USERPROFILE '.m2\repository'
$installedMaven = Get-Command 'mvn.cmd' -ErrorAction SilentlyContinue
if ($installedMaven) {
    $mavenCommand = $installedMaven.Source
} else {
    $wrapperDists = Join-Path $env:USERPROFILE '.m2\wrapper\dists'
    $mavenCommand = Get-ChildItem -Path $wrapperDists -Recurse -Filter 'mvn.cmd' -File -ErrorAction SilentlyContinue |
        Sort-Object { $_.FullName.Length } |
        Select-Object -First 1 -ExpandProperty FullName
}

if (-not $mavenCommand) {
    throw 'Maven was not found. Run mvnw.cmd once, then try again.'
}

if (Test-Path -LiteralPath $generatedSchema) {
    Remove-Item -LiteralPath $generatedSchema -Force
}

& $mavenCommand "-Dmaven.repo.local=$localRepository" '-Dtest=SchemaDocumentationTest' '-Dgenerate.schema=true' test
if ($LASTEXITCODE -ne 0) {
    throw "JPA DDL generation failed. Exit code: $LASTEXITCODE"
}

if (-not (Test-Path -LiteralPath $generatedSchema)) {
    throw 'Hibernate did not create the DDL file.'
}

Copy-Item -LiteralPath $generatedSchema -Destination $documentedSchema -Force
Write-Host "Generated current JPA DDL: $documentedSchema"
