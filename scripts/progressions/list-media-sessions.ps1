# Lists the media sessions Windows knows about: the apps the media keys can reach.
#
# Windows routes the keyboard's media keys, and the media overlay, to one of these sessions. An app
# that is not listed cannot be reached by them however its page registers its handlers.
#
# With -App and -Send, also sends a command to the session whose app id matches the -App pattern:
# PlayPause, Next or Previous. That is what Windows does when the key is pressed and that session
# is the one it picks, so it tests the whole route from Windows to the page.
#
# Runs under Windows PowerShell 5.1 (powershell.exe), which can await WinRT calls; PowerShell 7
# cannot without extra packages.

param(
    [string]$App = '',
    [ValidateSet('', 'PlayPause', 'Next', 'Previous')]
    [string]$Send = ''
)

Add-Type -AssemblyName System.Runtime.WindowsRuntime
$asTask = [System.WindowsRuntimeSystemExtensions].GetMethods() | Where-Object {
    $_.Name -eq 'AsTask' -and $_.GetParameters().Count -eq 1 -and
    $_.GetParameters()[0].ParameterType.Name -eq 'IAsyncOperation`1'
} | Select-Object -First 1

function Wait-WinRt($operation, [Type]$resultType) {
    $task = $asTask.MakeGenericMethod($resultType).Invoke($null, @($operation))
    $task.Wait(-1) | Out-Null
    $task.Result
}

$managerType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionManager, Windows.Media.Control, ContentType = WindowsRuntime]
$propertiesType = [Windows.Media.Control.GlobalSystemMediaTransportControlsSessionMediaProperties, Windows.Media.Control, ContentType = WindowsRuntime]

$manager = Wait-WinRt ($managerType::RequestAsync()) $managerType
$current = $manager.GetCurrentSession()
$sessions = $manager.GetSessions()

foreach ($session in $sessions) {
    $properties = Wait-WinRt ($session.TryGetMediaPropertiesAsync()) $propertiesType
    $status = $session.GetPlaybackInfo().PlaybackStatus
    $isCurrent = $null -ne $current -and $session.SourceAppUserModelId -eq $current.SourceAppUserModelId
    "session: $($session.SourceAppUserModelId) | title: $($properties.Title) | artist: $($properties.Artist) | status: $status | current: $isCurrent"

    if ($App -and $Send -and $session.SourceAppUserModelId -like $App) {
        $operation = switch ($Send) {
            'PlayPause' { $session.TryTogglePlayPauseAsync() }
            'Next' { $session.TrySkipNextAsync() }
            'Previous' { $session.TrySkipPreviousAsync() }
        }
        "sent: $Send to $($session.SourceAppUserModelId) -> $(Wait-WinRt $operation ([bool]))"
    }
}
if ($sessions.Count -eq 0) { 'no sessions' }
