/**
 * Panel Capacity Calculator Embedding Support
 * This script adds functionality to allow the calculator to be embedded in other websites
 * and communicate with the parent page.
 */

// Initialize embedding functionality when the document is loaded
document.addEventListener('DOMContentLoaded', function() {
    // Parse URL parameters
    const urlParams = new URLSearchParams(window.location.search);
    
    // Apply parameters to the calculator if they exist
    if (urlParams.has('panelSize')) {
        const panelSizeInput = document.getElementById('panelSize');
        if (panelSizeInput) {
            panelSizeInput.value = urlParams.get('panelSize');
        }
    }
    
    if (urlParams.has('panelVoltage')) {
        const panelVoltageSelect = document.getElementById('panelVoltage');
        if (panelVoltageSelect) {
            panelVoltageSelect.value = urlParams.get('panelVoltage');
        }
    }
    
    if (urlParams.has('calculationMethod')) {
        const calculationMethodSelect = document.getElementById('calculationMethod');
        if (calculationMethodSelect) {
            calculationMethodSelect.value = urlParams.get('calculationMethod');
        }
    }

    // Handle seasonalLoad parameter
    if (urlParams.has('seasonalLoad')) {
        const seasonalLoadInput = document.getElementById('seasonalLoad');
        if (seasonalLoadInput) {
            seasonalLoadInput.value = urlParams.get('seasonalLoad');
            // Also make sure the container is visible
            const seasonalLoadContainer = document.getElementById('seasonalLoadContainer');
            if (seasonalLoadContainer) {
                seasonalLoadContainer.classList.remove('hidden');
            }
        }
    }

    // Handle hideHeader parameter
    if (urlParams.has('hideHeader') && urlParams.get('hideHeader') === 'true') {
        const header = document.querySelector('header');
        if (header) {
            header.style.display = 'none';
        }
    }
    
    // Auto-calculate if all required parameters are provided and autoCalculate is true
    if (urlParams.has('autoCalculate') && urlParams.get('autoCalculate') === 'true') {
        // Check if we have a sample file parameter
        if (urlParams.has('sampleFile')) {
            const sampleFile = urlParams.get('sampleFile');
            // Find the sample button with this data-file attribute and click it
            const sampleButtons = document.querySelectorAll('.sample-button');
            for (const button of sampleButtons) {
                if (button.getAttribute('data-file') === sampleFile) {
                    button.click();
                    break;
                }
            }
        }
    }
    
    // Add event listener to send results to parent page
    const originalDisplayResults = PanelCalculator.prototype.displayResults;
    if (originalDisplayResults) {
        PanelCalculator.prototype.displayResults = function(results) {
            // Call the original method
            originalDisplayResults.call(this, results);
            
            // Send results to parent page
            if (window.parent !== window) {
                try {
                    window.parent.postMessage({
                        type: 'calculationResults',
                        results: {
                            peakPowerKw: results.peakPowerKw,
                            peakPowerAmps: results.peakPowerAmps,
                            safetyFactorKw: results.safetyFactorKw,
                            safetyFactorAmps: results.safetyFactorAmps,
                            availableCapacityKw: results.availableCapacityKw,
                            availableCapacityAmps: results.availableCapacityAmps
                        }
                    }, '*');
                } catch (error) {
                    console.error('Error sending results to parent page:', error);
                }
            }
        };
    }
    
    // Add a class to the body when embedded
    if (window.parent !== window) {
        document.body.classList.add('embedded');
        
        // Add embedded styles
        const style = document.createElement('style');
        style.textContent = `
            body.embedded {
                /* Remove any padding/margin when embedded */
                margin: 0;
                padding: 0;
            }
            
            body.embedded .app-footer {
                /* Hide footer when embedded */
                display: none;
            }
            
            /* Optional: Hide certain elements when embedded */
            body.embedded .sample-data-container {
                display: none;
            }
            
            /* Make sure the container takes full width */
            body.embedded .container {
                width: 100%;
                max-width: 100%;
                padding: 10px;
            }
            
            /* Adjust header size when embedded */
            body.embedded header h1 {
                font-size: 1.5rem;
            }
            
            body.embedded header p {
                font-size: 0.9rem;
            }
        `;
        document.head.appendChild(style);
    }
});

// Add a global function to allow parent pages to trigger calculations
window.triggerCalculation = function() {
    const calculateBtn = document.getElementById('calculateBtn');
    if (calculateBtn && !calculateBtn.disabled) {
        calculateBtn.click();
        return true;
    }
    return false;
};

// Add a global function to load a sample file
window.loadSampleFile = function(filename) {
    const sampleButtons = document.querySelectorAll('.sample-button');
    for (const button of sampleButtons) {
        if (button.getAttribute('data-file') === filename) {
            button.click();
            return true;
        }
    }
    return false;
};

// Add a global function to get the current panel configuration
window.getPanelConfig = function() {
    return {
        panelSize: document.getElementById('panelSize')?.value || '150',
        panelVoltage: document.getElementById('panelVoltage')?.value || '240',
        calculationMethod: document.getElementById('calculationMethod')?.value || 'hea',
        seasonalLoad: document.getElementById('seasonalLoad')?.value || '5000'
    };
};

// Add a global function to set the panel configuration
window.setPanelConfig = function(config) {
    if (config.panelSize) {
        document.getElementById('panelSize').value = config.panelSize;
    }
    if (config.panelVoltage) {
        document.getElementById('panelVoltage').value = config.panelVoltage;
    }
    if (config.calculationMethod) {
        document.getElementById('calculationMethod').value = config.calculationMethod;
    }
    if (config.seasonalLoad) {
        const seasonalLoadElement = document.getElementById('seasonalLoad');
        if (seasonalLoadElement) {
            seasonalLoadElement.value = config.seasonalLoad;
        }
    }
    return true;
}; 