// visualizer.js

// Assume getAudioData() is defined in synth.js and returns an object:
// { timeDomainData: Uint8Array, frequencyData: Uint8Array, bufferLength: number, sampleRate: number }

document.addEventListener('DOMContentLoaded', () => {
    const waveformCanvas = document.getElementById('waveformCanvas');
    const frequencyCanvas = document.getElementById('frequencyCanvas');

    if (!waveformCanvas || !frequencyCanvas) {
        console.error('Canvas elements not found!');
        return;
    }

    const waveformCtx = waveformCanvas.getContext('2d');
    const frequencyCtx = frequencyCanvas.getContext('2d');

    const drawWaveform = (dataArray, bufferLength) => {
        waveformCtx.fillStyle = 'rgb(20, 20, 20)';
        waveformCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);

        waveformCtx.lineWidth = 2;
        waveformCtx.strokeStyle = 'rgb(50, 200, 50)';
        waveformCtx.beginPath();

        const sliceWidth = waveformCanvas.width * 1.0 / bufferLength;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const v = dataArray[i] / 128.0; // dataArray is Uint8Array (0-255)
            const y = v * waveformCanvas.height / 2;

            if (i === 0) {
                waveformCtx.moveTo(x, y);
            } else {
                waveformCtx.lineTo(x, y);
            }
            x += sliceWidth;
        }

        waveformCtx.lineTo(waveformCanvas.width, waveformCanvas.height / 2);
        waveformCtx.stroke();
    };

    const drawFrequencySpectrum = (dataArray, bufferLength) => {
        frequencyCtx.fillStyle = 'rgb(20, 20, 20)';
        frequencyCtx.fillRect(0, 0, frequencyCanvas.width, frequencyCanvas.height);

        const barWidth = (frequencyCanvas.width / bufferLength) * 2.5;
        let x = 0;

        for (let i = 0; i < bufferLength; i++) {
            const barHeight = dataArray[i] * (frequencyCanvas.height / 255); // dataArray is Uint8Array

            frequencyCtx.fillStyle = `rgb(${barHeight + 100}, 50, 50)`;
            frequencyCtx.fillRect(x, frequencyCanvas.height - barHeight, barWidth, barHeight);

            x += barWidth + 1;
        }
    };

    function animationLoop() {
        requestAnimationFrame(animationLoop);

        if (typeof getAudioData === 'function') {
            const audioData = getAudioData();
            if (audioData) {
                // Assuming getAudioData returns { timeDomainData, frequencyData, bufferLength (for timeDomain), frequencyBinCount (for frequencyData) }
                // For simplicity, let's assume bufferLength is the same for both or can be derived.
                // Typically, analyserNode.fftSize / 2 gives frequencyBinCount.
                // And analyserNode.fftSize gives bufferLength for timeDomainData if using getByteTimeDomainData.

                // For waveform, we usually use analyser.fftSize for bufferLength
                // For frequency, we usually use analyser.frequencyBinCount for bufferLength

                // Let's assume getAudioData provides what's needed.
                // A more robust getAudioData would return:
                // {
                //   timeDomain: { data: Uint8Array, length: number },
                //   frequency: { data: Uint8Array, length: number }
                // }
                // For now, let's assume a simplified structure based on common Web Audio API patterns.
                // If getAudioData() provides analyserNode.fftSize as bufferLength and analyserNode.frequencyBinCount as freqBufferLength:
                const timeDomainData = audioData.timeDomainData;
                const timeDomainBufferLength = audioData.timeDomainBufferLength; // Use the new property

                const frequencyData = audioData.frequencyData;
                const frequencyBufferLength = audioData.frequencyBufferLength; // Use the new property


                if (timeDomainData && timeDomainBufferLength) {
                    drawWaveform(timeDomainData, timeDomainBufferLength);
                }
                if (frequencyData && frequencyBufferLength) {
                    drawFrequencySpectrum(frequencyData, frequencyBufferLength);
                }
            }
        } else {
            // Fallback or placeholder if getAudioData is not ready
            waveformCtx.fillStyle = 'rgb(30, 30, 30)';
            waveformCtx.fillRect(0, 0, waveformCanvas.width, waveformCanvas.height);
            waveformCtx.fillStyle = 'white';
            waveformCtx.textAlign = 'center';
            waveformCtx.fillText('Waveform: Waiting for audio data...', waveformCanvas.width / 2, waveformCanvas.height / 2);

            frequencyCtx.fillStyle = 'rgb(30, 30, 30)';
            frequencyCtx.fillRect(0, 0, frequencyCanvas.width, frequencyCanvas.height);
            frequencyCtx.fillStyle = 'white';
            frequencyCtx.textAlign = 'center';
            frequencyCtx.fillText('Frequency: Waiting for audio data...', frequencyCanvas.width / 2, frequencyCanvas.height / 2);
        }
    }

    // Ensure canvas sizes are set (can also be done in CSS)
    waveformCanvas.width = waveformCanvas.offsetWidth;
    waveformCanvas.height = waveformCanvas.offsetHeight;
    frequencyCanvas.width = frequencyCanvas.offsetWidth;
    frequencyCanvas.height = frequencyCanvas.offsetHeight;

    animationLoop();
});
// Piano Roll and Octave Selector Event Listeners
const pianoRoll = document.getElementById('pianoRoll');
const octaveUpButton = document.getElementById('octaveUp');
const octaveDownButton = document.getElementById('octaveDown');
const currentOctaveDisplay = document.getElementById('currentOctave');

