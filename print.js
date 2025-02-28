// Function to open a printable page with results
function openPrintablePage() {
    // Get current values directly from the DOM at the moment of printing
    const panelSizeElement = document.getElementById('panelSize');
    const panelSize = panelSizeElement ? panelSizeElement.value : '150';
    
    const voltageElement = document.getElementById('panelVoltage');
    const voltage = voltageElement ? voltageElement.value : '240';
    
    const methodElement = document.getElementById('calculationMethod');
    let method = 'HEA';
    if (methodElement) {
        const selectedOption = methodElement.options[methodElement.selectedIndex];
        method = selectedOption ? selectedOption.text : 'HEA';
    }
    
    const fileInput = document.getElementById('csvFile');
    let fileName = 'No file selected';
    if (fileInput && fileInput.files && fileInput.files.length > 0) {
        fileName = fileInput.files[0].name;
    }
    
    // Get the current results
    const peakKwElement = document.getElementById('peakKw');
    const peakAmpsElement = document.getElementById('peakAmps');
    const remainingKwElement = document.getElementById('remainingKw');
    const remainingAmpsElement = document.getElementById('remainingAmps');
    
    const peakKw = peakKwElement ? peakKwElement.textContent : 'N/A';
    const peakAmps = peakAmpsElement ? peakAmpsElement.textContent : 'N/A';
    const remainingKw = remainingKwElement ? remainingKwElement.textContent : 'N/A';
    const remainingAmps = remainingAmpsElement ? remainingAmpsElement.textContent : 'N/A';
    
    // Get data info if available
    let dataInfoSummary = '';
    const dataInfoElement = document.getElementById('dataInfo');
    if (dataInfoElement) {
        const summaryElement = dataInfoElement.querySelector('.info-summary');
        if (summaryElement) dataInfoSummary = summaryElement.innerHTML;
    }
    
    // Get the chart as an image
    let chartImage = '';
    const chartCanvas = document.getElementById('chartCanvas');
    if (chartCanvas) {
        try {
            chartImage = chartCanvas.toDataURL('image/png');
        } catch (e) {
            console.error('Error converting chart to image:', e);
        }
    }
    
    // Create the printable page HTML with more compact layout
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
        alert("Pop-up blocked. Please allow pop-ups for this site to use the print feature.");
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
                    font-size: 20px;
                }
                h2 {
                    color: #2c3e50;
                    margin-top: 15px;
                    margin-bottom: 10px;
                    font-size: 16px;
                }
                .compact-layout {
                    display: flex;
                    flex-wrap: wrap;
                    gap: 15px;
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
                    font-size: 12px;
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
                    font-size: 12px;
                    color: #666;
                    margin: 0 0 5px 0;
                }
                .result-value {
                    font-size: 16px;
                    font-weight: bold;
                    color: #3498db;
                }
                .chart-container {
                    width: 100%;
                    height: 250px;
                    margin: 10px 0;
                }
                .chart-image {
                    max-width: 100%;
                    height: auto;
                    border: 1px solid #ddd;
                }
                .data-summary {
                    font-size: 12px;
                    margin: 5px 0;
                    color: #666;
                }
                .footer {
                    margin-top: 15px;
                    text-align: center;
                    font-size: 10px;
                    color: #777;
                    border-top: 1px solid #ddd;
                    padding-top: 5px;
                }
                .info-note {
                    font-size: 10px;
                    color: #666;
                    font-style: italic;
                    margin-top: 3px;
                }
                @media print {
                    body {
                        padding: 0;
                    }
                    .no-print {
                        display: none;
                    }
                }
                .result-card h3 .help-icon {
                    display: inline-flex;
                    margin-left: 5px;
                    vertical-align: middle;
                    cursor: help;
                }
                .result-card .info-note {
                    font-size: 12px;
                    color: #666;
                    font-style: italic;
                    margin-top: 5px;
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
                    <p><strong>Method:</strong> ${method}</p>
                    <p><strong>File:</strong> ${fileName}</p>
                    ${dataInfoSummary ? `<p class="data-summary">${dataInfoSummary}</p>` : ''}
                </div>
                
                <div class="results-container">
                    <div class="result-box">
                        <h3>Peak Power</h3>
                        <div class="result-value">${peakKw} kW / ${peakAmps} A</div>
                    </div>
                    <div class="result-box">
                        <h3>Remaining Capacity</h3>
                        <div class="result-value">${remainingKw} kW / ${remainingAmps} A</div>
                        <div class="info-note">*Includes NEC safety factor (1.25x) applied to peak power</div>
                    </div>
                </div>
            </div>
            
            ${chartImage ? `
            <div class="chart-container">
                <img class="chart-image" src="${chartImage}" alt="Load Profile Chart">
            </div>
            ` : ''}
            
            <div class="footer">
                <p>Generated by Panel Capacity Calculator on ${new Date().toLocaleDateString()}</p>
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
} 