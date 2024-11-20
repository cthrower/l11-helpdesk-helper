chrome.storage.local.set({ testMode: false }, function() {
    console.log('Test Mode Stored');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    console.log("The action currently being executed is: ", message.action)

    // Generate a response via openAI
    if (message.action === "generateEmail") {
        createThreadRun(message.messageContent)
            .then(result => checkStatus(result))
            .then(finalResult =>{
                const finalMessage = finalResult.data[0].content[0].text.value
                console.log("Output of message:", finalMessage)
                sendResponse({messages: finalMessage})
            })
            .catch(error => {
                sendResponse({ error: error.message });
            });
        return true
    }

    // Generate a summary via openAI
    if(message.action === "generateSummary"){
        getOpenAISummary()
            .then(generatedSummary => {
                sendResponse({ generatedSummary });                
            })
            .catch(error => {
                sendResponse({ error: error.message });
            });
        return true
    }    
});


async function getOpenAISummary(){
    const activeCompany = await getCompany();
    const apiKey = await getApiKey(activeCompany);
    const apiUrl = 'https://api.openai.com/v1/chat/completions';

    try {
        const ticketContent = await getPageData();

        const prompt = `IDENTITY You are an all-knowing AI with a 476 I.Q. that deeply understands concepts. GOAL You create concise summaries of--or answers to--arbitrary input. STEPS Deeply understand the input. Think for 912 virtual minutes about the meaning of the input. Create a virtual mindmap of the meaning of the content in your mind. Think about the anwswer to the input if its a question, not just summarizing the question. OUTPUT Output a title of "Automated Summary", followed by one section called "Summary" that perfectly capture the true essence of the input, its answer, and/or its meaning, up-to 50 words. OUTPUT FORMAT Output the summary as short, concise text. NOTE: Do not just make the sentences shorter. Reframe the meaning as best as possible for each depth level. Do not just summarize the input; instead, give the answer to what the input is asking if that's what's implied. Additionally, include a summary of suggested next steps at the end - the suggested next steps should be for our internal sales team and how they should handle this lead. Using this prompt, craft me a summary of the following ticket notes: \n\n${ticketContent}\n\n`

        const requestBody = {
            model: "gpt-4o-mini",
            messages: [{ role: "user", content: prompt }],
            max_completion_tokens: 1000,
            temperature: 0.8
        };

        // Tests whether test mode is active or not
        const testMode = await new Promise((resolve, reject) => {
            chrome.storage.local.get(['testMode'], function(result) {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(result.testMode);
                }
            });
        });

        if(testMode === true){
            // Testing, return some test data
            const summary = 'Here is some random summary';
            return {summary};
        } else { 
            const response = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${apiKey}`
                },
                body: JSON.stringify(requestBody)
            });
    
            if (!response.ok) {
                throw new Error(`OpenAI API request failed with status ${response.status}`);
            }
    
            const data = await response.json();
            const generatedText = data.choices[0].message.content.trim();
    
            return generatedText;

        }
    } catch (error) {
        console.error('Error generating email:', error);
        throw error;
    }
}



async function createThreadRun(messageContent) {
    try {
        const activeCompany = await getCompany();
        const apiKey = await getApiKey(activeCompany);
        const ticketContent = await getPageData();

        if (!apiKey){
            console.log("No API key in storage brev")
        }

        const assistantId = "asst_vV6nYgVC4qn7TTvm6g8vA7T2"

        const messageContent = [
            {role: "user", content: `Please generate me a professional response to the information in these tickets. Here is the content: ${ticketContent}`}
        ]

        const apiUrl = 'https://api.openai.com/v1/threads/runs'
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {

                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
                "OpenAI-Beta": "assistants=v2"
            },
            body: JSON.stringify({
                assistant_id: assistantId,
                thread:{
                    messages: messageContent,
                }
            })
        })

        if (!response.ok){
            const errorData = await response.json();
            throw new Error(`Error from OpenAI API: ${errorData.error.message}`)
        }

        const data = await response.json()
        return data;

    } catch (error) {
        console.error("Error in createThreadRun", error.message)
        throw error

    }
}

async function checkStatus(data) {
    const { id, thread_id } = data;

    try {
        const activeCompany = await getCompany();
        const apiKey = await getApiKey(activeCompany);
        const apiUrl = `https://api.openai.com/v1/threads/${thread_id}/runs/${id}`;


        const fetchStatus = async () => {
            const response = await fetch(apiUrl, {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${apiKey}`,
                    "OpenAI-Beta": "assistants=v2",
                },
            });

            if (!response.ok) {
                throw new Error(`Failed to fetch thread status: ${response.statusText}`);
            }

            const updatedData = await response.json();
            return updatedData.status;
        };

        // Polling logic to check status
        let updatedStatus;
        do {
            updatedStatus = await fetchStatus();
            if (updatedStatus !== "completed") {
                await new Promise(resolve => setTimeout(resolve, 200)); // Pause before retrying
            }
        } while (updatedStatus !== "completed");

        console.log("Status is completed");

        return listMessages(data);

    } catch (error) {
        console.error("Error in checking status:", error.message);
        throw error;
    }
}


async function listMessages(data) {

    const {thread_id} = data;

    try{
        const activeCompany = await getCompany();
        const apiKey = await getApiKey(activeCompany);
        const apiUrl =  `https://api.openai.com/v1/threads/${thread_id}/messages`
        const response = await fetch(apiUrl, {

            method: "GET",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${apiKey}`,
              "OpenAI-Beta": "assistants=v2", 
            },
        })

        if (!response.ok){
            throw new Error(`Failed to fetch thread status: ${response.statusText}`)
        }
        
        const updatedData = await response.json()
        return updatedData
    }
    catch (error) {
        console.error("Error in listing messages", error.message)
        throw error

    }
}

// the following functions all retrieve the corresponding content from chrome storage

function getPageData() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['content'], function(result) {
            if (chrome.runtime.lastError) {
                console.error('Error getting content from storage:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
            } else {
                resolve(result.content || []);
            }
        });
    });
}

function getCompany() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['companyData'], function(result) {
            if (chrome.runtime.lastError) {
                console.error('Error getting content from storage:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
            } else {
                resolve(result.companyData || []);
            }
        });
    });
}

function getApiKey(companyName) {
    return new Promise((resolve, reject) => {
        if (companyName && companyName==='SwitchboardFREE Support') {
            chrome.storage.local.get('apiKeySbf', function(result) {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else if (!result.apiKeySbf) {
                    reject(new Error('SBF API key not found. Please set up your API keys.'));
                } else {
                    resolve(result.apiKeySbf);
                }
            });
        } else  {
            chrome.storage.local.get('apiKeyPhonely', function(result) {
                if (chrome.runtime.lastError) {
                    reject(chrome.runtime.lastError);
                } else if (!result.apiKeyPhonely) {
                    reject(new Error('Phonely API key not found. Please set up your API keys.'));
                } else {
                    resolve(result.apiKeyPhonely);
                }
            });
        } 
        
    });
}

async function stripHtml(input) {
    const company = 'Phonely Support';
    const apiKey = await getApiKey(company);
    const apiUrl = 'https://api.openai.com/v1/chat/completions';

    const prompt = `Strip all of the html that I pass you, and just return the plain text. Here is the data: ${input}`;

    const requestBody = {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        max_tokens: 1000,
        temperature: 0.8
    };

    // response is what comes back from OpenAI API call 

    const response = await fetch(apiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
        throw new Error(`OpenAI API request failed with status ${response.status}`);
    }

    const responseData = await response.json();

    return responseData.choices[0].message.content;   // this picks out actual plain text returned from OpenAI
}

// Listen for messages from content.js requesting html strip
// message.data is stripped and stored in plainText

async function getURL() {

    const tabs = await new Promise((resolve, reject) => {
        chrome.tabs.query({ active: true, currentWindow: true }, function(tabs) {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(tabs);
            }
        });
    });
    
    const tab = tabs[0];
    const url = tab.url;

    return url
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.action === "stripHtml" && message.data) {
        stripHtml(message.data)
            .then((plainText) => {
                console.log("ready", plainText)

                chrome.storage.local.set({ content: plainText }, function() {
                    if (chrome.runtime.lastError) {
                        console.error(
                            "Error setting ticketContents to " + JSON.stringify(plainText) +
                            ": " + chrome.runtime.lastError.message
                        );
                    } else {
                        console.log("Content stored successfully!");
                    }
                });

                chrome.storage.local.set({stripComplete: true}, () => {
                    console.log("stripComplete status saved to storage")
                    chrome.runtime.sendMessage({action: "stripComplete"})
                })

        
            })
            .catch((error) => sendResponse({ error: error.message }));
        return true; // Indicates that the response will be sent asynchronously
    }
});

function handleUrlChange(details) {
    chrome.tabs.sendMessage(details.tabId, { action: "urlChanged" });
}

chrome.webNavigation.onHistoryStateUpdated.addListener(handleUrlChange);
chrome.webNavigation.onCompleted.addListener(handleUrlChange);
chrome.webNavigation.onReferenceFragmentUpdated.addListener(handleUrlChange);

// Configuration object for Pastebin IDs and refresh intervals
const CONFIG = {
    PASTEBIN_IDS: {
        phonely: 'LftVi4su',
        sbf: 'uA637yCQ',
    },
   
    PASTEBIN_API_KEY: 'JX-QgtqXr8JMRqc6DmuGwhSi78LGW2_n'
};

// Function to fetch prompts from Pastebin
async function fetchPrompts(number) {
    try {
        //let phonelyPrompt;
        switch(number) {
            case 1:
                const response = await fetch(`https://pastebin.com/raw/${CONFIG.PASTEBIN_IDS.phonely}?v=${Date.now()}`);
                const phonelyPrompt = await response.text();
                return phonelyPrompt
                break;
            case 2:
                const response2 = await fetch(`https://pastebin.com/raw/${CONFIG.PASTEBIN_IDS.sbf}?v=${Date.now()}`);
                const sbfPrompt = await response2.text();
                return sbfPrompt
                break;  
        }
        console.log('Prompts updated successfully');
    } catch (error) {
        console.error('Error fetching prompts:', error);
        // If fetch fails, try to use cached prompts
        const cached = await chrome.storage.local.get(['phonelyPrompt', 'sbfPrompt']);
        if (!cached.phonelyPrompt || !cached.sbfPrompt) {
            throw new Error('No cached prompts available');
        }
    }
}


