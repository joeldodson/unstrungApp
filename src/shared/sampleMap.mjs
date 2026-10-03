/**
 * Which recording plays for each note, loudness and round robin, read from the sample packs' .sfz
 * maps.
 *
 * Shared so the two builds agree. The desktop app reads the maps at run time, in the main process;
 * the web build reads them once, at build time, and ships the result as JSON, since a browser
 * cannot read the sample folders. Text in, plain objects out: no file access here.
 */

// Velocity tiers, confirmed directly against the sample filenames of both packs, which agree on
// the <note>_<p|mf|f>_rr<N>.wav shape. On the guitar "p" always has 2 round-robins while "mf" and
// "f" have 4 for most notes and 2 for the ten highest; the bass has 4 throughout. The bass also
// records an "mp" tier, which nothing here can ask for and which is therefore not bundled.
export const VELOCITY_LABELS = ['p', 'mf', 'f'];

/**
 * Parses the <region> blocks of an .sfz map, honoring opcodes set on an enclosing <group> header
 * (some .sfz files set lokey/pitch_keycenter/trigger once per group rather than repeating it on
 * every region).
 */
export function parseSfzRegions(text) {
    const parts = text.split(/<(region|group)>/);

    const regions = [];
    let group = {};
    for (let i = 1; i < parts.length; i += 2) {
        const headerType = parts[i];
        const body = parts[i + 1] ?? '';
        const getOpcode = key => {
            const match = body.match(new RegExp(`${key}=([^\\s]+)`));
            return match ? match[1] : undefined;
        };

        if (headerType === 'group') {
            group = {
                lokey: getOpcode('lokey'),
                pitch_keycenter: getOpcode('pitch_keycenter'),
                trigger: getOpcode('trigger')
            };
            continue;
        }

        const sample = getOpcode('sample');
        if (!sample || sample.startsWith('*')) continue;
        const key = Number(getOpcode('pitch_keycenter') ?? group.pitch_keycenter ?? getOpcode('lokey') ?? group.lokey);
        if (!Number.isFinite(key)) continue;
        regions.push({
            key,
            sample,
            trigger: getOpcode('trigger') ?? group.trigger,
            hivel: Number(getOpcode('hivel') ?? 127),
            // Round-robin ordering as the sample pack itself specifies it. A region with no
            // seq_position is the first step in the cycle.
            seqPosition: Number(getOpcode('seq_position') ?? 1),
            seqLength: Number(getOpcode('seq_length') ?? 1)
        });
    }
    return regions;
}

/**
 * Groups the regions of one or more maps by MIDI key, then by velocity tier, each list in the
 * round-robin order the pack specifies.
 *
 * `sources` is a list of { regions, base }: `base` is whatever a region's sample path resolves
 * against, carried on each entry so two packs keep their own layouts and neither is rewritten.
 * Note that a cycle can revisit the same file: several notes alternate two recordings across four
 * sequence positions, so a "4 round robin" note does not necessarily have four distinct takes.
 *
 * Returns a Map of key to { p, mf, f }, each an array of { ...region, base }.
 */
export function buildSampleMap(sources) {
    const byKey = new Map();
    for (const { regions, base } of sources) {
        for (const region of regions) {
            const match = region.sample.match(/_(p|mf|f)_rr\d+\.wav$/i);
            if (!match) continue;
            const velocity = match[1].toLowerCase();
            if (!byKey.has(region.key)) byKey.set(region.key, {});
            (byKey.get(region.key)[velocity] ??= []).push({ ...region, base });
        }
    }
    for (const byVelocity of byKey.values()) {
        for (const candidates of Object.values(byVelocity)) {
            candidates.sort((a, b) => a.seqPosition - b.seqPosition);
        }
    }
    return byKey;
}
