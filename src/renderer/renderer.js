const { ipcRenderer } = require('electron');

// State management
let tickets = [];
let currentTicket = null;
let listEditor = null;
let fullscreenEditor = null;
let currentView = 'list';

// Cache DOM elements
const DOM = {
    layouts: {
        list: document.getElementById('list-layout'),
        grid: document.getElementById('grid-layout'),
        fullscreen: document.getElementById('fullscreen-ticket')
    },
    containers: {
        ticketList: document.getElementById('ticket-list'),
        ticketGrid: document.getElementById('ticket-grid'),
        ticketDetail: document.getElementById('ticket-detail-list')
    },
    emptyStates: {
        list: document.getElementById('empty-state-list'),
        grid: document.getElementById('empty-state-grid')
    },
    viewButtons: {
        list: document.getElementById('list-view-btn'),
        grid: document.getElementById('grid-view-btn'),
        listGrid: document.getElementById('list-view-btn-grid'),
        gridGrid: document.getElementById('grid-view-btn-grid')
    },
    inputs: {
        titleList: document.getElementById('ticket-title-list'),
        titleFull: document.getElementById('ticket-title-full')
    },
    editors: {
        list: document.getElementById('editor-list'),
        full: document.getElementById('editor-full')
    },
    buttons: {
        newTicketList: document.getElementById('new-ticket-btn-list'),
        newTicketGrid: document.getElementById('new-ticket-btn-grid'),
        openFolderList: document.getElementById('open-folder-btn-list'),
        openFolderFull: document.getElementById('open-folder-btn-full'),
        completeTicketList: document.getElementById('complete-ticket-btn-list'),
        completeTicketFull: document.getElementById('complete-ticket-btn-full'),
        closeFullscreen: document.getElementById('close-fullscreen-btn'),
        openMasterFolderList: document.getElementById('open-master-folder-btn-list'),
        openMasterFolderGrid: document.getElementById('open-master-folder-btn-grid')
    }
};

// Event delegation helper
function delegate(element, eventType, selector, handler) {
    element.addEventListener(eventType, event => {
        const target = event.target.closest(selector);
        if (target && element.contains(target)) {
            handler(event, target);
        }
    });
}

