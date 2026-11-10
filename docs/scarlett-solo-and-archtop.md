# The Scarlett Solo and the Eastman archtop

Notes from a session on 2026-11-08 and 2026-11-09, after Joel plugged his Eastman AR905CE into a
Focusrite Scarlett Solo 4th Gen for the first time. Windows picked the Solo as its audio device as
soon as it was plugged in, and the guitar could be heard, but it did not sound good. This records
what each control on both does, how to set them, and whether unstrung could talk to the Solo.
Nothing here is built.

## The guitar

The AR905CE has one pickup, a floating pickup: it hangs from the end of the fingerboard or the
pickguard and does not touch the carved top. Listings disagree on the make; earlier ones name a
Kent Armstrong (HJGS6-GD), later ones a Lollar Johnny Smith style pickup. Either way it is passive,
with no battery, so its controls can only take signal away.

The two dials near the bridge are thumbwheels on the edge of the pickguard: one volume, one tone.
They sit under the pickguard edge so nothing is drilled into the top. A forum post says both are
linear taper.

- **Volume** sets how much of the pickup's signal reaches the cable. Fully down is silent.
- **Tone** takes off treble. Fully up is brightest; down is rounder and darker, then muffled. Jazz
  players often keep it partway down.

Which wheel is which, and which direction is up, was not confirmed. The test is by ear: play an
open string and roll one wheel through its range. If the sound fades to nothing it is volume; if
it stays about as loud but goes from bright to dull it is tone.

Start with both fully up. That gives the interface the strongest signal and the plainest sound, and
takes two variables away while setting the interface up. A weak or muddy sound is often a wheel
left partway down.

## The Scarlett Solo 4th Gen

From Focusrite's hardware guide,
<https://userguides.focusrite.com/hc/en-gb/articles/17505454690706-Scarlett-Solo-Hardware-Features>.
Automated fetches of that site are refused; it was read in Chrome.

### Front panel

The guide lists these in this order, which is probably left to right; not checked by touch.

- Input 1 gain knob, with a light ring around it, the gain halo.
- Input 1 jack, 1/4 inch, line or instrument. The guitar goes here.
- Inst button.
- Input 2 gain knob, with its own halo. Input 2 is the XLR microphone socket on the back.
- 48V button.
- Air button.
- Output knob, the large one.
- USB light: green when the computer recognises the Solo, white when connected but not recognised,
  flashing red when it is not getting enough power.
- Direct button.
- Headphone level knob.
- Headphone jack, 1/4 inch TRS.

### Back panel

Kensington lock slot, USB-C, speaker outputs R and L (1/4 inch, balanced TRS recommended), and the
XLR microphone input, which is input 2.

### What each control does for a guitar

- **Input 1 gain** sets how much the guitar signal is amplified before it reaches the computer.
  Clockwise is more. Too low and the guitar is quiet, and turning it up later brings hiss with it.
  Too high and loud notes clip, a harsh crackly distortion. The halo shows green for a good level,
  amber when close to clipping and red when clipped. Focusrite's guide calls these analogue gain
  controls, so software cannot read or set them.
- **Inst** switches input 1 between instrument level (green) and line level (white). It changes the
  impedance as well as the level. Focusrite says a guitar with Inst off sounds muddy and quiet.
  It should be on. With Inst on and a jack plugged in, the minimum gain is +7 dB. Switching Inst
  keeps the gain where it was. The test without the light: press it while playing; the setting
  that sounds clearer and stronger is on.
- **Input 2 gain, 48V and Air** are for the microphone input only. With no microphone, turn input 2
  gain fully anticlockwise so it adds no hiss. 48V powers condenser microphones and is never sent
  to the 1/4 inch jack; leave it off. Air brightens the microphone input: one press for Presence,
  a second for Presence and Harmonic Drive, a third for off. It does nothing to the guitar.
- **Output** sets the level at the speaker outputs on the back. **Headphone level** sets the
  headphone jack, separately. Neither changes what is recorded. With headphones on, Output does
  nothing audible, which can make the knobs seem random.
