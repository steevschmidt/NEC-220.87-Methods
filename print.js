// Function to open a printable page with results
function openPrintablePage() {
    // Show loading indicator
    const printBtn = document.getElementById('printResultsBtn');
    const originalText = printBtn.innerHTML;
    printBtn.innerHTML = `
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 5px;">
            <path d="M2.5 8a.5.5 0 1 0 0-1 .5.5 0 0 0 0 1z"/>
            <path d="M5 1a2 2 0 0 0-2 2v2H2a2 2 0 0 0-2 2v3a2 2 0 0 0 2 2h1v1a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2v-1h1a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-1V3a2 2 0 0 0-2-2H5zM4 3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2H4V3zm1 5a2 2 0 0 0-2 2v1H2a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v3a1 1 0 0 1-1 1h-1v-1a2 2 0 0 0-2-2H5zm7 2v3a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1v-3a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1z"/>
        </svg>
        Opening...
    `;
    printBtn.disabled = true;

    // Get current values directly from the DOM at the moment of printing
    const panelSizeElement = document.getElementById('panelSize');
    const panelSize = panelSizeElement ? panelSizeElement.value : '150';
    
    const voltageElement = document.getElementById('panelVoltage');
    const voltage = voltageElement ? voltageElement.value : '240';
    
    // Check for seasonal load
    const seasonalLoadElement = document.getElementById('seasonalLoad');
    const seasonalLoadContainer = document.getElementById('seasonalLoadContainer');
    let seasonalLoad = '';
    let seasonalLoadInfo = '';
    
    // Only include seasonal load if it's being used (visible)
    if (seasonalLoadElement && seasonalLoadContainer && !seasonalLoadContainer.classList.contains('hidden')) {
        seasonalLoad = seasonalLoadElement.value;
        seasonalLoadInfo = `<p><strong>Seasonal Load:</strong> ${seasonalLoad} Watts</p>`;
    }
    
    // Check if calculation method is applicable (not for pure 15-minute data)
    const methodElement = document.getElementById('calculationMethod');
    const methodSelectorContainer = document.getElementById('methodSelectorContainer');
    let methodInfo = '';
    let method = '';
    
    // Only include calculation method if it's being used (visible)
    if (methodElement && methodSelectorContainer && !methodSelectorContainer.classList.contains('hidden')) {
        const selectedOption = methodElement.options[methodElement.selectedIndex];
        method = selectedOption ? selectedOption.text : '';
        methodInfo = `<p><strong>Method:</strong> ${method}</p>`;
    }
    
    const fileInput = document.getElementById('csvFile');
    let fileName = 'No file selected';
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
        fileName = fileInput.files[0].name;
    }
    
    // Get the current results
    const peakKwElement = document.getElementById('peakKw');
    const peakAmpsElement = document.getElementById('peakAmps');
    const unusedKwElement = document.getElementById('unusedKw');
    const unusedAmpsElement = document.getElementById('unusedAmps');
    const availableKwElement = document.getElementById('availableKw');
    const availableAmpsElement = document.getElementById('availableAmps');
    
    const peakKw = peakKwElement ? peakKwElement.textContent : 'N/A';
    const peakAmps = peakAmpsElement ? peakAmpsElement.textContent : 'N/A';
    const unusedKw = unusedKwElement ? unusedKwElement.textContent : 'N/A';
    const unusedAmps = unusedAmpsElement ? unusedAmpsElement.textContent : 'N/A';
    const availableKw = availableKwElement ? availableKwElement.textContent : 'N/A';
    const availableAmps = availableAmpsElement ? availableAmpsElement.textContent : 'N/A';
    
    // Check if capacities are negative
    const isUnusedCapacityNegative = parseFloat(unusedKw) < 0;
    const isNegativeCapacity = parseFloat(availableKw) < 0;
    
    // Get data info if available
    let dataInfoSummary = '';
    let analysisDetails = [];
    const dataInfoElement = document.getElementById('dataInfo');
    if (dataInfoElement) {
        const summaryElement = dataInfoElement.querySelector('.info-summary');
        if (summaryElement) dataInfoSummary = summaryElement.innerHTML;
        
        // Get all analysis details
        const detailElements = dataInfoElement.querySelectorAll('.info-details .info-item');
        if (detailElements && detailElements.length > 0) {
            detailElements.forEach(item => {
                analysisDetails.push(item.innerHTML);
            });
        }
    }
    
    // Get the chart as an image
    let chartImage = '';
    const chartCanvas = document.getElementById('chartCanvas');
    if (chartCanvas) {
        try {
            chartImage = chartCanvas.toDataURL('image/png');
        } catch (e) {
            // Use a silent fail approach in production
            // console.error('Error converting chart to image:', e);
            chartImage = ''; // Just use empty string if conversion fails
        }
    }
    
    // Create the printable page HTML with more comprehensive layout
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Pop-up blocked. Please allow pop-ups for this site to use the print feature.");
        // Reset button state
        printBtn.innerHTML = originalText;
        printBtn.disabled = false;
        return;
    }
    
    printWindow.document.write(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>Panel Capacity Calculator Results</title>
            <style>
                body {
                    font-family: Arial, sans-serif;
                    line-height: 1.4;
                    color: #333;
                    max-width: 800px;
                    margin: 0 auto;
                    padding: 15px;
                }
                h1 {
                    color: #2c3e50;
                    border-bottom: 2px solid #3498db;
                    padding-bottom: 8px;
                    margin-top: 0;
                    margin-bottom: 15px;
                    font-size: 22px;
                }
                h2 {
                    color: #2c3e50;
                    margin-top: 15px;
                    margin-bottom: 10px;
                    font-size: 18px;
                }
                .compact-layout {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px;
                    margin-bottom: 15px;
                }
                .parameters {
                    flex: 1;
                    min-width: 200px;
                    background-color: #f5f5f5;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    padding: 10px;
                }
                .parameters p {
                    margin: 5px 0;
                    font-size: 13px;
                }
                .results-container {
                    flex: 1;
                    min-width: 200px;
                    display: flex;
                    flex-direction: column;
                    gap: 10px;
                }
                .result-box {
                    background-color: #f9f9f9;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    padding: 10px;
                }
                .result-box h3 {
                    font-size: 14px;
                    color: #666;
                    margin: 0 0 5px 0;
                }
                .result-value {
                    font-size: 18px;
                    font-weight: bold;
                    color: #3498db;
                }
                .chart-container {
                    width: 100%;
                    height: 300px;
                    margin: 15px 0 0 0;
                }
                .chart-image {
                    max-width: 100%;
                    height: auto;
                    border: 1px solid #ddd;
                }
                .data-summary {
                    font-size: 13px;
                    margin: 5px 0;
                    color: #666;
                }
                .footer {
                    margin-top: 20px;
                    text-align: center;
                    font-size: 11px;
                    color: #777;
                    border-top: 1px solid #ddd;
                    padding-top: 10px;
                }
                .info-note {
                    font-size: 11px;
                    color: #666;
                    font-style: italic;
                    margin-top: 3px;
                }
                .analysis-details {
                    background-color: #f8f9fa;
                    border: 1px solid #e9ecef;
                    border-radius: 5px;
                    padding: 10px;
                    margin-top: -5px;
                }
                .analysis-details h2 {
                    font-size: 16px;
                    margin-top: 0;
                    margin-bottom: 8px;
                    color: #495057;
                }
                .detail-items-container {
                    display: flex;
                    flex-wrap: wrap;
                    column-gap: 15px;
                }
                .detail-column {
                    flex: 1;
                    min-width: 45%;
                }
                .detail-item {
                    padding: 4px 0;
                    border-bottom: 1px solid #e9ecef;
                    font-size: 12px;
                }
                .detail-item:last-child {
                    border-bottom: none;
                }
                .negative-value {
                    color: #b71c1c !important; /* Dark red color */
                    font-weight: bold;
                }
                .compact-spacing {
                    margin-top: -10px;
                }
                @media print {
                    body {
                        padding: 0;
                    }
                    .no-print {
                        display: none;
                    }
                }
            </style>
        </head>
        <body>
            <h1>Panel Capacity Calculator Results</h1>
            
            <div class="compact-layout">
                <div class="parameters">
                    <h2>Input Parameters</h2>
                    <p><strong>Panel Size:</strong> ${panelSize} Amps</p>
                    <p><strong>Voltage:</strong> ${voltage} Volts</p>
                    ${seasonalLoadInfo}
                    ${methodInfo}
                    <p><strong>File:</strong> ${fileName}</p>
                    ${dataInfoSummary ? `<p class="data-summary">${dataInfoSummary}</p>` : ''}
                </div>
                
                <div class="results-container">
                    <div class="result-box">
                        <h3>Peak Power</h3>
                        <div class="result-value">${peakKw} kW / ${peakAmps} A</div>
                        ${seasonalLoad ? `<div class="info-note">*Includes seasonal load adjustment of ${(parseFloat(seasonalLoad)/1000).toFixed(2)} kW</div>` : ''}
                    </div>
                    <div class="result-box">
                        <h3>Unused Capacity</h3>
                        <div class="result-value ${isUnusedCapacityNegative ? 'negative-value' : ''}">${unusedKw} kW / ${unusedAmps} A</div>
                    </div>
                    <div class="result-box">
                        <h3>Available Capacity</h3>
                        <div class="result-value ${isNegativeCapacity ? 'negative-value' : ''}">${availableKw} kW / ${availableAmps} A</div>
                        <div class="info-note">*Includes NEC safety factor (1.25x) applied to peak power</div>
                    </div>
                </div>
            </div>
            
            ${chartImage ? `
            <div class="chart-container">
                <img class="chart-image" src="${chartImage}" alt="Load Profile Chart">
            </div>
            ` : ''}
            
            ${analysisDetails.length > 0 ? `
            <div class="analysis-details compact-spacing">
                <h2>Analysis Details</h2>
                <div class="detail-items-container">
                    <div class="detail-column">
                        ${analysisDetails.slice(0, Math.ceil(analysisDetails.length/2)).map(detail => `<div class="detail-item">${detail}</div>`).join('')}
                    </div>
                    <div class="detail-column">
                        ${analysisDetails.slice(Math.ceil(analysisDetails.length/2)).map(detail => `<div class="detail-item">${detail}</div>`).join('')}
                    </div>
                </div>
            </div>
            ` : ''}
            
            <div class="footer">
                <p>Generated by Panel Capacity Calculator ${window.APP_VERSION || (typeof APP_VERSION !== 'undefined' ? APP_VERSION : 'v?')}, Developed under a grant from the California Energy Commission, on ${new Date().toLocaleDateString()}</p>
                <button class="no-print" onclick="window.print()">Print This Page</button>
            </div>
            
            <script>
                // Auto-print when loaded
                window.onload = function() {
                    setTimeout(function() {
                        window.print();
                    }, 500);
                }
            </script>
        </body>
        </html>
    `);
    printWindow.document.close();
    
    // Reset button state after a short delay
    setTimeout(() => {
        printBtn.innerHTML = originalText;
        printBtn.disabled = false;
    }, 1000);
} 