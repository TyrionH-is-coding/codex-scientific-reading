param([string]$Root = '')
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
if ($marker.product -ne 'codex-scientific-reading' -or $marker.root -ne $Root -or $Root.TrimEnd('\') -eq [System.IO.Path]::GetPathRoot($Root).TrimEnd('\')) { throw 'invalid_instance' }
$installationFile = Join-Path $Root 'installation.json'
if (Test-Path -LiteralPath $installationFile) {
  $installed = Get-Content -LiteralPath $installationFile -Raw -Encoding UTF8 | ConvertFrom-Json
  & $installed.node (Join-Path $installed.app 'src\cli.mjs') retire $Root
  if ($LASTEXITCODE -ne 0) { throw 'uninstall_deactivation_failed' }
}
$retired = Get-Content -LiteralPath (Join-Path $Root 'state\uninstalled.json') -Raw -Encoding UTF8 | ConvertFrom-Json
if ($retired.status -ne 'uninstalled' -or $retired.root -ne $Root -or (Test-Path -LiteralPath $installationFile)) { throw 'uninstall_not_retired' }
function Remove-ManagedTree([string]$Target, [string]$Boundary) {
  $absolute = [System.IO.Path]::GetFullPath($Target)
  if ($absolute -ne $Boundary -and -not $absolute.StartsWith($Boundary + '\', [System.StringComparison]::OrdinalIgnoreCase)) { throw 'uninstall_path_escaped' }
  $item = Get-Item -LiteralPath $absolute -Force
  if ($item.Attributes -band [System.IO.FileAttributes]::ReparsePoint) {
    if ($item.PSIsContainer) { [System.IO.Directory]::Delete($absolute) }
    else { [System.IO.File]::Delete($absolute) }
    return
  }
  if ($item.PSIsContainer) {
    foreach ($child in @(Get-ChildItem -LiteralPath $absolute -Force)) { Remove-ManagedTree $child.FullName $Boundary }
    [System.IO.Directory]::Delete($absolute)
  } else { Remove-Item -LiteralPath $absolute -Force }
}
foreach ($name in @('releases','runtime')) {
  $target = [System.IO.Path]::GetFullPath((Join-Path $Root $name))
  if ([System.IO.Path]::GetDirectoryName($target) -ne $Root -or $retired.removePaths -notcontains $target) { throw 'invalid_uninstall_target' }
  if (Test-Path -LiteralPath $target) {
    if ((Get-Item -LiteralPath $target -Force).Attributes -band [System.IO.FileAttributes]::ReparsePoint) { throw 'uninstall_target_is_link' }
    Remove-ManagedTree $target $target
  }
}
Write-Output ('运行程序与未修改的自有 Skill 已卸载。文献、配置、登录凭据与备份保留于：' + $Root)
if ($retired.skill.status -eq 'retained_custom_changes') { Write-Output ('保留用户修改的 Skill：' + $retired.skill.path) }