- **Direct** (Direct Monitor) sends the inputs straight to the outputs, without going through the
  computer: no delay, and no software effects. Green is on, white is off. If Direct is on and
  something on the computer also plays the input back (Windows's "Listen to this device", or a
  recording program), the guitar is heard twice, slightly apart in time, which sounds hollow or
  phasey. Have only one path on. The simplest is Direct on and nothing on the computer playing the
  input.

### Setting the gain by ear

1. Both guitar wheels fully up.
2. Input 1 gain fully anticlockwise, then turn it up slowly while strumming as hard as you ever
   play.
3. When the loudest strums start to crackle or distort, turn it back a good amount, roughly a
   quarter turn.
4. Set listening volume with the headphone knob, never the gain.

Focusrite Control 2, Focusrite's free app, shows the input level as a number in dBFS, with a peak
reading that can be reset. Around -18 to -12 dBFS on the loudest strums is a comfortable target.
Whether NVDA can read that number has not been tried.

### What to expect

A guitar straight into an interface sounds plainer than through an amplifier, which shapes the tone
heavily. For a jazz archtop the bare sound can be pleasant, but it is drier and thinner than people
expect. If it still sounds wrong after the settings above, the next step is to name what is wrong
(thin, muddy, hissy, doubled or distorted) and what it is heard through, since each has a
different cause.

## Listening through Bluetooth headphones

Raised 2026-11-09. When the Solo is plugged in, Windows makes it the default playback device, so
NVDA and everything else move to the Solo's outputs and away from Joel's Bluetooth headphones (Bose
QC 45; he also has Shokz OpenFit). He wants to keep the Bluetooth headphones, hear the guitar in
them, and not have to redo anything each time the Solo is plugged in. Tried 2026-11-09 and it
works, including after moving the Solo to a different USB port. The delay is very noticeable, but
it is good for experimenting with tone. The steps:

1. In the classic Sound dialog (`mmsys.cpl`), Playback tab: make "Headphones (Bose QC 45)" both the
   Default Device and the Default Communication Device. "Headphones" is the stereo profile;
   "Headset (... Hands-Free)" is the low-quality call profile.
2. Disable "Speakers (Focusrite USB Audio)" on the Playback tab, so Windows can never move sound to
   the Solo. Direct Monitor to the Solo's own headphone jack still works, since it never passes
   through Windows. Re-enable it to use wired headphones or speakers on the Solo with computer
   sound.
3. Recording tab: make "Analogue 1 + 2 (Focusrite USB Audio)" the Default Device and Default
   Communication Device, so no app opens the Bose microphone, which would switch the headphones to
   the hands-free profile. Optionally disable the Bose "Headset" endpoints to rule that out.
4. Properties of "Analogue 1 + 2", Listen tab: tick "Listen to this device" and play it back
   through "Headphones (Bose QC 45)". This is Windows passing the input to the headphones.
5. Turn on "Combine Input 1 and Input 2" on the Solo (hold Direct for three seconds, or Control 2,
   Preferences, Device). Without it, input 1 is the left channel only, and the guitar would be in
   the left ear only. Keep input 2 gain down so the microphone input adds no hiss.

Why it should survive replugging: Windows keeps defaults, disabled endpoints and the Listen setting
per endpoint, and the Solo reports a serial number, so it is the same device in any USB port. To be
confirmed by unplugging and replugging.

The catch is delay. Bluetooth adds roughly 150 to 250 ms, plus Windows's own listening path, and
an archtop is also heard acoustically, so the headphone sound will trail the strings like an echo.
Fine for checking tone and levels; poor for playing in time. Wired headphones in the Solo with
Direct Monitor have no delay.

### Distortion with Direct Monitor, clean through the laptop

Reported 2026-11-09: in the first session, with Direct on and wired headphones in the Solo, there
was a lot of distortion even at low volume, and no knob on the Solo or the guitar fixed it. Through
the laptop to the Bose it sounds much cleaner and nicer.

Both paths share the gain stage, so if the gain were clipping, both would distort. That points to
one of:

