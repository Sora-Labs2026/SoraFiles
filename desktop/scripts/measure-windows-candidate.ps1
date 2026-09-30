param([Parameter(Mandatory=$true)][string]$Binary)
$ErrorActionPreference='Stop'
$soraBinary=(Resolve-Path -LiteralPath $Binary).Path
$soraRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$soraArtifact=Join-Path $soraRoot '.artifacts'
$soraRun=Join-Path $soraArtifact ('native-metrics-'+[Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $soraRun | Out-Null
$soraReport=Join-Path $soraRun 'smoke.json'
$soraStderr=Join-Path $soraRun 'stderr.log'
$soraSamples=[Collections.Generic.List[object]]::new()
$soraWatch=[Diagnostics.Stopwatch]::StartNew()
$soraFirstView=$null
$soraProcess=Start-Process -FilePath $soraBinary -ArgumentList @('--native-smoke',('"'+$soraReport+'"')) -WindowStyle Hidden -PassThru -RedirectStandardOutput (Join-Path $soraRun 'stdout.log') -RedirectStandardError $soraStderr
try {
    while (!$soraProcess.HasExited) {
        if ($soraWatch.Elapsed.TotalSeconds -gt 60) { throw 'Native measurement exceeded one minute' }
        $soraProcess.Refresh()
        if ($soraProcess.HasExited) { break }
        $soraSamples.Add([ordered]@{elapsedMs=$soraWatch.ElapsedMilliseconds;workingSetBytes=$soraProcess.WorkingSet64;privateBytes=$soraProcess.PrivateMemorySize64;cpuMs=$soraProcess.TotalProcessorTime.TotalMilliseconds})
        if ($null -eq $soraFirstView -and (Test-Path -LiteralPath $soraStderr) -and (Get-Content -LiteralPath $soraStderr -Raw) -match 'view loaded') { $soraFirstView=$soraWatch.ElapsedMilliseconds }
        Start-Sleep -Milliseconds 100
    }
    $soraProcess.WaitForExit()
    $soraSmoke=Get-Content -LiteralPath $soraReport -Raw | ConvertFrom-Json
    if ($soraSmoke.status -ne 'PASS' -or $soraSmoke.closeReopenCycles -ne 2) { throw 'Native lifecycle did not pass' }
    $soraMeasured=[ordered]@{recordedAt=[DateTime]::UtcNow.ToString('o');platform='windows';arch='x64';binarySha256=(Get-FileHash -LiteralPath $soraBinary -Algorithm SHA256).Hash.ToLowerInvariant();status='MEASURED';firstViewObservedMs=$soraFirstView;totalMs=$soraWatch.ElapsedMilliseconds;samples=$soraSamples;nativeLifecycle=$soraSmoke;scope='Unsigned release candidate, hidden diagnostic window, three loads/two closes; first-view upper bound sampled every 100 ms; host process only, excludes WebView/process tree; not clean install, cold cache or sustained idle measurement'}
    $soraMeasured | ConvertTo-Json -Depth 8 | Set-Content -LiteralPath (Join-Path $soraArtifact 'windows-candidate-runtime.json') -Encoding UTF8
    [pscustomobject]$soraMeasured | Select-Object status,firstViewObservedMs,totalMs,scope | ConvertTo-Json
} finally {
    if (!$soraProcess.HasExited) { Stop-Process -Id $soraProcess.Id -Force }
    $soraProcess.Dispose()
}
