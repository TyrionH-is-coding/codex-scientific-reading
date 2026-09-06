param(
  [ValidateSet('start','status','stop','rollback','recover','install-skill','call')][string]$Action = 'status',
  [string]$Root = '',
  [string]$SkillsDirectory = '',
  [string]$RequestFile = ''
)
$ErrorActionPreference = 'Stop'
$env:PSModulePath = Join-Path $PSHOME 'Modules'
foreach ($variable in @('NODE_OPTIONS','NODE_PATH','PYTHONPATH','PYTHONHOME')) { [Environment]::SetEnvironmentVariable($variable, $null, 'Process') }
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
if (-not $Root) {
  if (Test-Path -LiteralPath (Join-Path $PSScriptRoot '.workbench.json')) { $Root = $PSScriptRoot }
  else { $Root = Join-Path $env:USERPROFILE 'CodexScientificReading' }
}
$Root = (Resolve-Path -LiteralPath $Root).ProviderPath
$marker = Get-Content -LiteralPath (Join-Path $Root '.workbench.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($marker.product -ne 'codex-scientific-reading' -or $marker.root -ne $Root) { throw 'invalid_instance' }
$installed = Get-Content -LiteralPath (Join-Path $Root 'installation.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$arguments = @((Join-Path $installed.app 'src\cli.mjs'), $Action, $Root)
if ($Action -eq 'call') { if (-not $RequestFile) { throw 'request_file_required' }; $arguments += (Resolve-Path -LiteralPath $RequestFile).ProviderPath }
elseif ($SkillsDirectory) { $arguments += $SkillsDirectory }
& $installed.node @arguments
exit $LASTEXITCODE