// Helper function to map note name and octave to MIDI note number
// C4 is MIDI note 60
const noteToMidi = {
    'C': 0, 'C#': 1, 'Db': 1, 'D': 2, 'D#': 3, 'Eb': 3, 'E': 4, 'F': 5,
    'F#': 6, 'Gb': 6, 'G': 7, 'G#': 8, 'Ab': 8, 'A': 9, 'A#': 10, 'Bb': 10, 'B': 11
};

function getMidiNote(noteName, octave) {
    // Octave 0 on piano roll usually means MIDI octave 0 (e.g. C0, D0)
    // MIDI note for C0 is 12, C1 is 24, C2 is 36, C3 is 48, C4 is 60 etc.
    // So, (octave + 1) * 12 for C.
    // Or, more generally: octave * 12 + noteOffset (where C is 0, C# is 1, etc for that octave)
    // Let's adjust so that octave 4 on the display means the octave of middle C (C4 = 60)
    const baseOctaveOffset = 12; // MIDI C0 is 12.
    const noteOffset = noteToMidi[noteName];
    if (typeof noteOffset === 'undefined') {
        console.error(`Unknown note name: ${noteName}`);
        return null;
    }
    // The octave from the display (0-8) needs to be mapped to MIDI octaves.
    // If display octave 4 is C4 (MIDI 60), then:
    // MIDI = noteOffset + (displayOctave * 12)
    // C4: noteToMidi['C'] (0) + 4 * 12 = 48. This is C3. We need C4 = 60.
    // So, MIDI = noteOffset + (displayOctave + 1) * 12 is a common way if octave 0 is the first octave.
    // Let's try: MIDI = noteOffset + ((octave) * 12) + 12; (C0 = 12, C1 = 24, ...)
    // If currentOctaveDisplay shows '4', we want C4, D4 etc.
    // C4 = 0 + (4 * 12) = 48. Still C3.
    // Let's use the standard: MIDI note = (octave + 1) * 12 + noteValue
    // If display '4' means octave 4 (C4, D4, etc.)
    // C4 (MIDI 60): noteToMidi['C'] (0) + (4 + 1) * 12 = 60. This works for C.
    // A4 (MIDI 69): noteToMidi['A'] (9) + (4 + 1) * 12 = 69. This works for A.
    // Let's use: (octave_from_display + 1) * 12 + note_offset_from_C
    // However, a simpler approach for C4=60:
    // MIDI = noteOffset + (octave * 12)
    // C0 = 0 + 0*12 = 0
    // C4 = 0 + 4*12 = 48 (This is actually C3 in some systems, C4 in others like Yamaha)
    // Standard MIDI: C4 = 60.
    // If octave is 0-8, and 4 is middle C's octave:
    // MIDI = noteValue + (octave * 12)
    // C, octave 4 => 0 + 4*12 = 48. (This is C3 if C0=0)
    // To make C4 = 60: MIDI = noteValue + (octave + X) * 12.
    // If octave = 4, we want 60 for C. 0 + (4+X)*12 = 60 => (4+X)*12 = 60 => 4+X = 5 => X = 1.
    // So, MIDI = noteValue + (octave + 1) * 12.
    // Let's test:
    // C, octave 4 => 0 + (4+1)*12 = 60 (Correct for C4)
    // A, octave 4 => 9 + (4+1)*12 = 69 (Correct for A4)
    // C, octave 0 => 0 + (0+1)*12 = 12 (Correct for C0)
    // C, octave 8 => 0 + (8+1)*12 = 108 (Correct for C8)
    return noteOffset + (parseInt(octave) + 1) * 12;
}