// Optimized markdown renderer
class MarkdownRenderer {
    static rules = [
        [/^### (.*$)/gm, '<h3>$1</h3>'],
        [/^## (.*$)/gm, '<h2>$1</h2>'],
        [/^# (.*$)/gm, '<h1>$1</h1>'],
        [/\*\*(.*?)\*\*/g, '<strong>$1</strong>'],
        [/\*(.*?)\*/g, '<em>$1</em>'],
        [/`(.*?)`/g, '<code>$1</code>'],
        [/\[(.*?)\]\((.*?)\)/g, '<a href="$2">$1</a>'],
        [/^[-*+]\s+(.*)/gm, '<li>$1</li>'],
        [/(<li>.*<\/li>)/s, '<ul>$1</ul>']
    ];

    static render(content) {
        let html = content;
        this.rules.forEach(([pattern, replacement]) => {
            html = html.replace(pattern, replacement);
        });

        // Handle paragraphs
        return html.split(/\n\s*\n/)
            .map(p => p.trim())
            .filter(Boolean)
            .map(p => p.startsWith('<') ? p : `<p>${p}</p>`)
            .join('\n');
    }
}

// Optimized SimpleEditor
class SimpleEditor {
    constructor(element, options = {}) {
        this.element = element;
        this.content = '';
        this.options = options;
        this.isEditing = false;
        this.init();
    }

    init() {
        this.element.contentEditable = true;
        this.element.className = 'note-pad-editor';
        Object.assign(this.element.style, {
            outline: 'none',
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word'
        });

        this.setupEventListeners();
    }

    setupEventListeners() {
        this.element.addEventListener('input', () => {
            this.content = this.element.innerText;
            this.options.onUpdate?.(this.content);
        });

        this.element.addEventListener('focus', () => {
            this.isEditing = true;
            this.element.innerHTML = this.content;
        });

        this.element.addEventListener('blur', () => {
            this.isEditing = false;
            this.renderMarkdown();
        });

        this.element.addEventListener('keydown', this.handleKeydown.bind(this));
    }

    handleKeydown(e) {
        if (e.metaKey || e.ctrlKey) {
            switch(e.key) {
                case 'b': this.wrapText('**'); break;
                case 'i': this.wrapText('*'); break;
                case '`': this.wrapText('`'); break;
                default: return;
            }
            e.preventDefault();
        } else if (e.key === 'Tab') {
            e.preventDefault();
            this.insertText('    ');
        }
    }

    renderMarkdown() {
        this.element.innerHTML = MarkdownRenderer.render(this.content);
    }

    setContent(content) {
        this.content = content;
        this.isEditing ? this.element.innerHTML = content : this.renderMarkdown();
    }

    getSelectedText() {
        const selection = window.getSelection();
        return selection.toString();
    }

    insertText(text) {
        document.execCommand('insertText', false, text);
    }

    wrapText(wrapper) {
        const selectedText = this.getSelectedText();
        if (selectedText) {
            const wrappedText = `${wrapper}${selectedText}${wrapper}`;
            document.execCommand('insertText', false, wrappedText);
        } else {
            document.execCommand('insertText', false, `${wrapper}${wrapper}`);
            // Move cursor between the wrappers
            const selection = window.getSelection();
            const range = selection.getRangeAt(0);
            range.setStart(range.startContainer, range.startOffset - wrapper.length);
            selection.removeAllRanges();
            selection.addRange(range);
        }
    }

    getContent() {
        return this.content;
    }

    focus() {
        this.element.focus();
    }

    createLink(url) {
        const selectedText = this.getSelectedText();
        if (selectedText) {
            document.execCommand('insertText', false, `[${selectedText}](${url})`);
        } else {
            document.execCommand('insertText', false, `[](${url})`);
        }
    }
}

// View switching
function switchView(view) {
    currentView = view;
    if (view === 'list') {
        DOM.layouts.list.classList.remove('hidden');
        DOM.layouts.grid.classList.add('hidden');
        DOM.layouts.fullscreen.classList.add('hidden');
        
        // Update both sets of view buttons
        DOM.viewButtons.list?.classList.add('active');
        DOM.viewButtons.grid?.classList.remove('active');
        DOM.viewButtons.listGrid?.classList.add('active');
        DOM.viewButtons.gridGrid?.classList.remove('active');

        // If there's a current ticket, update its content in list view
        if (currentTicket) {
            DOM.inputs.titleList.value = currentTicket.title;
            listEditor.setContent(currentTicket.content);
            
            // Update the due date input
            const ticketHeader = document.querySelector('#ticket-detail-list .ticket-header');
            const existingInput = ticketHeader.querySelector('.due-date-input');
            if (existingInput) {
                existingInput.remove();
            }
            ticketHeader.insertBefore(createDueDateInput(currentTicket), ticketHeader.lastElementChild);
            
            document.getElementById('ticket-detail-list').classList.remove('hidden');
            DOM.emptyStates.list.classList.add('hidden');
        }
    } else {
        DOM.layouts.list.classList.add('hidden');
        DOM.layouts.grid.classList.remove('hidden');
        DOM.layouts.fullscreen.classList.add('hidden');
        
        // Update both sets of view buttons
        DOM.viewButtons.list?.classList.remove('active');
        DOM.viewButtons.grid?.classList.add('active');
        DOM.viewButtons.listGrid?.classList.remove('active');
        DOM.viewButtons.gridGrid?.classList.add('active');
    }
    renderTickets();
}

// Replace TipTap initialization with SimpleEditor
function initializeEditors() {
    // List view editor
    const listEditorElement = document.createElement('div');
    DOM.editors.list.appendChild(listEditorElement);
    
    listEditor = new SimpleEditor(listEditorElement, {
        onUpdate: (content) => {
            if (currentTicket) {
                currentTicket.content = content;
                saveTickets();
                renderTickets();
            }
        }
    });

    // Fullscreen editor
    const fullEditorElement = document.createElement('div');
    DOM.editors.full.appendChild(fullEditorElement);
    
    fullscreenEditor = new SimpleEditor(fullEditorElement, {
        onUpdate: (content) => {
            if (currentTicket) {
                currentTicket.content = content;
                saveTickets();
                renderTickets();
            }
        }
    });

    // Make note pads focusable
    document.querySelectorAll('.note-pad').forEach(pad => {
        pad.addEventListener('click', (e) => {
            if (e.target.classList.contains('note-pad')) {
                const editor = pad.id === 'editor-list' ? listEditor : fullscreenEditor;
                editor.focus();
            }
        });
    });

    // Add keyboard shortcuts for links
    document.addEventListener('keydown', (e) => {
        if (e.metaKey && e.key === 'k') {
            e.preventDefault();
            const editor = currentView === 'list' ? listEditor : fullscreenEditor;
            const url = prompt('Enter URL:');
            if (url) {
                editor.createLink(url);
            }
        }
    });
}

// Replace uuid import with native crypto function
function generateId() {
    // Use crypto.randomUUID() for modern browsers
    // or fallback to a timestamp-based solution
    if (window.crypto && window.crypto.randomUUID) {
        return window.crypto.randomUUID();
    }
    // Fallback implementation
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

// Add due date helper functions
function getDaysUntilDue(dueDate) {
    if (!dueDate) return null;
    const diffTime = new Date(dueDate) - new Date();
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

function getDueDateColor(daysUntilDue) {
    if (daysUntilDue === null) return '';
    return daysUntilDue <= 3 ? 'color: var(--error-color);' :
           daysUntilDue <= 14 ? 'color: var(--warning-color);' : '';
}

function formatDueDate(dueDate, daysUntilDue) {
    if (!dueDate) return '';
    const date = new Date(dueDate).toLocaleDateString();
    if (daysUntilDue === 0) return `Due today (${date})`;
    if (daysUntilDue < 0) return `Overdue by ${-daysUntilDue} days (${date})`;
    return `Due in ${daysUntilDue} days (${date})`;
}

// Update the due date and save immediately
async function updateDueDate(ticket, newDate) {
    ticket.dueDate = newDate ? new Date(newDate).toISOString() : null;
    await saveTickets();
    renderTickets();
}

// Create a due date input element
function createDueDateInput(ticket) {
    const dueDateInput = document.createElement('input');
    dueDateInput.type = 'date';
    dueDateInput.className = 'due-date-input';
    if (ticket.dueDate) {
        dueDateInput.valueAsDate = new Date(ticket.dueDate);
    }
    dueDateInput.addEventListener('input', async (e) => {
        await updateDueDate(ticket, e.target.value);
    });
    return dueDateInput;
}

// Ticket management
async function createTicket(name) {
    const ticket = {
        id: generateId(),
        title: name,
        content: '',
        createdAt: new Date().toISOString(),
        dueDate: null,
        completed: false
    };

    try {
        await ipcRenderer.invoke('create-ticket-folder', { 
            ticketName: ticket.title,
            ticketData: ticket,
            ticketId: ticket.id
        });
        
        tickets.push(ticket);
        renderTickets();
        
        if (currentView === 'list') {
            selectTicket(ticket, 'list');
        } else if (currentView === 'grid') {
            await renderFolderStructure(ticket.title, ticket.id);
        }
    } catch (error) {
        console.error('Error creating ticket:', error);
    }
}

async function selectTicket(ticket, view = currentView) {
    currentTicket = ticket;
    
    if (view === 'list') {
        document.getElementById('ticket-detail-list').classList.remove('hidden');
        DOM.emptyStates.list.classList.add('hidden');
        DOM.inputs.titleList.value = ticket.title;
        listEditor.setContent(ticket.content);
        
        // Add due date input
        const dueDateInput = createDueDateInput(ticket);
        const ticketHeader = document.querySelector('#ticket-detail-list .ticket-header');
        const existingInput = ticketHeader.querySelector('.due-date-input');
        if (existingInput) {
            existingInput.remove();
        }
        ticketHeader.insertBefore(dueDateInput, ticketHeader.lastElementChild);
        
        document.querySelectorAll('.ticket-item').forEach(item => {
            item.classList.toggle('selected', item.dataset.id === ticket.id);
        });
    } else {
        DOM.layouts.fullscreen.classList.remove('hidden');
        DOM.inputs.titleFull.value = ticket.title;
        fullscreenEditor.setContent(ticket.content);
        
        // Add due date input for fullscreen view
        const dueDateInput = createDueDateInput(ticket);
        const ticketHeader = document.querySelector('.fullscreen-header .header-content');
        const existingInput = ticketHeader.querySelector('.due-date-input');
        if (existingInput) {
            existingInput.remove();
        }
        ticketHeader.insertBefore(dueDateInput, ticketHeader.lastElementChild);
    }
}

async function completeTicket(view = currentView) {
    if (!currentTicket) return;

    // Find all elements that need to be animated
    const ticketElements = document.querySelectorAll(`[data-id="${currentTicket.id}"]`);
    const detailElement = view === 'list' 
        ? document.getElementById('ticket-detail-list')
        : DOM.layouts.fullscreen;

    // Store the ticket to be completed
    const ticketToComplete = currentTicket;
    
    // Clear the current ticket immediately to prevent double-completion
    currentTicket = null;

    // Add animation class to all relevant elements
    ticketElements.forEach(el => el.classList.add('ticket-fade-out'));
    if (detailElement) {
        detailElement.classList.add('ticket-fade-out');
    }

    // Wait for animation to complete
    await new Promise(resolve => setTimeout(resolve, 400));

    try {
        // Archive the ticket
        await ipcRenderer.invoke('archive-ticket', {
            ticketName: ticketToComplete.title,
            ticketId: ticketToComplete.id,
            ticketData: ticketToComplete
        });

        // Remove the ticket from the array
        tickets = tickets.filter(t => t.id !== ticketToComplete.id);
        
        // Update UI
        renderTickets();

        // Reset UI elements and clear detail views in both layouts
        document.getElementById('ticket-detail-list').classList.remove('ticket-fade-out');
        document.getElementById('ticket-detail-list').classList.add('hidden');
        DOM.layouts.fullscreen.classList.remove('ticket-fade-out');
        DOM.layouts.fullscreen.classList.add('hidden');

        // Show empty state if needed
        if (tickets.length === 0) {
            DOM.emptyStates.list.classList.remove('hidden');
            DOM.emptyStates.grid.classList.remove('hidden');
        }
    } catch (error) {
        console.error('Error completing ticket:', error);
        // Restore the current ticket if there was an error
        currentTicket = ticketToComplete;
        // Remove the animation class
        ticketElements.forEach(el => el.classList.remove('ticket-fade-out'));
        if (detailElement) {
            detailElement.classList.remove('ticket-fade-out');
        }
    }
}

function getContentPreview(content) {
    const div = document.createElement('div');
    div.innerHTML = content;
    return div.textContent || div.innerText || '';
}

function createTicketItemElement(ticket, type = 'list') {
    const element = document.createElement('div');
    element.className = type === 'list' ? 'ticket-item' : 'grid-ticket';
    if (currentTicket && currentTicket.id === ticket.id) {
        element.classList.add('selected');
    }
    element.dataset.id = ticket.id;
    
    const daysUntilDue = getDaysUntilDue(ticket.dueDate);
    const dueDateColor = getDueDateColor(daysUntilDue);
    const dueDateText = daysUntilDue !== null ? `${daysUntilDue} days` : '';
    
    element.innerHTML = `
        <h3>${ticket.title}</h3>
        <div class="date">Set: ${new Date(ticket.createdAt).toLocaleDateString()}</div>
        ${dueDateText ? `<div class="due-date" style="${dueDateColor}">${dueDateText}</div>` : ''}
        <div class="preview">${getContentPreview(ticket.content)}</div>
        <div class="ticket-actions">
            <button class="btn btn-done" title="Mark As Done">Done</button>
        </div>
    `;
    
    // Add click handlers
    const completeBtn = element.querySelector('.btn-done');
    completeBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        currentTicket = ticket;
        completeTicket(type);
    });
    
    element.addEventListener('click', (e) => {
        if (!e.target.classList.contains('btn')) {
            document.querySelectorAll(`.${type === 'list' ? 'ticket-item' : 'grid-ticket'}`).forEach(item => {
                item.classList.remove('selected');
            });
            element.classList.add('selected');
            selectTicket(ticket, type);
        }
    });
    
    return element;
}

function renderTickets() {
    // Render list view
    DOM.containers.ticketList.innerHTML = '';
    tickets.forEach(ticket => {
        DOM.containers.ticketList.appendChild(createTicketItemElement(ticket, 'list'));
    });

    // Render grid view
    DOM.containers.ticketGrid.innerHTML = '';
    tickets.forEach(ticket => {
        DOM.containers.ticketGrid.appendChild(createTicketItemElement(ticket, 'grid'));
    });

    // Update empty states
    if (tickets.length === 0) {
        DOM.emptyStates.grid.classList.remove('hidden');
        DOM.emptyStates.list.classList.remove('hidden');
    } else {
        DOM.emptyStates.grid.classList.add('hidden');
        DOM.emptyStates.list.classList.add('hidden');
    }
}

// Storage functions
async function saveTickets() {
    if (currentTicket) {
        try {
            await ipcRenderer.invoke('create-ticket-folder', {
                ticketName: currentTicket.title,
                ticketData: currentTicket,
                ticketId: currentTicket.id
            });
        } catch (error) {
            console.error('Error saving ticket:', error);
        }
    }
}

async function loadTickets() {
    try {
        const loadedTickets = await ipcRenderer.invoke('load-tickets');
        tickets = loadedTickets.filter((ticket, index, self) =>
            index === self.findIndex((t) => t.id === ticket.id)
        );
        renderTickets();
    } catch (error) {
        console.error('Error loading tickets:', error);
    }
}

// Initialize with event delegation
function initializeApp() {
    // First load tickets and initialize editors
    initializeEditors();
    loadTickets();

    // View switching with delegation
    document.addEventListener('click', e => {
        const viewBtn = e.target.closest('.view-btn');
        if (viewBtn) {
            switchView(viewBtn.id.includes('list') ? 'list' : 'grid');
        }
    });

    // New ticket buttons with direct event listeners
    const handleNewTicket = () => createTicket('New Ticket');
    DOM.buttons.newTicketList?.addEventListener('click', handleNewTicket);
    DOM.buttons.newTicketGrid?.addEventListener('click', handleNewTicket);

    // Open folder buttons
    const handleOpenFolder = () => {
        if (currentTicket) {
            ipcRenderer.invoke('open-ticket-folder', {
                ticketName: currentTicket.title,
                ticketId: currentTicket.id
            });
        }
    };
    DOM.buttons.openFolderList?.addEventListener('click', handleOpenFolder);
    DOM.buttons.openFolderFull?.addEventListener('click', handleOpenFolder);

    // Complete ticket buttons
    DOM.buttons.completeTicketList?.addEventListener('click', () => completeTicket('list'));
    DOM.buttons.completeTicketFull?.addEventListener('click', () => completeTicket('grid'));

    // Close fullscreen button
    DOM.buttons.closeFullscreen?.addEventListener('click', () => {
        DOM.layouts.fullscreen.classList.add('hidden');
        switchView('grid');
    });

    // Open master folder buttons
    const handleOpenMasterFolder = async () => {
        try {
            await ipcRenderer.invoke('open-master-folder');
        } catch (error) {
            console.error('Error opening master folder:', error);
        }
    };
    DOM.buttons.openMasterFolderList?.addEventListener('click', handleOpenMasterFolder);
    DOM.buttons.openMasterFolderGrid?.addEventListener('click', handleOpenMasterFolder);

    // Ticket actions with delegation
    delegate(DOM.containers.ticketList, 'click', '.ticket-item', (e, target) => {
        if (!e.target.classList.contains('btn')) {
            selectTicket(tickets.find(t => t.id === target.dataset.id), 'list');
        }
    });

    delegate(DOM.containers.ticketGrid, 'click', '.grid-ticket', (e, target) => {
        if (!e.target.classList.contains('btn')) {
            selectTicket(tickets.find(t => t.id === target.dataset.id), 'grid');
        }
    });

    // Complete ticket buttons with delegation
    delegate(document, 'click', '.btn-done', e => {
        const ticketElement = e.target.closest('[data-id]');
        if (ticketElement) {
            currentTicket = tickets.find(t => t.id === ticketElement.dataset.id);
            completeTicket(currentView);
        }
    });

    // Title input handling with debounce
    const handleTitleChange = debounce(async (newTitle) => {
        if (!currentTicket) return;
        try {
            const result = await ipcRenderer.invoke('rename-ticket-folder', {
                oldName: currentTicket.title,
                newName: newTitle,
                ticketId: currentTicket.id
            });
            if (result.success) {
                currentTicket.title = result.sanitizedName;
                renderTickets();
            }
        } catch (error) {
            console.error('Error updating ticket:', error);
        }
    }, 500);

    [DOM.inputs.titleList, DOM.inputs.titleFull].forEach(input => {
        if (input) {
            input.addEventListener('input', e => {
                if (currentTicket) handleTitleChange(e.target.value);
            });
        }
    });
}

// Utility function for debouncing
function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait);
    };
}

// Initialize on DOM load
document.addEventListener('DOMContentLoaded', initializeApp); 