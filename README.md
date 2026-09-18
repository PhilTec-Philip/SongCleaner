# SongCleaner

A Chrome extension to clean up your Apple Music library — swipe through your songs like Tinder.

## Features

- **Swipe, tap, press**: sort out, keep and love via gesture, mouse, keyboard or buttons
- Card and list view with search and multi-select
- Sorted-out songs are moved to the **"Sorted out"** playlist — nothing is ever deleted
- Keeping and loving set the Apple Music rating (♥)
- Optional: mark sorted-out songs as "Suggest Less" in Apple Music
- The running session is saved automatically — after a reload you continue exactly where you left off
- Select several playlists at once and sort through them together
- Genre and decade filters adapt automatically to your library
- Playlist blacklist in the popup to exclude certain playlists from the source selection
- Smart filters ("Never played", "Forgotten") plus play-count and time filters
- Preview plays at full length (no truncation)
- German and English (default: English)

## Download / Install

### From a release (recommended for users)

1. Download the latest `SongCleaner-vX.Y.Z.crx` from the [Releases](../../releases) page.
2. Unzip it into a folder of your choice.
3. Open `chrome://extensions` and enable **Developer mode**.
4. Drag and Drop the downloaded `SongCleaner-vX.Y.Z.crx` into Chrome
5. Click on `Add extension`

### From source

1. Download or clone this repository.
2. Open `chrome://extensions` and enable **Developer mode**.
3. Click **Load unpacked** and select this folder.
4. Open `https://music.apple.com` and sign in or stay signed in — done.

Requires a Chromium-based browser (Chrome/Edge/Brave) version 114 or newer...

## Usage

- **Swipe left** = sort out, **swipe right** = keep
- Keyboard: `L` = like, `Z` = undo, `Esc` = close, `←` = sort out, `→` = keep
- Shortcut `Ctrl/Cmd+Shift+S` opens and closes the overlay
- Use **Review** to check your selection, then **Confirm** — only then are songs added to the "Sorted out" playlist

## Settings

- **Auto preview** – plays the song when it is shown
- **"Suggest Less"** – marks sorted-out songs accordingly in Apple Music
- **Language** – English / German
- **Reset** – delete all made decisions

The **playlist blacklist** is managed directly in the popup (expand the "Playlist blacklist" section and tick playlists).

## Data & Privacy

Everything is stored locally in `chrome.storage.local` only.
No data is sent to third parties — the Apple Music API is used exclusively within your own session.

## License

Released under the [MIT License](LICENSE).

**© PhilTec-Philip**
