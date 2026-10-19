# ACRÉSCIMO LOCAL (19/10/2026), não faz parte da skill original.
# OCR embutido no Windows (Windows.Media.Ocr), em pt-BR, sem instalar nada: é o leitor do ler.mjs.
# Recebe imagens e grava, para cada uma, as linhas e as palavras lidas, com a caixa de cada palavra
# em pixels da imagem original.
#
#   powershell -NoProfile -ExecutionPolicy Bypass -File ocr-windows.ps1 -Lista imagens.txt -Saida lido.json [-Escala 2]
#
# -Lista é um arquivo UTF-8 com um caminho de imagem por linha (assim caminho com espaço e acento
# chega inteiro; com -File o PowerShell não separa uma lista passada na linha de comando).
# -Escala amplia a imagem antes de ler (texto miúdo lê melhor ampliado); as caixas voltam na
# escala original. Roda no Windows PowerShell 5.1 (o powershell.exe); o pwsh 7 não carrega o WinRT
# deste jeito.
param(
  [Parameter(Mandatory = $true)][string]$Saida,
  [Parameter(Mandatory = $true)][string]$Lista,
  [double]$Escala = 1,
  [string]$Lingua = "pt-BR"
)
$ErrorActionPreference = "Stop"
Add-Type -AssemblyName System.Runtime.WindowsRuntime
$null = [Windows.Media.Ocr.OcrEngine, Windows.Foundation, ContentType = WindowsRuntime]
$null = [Windows.Storage.StorageFile, Windows.Storage, ContentType = WindowsRuntime]
$null = [Windows.Graphics.Imaging.BitmapDecoder, Windows.Graphics, ContentType = WindowsRuntime]
$null = [Windows.Globalization.Language, Windows.Globalization, ContentType = WindowsRuntime]
$asTask = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
  $_.Name -eq "AsTask" -and $_.GetParameters().Count -eq 1 -and $_.GetParameters()[0].ParameterType.Name -eq "IAsyncOperation``1" })[0]
function Esperar($op, [type]$tipo) {
  $t = $asTask.MakeGenericMethod($tipo).Invoke($null, @($op)); $null = $t.Wait(-1); $t.Result
}
$motor = [Windows.Media.Ocr.OcrEngine]::TryCreateFromLanguage([Windows.Globalization.Language]::new($Lingua))
if ($null -eq $motor) { throw "OCR do Windows sem o idioma $Lingua (Configurações > Hora e idioma > Idioma: instalar o pacote com 'Reconhecimento óptico de caracteres')" }
$maxLado = [Windows.Media.Ocr.OcrEngine]::MaxImageDimension
$Imagens = [IO.File]::ReadAllLines((Resolve-Path -LiteralPath $Lista).Path, [Text.Encoding]::UTF8) | Where-Object { $_.Trim() }
$res = @()
foreach ($img in $Imagens) {
  $arq = Esperar ([Windows.Storage.StorageFile]::GetFileFromPathAsync((Resolve-Path -LiteralPath $img).Path)) ([Windows.Storage.StorageFile])
  $fluxo = Esperar ($arq.OpenAsync([Windows.Storage.FileAccessMode]::Read)) ([Windows.Storage.Streams.IRandomAccessStream])
  $dec = Esperar ([Windows.Graphics.Imaging.BitmapDecoder]::CreateAsync($fluxo)) ([Windows.Graphics.Imaging.BitmapDecoder])
  $e = $Escala
  $maior = [Math]::Max($dec.PixelWidth, $dec.PixelHeight)
  if ($maior * $e -gt $maxLado) { $e = $maxLado / $maior }
  if ($e -ne 1) {
    $tr = New-Object Windows.Graphics.Imaging.BitmapTransform
    $tr.ScaledWidth = [uint32][Math]::Floor($dec.PixelWidth * $e); $tr.ScaledHeight = [uint32][Math]::Floor($dec.PixelHeight * $e)
    $tr.InterpolationMode = [Windows.Graphics.Imaging.BitmapInterpolationMode]::Fant
    $bmp = Esperar ($dec.GetSoftwareBitmapAsync([Windows.Graphics.Imaging.BitmapPixelFormat]::Bgra8, [Windows.Graphics.Imaging.BitmapAlphaMode]::Premultiplied, $tr,
      [Windows.Graphics.Imaging.ExifOrientationMode]::IgnoreExifOrientation, [Windows.Graphics.Imaging.ColorManagementMode]::DoNotColorManage)) ([Windows.Graphics.Imaging.SoftwareBitmap])
  } else {
    $bmp = Esperar ($dec.GetSoftwareBitmapAsync()) ([Windows.Graphics.Imaging.SoftwareBitmap])
  }
  $r = Esperar ($motor.RecognizeAsync($bmp)) ([Windows.Media.Ocr.OcrResult])
  $linhas = @()
  foreach ($l in $r.Lines) {
    $pals = @()
    foreach ($w in $l.Words) {
      $b = $w.BoundingRect
      $pals += [ordered]@{ texto = $w.Text; x = [Math]::Round($b.X / $e, 1); y = [Math]::Round($b.Y / $e, 1); w = [Math]::Round($b.Width / $e, 1); h = [Math]::Round($b.Height / $e, 1) }
    }
    $linhas += [ordered]@{ texto = $l.Text; palavras = $pals }
  }
  $res += [ordered]@{ imagem = $img; escala = $e; largura = $dec.PixelWidth; altura = $dec.PixelHeight; linhas = $linhas }
  $fluxo.Dispose()
}
$json = ConvertTo-Json -InputObject @($res) -Depth 8 -Compress
[IO.File]::WriteAllText($Saida, $json, (New-Object System.Text.UTF8Encoding($false)))
