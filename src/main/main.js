const { app, BrowserWindow, ipcMain, shell } = require('electron');
const path = require('path');
const fs = require('fs/promises');

let mainWindow;
let ticketsPath;
let archivePath;

async function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1200,
        height: 800,
        titleBarStyle: 'hiddenInset',
        webPreferences: {
            nodeIntegration: true,
            contextIsolation: false
        },
        minHeight: 600,
        minWidth: 800
    });

    // Load the local file directly
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));
    
    // Open DevTools if in development mode
    if (process.argv.includes('--dev')) {
        mainWindow.webContents.openDevTools();
    }
}

async function createAppDirectories() {
    const userDataPath = app.getPath('userData');
    ticketsPath = path.join(userDataPath, 'tickets');
    archivePath = path.join(userDataPath, 'archive.json');
    
    try {
        await fs.mkdir(ticketsPath, { recursive: true });
        // Initialize archive.json if it doesn't exist
        try {
            await fs.access(archivePath);
        } catch {
            await fs.writeFile(archivePath, JSON.stringify({ tickets: [] }, null, 2));
        }
        return ticketsPath;
    } catch (error) {
        console.error('Error creating app directories:', error);
        throw error;
    }
}

// Add this validation function
function sanitizeTicketName(name) {
    // Remove any path traversal attempts and dangerous characters
    const sanitized = name
        .replace(/\.\./g, '') // Remove path traversal
        .replace(/[<>:"/\\|?*]/g, '') // Remove illegal file system characters
        .replace(/[^\x20-\x7E]/g, '') // Only allow printable ASCII
        .trim();
    
    // Ensure we have a valid name
    if (!sanitized) {
        return 'Untitled Ticket';
    }
    return sanitized;
}

// Add these IPC handlers
ipcMain.handle('open-master-folder', async () => {
    try {
        await shell.openPath(ticketsPath);
    } catch (error) {
        console.error('Error opening master folder:', error);
        throw error;
    }
});

ipcMain.handle('create-ticket-folder', async (event, { ticketName, ticketData, ticketId }) => {
    try {
        const sanitizedName = sanitizeTicketName(ticketName);
        const folderName = `${sanitizedName}-${ticketId}`;
        const ticketDir = path.join(ticketsPath, folderName);
        
        await fs.mkdir(ticketDir, { recursive: true });
        
        // Save ticket data to a JSON file
        const dataPath = path.join(ticketDir, 'ticket.json');
        await fs.writeFile(dataPath, JSON.stringify({
            ...ticketData,
            title: sanitizedName
        }, null, 2));
        
        return { ticketDir, sanitizedName };
    } catch (error) {
        console.error('Error creating ticket folder:', error);
        throw error;
    }
});

ipcMain.handle('open-ticket-folder', async (event, { ticketName, ticketId }) => {
    try {
        const sanitizedName = sanitizeTicketName(ticketName);
        const folderName = `${sanitizedName}-${ticketId}`;
        const ticketDir = path.join(ticketsPath, folderName);
        
        try {
            await fs.access(ticketDir);
            await shell.openPath(ticketDir);
            return true;
        } catch {
            console.error('Ticket directory does not exist');
            return false;
        }
    } catch (error) {
        console.error('Error opening ticket folder:', error);
        throw error;
    }
});

ipcMain.handle('get-folder-structure', async (event, { ticketName, ticketId }) => {
    try {
        const sanitizedName = sanitizeTicketName(ticketName);
        const folderName = `${sanitizedName}-${ticketId}`;
        const ticketDir = path.join(ticketsPath, folderName);
        
        try {
            await fs.access(ticketDir);
            return await getFolderStructure(ticketDir);
        } catch {
            return null;
        }
    } catch (error) {
        console.error('Error getting folder structure:', error);
        return null;
    }
});

ipcMain.handle('load-tickets', async () => {
    try {
        const entries = await fs.readdir(ticketsPath, { withFileTypes: true });
        const tickets = [];
        
        for (const entry of entries) {
            if (entry.isDirectory()) {
                const ticketJsonPath = path.join(ticketsPath, entry.name, 'ticket.json');
                try {
                    const data = await fs.readFile(ticketJsonPath, 'utf-8');
                    tickets.push(JSON.parse(data));
                } catch (error) {
                    console.error(`Error reading ticket data for ${entry.name}:`, error);
                }
            }
        }
        
        return tickets;
    } catch (error) {
        console.error('Error loading tickets:', error);
        return [];
    }
});

// Add this new IPC handler for renaming ticket folders
ipcMain.handle('rename-ticket-folder', async (event, { oldName, newName, ticketId }) => {
    try {
        const oldSanitizedName = sanitizeTicketName(oldName);
        const newSanitizedName = sanitizeTicketName(newName);
        
        const oldFolderName = `${oldSanitizedName}-${ticketId}`;
        const newFolderName = `${newSanitizedName}-${ticketId}`;
        
        const oldPath = path.join(ticketsPath, oldFolderName);
        const newPath = path.join(ticketsPath, newFolderName);
        
        // Check if old path exists and new path doesn't
        await fs.access(oldPath);
        try {
            await fs.access(newPath);
            // If new path exists and it's different from old path, append a number
            if (oldPath !== newPath) {
                throw new Error('Path exists');
            }
        } catch {
            // New path doesn't exist, safe to rename
            await fs.rename(oldPath, newPath);
            
            // Update the ticket.json with new name
            const dataPath = path.join(newPath, 'ticket.json');
            const ticketData = JSON.parse(await fs.readFile(dataPath, 'utf-8'));
            ticketData.title = newSanitizedName;
            await fs.writeFile(dataPath, JSON.stringify(ticketData, null, 2));
        }
        
        return { success: true, sanitizedName: newSanitizedName };
    } catch (error) {
        console.error('Error renaming ticket folder:', error);
        throw error;
    }
});

// Add new IPC handler for archiving tickets
ipcMain.handle('archive-ticket', async (event, { ticketName, ticketId, ticketData }) => {
    try {
        // Read current archive
        let archive;
        try {
            const archiveContent = await fs.readFile(archivePath, 'utf-8');
            archive = JSON.parse(archiveContent);
        } catch {
            archive = { tickets: [] };
        }

        // Add the ticket to archive
        archive.tickets.push({
            ...ticketData,
            archivedAt: new Date().toISOString()
        });

        // Save updated archive
        await fs.writeFile(archivePath, JSON.stringify(archive, null, 2));

        // Delete the ticket folder
        const folderName = `${ticketName}-${ticketId}`;
        const ticketDir = path.join(ticketsPath, folderName);
        await fs.rm(ticketDir, { recursive: true, force: true });

        return true;
    } catch (error) {
        console.error('Error archiving ticket:', error);
        throw error;
    }
});

async function getFolderStructure(dirPath) {
    try {
        const items = await fs.readdir(dirPath, { withFileTypes: true });
        const structure = [];
        
        for (const item of items) {
            if (item.name === 'ticket.json') continue; // Skip the ticket data file
            
            const itemPath = path.join(dirPath, item.name);
            
            if (item.isDirectory()) {
                structure.push({
                    name: item.name,
                    type: 'directory',
                    children: await getFolderStructure(itemPath)
                });
            } else {
                structure.push({
                    name: item.name,
                    type: 'file'
                });
            }
        }
        
        return structure;
    } catch (error) {
        console.error('Error reading directory:', error);
        return [];
    }
}

app.whenReady().then(async () => {
    await createAppDirectories();
    await createWindow();
});

app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        app.quit();
    }
}); 