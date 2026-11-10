# Minimal static file server for local development (no installs needed).
# ES modules don't load from file://, so the game has to be opened over http.
# Usage: start.cmd            (first free port from 8080)
#        start.cmd -Port 9000
param([int]$Port = 8080)

$ErrorActionPreference = 'Stop'
$root = [IO.Path]::GetFullPath($PSScriptRoot).TrimEnd('\') + '\'
$mime = @{
  '.html'  = 'text/html; charset=utf-8'
  '.js'    = 'text/javascript; charset=utf-8'
  '.css'   = 'text/css; charset=utf-8'
  '.json'  = 'application/json; charset=utf-8'
  '.woff2' = 'font/woff2'
  '.png'   = 'image/png'
  '.jpg'   = 'image/jpeg'
  '.wav'   = 'audio/wav'
  '.ogg'   = 'audio/ogg'
  '.txt'   = 'text/plain; charset=utf-8'
}

# Find a free port: an old server window (e.g. from before a folder rename) may still hold 8080.
$listener = $null
foreach ($p in $Port..($Port + 10)) {
  $candidate = [System.Net.HttpListener]::new()
  $candidate.Prefixes.Add("http://localhost:$p/")
  try {
    $candidate.Start()
    $listener = $candidate
    $Port = $p
    break
  } catch {
    $candidate.Close()
    Write-Host "Port $p is busy, trying the next one..." -ForegroundColor DarkYellow
  }
}
if (-not $listener) {
  Write-Host "Could not start the server: ports $Port..$($Port + 10) are all busy." -ForegroundColor Red
  exit 1
}

$prefix = "http://localhost:$Port/"
Write-Host "Devilshot is running at $prefix"
Write-Host "Serving files from $root"
Write-Host "Close this window to stop the server."
Start-Process $prefix

try {
  while ($listener.IsListening) {
    $ctx = $listener.GetContext()
    $res = $ctx.Response
    try {
      $rel = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath).TrimStart('/')
      if ($rel -eq '') { $rel = 'index.html' }
      $file = [IO.Path]::GetFullPath((Join-Path $root $rel))
      if ($file.StartsWith($root, [StringComparison]::OrdinalIgnoreCase) -and (Test-Path -LiteralPath $file -PathType Leaf)) {
        $bytes = [IO.File]::ReadAllBytes($file)
        $ext = [IO.Path]::GetExtension($file).ToLowerInvariant()
        $res.ContentType = if ($mime.ContainsKey($ext)) { $mime[$ext] } else { 'application/octet-stream' }
        $res.Headers.Add('Cache-Control', 'no-store')
        $res.ContentLength64 = $bytes.Length
        $res.OutputStream.Write($bytes, 0, $bytes.Length)
      } else {
        $res.StatusCode = 404
        Write-Host "404 $rel" -ForegroundColor DarkYellow
      }
    } catch {
      $res.StatusCode = 500
      Write-Host "500 $rel : $_" -ForegroundColor Red
    } finally {
      $res.Close()
    }
  }
} finally {
  $listener.Stop()
}
