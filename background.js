chrome.storage.local.set({ testMode: false }, function() {
    console.log('Test Mode Stored');
});

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

    console.log("The action currently being executed is: ", message.action)

    // Generate a response via openAI
    if (message.action === "generateEmail") {
    
        try {
            getThreadId()
            .then(data => { 
                createRun(data)
                    .then(res => {
                        checkStatus(res)
                            .then(finalResult => {
                                const emailContent = finalResult.data[0].content[0].text.value;
                                console.log('email content', emailContent)

                                if(message.data === true){
                                    getEmailRun(data)
                                    .then(result => checkStatus(result))
                                    .then(emailAdd => {
                                        const emailToSendTo = emailAdd.data[0].content[0].text.value;
                                        console.log("Email address to send to:", emailToSendTo);

                                        sendResponse({ messages: { content: emailContent, email: emailToSendTo } });
                                    })
                                } else {
                                    const finalMessage = 
                                    console.log("Output of message:", finalMessage);
                                    sendResponse({ messages: { content: emailContent, email: 'xxx' }});
                                }
                            })
                    })
            })
            .catch(error => {
                console.error("Error:", error.message);
                sendResponse({ error: error.message });
            });

        } catch(err) {
            console.error('erro br0', err)
        }

        // Returning true indicates sendResponse will be used asynchronously
        return true;
    }

    // Generate a summary via openAI
    if(message.action === "generateSummary"){

        getThreadId()
            .then(data => createSummaryRun(data))
            .then(result => checkStatus(result))
            .then(finalResult => {
                const finalMessage = finalResult.data[0].content[0].text.value;
                console.log("Output of message:", finalMessage);
                sendResponse({ messages: finalMessage });            
            })
            .catch(error => {
                console.error("Error:", error.message);
                sendResponse({ error: error.message });
            });

        return true
    }

    if(message.action === "getEmailAddress"){
        getThreadId()
            .then(data => getEmailRun(data))
            .then(result => checkStatus(result))
            .then(finalResult => {
                const finalMessage = finalResult.data[0].content[0].text.value;
                console.log("Email address (hopefully):", finalMessage);
                sendResponse({ extractedEmail: finalMessage });
            })
            .catch(error => {
                console.error("Error:", error.message);
                sendResponse({ error: error.message });
            });

        return true;    
    }
});


async function createSummaryRun(id){

    try {
        const activeCompany = await getCompany();
        const apiKey = await getApiKey(activeCompany);
        const pageContent = await getUnstrippedData();
    
        if (!apiKey){
            console.log("No API key in storage brev")
        }
    
        const apiUrl = `https://api.openai.com/v1/threads/${id}/runs`;

        const prompt = `IDENTITY You are an all-knowing AI with a 476 I.Q. that deeply understands concepts. GOAL You create concise summaries of--or answers to--arbitrary input. STEPS Deeply understand the input. Think for 912 virtual minutes about the meaning of the input. Create a virtual mindmap of the meaning of the content in your mind. Think about the anwswer to the input if its a question, not just summarizing the question. OUTPUT Output a title of "Automated Summary", followed by one section called "Summary" that perfectly capture the true essence of the input, its answer, and/or its meaning, up-to 50 words. OUTPUT FORMAT Output the summary as short, concise text. NOTE: Do not just make the sentences shorter. Reframe the meaning as best as possible for each depth level. Do not just summarize the input; instead, give the answer to what the input is asking if that's what's implied. Additionally, include a summary of suggested next steps at the end - the suggested next steps should be for our internal sales team and how they should handle this lead. Using this prompt, craft me a summary of the following ticket notes: \n\n${pageContent}\n\n`

        const assistantId = await getAssistantId(activeCompany)

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
                "OpenAI-Beta": "assistants=v2"
            },
            body: JSON.stringify({
                assistant_id: assistantId,
                instructions: prompt
                
            })
        })

        const data = await response.json()
        return data
        
    } catch (error) {
        console.error('Error generating summary:', error);
        throw error;
    }
}

