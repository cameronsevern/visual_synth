const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioContext.createAnalyser();
analyser.fftSize = 2048; // Standard FFT size for detailed frequency analysis

const oscillatorMap = new Map();
let waveformType = 'sine'; // Default waveform
let currentKeyboardOctaveOffset = 0; // In semitones (e.g., 0 for no shift, 12 for one octave up, -12 for one octave down)

const LOWEST_MIDI_NOTE_61_KEY = 36; // C2
const HIGHEST_MIDI_NOTE_61_KEY = 96; // C7

// --- New ADSR and Filter Parameters ---
let attackTime = 0.01;    // seconds
let decayTime = 0.1;      // seconds
let sustainLevel = 0.8;   // 0.0 to 1.0
let releaseTime = 0.5;    // seconds

let lpfCutoff = 20000;    // Hz
let hpfCutoff = 20;       // Hz

// --- New Audio Nodes ---
const lpfNode = audioContext.createBiquadFilter();
lpfNode.type = 'lowpass';
lpfNode.frequency.value = lpfCutoff;

const hpfNode = audioContext.createBiquadFilter();
hpfNode.type = 'highpass';
hpfNode.frequency.value = hpfCutoff;

// --- Dynamics Compressor Node ---
const compressorNode = audioContext.createDynamicsCompressor();
compressorNode.threshold.setValueAtTime(-50, audioContext.currentTime);
compressorNode.knee.setValueAtTime(40, audioContext.currentTime);
compressorNode.ratio.setValueAtTime(12, audioContext.currentTime);
compressorNode.attack.setValueAtTime(0, audioContext.currentTime);
compressorNode.release.setValueAtTime(0.25, audioContext.currentTime);

// Updated Audio Graph: [source] -> lpfNode -> hpfNode -> analyser -> compressorNode -> destination
lpfNode.connect(hpfNode);
hpfNode.connect(analyser);
analyser.connect(compressorNode); // analyser now connects to compressor
compressorNode.connect(audioContext.destination); // compressor connects to destination
// analyser is already connected to audioContext.destination (original line 16) - This comment is now outdated.

// Function to be called by UI controls (e.g., from visualizer.js) to set the keyboard's octave shift
function setKeyboardOctaveOffset(offsetInOctaves) {
    currentKeyboardOctaveOffset = offsetInOctaves * 12;
    // console.log(`Synth: Keyboard octave offset set to ${offsetInOctaves} (${currentKeyboardOctaveOffset} semitones)`);
    if (typeof visualizer !== 'undefined' && visualizer.updateMappedRangeHighlight) {
        visualizer.updateMappedRangeHighlight();
    }
}

// Connect analyser to destination to ensure it processes audio
// analyser.connect(audioContext.destination); // This is now handled by hpfNode.connect(analyser)

// Helper to resume AudioContext
function resumeAudioContextIfNeeded() {
    if (audioContext && audioContext.state === 'suspended') {
        audioContext.resume().then(() => {
            // console.log('AudioContext resumed successfully');
        }).catch(e => console.error('Error resuming AudioContext:', e));
    }
}

function midiToFrequency(midi) {
    return 440 * Math.pow(2, (midi - 69) / 12);
}

// Helper function to convert MIDI note to note name and octave
const NOTE_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
function midiToNoteNameAndOctave(midiNote) {
    const noteIndex = midiNote % 12;
    const octave = Math.floor(midiNote / 12) - 1; // MIDI note 0 is C-1, so C4 (MIDI 60) is octave 4
    return { noteName: NOTE_NAMES[noteIndex], octave: octave };
}

