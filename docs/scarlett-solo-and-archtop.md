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

## Could unstrung talk to the Solo?

### No official interface

Focusrite publishes no SDK or API for the Scarlett range. Focusrite Control 2 is the only official
way to change settings from a computer.

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
- **Windows:** a driver already holds the device, Focusrite's if it is installed, otherwise
  Windows's own USB audio driver. unstrung would need either Focusrite's private, undocumented
  driver interface or a way to send USB control messages alongside whichever driver has the
  device. Neither is supported and either could break with an update. Not checked: whether, under
  Windows's own driver, the Solo's vendor-specific control interface is left unclaimed and could be
  reached through WinUSB or libusb.
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

## Sources

- Focusrite, Scarlett Solo 4th Gen hardware features (above).
- Gak, Sound Pure and Django Books listings for the AR905CE and AR910CE, for the pickup and
  controls.
- jazzguitar.be forum, "Eastman 905CE pickups", for the linear pots.
- Linux kernel source, `mixer_scarlett2.c` and `fcp.c`; the FCP patch series on
  patchwork.kernel.org; Phoronix on Linux 6.8; an Ardour forum thread and a ComputingForGeeks guide
  on how much of the Solo works under Linux.
