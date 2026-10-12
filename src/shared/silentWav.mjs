/**
 * A WAV file of silence, as bytes.
 *
 * For the media keys. Windows offers its media controls only to a page playing a media element,
 * and Chromium does not count one playing a media stream, so a progression keeps a silent file
 * looping while it plays. Ten seconds, which is known to register: Chromium treats very short
 * sounds as notifications rather than something to control. At 8 kHz, 8 bits, mono that is 80 KB.
 */
export function silentWav(seconds = 10, sampleRate = 8000) {
    const samples = seconds * sampleRate;
    const bytes = new Uint8Array(44 + samples);
    const view = new DataView(bytes.buffer);
    const text = (offset, value) => {
        for (let i = 0; i < value.length; i++) bytes[offset + i] = value.charCodeAt(i);
    };
    text(0, 'RIFF');
    view.setUint32(4, 36 + samples, true);
    text(8, 'WAVE');
    text(12, 'fmt ');
    view.setUint32(16, 16, true); // size of the fmt chunk
    view.setUint16(20, 1, true); // PCM
    view.setUint16(22, 1, true); // mono
    view.setUint32(24, sampleRate, true);
    view.setUint32(28, sampleRate, true); // bytes per second
    view.setUint16(32, 1, true); // bytes per frame
    view.setUint16(34, 8, true); // bits per sample
    text(36, 'data');
    view.setUint32(40, samples, true);
    // Eight-bit samples are unsigned, so silence is the midpoint, not zero.
    bytes.fill(128, 44);
    return bytes;
}
