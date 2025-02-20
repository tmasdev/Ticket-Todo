# Ticket Todo

A modern desktop task manager with Markdown support and due date tracking. 
Made entirely by a Cursor AI agent.

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/tmasdev/ticket-todo)](https://github.com/tmasdev/ticket-todo/releases/latest)

## Credits

- **Development**: Thomas Gale
- **AI Assistance**: Claude-3.5-Sonnet (Anthropic)
- **Development Platform**: Cursor IDE

## Features

- **Rich Text Editing**: Full Markdown support with live preview
- **Due Date Tracking**: Visual indicators for upcoming and overdue tasks
- **Flexible Views**: Switch between list and grid layouts
- **File System Integration**: Each ticket has its own folder for attachments
- **Dark Mode**: Automatic theme switching based on system preferences
- **Keyboard Shortcuts**:
  - `Cmd/Ctrl + B`: Bold text
  - `Cmd/Ctrl + I`: Italic text
  - `Cmd/Ctrl + K`: Insert link
  - `` Cmd/Ctrl + ` ``: Code block
  - `Tab`: Indent

## Installation

Download the latest release (v1.0.1) for your platform from the [releases page](https://github.com/tmasdev/ticket-todo/releases/latest).

### macOS (Apple Silicon)
1. Download `Ticket Todo-1.0.0-arm64.dmg`
2. Open the DMG file
3. Drag the app to your Applications folder
4. When opening for the first time, you may see a warning about the app being damaged
   - Open Terminal and run: `xattr -cr "/Applications/Ticket Todo.app"`
   - Or alternatively: `codesign --force --deep --sign - "/Applications/Ticket Todo.app"`
5. Open the app again, and it should work

### Windows
1. Download `Ticket Todo Setup 1.0.0.exe`
2. Run the installer
3. Follow the installation wizard
4. The app will be available in your Start menu

### Linux
1. Download `Ticket Todo-1.0.0.AppImage`
2. Make it executable:
   ```bash
   chmod +x "Ticket Todo-1.0.0.AppImage"
   ```
3. Run the AppImage:
   ```bash
   ./Ticket\ Todo-1.0.0.AppImage
   ```
4. Optional: Move to your applications folder:
   ```bash
   mv "Ticket Todo-1.0.0.AppImage" ~/.local/bin/
   ```

## Usage

1. **Creating Tickets**
   - Click "New Ticket"
   - Enter title and content
   - Set due date (optional)
   - Use Markdown for formatting

2. **Managing Tickets**
   - Toggle views using top-left icons
   - Click "Open Folder" to access ticket files
   - Mark tickets as done to archive them
   - Due dates are color-coded:
     - Default: > 2 weeks
     - Orange: < 2 weeks
     - Red: < 3 days

3. **Organization**
   - Active tickets: Stored in `~/Library/Application Support/ticket-todo/tickets/` (macOS)
   - Active tickets: Stored in `%APPDATA%/ticket-todo/tickets/` (Windows)
   - Active tickets: Stored in `~/.config/ticket-todo/tickets/` (Linux)
   - Archived tickets are stored in `archive.json` in the same directory

## License

MIT 