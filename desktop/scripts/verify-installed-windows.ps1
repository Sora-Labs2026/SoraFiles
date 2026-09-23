# Read-only preflight. This script never launches the installer or uninstaller.
[CmdletBinding()]
param(
    [Parameter(Mandatory = $true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$ExpectedSha256,
    [ValidatePattern('^[a-z0-9][a-z0-9-]{0,47}$')][string]$RunId = ('check-' + [Guid]::NewGuid().ToString('N'))
)
$ErrorActionPreference = 'Stop'
Set-StrictMode -Version Latest
if ($env:OS -ne 'Windows_NT') { throw 'Windows is required.' }
$repo = [IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\..'))
$release = Join-Path $repo 'desktop\native\target\x86_64-pc-windows-msvc\release'
$installer = Join-Path $release 'bundle\nsis\SoraFiles Desktop_0.1.0_x64-setup.exe'
$template = Join-Path $release 'nsis\x64\installer.nsi'
$validationRoot = Join-Path $repo '.artifacts\windows-install-validation'
$target = [IO.Path]::GetFullPath((Join-Path $validationRoot "$RunId\app"))
if (-not $target.StartsWith($validationRoot + '\', [StringComparison]::OrdinalIgnoreCase)) { throw 'Target escaped validation root.' }
foreach ($checkedPath in @($target, $installer, $template)) {
    $ancestor = $checkedPath
    while ($ancestor) {
        if (Test-Path -LiteralPath $ancestor) {
            $item = Get-Item -LiteralPath $ancestor -Force
            if (($item.Attributes -band [IO.FileAttributes]::ReparsePoint) -ne 0) { throw "Reparse point refused: $ancestor" }
        }
        $ancestor = Split-Path -Parent $ancestor
    }
}
if (Test-Path -LiteralPath (Split-Path -Parent $target)) { throw 'Run directory already exists. Choose a new RunId; nothing was changed.' }
$actualHash = (Get-FileHash -LiteralPath $installer -Algorithm SHA256).Hash.ToLowerInvariant()
if ($actualHash -ne $ExpectedSha256.ToLowerInvariant()) { throw 'Installer SHA256 does not match the explicitly supplied candidate hash.' }
$nsi = Get-Content -LiteralPath $template -Raw
foreach ($required in @('!define INSTALLMODE "currentUser"', '!define PRODUCTNAME "SoraFiles Desktop"', '!define MANUFACTURER "soralabs"', '!define MAINBINARYNAME "sorafiles-desktop"', '${GetOptions} $CMDLINE "/NS" $NoShortcutMode', '!define INSTALLWEBVIEW2MODE "downloadBootstrapper"')) {
    if (-not $nsi.Contains($required)) { throw "Generated installer template changed; review required: $required" }
}

$conflicts = [Collections.Generic.List[object]]::new()
$registry = [Collections.Generic.List[object]]::new()
$webview = [Collections.Generic.List[object]]::new()
$uninstallPath = 'Software\Microsoft\Windows\CurrentVersion\Uninstall'
$productKey = 'Software\soralabs\SoraFiles Desktop'
$runPath = 'Software\Microsoft\Windows\CurrentVersion\Run'
$edgePath = 'Software\Microsoft\EdgeUpdate\Clients\{F3017226-FE2A-4295-8BDF-00C3A9A7E4C5}'
foreach ($hive in @([Microsoft.Win32.RegistryHive]::CurrentUser, [Microsoft.Win32.RegistryHive]::LocalMachine)) {
    foreach ($view in @([Microsoft.Win32.RegistryView]::Registry64, [Microsoft.Win32.RegistryView]::Registry32)) {
        $base = [Microsoft.Win32.RegistryKey]::OpenBaseKey($hive, $view)
        try {
            $key = $base.OpenSubKey($uninstallPath, $false)
            if ($key) {
                try {
                    foreach ($name in $key.GetSubKeyNames()) {
                        $entry = $key.OpenSubKey($name, $false)
                        if (-not $entry) { continue }
                        try {
                            $display = [string]$entry.GetValue('DisplayName', '')
                            if ($name -match '(?i)sorafiles' -or $display -match '(?i)sorafiles') {
                                $record = [ordered]@{ kind = 'registered-install'; hive = [string]$hive; view = [string]$view; key = "$uninstallPath\$name"; displayName = $display; installLocation = [string]$entry.GetValue('InstallLocation', '') }
                                $registry.Add($record); $conflicts.Add($record)
                            }
                        } finally { $entry.Dispose() }
                    }
                } finally { $key.Dispose() }
            }
            $key = $base.OpenSubKey($productKey, $false)
            if ($key) {
                try { $record = [ordered]@{ kind = 'remembered-install'; hive = [string]$hive; view = [string]$view; key = $productKey; installLocation = [string]$key.GetValue('', '') }; $registry.Add($record); $conflicts.Add($record) } finally { $key.Dispose() }
            }
            $key = $base.OpenSubKey($runPath, $false)
            if ($key) {
                try {
                    foreach ($name in @('SoraFilesDesktop', 'SoraFiles Desktop')) {
                        if ($key.GetValueNames() -contains $name) {
                            # Do not print arbitrary pre-existing command contents.
                            $record = [ordered]@{ kind = 'startup-value'; hive = [string]$hive; view = [string]$view; name = $name }
                            $registry.Add($record); $conflicts.Add($record)
                        }
                    }
                } finally { $key.Dispose() }
            }
            $key = $base.OpenSubKey($edgePath, $false)
            if ($key) {
                try { $version = [string]$key.GetValue('pv', ''); if ($version) { $webview.Add([ordered]@{ hive = [string]$hive; view = [string]$view; version = $version }) } } finally { $key.Dispose() }
            }
            foreach ($extension in @('.pdf','.jpg','.jpeg','.png','.webp','.heic','.heif','.tif','.tiff','.psd','.docx','.xlsx','.pptx','.gif')) {
                $entryPath = "Software\Classes\SystemFileAssociations\$extension\shell\SoraFilesDesktop"
                $entryKey = $base.OpenSubKey($entryPath, $false)
                if ($entryKey) {
                    try {
                        # Record presence only, never arbitrary command contents.
                        $record = [ordered]@{ kind = 'explorer-entry'; hive = [string]$hive; view = [string]$view; extension = $extension }
                        $registry.Add($record); $conflicts.Add($record)
                    } finally { $entryKey.Dispose() }
                }
            }
        } finally { $base.Dispose() }
    }
}
$knownPaths = @(
    (Join-Path $env:LOCALAPPDATA 'SoraFiles Desktop'),
    (Join-Path $env:APPDATA 'com.soralabs.sorafiles.desktop'),
    (Join-Path $env:LOCALAPPDATA 'com.soralabs.sorafiles.desktop'),
    (Join-Path ([Environment]::GetFolderPath('Programs')) 'SoraFiles Desktop.lnk'),
    (Join-Path ([Environment]::GetFolderPath('Desktop')) 'SoraFiles Desktop.lnk'),
    (Join-Path ([Environment]::GetFolderPath('CommonPrograms')) 'SoraFiles Desktop.lnk'),
    (Join-Path ([Environment]::GetFolderPath('CommonDesktopDirectory')) 'SoraFiles Desktop.lnk')
)
foreach ($knownPath in $knownPaths) {
    if (Test-Path -LiteralPath $knownPath) { $conflicts.Add([ordered]@{ kind = 'existing-app-path'; path = $knownPath }) }
}
foreach ($process in @(Get-Process -Name 'sorafiles-desktop' -ErrorAction SilentlyContinue)) {
    $conflicts.Add([ordered]@{ kind = 'running-app'; processId = $process.Id })
}
# Match the generated x64 installer's actual lookup: HKLM 32-bit view, then HKCU 64-bit.
$detectedByInstaller = @($webview | Where-Object { ($_.hive -eq 'LocalMachine' -and $_.view -eq 'Registry32') -or ($_.hive -eq 'CurrentUser' -and $_.view -eq 'Registry64') })
if ($detectedByInstaller.Count -eq 0) { $conflicts.Add([ordered]@{ kind = 'webview2-missing'; detail = 'Installer would download/install a shared runtime.' }) }
$signature = Get-AuthenticodeSignature -LiteralPath $installer
[ordered]@{
    schemaVersion = 1
    recordedAt = [DateTime]::UtcNow.ToString('o')
    status = $(if ($conflicts.Count -eq 0) { 'PREFLIGHT_READY' } else { 'PREFLIGHT_BLOCKED' })
    scope = 'Read-only preflight and execution plan; no extraction, installation, lifecycle, shell or uninstall validation performed.'
    installer = [ordered]@{ path = $installer; sha256 = $actualHash; bytes = (Get-Item -LiteralPath $installer).Length; signatureStatus = [string]$signature.Status }
    generatedTemplate = [ordered]@{ path = $template; sha256 = (Get-FileHash -LiteralPath $template -Algorithm SHA256).Hash.ToLowerInvariant(); caveat = 'Template fingerprint is recorded; it is not proof that these exact bytes generated the pinned installer.' }
    target = $target
    registry = @($registry.ToArray())
    webview2 = @($webview.ToArray())
    conflicts = @($conflicts.ToArray())
    executionPlan = [ordered]@{
        installArguments = "/S /NS /D=$target"
        installSideEffects = 'HKCU application/uninstall registration and AppUserModelId; /NS suppresses new shortcuts; shared WebView2 checked above.'
        uninstallArguments = "/S _?=$target"
        uninstallCaveats = 'Run directly from the exact target with _?= last and unquoted. The executable may remain locked until exit; remembered install location and app data may remain. Do not remove anything automatically.'
        exclusions = @('shortcut creation (/NS)', 'actual sign-in startup', 'startup conflict preservation', 'Explorer opt-in and file handoff', 'clean-machine WebView2 bootstrap', 'signed release trust', 'macOS/Linux')
        nextChecks = @('Recheck preflight immediately before execution.', 'Launch installer hidden and wait for its exit code.', 'Compare every installed payload file hash and native executable with staged release.', 'Verify exact HKCU install/uninstall path and absent startup registration.', 'Run normal native lifecycle smoke against the installed release; background/startup diagnostic fixtures require debug builds.', 'Validate Explorer opt-in, handoff and uninstall cleanup separately in a disposable Windows account.', 'Before uninstall recheck ownership of registration, process absence and absence of user-created files.', 'Run exact installed uninstaller and inspect remaining files/registry without deleting them.')
    }
} | ConvertTo-Json -Depth 8
if ($conflicts.Count -gt 0) { exit 2 }
