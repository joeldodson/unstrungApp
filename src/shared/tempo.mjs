// The tempo unstrung uses where nothing gives one: a new chord progression, the metronome, the
// pattern preview, and a song file that states no tempo of its own.
//
// alphaTab's `score.tempo` cannot tell the last case apart: for a file with no tempo marking it
// answers 120, alphaTab's own default. So the file's tempo is read from where alphaTab keeps it,
// the tempo marking on the first measure.

export const DEFAULT_TEMPO = 60;

/** The tempo a score's file states, or null when it states none. */
export function fileTempo(score) {
    const marked = score?.masterBars?.[0]?.tempoAutomations?.[0]?.value;
    if (marked > 0) return marked;
    // A score built by hand, as the check scripts do, sets `tempo` as a plain field rather than
    // through alphaTab's getter, and that is a tempo it states.
    const own = score ? Object.getOwnPropertyDescriptor(score, 'tempo') : undefined;
    return own && 'value' in own && own.value > 0 ? own.value : null;
}

/** The tempo a score plays at: its file's own, or DEFAULT_TEMPO. */
export function scoreTempo(score) {
    return fileTempo(score) ?? DEFAULT_TEMPO;
}