async function getEmailRun(id){

    try {
        const activeCompany = await getCompany();
        const apiKey = await getApiKey(activeCompany);
        const pageContent = await getUnstrippedData();
    
        if (!apiKey){
            console.log("No API key in storage brev")
        }
    
        const apiUrl = `https://api.openai.com/v1/threads/${id}/runs`;

        const prompt = `These are the ticket notes \n\n${pageContent}\n\n. Within this, search for text that says: 'Email Address:'. Then return the email address that follows this in a plain text format. Return only the email address and nothing else.`

        const assistantId = await getAssistantId(activeCompany)

        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
                "OpenAI-Beta": "assistants=v2"
            },
            body: JSON.stringify({
                assistant_id: assistantId,
                instructions: prompt
                
            })
        })

        const data = await response.json()
        return data
        
    } catch (error) {
        console.error('Error fetching email address:', error);
        throw error;
    }
}

// the following functions all retrieve the corresponding content from chrome storage

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

async function getAssistantId(companyName) {

    let assistant_id;

    if(companyName==="SwitchboardFREE Support"){
        assistant_id = "asst_kgPA0NV8OCD7LSkoTho02JQq"
    }
    else{
        assistant_id = "asst_2cCcI0Ohtf2LL0EpfHun6VUo"

    }
    
    return assistant_id;
}

function getUnstrippedData() {
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

async function getThreadId() {
    return new Promise((resolve, reject) => {
        chrome.storage.local.get(['threadId'], function(result) {
            if (chrome.runtime.lastError) {
                console.error('Error getting thread id from storage:', chrome.runtime.lastError);
                reject(chrome.runtime.lastError);
            } else {
                resolve(result.threadId || []);
            }
        });
    });
}

async function createThread() {

    try{
        const activeCompany = await getCompany();
        const apiKey = await getApiKey(activeCompany);
        const pageContent = await getUnstrippedData();

        if (!apiKey){
            console.log("No API key in storage brev")
        }

        const apiUrl = 'https://api.openai.com/v1/threads'
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {

                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
                "OpenAI-Beta": "assistants=v2"

            },
            body: JSON.stringify({
                messages : [{role: "user", content: `this is the unstripped page data: ${pageContent}`}]
            })
        })

        const data = await response.json()
        return data

    } catch (error){
        console.error("Error in creating thread", error.message)
        throw error
    }
}

chrome.runtime.onMessage.addListener((message, sendResponse) => {
    if (message.action === "dataTransfer") {

        createThread()
            .then((threadOutput) => {
                
                // Save `threadOutput` and `threadOutput.id` into separate Chrome storage keys simultaneously
                Promise.all([
                    new Promise((resolve, reject) => {
                        chrome.storage.local.set({ content: threadOutput}, function () {
                            if (chrome.runtime.lastError) {
                                console.error(
                                    "Error setting content to " + JSON.stringify(threadOutput) +
                                    ": " + chrome.runtime.lastError.message
                                );
                                reject(chrome.runtime.lastError);
                            } else {
                                console.log("Content stored successfully!");
                                resolve();
                            }
                        });
                    }),
                    new Promise((resolve, reject) => {
                        chrome.storage.local.set({ threadId: threadOutput.id}, function () {
                            if (chrome.runtime.lastError) {
                                console.error(
                                    "Error setting threadId to " + threadOutput.id +
                                    ": " + chrome.runtime.lastError.message
                                );
                                reject(chrome.runtime.lastError);
                            } else {
                                console.log("Thread ID stored successfully!");
                                resolve();
                            }
                        });
                    })
                ])
                .then(() => {
                    console.log("Both content and threadId stored successfully!");
                })
                .catch((error) => {
                    console.error("Error saving to storage:", error.message);
                });
            })
            .catch((error) => sendResponse({ error: error.message }));

        return true; // Indicates that the response will be sent asynchronously
    }
});


async function createRun(id) {

    try{
        const activeCompany = await getCompany();
        const apiKey = await getApiKey(activeCompany);

        if (!apiKey){
            console.log("No API key in storage brev")
        }

        const assistantId = await getAssistantId(activeCompany)

        const apiUrl = `https://api.openai.com/v1/threads/${id}/runs`
        const response = await fetch(apiUrl, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${apiKey}`,
                "OpenAI-Beta": "assistants=v2"
            },
            body: JSON.stringify({
                assistant_id: assistantId,
                
            })
        })

        const data = await response.json()
        return data

    } catch (error){
        console.error("Error in creating thread", error.message)
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

function handleUrlChange(details) {
    chrome.tabs.sendMessage(details.tabId, { action: "urlChanged" });
}

chrome.webNavigation.onHistoryStateUpdated.addListener(handleUrlChange);
chrome.webNavigation.onCompleted.addListener(handleUrlChange);
chrome.webNavigation.onReferenceFragmentUpdated.addListener(handleUrlChange);


