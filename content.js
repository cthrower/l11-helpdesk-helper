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
    //console.log("is this the right thing?", entryBodies)

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
    }

});

// function to trigger summary popup. Argument will be summary provided by getOpenAiSummary()
async function showSummaryPopup(content){

    window.alert(content)

}

// function that clicks reply button and inserts reply content

function createEmail(emailContent) {
    // Define the selector for the container of the dynamically added elements
    const buttonBarContainerSelector = 'div.js-article-actions';

    // Function to check and click the reply button
    const checkAndClickReplyButton = () => {
        const buttonBars = document.querySelectorAll(buttonBarContainerSelector);
        const lastButtonBar = buttonBars[buttonBars.length - 1];
        
        if (!lastButtonBar) {
            console.error('Button bar not found');
            return;
        }

        const replyButton = lastButtonBar.querySelector('a[data-type="emailReply"]');
        console.log("yo", replyButton);

        if (replyButton) {
            // Prevent default behavior and click the reply button
            replyButton.addEventListener('click', (e) => {
                e.preventDefault();
                console.log("default behaviour prevented");
            });

            replyButton.click();
            console.log("reply button clicked!");

            // Disconnect the observer after finding and clicking the button
            observer.disconnect();
        } else {
            console.error('Reply button not found');
        }
    };

    // Set up the MutationObserver to monitor the document body for added elements
    const observer = new MutationObserver(() => {
        checkAndClickReplyButton();
    });

    // Start observing with childList and subtree options to capture dynamically added elements
    observer.observe(document.body, { childList: true, subtree: true });

    // Initial check in case the element is already loaded
    checkAndClickReplyButton();
}