// New functions for MIDI note numbers
function playNoteByMidi(midiNote) {
    resumeAudioContextIfNeeded(); // Ensure audio context is active

    const now = audioContext.currentTime;

    // Handle re-triggering: stop and clean up the old note if it exists
    if (oscillatorMap.has(midiNote)) {
        const oldNoteData = oscillatorMap.get(midiNote);
        // console.log(`Re-triggering MIDI note ${midiNote}. Stopping previous instance.`);
        oldNoteData.envelopeGainNode.gain.cancelScheduledValues(now);
        oldNoteData.envelopeGainNode.gain.setValueAtTime(oldNoteData.envelopeGainNode.gain.value, now); // Start from current gain
        oldNoteData.envelopeGainNode.gain.linearRampToValueAtTime(0.0001, now + 0.02); // Very fast fade
        oldNoteData.oscillator.stop(now + 0.02);

        const oldOsc = oldNoteData.oscillator;
        const oldGain = oldNoteData.envelopeGainNode;
        oldOsc.onended = () => {
            try { oldOsc.disconnect(); } catch (e) { /* console.warn('Old osc disconnect error on re-trigger:', e); */ }
            try { oldGain.disconnect(); } catch (e) { /* console.warn('Old gain disconnect error on re-trigger:', e); */ }
        };
        oscillatorMap.delete(midiNote);
    }

    const freq = midiToFrequency(midiNote);
    if (isNaN(freq)) {
        console.error(`Invalid MIDI note: ${midiNote} resulted in NaN frequency.`);
        return;
    }

    const oscillator = audioContext.createOscillator();
    const envelopeGainNode = audioContext.createGain();

    oscillator.type = waveformType;
    oscillator.frequency.setValueAtTime(freq, now);

    // Connect nodes: oscillator -> envelopeGainNode -> lpfNode (-> hpfNode -> analyser)
    oscillator.connect(envelopeGainNode);
    envelopeGainNode.connect(lpfNode);

    // Apply ADSR Attack and Decay
    envelopeGainNode.gain.setValueAtTime(0, now); // Start at 0 gain
    envelopeGainNode.gain.linearRampToValueAtTime(1.0, now + attackTime); // Attack peak
    envelopeGainNode.gain.linearRampToValueAtTime(sustainLevel, now + attackTime + decayTime); // Decay to sustain

    oscillator.start(now);
    oscillatorMap.set(midiNote, { oscillator, envelopeGainNode });
    // console.log(`Playing MIDI: ${midiNote}, Freq: ${freq.toFixed(2)}, Wave: ${waveformType}, A:${attackTime} D:${decayTime} S:${sustainLevel}`);

    if (typeof visualizer !== 'undefined' && visualizer.highlightKeyboardNote) {
        const { noteName, octave } = midiToNoteNameAndOctave(midiNote);
        visualizer.highlightKeyboardNote(noteName, octave, true);
    }
}

function stopNoteByMidi(midiNote) {
    if (oscillatorMap.has(midiNote)) {
        const noteData = oscillatorMap.get(midiNote);
        const { oscillator, envelopeGainNode } = noteData;
        const now = audioContext.currentTime;

        // Apply ADSR Release
        envelopeGainNode.gain.cancelScheduledValues(now); // Cancel any ongoing ramps (like decay)
        envelopeGainNode.gain.setValueAtTime(envelopeGainNode.gain.value, now); // Start release from current gain value
        envelopeGainNode.gain.linearRampToValueAtTime(0.0001, now + releaseTime); // Ramp to (near) zero

        oscillator.stop(now + releaseTime); // Stop oscillator after release time
        oscillatorMap.delete(midiNote); // Remove from map, note is stopping

        // Schedule disconnection of nodes after they've finished playing
        oscillator.onended = () => {
            try { oscillator.disconnect(); } catch (e) { /* console.warn('Stop osc disconnect error:', e); */ }
            try { envelopeGainNode.disconnect(); } catch (e) { /* console.warn('Stop gain disconnect error:', e); */ }
            // console.log(`MIDI note ${midiNote} fully stopped and disconnected after release.`);
        };
        // console.log(`Stopping MIDI: ${midiNote}, R:${releaseTime}`);

        if (typeof visualizer !== 'undefined' && visualizer.highlightKeyboardNote) {
            const { noteName, octave } = midiToNoteNameAndOctave(midiNote);
            visualizer.highlightKeyboardNote(noteName, octave, false);
        }
    }
}

