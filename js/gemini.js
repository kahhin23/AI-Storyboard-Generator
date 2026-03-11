// js/gemini.js

const geminiAPI = {
    API_URL: 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent',

    // Read the API key entered by the user on the home screen
    getApiKey() {
        const key = document.getElementById('api-key-input')?.value.trim();
        if (!key) throw new Error('Please enter your Google Gemini API key on the home screen before generating.');
        return key;
    },


    async generateStoryboard(projectData) {
        const { name, description, type, duration, genre, language } = projectData;
        const langInstruction = language ? `IMPORTANT: Write ALL content (scene titles, descriptions, dialogue, labels, and narrative text) entirely in ${language}. Do not use any other language.` : '';

        // Construct the prompt requesting a readable storyboard output in HTML format
        const prompt = `
You are a professional storyboard artist and film director. 
Create a detailed, shot-by-shot draft storyboard for a new project based on the following parameters:

- Project Name: ${name}
- Type: ${type}
- Duration (Estimated length of final content): ${duration}
- Genre/Mood: ${genre}
- Brief Description/Concept: ${description || "No specific concept provided, invent a creative storyline."}
- Output Language: ${language || 'English'}

${langInstruction}

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

                // ← Key debug logs
                console.error("=== GEMINI API ERROR FULL DETAILS ===");
                console.error("Status:", response.status);
                console.error("Error JSON:", JSON.stringify(errorData, null, 2));

                // Detect free tier specifically (works for 429)
                if (response.status === 429) {
                    const errorMsg = errorData.error?.message || '';
                    const details = errorData.error?.details || [];

                    const isLikelyFreeTier =
                        errorMsg.toLowerCase().includes('free tier') ||
                        details.some(d =>
                            (d.metadata?.quota_metric || '').includes('free_tier') ||
                            (d.metadata?.quota_limit || '').includes('free_tier') ||
                            (d.metadata?.quota_limit_value === '0' && (d.metadata?.quota_metric || '').includes('free'))
                        );

                    if (isLikelyFreeTier) {
                        console.warn("→ STRONG INDICATOR: This is FREE TIER quota exceeded (look for 'free_tier_requests' in quota_metric)");
                    } else {
                        console.warn("→ This looks like PAID TIER or different limit (no 'free_tier' metric found)");
                    }
                }

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

    async modifyStoryboard(currentHtml, middleData, userMessage, projectData) {
        const language = projectData?.language;
        const langInstruction = language ? `IMPORTANT: Write ALL your response content in ${language}. This includes the storyboard HTML and your chat reply.` : '';
        const projectContext = projectData ? `
PROJECT CONTEXT (User selections):
- Project Name: ${projectData.name || "Not specified"}
- Type: ${projectData.type || "Not specified"}
- Duration: ${projectData.duration || "Not specified"}
- Genre/Mood: ${projectData.genre || "Not specified"}
- Output Language: ${projectData.language || "English"}
` : '';
        // Construct a prompt that includes the current storyboard, the data in the middle column, and the user's instructions
        const prompt = `
You are a professional storyboard artist and film director. 
You are collaborating with a user to refine a storyboard draft. 
${langInstruction}

${projectContext}

CURRENT STORYBOARD DRAFT (HTML):
${currentHtml}

CURRENT SCENE PARAMETERS (From the Editor):
- Timing: ${middleData.time || "Not specified"}
- Location: ${middleData.location || "Not specified"}
- Character(s): ${middleData.character || "Not specified"}
- Duration: ${middleData.duration || "Not specified"}
- Vibe / Atmosphere: ${middleData.vibe || "Not specified"}

USER'S INSTRUCTION / CHAT MESSAGE:
"${userMessage}"

TASK:
1. Update the CURRENT STORYBOARD DRAFT to reflect the user's instructions. Keep the overall HTML structure identical (using <h3>, <p>, <ul>).
2. Incorporate the CURRENT SCENE PARAMETERS into the text or structure where they naturally fit, especially if the user asks you to apply them.
3. You must output exactly TWO things, separated by a unique delimiter "|||---|||". 
   - First part: A conversational response to the user's chat message (plain text, friendly, brief). Write this reply in ${language || 'English'}.
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

                // ← Key debug logs
                console.error("=== GEMINI API ERROR FULL DETAILS ===");
                console.error("Status:", response.status);
                console.error("Error JSON:", JSON.stringify(errorData, null, 2));

                // Detect free tier specifically (works for 429)
                if (response.status === 429) {
                    const errorMsg = errorData.error?.message || '';
                    const details = errorData.error?.details || [];

                    const isLikelyFreeTier =
                        errorMsg.toLowerCase().includes('free tier') ||
                        details.some(d =>
                            (d.metadata?.quota_metric || '').includes('free_tier') ||
                            (d.metadata?.quota_limit || '').includes('free_tier') ||
                            (d.metadata?.quota_limit_value === '0' && (d.metadata?.quota_metric || '').includes('free'))
                        );

                    if (isLikelyFreeTier) {
                        console.warn("→ STRONG INDICATOR: This is FREE TIER quota exceeded (look for 'free_tier_requests' in quota_metric)");
                    } else {
                        console.warn("→ This looks like PAID TIER or different limit (no 'free_tier' metric found)");
                    }
                }

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
    },

    async ingestFileContext(label, fileText, currentHtml, middleData, projectData) {
        const language = projectData?.language;
        const langInstruction = language ? `IMPORTANT: Write ALL your response content in ${language}. This includes the updated storyboard HTML and your chat reply.` : '';
        const projectContext = projectData ? `
PROJECT CONTEXT (User selections):
- Project Name: ${projectData.name || "Not specified"}
- Type: ${projectData.type || "Not specified"}
- Duration: ${projectData.duration || "Not specified"}
- Genre/Mood: ${projectData.genre || "Not specified"}
- Output Language: ${projectData.language || "English"}
` : '';
        const prompt = `
You are a professional storyboard artist and film director.
You are collaborating with a user to refine a storyboard. The user has just uploaded a reference document.
${langInstruction}

${projectContext}

REFERENCE DOCUMENT TYPE: ${label}
REFERENCE DOCUMENT CONTENT:
---
${fileText}
---

CURRENT STORYBOARD DRAFT (HTML):
${currentHtml}

CURRENT SCENE PARAMETERS:
- Timing: ${middleData.time || "Not specified"}
- Location: ${middleData.location || "Not specified"}
- Character(s): ${middleData.character || "Not specified"}
- Duration: ${middleData.duration || "Not specified"}
- Vibe / Atmosphere: ${middleData.vibe || "Not specified"}

TASK:
1. Carefully read the REFERENCE DOCUMENT and use it to improve or refine the CURRENT STORYBOARD DRAFT.
   - If it is a Character Sheet: update character names, traits, and roles throughout the storyboard.
   - If it is World Building: update location details, atmosphere, and setting descriptions.
   - If it is a Plot Outline / Synopsis: realign the scene flow and narrative arc to match.
   - If it is a Timeline: adjust scene order and pacing to match the given timeline.
2. Keep the overall HTML structure identical (using <h3>, <p>, <ul>).
3. Output exactly TWO things separated by the delimiter "|||---|||":
   - First part: A brief, friendly chat message summarising what you changed. Write in ${language || 'English'}.
   - Second part: The fully updated storyboard HTML. Do not use markdown code block wrappers.

Example:
I've applied your character sheet! I updated all character names and added backstory details to Scene 1 and Scene 3.
|||---|||
<h3>Scene 1</h3>...
`;

        try {
            const apiKey = await this.getApiKey();
            const response = await fetch(`${this.API_URL}?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    generationConfig: { temperature: 0.65, topK: 40, topP: 0.95 }
                })
            });

            if (!response.ok) {
                const errorData = await response.json();

                // ← Key debug logs
                console.error("=== GEMINI API ERROR FULL DETAILS ===");
                console.error("Status:", response.status);
                console.error("Error JSON:", JSON.stringify(errorData, null, 2));

                // Detect free tier specifically (works for 429)
                if (response.status === 429) {
                    const errorMsg = errorData.error?.message || '';
                    const details = errorData.error?.details || [];

                    const isLikelyFreeTier =
                        errorMsg.toLowerCase().includes('free tier') ||
                        details.some(d =>
                            (d.metadata?.quota_metric || '').includes('free_tier') ||
                            (d.metadata?.quota_limit || '').includes('free_tier') ||
                            (d.metadata?.quota_limit_value === '0' && (d.metadata?.quota_metric || '').includes('free'))
                        );

                    if (isLikelyFreeTier) {
                        console.warn("→ STRONG INDICATOR: This is FREE TIER quota exceeded (look for 'free_tier_requests' in quota_metric)");
                    } else {
                        console.warn("→ This looks like PAID TIER or different limit (no 'free_tier' metric found)");
                    }
                }

                throw new Error(errorData.error?.message || `HTTP error! status: ${response.status}`);
            }

            const data = await response.json();
            let textResponse = data.candidates[0].content.parts[0].text;

            const parts = textResponse.split('|||---|||');
            let chatReply = `I've applied your ${label} to the storyboard!`;
            let newHtml = textResponse;

            if (parts.length >= 2) {
                chatReply = parts[0].trim();
                newHtml = parts.slice(1).join('|||---|||').trim();
            }

            newHtml = newHtml.replace(/^```html\n/, '').replace(/\n```$/, '');
            newHtml = newHtml.replace(/^```\n/, '').replace(/\n```$/, '');

            return { chatReply, newHtml };

        } catch (error) {
            console.error("Gemini API Error (Ingest):", error);
            throw error;
        }
    }
};