// New function to highlight/unhighlight a specific key based on note name and octave
// This will be called by synth.js
function highlightKeyboardNote(noteName, octave, isNoteOn) {
    if (!pianoRoll) return;

    const keySelector = `.key[data-note="${noteName}"][data-octave="${octave}"]`;
    const pianoKeyElement = pianoRoll.querySelector(keySelector);

    if (pianoKeyElement) {
        if (isNoteOn) {
            pianoKeyElement.classList.add('active');
        } else {
            pianoKeyElement.classList.remove('active');
        }
    } else {
        // console.warn(`Piano key element not found for note: ${noteName}, octave: ${octave}`);
    }
}
// Expose the function to be callable from synth.js
// Forward declaration for functions that might be called by synth.js or used internally
let updatePlayableKeyCue = () => {}; // Renamed placeholder

window.visualizer = {
    highlightKeyboardNote: highlightKeyboardNote,
    updateMappedRangeHighlight: () => updatePlayableKeyCue() // Exposed as updateMappedRangeHighlight
};

// Function to update the visual cue for the computer keyboard's active playable range
updatePlayableKeyCue = () => {
    // Accessing global functions from synth.js directly
    if (!pianoRoll || typeof getCurrentlyMappedMidiRange !== 'function' || typeof midiToNoteNameAndOctave !== 'function') {
        // console.warn('Cannot update playable key cue: missing synth functions (getCurrentlyMappedMidiRange, midiToNoteNameAndOctave) or pianoRoll.');
        return;
    }

    // Remove existing cues
    const allPianoKeys = pianoRoll.querySelectorAll('.key');
    allPianoKeys.forEach(key => key.classList.remove('playable-key-cue'));

    const mappedRange = getCurrentlyMappedMidiRange(); // Get {min, max} MIDI notes

    if (!mappedRange || typeof mappedRange.min === 'undefined' || typeof mappedRange.max === 'undefined') {
        // console.warn('Playable range data from getCurrentlyMappedMidiRange is invalid.');
        return;
    }

    for (let midiNote = mappedRange.min; midiNote <= mappedRange.max; midiNote++) {
        // getCurrentlyMappedMidiRange already ensures notes are within the 61-key display range (MIDI 36-96)
        // if they are part of the QWERTY mapping.
        const { noteName, octave } = midiToNoteNameAndOctave(midiNote); // Direct access
        const keyElement = pianoRoll.querySelector(`.key[data-note="${noteName}"][data-octave="${octave}"]`);
        if (keyElement) {
            keyElement.classList.add('playable-key-cue');
        } else {
            // console.warn(`Key element not found for playable cue: ${noteName}${octave} (MIDI: ${midiNote})`);
        }
    }
};


