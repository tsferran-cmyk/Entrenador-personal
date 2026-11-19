param([switch]$Demo, [switch]$Monthly, [switch]$Hub)
$ErrorActionPreference = 'Stop'
$root = Split-Path $PSScriptRoot -Parent
$html = [IO.File]::ReadAllText((Join-Path $root 'index.html'))
$html = [regex]::Replace($html, '<script\b[^>]*>[\s\S]*?</script>', '')
$html = [regex]::Replace($html, '<link\b[^>]*>', '')
$scripts = 'window.FITFLOW_CATALOG_PREVIEW=true;'
$files = @('catalog-preview-data.js','catalog.js','monthly-hub.js','script.js','tests/workout-ui.test.js')
if ($Demo) { $files = @('catalog-preview-data.js','catalog.js','monthly-hub.js','script.js','demo.js','tests/demo.test.js') }
if ($Monthly) { $files = @('catalog-preview-data.js','catalog.js','monthly-hub.js','script.js','tests/monthly.test.js') }
if ($Hub) { $files = @('catalog-preview-data.js','catalog.js','monthly-hub.js','script.js','tests/monthly-hub.test.js') }
foreach ($name in $files) {
    $scripts += "`n" + [IO.File]::ReadAllText((Join-Path $root $name))
}
$html = $html.Replace('</body>', '<script>' + $scripts + '</script></body>')
$testFile = Join-Path $env:TEMP ('fitflow-ui-tests-' + [guid]::NewGuid().ToString('N') + '.html')
[IO.File]::WriteAllText($testFile, $html, [Text.UTF8Encoding]::new($false))
$edge = Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe'
$profile = Join-Path $env:TEMP ('fitflow-ui-edge-' + [guid]::NewGuid().ToString('N'))
$outputFile = $testFile + '.out'
$arguments = @('--headless','--disable-gpu','--no-first-run','--virtual-time-budget=5000',('--user-data-dir="' + $profile + '"'),'--dump-dom',('"' + ([uri]$testFile).AbsoluteUri + '"'))
$process = Start-Process -FilePath $edge -ArgumentList $arguments -WindowStyle Hidden -PassThru -RedirectStandardOutput $outputFile -RedirectStandardError ($testFile + '.err')
if (!$process.WaitForExit(20000)) { throw 'UI test timeout' }
$result = ''
for ($attempt = 0; $attempt -lt 50; $attempt++) {
    $stream = [IO.File]::Open($outputFile, [IO.FileMode]::Open, [IO.FileAccess]::Read, [IO.FileShare]::ReadWrite)
    $reader = [IO.StreamReader]::new($stream)
    try { $result = $reader.ReadToEnd() } finally { $reader.Dispose() }
    if ($result -match 'PASS \d+ UI checks|FAIL ') { break }
    Start-Sleep -Milliseconds 100
}
if ($result -notmatch 'PASS \d+ UI checks') { throw "UI tests failed: $result" }
$result
