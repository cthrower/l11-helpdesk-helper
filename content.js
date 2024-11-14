let buttonClicked = false; // Flag to track if the button has been clicked
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
                console.log("active company sent", activeCompany)
            })

        }else {

            console.log("no company found")
        }

        observer.disconnect();
        resolve();
    })

    
}


function clickViewMoreButtons() {
    return new Promise((resolve) => {
        // Check if the button has already been clicked
        if (buttonClicked) {
            resolve();
            return;
        }

        let viewMoreButtons = document.querySelectorAll('.textBubble-overflowContainer .js-toggleFold');

        if (viewMoreButtons.length === 0) {
            resolve();
            return;
        }

        viewMoreButtons.forEach(button => {
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
// then calls stripping function

async function getContent() {
    const entryBodies = document.querySelectorAll('.article-content');

    let ticketContents = []

    entryBodies.forEach(entrybody => {
        
        const allHTML = entrybody.outerHTML
        ticketContents.push(allHTML)
    
    })

    try {

        chrome.runtime.sendMessage({ action: "stripHtml", data: ticketContents })

    } catch (error) {

        console.error("Error during HTML stripping:", error);
    }

}




function getEmail(){
    return new Promise((resolve, reject) => {
        const emailEditorDiv = document.querySelector('div.articleNewEdit-body div[contenteditable="true"]');
        if (emailEditorDiv) {
            const emailContent = emailEditorDiv.innerHTML.trim();

            chrome.storage.local.set({ emailContent: emailContent}, function() {
                if (chrome.runtime.lastError) {
                    console.error(
                        "Error setting email content to " + JSON.stringify(emailContent) +
                        ": " + chrome.runtime.lastError.message
                    );
                    reject(chrome.runtime.lastError);
                } else {
                    resolve(emailContent);
                }
            })
        }
    })
}

// Listen for messages from popup.js - this is when button is clicked on popup

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {

    if (request.action === "CheckContentAndGenerateEmail") {

        try{
            chrome.runtime.sendMessage({ action: "generateEmail" }, function(response) {
                createEmail(response.email);
                sendResponse({ email: response.email });
            });

        } catch (error) {
            console.log("error creating email", error)
            throw error
        }
        
    }

    if (request.action === "CheckContentAndGenerateSummary") {

        try{
            chrome.runtime.sendMessage({ action: "generateSummary" }, function(response) {
                showSummaryPopup(response.generatedSummary);
                sendResponse({ summary: response.generatedSummary });
            });

        } catch (error) {
            console.log("error creating email", error)
            throw error
        }
        
    }

    if(request.action === "urlChanged") {
        observer.disconnect();
        initialize();
        chrome.storage.local.remove('content')
    }

});

// function to trigger summary popup. Argument will be summary provided by getOpenAiSummary()
async function showSummaryPopup(content){

    window.alert(content)

}

function createEmail(emailContent) {

    const buttonBars = document.querySelectorAll('div.js-article-actions');

    const lastButtonBar = buttonBars[buttonBars.length - 1];

    const replyButton = lastButtonBar?.querySelector('a[data-type="emailReply"]');

    replyButton.focus(); // Focus the button
    const mouseDownEvent = new MouseEvent("mousedown", { bubbles: true });
    const mouseUpEvent = new MouseEvent("mouseup", { bubbles: true });
    replyButton.dispatchEvent(mouseDownEvent);
    replyButton.dispatchEvent(mouseUpEvent);
    replyButton.click(); // Trigger the click

    const observer = new MutationObserver((mutations, obs) => {
            
        const emailEditorDiv = document.querySelector('div.textBubble > div[contenteditable="true"]');
        console.log("what's in this div?", emailEditorDiv)
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
        } else {

            obs.disconnect()
        }

        if(emailEditorDiv){
            obs.disconnect();
        }
    });

     observer.observe(document.body, { childList: true, subtree: true });


}
