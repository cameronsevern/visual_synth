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