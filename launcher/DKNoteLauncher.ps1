Add-Type -AssemblyName System.Windows.Forms
Add-Type -AssemblyName System.Drawing

[System.Windows.Forms.Application]::EnableVisualStyles()

$projectPath = Join-Path $PSScriptRoot 'travel-planner'
$jarPath = Join-Path $projectPath 'target\travel-planner-0.0.1-SNAPSHOT.jar'
$runtimePath = Join-Path $PSScriptRoot 'saveData\runtime'
$pidPath = Join-Path $runtimePath 'dknote-server.json'
$stdoutPath = Join-Path $runtimePath 'dknote-server.log'
$stderrPath = Join-Path $runtimePath 'dknote-server-error.log'
# Public entry point used by the launcher's "Open DKNote" button.
# The local address remains intentionally separate below for server health checks.
$serverUrl = 'https://dknote.tech/'

function Get-JavaPath {
    if ($env:JAVA_HOME) {
        $javaFromHome = Join-Path $env:JAVA_HOME 'bin\java.exe'
        if (Test-Path -LiteralPath $javaFromHome) {
            return $javaFromHome
        }
    }

    $javaCommand = Get-Command 'java.exe' -ErrorAction SilentlyContinue
    if ($javaCommand) {
        return $javaCommand.Source
    }

    return $null
}

function Get-DKNoteProcess {
    if (-not (Test-Path -LiteralPath $pidPath)) {
        return $null
    }

    try {
        $saved = Get-Content -LiteralPath $pidPath -Raw | ConvertFrom-Json
        $process = Get-Process -Id ([int]$saved.Pid) -ErrorAction Stop
        $startTicks = $process.StartTime.ToUniversalTime().Ticks
        if ($startTicks -ne [long]$saved.StartTicks) {
            Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
            return $null
        }
        return $process
    }
    catch {
        Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
        return $null
    }
}

function Save-DKNoteProcess([System.Diagnostics.Process]$process) {
    New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
    $process.Refresh()
    @{
        Pid = $process.Id
        StartTicks = $process.StartTime.ToUniversalTime().Ticks
    } | ConvertTo-Json | Set-Content -LiteralPath $pidPath -Encoding ASCII
}

function Find-RunningDKNoteProcess {
    try {
        $jarName = [IO.Path]::GetFileName($jarPath)
        $candidate = Get-CimInstance Win32_Process -Filter "Name = 'java.exe'" -ErrorAction Stop |
            Where-Object { $_.CommandLine -and $_.CommandLine.Contains($jarName) } |
            Select-Object -First 1

        if (-not $candidate) {
            return $null
        }

        $process = Get-Process -Id $candidate.ProcessId -ErrorAction Stop
        Save-DKNoteProcess $process
        return $process
    }
    catch {
        return $null
    }
}

function Test-ServerPort {
    $client = New-Object System.Net.Sockets.TcpClient
    try {
        $connect = $client.BeginConnect('127.0.0.1', 8080, $null, $null)
        if (-not $connect.AsyncWaitHandle.WaitOne(250)) {
            return $false
        }
        $client.EndConnect($connect)
        return $true
    }
    catch {
        return $false
    }
    finally {
        $client.Close()
    }
}

function Show-LauncherMessage([string]$message, [string]$title = 'DKNote Launcher') {
    [System.Windows.Forms.MessageBox]::Show(
        $form,
        $message,
        $title,
        [System.Windows.Forms.MessageBoxButtons]::OK,
        [System.Windows.Forms.MessageBoxIcon]::Information
    ) | Out-Null
}

function Update-ServerStatus {
    $portOpen = Test-ServerPort
    $process = Get-DKNoteProcess
    if (-not $process -and $portOpen) {
        $process = Find-RunningDKNoteProcess
    }

    if ($process -and $portOpen) {
        $statusLabel.Text = "RUNNING  |  PID $($process.Id)  |  PORT 8080"
        $statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(20, 125, 105)
        $statusDot.BackColor = [System.Drawing.Color]::FromArgb(52, 211, 153)
        $startButton.Enabled = $false
        $stopButton.Enabled = $true
        $openButton.Enabled = $true
        return
    }

    if ($process) {
        $statusLabel.Text = "STARTING  |  PID $($process.Id)"
        $statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(43, 116, 144)
        $statusDot.BackColor = [System.Drawing.Color]::FromArgb(125, 211, 252)
        $startButton.Enabled = $false
        $stopButton.Enabled = $true
        $openButton.Enabled = $false
        return
    }

    if ($portOpen) {
        $statusLabel.Text = 'PORT 8080 IS USED BY ANOTHER PROGRAM'
        $statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(190, 75, 60)
        $statusDot.BackColor = [System.Drawing.Color]::FromArgb(251, 146, 60)
        $startButton.Enabled = $false
        $stopButton.Enabled = $false
        $openButton.Enabled = $true
        return
    }

    $statusLabel.Text = 'STOPPED'
    $statusLabel.ForeColor = [System.Drawing.Color]::FromArgb(100, 116, 139)
    $statusDot.BackColor = [System.Drawing.Color]::FromArgb(203, 213, 225)
    $startButton.Enabled = $true
    $stopButton.Enabled = $false
    $openButton.Enabled = $false
}

