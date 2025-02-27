// Constants for calculations
const SINGLE_READING_MULTIPLIER = 1.3;
const FINAL_CAPACITY_MULTIPLIER = 1.25;

// Add global variables to store form values with correct defaults
let currentVoltage = '240'; // Default value
let currentMethod = 'HEA';  // Default value
let currentPanelSize = '150'; // Default value
let currentFileName = 'No file selected'; // Default value

// Add global variables to store form values
let storedPanelSize = currentPanelSize;
let storedVoltage = currentVoltage;
let storedMethod = currentMethod;
let storedFileName = currentFileName;

class PanelCalculator {
    constructor() {
        // DOM elements
        this.fileInput = document.getElementById('csvFile');
        this.fileInfo = document.getElementById('fileInfo');
        this.calculateBtn = document.getElementById('calculateBtn');
        this.resultsDiv = document.getElementById('results');
        this.uploadArea = document.querySelector('.upload-area');
        
        // Bind event listeners
        this.initializeEventListeners();

        // Verify Chart.js is loaded
        if (typeof Chart === 'undefined') {
            console.error('Chart.js not loaded');
        }

        // Add sample data handlers
        this.initializeSampleButtons();

        // Add help icon click handler
        this.initializeHelpIcons();
    }

    initializeEventListeners() {
        // File upload handling
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        
        // Calculate button
        this.calculateBtn.addEventListener('click', () => this.processData());

        // Add event listener for voltage input
        const voltageInput = document.getElementById('voltage');
        if (voltageInput) {
            // Set initial value
            currentVoltage = voltageInput.value || '240';
            console.log('Initial voltage:', currentVoltage);
            
            // Update when changed
            voltageInput.addEventListener('input', function() {
                currentVoltage = this.value;
                console.log('Voltage updated:', currentVoltage);
            });
        }
        
        // Add event listeners for method radio buttons
        const methodInputs = document.getElementsByName('method');
        for (let i = 0; i < methodInputs.length; i++) {
            // Set initial value if checked
            if (methodInputs[i].checked) {
                currentMethod = methodInputs[i].value;
                console.log('Initial method:', currentMethod);
            }
            
            // Update when changed
            methodInputs[i].addEventListener('change', function() {
                currentMethod = this.value;
                console.log('Method updated:', currentMethod);
            });
        }
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            this.validateAndUpdateUI(file);
        }
    }

    handleDragOver(event) {
        event.preventDefault();
        event.stopPropagation();
        this.uploadArea.classList.add('drag-active');
    }

    handleDrop(event) {
        event.preventDefault();
        event.stopPropagation();
        this.uploadArea.classList.remove('drag-active');
        
        const file = event.dataTransfer.files[0];
        if (file) {
            this.fileInput.files = event.dataTransfer.files;
            this.validateAndUpdateUI(file);
        }
    }

    validateAndUpdateUI(file) {
        if (file.type !== 'text/csv') {
            this.showError('Please upload a CSV file');
            return;
        }
        this.fileInfo.textContent = `File selected: ${file.name}`;
        this.calculateBtn.disabled = false;
    }

    async processData() {
        try {
            const file = this.fileInput.files[0];
            const data = await this.parseCSV(file);
            
            // Add data analysis
            const analysis = this.analyzeData(data);
            this.showDataInfo(analysis.summary, analysis.details, analysis.warnings);
            
            const results = this.calculatePanelCapacity(data);
            this.displayResults(results);
            this.createChart(data);

            // Update the current method based on the selected radio button
            const methodInputs = document.getElementsByName('method');
            for (let i = 0; i < methodInputs.length; i++) {
                if (methodInputs[i].checked) {
                    currentMethod = methodInputs[i].value;
                    console.log('Method updated in processData:', currentMethod);
                    break;
                }
            }

            // Update the current voltage
            const voltageInput = document.getElementById('voltage');
            if (voltageInput) {
                currentVoltage = voltageInput.value || '240';
                console.log('Voltage updated in processData:', currentVoltage);
            }

            // Store the current form values when calculation is performed
            const panelSizeElement = document.getElementById('panelSize');
            const voltageElement = document.getElementById('voltage');
            const fileInput = document.getElementById('fileInput');
            
            // Store panel size
            storedPanelSize = panelSizeElement ? panelSizeElement.value : '150';
            
            // Store voltage
            storedVoltage = voltageElement ? voltageElement.value : '240';
            
            // Store method - find the checked radio button
            const methodRadios = document.querySelectorAll('input[type="radio"][name="method"], input[type="radio"][value="HEA"], input[type="radio"][value="NEC"], input[type="radio"][value="LBNL"]');
            console.log("Found method radio buttons:", methodRadios.length);
            
            for (let i = 0; i < methodRadios.length; i++) {
                if (methodRadios[i].checked) {
                    storedMethod = methodRadios[i].value;
                    console.log("Method changed to:", storedMethod);
                    break;
                }
            }
            
            // Store filename
            if (fileInput && fileInput.files && fileInput.files.length > 0) {
                storedFileName = fileInput.files[0].name;
            } else {
                storedFileName = 'No file selected';
            }
            
            console.log("Stored values during calculation:", {
                panelSize: storedPanelSize,
                voltage: storedVoltage,
                method: storedMethod,
                fileName: storedFileName
            });
        } catch (error) {
            this.showError(error.message, error.details);
        }
    }

    async parseCSV(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => {
                try {
                    const csvData = event.target.result;
                    const rows = csvData.split('\n');
                    const headers = rows[0].split(',');
                    
                    // Validate CSV structure - only accept kWh
                    const dateTimeIndex = headers.findIndex(h => h.trim().toLowerCase() === 'datetime');
                    const kwhIndex = headers.findIndex(h => h.trim().toLowerCase() === 'kwh');
                    
                    if (dateTimeIndex === -1 || kwhIndex === -1) {
                        throw new Error('CSV must contain DateTime and kWh columns');
                    }

                    // Parse data rows
                    const data = [];
                    const errors = [];
                    let invalidRows = 0;

                    for (let i = 1; i < rows.length; i++) {
                        const row = rows[i].trim();
                        if (!row) continue;

                        const columns = row.split(',');
                        const dateStr = columns[dateTimeIndex]?.trim().replace(/^"|"$/g, '');
                        const kwhStr = columns[kwhIndex]?.trim().replace(/^"|"$/g, '');
                        
                        if (!dateStr || !kwhStr) {
                            errors.push(`Row ${i + 1}: Missing required values`);
                            invalidRows++;
                            continue;
                        }

                        const datetime = new Date(dateStr);
                        const kwh = parseFloat(kwhStr);

                        if (isNaN(datetime.getTime())) {
                            errors.push(`Row ${i + 1}: Invalid date format "${dateStr}"`);
                            invalidRows++;
                            continue;
                        }

                        if (isNaN(kwh)) {
                            errors.push(`Row ${i + 1}: Invalid kWh value "${kwhStr}"`);
                            invalidRows++;
                            continue;
                        }

                        data.push({ datetime, kwh });
                    }

                    if (data.length === 0) {
                        throw new Error('No valid data found in CSV file', { cause: errors });
                    }

                    if (invalidRows > 0) {
                        throw new Error(`Found ${invalidRows} invalid rows`, { cause: errors });
                    }

                    console.log(`Processed ${data.length} valid readings`);
                    resolve(data);
                } catch (error) {
                    error.details = error.cause || [];
                    reject(error);
                }
            };
            reader.onerror = () => reject(new Error('Error reading file'));
            reader.readAsText(file);
        });
    }

    calculatePanelCapacity(data) {
        try {
            // Get panel specifications
            const panelSize = parseFloat(document.getElementById('panelSize').value);
            const panelVoltage = parseFloat(document.getElementById('panelVoltage').value);

            if (isNaN(panelSize) || isNaN(panelVoltage)) {
                throw new Error('Invalid panel specifications');
            }

            // Group by hour and calculate peak load
            const hourlyData = this.groupByHour(data);
            const peakHourlyLoad = this.calculatePeakLoad(hourlyData);
            
            if (isNaN(peakHourlyLoad)) {
                throw new Error('Error calculating peak load');
            }

            // Calculate remaining capacity
            const peakPowerKw = peakHourlyLoad;
            const peakPowerAmps = (peakPowerKw * 1000) / panelVoltage;
            const remainingCapacityKw = (panelSize * panelVoltage / 1000) - (FINAL_CAPACITY_MULTIPLIER * peakPowerKw);
            const remainingCapacityAmps = remainingCapacityKw * 1000 / panelVoltage;

            return {
                peakPowerKw,
                peakPowerAmps,
                remainingCapacityKw,
                remainingCapacityAmps,
                hourlyData
            };
        } catch (error) {
            console.error('Calculation error:', error);
            throw error;
        }
    }

    groupByHour(data) {
        // First, create a unique key for each hour that includes the date
        const hourlyGroups = {};
        data.forEach(reading => {
            const date = reading.datetime.toDateString();
            const hour = reading.datetime.getHours();
            const key = `${date}-${hour}`;
            
            if (!hourlyGroups[key]) {
                hourlyGroups[key] = {
                    readings: [],
                    count: 0
                };
            }
            hourlyGroups[key].readings.push(reading.kwh);
            hourlyGroups[key].count++;
        });
        return hourlyGroups;
    }

    calculatePeakLoad(hourlyData) {
        let peakLoad = 0;
        const calculationMethod = document.getElementById('calculationMethod').value;
        
        Object.entries(hourlyData).forEach(([hour, hourData]) => {
            const { readings } = hourData;
            const hourlyMax = Math.max(...readings);
            const uniqueReadings = new Set(readings).size;
            const readingCount = readings.length;
            
            let adjustedMax;
            
            if (readingCount === 4) {
                // Always apply 4x for 15-minute data (both real and fake)
                adjustedMax = hourlyMax * 4;
                
                // For fake 15-minute data, apply additional multiplier based on method
                if (uniqueReadings === 1) {
                    if (calculationMethod === 'standard') {
                        // Standard method: apply 1.3x
                        adjustedMax *= SINGLE_READING_MULTIPLIER;
                    } else if (calculationMethod === 'lbnl') {
                        // LBNL method for fake 15-minute data
                        // First convert to hourly equivalent
                        const hourlyEquivalent = adjustedMax;
                        
                        // Then apply LBNL formula
                        if (hourlyEquivalent < 7.5) {
                            adjustedMax = 2.2 + 1.4 * hourlyEquivalent;
                        } else {
                            adjustedMax = 5.2 + hourlyEquivalent;
                        }
                    }
                    // NEC method: no additional adjustment
                }
            } else {
                // Single reading (hourly data)
                if (calculationMethod === 'standard') {
                    // Standard method: apply 1.3x
                    adjustedMax = hourlyMax * SINGLE_READING_MULTIPLIER;
                } else if (calculationMethod === 'lbnl') {
                    // LBNL method for hourly data
                    if (hourlyMax < 7.5) {
                        adjustedMax = 2.2 + 1.4 * hourlyMax;
                    } else {
                        adjustedMax = 5.2 + hourlyMax;
                    }
                } else {
                    // NEC method: no adjustment
                    adjustedMax = hourlyMax;
                }
            }
            
            peakLoad = Math.max(peakLoad, adjustedMax);
        });
        
        return peakLoad;
    }

    displayResults(results) {
        // Update result elements
        document.getElementById('peakKw').textContent = results.peakPowerKw.toFixed(2);
        document.getElementById('peakAmps').textContent = results.peakPowerAmps.toFixed(1);
        document.getElementById('remainingKw').textContent = results.remainingCapacityKw.toFixed(2);
        document.getElementById('remainingAmps').textContent = results.remainingCapacityAmps.toFixed(1);
        
        // Add calculation method info
        const methodName = document.getElementById('calculationMethod').options[
            document.getElementById('calculationMethod').selectedIndex
        ].text;
        
        document.getElementById('calculationMethodInfo').textContent = methodName;
        
        // Show results section with animation
        this.resultsDiv.classList.remove('hidden');
        this.resultsDiv.classList.add('fade-in');
    }

    createChart(data) {
        // Get the canvas context
        const ctx = document.getElementById('chartCanvas').getContext('2d');
        
        // Destroy existing chart if it exists
        if (this.chart) {
            this.chart.destroy();
        }

        // Group data by hour
        const hourlyStats = {};
        data.forEach(reading => {
            const hour = reading.datetime.getHours();
            if (!hourlyStats[hour]) {
                hourlyStats[hour] = {
                    values: [],
                    max: -Infinity,
                    min: Infinity,
                    sum: 0,
                    count: 0
                };
            }
            hourlyStats[hour].values.push(reading.kwh);
            hourlyStats[hour].max = Math.max(hourlyStats[hour].max, reading.kwh);
            hourlyStats[hour].min = Math.min(hourlyStats[hour].min, reading.kwh);
            hourlyStats[hour].sum += reading.kwh;
            hourlyStats[hour].count++;
        });

        // Prepare data arrays
        const hours = Array.from(Array(24).keys());
        const maxValues = hours.map(hour => 
            hourlyStats[hour] ? hourlyStats[hour].max : null
        );
        const minValues = hours.map(hour => 
            hourlyStats[hour] ? hourlyStats[hour].min : null
        );
        const meanValues = hours.map(hour => 
            hourlyStats[hour] ? hourlyStats[hour].sum / hourlyStats[hour].count : null
        );

        // Calculate peak line (constant value across all hours)
        const peakValue = Math.max(...Object.values(hourlyStats).map(stat => stat.max));
        const peakValues = Array(24).fill(peakValue);

        // Create chart with all lines
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: hours.map(h => `${h}:00`),
                datasets: [
                    {
                        label: 'Peak',
                        data: peakValues,
                        borderColor: 'rgba(255, 99, 132, 1)',  // Red
                        borderWidth: 2,
                        borderDash: [5, 5],
                        fill: false,
                        pointStyle: 'line',
                        pointRadius: 0,          // Hide individual points
                        pointHoverRadius: 4,     // Show points on hover
                        tension: 0.1            // Slightly smooth the lines
                    },
                    {
                        label: 'Max',
                        data: maxValues,
                        borderColor: 'rgba(54, 162, 235, 1)',  // Blue
                        borderWidth: 2,
                        fill: false,
                        pointStyle: 'line',
                        pointRadius: 0,          // Hide individual points
                        pointHoverRadius: 4,     // Show points on hover
                        tension: 0.1            // Slightly smooth the lines
                    },
                    {
                        label: 'Mean',
                        data: meanValues,
                        borderColor: 'rgba(75, 192, 192, 1)',  // Green
                        borderWidth: 2,
                        fill: false,
                        pointStyle: 'line',
                        pointRadius: 0,          // Hide individual points
                        pointHoverRadius: 4,     // Show points on hover
                        tension: 0.1            // Slightly smooth the lines
                    },
                    {
                        label: 'Min',
                        data: minValues,
                        borderColor: 'rgba(153, 102, 255, 1)',  // Purple
                        borderWidth: 2,
                        fill: false,
                        pointStyle: 'line',
                        pointRadius: 0,          // Hide individual points
                        pointHoverRadius: 4,     // Show points on hover
                        tension: 0.1            // Slightly smooth the lines
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    title: {
                        display: true,
                        text: 'Hourly Load Pattern'
                    },
                    legend: {
                        position: 'bottom',
                        labels: {
                            usePointStyle: true,
                            pointStyle: 'line'
                        }
                    }
                },
                scales: {
                    x: {
                        title: {
                            display: true,
                            text: 'Hour of Day'
                        }
                    },
                    y: {
                        title: {
                            display: true,
                            text: 'kW'
                        },
                        beginAtZero: true,
                        ticks: {
                            callback: function(value) {
                                return value.toFixed(1);  // Consistent decimal places
                            }
                        }
                    }
                },
                interaction: {
                    intersect: false,
                    mode: 'index'  // Shows all values at the same x-position
                },
                animation: {
                    duration: 300  // Smoother transitions when data updates
                }
            }
        });
    }

    showError(message, details = []) {
        this.fileInfo.innerHTML = `
            <div class="error-container">
                <div class="error-summary">${message}</div>
                ${details.length > 0 ? `
                    <button class="error-toggle" onclick="this.nextElementSibling.classList.toggle('hidden')">
                        Show Details (${details.length} issues)
                    </button>
                    <div class="error-details hidden">
                        ${details.map(err => `<div class="error-item">${err}</div>`).join('')}
                    </div>
                ` : ''}
            </div>
        `;
        this.fileInfo.classList.add('error');
        setTimeout(() => {
            this.fileInfo.classList.remove('error');
        }, 10000); // Keep error showing longer since there's more to read
    }

    analyzeData(data) {
        // Sort data by datetime
        const sortedData = [...data].sort((a, b) => a.datetime - b.datetime);
        
        // Get date range
        const firstDate = sortedData[0].datetime;
        const lastDate = sortedData[sortedData.length - 1].datetime;
        const daysCovered = Math.round((lastDate - firstDate) / (1000 * 60 * 60 * 24));

        // Find peak values
        const maxKwh = Math.max(...data.map(d => d.kwh));
        const peakReadings = data
            .filter(d => d.kwh === maxKwh)
            .map(d => `${d.datetime.toLocaleString()}: ${d.kwh.toFixed(3)} kWh`)
            .join(', ');

        // Group data by hour for pattern analysis
        const hourlyGroups = {};
        sortedData.forEach(reading => {
            const hour = reading.datetime.getHours();
            const date = reading.datetime.toDateString();
            const key = `${date}-${hour}`;
            
            if (!hourlyGroups[key]) {
                hourlyGroups[key] = {
                    readings: [],
                    count: 0
                };
            }
            hourlyGroups[key].readings.push(reading.kwh);
            hourlyGroups[key].count++;
        });

        // Analyze patterns
        let has15MinData = false;
        let hasHourlyData = false;
        let hasFake15MinData = false;
        let warnings = [];

        Object.values(hourlyGroups).forEach(hourData => {
            const uniqueReadings = new Set(hourData.readings).size;
            const readingCount = hourData.count;

            if (readingCount === 1) hasHourlyData = true;
            if (readingCount === 4 && uniqueReadings > 1) has15MinData = true;
            if (readingCount === 4 && uniqueReadings === 1) hasFake15MinData = true;
        });

        // Determine data type
        let dataType = [];
        if (hasHourlyData) dataType.push("Hourly");
        if (has15MinData) dataType.push("15-minute");
        if (hasFake15MinData) dataType.push("Fake 15-minute");

        // Add warnings based on data type and duration
        if (has15MinData && !hasHourlyData && !hasFake15MinData) {
            // Only 15-minute data present
            if (daysCovered < 30) {
                warnings.push("Warning! NEC code requires at least 30 days of 15-minute interval data.");
            }
        } else if (hasHourlyData || hasFake15MinData) {
            // Has hourly or fake 15-minute data
            if (daysCovered < 365) {
                warnings.push("Warning! Hourly data detected. NEC code requires at least 1 year of hourly interval data.");
            }
        }
        
        return {
            summary: `Data spans ${daysCovered} days (${firstDate.toLocaleDateString()} to ${lastDate.toLocaleDateString()})`,
            details: [
                `First reading: ${firstDate.toLocaleString()}`,
                `Last reading: ${lastDate.toLocaleString()}`,
                `Total readings: ${data.length}`,
                `Data types detected: ${dataType.join(", ") || "Unknown"}`,
                `Average readings per hour: ${(data.length / Object.keys(hourlyGroups).length).toFixed(1)}`,
                `Average readings per day: ${(data.length / daysCovered).toFixed(1)}`,
                `Number of hours with data: ${Object.keys(hourlyGroups).length}`,
                `Peak reading(s): ${peakReadings}`,
                ...(warnings.length > 0 ? warnings : [])
            ],
            warnings
        };
    }

    showDataInfo(summary, details, warnings = []) {
        const infoHtml = `
            <div class="info-container">
                ${warnings.map(warning => `
                    <div class="warning-message">
                        ${warning}
                    </div>
                `).join('')}
                <div class="info-summary">${summary}</div>
                <button class="info-toggle" onclick="this.nextElementSibling.classList.toggle('hidden')">
                    Show Analysis Details
                </button>
                <div class="info-details hidden">
                    ${details.map(detail => `<div class="info-item">${detail}</div>`).join('')}
                </div>
            </div>
        `;
        
        // Create or update the info display element
        let infoDisplay = document.getElementById('dataInfo');
        if (!infoDisplay) {
            infoDisplay = document.createElement('div');
            infoDisplay.id = 'dataInfo';
            this.resultsDiv.insertBefore(infoDisplay, this.resultsDiv.firstChild);
        }
        infoDisplay.innerHTML = infoHtml;
    }

    initializeSampleButtons() {
        const sampleButtons = document.querySelectorAll('.sample-button');
        sampleButtons.forEach(button => {
            button.addEventListener('click', () => this.loadSampleData(button.dataset.file));
        });
    }

    async loadSampleData(filename) {
        try {
            const response = await fetch(`https://raw.githubusercontent.com/steevschmidt/NEC-220.87-Methods/8b4a650d5075dca3ef04ba7299e70abd778449ab/test_data/${filename}`);
            if (!response.ok) throw new Error('Failed to load sample data');
            
            const csvContent = await response.text();
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const file = new File([blob], filename, { type: 'text/csv' });
            
            // Create a DataTransfer object to update the file input
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            this.fileInput.files = dataTransfer.files;
            
            // Update UI
            this.fileInfo.textContent = `File selected: ${filename}`;
            this.calculateBtn.disabled = false;

            // Process the data directly using the CSV content
            const data = await this.parseCSVContent(csvContent);
            const analysis = this.analyzeData(data);
            this.showDataInfo(analysis.summary, analysis.details, analysis.warnings);
            
            const results = this.calculatePanelCapacity(data);
            this.displayResults(results);
            this.createChart(data);
        } catch (error) {
            this.showError(`Error loading sample data: ${error.message}`);
        }
    }

    // Add new method to parse CSV content directly
    async parseCSVContent(csvContent) {
        try {
            const rows = csvContent.split('\n');
            const headers = rows[0].split(',');
            
            // Validate CSV structure - only accept kWh
            const dateTimeIndex = headers.findIndex(h => h.trim().toLowerCase() === 'datetime');
            const kwhIndex = headers.findIndex(h => h.trim().toLowerCase() === 'kwh');
            
            if (dateTimeIndex === -1 || kwhIndex === -1) {
                throw new Error('CSV must contain DateTime and kWh columns');
            }

            // Parse data rows
            const data = [];
            const errors = [];
            let invalidRows = 0;

            for (let i = 1; i < rows.length; i++) {
                const row = rows[i].trim();
                if (!row) continue;

                const columns = row.split(',');
                const dateStr = columns[dateTimeIndex]?.trim().replace(/^"|"$/g, '');
                const kwhStr = columns[kwhIndex]?.trim().replace(/^"|"$/g, '');
                
                if (!dateStr || !kwhStr) {
                    errors.push(`Row ${i + 1}: Missing required values`);
                    invalidRows++;
                    continue;
                }

                const datetime = new Date(dateStr);
                const kwh = parseFloat(kwhStr);

                if (isNaN(datetime.getTime())) {
                    errors.push(`Row ${i + 1}: Invalid date format "${dateStr}"`);
                    invalidRows++;
                    continue;
                }

                if (isNaN(kwh)) {
                    errors.push(`Row ${i + 1}: Invalid kWh value "${kwhStr}"`);
                    invalidRows++;
                    continue;
                }

                data.push({ datetime, kwh });
            }

            if (data.length === 0) {
                throw new Error('No valid data found in CSV file', { cause: errors });
            }

            if (invalidRows > 0) {
                throw new Error(`Found ${invalidRows} invalid rows`, { cause: errors });
            }

            return data;
        } catch (error) {
            error.details = error.cause || [];
            throw error;
        }
    }

    initializeHelpIcons() {
        document.querySelectorAll('.help-icon').forEach(icon => {
            icon.addEventListener('click', (e) => {
                const article = icon.dataset.article;
                if (article) {
                    window.open(article, '_blank');
                }
            });
        });
    }
}

// Initialize the calculator when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PanelCalculator();
    
    // Add event listener for print button
    const printBtn = document.getElementById('printResultsBtn');
    if (printBtn) {
        printBtn.addEventListener('click', openPrintablePage);
        console.log('Print button event listener attached');
    } else {
        console.error('Print button not found in the DOM');
    }
});

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

// Add event listener for the print button
document.addEventListener('DOMContentLoaded', function() {
    const printBtn = document.getElementById('printResultsBtn');
    if (printBtn) {
        printBtn.addEventListener('click', openPrintablePage);
        console.log('Print button event listener attached');
    } else {
        console.error('Print button not found in the DOM');
    }
}); 