- **The gain was higher then.** In the first session the gain was turned up to get any sound, and
  the headphone knob down to make it quieter. Clipping happens before the headphone knob, so a
  quieter headphone level is still distorted. Likely, if the gain has since come down.
- **The headphone plug.** The Solo's jack is 1/4 inch TRS. Headphones with an inline microphone or
  remote are TRRS, and Focusrite says they are unlikely to work properly; a plug not fully home in
  an adapter does similar damage.
- **The headphones themselves.** The Bose QC 45 applies its own equalisation, which flatters a
  guitar compared with plainer headphones.

Test proposed: with the gain as it is now, plug wired headphones into the Solo and turn Direct on,
leaving the Bose setup running, and compare the two at once. Distortion in the wired headphones
only means the plug or headphones; distortion in both means the gain.

Result, 2026-11-09: with the same headphones (Bose QC 45 on the cable that came with them, 2.5 mm
at the headphone end and 3.5 mm into a 1/4 inch adapter, seated fully) Direct Monitor sounds
better. Most likely the first session had too much gain and too little headphone level.

TRS, tip-ring-sleeve, is the standard stereo headphone plug and is what the Solo wants: tip is
left, ring is right, sleeve is ground. A plug without the ring is TS, which is mono, and would give
one channel or a wrong sound; TRRS, with an extra ring for a microphone, is what to avoid. By touch,
TRS has two thin insulating bands between three metal sections, TRRS has three. The Bose cable has
no microphone, so it is TRS. A 2.5 mm to 1/4 inch cable is rare; the cable plus a stereo 3.5 mm to
1/4 inch adapter, as Focusrite itself recommends, is fine. Nothing to buy.

## Focusrite Control 2

Read on 2026-11-09 from Control 2 1.1210's UI Automation tree (what NVDA sees) on Joel's laptop,
and from Focusrite's "Scarlett Solo 4th Gen and Screen Readers in Depth",
<https://support.focusrite.com/hc/en-gb/articles/19056805254674-Scarlett-Solo-4th-Gen-and-Screen-Readers-in-Depth>.
Focusrite says it tested with VoiceOver and Narrator; NVDA is not named. Every control is in the
tab order and has a name and state.

### Layout, in tab order

- **Navigation bar:** Inputs and Mixer, toggle buttons that switch the page.
- **Presets** button. Its name starts with the loaded preset's name, or a dash when none is loaded.
- **More options:** About (app and firmware versions, serial number), Preferences, Check for
  updates, and help links.
- The page's name as text, then the page.
- At the bottom, a combo box naming the device and sample rate: "Scarlett Solo, 48 kHz".

### Inputs page

- **Analogue 1** group, named with its state: "Analogue 1, line input" or instrument input.
  - **Peak** button. Its name is the highest level since it was last reset, "Peak, -18.5dB" for
    example, or "Signal has clipped". While it has focus it announces each new peak. It reads
    "we didn't detect any useable signal" when there is none. Pressing it resets it. This is the
    accessible replacement for the gain halo.
  - **Meter**: "Signal present" or "No signal".
  - **Inst** toggle.
- **Analogue 2, fixed microphone input** group: Peak, Meter, **+48V** toggle, **Air** toggle
  (named with its mode, "Air, Presence & Drive"), and an **Air mode** combo box.

There is no gain control: the Solo's gain is analogue.

### Mixer page

- **Mix navigation bar:** two mixes, **Direct** and **Loopback**, each with a More options menu
  (rename, copy, paste). Direct is what Direct Monitor sends to the headphone and speaker outputs;
  Loopback is a mix sent back to the computer as extra recording inputs, for streaming or recording
  computer sound.
- **Mix Routings:** where the selected mix goes, "Outputs 1 - 2" for Direct.
- A group for each channel: **Analogue 1**, **Analogue 2** and **Playback 1 - 2** (sound from the
  computer). Each has **Pan** (-100 to 100), **Level** (-128 to +6 dB), a meter, **Mute** and
  **Solo**. Solo silences every channel that is not soloed. With both on, the one pressed last
  wins, and Mute's name then says "Overridden by Solo".
