<#
.SYNOPSIS
Renders spoken phrases to WAV, for the chord name recordings Unstrung ships.

.DESCRIPTION
Uses Windows.Media.SpeechSynthesis, a WinRT API whose calls are all asynchronous. The older
System.Speech API was tried first and rejected: its voices read as slower and flatter at a matched
pace, and a spoken chord name has to finish before the beat it belongs to.
Windows PowerShell 5.1 can project WinRT types but has no await, so the helper below turns an
IAsyncOperation into a task and blocks on it. PowerShell 7 dropped the built-in projection, so this
must be run with powershell.exe rather than pwsh.

Unlike System.Speech, the synthesizer chooses its own output format; there is no equivalent of
SetOutputToWaveFile taking a format. Whatever it produces is written as-is and resampled later.

Output is one tab separated line per phrase: index, file name, text.
#>
param(
    [string]$OutDir = '',
    [string]$PhrasesJson = '',
    [int]$Rate = 0,
    [string]$Voice = '',
    [switch]$ListVoices
)

$ErrorActionPreference = 'Stop'

# Loading the type is what triggers the WinRT projection; the assignment is discarded.
[void][Windows.Media.SpeechSynthesis.SpeechSynthesizer, Windows.Media, ContentType = WindowsRuntime]
[void][Windows.Storage.Streams.DataReader, Windows.Storage.Streams, ContentType = WindowsRuntime]
Add-Type -AssemblyName System.Runtime.WindowsRuntime

$asTaskGeneric = ([System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
})[0]

function Await($operation, $resultType) {
    $asTask = $asTaskGeneric.MakeGenericMethod($resultType)
    $task = $asTask.Invoke($null, @($operation))
    [void]$task.Wait(-1)
    $task.Result
}

if ($ListVoices) {
    foreach ($v in [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices) {
        Write-Output $v.DisplayName
    }
    exit 0
}

if (-not $OutDir) { Write-Error 'OutDir is required unless -ListVoices is given'; exit 1 }
if (-not (Test-Path $PhrasesJson)) { Write-Error "No such phrases file: $PhrasesJson"; exit 1 }
New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# Two steps, not a pipeline: ConvertFrom-Json hands on the whole array as one object, so wrapping
# the pipeline in @() gives a single element holding every phrase.
$parsed = Get-Content -Path $PhrasesJson -Raw -Encoding UTF8 | ConvertFrom-Json
$phrases = @($parsed)
if ($phrases.Count -eq 0) { Write-Error 'The phrases file holds no phrases'; exit 1 }

$synth = New-Object Windows.Media.SpeechSynthesis.SpeechSynthesizer
try {
    if ($Voice) {
        $chosen = [Windows.Media.SpeechSynthesis.SpeechSynthesizer]::AllVoices |
            Where-Object { $_.DisplayName -eq $Voice }
        if (-not $chosen) { Write-Error "No such voice: $Voice"; exit 1 }
        $synth.Voice = $chosen
    }
    # SAPI's -10..10 against WinRT's 0.5..6.0 multiplier. Rate 4 on the SAPI scale is roughly
    # 2.5x normal speed, which is what the committed SAPI assets were rendered at.
    if ($Rate -ne 0) {
        $synth.Options.SpeakingRate = [Math]::Min(6.0, [Math]::Max(0.5, 1.0 + ($Rate * 0.375)))
    }

    for ($i = 0; $i -lt $phrases.Count; $i++) {
        $text = [string]$phrases[$i]
        $fileName = "phrase-$i.wav"
        $path = Join-Path $OutDir $fileName

        $stream = Await $synth.SynthesizeTextToStreamAsync($text) ([Windows.Media.SpeechSynthesis.SpeechSynthesisStream])
        $size = [uint32]$stream.Size
        $reader = New-Object Windows.Storage.Streams.DataReader($stream.GetInputStreamAt(0))
        [void](Await $reader.LoadAsync($size) ([uint32]))
        $bytes = New-Object byte[] $size
        $reader.ReadBytes($bytes)
        $reader.Dispose()
        $stream.Dispose()
        [System.IO.File]::WriteAllBytes($path, $bytes)

        Write-Output ("{0}`t{1}`t{2}" -f $i, $fileName, $text)
    }
} finally {
    $synth.Dispose()
}
