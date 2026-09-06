param(
  [string]$Root = (Join-Path $env:USERPROFILE 'CodexScientificReading'),
  [Parameter(Mandatory=$true)][string]$PluginArchive,
  [switch]$InstallSkill,
  [string]$SkillsDirectory = '',
  [string]$LibraryBackup = ''
)
$ErrorActionPreference = 'Stop'
$env:PSModulePath = Join-Path $PSHOME 'Modules'
foreach ($variable in @('NODE_OPTIONS','NODE_PATH','PYTHONPATH','PYTHONHOME')) {
  [Environment]::SetEnvironmentVariable($variable, $null, 'Process')
}
[Console]::OutputEncoding = [System.Text.UTF8Encoding]::new($false)
$OutputEncoding = [Console]::OutputEncoding
$utf8 = [System.Text.UTF8Encoding]::new($false)
$pins = Get-Content -LiteralPath (Join-Path $PSScriptRoot 'runtime\pins.json') -Raw -Encoding UTF8 | ConvertFrom-Json
$buildManifest = Join-Path $PSScriptRoot 'BUILD-MANIFEST.json'
if (Test-Path -LiteralPath $buildManifest) {
  $build = Get-Content -LiteralPath $buildManifest -Raw -Encoding UTF8 | ConvertFrom-Json
  foreach ($entry in $build.files.PSObject.Properties) {
    $sourceFile = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot $entry.Name))
    if (-not $sourceFile.StartsWith($PSScriptRoot + '\', [System.StringComparison]::OrdinalIgnoreCase) -or $entry.Value -notmatch '^[a-f0-9]{64}$') { throw 'invalid_build_manifest' }
    if ((Get-FileHash -LiteralPath $sourceFile -Algorithm SHA256).Hash.ToLowerInvariant() -ne $entry.Value) { throw ('source_checksum_mismatch: ' + $entry.Name) }
  }
}
if (-not [Environment]::Is64BitOperatingSystem -or $env:PROCESSOR_ARCHITECTURE -eq 'ARM64') { throw 'windows_x64_required' }
$archive = (Resolve-Path -LiteralPath $PluginArchive).ProviderPath
if ((Get-FileHash -LiteralPath $archive -Algorithm SHA256).Hash.ToLowerInvariant() -ne $pins.plugin.sha256) { throw 'plugin_checksum_mismatch' }
$Root = [System.IO.Path]::GetFullPath($Root)
if ($Root.TrimEnd('\') -eq [System.IO.Path]::GetPathRoot($Root).TrimEnd('\')) { throw 'invalid_root' }
$marker = Join-Path $Root '.workbench.json'
if ((Test-Path -LiteralPath $Root) -and -not (Test-Path -LiteralPath $marker)) {
  if (@(Get-ChildItem -LiteralPath $Root -Force).Count -gt 0) { throw 'root_not_empty' }
}
New-Item -ItemType Directory -Path $Root -Force | Out-Null
$Root = (Resolve-Path -LiteralPath $Root).ProviderPath
$lockFile = Join-Path $Root '.install.lock'
$installationLock = [System.IO.File]::Open($lockFile, 'OpenOrCreate', 'ReadWrite', 'None')
try {
  if (Test-Path -LiteralPath $marker) {
    $instance = Get-Content -LiteralPath $marker -Raw -Encoding UTF8 | ConvertFrom-Json
    if ($instance.product -ne 'codex-scientific-reading' -or $instance.root -ne $Root) { throw 'invalid_instance_marker' }
  } else {
    $instance = @{ product='codex-scientific-reading'; schema=1; instanceId=[guid]::NewGuid().ToString(); root=$Root }
    [System.IO.File]::WriteAllText($marker, ($instance | ConvertTo-Json), $utf8)
  }
  $runtime = Join-Path $Root 'runtime'
  $downloads = Join-Path $runtime 'downloads'
  New-Item -ItemType Directory -Path $downloads -Force | Out-Null
  function Receive-PinnedFile($Definition, $Destination) {
    if ((Test-Path -LiteralPath $Destination) -and (Get-FileHash -LiteralPath $Destination -Algorithm SHA256).Hash.ToLowerInvariant() -eq $Definition.sha256) { return }
    $partial = $Destination + '.part'
    [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.SecurityProtocolType]::Tls12
    Write-Host ('Downloading ' + $Definition.url)
    Invoke-WebRequest -UseBasicParsing -Uri $Definition.url -OutFile $partial
    if ((Get-FileHash -LiteralPath $partial -Algorithm SHA256).Hash.ToLowerInvariant() -ne $Definition.sha256) { throw 'download_checksum_mismatch' }
    Move-Item -LiteralPath $partial -Destination $Destination -Force
  }
  if ($pins.node.version -notmatch '^\d+\.\d+\.\d+$' -or $pins.python.version -notmatch '^\d+\.\d+\.\d+$' -or $pins.python.build -notmatch '^\d{8}$') { throw 'invalid_runtime_version' }
  $nodeTarget = Join-Path $runtime ('node\' + $pins.node.version)
  $node = Join-Path $nodeTarget 'node.exe'
  if (-not (Test-Path -LiteralPath $node)) {
    $nodeZip = Join-Path $downloads ('node-' + $pins.node.version + '.zip')
    Receive-PinnedFile $pins.node $nodeZip
    Expand-Archive -LiteralPath $nodeZip -DestinationPath $runtime -Force
    $extracted = [System.IO.Path]::GetFullPath((Join-Path $runtime ('node-v' + $pins.node.version + '-win-x64')))
    $nodeTarget = [System.IO.Path]::GetFullPath($nodeTarget)
    if ([System.IO.Path]::GetDirectoryName($extracted) -ne $runtime -or [System.IO.Path]::GetDirectoryName([System.IO.Path]::GetDirectoryName($nodeTarget)) -ne $runtime) { throw 'invalid_runtime_path' }
    New-Item -ItemType Directory -Path (Split-Path -Parent $nodeTarget) -Force | Out-Null
    Move-Item -LiteralPath $extracted -Destination $nodeTarget
  }
  $pythonTarget = Join-Path $runtime ('python\' + $pins.python.version + '-' + $pins.python.build)
  $python = Join-Path $pythonTarget 'python\python.exe'
  if (-not (Test-Path -LiteralPath $python)) {
    $pythonArchive = Join-Path $downloads ('python-' + $pins.python.version + '-' + $pins.python.build + '.tar.gz')
    Receive-PinnedFile $pins.python $pythonArchive
    New-Item -ItemType Directory -Path $pythonTarget -Force | Out-Null
    & (Join-Path $env:SYSTEMROOT 'System32\tar.exe') -xzf $pythonArchive -C $pythonTarget
    if ($LASTEXITCODE -ne 0) { throw 'python_extract_failed' }
  }
  $arguments = @((Join-Path $PSScriptRoot 'src\install.mjs'), $Root, $archive)
  if ($InstallSkill) {
    if (-not $SkillsDirectory) {
      if ($env:CODEX_HOME) { $SkillsDirectory = Join-Path $env:CODEX_HOME 'skills' }
      else { $SkillsDirectory = Join-Path $env:USERPROFILE '.codex\skills' }
    }
  }
  $arguments += $(if ($InstallSkill) { $SkillsDirectory } else { '-' })
  $arguments += $(if ($LibraryBackup) { $LibraryBackup } else { '-' })
  & $node @arguments
  if ($LASTEXITCODE -ne 0) { throw 'workbench_install_failed' }
} finally {
  $installationLock.Dispose()
}