- **Direct** group: left and right meters for the whole mix, and the **Direct Monitor** toggle.

### Preferences

- **Sample rate:** 44.1 to 192 kHz. Other audio programs can force their own.
- **Device:** Combine Input 1 and Input 2; Send Direct Monitor mix to Loopback; Loopback mode
  (audio capture, video call, stream); front panel light brightness and sleep; Reset to default
  settings.
- **Application:** mixer metering before or after the fader; MIDI control; usage data.
- **Remote devices:** paired phones running the Focusrite Control 2 mobile app.

### What it showed on 2026-11-09

- Analogue 1 was a **line input: Inst off.** The guitar was going in at line level, which Focusrite
  says sounds muddy and quiet. Inst should be on. The gain then has to be set again, since Inst
  raises the minimum gain to +7 dB.
- Analogue 1's Peak read "Signal has clipped", from some time since it was last reset.
- Analogue 2 had **Air on, Presence & Drive**, with nothing plugged in. With Combine Input 1 and
  Input 2 on, input 2 is summed into the guitar, so its hiss and Air's drive are too. Air should be
  off and input 2's gain down.
- In the Direct mix, Analogue 1 had **Solo on and Mute on**, Mute overridden. Solo silences
  Playback 1 - 2 in the wired headphones. To clear it, turn Mute off first, then Solo; the other way
  round leaves the guitar muted. Playback 1 - 2 was at -5 dB.

## Could unstrung talk to the Solo?

### No official interface to the hardware

Focusrite publishes no SDK or API for the Scarlett range. Focusrite Control 2 is the only official
way to change settings from a computer. Control 2 itself does have two ways in; see "Two ways into
Focusrite Control 2" below.

### Is the Solo's gain really analogue?

Questioned on 2026-11-09, since Control 2 shows levels and other 4th Gen models let it set the
gain. For the Solo, three sources agree that the gain cannot be read or set digitally:

- Focusrite's hardware guide calls them "two analogue gain controls".
- Control 2's documented MIDI parameters for the Solo (below) cover 48V, Air, Air mode, Inst and
  the mixer, and no gain.
- The Linux driver's configuration for the Solo Gen 4 has switches for phantom power, Inst
  (`LEVEL_SWITCH`), Air and Direct Monitor, a direct monitor gain, and no `INPUT_GAIN`. The 2i2 Gen
  4 has `INPUT_GAIN`, a 0 to 69 dB range, and Auto Gain with its targets.

So the intuition is right for the 2i2 Gen 4 and larger models, whose knobs drive digitally
controlled preamps, and not for the Solo. What Control 2 shows for the Solo is the meter: the
level the gain produces, in dBFS, not the knob's position. The audio stream gives unstrung the
same measurement.

### The protocol is already reverse engineered

Geoffrey Bennett worked it out on Linux in 2018 by capturing the USB traffic between Focusrite
Control and a Scarlett 18i20, and wrote the Linux kernel driver `scarlett2`
(`sound/usb/mixer_scarlett2.c`) and a graphical mixer, alsa-scarlett-gui. The Solo, 2i2 and 4i4 4th
Gen have been supported since Linux 6.8. One source says only a basic set of controls works on the
Solo. A later driver, the Focusrite Control Protocol driver (`sound/usb/fcp.c`) with user-space
support in github.com/geoffreybennett/fcp-support, moved most of the work out of the kernel because
each firmware release moves the controls around. So the protocol is in effect documented in open
source, but Focusrite can change it with any firmware update.

### Why it does not suit unstrung

- **What could be controlled is small:** Inst, Air, 48V, Direct Monitor and the monitor mix. The
  gain knobs are analogue.
- **Windows:** a driver already holds the device. On Joel's laptop, checked 2026-11-09, it is
  Focusrite's: Focusrite Audio Drivers 4.150.0.432 are installed, the Solo (USB `VID_1235`,
  `PID_8218`) uses the `FocusriteUsb` service, and Focusrite Control 2 1.1210 and Focusrite
  Notifier run in the background. unstrung would need either Focusrite's private, undocumented
  driver interface or a way to send USB control messages alongside the driver. Neither is
  supported and either could break with an update. Still not checked: whether, on a machine
  without Focusrite's driver, Windows's own driver leaves the Solo's vendor-specific control
  interface unclaimed.
