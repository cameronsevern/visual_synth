const audioContext = new (window.AudioContext || window.webkitAudioContext)();
const analyser = audioContext.createAnalyser();
analyser.fftSize = 2048; // Standard FFT size for detailed frequency analysis

const oscillatorMap = new Map();
let waveformType = 'sine'; // Default waveform

// Connect analyser to destination to ensure it processes audio
analyser.connect(audioContext.destination);

// Key to frequency mapping (A4 = 440 Hz)
// Using a simple equal temperament scale for C4-B5 range
const keyToFrequency = {
    // Bottom row
    'A': 261.63, // C4
    'S': 293.66, // D4
    'D': 329.63, // E4
    'F': 349.23, // F4
    'G': 392.00, // G4
    'H': 440.00, // A4
    'J': 493.88, // B4
    'K': 523.25, // C5
    'L': 587.33, // D5
    ';': 659.25, // E5
    // Top row
    'Q': 523.25, // C5 (Higher octave for QWERTY row)
    'W': 554.37, // C#5/Db5 (approximation)
    'E': 587.33, // D5
    'R': 622.25, // D#5/Eb5 (approximation)
    'T': 659.25, // E5
    'Y': 698.46, // F5
    'U': 739.99, // F#5/Gb5 (approximation)
    'I': 783.99, // G5
    'O': 830.61, // G#5/Ab5 (approximation)
    'P': 880.00  // A5
};

function playNote(key) {
    if (!keyToFrequency[key] || oscillatorMap.has(key)) {
        return; // Key not mapped or already playing
    }

    const oscillator = audioContext.createOscillator();
    oscillator.type = waveformType;
    oscillator.frequency.setValueAtTime(keyToFrequency[key], audioContext.currentTime);

    // Connect oscillator to analyser, then analyser is already connected to destination
    oscillator.connect(analyser);

    oscillator.start();
    oscillatorMap.set(key, oscillator);
}

function stopNote(key) {
    if (oscillatorMap.has(key)) {
        const oscillator = oscillatorMap.get(key);
        oscillator.stop(audioContext.currentTime);
        oscillator.disconnect(); // Disconnect from analyser
        oscillatorMap.delete(key);
    }
}

// Event listeners for keyboard
document.addEventListener('keydown', (event) => {
    // Prevent repeated notes if key is held down
    if (event.repeat) return;
    const key = event.key.toUpperCase();
    playNote(key);
});

document.addEventListener('keyup', (event) => {
    const key = event.key.toUpperCase();
    stopNote(key);
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