if (pianoRoll) {
    const handleNoteOn = (target) => {
        if (!target.classList.contains('key')) return;
        // Ensure synth functions are available
        if (typeof playNoteByMidi !== 'function') {
            console.error('playNoteByMidi is not defined. Is synth.js loaded and functions exposed?');
            return;
        }

        const noteName = target.dataset.note;
        let keyOctave;
        if (target.dataset.octave !== undefined) {
            keyOctave = parseInt(target.dataset.octave);
        } else {
            // Fallback for keys without data-octave: use the global currentOctave.
            // console.warn(`Key ${noteName} in handleNoteOn (mouse/touch) lacks data-octave. Using global currentOctave: ${currentOctaveDisplay.textContent}`);
            keyOctave = parseInt(currentOctaveDisplay.textContent);
        }
        const midiNote = getMidiNote(noteName, keyOctave);

        if (midiNote !== null) {
            playNoteByMidi(midiNote);
            target.classList.add('active'); // Add visual feedback
        }
    };

    const handleNoteOff = (target) => {
        if (!target.classList.contains('key')) return;
         // Ensure synth functions are available
        if (typeof stopNoteByMidi !== 'function') {
            console.error('stopNoteByMidi is not defined.');
            return;
        }
        const noteName = target.dataset.note;
        let keyOctave;
        if (target.dataset.octave !== undefined) {
            keyOctave = parseInt(target.dataset.octave);
        } else {
            // Fallback for keys without data-octave: use the global currentOctave.
            // console.warn(`Key ${noteName} in handleNoteOff (mouse/touch) lacks data-octave. Using global currentOctave: ${currentOctaveDisplay.textContent}`);
            keyOctave = parseInt(currentOctaveDisplay.textContent);
        }
        const midiNote = getMidiNote(noteName, keyOctave);

        if (midiNote !== null) {
            stopNoteByMidi(midiNote);
            target.classList.remove('active'); // Remove visual feedback
        }
    };

    // Mouse events
    pianoRoll.addEventListener('mousedown', (event) => {
        if (event.target.classList.contains('key')) {
            handleNoteOn(event.target);
        }
    });

    pianoRoll.addEventListener('mouseup', (event) => {
        if (event.target.classList.contains('key')) {
            handleNoteOff(event.target);
        }
    });

    pianoRoll.addEventListener('mouseleave', (event) => {
        // If mouse leaves while a key is pressed (e.g. mouse down then drag out)
        if (event.target.classList.contains('key') && event.target.classList.contains('active')) {
            handleNoteOff(event.target);
        }
    });

    // Touch events
    pianoRoll.addEventListener('touchstart', (event) => {
        if (event.target.classList.contains('key')) {
            event.preventDefault(); // Prevent mouse event emulation and scrolling
            handleNoteOn(event.target);
        }
    }, { passive: false });

    pianoRoll.addEventListener('touchend', (event) => {
        if (event.target.classList.contains('key')) {
            event.preventDefault();
            handleNoteOff(event.target);
        }
    });

    pianoRoll.addEventListener('touchcancel', (event) => {
        if (event.target.classList.contains('key')) {
            event.preventDefault();
            handleNoteOff(event.target);
        }
    });

} else {
    console.error('Piano roll element not found!');
}

if (octaveUpButton && currentOctaveDisplay && typeof setKeyboardOctaveOffset === 'function' && typeof currentKeyboardOctaveOffset !== 'undefined') {
    octaveUpButton.addEventListener('click', () => {
        // currentKeyboardOctaveOffset is in semitones. We want to shift by a full octave (+12 semitones).
        // The display shows octave shift in terms of octaves (-2, -1, 0, 1, 2 etc.)
        let currentOffsetInOctaves = currentKeyboardOctaveOffset / 12; // Direct access
        let newOffsetInOctaves = Math.min(2, currentOffsetInOctaves + 1); // Cap at +2 octaves for example

        setKeyboardOctaveOffset(newOffsetInOctaves); // Direct access
        currentOctaveDisplay.textContent = newOffsetInOctaves >= 0 ? `+${newOffsetInOctaves}` : `${newOffsetInOctaves}`;
        updatePlayableKeyCue(); // Call renamed function
        // console.log('Octave Up. New keyboard offset (octaves):', newOffsetInOctaves);
    });
} else {
    console.error('Octave Up button, display, setKeyboardOctaveOffset, or currentKeyboardOctaveOffset not found!');
}

if (octaveDownButton && currentOctaveDisplay && typeof setKeyboardOctaveOffset === 'function' && typeof currentKeyboardOctaveOffset !== 'undefined') {
    octaveDownButton.addEventListener('click', () => {
        let currentOffsetInOctaves = currentKeyboardOctaveOffset / 12; // Direct access
        let newOffsetInOctaves = Math.max(-2, currentOffsetInOctaves - 1); // Cap at -2 octaves for example

        setKeyboardOctaveOffset(newOffsetInOctaves); // Direct access
        currentOctaveDisplay.textContent = newOffsetInOctaves >= 0 ? `+${newOffsetInOctaves}` : `${newOffsetInOctaves}`;
        updatePlayableKeyCue(); // Call renamed function
        // console.log('Octave Down. New keyboard offset (octaves):', newOffsetInOctaves);
    });
} else {
    console.error('Octave Down button, display, setKeyboardOctaveOffset, or currentKeyboardOctaveOffset not found!');
}

