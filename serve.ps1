# Local preview server for Trihedron Crystal. It uses only Windows PowerShell,
# so nothing is compiled and Windows Smart App Control has nothing to block.
#
# Usage:  powershell -ExecutionPolicy Bypass -File serve.ps1 [-Port 8080] [-Open]
#         -Open launches the site in your default browser once the server is up.
#         Visual Studio runs this on F5 / Ctrl+F5 (see host/Properties/launchSettings.json).
param([int]$Port = 8080, [switch]$Open)

$root = Split-Path -Parent $MyInvocation.MyCommand.Path

# Start on the requested port, or the next free one if it is taken
$listener = $null
foreach ($p in $Port..($Port + 10)) {
  $l = New-Object System.Net.HttpListener
  $l.Prefixes.Add("http://localhost:$p/")
  try { $l.Start(); $listener = $l; $Port = $p; break } catch { $l.Close() }
}
if (-not $listener) { Write-Host "Could not start: ports $Port-$($Port + 10) are all in use." -ForegroundColor Red; exit 1 }

$url = "http://localhost:$Port/"
Write-Host ""
Write-Host "  Trihedron Crystal running at $url" -ForegroundColor Cyan
Write-Host "  Serving: $root"
Write-Host "  Press Ctrl+C or close this window to stop."
Write-Host ""
if ($Open) { Start-Process $url }

$types = @{
  '.html' = 'text/html; charset=utf-8'; '.css' = 'text/css; charset=utf-8'; '.js' = 'text/javascript; charset=utf-8'
  '.json' = 'application/json'; '.webmanifest' = 'application/manifest+json'; '.xml' = 'application/xml'; '.txt' = 'text/plain; charset=utf-8'
  '.svg' = 'image/svg+xml'; '.png' = 'image/png'; '.jpg' = 'image/jpeg'; '.jpeg' = 'image/jpeg'; '.webp' = 'image/webp'; '.ico' = 'image/x-icon'
  '.woff2' = 'font/woff2'; '.pdf' = 'application/pdf'
}
# Dev-only folders are never served
$hidden = '^(host|\.vs|\.vscode|\.claude)(/|$)'

function Send-File($res, $file, $status) {
  $bytes = [IO.File]::ReadAllBytes($file)
  $ext = [IO.Path]::GetExtension($file).ToLower()
  $res.StatusCode = $status
  $res.ContentType = if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' }
  $res.Headers.Add('Cache-Control', 'no-cache')
  $res.ContentLength64 = $bytes.Length
  $res.OutputStream.Write($bytes, 0, $bytes.Length)
}

try {
  while ($listener.IsListening) {
    # Poll so Ctrl+C can interrupt between requests
    $task = $listener.GetContextAsync()
    while (-not $task.Wait(250)) { }
    $ctx = $task.Result
    $res = $ctx.Response
    try {
      $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
      if ([string]::IsNullOrEmpty($path) -or $path.EndsWith('/')) { $path += 'index.html' }
      $file = [IO.Path]::GetFullPath((Join-Path $root $path))
      if ($path -notmatch $hidden -and $file.StartsWith($root) -and (Test-Path -LiteralPath $file -PathType Leaf)) {
        Send-File $res $file 200
      } elseif ($ctx.Request.HttpMethod -eq 'POST') {
        $res.StatusCode = 405   # forms only work once hosted on Netlify
      } elseif (Test-Path "$root\404.html") {
        Send-File $res "$root\404.html" 404
      } else {
        $res.StatusCode = 404
      }
    } catch {
      try { $res.StatusCode = 500 } catch { }
    } finally {
      try { $res.OutputStream.Close() } catch { }
    }
  }
} finally {
  $listener.Stop()
  $listener.Close()
  Write-Host "Server stopped."
}
