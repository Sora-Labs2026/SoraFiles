param([ValidateSet('check','test','build','generate-lockfile','metadata')][string]$Command='check')
$ErrorActionPreference='Stop'
$soraRoot=[IO.Path]::GetFullPath((Join-Path $PSScriptRoot '../..'))
$env:RUSTUP_HOME=Join-Path $soraRoot '.artifacts/desktop-toolchain/rustup'
$env:CARGO_HOME=Join-Path $soraRoot '.artifacts/desktop-toolchain/cargo'
$env:PATH=(Join-Path $env:CARGO_HOME 'bin')+';'+$env:PATH
$soraCargo=Join-Path $env:CARGO_HOME 'bin/cargo.exe'
$soraManifest=Join-Path $soraRoot 'desktop/native/Cargo.toml'
$soraVcVars='C:\SoraFilesBuildTools\VC\Auxiliary\Build\vcvars64.bat'
if (Test-Path -LiteralPath $soraVcVars) {
    # Read compiler environment in memory; do not print inherited environment values.
    $soraCompilerEnvironment=& cmd.exe /d /s /c '"C:\SoraFilesBuildTools\VC\Auxiliary\Build\vcvars64.bat" >nul && set'
    if ($LASTEXITCODE -ne 0) { throw 'C++ compiler environment unavailable' }
    foreach ($soraEnvironmentLine in $soraCompilerEnvironment) {
        if ($soraEnvironmentLine -match '^([^=]+)=(.*)$') { [Environment]::SetEnvironmentVariable($Matches[1],$Matches[2],'Process') }
    }
}
& $soraCargo $Command --manifest-path $soraManifest
exit $LASTEXITCODE
