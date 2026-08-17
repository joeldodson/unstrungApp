# Notes on the audio samples

Things worth remembering about how the sample set is built and checked.
The README covers what the samples are and why they were chosen;
this file covers the mechanics that only matter when changing them.

## The bass library is written an octave high

`scripts/fetch-bass-samples.mjs` fetched the bass samples,
and exists mostly for one reason.
The sfz files shipped with
[Black And Blue Basses](https://github.com/sfzinstruments/karoryfer.black-and-blue-basses)
place its recordings an octave above where they actually sound,
because they are written for bass notation,
which sounds an octave below what is written.
The guitar library,
[Black And Green Guitars](https://github.com/sfzinstruments/karoryfer.black-and-green-guitars),
does not do that.

Trusting both libraries' own key numbers would have put every bass note an octave too high,
and nothing would have failed visibly — the notes would simply have been wrong.
The fetch script corrects the octave when it writes the map unstrung reads.

If the sample set is ever extended with another library,
check its sfz key numbers against the sound before trusting them.

## Verifying the pitch of what shipped

`scripts/progressions/verify-sample-range.mjs` measures the recordings themselves
to confirm each key in the map sounds at the pitch it claims.
Run it after any change to the sample map or to the fetch script.
It is the only check that would catch an octave error like the one above.

## The split point

Guitar samples cover E2 up to D6; bass samples cover B0 up to D#2.
Each pitch is covered by one instrument only, chosen by pitch alone,
so there is no per-track decision about what kind of instrument is playing.
The timbre changes slightly at the D#2/E2 boundary.
