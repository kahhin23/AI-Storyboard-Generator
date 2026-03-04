// js/app.js

const app = {
    state: {
        project: {
            name: '',
            description: '',
            type: '',
            duration: '',
            genre: ''
        },
        currentScreen: 'home'
    },

    genres: [
        { name: 'Action', icon: '🔥', desc: 'High energy & thrills' },
        { name: 'Comedy', icon: '😂', desc: 'Lighthearted & funny' },
        { name: 'Horror', icon: '👻', desc: 'Spooky & terrifying' },
        { name: 'Romance', icon: '❤️', desc: 'Love & relationships' },
        { name: 'Sci-Fi', icon: '🚀', desc: 'Futuristic & tech' },
        { name: 'Documentary', icon: '🎥', desc: 'Real-world events' },
        { name: 'Corporate', icon: '💼', desc: 'Professional & slick' },
        { name: 'Fantasy', icon: '✨', desc: 'Magic & mythical' }
    ],

    init() {
        this.bindEvents();
        this.populateGenres();
        this.initParticles();
    },

    bindEvents() {
        // Home Screen
        document.getElementById('btn-create-project').addEventListener('click', () => {
            const name = document.getElementById('project-name').value.trim();
            const desc = document.getElementById('project-description').value.trim();
            const apiKey = document.getElementById('api-key-input').value.trim();

            if (!apiKey) {
                this.showError('api-key-input', 'Please enter your Google Gemini API key.');
                return;
            }

            if (!name) {
                this.showError('project-name', 'Please enter a project name.');
                return;
            }

            this.state.project.name = name;
            this.state.project.description = desc;
            this.navigateTo('type');
        });

        // Duration Screen
        document.getElementById('btn-submit-duration').addEventListener('click', () => {
            const type = this.state.project.type;

            if (type === 'Drama') {
                const episodes = parseInt(document.getElementById('drama-episodes').value, 10);
                const minutes = parseInt(document.getElementById('drama-minutes').value, 10);

                if (!episodes || episodes < 1) {
                    this.showError('drama-episodes', 'Please enter the number of episodes.');
                    return;
                }
                if (!minutes || minutes < 20) {
                    this.showError('drama-minutes', 'Each episode must be at least 20 minutes.');
                    return;
                }
                this.state.project.duration = `${episodes} episode${episodes > 1 ? 's' : ''}, ${minutes} minutes each`;
            } else {
                const minMinutes = type === 'Movie' ? 90 : 1;
                const val = parseInt(document.getElementById('project-duration').value, 10);

                if (!val || val < minMinutes) {
                    const msg = type === 'Movie'
                        ? 'Movie duration must be at least 90 minutes (1.5 hours).'
                        : 'Please enter a valid duration.';
                    this.showError('project-duration', msg);
                    return;
                }
                this.state.project.duration = `${val} minutes`;
            }

            this.navigateTo('genre');
        });

        // Handle Enter key on inputs
        document.getElementById('project-name').addEventListener('keypress', (e) => {
            if (e.key === 'Enter') document.getElementById('btn-create-project').click();
        });

        // Handle File Upload — reads file and sends to Gemini
        document.getElementById('file-upload').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            // Reset so the same file can be re-uploaded later
            e.target.value = '';

            const label = this._activeUploadLabel || 'Reference Document';
            const chatMessages = document.getElementById('chat-messages');

            // Only .txt files supported natively
            if (!file.name.endsWith('.txt')) {
                chatMessages.innerHTML += `<div class="chat-msg chat-msg--warn">⚠️ Only <strong>.txt</strong> files are supported right now. Please convert your file to plain text and try again.</div>`;
                chatMessages.scrollTop = chatMessages.scrollHeight;
                return;
            }

            // Read file as text
            const fileText = await file.text();

            // Show loading
            const loadingId = 'loading-' + Date.now();
            chatMessages.innerHTML += `<div class="chat-msg chat-msg--info">📄 <strong>${file.name}</strong> uploaded. Applying <em>${label}</em> to your storyboard...</div>`;
            chatMessages.innerHTML += `<div id="${loadingId}" class="chat-msg chat-msg--loading">AI is reviewing your ${label}...</div>`;
            chatMessages.scrollTop = chatMessages.scrollHeight;

            const middleData = {
                time: document.getElementById('editor-time').value.trim(),
                location: document.getElementById('editor-location').value.trim(),
                character: document.getElementById('editor-character').value.trim(),
                items: document.getElementById('editor-items').value.trim(),
                duration: document.getElementById('editor-length').value.trim(),
                vibe: document.getElementById('editor-vibe').value.trim()
            };
            const currentHtml = document.getElementById('storyboard-output').innerHTML;

            try {
                const response = await geminiAPI.ingestFileContext(label, fileText, currentHtml, middleData);

                document.getElementById(loadingId)?.remove();
                this.addChatMessage('ai', response.chatReply);
                this.diffAndRender(currentHtml, response.newHtml);

            } catch (error) {
                document.getElementById(loadingId)?.remove();
                this.addChatMessage('error', `Failed to apply ${label}. Please try again.`);
            }
        });

        // Handle Chat Input Enter key with Gemini modify API integration
        document.getElementById('chat-input').addEventListener('keypress', async (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const val = e.target.value.trim();
                const inputElement = e.target;

                if (val && !inputElement.disabled) {
                    const chatMessages = document.getElementById('chat-messages');

                    // 1. Display User Message
                    this.addChatMessage('user', val);
                    inputElement.value = '';
                    inputElement.disabled = true; // Disable input while waiting

                    // 2. Add loading indicator to chat
                    const loadingId = 'loading-' + Date.now();
                    chatMessages.innerHTML += `<div id="${loadingId}" style="color:var(--text-secondary); font-size:0.9rem; font-style:italic;">AI is drafting changes...</div>`;
                    chatMessages.scrollTop = chatMessages.scrollHeight;

                    // 3. Gather Context from UI
                    const middleData = {
                        time: document.getElementById('editor-time').value.trim(),
                        location: document.getElementById('editor-location').value.trim(),
                        character: document.getElementById('editor-character').value.trim(),
                        items: document.getElementById('editor-items').value.trim(),
                        duration: document.getElementById('editor-length').value.trim(),
                        vibe: document.getElementById('editor-vibe').value.trim()
                    };
                    const currentHtml = document.getElementById('storyboard-output').innerHTML;

                    // 4. Call Gemini modify function
                    try {
                        const response = await geminiAPI.modifyStoryboard(currentHtml, middleData, val);

                        // Remove loading
                        const loadingMessage = document.getElementById(loadingId);
                        if (loadingMessage) loadingMessage.remove();

                        // 5. Update Chat & Storyboard with diff highlights
                        this.addChatMessage('ai', response.chatReply);
                        this.diffAndRender(currentHtml, response.newHtml);

                    } catch (error) {
                        const loadingMessage = document.getElementById(loadingId);
                        if (loadingMessage) loadingMessage.remove();
                        this.addChatMessage('error', 'Failed to apply changes. Try again later.');
                    }

                    // 6. Cleanup
                    inputElement.disabled = false;
                    setTimeout(() => inputElement.focus(), 10);
                }
            }
        });
    },

    /**
     * Splits HTML content into sentences while preserving HTML tags.
     * Each sentence is wrapped in a span with an edit button.
     */
    wrapTextInSentences(html) {
        const temp = document.createElement('div');
        temp.innerHTML = html;

        const processNode = (node) => {
            if (node.nodeType === Node.TEXT_NODE) {
                const text = node.textContent;
                // Split by sentence endings (. ! ?) followed by space or end of string
                const sentences = text.match(/[^.!?]+[.!?]+(?:\s+|$)|[^.!?]+$/g) || [text];

                const fragment = document.createDocumentFragment();
                sentences.forEach(s => {
                    if (s.trim().length === 0) {
                        fragment.appendChild(document.createTextNode(s));
                        return;
                    }
                    const span = document.createElement('span');
                    span.className = 'editable-sentence';
                    span.dataset.original = s;

                    const id = 'sent-' + Math.random().toString(36).substr(2, 9);
                    span.id = id;

                    span.innerHTML = `<span class="text-body">${s}</span>
                        <div class="edit-actions">
                            <button class="edit-btn-small" onclick="event.stopPropagation(); app.toggleEdit('${id}')">Edit</button>
                        </div>`;
                    fragment.appendChild(span);
                });
                return fragment;
            } else if (node.nodeType === Node.ELEMENT_NODE) {
                // Don't split inside headers or short tags
                if (['H1', 'H2', 'H3', 'BUTTON'].includes(node.tagName)) {
                    return node.cloneNode(true);
                }
                const newEl = node.cloneNode(false);
                Array.from(node.childNodes).forEach(child => {
                    const processed = processNode(child);
                    if (processed) newEl.appendChild(processed);
                });
                return newEl;
            }
            return node.cloneNode(true);
        };

        const result = document.createDocumentFragment();
        Array.from(temp.childNodes).forEach(node => {
            const processed = processNode(node);
            if (processed) result.appendChild(processed);
        });

        const output = document.createElement('div');
        output.appendChild(result);
        return output.innerHTML;
    },

    addChatMessage(role, text) {
        const chatMessages = document.getElementById('chat-messages');
        const id = 'msg-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

        let msgHtml = '';
        if (role === 'user' || role === 'ai') {
            const label = role === 'user' ? 'You' : 'AI';
            const className = role === 'ai' ? 'chat-msg chat-msg--ai' : '';
            const processedText = this.wrapTextInSentences(text);

            msgHtml = `<div class="${className}" id="${id}" style="font-size:0.95rem; padding: 5px;">
                <strong>${label}:</strong> ${processedText}
            </div>`;
        } else {
            const className = role === 'error' ? 'chat-msg--error' : (role === 'warn' ? 'chat-msg--warn' : 'chat-msg--info');
            msgHtml = `<div class="chat-msg ${className}">${text}</div>`;
        }

        chatMessages.insertAdjacentHTML('beforeend', msgHtml);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return id;
    },

    toggleEdit(id) {
        const target = document.getElementById(id);
        const textBody = target.querySelector('.text-body');
        const currentText = textBody.innerText;

        // Hide text and actions
        textBody.style.display = 'none';
        const actions = target.querySelector('.edit-actions');
        if (actions) actions.style.display = 'none';

        // Add editing UI
        const editUi = document.createElement('div');
        editUi.className = 'edit-ui';
        editUi.innerHTML = `
            <textarea class="edit-textarea">${currentText}</textarea>
            <div class="edit-controls">
                <button class="edit-cancel-btn" onclick="event.stopPropagation(); app.cancelEdit('${id}')">Cancel</button>
                <button class="edit-save-btn" onclick="event.stopPropagation(); app.saveEdit('${id}')">Save</button>
            </div>
        `;
        target.appendChild(editUi);
        const textarea = editUi.querySelector('textarea');
        textarea.focus();

        // Prevent clicking textarea from triggering parent events
        textarea.addEventListener('click', e => e.stopPropagation());
    },

    cancelEdit(id) {
        const target = document.getElementById(id);
        const textBody = target.querySelector('.text-body');
        const editUi = target.querySelector('.edit-ui');

        if (editUi) editUi.remove();
        textBody.style.display = '';
        const actions = target.querySelector('.edit-actions');
        if (actions) actions.style.display = '';
    },

    saveEdit(id) {
        const target = document.getElementById(id);
        const textBody = target.querySelector('.text-body');
        const editUi = target.querySelector('.edit-ui');
        const newText = editUi.querySelector('textarea').value;

        textBody.innerText = newText;

        if (editUi) editUi.remove();
        textBody.style.display = '';
        const actions = target.querySelector('.edit-actions');
        if (actions) actions.style.display = '';
    },

    populateGenres() {
        const grid = document.getElementById('genre-grid');
        grid.innerHTML = '';

        this.genres.forEach(genre => {
            const card = document.createElement('div');
            card.className = 'option-card';
            card.innerHTML = `
                <div class="icon">${genre.icon}</div>
                <h3>${genre.name}</h3>
                <p>${genre.desc}</p>
            `;
            card.addEventListener('click', () => this.selectGenre(genre.name));
            grid.appendChild(card);
        });
    },

    navigateTo(screenName) {
        const currentId = `screen-${this.state.currentScreen}`;
        document.getElementById(currentId).classList.remove('active');

        setTimeout(() => {
            document.getElementById(currentId).classList.add('hidden');

            const nextId = `screen-${screenName}`;
            const targetEl = document.getElementById(nextId);
            targetEl.classList.remove('hidden');

            setTimeout(() => {
                targetEl.classList.add('active');
            }, 10);

            this.state.currentScreen = screenName;

        }, 400);
    },

    goBack() {
        const flow = ['home', 'type', 'duration', 'genre', 'generating', 'editor'];
        const currentIndex = flow.indexOf(this.state.currentScreen);
        if (currentIndex > 0) {
            this.navigateTo(flow[currentIndex - 1]);
        }
    },

    selectType(type) {
        this.state.project.type = type;
        this.navigateTo('duration');
        // Setup the duration screen after a short delay to let the screen appear
        setTimeout(() => this.setupDurationScreen(type), 420);
    },

    setupDurationScreen(type) {
        const standard = document.getElementById('duration-standard');
        const drama = document.getElementById('duration-drama');
        const subtitle = document.getElementById('duration-subtitle');
        const hint = document.getElementById('duration-min-hint');
        const chipsStd = document.getElementById('quick-durations-standard');

        // Reset fields
        document.getElementById('project-duration').value = '';
        document.getElementById('drama-episodes').value = '';
        document.getElementById('drama-minutes').value = '';

        if (type === 'Drama') {
            standard.style.display = 'none';
            drama.style.display = 'block';
            subtitle.textContent = 'How many episodes, and how long is each one?';
            hint.textContent = '⚠️ Minimum 20 minutes per episode.';
        } else if (type === 'Movie') {
            standard.style.display = 'block';
            drama.style.display = 'none';
            subtitle.textContent = 'How long is your movie?';
            hint.textContent = '⚠️ Minimum duration: 90 minutes (1 hour 30 min).';
            document.getElementById('project-duration').min = 90;
            document.getElementById('project-duration').placeholder = 'e.g. 120';
            chipsStd.innerHTML = `
                <button class="btn-chip" onclick="app.setQuickDuration(90)">90 min</button>
                <button class="btn-chip" onclick="app.setQuickDuration(100)">100 min</button>
                <button class="btn-chip" onclick="app.setQuickDuration(120)">120 min</button>
                <button class="btn-chip" onclick="app.setQuickDuration(150)">150 min</button>
                <button class="btn-chip" onclick="app.setQuickDuration(180)">180 min</button>
            `;
        } else { // Platform
            standard.style.display = 'block';
            drama.style.display = 'none';
            subtitle.textContent = 'How long is the intended content?';
            hint.textContent = '';
            document.getElementById('project-duration').min = 1;
            document.getElementById('project-duration').placeholder = 'e.g. 30';
            chipsStd.innerHTML = `
                <button class="btn-chip" onclick="app.setQuickDuration(1)">1 min</button>
                <button class="btn-chip" onclick="app.setQuickDuration(3)">3 min</button>
                <button class="btn-chip" onclick="app.setQuickDuration(5)">5 min</button>
                <button class="btn-chip" onclick="app.setQuickDuration(10)">10 min</button>
                <button class="btn-chip" onclick="app.setQuickDuration(15)">15 min</button>
            `;
        }
    },

    setQuickDuration(minutes) {
        document.getElementById('project-duration').value = minutes;
    },

    setDramaQuick(minutes) {
        document.getElementById('drama-minutes').value = minutes;
    },

    selectGenre(genre) {
        this.state.project.genre = genre;
        this.startGeneration();
    },

    async startGeneration() {
        this.navigateTo('generating');
        this.animateLoadingSteps();

        try {
            // Call Gemini API (implemented in gemini.js)
            const storyboardData = await geminiAPI.generateStoryboard(this.state.project);

            // Success
            this.populateEditor(storyboardData);
            setTimeout(() => this.navigateTo('editor'), 1000);

        } catch (error) {
            console.error('Generation Error:', error);
            const container = document.querySelector('.generating-container');
            container.innerHTML = `
                <div class="icon" style="font-size:4rem; margin-bottom:1rem;">⚠️</div>
                <h2 style="color:#ef4444">Generation Failed</h2>
                <p style="color:var(--text-secondary); margin-bottom:2rem;">${error.message}</p>
                <button class="btn primary" onclick="app.goBack()">Try Again</button>
            `;
        }
    },

    animateLoadingSteps() {
        const steps = [1, 2, 3, 4];
        let currentStep = 0;

        const interval = setInterval(() => {
            if (this.state.currentScreen !== 'generating') {
                clearInterval(interval);
                return;
            }

            if (currentStep > 0) {
                document.getElementById(`step-${currentStep}`).classList.remove('active');
                document.getElementById(`step-${currentStep}`).classList.add('done');
            }

            currentStep++;

            if (currentStep <= 4) {
                document.getElementById(`step-${currentStep}`).classList.add('active');
            } else {
                clearInterval(interval);
            }
        }, 2000);
    },

    populateEditor(storyboardData) {
        const output = document.getElementById('storyboard-output');

        if (!storyboardData) {
            output.innerHTML = '<p class="error-message">Could not generate the storyboard. Please try again.</p>';
            return;
        }

        // Populate Middle Column Fields
        document.getElementById('editor-length').value = this.state.project.duration;
        document.getElementById('editor-vibe').value = this.state.project.genre;
        document.getElementById('editor-time').value = '';
        document.getElementById('editor-location').value = '';
        document.getElementById('editor-character').value = '';
        document.getElementById('editor-items').value = '';

        // Populate Right Column (AI Output format is raw HTML)
        this.renderStoryboard(storyboardData);

        // Initialize Chat Room
        this.addChatMessage('ai', `Welcome to the Editor! I have prepared a draft based on '${this.state.project.name}'. Feel free to edit the text on the right directly, or ask me to make changes.`);
    },

    renderStoryboard(html) {
        const output = document.getElementById('storyboard-output');
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        const children = Array.from(tempDiv.children);
        let sceneHtml = '';
        let currentScene = null;
        let sceneIndex = 0;

        children.forEach(child => {
            if (child.tagName === 'H3') {
                if (currentScene) sceneHtml += this.wrapScene(currentScene, sceneIndex++);
                currentScene = child.outerHTML;
            } else {
                if (!currentScene) currentScene = '';
                currentScene += child.outerHTML;
            }
        });
        if (currentScene) sceneHtml += this.wrapScene(currentScene, sceneIndex);

        output.innerHTML = sceneHtml;
    },

    wrapScene(html, index) {
        const processedHtml = this.wrapTextInSentences(html);
        return `<div class="scene-container" id="scene-${index}">
            <div class="scene-content">${processedHtml}</div>
        </div>`;
    },

    resetFlow() {
        this.state.project = {
            name: '',
            description: '',
            type: '',
            duration: '',
            genre: ''
        };
        document.getElementById('project-name').value = '';
        document.getElementById('project-description').value = '';
        document.getElementById('project-duration').value = '';
        document.getElementById('drama-episodes').value = '';
        document.getElementById('drama-minutes').value = '';

        // Reset loading screen UI just in case
        document.querySelector('.generating-container').innerHTML = `
            <div class="ai-orb"></div>
            <h2 class="gradient-text pulse-text">Generating your storyboard...</h2>
            <div class="loading-steps">
                <p class="step active" id="step-1">Analyzing project parameters...</p>
                <p class="step" id="step-2">Crafting narrative arc...</p>
                <p class="step" id="step-3">Visualizing scenes and camera angles...</p>
                <p class="step" id="step-4">Finalizing storyboard format...</p>
            </div>
        `;

        // Clear Chat & Output
        document.getElementById('chat-messages').innerHTML = '';
        document.getElementById('storyboard-output').innerHTML = '';

        this.navigateTo('home');
    },

    showError(elementId, message) {
        const el = document.getElementById(elementId);
        el.style.borderColor = '#ef4444';

        let originalTrans = el.style.transform;
        el.style.transform = 'translateX(10px)';
        setTimeout(() => el.style.transform = 'translateX(-10px)', 50);
        setTimeout(() => el.style.transform = originalTrans, 100);

        setTimeout(() => {
            el.style.borderColor = 'var(--glass-border)';
        }, 2000);
    },

    initParticles() {
        const container = document.getElementById('particles');
        const count = 30;

        for (let i = 0; i < count; i++) {
            const particle = document.createElement('div');
            particle.style.position = 'absolute';
            particle.style.width = Math.random() * 4 + 'px';
            particle.style.height = particle.style.width;
            particle.style.background = 'white';
            particle.style.borderRadius = '50%';
            particle.style.opacity = Math.random() * 0.3;
            particle.style.left = Math.random() * 100 + 'vw';
            particle.style.top = Math.random() * 100 + 'vh';
            particle.style.pointerEvents = 'none';

            const moveX = (Math.random() - 0.5) * 200;
            const moveY = (Math.random() - 0.5) * 200;
            const duration = 10 + Math.random() * 20 + 's';

            particle.animate([
                { transform: 'translate(0,0)' },
                { transform: `translate(${moveX}px, ${moveY}px)` }
            ], {
                duration: parseFloat(duration) * 1000,
                iterations: Infinity,
                direction: 'alternate',
                easing: 'ease-in-out'
            });

            container.appendChild(particle);
        }
    },

    triggerFileUpload(buttonElement) {
        this._activeUploadLabel = buttonElement.getAttribute('data-label') || 'Document';
        document.getElementById('file-upload').click();
    },

    diffAndRender(oldHtml, newHtml) {
        const outputElement = document.getElementById('storyboard-output');

        // Simple DOM-based block diffing
        const oldDiv = document.createElement('div');
        oldDiv.innerHTML = oldHtml;
        const newDiv = document.createElement('div');
        newDiv.innerHTML = newHtml;

        const oldBlocks = Array.from(oldDiv.children).map(el => el.textContent.trim());
        const newElements = Array.from(newDiv.children);

        const resultHtml = newElements.map(el => {
            const textContent = el.textContent.trim();
            // If the block is completely new or its text changed, highlight it
            if (!oldBlocks.includes(textContent)) {
                return `<div class="changed-block">${el.outerHTML}</div>`;
            }
            return el.outerHTML;
        }).join('\n');

        outputElement.style.opacity = '0';
        setTimeout(() => {
            this.renderStoryboard(newHtml);
            // Re-apply diff highlights if necessary - for now we just re-render
            outputElement.style.opacity = '1';
        }, 200);
    },

    downloadPDF() {
        // Find the AI output div that holds the storyboard
        const element = document.getElementById('storyboard-output');
        const opt = {
            margin: 15,
            filename: `${this.state.project.name.replace(/\s+/g, '_') || 'Draft'}_Storyboard.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' }
        };

        // Temporarily change text color for PDF readability
        element.style.color = 'black';

        html2pdf().set(opt).from(element).save().then(() => {
            // Restore text color
            element.style.color = '';

            // Add chat log event for download
            const chatMessages = document.getElementById('chat-messages');
            chatMessages.innerHTML += `<div style="color:#FFB300; font-size:0.9rem;">-> Saved Storyboard PDF successfully!</div>`;
            chatMessages.scrollTop = chatMessages.scrollHeight;
        });
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
