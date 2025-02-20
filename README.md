# Ticket Todo

A modern desktop task manager with Markdown support and due date tracking. 
Made entirely by a Cursor AI agent.

[![GitHub release (latest by date)](https://img.shields.io/github/v/release/tmasdev/Ticket-Todo)](https://github.com/tmasdev/Ticket-Todo/releases/latest)

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

Download the latest release for your platform:
- **macOS (Apple Silicon)**: `Ticket Todo-1.0.0-arm64.dmg`
- **Windows**: `Ticket Todo Setup 1.0.0.exe`
- **Linux**: `Ticket Todo-1.0.0-arm64.AppImage`

[Download Latest Release](https://github.com/tmasdev/Ticket-Todo/releases/latest)

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
   - Active tickets: Stored in `~/Library/Application Support/ticket-todo/tickets/`
   - Archived tickets: Stored in `~/Library/Application Support/ticket-todo/archive.json`

## License

MIT 