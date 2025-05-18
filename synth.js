const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioContext.createAnalyser();
analyser.fftSize = 2048; // Standard FFT size for detailed frequency analysis

const oscillatorMap = new Map();
let waveformType = 'sine'; // Default waveform
let currentKeyboardOctaveOffset = 0; // In semitones (e.g., 0 for no shift, 12 for one octave up, -12 for one octave down)

// Function to be called by UI controls (e.g., from visualizer.js) to set the keyboard's octave shift
function setKeyboardOctaveOffset(offsetInOctaves) {
    currentKeyboardOctaveOffset = offsetInOctaves * 12;
    // console.log(`Synth: Keyboard octave offset set to ${offsetInOctaves} (${currentKeyboardOctaveOffset} semitones)`);
}

// Connect analyser to destination to ensure it processes audio
analyser.connect(audioContext.destination);

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

    // Check if this specific MIDI note is already in the map (e.g. from QWERTY or another source)
    // For simplicity, we allow re-triggering by stopping the old one if it exists.
    if (oscillatorMap.has(midiNote)) {
        const oldOscillator = oscillatorMap.get(midiNote);
        oldOscillator.stop(audioContext.currentTime);
        oldOscillator.disconnect();
        oscillatorMap.delete(midiNote);
    }

    const freq = midiToFrequency(midiNote);
    if (isNaN(freq)) {
        console.error(`Invalid MIDI note: ${midiNote} resulted in NaN frequency.`);
        return;
    }

    const oscillator = audioContext.createOscillator();
    oscillator.type = waveformType;
    oscillator.frequency.setValueAtTime(freq, audioContext.currentTime);

    oscillator.connect(analyser);
    oscillator.start();
    oscillatorMap.set(midiNote, oscillator); // Use midiNote (number) as key
    // console.log(`Playing MIDI: ${midiNote}, Freq: ${freq.toFixed(2)}, Wave: ${waveformType}`);

    if (typeof visualizer !== 'undefined' && visualizer.highlightKeyboardNote) {
        const { noteName, octave } = midiToNoteNameAndOctave(midiNote);
        visualizer.highlightKeyboardNote(noteName, octave, true);
    }
}

function stopNoteByMidi(midiNote) {
    if (oscillatorMap.has(midiNote)) {
        const oscillator = oscillatorMap.get(midiNote);
        // Optional: Add a small ramp down to avoid clicks
        // const now = audioContext.currentTime;
        // if (oscillator.gain) { // If a gain node was used
        //    oscillator.gain.setValueAtTime(oscillator.gain.value, now);
        //    oscillator.gain.exponentialRampToValueAtTime(0.0001, now + 0.05);
        //    oscillator.stop(now + 0.05);
        // } else {
        oscillator.stop(audioContext.currentTime); // Immediate stop
        // }
        oscillator.disconnect();
        oscillatorMap.delete(midiNote);
        // console.log(`Stopped MIDI: ${midiNote}`);

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

function playNote(key) {
    resumeAudioContextIfNeeded();
    const baseMidiNote = keyToMidiNote[key.toLowerCase()]; // Use toLowerCase for robustness against Shift key etc.
    if (baseMidiNote !== undefined) {
        const finalMidiNote = baseMidiNote + currentKeyboardOctaveOffset;
        // Ensure the note is within the standard 88-key piano range (MIDI 21-108)
        // This prevents errors if octave shift goes too far.
        if (finalMidiNote >= 21 && finalMidiNote <= 108) {
            playNoteByMidi(finalMidiNote);
        } else {
            // console.warn(`Keyboard note ${key} (Base MIDI: ${baseMidiNote}) with offset ${currentKeyboardOctaveOffset / 12} octaves results in MIDI ${finalMidiNote}, which is outside the 88-key range (21-108).`);
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

console.log('synth.js loaded and audio context initialized.');

// Example: Call getAudioData periodically for visualization (visualization script would do this)
// setInterval(() => {
//     const data = getAudioData();
//     // console.log('Time Domain:', data.timeDomainData);
//     // console.log('Frequency Data:', data.frequencyData);
// }, 100);