param()
$ErrorActionPreference='Stop'
$secretProjectRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..'))
$secretCandidates=@{}
foreach($secretName in @('GEMINI_API_KEY','KIS_APP_SECRET','GOOGLE_CLIENT_SECRET','DB_PASSWORD','JWT_SECRET')) {
    foreach($secretScope in @('User','Process')){
        $secretValue=[Environment]::GetEnvironmentVariable($secretName,$secretScope)
        if($secretValue -and $secretValue.Length -ge 12){$secretCandidates["$secretName/$secretScope"]=$secretValue}
    }
}
$secretFound=$false
foreach($clientDirectory in @('frontend/dist','src/main/resources/static','target/classes/static')){
    $clientRoot=Join-Path $secretProjectRoot $clientDirectory
    if(-not(Test-Path -LiteralPath $clientRoot)){continue}
    Get-ChildItem -LiteralPath $clientRoot -File -Recurse | Where-Object {$_.Extension -in '.js','.html','.json'} | ForEach-Object {
        $clientText=[IO.File]::ReadAllText($_.FullName)
        foreach($secretLabel in $secretCandidates.Keys){if($clientText.Contains($secretCandidates[$secretLabel])){Write-Output "FAIL: $secretLabel found in $($_.Name)";$secretFound=$true}}
    }
}
if($secretFound){throw 'Client output contains a server secret. Values have not been printed.'}
Write-Output 'PASS: No configured server secrets appear in client output.'
