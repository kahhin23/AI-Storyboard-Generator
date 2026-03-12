// js/app.js
if (typeof window.global === 'undefined') window.global = window;
if (typeof window.process === 'undefined') window.process = { env: {} };
if (typeof window.Buffer === 'undefined') {
    window.Buffer = {
        from: function (data, encoding) {
            if (typeof data === 'string') {
                if (encoding === 'base64') {
                    const binary = atob(data);
                    const bytes = new Uint8Array(binary.length);
                    for (let i = 0; i < binary.length; i++) {
                        bytes[i] = binary.charCodeAt(i);
                    }
                    return bytes;
                }
                return new TextEncoder().encode(data);
            }
            return new Uint8Array(data);
        },
        isBuffer: () => false
    };
}

const app = {
    state: {
        user: null,
        isGuest: false,
        guestHistory: [], // In-memory only; disappears on refresh
        characters: [], // In-memory mirror of loaded characters
        selectedCharacterId: null,
        project: {
            name: '',
            description: '',
            synopsis: '',
            type: '',
            duration: '',
            genre: '',
            language: ''
        },
        currentScreen: 'login' // Changed initial screen to login
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

    languages: [
        { name: 'English', flag: '🇺🇸' },
        { name: 'Chinese (Simplified)', flag: '🇨🇳' },
        { name: 'Chinese (Traditional)', flag: '🇹🇼' },
        { name: 'Japanese', flag: '🇯🇵' },
        { name: 'Korean', flag: '🇰🇷' },
        { name: 'Spanish', flag: '🇪🇸' },
        { name: 'French', flag: '🇫🇷' },
        { name: 'German', flag: '🇩🇪' },
        { name: 'Portuguese', flag: '🇧🇷' },
        { name: 'Italian', flag: '🇮🇹' },
        { name: 'Russian', flag: '🇷🇺' },
        { name: 'Arabic', flag: '🇸🇦' },
        { name: 'Hindi', flag: '🇮🇳' },
        { name: 'Bengali', flag: '🇧🇩' },
        { name: 'Malay / Indonesian', flag: '🇲🇾' },
        { name: 'Thai', flag: '🇹🇭' },
        { name: 'Vietnamese', flag: '🇻🇳' },
        { name: 'Turkish', flag: '🇹🇷' },
        { name: 'Polish', flag: '🇵🇱' },
        { name: 'Dutch', flag: '🇳🇱' },
        { name: 'Swedish', flag: '🇸🇪' },
        { name: 'Norwegian', flag: '🇳🇴' },
        { name: 'Danish', flag: '🇩🇰' },
        { name: 'Finnish', flag: '🇫🇮' },
        { name: 'Czech', flag: '🇨🇿' },
        { name: 'Romanian', flag: '🇷🇴' },
        { name: 'Hungarian', flag: '🇭🇺' },
        { name: 'Greek', flag: '🇬🇷' },
        { name: 'Hebrew', flag: '🇮🇱' },
        { name: 'Ukrainian', flag: '🇺🇦' },
        { name: 'Swahili', flag: '🇰🇪' },
        { name: 'Tagalog / Filipino', flag: '🇵🇭' },
        { name: 'Persian (Farsi)', flag: '🇮🇷' },
        { name: 'Urdu', flag: '🇵🇰' },
        { name: 'Tamil', flag: '🇱🇰' }
    ],

    init() {
        this.restoreProjectState();
        this.bindEvents();
        this.populateGenres();
        this.populateLanguages();
        this.initParticles();
        this.setupAuthentication();
    },

    persistProjectState() {
        try {
            const payload = {
                name: this.state.project.name || '',
                description: this.state.project.description || '',
                synopsis: this.state.project.synopsis || '',
                type: this.state.project.type || '',
                duration: this.state.project.duration || '',
                genre: this.state.project.genre || '',
                language: this.state.project.language || ''
            };
            localStorage.setItem('aiStoryboard.project', JSON.stringify(payload));
        } catch (e) {
            // ignore
        }
    },

    restoreProjectState() {
        try {
            const raw = localStorage.getItem('aiStoryboard.project');
            if (!raw) return;
            const data = JSON.parse(raw);
            if (!data || typeof data !== 'object') return;

            this.state.project = {
                ...this.state.project,
                name: data.name || this.state.project.name,
                description: data.description || this.state.project.description,
                synopsis: data.synopsis || this.state.project.synopsis,
                type: data.type || this.state.project.type,
                duration: data.duration || this.state.project.duration,
                genre: data.genre || this.state.project.genre,
                language: data.language || this.state.project.language
            };

            const nameEl = document.getElementById('project-name');
            if (nameEl && this.state.project.name) nameEl.value = this.state.project.name;
            const descEl = document.getElementById('project-description');
            if (descEl && this.state.project.description) descEl.value = this.state.project.description;
        } catch (e) {
            // ignore
        }
    },

    setupAuthentication() {
        // Handle Google Login Button Click
        const loginBtn = document.getElementById('btn-google-login');
        if (loginBtn) {
            loginBtn.addEventListener('click', async () => {
                // If currently in guest mode, exit it before authenticating with Firebase
                if (this.state.isGuest) {
                    this.state.isGuest = false;
                    this.state.user = null;
                    this.state.guestHistory = [];
                    document.getElementById('user-profile-dropdown').style.display = 'none';
                }
                if (window.firebaseAuthAPI) {
                    try {
                        await window.firebaseAuthAPI.signIn();
                        // State observer will handle the transition
                    } catch (e) {
                        // Error handled in auth.js
                    }
                } else {
                    alert("Authentication module is still loading...");
                }
            });
        }

        // Handle Guest Login Button Click
        const guestBtn = document.getElementById('btn-guest-login');
        if (guestBtn) {
            guestBtn.addEventListener('click', () => {
                this.enterGuestMode();
            });
        }

        // Handle Logout Button
        const logoutBtn = document.getElementById('btn-logout');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', async () => {
                if (this.state.isGuest) {
                    this.exitGuestMode();
                    return;
                }
                if (window.firebaseAuthAPI) {
                    await window.firebaseAuthAPI.signOut();
                }
            });
        }

        // Wait for Firebase to initialize before setting up observer
        const checkAuthReady = setInterval(() => {
            if (window.firebaseAuthAPI) {
                clearInterval(checkAuthReady);

                // Initialize observer
                window.firebaseAuthAPI.initAuthObserver(
                    // On Login Function
                    (user) => {
                        // If user previously chose guest mode, ignore Firebase auth changes
                        if (this.state.isGuest) return;
                        this.state.user = user;
                        this.state.isGuest = false;
                        this.state.characters = [];
                        this.state.selectedCharacterId = null;

                        // Update UI
                        document.getElementById('user-profile-dropdown').style.display = 'block';
                        const nameSpan = document.getElementById('user-name');
                        if (nameSpan) nameSpan.textContent = user.displayName;
                        const logoutLabel = document.querySelector('#btn-logout');
                        if (logoutLabel) logoutLabel.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> Sign Out';

                        // Load History
                        this.loadHistory();
                        this.loadCharacters();

                        // Navigate to home if currently on login
                        if (this.state.currentScreen === 'login') {
                            this.navigateTo('home');
                        }
                    },
                    // On Logout Function
                    () => {
                        // If in guest mode, don't let Firebase observer kick you back to login.
                        if (this.state.isGuest) return;
                        this.state.user = null;

                        // Hide UI
                        document.getElementById('user-profile-dropdown').style.display = 'none';
                        const profileMenu = document.getElementById('profile-menu');
                        if (profileMenu) profileMenu.style.display = 'none';

                        // Clear History
                        document.getElementById('history-list').innerHTML = '<p class="history-empty" id="history-emptyMsg">No saved storyboards yet.</p>';
                        this.state.characters = [];
                        this.state.selectedCharacterId = null;

                        // Navigate to login
                        if (this.state.currentScreen !== 'login') {
                            this.resetFlow(true); // Forced reset on logout
                        }
                    }
                );
            }
        }, 100);
    },

    enterGuestMode() {
        this.state.isGuest = true;
        this.state.user = { displayName: 'Guest', isGuest: true };
        this.state.guestHistory = [];
        this.state.characters = [];
        this.state.selectedCharacterId = null;

        // Update UI to look "logged in"
        document.getElementById('user-profile-dropdown').style.display = 'block';
        const nameSpan = document.getElementById('user-name');
        if (nameSpan) nameSpan.textContent = 'Guest';
        const logoutLabel = document.querySelector('#btn-logout');
        if (logoutLabel) logoutLabel.innerHTML = '<i class="fa-solid fa-right-from-bracket"></i> Exit Guest';

        // Clear/initialize local history UI
        this.loadHistory();

        if (this.state.currentScreen === 'login') {
            this.navigateTo('home');
        }
    },

    exitGuestMode() {
        this.state.isGuest = false;
        this.state.user = null;
        this.state.guestHistory = [];
        this.state.characters = [];
        this.state.selectedCharacterId = null;

        // Hide profile UI
        document.getElementById('user-profile-dropdown').style.display = 'none';
        const profileMenu = document.getElementById('profile-menu');
        if (profileMenu) profileMenu.style.display = 'none';

        // Clear history UI
        document.getElementById('history-list').innerHTML = '<p class="history-empty" id="history-emptyMsg">No saved storyboards yet.</p>';

        if (this.state.currentScreen !== 'login') {
            this.resetFlow(true);
        }
    },

    bindEvents() {
        // Profile Dropdown functionality
        document.getElementById('btn-profile').addEventListener('click', (e) => {
            e.stopPropagation();
            const profileMenu = document.getElementById('profile-menu');
            profileMenu.style.display = (profileMenu.style.display === 'none' || profileMenu.style.display === '') ? 'flex' : 'none';
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', (e) => {
            const profileMenu = document.getElementById('profile-menu');
            const btnProfile = document.getElementById('btn-profile');
            // If the menu is open and we click outside of it and its button
            if (profileMenu && profileMenu.style.display === 'flex' && !profileMenu.contains(e.target) && !btnProfile.contains(e.target)) {
                profileMenu.style.display = 'none';
            }
        });

        // History Sidebar Toggle
        const toggleHistoryBtn = document.getElementById('btn-toggle-history');
        if (toggleHistoryBtn) {
            toggleHistoryBtn.addEventListener('click', () => {
                document.getElementById('history-sidebar').classList.toggle('open');
            });
        }

        // Close Modal
        const btnCloseModal = document.getElementById('btn-close-modal');
        if (btnCloseModal) {
            btnCloseModal.addEventListener('click', () => this.closeHistoryModal());
        }

        // Synopsis file upload (modal)
        const synopsisFile = document.getElementById('synopsis-file');
        if (synopsisFile) {
            synopsisFile.addEventListener('change', async (e) => {
                const file = e.target.files?.[0];
                try {
                    await this._handleSynopsisFileSelected(file);
                } catch (err) {
                    console.error('Failed to read synopsis file:', err);
                    alert('Failed to read the uploaded file.');
                }
            });
        }

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
            this.persistProjectState();
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

            this.persistProjectState();
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
                duration: document.getElementById('editor-length').value.trim(),
                vibe: document.getElementById('editor-vibe').value.trim()
            };
            const currentHtml = this.getStoryboardRawHtml();

            try {
                const response = await geminiAPI.ingestFileContext(label, fileText, currentHtml, middleData, this.state.project);

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
                        duration: document.getElementById('editor-length').value.trim(),
                        vibe: document.getElementById('editor-vibe').value.trim()
                    };
                    const currentHtml = this.getStoryboardRawHtml();

                    // 4. Call Gemini modify function
                    try {
                        const response = await geminiAPI.modifyStoryboard(currentHtml, middleData, val, this.state.project);

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

    addChatMessage(role, text) {
        const chatMessages = document.getElementById('chat-messages');
        const id = 'msg-' + Date.now() + '-' + Math.floor(Math.random() * 1000);

        let msgHtml = '';
        if (role === 'user' || role === 'ai') {
            const label = role === 'user' ? 'You' : 'AI';
            const labelColor = role === 'ai' ? 'color:#60a5fa; font-weight:700;' : 'color:#94a3b8; font-weight:700;';
            const parsed = (typeof marked !== 'undefined') ? marked.parse(text) : text;
            msgHtml = `<div id="${id}" style="font-size:0.92rem; padding:4px 0; border-bottom:1px solid rgba(255,255,255,0.05);">
                <span style="${labelColor} font-size:0.78rem; text-transform:uppercase; letter-spacing:0.05em;">${label}</span>
                <div style="margin-top:0.2rem; line-height:1.6; color:var(--text-primary);">${parsed}</div>
            </div>`;
        } else {
            const className = role === 'error' ? 'chat-msg--error' : (role === 'warn' ? 'chat-msg--warn' : 'chat-msg--info');
            msgHtml = `<div class="chat-msg ${className}">${text}</div>`;
        }

        chatMessages.insertAdjacentHTML('beforeend', msgHtml);
        chatMessages.scrollTop = chatMessages.scrollHeight;
        return id;
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
        const flow = ['home', 'type', 'duration', 'genre', 'language', 'generating', 'editor'];
        const currentIndex = flow.indexOf(this.state.currentScreen);
        if (currentIndex > 0) {
            this.navigateTo(flow[currentIndex - 1]);
        }
    },

    selectType(type) {
        this.state.project.type = type;
        this.persistProjectState();
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
        this.persistProjectState();
        this.navigateTo('language');
    },

    selectLanguage(language) {
        this.state.project.language = language;
        this.persistProjectState();
        this.startGeneration();
    },

    populateLanguages() {
        const grid = document.getElementById('language-grid');
        grid.innerHTML = '';

        this.languages.forEach(lang => {
            const card = document.createElement('div');
            card.className = 'option-card language-card';
            card.innerHTML = `
                <div class="icon">${lang.flag}</div>
                <h3>${lang.name}</h3>
            `;
            card.addEventListener('click', () => this.selectLanguage(lang.name));
            grid.appendChild(card);
        });
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

        // Populate Middle Column Fields — start blank
        document.getElementById('editor-length').value = '';
        document.getElementById('editor-vibe').value = '';
        document.getElementById('editor-time').value = '';
        document.getElementById('editor-location').value = '';
        document.getElementById('editor-character').value = '';

        // Keep AI Output blank when entering the editor.
        if (output) output.innerHTML = '';
    },

    normalizeStoryboardHtml(html) {
        if (!html || typeof html !== 'string') return '';
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;

        // If the HTML already contains our rendered wrappers, unwrap back to raw.
        const sceneContents = tempDiv.querySelectorAll('.scene-container .scene-content');
        if (sceneContents && sceneContents.length > 0) {
            return Array.from(sceneContents).map(el => el.innerHTML).join('\n');
        }

        return html;
    },

    getStoryboardRawHtml() {
        const output = document.getElementById('storyboard-output');
        if (!output) return '';
        return this.normalizeStoryboardHtml(output.innerHTML);
    },

    renderStoryboard(html) {
        const output = document.getElementById('storyboard-output');
        html = this.normalizeStoryboardHtml(html);
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
        return `<div class="scene-container" id="scene-${index}">
            <div class="scene-content">${html}</div>
        </div>`;
    },

    _resetFormState() {
        this.state.project = {
            name: '',
            description: '',
            type: '',
            duration: '',
            genre: '',
            language: ''
        };
        document.getElementById('project-name').value = '';
        document.getElementById('project-description').value = '';
        document.getElementById('project-duration').value = '';
        document.getElementById('drama-episodes').value = '';
        document.getElementById('drama-minutes').value = '';
        document.getElementById('editor-time').value = '';
        document.getElementById('editor-location').value = '';
        document.getElementById('editor-character').value = '';
        document.getElementById('editor-length').value = '';
        document.getElementById('editor-vibe').value = '';
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
    },

    resetFlow(forceLogout = false) {
        this._resetFormState();
        if (forceLogout || !this.state.user) {
            this.navigateTo('login');
        } else {
            this.navigateTo('home');
        }
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

    // ───── Synopsis Modal ─────
    openSynopsisModal() {
        if (!this.state.user) {
            alert("Please login (or continue as guest) to edit the synopsis.");
            return;
        }

        const modal = document.getElementById('synopsis-modal');
        if (!modal) return;

        const textEl = document.getElementById('synopsis-text');
        if (textEl) textEl.value = this.state.project.synopsis || '';

        const noteEl = document.getElementById('synopsis-note');
        if (noteEl) {
            noteEl.textContent = this.state.isGuest
                ? 'Guest mode: synopsis is stored only in this browser (local) and not saved to Firebase.'
                : 'Signed in: synopsis is stored locally for faster workflow and used for AI context.';
        }

        modal.classList.remove('hidden');
        setTimeout(() => textEl?.focus(), 10);
    },

    closeSynopsisModal() {
        const modal = document.getElementById('synopsis-modal');
        if (!modal) return;
        modal.classList.add('hidden');
    },

    triggerSynopsisFileUpload() {
        const input = document.getElementById('synopsis-file');
        if (!input) return;
        input.value = '';
        input.click();
    },

    async _handleSynopsisFileSelected(file) {
        if (!file) return;
        if (!file.name.endsWith('.txt')) {
            alert('Only .txt files are supported.');
            return;
        }
        const text = await file.text();
        const textEl = document.getElementById('synopsis-text');
        if (textEl) textEl.value = text;
    },

    saveSynopsisFromModal() {
        const textEl = document.getElementById('synopsis-text');
        const val = (textEl?.value || '').trim();
        this.state.project.synopsis = val;
        this.persistProjectState();
        this.closeSynopsisModal();
        this.addChatMessage('info', 'Synopsis saved and will be used for AI context.');
    },

    diffAndRender(oldHtml, newHtml) {
        const outputElement = document.getElementById('storyboard-output');
        oldHtml = this.normalizeStoryboardHtml(oldHtml);
        newHtml = this.normalizeStoryboardHtml(newHtml);

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
        // Only used for the active editor Export (if needed)
        this._executeDownload('storyboard-output', this.state.project.name);
    },

    downloadHistoryPDF() {
        // Used for exporting the history modal content
        const title = document.getElementById('history-modal-title').textContent;
        this._executeDownload('history-modal-body', title);
    },

    _executeDownload(elementId, projectName) {
        const element = document.getElementById(elementId);
        if (!element) return;

        const opt = {
            margin: 15,
            filename: `${(projectName || 'Draft').replace(/\\s+/g, '_')}_Storyboard.pdf`,
            image: { type: 'jpeg', quality: 0.98 },
            html2canvas: { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
            jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
            pagebreak: { mode: ['avoid-all', 'css'], avoid: ['tr', 'td', 'p', 'div', 'li', '.scene-container'] }
        };

        const originalColor = element.style.color;
        element.style.color = 'black';

        html2pdf().set(opt).from(element).save().then(() => {
            element.style.color = originalColor;
            const chatMessages = document.getElementById('chat-messages');
            if (chatMessages && elementId === 'storyboard-output') {
                chatMessages.innerHTML += `<div style="color:#FFB300; font-size:0.9rem;">-> Exported Storyboard PDF!</div>`;
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
        });
    },

    async saveStoryboard() {
        if (!this.state.user) {
            alert("You must be logged in to save storyboards.");
            return;
        }

        const htmlContent = document.getElementById('storyboard-output').innerHTML;
        if (!htmlContent || htmlContent.trim() === '') {
            alert("Nothing to save!");
            return;
        }

        // Guest mode: store in-memory only (no Firebase)
        if (this.state.isGuest) {
            const item = {
                id: 'guest-' + Date.now(),
                userId: 'guest',
                projectName: this.state.project.name || 'Untitled',
                projectType: this.state.project.type,
                projectGenre: this.state.project.genre,
                projectLanguage: this.state.project.language,
                htmlContent,
                createdAt: new Date()
            };
            this.state.guestHistory.unshift(item);
            await this.loadHistory();
            this.addChatMessage('info', 'Saved to session History (guest mode). This will disappear on refresh.');
            return;
        }

        const btnSave = document.getElementById('btn-save');
        const originalText = btnSave.innerHTML;
        btnSave.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        btnSave.disabled = true;

        try {
            await window.firebaseAuthAPI.saveStoryboard(this.state.user.uid, this.state.project, htmlContent);

            // Reload history to show new item
            await this.loadHistory();

            // Show success in UI and Chat
            btnSave.innerHTML = '<i class="fa-solid fa-check"></i> Saved!';
            btnSave.classList.replace('green', 'primary');
            this.addChatMessage('info', '✅ Storyboard successfully saved to your History.');

            setTimeout(() => {
                btnSave.innerHTML = originalText;
                btnSave.disabled = false;
                btnSave.classList.replace('primary', 'green');
            }, 3000);

        } catch (error) {
            btnSave.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> Error';
            btnSave.disabled = false;
            setTimeout(() => btnSave.innerHTML = originalText, 3000);
            alert("Failed to save storyboard: " + error.message);
        }
    },

    async loadHistory() {
        if (!this.state.user) return;

        // Guest mode: render in-memory list only
        if (this.state.isGuest) {
            const listContainer = document.getElementById('history-list');
            const storyboards = this.state.guestHistory || [];

            if (storyboards.length === 0) {
                listContainer.innerHTML = '<p class="history-empty" id="history-emptyMsg">No session storyboards yet.</p>';
                return;
            }

            listContainer.innerHTML = '';
            storyboards.forEach(sb => {
                const date = sb.createdAt instanceof Date ? sb.createdAt.toLocaleDateString() : 'Unknown date';
                const el = document.createElement('div');
                el.className = 'history-item';
                el.innerHTML = `
                    <h4>${sb.projectName || 'Untitled'}</h4>
                    <p>${sb.projectGenre || 'Various'} • ${sb.projectLanguage || 'EN'}</p>
                    <p style="font-size:0.7rem; margin-top:4px; opacity:0.6;"><i class="fa-regular fa-calendar"></i> ${date}</p>
                `;
                el.addEventListener('click', () => {
                    this.openHistoryModal(sb);
                });
                listContainer.appendChild(el);
            });
            return;
        }

        try {
            const listContainer = document.getElementById('history-list');
            const storyboards = await window.firebaseAuthAPI.getUserStoryboards(this.state.user.uid);

            if (storyboards.length === 0) {
                listContainer.innerHTML = '<p class="history-empty" id="history-emptyMsg">No saved storyboards yet.</p>';
                return;
            }

            listContainer.innerHTML = ''; // Clear current list

            storyboards.forEach(sb => {
                const date = sb.createdAt && sb.createdAt.toDate ? sb.createdAt.toDate().toLocaleDateString() : 'Unknown date';
                const el = document.createElement('div');
                el.className = 'history-item';
                el.innerHTML = `
                    <h4>${sb.projectName || 'Untitled'}</h4>
                    <p>${sb.projectGenre || 'Various'} • ${sb.projectLanguage || 'EN'}</p>
                    <p style="font-size:0.7rem; margin-top:4px; opacity:0.6;"><i class="fa-regular fa-calendar"></i> ${date}</p>
                `;

                // Add click listener to open modal with this content
                el.addEventListener('click', () => {
                    this.openHistoryModal(sb);
                });

                listContainer.appendChild(el);
            });

        } catch (error) {
            console.error("Failed to load history UI: ", error);
        }
    },

    async downloadDOCX() {
        try {
            const bodyEl = document.getElementById('history-modal-body');
            const projectName = document.getElementById('history-modal-title').textContent;
            const filename = `${projectName.replace(/\s+/g, '_')}_Storyboard.docx`;

            const doc = new docx.Document({
                sections: [{
                    properties: {},
                    children: [
                        new docx.Paragraph({
                            children: [
                                new docx.TextRun({
                                    text: projectName,
                                    bold: true,
                                    size: 48, // 24pt
                                }),
                            ],
                            spacing: { after: 400 },
                        }),
                        ...Array.from(bodyEl.children).map(el => {
                            return new docx.Paragraph({
                                children: [new docx.TextRun(el.innerText)],
                                spacing: { before: 200, after: 200 },
                                heading: el.tagName === 'H3' ? docx.HeadingLevel.HEADING_2 : undefined
                            });
                        })
                    ],
                }],
            });

            const blob = await docx.Packer.toBlob(doc);
            saveAs(blob, filename);

            this.addChatMessage('info', `✅ Exported via docx.js: ${filename}`);

        } catch (err) {
            console.error("New DOCX export failed:", err);
            alert("Export Error: " + err.message);
        }
    },

    downloadTXT() {
        try {
            const bodyEl = document.getElementById('history-modal-body');
            const projectName = document.getElementById('history-modal-title').textContent;
            const filename = `${projectName.replace(/\s+/g, '_')}_Storyboard.txt`;

            // 1. Convert HTML to formatted plain text
            let plainText = `STORYBOARD: ${projectName.toUpperCase()}\n`;
            plainText += `Generated on: ${new Date().toLocaleString()}\n`;
            plainText += `==========================================\n\n`;

            // Loop through the elements to preserve structure
            const elements = bodyEl.querySelectorAll('h3, p, li');
            elements.forEach(el => {
                if (el.tagName === 'H3') {
                    plainText += `\n[SCENE: ${el.innerText.toUpperCase()}]\n`;
                    plainText += `------------------------------------------\n`;
                } else if (el.tagName === 'LI') {
                    plainText += ` • ${el.innerText}\n`;
                } else {
                    plainText += `${el.innerText}\n`;
                }
            });

            // 2. Create the Blob and trigger download
            const blob = new Blob([plainText], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);

            const a = document.createElement('a');
            a.href = url;
            a.download = filename;
            document.body.appendChild(a);
            a.click();

            // Cleanup
            document.body.removeChild(a);
            URL.revokeObjectURL(url);

            this.addChatMessage('info', `✅ Exported as Text: ${filename}`);

        } catch (err) {
            console.error("Text export failed:", err);
            alert("Failed to export Text file.");
        }
    },

    openHistoryModal(storyboardData) {
        const titleEl = document.getElementById('history-modal-title');
        const bodyEl = document.getElementById('history-modal-body');
        const modal = document.getElementById('history-modal');

        titleEl.textContent = storyboardData.projectName || 'Storyboard';
        bodyEl.innerHTML = storyboardData.htmlContent;

        modal.classList.remove('hidden');
    },

    closeHistoryModal() {
        document.getElementById('history-modal').classList.add('hidden');
        document.getElementById('history-modal-body').innerHTML = '';
    }

    ,

    // ───── Characters Modal ─────
    openCharactersModal() {
        if (!this.state.user) {
            alert("Please login (or continue as guest) to manage characters.");
            return;
        }

        const modal = document.getElementById('characters-modal');
        if (!modal) return;

        // Always start with no selection so the detail panel is hidden until Add/select.
        this.state.selectedCharacterId = null;

        const noteEl = document.getElementById('characters-mode-note');
        if (noteEl) {
            noteEl.textContent = this.state.isGuest
                ? 'Guest mode: characters are stored only for this session and will disappear on refresh.'
                : 'Signed in: characters are saved to your Firebase account.';
        }

        modal.classList.remove('hidden');
        this.loadCharacters();
        this.renderCharactersList();
        this.renderSelectedCharacterToForm();
    },

    closeCharactersModal() {
        const modal = document.getElementById('characters-modal');
        if (!modal) return;
        modal.classList.add('hidden');
    },

    async loadCharacters() {
        if (!this.state.user) return;
        if (this.state.isGuest) return;
        if (!window.firebaseAuthAPI?.getUserCharacters) return;

        try {
            const chars = await window.firebaseAuthAPI.getUserCharacters(this.state.user.uid);
            this.state.characters = Array.isArray(chars) ? chars : [];
            this.renderCharactersList();
            this.renderSelectedCharacterToForm();
        } catch (e) {
            console.error('Failed to load characters:', e);
        }
    },

    renderCharactersList() {
        const listEl = document.getElementById('characters-list');
        if (!listEl) return;

        const chars = this.state.characters || [];
        if (chars.length === 0) {
            listEl.innerHTML = '<p class="history-empty" id="characters-emptyMsg">No characters yet.</p>';
            return;
        }

        listEl.innerHTML = '';
        chars.forEach(ch => {
            const card = document.createElement('button');
            card.type = 'button';
            card.className = 'character-card' + (ch.id === this.state.selectedCharacterId ? ' active' : '');
            const title = (ch.name || 'Untitled').trim() || 'Untitled';
            const meta = (ch.position || '').trim();
            card.innerHTML = `
                <div class="character-card__title">${title}</div>
                <div class="character-card__meta">${meta || '—'}</div>
            `;
            card.addEventListener('click', () => {
                this.state.selectedCharacterId = ch.id;
                this.renderCharactersList();
                this.renderSelectedCharacterToForm();
            });
            listEl.appendChild(card);
        });
    },

    _getSelectedCharacter() {
        const id = this.state.selectedCharacterId;
        if (!id) return null;
        return (this.state.characters || []).find(c => c.id === id) || null;
    },

    renderSelectedCharacterToForm() {
        const ch = this._getSelectedCharacter();

        const placeholderEl = document.getElementById('characters-detail-placeholder');
        const formWrapEl = document.getElementById('characters-form-wrapper');
        if (placeholderEl && formWrapEl) {
            if (!ch) {
                placeholderEl.classList.remove('hidden');
                formWrapEl.classList.add('hidden');
            } else {
                placeholderEl.classList.add('hidden');
                formWrapEl.classList.remove('hidden');
            }
        }

        const setVal = (id, val) => {
            const el = document.getElementById(id);
            if (!el) return;
            el.value = val || '';
        };

        setVal('char-name', ch?.name);
        setVal('char-sex', ch?.sex);
        setVal('char-age', ch?.age);
        setVal('char-traits', ch?.traits);
        setVal('char-background', ch?.background);
        setVal('char-position', ch?.position);

        const delBtn = document.getElementById('btn-character-delete');
        if (delBtn) delBtn.disabled = !ch;
    },

    addNewCharacter() {
        if (!this.state.user) return;
        const tempId = 'temp-' + Date.now();
        const newCh = {
            id: tempId,
            userId: this.state.isGuest ? 'guest' : this.state.user.uid,
            name: '',
            sex: '',
            age: '',
            traits: '',
            background: '',
            position: '',
            _temp: true,
            createdAt: new Date()
        };

        this.state.characters = [newCh, ...(this.state.characters || [])];
        this.state.selectedCharacterId = tempId;
        this.renderCharactersList();
        this.renderSelectedCharacterToForm();

        setTimeout(() => document.getElementById('char-name')?.focus(), 10);
    },

    _readCharacterForm() {
        const getVal = (id) => (document.getElementById(id)?.value || '').trim();
        return {
            name: getVal('char-name'),
            sex: getVal('char-sex'),
            age: getVal('char-age'),
            traits: getVal('char-traits'),
            background: getVal('char-background'),
            position: getVal('char-position')
        };
    },

    async saveCharacterFromModal() {
        if (!this.state.user) return;

        const ch = this._getSelectedCharacter();
        const form = this._readCharacterForm();
        if (!form.name) {
            this.showError('char-name', 'Please enter a character name.');
            return;
        }

        // Guest mode: in-memory only
        if (this.state.isGuest) {
            const id = ch?.id || ('guest-' + Date.now());
            const merged = { ...(ch || {}), id, ...form, updatedAt: new Date() };
            this.state.characters = (this.state.characters || []).map(c => c.id === id ? merged : c);
            if (!ch) this.state.characters.unshift(merged);
            this.state.selectedCharacterId = id;
            this.renderCharactersList();
            this.renderSelectedCharacterToForm();
            this.addChatMessage('info', 'Saved character (guest mode). This will disappear on refresh.');
            return;
        }

        if (!window.firebaseAuthAPI?.saveCharacter) {
            alert("Characters service is still loading...");
            return;
        }

        const btn = document.getElementById('btn-character-save');
        const original = btn?.innerHTML;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Saving...';
        }

        try {
            const saveId = await window.firebaseAuthAPI.saveCharacter(this.state.user.uid, {
                id: ch && !ch._temp ? ch.id : undefined,
                ...form
            });

            const merged = { ...(ch || {}), id: saveId, ...form, _temp: false, updatedAt: new Date() };
            // Replace temp entry if present; otherwise upsert
            const existingIdx = (this.state.characters || []).findIndex(c => c.id === (ch?.id));
            if (existingIdx >= 0) {
                const copy = [...this.state.characters];
                copy[existingIdx] = merged;
                this.state.characters = copy;
            } else {
                this.state.characters = [merged, ...(this.state.characters || [])];
            }
            // If it was temp, remove any other temp with same old id
            this.state.characters = (this.state.characters || []).filter(c => c.id !== (ch?._temp ? ch.id : null) || c.id === saveId);

            this.state.selectedCharacterId = saveId;
            this.renderCharactersList();
            this.renderSelectedCharacterToForm();
        } catch (e) {
            alert("Failed to save character: " + (e?.message || e));
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = original;
            }
        }
    },

    async deleteCharacterFromModal() {
        if (!this.state.user) return;
        const ch = this._getSelectedCharacter();
        if (!ch) return;

        const ok = confirm(`Delete character "${(ch.name || 'Untitled').trim() || 'Untitled'}"?`);
        if (!ok) return;

        // Guest mode: in-memory only
        if (this.state.isGuest) {
            this.state.characters = (this.state.characters || []).filter(c => c.id !== ch.id);
            this.state.selectedCharacterId = this.state.characters[0]?.id || null;
            this.renderCharactersList();
            this.renderSelectedCharacterToForm();
            return;
        }

        if (!window.firebaseAuthAPI?.deleteCharacter) {
            alert("Characters service is still loading...");
            return;
        }

        const btn = document.getElementById('btn-character-delete');
        const original = btn?.innerHTML;
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Deleting...';
        }

        try {
            // If it's still a temp (never saved), just remove locally
            if (ch._temp) {
                this.state.characters = (this.state.characters || []).filter(c => c.id !== ch.id);
            } else {
                await window.firebaseAuthAPI.deleteCharacter(ch.id);
                this.state.characters = (this.state.characters || []).filter(c => c.id !== ch.id);
            }
            // After delete, no auto-select; keep the detail panel hidden until user selects/adds.
            this.state.selectedCharacterId = null;
            this.renderCharactersList();
            this.renderSelectedCharacterToForm();
        } catch (e) {
            alert("Failed to delete character: " + (e?.message || e));
        } finally {
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = original;
            }
        }
    }
};

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    app.init();
});
