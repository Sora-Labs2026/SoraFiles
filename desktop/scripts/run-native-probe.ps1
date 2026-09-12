param([ValidateSet('Engines','Lifecycle','Storage','Ui')][string]$Probe)
$ErrorActionPreference = 'Stop'
$soraProject = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$soraBuild = Join-Path $soraProject '.artifacts/desktop-webview2'
$soraCompiler = 'C:\Windows\Microsoft.NET\Framework64\v4.0.30319\csc.exe'
$soraNames = @{ Engines='NativeProbe'; Lifecycle='LifecycleProbe'; Storage='StorageProbe'; Ui='DesktopUiProbe' }
$soraEvidenceNames = @{ Engines='desktop-native-rerun'; Lifecycle='desktop-lifecycle'; Storage='desktop-storage'; Ui='desktop-ui-native' }
$soraName = $soraNames[$Probe]
$soraExecutable = Join-Path $soraBuild ($soraName + '.exe')
$soraEvidence = Join-Path $soraProject ('.artifacts/' + $soraEvidenceNames[$Probe])
$soraArgs = @('/nologo','/platform:x64',('/out:'+$soraExecutable),'/reference:System.Web.Extensions.dll')
if ($Probe -eq 'Storage') {
    $soraArgs += @('/target:exe','/reference:System.Security.dll',(Join-Path $soraProject 'desktop/prototypes/WindowsFileBoundary.cs'))
} else {
    $soraArgs += @('/target:winexe','/reference:System.Windows.Forms.dll','/reference:System.Drawing.dll',('/reference:'+(Join-Path $soraBuild 'Microsoft.Web.WebView2.Core.dll')),('/reference:'+(Join-Path $soraBuild 'Microsoft.Web.WebView2.WinForms.dll')))
}
$soraArgs += Join-Path $soraProject ('desktop/prototypes/'+$soraName+'.cs')
& $soraCompiler @soraArgs
if ($LASTEXITCODE -ne 0) { throw 'Native probe compilation failed' }
if ($Probe -eq 'Storage') { & $soraExecutable $soraEvidence; if ($LASTEXITCODE -ne 0) { throw 'Storage probe failed' }; Get-Content -LiteralPath (Join-Path $soraEvidence 'storage.json'); exit }
$soraLaunch = @('"'+$soraEvidence+'"')
if ($Probe -eq 'Engines') { $soraLaunch += 'https://sorafiles-probe.invalid/' }
if ($Probe -eq 'Ui') { $soraLaunch = @('"'+(Join-Path $soraProject '.artifacts/desktop-ui')+'"','"'+$soraEvidence+'"','--capture') }
$soraProcess = Start-Process -FilePath $soraExecutable -ArgumentList $soraLaunch -WindowStyle Hidden -PassThru
[pscustomobject]@{ Probe=$Probe; ProcessId=$soraProcess.Id; Evidence=$soraEvidence }
