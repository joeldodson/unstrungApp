// Reading the sample packs' WAV files, for the tuner's checks.

/** A WAV's samples as floats, from 16- or 24-bit PCM, first channel. */
export function decodeWav(buffer) {
    let offset = 12, sampleRate = 0, bits = 0, channels = 1, dataAt = -1, dataSize = 0;
    while (offset + 8 <= buffer.length) {
        const id = buffer.toString('ascii', offset, offset + 4);
        const size = buffer.readUInt32LE(offset + 4);
        if (id === 'fmt ') {
            channels = buffer.readUInt16LE(offset + 10);
            sampleRate = buffer.readUInt32LE(offset + 12);
            bits = buffer.readUInt16LE(offset + 22);
        } else if (id === 'data') {
            dataAt = offset + 8;
            dataSize = Math.min(size, buffer.length - dataAt);
            break;
        }
        offset += 8 + size + (size % 2);
    }
    if (dataAt < 0 || (bits !== 24 && bits !== 16)) throw new Error(`unexpected WAV: ${bits}-bit`);
    const bytes = bits / 8;
    const frames = Math.floor(dataSize / (bytes * channels));
    const samples = new Float32Array(frames);
    for (let i = 0; i < frames; i++) {
        const at = dataAt + i * bytes * channels;
        samples[i] = bits === 24 ? buffer.readIntLE(at, 3) / 8388608 : buffer.readInt16LE(at) / 32768;
    }
    return { samples, sampleRate };
}