// Key to MIDI note mapping for three octaves
// Octave 1: C3 (MIDI 48) to B3 (MIDI 59)
// Octave 2: C4 (MIDI 60) to B4 (MIDI 71)
// Octave 3: C5 (MIDI 72) to B5 (MIDI 83)
// New keyboard mapping:
// White keys: 'a' (C4) through '\''
// Black keys: 'q' (C#4) through '['
const keyToMidiNote = {
    // White keys starting from C4 (MIDI 60)
    'a': 60, // C4
    's': 62, // D4
    'd': 64, // E4
    'f': 65, // F4
    'g': 67, // G4
    'h': 69, // A4
    'j': 71, // B4
    'k': 72, // C5
    'l': 74, // D5

    // Black keys - Updated Mapping
    // 'q': 61, // C#4 - Unmapped or re-assign if needed for other purposes
    'w': 61, // C#4
    'e': 63, // D#4
    't': 66, // F#4
    'y': 68, // G#4
    'u': 70, // A#4
    'o': 73, // C#5
    'p': 75, // D#5
};

const baseMidiNotesArray = Object.values(keyToMidiNote);
const minBaseMidi = Math.min(...baseMidiNotesArray);
const maxBaseMidi = Math.max(...baseMidiNotesArray);

function getCurrentlyMappedMidiRange() {
    const startNote = minBaseMidi + currentKeyboardOctaveOffset;
    const endNote = maxBaseMidi + currentKeyboardOctaveOffset;
    // Ensure the mapped range still falls within the overall 61-key keyboard limits
    // and also that startNote isn't greater than endNote if the offset pushes the range out entirely.
    const effectiveStart = Math.max(LOWEST_MIDI_NOTE_61_KEY, startNote);
    const effectiveEnd = Math.min(HIGHEST_MIDI_NOTE_61_KEY, endNote);

    return {
        min: Math.min(effectiveStart, effectiveEnd), // Ensure min <= max
        max: Math.max(effectiveStart, effectiveEnd)
    };
}

function playNote(key) {
    resumeAudioContextIfNeeded();
    const baseMidiNote = keyToMidiNote[key.toLowerCase()]; // Use toLowerCase for robustness against Shift key etc.
    if (baseMidiNote !== undefined) {
        const finalMidiNote = baseMidiNote + currentKeyboardOctaveOffset;
        // Ensure the note is within the standard 88-key piano range (MIDI 21-108)
        // This prevents errors if octave shift goes too far.
        // Use the defined constants for the 61-key range
        if (finalMidiNote >= LOWEST_MIDI_NOTE_61_KEY && finalMidiNote <= HIGHEST_MIDI_NOTE_61_KEY) {
            playNoteByMidi(finalMidiNote);
        } else {
            // console.warn(`Keyboard note ${key} (Base MIDI: ${baseMidiNote}) with offset ${currentKeyboardOctaveOffset / 12} octaves results in MIDI ${finalMidiNote}, which is outside the 61-key range (${LOWEST_MIDI_NOTE_61_KEY}-${HIGHEST_MIDI_NOTE_61_KEY}).`);
        }
    }
}

function stopNote(key) {
    const baseMidiNote = keyToMidiNote[key.toLowerCase()]; // Use toLowerCase for robustness
    if (baseMidiNote !== undefined) {
        const finalMidiNote = baseMidiNote + currentKeyboardOctaveOffset;
        // No range check needed for stopNote, as we just try to stop whatever might have been played.
        // The stopNoteByMidi function will handle if the note isn't actually playing.
        stopNoteByMidi(finalMidiNote);
    }
}

// Event listeners for keyboard
document.addEventListener('keydown', (event) => {
    // Prevent repeated notes if key is held down
    if (event.repeat) return;
    // Use event.key directly (it's lowercase for letters, or the symbol itself)
    playNote(event.key);
});

document.addEventListener('keyup', (event) => {
    // Use event.key directly
    stopNote(event.key);
});

// Listen to waveform buttons
const waveformButtons = document.querySelectorAll('.synth-button');

if (waveformButtons.length > 0) {
    waveformButtons.forEach(button => {
        button.addEventListener('click', () => {
            // Remove active class from all buttons
            waveformButtons.forEach(btn => btn.classList.remove('active'));
            // Add active class to the clicked button
            button.classList.add('active');

            waveformType = button.dataset.waveform;
            // Update any currently playing oscillators
            oscillatorMap.forEach(osc => {
                osc.type = waveformType;
            });
            console.log(`Waveform changed to: ${waveformType}`);
        });
    });
} else {
    console.error('Waveform buttons not found in the DOM.');
}