// Initialize octave display and range box on load
document.addEventListener('DOMContentLoaded', () => {
    if (currentOctaveDisplay && typeof currentKeyboardOctaveOffset !== 'undefined') { // Direct access
        const initialOffsetInOctaves = currentKeyboardOctaveOffset / 12; // Direct access
        currentOctaveDisplay.textContent = initialOffsetInOctaves >= 0 ? `+${initialOffsetInOctaves}` : `${initialOffsetInOctaves}`;
    }
    // Ensure synth.js might be loaded and its globals available
    if (typeof updatePlayableKeyCue === 'function') {
        updatePlayableKeyCue(); // Initial call of renamed function
    }
});


// Keyboard controls
const activeKeys = new Set(); // To track currently pressed keys and prevent re-triggering

const keyToNoteMapping = {
    // White keys (A-row)
    'KeyA': 'C',
    'KeyS': 'D',
    'KeyD': 'E',
    'KeyF': 'F',
    'KeyG': 'G',
    'KeyH': 'A',
    'KeyJ': 'B',
    // Black keys (Q-row)
    'KeyW': 'C#',
    'KeyE': 'D#',
    'KeyT': 'F#',
    'KeyY': 'G#',
    'KeyU': 'A#',
};

function getPianoKeyElement(noteName, octaveOfNoteToHighlight) {
    // Find the on-screen piano key element to provide visual feedback.
    // Assumes piano key elements in a multi-octave display will have:
    // <div class="key" data-note="C" data-octave="3"></div>
    // The 'octaveOfNoteToHighlight' comes from currentOctaveDisplay for keyboard input.
    if (pianoRoll) {
        const keyElement = pianoRoll.querySelector(`.key[data-note="${noteName}"][data-octave="${octaveOfNoteToHighlight}"]`);
        if (keyElement) {
            return keyElement;
        }
        // Fallback: If no octave-specific key is found (e.g., for a single-octave display without data-octave attributes,
        // or if the specific octave played via keyboard isn't part of the currently displayed set of keys),
        // try to find a generic key matching the note name. This provides some feedback on simpler setups.
        const genericKey = pianoRoll.querySelector(`.key[data-note="${noteName}"]`);
        if (genericKey) {
            // console.warn(`Piano key for ${noteName} octave ${octaveOfNoteToHighlight} not found. Falling back to generic ${noteName} key.`);
            return genericKey;
        }
    }
    return null;
}


window.addEventListener('keydown', (event) => {
    if (event.repeat) return; // Ignore key repeats

    // The 'keyToNoteMapping' and note playing logic for computer keyboard
    // is now primarily handled in synth.js.
    // visualizer.js's keydown listener here is mainly for octave shortcuts.

    // const noteName = keyToNoteMapping[event.code]; // This mapping is local and outdated
    // const currentOctave = parseInt(currentOctaveDisplay.textContent); // This refers to the keyboard octave shift

    // if (noteName) { // Note playing is handled by synth.js's own listeners
    //     // ...
    // } else {
        // Octave controls via 'Z' and 'X'
        if (event.code === 'KeyZ') { // Octave Down
            if (octaveDownButton) {
                octaveDownButton.click(); // Simulate click
            }
        } else if (event.code === 'KeyX') { // Octave Up
            if (octaveUpButton) {
                octaveUpButton.click(); // Simulate click
            }
        }
    // }
});

window.addEventListener('keyup', (event) => {
    // Note stopping for computer keyboard is handled by synth.js's own listeners.
    // This keyup listener in visualizer.js doesn't need to do anything for notes.
    // const noteName = keyToNoteMapping[event.code];
    // const currentOctave = parseInt(currentOctaveDisplay.textContent);
    // if (noteName) {
    //     // ...
    // }
});