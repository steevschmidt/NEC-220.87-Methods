/**
 * Version information for Panel Capacity Calculator
 * Fetches the latest commit date from GitHub to use as version
 */

// Fetch latest commit date from GitHub API
async function fetchLatestCommitDate() {
    try {
        // Repository owner and name
        const owner = 'steevschmidt';  // Actual owner
        const repo = 'NEC-220.87-Methods';  // Actual repo name
        
        const response = await fetch(`https://api.github.com/repos/${owner}/${repo}/commits?per_page=1`);
        
        if (!response.ok) {
            throw new Error(`GitHub API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data && data.length > 0) {
            // Extract the commit date
            const commitDate = new Date(data[0].commit.author.date);
            // Format date as YYYY-MM-DD
            const formattedDate = commitDate.toISOString().split('T')[0];
            return formattedDate;
        }
        
        throw new Error('No commit data found');
    } catch (error) {
        console.error('Error fetching commit date:', error);
        // Return current date as fallback
        const today = new Date();
        return today.toISOString().split('T')[0];
    }
}

// Initialize version display
document.addEventListener('DOMContentLoaded', async function() {
    const versionElement = document.getElementById('versionInfo');
    if (versionElement) {
        // Show loading indicator
        versionElement.textContent = 'v...';
        
        try {
            // Try to get version from window object (set in script.js)
            let versionText = window.APP_VERSION;
            
            // If version not available or is constant format, try to get from GitHub
            if (!versionText || versionText.startsWith('v0.')) {
                const commitDate = await fetchLatestCommitDate();
                versionText = `v${commitDate}`;
                
                // Update global version variable if it exists
                if (typeof window.APP_VERSION !== 'undefined') {
                    window.APP_VERSION = versionText;
                }
            }
            
            versionElement.textContent = versionText;
        } catch (error) {
            console.error('Error setting version:', error);
            versionElement.textContent = 'v???';
        }
    }
});
