# LinkedIn Resume Detector Chrome Extension

A Chrome extension that automatically detects and highlights LinkedIn profiles with attached resumes/CVs on search results pages. Save time by quickly identifying candidates who have uploaded their resumes without clicking into each profile.

## ⚠️ Important Safety Warning

**Please read [SAFETY.md](SAFETY.md) before using this extension.** This tool makes automated requests to LinkedIn, which carries risks including potential account restrictions. Use conservatively and responsibly.

## Features

- 🔍 **Automatic Detection**: Scans LinkedIn search results for profiles with resumes
- 📄 **Visual Indicators**: Green badges for profiles with resumes, grey for those without
- ⚡ **Real-time Updates**: Checks profiles as you scroll and browse
- 🎛️ **Customizable Settings**: Adjust check delays and concurrent limits
- 💾 **Smart Caching**: Remembers previously checked profiles
- 🔄 **Manual Refresh**: Force re-check profiles when needed
- 📊 **Statistics**: Track how many profiles checked and resumes found

## Installation

### From Source (Recommended)

1. **Download the extension files**:
   - Clone or download this repository
   - Ensure you have all files: `manifest.json`, `content.js`, `background.js`, `popup.html`, `popup.js`, `styles.css`

2. **Load the extension in Chrome**:
   - Open Chrome and go to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top right)
   - Click "Load unpacked"
   - Select the folder containing the extension files
   - The extension should now appear in your extensions list

3. **Pin the extension**:
   - Click the extensions icon (puzzle piece) in Chrome toolbar
   - Find "LinkedIn Resume Detector" and click the pin icon
   - The extension icon will now appear in your toolbar

## How to Use

1. **Navigate to LinkedIn**: Go to [linkedin.com](https://linkedin.com)

2. **Search for people**: Use the search bar to find people (e.g., "java developer")

3. **View results**: Go to the People tab in search results

4. **Watch for indicators**: The extension will automatically start checking profiles:
   - 📄 **Green badge**: Profile has a resume/CV attached
   - ❌ **Grey badge**: No resume found
   - 🔄 **Orange badge**: Currently checking the profile

5. **Use settings**: Click the extension icon to:
   - Enable/disable the extension
   - Adjust check delays
   - View statistics
   - Clear cache or refresh checks

## Settings

### Extension Controls
- **Enable Extension**: Turn the extension on/off
- **Auto Check**: Automatically check profiles as you browse
- **Check Delay**: Time between profile checks (500-5000ms)
- **Max Concurrent Checks**: Maximum simultaneous profile checks (1-10)

### Actions
- **Refresh Check**: Re-scan all visible profiles
- **Clear Cache**: Clear previously checked profile data

## How It Works

1. **Detection**: The extension detects when you're on LinkedIn search results pages
2. **Profile Scanning**: It identifies all profile cards on the page
3. **Resume Checking**: For each profile, it makes a request to check for resume indicators
4. **Visual Feedback**: Adds colored badges to indicate resume status
5. **Caching**: Stores results to avoid re-checking the same profiles
6. **Rate Limiting**: Includes delays to avoid overwhelming LinkedIn's servers

## Technical Details

### Files Structure
```
linkedin-resume-detector/
├── manifest.json          # Extension configuration
├── content.js             # Main logic for scanning profiles
├── background.js          # Background service worker
├── popup.html             # Settings interface
├── popup.js               # Popup functionality
├── styles.css             # Styling for indicators
└── README.md             # This file
```

### Key Technologies
- **Chrome Extension Manifest V3**: Latest extension standard
- **Content Scripts**: Run on LinkedIn pages
- **Background Scripts**: Handle extension lifecycle
- **Chrome Storage API**: Save settings and cache
- **Mutation Observers**: Watch for page changes

## Privacy & Security

- **No Data Collection**: The extension doesn't collect or store personal data
- **Local Processing**: All resume detection happens locally
- **No External Servers**: No data is sent to external services
- **LinkedIn Terms**: Respects LinkedIn's rate limiting and terms of service

## ⚠️ Risks and Safety

### Potential Account Risks
- **Rate Limiting**: LinkedIn may temporarily restrict your account
- **Account Suspension**: For repeated violations of LinkedIn's terms
- **Detection**: LinkedIn actively monitors for automated activity

### Conservative Usage Recommendations
- **Use 2000ms+ delays** between profile checks
- **Limit to 1-2 concurrent checks**
- **Disable auto-check** for manual control
- **Take regular breaks** (1-2 hours between sessions)
- **Use for short periods** (10-15 minutes maximum)

### Default Settings (Conservative)
- **Auto Check**: Disabled by default
- **Delay**: 2000ms minimum
- **Concurrent Checks**: 1 profile at a time
- **Manual Control**: Recommended over automatic scanning

**Read [SAFETY.md](SAFETY.md) for detailed safety guidelines.**

## Troubleshooting

### Extension Not Working
1. Ensure you're on a LinkedIn people search results page
2. Check that the extension is enabled in Chrome settings
3. Try refreshing the page
4. Check the console for any error messages

### Slow Performance
1. Increase the check delay in settings
2. Reduce max concurrent checks
3. Clear the cache and restart

### Inaccurate Results
1. Resume detection is based on available public information
2. Some profiles may have private resumes not detected
3. False positives may occur with document-like content

## Development

### Setup for Development
1. Make changes to the source files
2. Go to `chrome://extensions/`
3. Click the refresh icon on the extension card
4. Test your changes

### Contributing
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## Limitations

- **LinkedIn Changes**: May break if LinkedIn updates their UI
- **Rate Limits**: LinkedIn may temporarily block excessive requests
- **Private Profiles**: Cannot check private or restricted profiles
- **Resume Privacy**: Some users may have private resume settings

## License

This project is open source and available under the [MIT License](LICENSE).

## Support

If you encounter issues:
1. Check the troubleshooting section
2. Look for error messages in Chrome DevTools console
3. Try disabling and re-enabling the extension
4. Clear browser cache and cookies for LinkedIn

## Version History

- **v1.0**: Initial release with basic resume detection
- Features: Profile scanning, visual indicators, settings panel, caching

---

**Note**: This extension is not affiliated with LinkedIn. Use responsibly and in accordance with LinkedIn's terms of service.
