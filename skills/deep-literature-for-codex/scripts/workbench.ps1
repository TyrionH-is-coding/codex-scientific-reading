param([ValidateSet('start','status','stop','rollback','recover','call')][string]$Action = 'status', [string]$RequestFile = '')
$ErrorActionPreference = 'Stop'
$env:PSModulePath = Join-Path $PSHOME 'Modules'
foreach ($variable in @('NODE_OPTIONS','NODE_PATH','PYTHONPATH','PYTHONHOME')) {
  [Environment]::SetEnvironmentVariable($variable, $null, 'Process')
}
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
$skillRoot = Split-Path -Parent $PSScriptRoot
$location = Get-Content -LiteralPath (Join-Path $skillRoot 'installation.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($location.product -ne 'codex-scientific-reading') { throw 'invalid_skill_installation' }
$marker = Get-Content -LiteralPath (Join-Path $location.root '.workbench.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($marker.product -ne $location.product -or $marker.root -ne $location.root) { throw 'invalid_workbench_instance' }
$installed = Get-Content -LiteralPath (Join-Path $location.root 'installation.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$node = $installed.node
$cli = Join-Path $installed.app 'src\cli.mjs'
$arguments = @($cli, $Action, $location.root)
if ($Action -eq 'call') { if (-not $RequestFile) { throw 'request_file_required' }; $arguments += (Resolve-Path -LiteralPath $RequestFile).ProviderPath }
& $node @arguments
exit $LASTEXITCODE
