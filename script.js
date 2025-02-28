// Constants for calculations
const SINGLE_READING_MULTIPLIER = 1.3;
const FINAL_CAPACITY_MULTIPLIER = 1.25;

function checkBrowserCompatibility() {
    const incompatibilities = [];
    
    // Check for FileReader API
    if (!window.FileReader) {
        incompatibilities.push('FileReader API is not supported');
    }
    
    // Check for Fetch API
    if (!window.fetch) {
        incompatibilities.push('Fetch API is not supported');
    }
    
    // Check for modern JS features
    try {
        eval('async () => {}');
    } catch (e) {
        incompatibilities.push('Modern JavaScript features are not supported');
    }
    
    if (incompatibilities.length > 0) {
        alert('Your browser may not fully support this application. Please use a modern browser like Chrome, Firefox, or Edge.\n\nIssues detected:\n' + incompatibilities.join('\n'));
    }
}

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

        // Initialize the report issue link
        this.initializeReportIssueLink();
    }

    initializeEventListeners() {
        // File upload handling
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        
        // Calculate button
        this.calculateBtn.addEventListener('click', () => this.processData());
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
            
            // Read file content to detect format
            const fileContent = await this.readFileContent(file);
            const fileFormat = this.detectFileFormat(fileContent);
            
            // Parse data based on detected format
            const data = await this.parseCSV(file);
            
            // Add data analysis with format information
            const analysis = this.analyzeData(data, fileFormat);
            this.showDataInfo(analysis.summary, analysis.details, analysis.warnings);
            
            const results = this.calculatePanelCapacity(data);
            this.displayResults(results);
            this.createChart(data);
        } catch (error) {
            this.showError(error.message, error.details);
        }
    }

    async parseCSV(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file selected. Please upload a CSV file.'));
                return;
            }
            
            if (file.size > 5 * 1024 * 1024) { // 10MB limit
                reject(new Error('File is too large. Maximum file size is 5MB.'));
                return;
            }
            
            const reader = new FileReader();
            reader.onload = async (event) => {
                try {
                    const csvContent = event.target.result;
                    
                    // Detect file format
                    const format = this.detectFileFormat(csvContent);
                    
                    // Parse based on detected format
                    let data;
                    if (format === 'standard') {
                        data = await this.parseStandardCSV(csvContent);
                    } else if (format === 'pge') {
                        data = await this.parsePGECSV(csvContent);
                    }
                    
                    console.log(`Processed ${data.length} valid readings from ${format} format`);
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

    async parseStandardCSV(csvContent) {
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
    }

    async parsePGECSV(csvContent) {
        const rows = csvContent.split('\n');
        const data = [];
        const errors = [];
        let invalidRows = 0;
        
        // Find the header row (contains TYPE, DATE, START TIME, etc.)
        let headerRowIndex = -1;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].includes('TYPE,DATE,START TIME,END TIME,USAGE (kWh)')) {
                headerRowIndex = i;
                break;
            }
        }
        
        if (headerRowIndex === -1) {
            throw new Error('Invalid PG&E file format. Could not find header row.');
        }
        
        const headers = rows[headerRowIndex].split(',');
        const dateIndex = headers.findIndex(h => h.trim() === 'DATE');
        const startTimeIndex = headers.findIndex(h => h.trim() === 'START TIME');
        const usageIndex = headers.findIndex(h => h.trim() === 'USAGE (kWh)');
        
        if (dateIndex === -1 || startTimeIndex === -1 || usageIndex === -1) {
            throw new Error('Invalid PG&E file format. Missing required columns.');
        }
        
        // Parse data rows (skip header row)
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i].trim();
            if (!row || !row.startsWith('Electric usage')) continue;
            
            const columns = this.parseCSVRow(row); // Handle quoted values properly
            const dateStr = columns[dateIndex]?.trim();
            const timeStr = columns[startTimeIndex]?.trim();
            const kwhStr = columns[usageIndex]?.trim();
            
            if (!dateStr || !timeStr || !kwhStr) {
                errors.push(`Row ${i + 1}: Missing required values`);
                invalidRows++;
                continue;
            }
            
            // Parse date and time (MM/DD/YY format)
            try {
                // Combine date and time
                const dateTimeStr = `${dateStr} ${timeStr}`;
                const datetime = this.parsePGEDateTime(dateTimeStr);
                const kwh = parseFloat(kwhStr);
                
                if (isNaN(kwh)) {
                    errors.push(`Row ${i + 1}: Invalid kWh value "${kwhStr}"`);
                    invalidRows++;
                    continue;
                }
                
                data.push({ datetime, kwh });
            } catch (error) {
                errors.push(`Row ${i + 1}: ${error.message}`);
                invalidRows++;
            }
        }
        
        if (data.length === 0) {
            throw new Error('No valid data found in PG&E file', { cause: errors });
        }
        
        if (invalidRows > 0) {
            throw new Error(`Found ${invalidRows} invalid rows`, { cause: errors });
        }
        
        return data;
    }

    parsePGEDateTime(dateTimeStr) {
        // PG&E format: MM/DD/YY HH:MM
        const parts = dateTimeStr.split(' ');
        if (parts.length !== 2) {
            throw new Error(`Invalid date/time format: ${dateTimeStr}`);
        }
        
        const dateParts = parts[0].split('/');
        if (dateParts.length !== 3) {
            throw new Error(`Invalid date format: ${parts[0]}`);
        }
        
        let year = parseInt(dateParts[2]);
        // Handle 2-digit year (assume 20xx for years less than 50, 19xx otherwise)
        if (year < 100) {
            year = year < 50 ? 2000 + year : 1900 + year;
        }
        
        const month = parseInt(dateParts[0]) - 1; // JavaScript months are 0-indexed
        const day = parseInt(dateParts[1]);
        
        const timeParts = parts[1].split(':');
        if (timeParts.length !== 2) {
            throw new Error(`Invalid time format: ${parts[1]}`);
        }
        
        const hour = parseInt(timeParts[0]);
        const minute = parseInt(timeParts[1]);
        
        const datetime = new Date(year, month, day, hour, minute);
        if (isNaN(datetime.getTime())) {
            throw new Error(`Could not parse date/time: ${dateTimeStr}`);
        }
        
        return datetime;
    }

    parseCSVRow(row) {
        const result = [];
        let current = '';
        let inQuotes = false;
        
        for (let i = 0; i < row.length; i++) {
            const char = row[i];
            
            if (char === '"') {
                inQuotes = !inQuotes;
            } else if (char === ',' && !inQuotes) {
                result.push(current);
                current = '';
            } else {
                current += char;
            }
        }
        
        // Add the last field
        result.push(current);
        return result;
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
            
            // Calculate total panel capacity in kW
            const totalPanelCapacityKw = panelSize * panelVoltage / 1000;
            
            // Apply the NEC safety factor (1.25) to the peak load when calculating remaining capacity
            const remainingCapacityKw = totalPanelCapacityKw - (FINAL_CAPACITY_MULTIPLIER * peakPowerKw);
            const remainingCapacityAmps = panelSize - (FINAL_CAPACITY_MULTIPLIER * peakPowerAmps);

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
        
        const remainingKwElement = document.getElementById('remainingKw');
        const remainingAmpsElement = document.getElementById('remainingAmps');
        
        remainingKwElement.textContent = results.remainingCapacityKw.toFixed(2);
        remainingAmpsElement.textContent = results.remainingCapacityAmps.toFixed(1);
        
        // Add negative class if remaining capacity is negative
        const remainingValueContainer = remainingKwElement.closest('.result-value');
        if (results.remainingCapacityKw < 0) {
            remainingValueContainer.classList.add('negative-value');
        } else {
            remainingValueContainer.classList.remove('negative-value');
        }
        
        // Show results section with animation
        this.resultsDiv.classList.remove('hidden');
        this.resultsDiv.classList.add('fade-in');

        // Add export button to results section
        const exportBtn = document.getElementById('exportResultsBtn');
        if (exportBtn) {
            exportBtn.classList.remove('hidden');
            exportBtn.addEventListener('click', () => this.exportResults());
        }
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

    analyzeData(data, fileFormat = 'standard') {
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
        
        // Get the calculation method name
        const methodElement = document.getElementById('calculationMethod');
        const methodName = methodElement.options[methodElement.selectedIndex].text;
        
        // Add warnings for suspicious data patterns
        if (maxKwh > 50) {
            warnings.push("Warning! Unusually high kWh values detected. Please verify your data is in kWh (not Wh).");
        }

        // Check for large gaps in data
        const sortedTimes = sortedData.map(d => d.datetime.getTime());
        const timeDiffs = [];
        for (let i = 1; i < sortedTimes.length; i++) {
            timeDiffs.push(sortedTimes[i] - sortedTimes[i-1]);
        }
        const maxGapHours = Math.max(...timeDiffs) / (1000 * 60 * 60);
        if (maxGapHours > 24) {
            warnings.push(`Warning! Data contains gaps. Largest gap is ${maxGapHours.toFixed(1)} hours.`);
        }
        
        return {
            summary: `Data spans ${daysCovered} days (${firstDate.toLocaleDateString()} to ${lastDate.toLocaleDateString()})`,
            details: [
                `File format: ${fileFormat === 'pge' ? 'PG&E Energy Usage Export' : 'Standard CSV'}`,
                `First reading: ${firstDate.toLocaleString()}`,
                `Last reading: ${lastDate.toLocaleString()}`,
                `Total readings: ${data.length}`,
                `Data types detected: ${dataType.join(", ") || "Unknown"}`,
                `Average readings per hour: ${(data.length / Object.keys(hourlyGroups).length).toFixed(1)}`,
                `Average readings per day: ${(data.length / daysCovered).toFixed(1)}`,
                `Number of hours with data: ${Object.keys(hourlyGroups).length}`,
                `Peak reading(s): ${peakReadings}`,
                `Calculation method: ${methodName}`,
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
            // Get format from button data attribute if available
            const button = document.querySelector(`.sample-button[data-file="${filename}"]`);
            const format = button ? button.dataset.format : null;
            
            const response = await fetch(`https://raw.githubusercontent.com/steevschmidt/NEC-220.87-Methods/refs/heads/main/test_data/${filename}`);
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

            // Add format info to the message
            const formatName = format === 'pge' ? 'PG&E' : 'standard';
            this.showInfo(`Sample data "${filename}" (${formatName} format) loaded. Click Calculate to process.`);
        } catch (error) {
            this.showError(`Error loading sample data: ${error.message}`);
        }
    }

    // Add a new method to show informational messages
    showInfo(message) {
        this.fileInfo.innerHTML = `
            <div class="info-container">
                <div class="info-message">${message}</div>
            </div>
        `;
        this.fileInfo.classList.add('info');
        setTimeout(() => {
            this.fileInfo.classList.remove('info');
        }, 5000);
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

    detectFileFormat(csvContent) {
        // Check for PG&E format (has header with Name, Address, etc.)
        if (csvContent.includes('Name,') && csvContent.includes('Address,') && 
            csvContent.includes('Account Number,')) {
            return 'pge';
        }
        
        // Check for standard format (has DateTime and kWh columns)
        const firstLine = csvContent.split('\n')[0].toLowerCase();
        if (firstLine.includes('datetime') && firstLine.includes('kwh')) {
            return 'standard';
        }
        
        // Unknown format
        throw new Error('Unsupported file format. Please upload a valid CSV file with either DateTime and kWh columns, or a PG&E energy usage export.');
    }

    // Helper method to read file content
    readFileContent(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = (event) => resolve(event.target.result);
            reader.onerror = () => reject(new Error('Error reading file'));
            reader.readAsText(file);
        });
    }

    async importFromAPI(provider, credentials) {
        try {
            this.showInfo(`Connecting to ${provider} API...`);
            
            // This would be implemented for each provider
            let data;
            if (provider === 'utilityapi') {
                data = await this.importFromUtilityAPI(credentials);
            } else if (provider === 'hea') {
                data = await this.importFromHEA(credentials);
            } else {
                throw new Error(`Unsupported API provider: ${provider}`);
            }
            
            // Process the data as usual
            const analysis = this.analyzeData(data, provider);
            this.showDataInfo(analysis.summary, analysis.details, analysis.warnings);
            
            const results = this.calculatePanelCapacity(data);
            this.displayResults(results);
            this.createChart(data);
            
            return data;
        } catch (error) {
            this.showError(`API Import Error: ${error.message}`);
            throw error;
        }
    }

    // Placeholder methods for future API integrations
    async importFromUtilityAPI(credentials) {
        // This would be implemented when ready
        throw new Error('UtilityAPI integration not yet implemented');
    }

    async importFromHEA(credentials) {
        // This would be implemented when ready
        throw new Error('HEA API integration not yet implemented');
    }

    exportResults() {
        try {
            // Get current results
            const peakKw = document.getElementById('peakKw').textContent;
            const peakAmps = document.getElementById('peakAmps').textContent;
            const remainingKw = document.getElementById('remainingKw').textContent;
            const remainingAmps = document.getElementById('remainingAmps').textContent;
            
            // Get input parameters
            const panelSize = document.getElementById('panelSize').value;
            const voltage = document.getElementById('panelVoltage').value;
            const methodElement = document.getElementById('calculationMethod');
            const method = methodElement.options[methodElement.selectedIndex].text;
            
            // Create CSV content
            const csvContent = [
                'Parameter,Value',
                `Panel Size,${panelSize} A`,
                `Voltage,${voltage} V`,
                `Calculation Method,${method}`,
                `Peak Power,${peakKw} kW`,
                `Peak Current,${peakAmps} A`,
                `Remaining Capacity,${remainingKw} kW`,
                `Remaining Current,${remainingAmps} A`,
                `Date Generated,${new Date().toLocaleString()}`
            ].join('\n');
            
            // Create download link
            const blob = new Blob([csvContent], { type: 'text/csv' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = 'panel_capacity_results.csv';
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            
            this.showInfo('Results exported successfully');
        } catch (error) {
            this.showError(`Error exporting results: ${error.message}`);
        }
    }

    initializeReportIssueLink() {
        const reportLink = document.querySelector('.report-issue-link');
        if (reportLink) {
            reportLink.addEventListener('click', (e) => {
                // Get current app state
                const panelSize = document.getElementById('panelSize').value || 'Not set';
                const voltage = document.getElementById('panelVoltage').value || 'Not set';
                const methodElement = document.getElementById('calculationMethod');
                const method = methodElement ? methodElement.options[methodElement.selectedIndex].text : 'Not set';
                
                // Get browser info
                const browserInfo = `${navigator.userAgent}`;
                
                // Create email body
                const body = `
Issue Description:
[Please describe the issue you encountered]

System Information:
- Browser: ${browserInfo}
- Panel Size: ${panelSize} A
- Voltage: ${voltage} V
- Calculation Method: ${method}
- App Version: v1.0.0
- Date: ${new Date().toISOString()}

Steps to Reproduce:
[Please describe the steps you took when the issue occurred]
                `.trim();
                
                // Update the mailto link
                const mailtoUrl = `mailto:steve@hea.com?subject=Panel%20Calculator%20Issue%20Report&body=${encodeURIComponent(body)}`;
                reportLink.href = mailtoUrl;
            });
        }
    }
}

// Initialize the calculator when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    checkBrowserCompatibility();
    new PanelCalculator();
    
    // Add event listener for print button
    const printBtn = document.getElementById('printResultsBtn');
    if (printBtn) {
        printBtn.addEventListener('click', openPrintablePage);
    }
});