// js/gemini.js

const geminiAPI = {
    API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',

    // Read the API key entered by the user on the home screen
    getApiKey() {
        const key = document.getElementById('api-key-input')?.value.trim();
        if (!key) throw new Error('Please enter your Google Gemini API key on the home screen before generating.');
        return key;
    },

    async generateStoryboard(projectData, characters = []) {
        const { name, description, synopsis, type, duration, genre, language } = projectData;
        const langInstruction = language ? `IMPORTANT: Write ALL content (scene titles, descriptions, dialogue, labels, and narrative text) entirely in ${language}. Do not use any other language.` : '';

        const masterListContext = `CHARACTER PROFILES (Master List):
${characters && characters.length > 0 ? characters.map(c => `- ${c.name}: [Gender: ${c.sex || 'N/A'}, Age: ${c.age || 'N/A'}, Position: ${c.position || 'N/A'}, Traits: ${c.traits || 'N/A'}] Background: ${c.background || 'No background info'}`).join('\n') : "No master characters defined yet."}`;

        const prompt = `
You are a professional storyboard artist and film director. 
Create a detailed, shot-by-shot draft storyboard for a new project based on the following parameters:

- Project Name: ${name}
- Type: ${type}
- Duration (Estimated length of final content): ${duration}
- Genre/Mood: ${genre}
- Synopsis / Brief Description: ${(synopsis || description) || "No specific concept provided, invent a creative storyline."}
- Output Language: ${language || 'English'}

${masterListContext}

${langInstruction}

TASK:
1. Create a detailed storyboard.
2. CHARACTER LOGIC:
   - Use characters from the "CHARACTER PROFILES (Master List)" if available.
   - If the master list is empty, you may invent your own characters.
3. Format the output as clean HTML that can be directly inserted into an editable div.
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
                    },
                    safetySettings: [
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                    ]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!data.candidates || data.candidates.length === 0) {
                console.error("Gemini API Error: No candidates returned.", data);
                const reason = data.promptFeedback?.blockReason || "Content Filtered/Safety Block";
                throw new Error(`AI was unable to generate a response. (Reason: ${reason})`);
            }

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

    async modifyStoryboard(sceneHtml, scriptHtml, middleData, userMessage, projectData, characters = [], target = 'chat') {
        const language = projectData?.language;
        const langInstruction = language ? `IMPORTANT: Write ALL your response content in ${language}. This includes the storyboard HTML and your chat reply.` : '';

        const projectContext = projectData ? `
PROJECT CONTEXT (User selections):
- Project Name: ${projectData.name || "Not specified"}
- Synopsis: ${projectData.synopsis || projectData.description || "Not specified"}
- Type: ${projectData.type || "Not specified"}
- Duration: ${projectData.duration || "Not specified"}
- Genre/Mood: ${projectData.genre || "Not specified"}
- Output Language: ${projectData.language || "English"}
` : '';

        const masterListContext = `CHARACTER PROFILES (Master List):
${characters && characters.length > 0 ? characters.map(c => `- ${c.name}: [Gender: ${c.sex || 'N/A'}, Age: ${c.age || 'N/A'}, Position: ${c.position || 'N/A'}, Traits: ${c.traits || 'N/A'}] Background: ${c.background || 'No background info'}`).join('\n') : "No master characters defined yet."}`;

        const sceneParamsContext = `SCENE-SPECIFIC PARAMETERS:
- Timing: ${middleData.time || "Not specified"}
- Location: ${middleData.location || "Not specified"}
- Scene Character(s): ${middleData.character || "Not specified"}
- Duration: ${middleData.duration || "Not specified"}
- Vibe / Atmosphere: ${middleData.vibe || "Not specified"}`;

        let targetInstruction = "";
        if (target === 'scene') {
            targetInstruction = "The user explicitly wants to UPDATE THE SCENE section. Focus your changes there.";
        } else if (target === 'script') {
            targetInstruction = "The user explicitly wants to UPDATE THE SCRIPT section. Focus your changes there.";
        } else {
            targetInstruction = "This is a general conversation. You can update either section if relevant, or just reply.";
        }

        const prompt = `
You are a professional storyboard artist and film director. 
You are collaborating with a user to refine a storyboard draft. 

${langInstruction}
${projectContext}

${masterListContext}

${sceneParamsContext}

TARGET ACTION: ${targetInstruction}

CURRENT SCENE DRAFT (HTML):
${sceneHtml || "Empty"}

CURRENT SCRIPT DRAFT (HTML):
${scriptHtml || "Empty"}

USER'S MESSAGE:
"${userMessage}"

TASK:
1. Update the Scene and/or Script sections based on the user's message and the TARGET ACTION.
2. CHARACTER LOGIC:
   - Carefully check "Scene Character(s)" in SCENE-SPECIFIC PARAMETERS. 
   - FOR EACH NAME entered in "Scene Character(s)": Match it with a name in "CHARACTER PROFILES (Master List)".
   - If a name MATCHES: You MUST fetch and use ALL available information (Sex, Age, Position, Traits, Background, Position in the Show) from the Master List for that character in your response.
   - If a name DOES NOT match: Treat it as a new character and define their details yourself.
   - If "Scene Character(s)" is empty: Pick one or more relevant characters from the "CHARACTER PROFILES (Master List)".
   - If both are empty: You may invent characters as needed for the story.
3. If updating Scene, use <h3> for scene titles, <p> for descriptions, and <ul> for details.
4. If updating Script, use professional screenplay format (Character names in bold/caps, dialogue, parentheticals).
5. You must output exactly THREE parts, separated by the delimiter "|||---|||". 
   - Part 1: A brief, friendly conversational response to the user.
   - Part 2: ONLY the NEW or ADDED HTML content for the SCENE section. Do not include previous scenes unless they were modified.
   - Part 3: The FULL updated HTML for the SCRIPT section.

Do not use markdown code block wrappers for the HTML parts.
`;

        try {
            const apiKey = await this.getApiKey();
            const response = await fetch(`${this.API_URL}?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.7, topK: 40, topP: 0.95 },
                    safetySettings: [
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                    ]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!data.candidates || data.candidates.length === 0) {
                console.error("Gemini API Error (Modify): No candidates returned.", data);
                const reason = data.promptFeedback?.blockReason || "Content Filtered/Safety Block";
                throw new Error(`AI was unable to process your request. (Reason: ${reason})`);
            }

            let textResponse = data.candidates[0].content.parts[0].text;

            const parts = textResponse.split('|||---|||');

            let chatReply = "I've processed your request!";
            let newSceneHtml = sceneHtml;
            let newScriptHtml = scriptHtml;

            if (parts.length >= 3) {
                chatReply = parts[0].trim();
                newSceneHtml = parts[1].trim();
                newScriptHtml = parts[2].trim();
            } else if (parts.length === 2) {
                chatReply = parts[0].trim();
                newSceneHtml = parts[1].trim();
            }

            const clean = (h) => h.replace(/^```html\n/, '').replace(/\n```$/, '').replace(/^```\n/, '').replace(/\n```$/, '');
            newSceneHtml = clean(newSceneHtml);
            newScriptHtml = clean(newScriptHtml);

            return { chatReply, newSceneHtml, newScriptHtml };

        } catch (error) {
            console.error("Gemini API Error (Modify):", error);
            throw error;
        }
    },

    async ingestFileContext(label, fileText, sceneHtml, scriptHtml, middleData, projectData, characters = []) {
        const language = projectData?.language;
        const langInstruction = language ? `IMPORTANT: Write ALL your response content in ${language}. This includes the updated storyboard HTML and your chat reply.` : '';

        const projectContext = projectData ? `
PROJECT CONTEXT (User selections):
- Project Name: ${projectData.name || "Not specified"}
- Synopsis: ${projectData.synopsis || projectData.description || "Not specified"}
- Type: ${projectData.type || "Not specified"}
- Duration: ${projectData.duration || "Not specified"}
- Genre/Mood: ${projectData.genre || "Not specified"}
- Output Language: ${projectData.language || "English"}
` : '';

        const masterListContext = `CHARACTER PROFILES (Master List):
${characters && characters.length > 0 ? characters.map(c => `- ${c.name}: [Gender: ${c.sex || 'N/A'}, Age: ${c.age || 'N/A'}, Position: ${c.position || 'N/A'}, Traits: ${c.traits || 'N/A'}] Background: ${c.background || 'No background info'}`).join('\n') : "No master characters defined yet."}`;

        const sceneParamsContext = `SCENE-SPECIFIC PARAMETERS:
- Timing: ${middleData.time || "Not specified"}
- Location: ${middleData.location || "Not specified"}
- Scene Character(s): ${middleData.character || "Not specified"}
- Duration: ${middleData.duration || "Not specified"}
- Vibe / Atmosphere: ${middleData.vibe || "Not specified"}`;

        const prompt = `
You are a professional storyboard artist and film director.
You are collaborating with a user to refine a storyboard. The user has just uploaded a reference document.
${langInstruction}

${projectContext}

${masterListContext}

${sceneParamsContext}

REFERENCE DOCUMENT TYPE: ${label}
REFERENCE DOCUMENT CONTENT:
---
${fileText}
---

CURRENT SCENE DRAFT (HTML):
${sceneHtml || "Empty"}

CURRENT SCRIPT DRAFT (HTML):
${scriptHtml || "Empty"}

TASK:
1. Carefully read the REFERENCE DOCUMENT and use it to improve or refine the CURRENT SCENE and SCRIPT DRAFTs.
2. CHARACTER LOGIC:
   - Carefully check "Scene Character(s)" in SCENE-SPECIFIC PARAMETERS. 
   - FOR EACH NAME entered in "Scene Character(s)": Match it with a name in "CHARACTER PROFILES (Master List)".
   - If a name MATCHES: You MUST fetch and use ALL available information (Gender, Sex, Position, Traits, Background, Position in the Show) from the Master List for that character in your response.
   - If a name DOES NOT match: Treat it as a new character and define their details yourself.
   - If "Scene Character(s)" is empty: Pick one or more relevant characters from the "CHARACTER PROFILES (Master List)".
   - If both are empty: You may invent characters as needed for the story.
3. Keep the overall HTML structure for Scene (using <h3>, <p>, <ul>) and Script (Character names, dialogue).
4. Output exactly THREE parts, separated by the delimiter "|||---|||". 
   - Part 1: A brief, friendly chat message summarising what you changed.
   - Part 2: ONLY the NEW or ADDED HTML content for the SCENE section. Do not include previous scenes unless they were modified.
   - Part 3: The FULL updated HTML for the SCRIPT section.

Do not use markdown code block wrappers for the HTML parts.
`;

        try {
            const apiKey = await this.getApiKey();
            const response = await fetch(`${this.API_URL}?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.65, topK: 40, topP: 0.95 },
                    safetySettings: [
                        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_NONE' },
                        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' }
                    ]
                })
            });

            if (!response.ok) {
                const errorData = await response.json();
                throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();

            if (!data.candidates || data.candidates.length === 0) {
                console.error("Gemini API Error (Ingest): No candidates returned.", data);
                const reason = data.promptFeedback?.blockReason || "Content Filtered/Safety Block";
                throw new Error(`AI was unable to process the file context. (Reason: ${reason})`);
            }

            let textResponse = data.candidates[0].content.parts[0].text;

            const parts = textResponse.split('|||---|||');

            let chatReply = `I've applied your ${label} to the storyboard!`;
            let newSceneHtml = sceneHtml;
            let newScriptHtml = scriptHtml;

            if (parts.length >= 3) {
                chatReply = parts[0].trim();
                newSceneHtml = parts[1].trim();
                newScriptHtml = parts[2].trim();
            } else if (parts.length === 2) {
                chatReply = parts[0].trim();
                newSceneHtml = parts[1].trim();
            }

            const clean = (h) => h.replace(/^```html\n/, '').replace(/\n```$/, '').replace(/^```\n/, '').replace(/\n```$/, '');
            newSceneHtml = clean(newSceneHtml);
            newScriptHtml = clean(newScriptHtml);

            return { chatReply, newSceneHtml, newScriptHtml };

        } catch (error) {
            console.error("Gemini API Error (Ingest):", error);
            throw error;
        }
    }
};
