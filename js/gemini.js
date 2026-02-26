// js/gemini.js

const geminiAPI = {
    // API key is loaded lazily from 'API Key.csv' on first use
    _apiKey: null,
    API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-pro:generateContent',

    // Fetch and cache the API key from the CSV file
    async getApiKey() {
        if (this._apiKey) return this._apiKey;
        try {
            const response = await fetch('API Key.csv');
            if (!response.ok) throw new Error(`Could not load API Key.csv (status ${response.status})`);
            const text = await response.text();
            // Use the first non-empty line as the key
            const key = text.split('\n').map(l => l.trim()).find(l => l.length > 0);
            if (!key) throw new Error('API Key.csv is empty or has no valid key.');
            this._apiKey = key;
            return this._apiKey;
        } catch (err) {
            console.error('Failed to load API key:', err);
            throw new Error('Could not load the API key from "API Key.csv". Make sure the file exists in the project root.');
        }
    },

    async generateStoryboard(projectData) {
        const { name, description, type, duration, genre } = projectData;

        // Construct the prompt requesting a readable storyboard output in HTML format
        const prompt = `
You are a professional storyboard artist and film director. 
Create a detailed, shot-by-shot draft storyboard for a new project based on the following parameters:

- Project Name: ${name}
- Type: ${type}
- Duration (Estimated length of final content): ${duration}
- Genre/Mood: ${genre}
- Brief Description/Concept: ${description || "No specific concept provided, invent a creative storyline."}

Please format the output as clean HTML that can be directly inserted into an editable div.
Use <h3> for scene titles, <p> for descriptions, and <ul> for lists of details (like Audio, Characters, Action).
Make it inspiring and ready for the user to edit directly in the browser. Do not include markdown code block wrappers like \`\`\`html.
`;

        try {
            const apiKey = await this.getApiKey();
            const response = await fetch(`${this.API_URL}?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("API Error Response:", errorData);
                throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            // Extract the generated text
            let textResponse = data.candidates[0].content.parts[0].text;

            // Clean up if it still included markdown wrappers
            textResponse = textResponse.replace(/^```html\n/, '').replace(/\n```$/, '');
            textResponse = textResponse.replace(/^```\n/, '').replace(/\n```$/, '');

            return textResponse;

        } catch (error) {
            console.error("Gemini API Error:", error);
            throw error;
        }
    },

    async modifyStoryboard(currentHtml, middleData, userMessage) {
        // Construct a prompt that includes the current storyboard, the data in the middle column, and the user's instructions
        const prompt = `
You are a professional storyboard artist and film director. 
You are collaborating with a user to refine a storyboard draft. 

CURRENT STORYBOARD DRAFT (HTML):
${currentHtml}

CURRENT SCENE PARAMETERS (From the Editor):
- Time: ${middleData.time || "Not specified"}
- Location: ${middleData.location || "Not specified"}
- Character(s): ${middleData.character || "Not specified"}
- Key Items: ${middleData.items || "Not specified"}
- Duration: ${middleData.duration || "Not specified"}
- Special Vibe: ${middleData.vibe || "Not specified"}

USER'S INSTRUCTION / CHAT MESSAGE:
"${userMessage}"

TASK:
1. Update the CURRENT STORYBOARD DRAFT to reflect the user's instructions. Keep the overall HTML structure identical (using <h3>, <p>, <ul>).
2. Incorporate the CURRENT SCENE PARAMETERS into the text or structure where they naturally fit, especially if the user asks you to apply them.
3. You must output exactly TWO things, separated by a unique delimiter "|||---|||". 
   - First part: A conversational response to the user's chat message (plain text, friendly, brief).
   - Second part: The fully updated HTML for the storyboard. Do not wrap this second part in markdown code blocks.

Example Output format:
Sure! I have updated the scene to include the magical sword in the forest. You will see it in Scene 2 now.
|||---|||
<h3>Scene 1</h3>...
`;

        try {
            const apiKey = await this.getApiKey();
            const response = await fetch(`${this.API_URL}?key=${apiKey}`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{
                            text: prompt
                        }]
                    }],
                    generationConfig: {
                        temperature: 0.7,
                        topK: 40,
                        topP: 0.95,
                    }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                console.error("API Error Response:", errorData);
                throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            let textResponse = data.candidates[0].content.parts[0].text;

            // Split by delimiter
            const parts = textResponse.split('|||---|||');

            let chatReply = "I've updated the storyboard based on your request!";
            let newHtml = textResponse; // fallback if delimiter fails

            if (parts.length >= 2) {
                chatReply = parts[0].trim();
                newHtml = parts.slice(1).join('|||---|||').trim();
            }

            // Clean up any stray markdown wrappers just in case
            newHtml = newHtml.replace(/^```html\n/, '').replace(/\n```$/, '');
            newHtml = newHtml.replace(/^```\n/, '').replace(/\n```$/, '');

            return { chatReply, newHtml };

        } catch (error) {
            console.error("Gemini API Error (Modify):", error);
            throw error;
        }
    }
};