// Function for visualization script to get audio data
function getAudioData() {
    const timeDomainBufferLength = analyser.fftSize; // Use fftSize for time domain
    const frequencyBufferLength = analyser.frequencyBinCount; // Use frequencyBinCount for frequency domain

    const timeDomainData = new Uint8Array(timeDomainBufferLength);
    const frequencyData = new Uint8Array(frequencyBufferLength);

    analyser.getByteTimeDomainData(timeDomainData);
    analyser.getByteFrequencyData(frequencyData);

    return {
        timeDomainData,
        timeDomainBufferLength,
        frequencyData,
        frequencyBufferLength
    };
}

// --- DOMContentLoaded: Initialize Controls and Event Listeners ---
document.addEventListener('DOMContentLoaded', () => {
    // DOM Element References
    const attackSlider = document.getElementById('attack-slider');
    const decaySlider = document.getElementById('decay-slider');
    const sustainSlider = document.getElementById('sustain-slider');
    const releaseSlider = document.getElementById('release-slider');

    const lpfKnob = document.getElementById('lpf-knob');
    const hpfKnob = document.getElementById('hpf-knob');

    function initSynthControls() {
        if (attackSlider) attackSlider.value = attackTime;
        if (decaySlider) decaySlider.value = decayTime;
        if (sustainSlider) sustainSlider.value = sustainLevel;
        if (releaseSlider) releaseSlider.value = releaseTime;

        if (lpfKnob) lpfKnob.value = lpfCutoff;
        if (hpfKnob) hpfKnob.value = hpfCutoff;

        // Apply initial filter values to audio nodes (already set at creation, but good for consistency)
        lpfNode.frequency.setValueAtTime(lpfCutoff, audioContext.currentTime);
        hpfNode.frequency.setValueAtTime(hpfCutoff, audioContext.currentTime);
        // console.log('Synth controls initialized with default values.');
    }

    function setupControlEvents() {
        if (attackSlider) {
            attackSlider.addEventListener('input', (e) => {
                attackTime = parseFloat(e.target.value);
                // console.log('Attack set to:', attackTime);
            });
        }
        if (decaySlider) {
            decaySlider.addEventListener('input', (e) => {
                decayTime = parseFloat(e.target.value);
                // console.log('Decay set to:', decayTime);
            });
        }
        if (sustainSlider) {
            sustainSlider.addEventListener('input', (e) => {
                sustainLevel = Math.max(0.0001, Math.min(1.0, parseFloat(e.target.value))); // Clamp 0.0001 to 1.0
                // console.log('Sustain set to:', sustainLevel);
            });
        }
        if (releaseSlider) {
            releaseSlider.addEventListener('input', (e) => {
                releaseTime = parseFloat(e.target.value);
                // console.log('Release set to:', releaseTime);
            });
        }

        if (lpfKnob) {
            lpfKnob.addEventListener('input', (e) => {
                lpfCutoff = parseFloat(e.target.value);
                lpfNode.frequency.setTargetAtTime(lpfCutoff, audioContext.currentTime, 0.01); // Smooth change
                // console.log('LPF Cutoff set to:', lpfCutoff);
            });
        }
        if (hpfKnob) {
            hpfKnob.addEventListener('input', (e) => {
                hpfCutoff = parseFloat(e.target.value);
                hpfNode.frequency.setTargetAtTime(hpfCutoff, audioContext.currentTime, 0.01); // Smooth change
                // console.log('HPF Cutoff set to:', hpfCutoff);
            });
        }
        // console.log('Synth control event listeners set up.');
    }

    initSynthControls();
    setupControlEvents();
});

console.log('synth.js loaded, audio context initialized, and new controls set up.');

// Example: Call getAudioData periodically for visualization (visualization script would do this)
// setInterval(() => {
//     const data = getAudioData();
//     // console.log('Time Domain:', data.timeDomainData);
//     // console.log('Frequency Data:', data.frequencyData);
// }, 100);