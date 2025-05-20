# Visual Synth

A browser-based synthesizer with real-time audio visualization. It uses the Web Audio API to generate sound, display waveforms and spectra, and lets you play notes with the keyboard or on-screen piano.

Try it live: <https://cameronsevern.github.io/visual_synth/>

## Features

- Oscillators, filters and ADSR envelopes using the Web Audio API.
- Waveform and frequency spectrum visualizations on canvas.
- On-screen piano roll plus computer keyboard control.
- Octave switching, low‑/high‑pass filters, and attack/decay/sustain/release sliders.

## Getting Started

1. Clone this repository.
2. Start a simple HTTP server in the project directory:

   ```bash
   python3 -m http.server
   ```

3. Open `http://localhost:8000/index.html` in a modern browser.

You can also open `index.html` directly, but serving via HTTP avoids certain browser restrictions.

## Repository Layout

- `index.html` – markup for the visualizer, controls and piano.
- `style.css` – styling and responsive layout.
- `synth.js` – sets up audio nodes, keyboard mappings, ADSR and filter logic.
- `visualizer.js` – renders waveform and spectrum data, handles piano interaction.
- `LICENSE` – MIT License.

## Next Steps

If you want to extend the project, consider exploring the Web Audio API further. Adding new waveforms, effects, or MIDI input support are good starting points. Enhancing the visualizations or documenting setup in more detail would also help new contributors.

## License

This project is released under the MIT License. See `LICENSE` for details.
