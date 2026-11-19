$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$catalog = [IO.File]::ReadAllText((Join-Path $root 'catalog.js'))
$app = [IO.File]::ReadAllText((Join-Path $root 'script.js')).Replace('initApp();', '')
$hub = [IO.File]::ReadAllText((Join-Path $root 'monthly-hub.js'))
$tests = [IO.File]::ReadAllText((Join-Path $PSScriptRoot 'catalog.test.js'))
$data = [IO.File]::ReadAllText((Join-Path $root 'catalog-preview-data.js'))
$html = '<!doctype html><meta charset="utf-8"><body><script>' + $data + "`n" + $catalog + "`n" + $hub + "`n" + $app + "`n" + $tests + '</script></body>'
$testFile = Join-Path $env:TEMP ('fitflow-tests-' + [guid]::NewGuid().ToString('N') + '.html')
$outputFile = $testFile + '.out'
$errorFile = $testFile + '.err'
[IO.File]::WriteAllText($testFile, $html, [Text.UTF8Encoding]::new($false))
$edge = Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'
$profile = Join-Path $env:TEMP ('fitflow-edge-' + [guid]::NewGuid().ToString('N'))
$arguments = @('--headless', '--disable-gpu', '--no-first-run', ('--user-data-dir="' + $profile + '"'), '--dump-dom', ('"' + ([uri]$testFile).AbsoluteUri + '"'))
$process = Start-Process -FilePath $edge -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput $outputFile -RedirectStandardError $errorFile
if (!$process.WaitForExit(20000)) { throw 'El navegador no ha acabat les proves.' }
$result = ''
for ($attempt = 0; $attempt -lt 50; $attempt++) {
  $stream = [IO.File]::Open($outputFile, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
  $reader = [IO.StreamReader]::new($stream)
  try { $result = $reader.ReadToEnd() } finally { $reader.Dispose() }
  if ($result -match 'PASS \d+ checks|FAIL ') { break }
  Start-Sleep -Milliseconds 100
}
if ($result -notmatch 'PASS \d+ checks') { throw "Les proves han fallat: $result" }
$result
