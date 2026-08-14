<#
.SYNOPSIS
Renders spoken phrases to WAV files with the Windows speech engine.

.DESCRIPTION
The browser's speechSynthesis hands out sound, never audio data, so nothing in the renderer can
hold a spoken phrase as samples. This is the only way to get one: System.Speech is part of .NET on
Windows, so it costs no dependency, but it is the piece that makes the feature platform specific.

Having the samples buys three things the browser path cannot give. The exact length is known before
anything is scheduled. The phrase can be placed on the audio clock rather than started on a timer
and hoped for. And it can be played faster or slower, which moves its pitch, which is the whole
point of the experiment.

Output goes to stdout as one tab separated line per phrase: index, file name, and the text. Errors
go to stderr and set a non-zero exit code.

.PARAMETER OutDir
Directory to write the WAV files into. Created if missing.

.PARAMETER PhrasesJson
Path to a UTF-8 JSON file holding an array of strings. Passed as a file rather than as arguments
because phrase text is arbitrary and quoting it through a command line is a reliable way to lose
characters.

.PARAMETER Rate
Speech rate, -10 to 10, where 0 is the voice's normal speed. This is the SAPI scale, not the Web
Speech multiplier: they are unrelated numbers.

.PARAMETER Voice
Name of an installed voice. Empty selects the system default.

.PARAMETER ListVoices
Print the installed voice names, one per line, and exit without rendering.
#>
param(
    [string]$OutDir = '',
    [string]$PhrasesJson = '',
    [int]$Rate = 0,
    [string]$Voice = '',
    [switch]$ListVoices
)

$ErrorActionPreference = 'Stop'

Add-Type -AssemblyName System.Speech

if ($ListVoices) {
    $synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
    try {
        foreach ($installed in $synth.GetInstalledVoices()) {
            if ($installed.Enabled) { Write-Output $installed.VoiceInfo.Name }
        }
    } finally {
        $synth.Dispose()
    }
    exit 0
}

if (-not $OutDir) { Write-Error 'OutDir is required unless -ListVoices is given'; exit 1 }
if (-not $PhrasesJson) { Write-Error 'PhrasesJson is required unless -ListVoices is given'; exit 1 }
if (-not (Test-Path $PhrasesJson)) { Write-Error "No such phrases file: $PhrasesJson"; exit 1 }

New-Item -ItemType Directory -Force -Path $OutDir | Out-Null

# Parsed in two steps on purpose. ConvertFrom-Json emits the whole array as one object rather than
# streaming its elements, so wrapping the pipeline in @() yields a single-element array holding the
# array -- which then stringifies as every phrase joined by spaces, and renders one long WAV.
# Assigning first and wrapping the variable gives the array itself.
$parsed = Get-Content -Path $PhrasesJson -Raw -Encoding UTF8 | ConvertFrom-Json
$phrases = @($parsed)
if ($phrases.Count -eq 0) { Write-Error 'The phrases file holds no phrases'; exit 1 }

# One synthesizer for the whole batch. Constructing it is the slow part -- spinning one up per
# phrase turns a fraction of a second into several seconds for a song's worth of announcements.
$synth = New-Object System.Speech.Synthesis.SpeechSynthesizer
try {
    if ($Voice) { $synth.SelectVoice($Voice) }
    $synth.Rate = $Rate

    for ($i = 0; $i -lt $phrases.Count; $i++) {
        $text = [string]$phrases[$i]
        $fileName = "phrase-$i.wav"
        $path = Join-Path $OutDir $fileName

        $synth.SetOutputToWaveFile($path)
        $synth.Speak($text)
        # The file stays locked and its header stays unfinished until the output is redirected
        # away again, so this is not optional tidying: without it the WAV cannot be read.
        $synth.SetOutputToNull()

        Write-Output ("{0}`t{1}`t{2}" -f $i, $fileName, $text)
    }
} finally {
    $synth.Dispose()
}
