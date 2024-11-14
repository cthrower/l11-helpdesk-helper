document.addEventListener('DOMContentLoaded', async () => {
    const apiKeyForm = document.getElementById('apiKeyForm');
    const mainContent = document.getElementById('mainContent');
    
    // Check if API keys exist
    chrome.storage.local.get(['apiKeyPhonely', 'apiKeySbf'], function(result) {
        if (!result.apiKeyPhonely || !result.apiKeySbf) {
            // Show API key form if keys don't exist
            apiKeyForm.classList.remove('hidden');
            mainContent.classList.add('hidden');
        } else {
            // Show main content if keys exist
            apiKeyForm.classList.add('hidden');
            mainContent.classList.remove('hidden');
        }
    });
});

document.getElementById('saveKeys').addEventListener('click', () => {
    const phonelyKey = document.getElementById('phonelyKey').value.trim();
    const sbfKey = document.getElementById('sbfKey').value.trim();
   
    if (!phonelyKey || !sbfKey) {
        alert('Please enter all API keys');
        return;
    }
    
    chrome.storage.local.set({
        apiKeyPhonely: phonelyKey,
        apiKeySbf: sbfKey
    }, function() {
        if (chrome.runtime.lastError) {
            alert('Error saving API keys: ' + chrome.runtime.lastError.message);
        } else {
            // Hide form and show main content
            document.getElementById('apiKeyForm').classList.add('hidden');
            document.getElementById('mainContent').classList.remove('hidden');
        }
    });
});

document.getElementById('generate').addEventListener('click', () => {
    document.getElementById('buttons').classList.add('hidden');
    document.getElementById('loading').classList.remove('hidden');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "CheckContentAndGenerateEmail" }, function(response) {
            if (chrome.runtime.lastError) {
                console.error('Runtime error:', chrome.runtime.lastError);
                return;
            }
            if (response.error) {
                console.error('Response error:', response.error);
            } else {
                chrome.tabs.sendMessage(tabs[0].id, { action: "CreateEmail" }, function(response) {
                    window.close();
                });
            }
        });
    });
});

document.getElementById('summary').addEventListener('click', () => {
    document.getElementById('buttons').classList.add('hidden');
    document.getElementById('loading').classList.remove('hidden');

    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
        chrome.tabs.sendMessage(tabs[0].id, { action: "CheckContentAndGenerateSummary" }, function(response) {
            if (chrome.runtime.lastError) {
                console.error('Runtime error:', chrome.runtime.lastError);
                return;
            }
            if (response.error) {
                console.error('Response error:', response.error);
            } else {
                window.close();
            }
        });
    });
});