- **Web:** browsers do not let a page claim a USB device that the operating system's audio driver
  holds, so a web unstrung could not do it. That cuts against keeping unstrung web-portable.
- **Reverse engineering it again:** possible without disassembling Focusrite's software, by
  capturing USB traffic with USBPcap and Wireshark while toggling each setting in Control 2, as
  Bennett did with usbmon. Focusrite's licence probably forbids reverse engineering; many countries
  allow it for interoperability, but how that applies to Joel was not looked into. Since Bennett's
  code covers the Solo, a new capture would mostly repeat his work, and the Windows driver problem
  would remain.

### What unstrung could do instead: an input level you can hear

The useful part, knowing the input level without seeing the gain halo, needs nothing from
Focusrite. unstrung receives the guitar's audio when it opens the Solo as an input, so it can
measure the peak level itself and announce it in dBFS, or warn when a note clips. It would work
with any interface, in Electron and in a browser, and fits the input plumbing planned in
`web-deployment-and-guitar-input.md`, as a companion to the tuner. Inst, Air and 48V are set once
and left, so not reading them from software costs little.

Not decided or built: Joel asked for notes only, not code, in this session.

### If Focusrite offered a bridge for browsers

Asked on 2026-11-09: assuming Focusrite's Windows driver is installed, could Focusrite install
something alongside it, in user space, that passes commands from a web page to the driver? Yes.
Focusrite owns both the driver and the protocol, so the hard part (talking to the device) is
already solved on their side; the bridge is ordinary software. A page has three ways to reach
local software:

- **A local WebSocket or HTTP server.** A background program listens on localhost and the page
  connects to it. Browsers treat localhost as secure, so an https page may connect to it. This
  works in every desktop browser with no extension. Two costs: Chrome now asks the user's
  permission before a public website may reach localhost or the local network; and the server
  must check which website is calling and pair with it, or any page on the internet could switch
  48V on. Zoom's localhost server, found in 2019 to let any website turn on a Mac's camera, is the
  warning example.
- **Web MIDI.** The bridge, or the device's own firmware, presents a MIDI port, and the page sends
  System Exclusive messages to it. Novation, Focusrite's sister company, already does this: its
  Components web app edits settings and updates firmware on Novation controllers through Web MIDI.
  Works in Chrome, Edge and Firefox, not Safari; SysEx asks permission once. On Windows a virtual
  MIDI port needs Windows MIDI Services or a third-party loopback driver; a firmware change that
  gave the Solo a real MIDI interface would avoid that.
- **A browser extension with native messaging.** The extension talks to an installed program over
  standard input and output. Reliable and well contained, but needs an extension for each browser,
  and the user has to install it.

What none of them reaches: phones. On an iPhone the Solo is a class-compliant device with no
Focusrite software, so there is nothing to bridge to. Joel tests releases on his phone.

Whether Focusrite would build such a thing is unknown; nothing found says they plan to. Novation's
use of Web MIDI shows the company has done it before. Someone other than Focusrite could build the
same bridge only if it could reach the device, which on Windows comes back to the open question
above about Windows's own driver, or to Focusrite's undocumented driver interface.

For unstrung the payoff is still small. Inst, Air, 48V and Direct Monitor are set once, and the
gain, the one control worth reading, is analogue and could not be reached anyway. The announced
input level needs no bridge.

### Two ways into Focusrite Control 2

From Focusrite's guide "Using Focusrite Control 2 with your Scarlett Solo 4th Gen",
<https://userguides.focusrite.com/hc/en-gb/articles/17505474549906-Using-Focusrite-Control-2-with-your-Scarlett-Solo-4th-Gen>,
read 2026-11-09. Both need Control 2 running.

