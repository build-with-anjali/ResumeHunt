# Quick Installation Guide

## Prerequisites
- Google Chrome browser
- LinkedIn account (for testing)

## Installation Steps

### 1. Prepare the Extension
1. Download or clone all files to a folder on your computer
2. Make sure you have these files:
   - `manifest.json`
   - `content.js`
   - `background.js`
   - `popup.html`
   - `popup.js`
   - `styles.css`
   - `icons/` folder (with placeholder files)

### 2. Install Icons (Optional)
Replace the placeholder files in the `icons/` folder with actual PNG images:
- `icon16.png` (16x16 pixels)
- `icon48.png` (48x48 pixels)
- `icon128.png` (128x128 pixels)

### 3. Load Extension in Chrome
1. Open Chrome and navigate to `chrome://extensions/`
2. Enable "Developer mode" (toggle switch in top right)
3. Click "Load unpacked" button
4. Select the folder containing your extension files
5. The extension should now appear in your extensions list

### 4. Pin the Extension
1. Click the extensions icon (🧩) in Chrome toolbar
2. Find "LinkedIn Resume Detector" in the list
3. Click the pin icon to pin it to your toolbar

### 5. Test the Extension
1. Go to [LinkedIn](https://www.linkedin.com)
2. Search for people (e.g., "software developer")
3. Click on the People tab in search results
4. Watch as the extension adds indicators to profiles
5. Click the extension icon to access settings

## Troubleshooting
- **Extension not loading**: Check that all files are in the same folder
- **No indicators appearing**: Make sure you're on LinkedIn search results page
- **Console errors**: Open Developer Tools (F12) to check for errors
- **Rate limiting**: Increase delay in extension settings if getting blocked

## Development Mode
For development, you can make changes to files and click the refresh button (🔄) on the extension card in `chrome://extensions/` to reload the extension.

## Support
- Check the console for error messages
- Review the README.md for detailed usage instructions
- Ensure LinkedIn's page structure hasn't changed significantly 