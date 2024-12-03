let hasActiveCompanyBeenCalled  = false;

function initialize() {
    clickViewMoreButtons().then(() => {
        debouncedGetContent(); 

    });

    observer.observe(document.body, { childList: true, subtree: true });
}

function getActiveCompany() {

    return new Promise((resolve) => {

        if(hasActiveCompanyBeenCalled){
            
            console.log("getActiveCompany already called")
            resolve();
            return;
        }

        const activeCompany = document.querySelectorAll('div.controls > div.dropdown--actions > div.dropdown-toggle > input.js-input')

        if (activeCompany.length === 0){

            resolve();
            return;
        }

        hasActiveCompanyBeenCalled = true;

        if(activeCompany && activeCompany.length>0){

            chrome.storage.local.set({ companyData: activeCompany[0].title }, function(){
                console.log("active company sent", activeCompany[0].title)
            })

        }else {

            console.log("no company found")
        }

        observer.disconnect();
        resolve();
    })
}

function clickViewMoreButtons() {
    let buttonClicked = false; 

    return new Promise((resolve) => {

        // Check if the button has already been clicked
        if (buttonClicked) {
            resolve();
            return;
        }

        let viewMoreButtons = Array.from(document.querySelectorAll('.textBubble-overflowContainer:not(.hide) .js-toggleFold'));

        if (viewMoreButtons.length === 0) {
            resolve();
            return;
        }

        viewMoreButtons.filter(f => f.innerText == 'See more').forEach(button => {
            button.click();
        });

        // Set the flag to true after clicking the button
        buttonClicked = true;

        // Disconnect the observer after the buttons have been clicked
        observer.disconnect();
        resolve();
    });
}

function debounce(func, wait) {
    let timeout;
    return function(...args) {
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(this, args), wait, ...args);
    };
}

const debouncedClickViewMoreButtons = debounce(() => {
    clickViewMoreButtons().then(() => {
        // Optionally, reattach observer if needed in other situations
        observer.observe(document.body, { childList: true, subtree: true });
    });
}, 500);

const debouncedGetActiveCompany = debounce(() => {
    getActiveCompany().then(() => {
        // Optionally, reattach observer if needed in other situations
        observer.observe(document.body, { childList: true, subtree: true });
    });
}, 500);

const debouncedGetContent = debounce(() => {
    getContent().then(() => {});
}, 500);

const observer = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
        if (mutation.addedNodes.length) {
            debouncedClickViewMoreButtons();
            debouncedGetActiveCompany();
        }
    });
});

observer.observe(document.body, { childList: true, subtree: true });

// retrieves content from page, BEFORE being stripped

async function getContent() {
    const entryBodies = document.querySelectorAll('.article-content');

    let ticketContents = []

    entryBodies.forEach(entrybody => {
        const allHTML = entrybody.outerHTML
        ticketContents.push(allHTML)
    })


    try {
        chrome.runtime.sendMessage({action: "dataTransfer"})
        chrome.storage.local.set({content: ticketContents})
    } catch (error) {
        console.error("Error setting content to chrome local storage:", error);
    }

}

// Listen for messages from popup.js - this is when button is clicked on popup

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if (request.action === "createRun") {

        const ticketTitleDiv = document.querySelector('.ticket-title-update.js-objectTitle');
        const emailTitle = ticketTitleDiv.textContent;
        let isSupportMessage = false;

        if (emailTitle.includes("Support message") || emailTitle.includes("FW:") || emailTitle.includes("Fw:")){
            console.log("are you running?")
            isSupportMessage = true;

            try{
                chrome.runtime.sendMessage({ action: "generateEmail", data: isSupportMessage }, function(response) {
                    createEmail(response.messages?.content ?? '', response.messages?.email ?? '');
                    sendResponse({status:true})
                });
    
            } catch (error) {
                console.log("error creating email", error)
                throw error
            }

        }    
        else{

            try{
                chrome.runtime.sendMessage({ action: "generateEmail", data: isSupportMessage }, function(response) {
                    createEmail(response.messages?.content ?? '', response.messages?.email ?? '');
                    sendResponse({status:true})
                });
    
            } catch (error) {
                console.log("error creating email", error)
                throw error
            }
        }
    }

    if (request.action === "CheckContentAndGenerateSummary") {

        try{
            chrome.runtime.sendMessage({ action: "generateSummary" }, function(response) {
                showSummaryPopup(response.messages);
            });

        } catch (error) {
            console.log("error creating email", error)
            throw error
        }
        
    }

    if(request.action === "urlChanged") {
        observer.disconnect();
        chrome.storage.local.remove('content')
        chrome.storage.local.remove('companyData')
        hasActiveCompanyBeenCalled = false;
        initialize();

    }
});

// function to trigger summary popup. Argument will be summary provided by getOpenAiSummary()
async function showSummaryPopup(content){

    window.alert(content)

}

// function that presses the reply button and actually pastes the content in
function createEmail(emailContent, emailAddress) {

    console.log('create the email', emailContent, emailAddress)

    const buttonBars = document.querySelectorAll('div.js-article-actions');

    // Find the first button bar with a reply button, starting from the last one
    let replyButton = null;
    for (let i = buttonBars.length - 1; i >= 0; i--) {
        const currentReplyButton = buttonBars[i]?.querySelector('a[data-type="emailReply"]');
        if (currentReplyButton) {
            replyButton = currentReplyButton;
            console.log("is this the right button?", replyButton)
            break; 
        }
    }

    if (!replyButton) {
        console.error("No reply button found in any button bar.");
        return; 
    }

    // Focus and click the reply button
    replyButton.focus();
    const mouseDownEvent = new MouseEvent("mousedown", { bubbles: true });
    const mouseUpEvent = new MouseEvent("mouseup", { bubbles: true });
    replyButton.dispatchEvent(mouseDownEvent);
    replyButton.dispatchEvent(mouseUpEvent);
    replyButton.click();



    // Set up the MutationObserver
    const observer = new MutationObserver((mutations, obs) => {

        const emailEditorDiv = document.querySelector('div.textBubble > div[contenteditable="true"]');
        const recipientDiv = document.querySelector(`.token-input.ui-autocomplete-input`)
        const removeEmailButton = document.querySelector(`.token > a.close`)

        if (recipientDiv) {
            if (removeEmailButton){
                removeEmailButton.click();
                recipientDiv.value = emailAddress
            } else {
                recipientDiv.value = emailAddress
            }

        }


        if (emailEditorDiv) {
            const formattedEmailContent = `
            <div style="font-family: Arial, sans-serif; line-height: 1.6;">
                ${emailContent
                    .split('\n')
                    .filter(line => line.trim() !== '')
                    .map(line => `<p>${line}</p>`)
                    .join('')}
            </div>
            `;
            emailEditorDiv.innerHTML = formattedEmailContent;

            emailEditorDiv.style.display = 'none';
            emailEditorDiv.offsetHeight; 
            emailEditorDiv.style.display = '';

            const inputEvent = new Event('input', { bubbles: true });
            const blurEvent = new Event('blur', { bubbles: true });
            emailEditorDiv.dispatchEvent(inputEvent);
            emailEditorDiv.dispatchEvent(blurEvent);

            // Notify that the email has been inserted
            chrome.runtime.sendMessage({ action: "emailInserted" });
            console.log("Email content inserted and message sent.");


    

            obs.disconnect();
        }
    });

    observer.observe(document.body, { childList: true, subtree: true });
}