- **MIDI control, documented.** Under Preferences, Application, MIDI Control, Control 2 listens to
  a chosen MIDI device and channel. For the Solo the documented parameters are: 48V on CC 101,
  Air on CC 110 and Air mode on NRPN 1:38, Inst on CC 126 (cycling), and for Mix A the level of
  Analogue 1, Analogue 2, Playback 1 and 2 on CCs 20, 21, 28 and 29, mute on 41, 42, 49 and 50,
  and solo on 51, 52, 59 and 60. Toggles are 0 off, 127 on. Nothing says Control 2 sends MIDI
  back, so this appears to be one-way: it can set things but not report them. A program sending
  to it needs a MIDI port Control 2 can listen on; on Windows that is a loopback port from
  Windows MIDI Services or a tool such as loopMIDI. Web MIDI could send to such a port, so this
  even works from a browser.
- **The mobile remote, undocumented.** The Focusrite Control 2 mobile app, for iOS and Android,
  connects over Wi-Fi to Control 2 on the computer and controls and views it; Preferences, Remote
  Devices lists paired phones. So Control 2 already runs a network service built for a remote
  client, which presumably carries state and meters both ways. Its protocol is not published.
  Learning it would mean capturing the traffic between the phone app and Control 2, which is
  reverse engineering again, but of a protocol designed for remote use and less likely to move
  with firmware than the USB one.

Other facts from that guide: the Solo keeps its settings in the device when moved to another
computer; Control 2 presets hold channel name, 48V, Inst and Air mode; holding Inst for two
seconds turns the front panel lights off; holding Direct for three seconds toggles "Combine Input 1
and Input 2", which sums both inputs for apps that only take the first channel or pan the two
apart.

### What limiting it to the Electron app opens up

Joel's view, 2026-11-09: someone who has bought a Scarlett is committed enough to install the
desktop app, so hardware features may be Electron-only. Under the project's rule they still go
through `window.unstrung`, with the web build reporting them as unavailable.

What Electron's main process can do that a page cannot:

- **Raw network sockets and local discovery.** A page can only use HTTP, WebSocket and WebRTC. The
  main process can open any TCP or UDP connection, which is what speaking Control 2's mobile
  remote protocol would need. This is the most promising route to two-way control and state,
  including meters, if the protocol were learned.
- **Native code and helper programs.** Native Node addons, or a small helper program, can call
  Windows APIs directly: `DeviceIoControl` on Focusrite's driver (undocumented), libusb or WinUSB
  where a device is free, and the Windows audio APIs.
- **Low-latency audio.** Chromium records through Windows's shared audio path, which adds tens of
  milliseconds. A native addon could use ASIO, which Focusrite's driver provides, or WASAPI
  exclusive mode. That matters only for hearing the guitar through unstrung's own processing, an
  amplifier sound for example, not for analysis. Direct Monitor covers hearing yourself.
- **Knowing exactly what is plugged in.** A page sees a device label. The main process can read the
  USB vendor and product IDs (1235 and 8218 for the Solo) and the driver in use, so unstrung could
  tell which model it has and what it supports.
- **MIDI ports of its own.** A page can only use MIDI ports that already exist. A native addon or
  Windows MIDI Services could create a port for Control 2 to listen to, so the user would not
  need loopMIDI.

What it does not open up: the Solo's gain stays analogue. A 2i2 Gen 4 or larger would be
different, since their gain and Auto Gain are digital.

For the Solo, the order of value is probably: the announced input level from the audio, which needs
none of this and works on the web; then Control 2's MIDI control for Inst, Air and 48V, which is
documented but one-way; then the mobile remote protocol for two-way state, which needs reverse
engineering; then ASIO, only if unstrung ever processes the guitar sound live.

## Sources

- Focusrite, Scarlett Solo 4th Gen hardware features (above).
- Gak, Sound Pure and Django Books listings for the AR905CE and AR910CE, for the pickup and
  controls.
- jazzguitar.be forum, "Eastman 905CE pickups", for the linear pots.
- Linux kernel source, `mixer_scarlett2.c` and `fcp.c`; the FCP patch series on
  patchwork.kernel.org; Phoronix on Linux 6.8; an Ardour forum thread and a ComputingForGeeks guide
  on how much of the Solo works under Linux.