function Start-DKNoteServer {
    if (Get-DKNoteProcess) {
        Show-LauncherMessage 'DKNote server is already running.'
        return
    }

    if (Test-ServerPort) {
        Show-LauncherMessage 'Port 8080 is already used by another program. Stop that program first.' 'Cannot start server'
        return
    }

    if (-not (Test-Path -LiteralPath $jarPath)) {
        Show-LauncherMessage "The application file was not found.`n`n$jarPath`n`nBuild the Maven package first." 'JAR file not found'
        return
    }

    $javaPath = Get-JavaPath
    if (-not $javaPath) {
        Show-LauncherMessage 'Java was not found. Check JAVA_HOME or install Java 21.' 'Java not found'
        return
    }

    New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null

    try {
        $process = Start-Process `
            -FilePath $javaPath `
            -ArgumentList @('-jar', ('"{0}"' -f $jarPath)) `
            -WorkingDirectory $projectPath `
            -WindowStyle Hidden `
            -RedirectStandardOutput $stdoutPath `
            -RedirectStandardError $stderrPath `
            -PassThru

        Save-DKNoteProcess $process

        Update-ServerStatus
    }
    catch {
        Show-LauncherMessage "The server could not be started.`n`n$($_.Exception.Message)" 'Start failed'
    }
}

function Stop-DKNoteServer {
    $process = Get-DKNoteProcess
    if (-not $process) {
        Update-ServerStatus
        Show-LauncherMessage 'DKNote server is not running.'
        return
    }

    $answer = [System.Windows.Forms.MessageBox]::Show(
        $form,
        'Stop the DKNote server now?',
        'Stop server',
        [System.Windows.Forms.MessageBoxButtons]::YesNo,
        [System.Windows.Forms.MessageBoxIcon]::Question
    )

    if ($answer -ne [System.Windows.Forms.DialogResult]::Yes) {
        return
    }

    try {
        Stop-Process -Id $process.Id -ErrorAction Stop
        $process.WaitForExit(5000) | Out-Null
        Remove-Item -LiteralPath $pidPath -Force -ErrorAction SilentlyContinue
    }
    catch {
        Show-LauncherMessage "The server could not be stopped.`n`n$($_.Exception.Message)" 'Stop failed'
    }
    finally {
        Update-ServerStatus
    }
}

$form = New-Object System.Windows.Forms.Form
$form.Text = 'DKNote Server Launcher'
$form.StartPosition = 'CenterScreen'
$form.ClientSize = New-Object System.Drawing.Size(560, 350)
$form.FormBorderStyle = [System.Windows.Forms.FormBorderStyle]::FixedSingle
$form.MaximizeBox = $false
$form.BackColor = [System.Drawing.Color]::FromArgb(241, 248, 252)
$form.Font = New-Object System.Drawing.Font('Segoe UI', 10)

$header = New-Object System.Windows.Forms.Panel
$header.Location = New-Object System.Drawing.Point(0, 0)
$header.Size = New-Object System.Drawing.Size(560, 94)
$header.BackColor = [System.Drawing.Color]::FromArgb(224, 242, 254)
$form.Controls.Add($header)

$title = New-Object System.Windows.Forms.Label
$title.Text = 'DKNote'
$title.Location = New-Object System.Drawing.Point(28, 18)
$title.AutoSize = $true
$title.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 24)
$title.ForeColor = [System.Drawing.Color]::FromArgb(15, 80, 105)
$header.Controls.Add($title)

$subtitle = New-Object System.Windows.Forms.Label
$subtitle.Text = 'Personal server control'
$subtitle.Location = New-Object System.Drawing.Point(31, 60)
$subtitle.AutoSize = $true
$subtitle.ForeColor = [System.Drawing.Color]::FromArgb(71, 112, 130)
$header.Controls.Add($subtitle)

$statusCard = New-Object System.Windows.Forms.Panel
$statusCard.Location = New-Object System.Drawing.Point(28, 116)
$statusCard.Size = New-Object System.Drawing.Size(504, 60)
$statusCard.BackColor = [System.Drawing.Color]::White
$statusCard.BorderStyle = [System.Windows.Forms.BorderStyle]::FixedSingle
$form.Controls.Add($statusCard)

$statusDot = New-Object System.Windows.Forms.Panel
$statusDot.Location = New-Object System.Drawing.Point(19, 21)
$statusDot.Size = New-Object System.Drawing.Size(16, 16)
$statusCard.Controls.Add($statusDot)

$statusLabel = New-Object System.Windows.Forms.Label
$statusLabel.Location = New-Object System.Drawing.Point(48, 18)
$statusLabel.Size = New-Object System.Drawing.Size(430, 24)
$statusLabel.Font = New-Object System.Drawing.Font('Segoe UI Semibold', 10)
$statusCard.Controls.Add($statusLabel)

$startButton = New-Object System.Windows.Forms.Button
$startButton.Text = 'Start Server'
$startButton.Location = New-Object System.Drawing.Point(28, 200)
$startButton.Size = New-Object System.Drawing.Size(156, 48)
$startButton.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$startButton.BackColor = [System.Drawing.Color]::FromArgb(14, 116, 144)
$startButton.ForeColor = [System.Drawing.Color]::White
$startButton.FlatAppearance.BorderSize = 0
$startButton.Add_Click({ Start-DKNoteServer })
$form.Controls.Add($startButton)

$stopButton = New-Object System.Windows.Forms.Button
$stopButton.Text = 'Stop Server'
$stopButton.Location = New-Object System.Drawing.Point(202, 200)
$stopButton.Size = New-Object System.Drawing.Size(156, 48)
$stopButton.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$stopButton.BackColor = [System.Drawing.Color]::FromArgb(226, 232, 240)
$stopButton.ForeColor = [System.Drawing.Color]::FromArgb(51, 65, 85)
$stopButton.FlatAppearance.BorderSize = 0
$stopButton.Add_Click({ Stop-DKNoteServer })
$form.Controls.Add($stopButton)

$openButton = New-Object System.Windows.Forms.Button
$openButton.Text = 'Open DKNote (dknote.tech)'
$openButton.Location = New-Object System.Drawing.Point(376, 200)
$openButton.Size = New-Object System.Drawing.Size(156, 48)
$openButton.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$openButton.BackColor = [System.Drawing.Color]::FromArgb(56, 189, 248)
$openButton.ForeColor = [System.Drawing.Color]::White
$openButton.FlatAppearance.BorderSize = 0
$openButton.Add_Click({
    # Always open the public Cloudflare address, not the local server address.
    Start-Process -FilePath $serverUrl
})
$form.Controls.Add($openButton)

$logButton = New-Object System.Windows.Forms.Button
$logButton.Text = 'Open Logs'
$logButton.Location = New-Object System.Drawing.Point(28, 270)
$logButton.Size = New-Object System.Drawing.Size(120, 36)
$logButton.FlatStyle = [System.Windows.Forms.FlatStyle]::Flat
$logButton.BackColor = [System.Drawing.Color]::White
$logButton.FlatAppearance.BorderColor = [System.Drawing.Color]::FromArgb(186, 211, 224)
$logButton.Add_Click({
    New-Item -ItemType Directory -Path $runtimePath -Force | Out-Null
    Start-Process explorer.exe $runtimePath
})
$form.Controls.Add($logButton)

$note = New-Object System.Windows.Forms.Label
$note.Text = 'You can close this launcher. The server will keep running.'
$note.Location = New-Object System.Drawing.Point(168, 278)
$note.Size = New-Object System.Drawing.Size(364, 24)
$note.TextAlign = [System.Drawing.ContentAlignment]::MiddleRight
$note.ForeColor = [System.Drawing.Color]::FromArgb(100, 116, 139)
$form.Controls.Add($note)

$timer = New-Object System.Windows.Forms.Timer
$timer.Interval = 1500
$timer.Add_Tick({ Update-ServerStatus })
$timer.Start()

$form.Add_Shown({ Update-ServerStatus })
$form.Add_FormClosed({ $timer.Stop(); $timer.Dispose() })

[void]$form.ShowDialog()
