// Constants for version and calculations
let APP_VERSION = 'v0.3.1'; // Initial value, may be updated by version.js
window.APP_VERSION = APP_VERSION; // Make it accessible globally
const HEA_SINGLE_READING_MULTIPLIER = 1.3;
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

// Add instructions toggle functionality
function initializeInstructionsToggle() {
    const showButton = document.getElementById('showDetailedInstructions');
    const hideButton = document.getElementById('hideDetailedInstructions');
    const detailedInstructions = document.getElementById('detailedInstructions');
    
    if (showButton && hideButton && detailedInstructions) {
        showButton.addEventListener('click', () => {
            detailedInstructions.classList.remove('hidden');
            detailedInstructions.classList.add('fade-in');
        });
        
        hideButton.addEventListener('click', () => {
            detailedInstructions.classList.add('hidden');
            detailedInstructions.classList.remove('fade-in');
        });
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
        this.methodSelectorContainer = document.getElementById('methodSelectorContainer');
        
        // Data state
        this.currentData = null;
        this.currentFileFormat = null;
        this.dataAnalysis = null;
        this.needsMethodSelection = false;
        
        // Bind event listeners
        this.initializeEventListeners();

        // Verify Chart.js is loaded
        if (typeof Chart === 'undefined') {
            this.log('Chart.js not loaded', 'error');
        }

        // Add sample data handlers
        this.initializeSampleButtons();

        // Add help icon click handler
        this.initializeHelpIcons();

        // Initialize the report issue link
        this.initializeReportIssueLink();
        
        // Add window resize handler to ensure charts are properly sized on mobile
        window.addEventListener('resize', () => {
            if (this.chart) {
                // Force chart to resize properly
                this.chart.resize();
            }
        });
    }

    initializeEventListeners() {
        // File upload handling
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
        this.uploadArea.addEventListener('dragover', (e) => this.handleDragOver(e));
        this.uploadArea.addEventListener('drop', (e) => this.handleDrop(e));
        
        // Calculate button - ensure this is the only place that triggers calculation
        this.calculateBtn.addEventListener('click', (e) => {
            e.preventDefault(); // Prevent any default behavior
            console.log('Calculate button clicked');
            this.processCalculation();
        });
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (file) {
            // Clear any previous results
            this.clearResults();
            
            this.validateAndProcessFile(file);
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
            // Clear any previous results
            this.clearResults();
            
            this.fileInput.files = event.dataTransfer.files;
            this.validateAndProcessFile(file);
        }
    }

    async validateAndProcessFile(file) {
        if (file.type !== 'text/csv') {
            this.showError('Please upload a CSV file');
            return;
        }
        
        this.fileInfo.textContent = `File selected: ${file.name}`;
        
        try {
            // Read file content to detect format
            const fileContent = await this.readFileContent(file);
            const fileFormat = this.detectFileFormat(fileContent);
            
            // Parse data based on detected format
            const data = await this.parseCSV(file);
            
            // Analyze the data
            const analysis = this.analyzeData(data, fileFormat);
            
            // Store the data and analysis for later use
            this.currentData = data;
            this.currentFileFormat = fileFormat;
            this.dataAnalysis = analysis;
            
            // Update UI based on data analysis
            this.updateUIBasedOnDataAnalysis(analysis);
            
            // Show data info
            this.showDataInfo(analysis.summary, analysis.details, analysis.warnings);
            
            // Enable calculate button
            this.calculateBtn.disabled = false;
            
        } catch (error) {
            this.showError(error.message, error.details);
        }
    }
    
    updateUIBasedOnDataAnalysis(analysis) {
        // Check if we need to show the method selector
        const hasHourlyData = analysis.dataTypes.includes("Hourly");
        const hasFake15MinData = analysis.dataTypes.includes("Fake 15-minute");
        
        this.needsMethodSelection = hasHourlyData || hasFake15MinData;
        
        // Show/hide method selector based on data type
        if (this.needsMethodSelection) {
            this.methodSelectorContainer.classList.remove('hidden');
            
            // Remove any existing notification
            const existingNotification = document.querySelector('.method-info-notification');
            if (existingNotification) {
                existingNotification.parentNode.removeChild(existingNotification);
            }
            
            // Show notification about method selection
            const methodInfo = document.createElement('div');
            methodInfo.className = 'method-info-notification';
            methodInfo.innerHTML = `
                <div class="info-message">
                    <strong>Hourly or pseudo-15-minute data detected.</strong> 
                    Please select a calculation method for this type of data.
                    <button class="close-notification">×</button>
                </div>
            `;
            
            // Insert after file info instead of method selector
            this.fileInfo.parentNode.insertBefore(
                methodInfo, 
                this.fileInfo.nextSibling
            );
            
            // Add close button handler
            const closeButton = methodInfo.querySelector('.close-notification');
            if (closeButton) {
                closeButton.addEventListener('click', () => {
                    console.log('Close button clicked');
                    if (methodInfo.parentNode) {
                        methodInfo.parentNode.removeChild(methodInfo);
                    }
                });
            }
        } else {
            this.methodSelectorContainer.classList.add('hidden');
        }

        // Handle seasonal load input based on data duration
        const seasonalLoadContainer = document.getElementById('seasonalLoadContainer');
        if (analysis.daysCovered < 365) {
            // Show seasonal load input when data covers less than a year
            seasonalLoadContainer.classList.remove('hidden');
            
            // Add a notification about seasonal load
            const existingSeasonalNotification = document.querySelector('.seasonal-info-notification');
            if (!existingSeasonalNotification) {
                const seasonalInfo = document.createElement('div');
                seasonalInfo.className = 'seasonal-info-notification';
                seasonalInfo.innerHTML = `
                    <div class="info-message">
                        <strong>Less than a year of data detected.</strong> 
                        Seasonal load will be added to account for potential seasonal variations.
                        <button class="close-notification">×</button>
                    </div>
                `;
                
                // Insert after method info or file info
                const insertAfter = document.querySelector('.method-info-notification') || this.fileInfo;
                insertAfter.parentNode.insertBefore(
                    seasonalInfo, 
                    insertAfter.nextSibling
                );
                
                // Add close button handler
                const closeButton = seasonalInfo.querySelector('.close-notification');
                if (closeButton) {
                    closeButton.addEventListener('click', () => {
                        if (seasonalInfo.parentNode) {
                            seasonalInfo.parentNode.removeChild(seasonalInfo);
                        }
                    });
                }
            }
        } else {
            // Hide seasonal load input when data covers a full year or more
            seasonalLoadContainer.classList.add('hidden');
            
            // Remove any existing seasonal notification
            const existingSeasonalNotification = document.querySelector('.seasonal-info-notification');
            if (existingSeasonalNotification) {
                existingSeasonalNotification.parentNode.removeChild(existingSeasonalNotification);
            }
        }
    }

    async processCalculation() {
        console.log('processCalculation called');
        try {
            if (!this.currentData) {
                throw new Error('No data available. Please upload a CSV file first.');
            }
            
            const results = this.calculatePanelCapacity(this.currentData);
            this.displayResults(results);
            this.createChart(this.currentData);
        } catch (error) {
            this.showError(error.message, error.details);
        }
    }

    async processData() {
        // This method is kept for backward compatibility
        // but now just calls processCalculation
        this.processCalculation();
    }

    async parseCSV(file) {
        return new Promise((resolve, reject) => {
            if (!file) {
                reject(new Error('No file selected. Please upload a CSV file.'));
                return;
            }
            
            if (file.size > 5 * 1024 * 1024) { // 5MB limit
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
                    if (format === 'simple') {
                        data = await this.parseSimpleCSV(csvContent);
                    } else if (format === 'pge') {
                        data = await this.parsePGECSV(csvContent);
                    } else if (format === 'pge-pv') {
                        data = await this.parsePGEPVCSV(csvContent);
                    }
                    
                    this.log(`Processed ${data.length} valid readings from ${format} format`, 'info');
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

    async parseSimpleCSV(csvContent) {
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

    async parsePGEPVCSV(csvContent) {
        const rows = csvContent.split('\n');
        const data = [];
        const errors = [];
        let invalidRows = 0;
        
        // Find the header row (contains TYPE, DATE, START TIME, etc.)
        let headerRowIndex = -1;
        for (let i = 0; i < rows.length; i++) {
            if (rows[i].includes('TYPE,DATE,START TIME,END TIME,IMPORT (kWh),EXPORT (kWh)')) {
                headerRowIndex = i;
                break;
            }
        }
        
        if (headerRowIndex === -1) {
            throw new Error('Invalid PG&E PV file format. Could not find header row.');
        }
        
        const headers = rows[headerRowIndex].split(',');
        const dateIndex = headers.findIndex(h => h.trim() === 'DATE');
        const startTimeIndex = headers.findIndex(h => h.trim() === 'START TIME');
        const importIndex = headers.findIndex(h => h.trim() === 'IMPORT (kWh)');
        const exportIndex = headers.findIndex(h => h.trim() === 'EXPORT (kWh)');
        
        if (dateIndex === -1 || startTimeIndex === -1 || importIndex === -1 || exportIndex === -1) {
            throw new Error('Invalid PG&E PV file format. Missing required columns.');
        }
        
        // Parse data rows (skip header row)
        for (let i = headerRowIndex + 1; i < rows.length; i++) {
            const row = rows[i].trim();
            if (!row || !row.startsWith('Electric usage')) continue;
            
            const columns = this.parseCSVRow(row); // Handle quoted values properly
            const dateStr = columns[dateIndex]?.trim();
            const timeStr = columns[startTimeIndex]?.trim();
            const importStr = columns[importIndex]?.trim();
            const exportStr = columns[exportIndex]?.trim();
            
            if (!dateStr || !timeStr || !importStr || !exportStr) {
                errors.push(`Row ${i + 1}: Missing required values`);
                invalidRows++;
                continue;
            }
            
            // Parse date and time (MM/DD/YY format)
            try {
                // Combine date and time
                const dateTimeStr = `${dateStr} ${timeStr}`;
                const datetime = this.parsePGEDateTime(dateTimeStr);
                const importKwh = parseFloat(importStr);
                const exportKwh = parseFloat(exportStr);
                
                if (isNaN(importKwh) || isNaN(exportKwh)) {
                    errors.push(`Row ${i + 1}: Invalid kWh value - Import: "${importStr}", Export: "${exportStr}"`);
                    invalidRows++;
                    continue;
                }
                
                // Use import value as the kWh value (consumption from grid)
                data.push({ datetime, kwh: importKwh });
            } catch (error) {
                errors.push(`Row ${i + 1}: ${error.message}`);
                invalidRows++;
            }
        }
        
        if (data.length === 0) {
            throw new Error('No valid data found in PG&E PV file', { cause: errors });
        }
        
        if (invalidRows > 0) {
            throw new Error(`Found ${invalidRows} invalid rows`, { cause: errors });
        }
        
        return data;
    }

    parsePGEDateTime(dateTimeStr) {
        // Split date and time
        const parts = dateTimeStr.split(' ');
        if (parts.length !== 2) {
            throw new Error(`Invalid date/time format: ${dateTimeStr}`);
        }
        
        const dateStr = parts[0];
        const timeStr = parts[1];
        
        // Check if date format is YYYY-MM-DD or MM/DD/YY
        let year, month, day;
        
        if (dateStr.includes('-')) {
            // Handle YYYY-MM-DD format
            const dateParts = dateStr.split('-');
            if (dateParts.length !== 3) {
                throw new Error(`Invalid date format: ${dateStr}`);
            }
            
            year = parseInt(dateParts[0]);
            month = parseInt(dateParts[1]) - 1; // JavaScript months are 0-indexed
            day = parseInt(dateParts[2]);
        } else if (dateStr.includes('/')) {
            // Handle MM/DD/YY format
            const dateParts = dateStr.split('/');
            if (dateParts.length !== 3) {
                throw new Error(`Invalid date format: ${dateStr}`);
            }
            
            let yearPart = parseInt(dateParts[2]);
            // Handle 2-digit year (assume 20xx for years less than 50, 19xx otherwise)
            if (yearPart < 100) {
                yearPart = yearPart < 50 ? 2000 + yearPart : 1900 + yearPart;
            }
            
            year = yearPart;
            month = parseInt(dateParts[0]) - 1; // JavaScript months are 0-indexed
            day = parseInt(dateParts[1]);
        } else {
            throw new Error(`Unsupported date format: ${dateStr}`);
        }
        
        // Parse time (HH:MM)
        const timeParts = timeStr.split(':');
        if (timeParts.length < 2) {
            throw new Error(`Invalid time format: ${timeStr}`);
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

            // Check if we need to add seasonal load
            let peakPowerKw = peakHourlyLoad;
            const needsSeasonalLoad = this.dataAnalysis && this.dataAnalysis.daysCovered < 365;
            
            if (needsSeasonalLoad) {
                // Get seasonal load value in watts and convert to kW
                const seasonalLoad = parseFloat(document.getElementById('seasonalLoad').value) / 1000;
                if (!isNaN(seasonalLoad)) {
                    peakPowerKw += seasonalLoad;
                    console.log(`Added seasonal load of ${seasonalLoad} kW. New peak: ${peakPowerKw} kW`);
                }
            }
            
            const peakPowerAmps = (peakPowerKw * 1000) / panelVoltage;
            
            // Calculate total panel capacity in kW
            const totalPanelCapacityKw = panelSize * panelVoltage / 1000;
            
            // Calculate NEC Safety Factor (using FINAL_CAPACITY_MULTIPLIER)
            const safetyFactorKw = (FINAL_CAPACITY_MULTIPLIER - 1) * peakPowerKw;
            const safetyFactorAmps = (FINAL_CAPACITY_MULTIPLIER - 1) * peakPowerAmps;
            
            // Calculate available capacity
            const availableCapacityKw = totalPanelCapacityKw - (FINAL_CAPACITY_MULTIPLIER * peakPowerKw);
            const availableCapacityAmps = panelSize - (FINAL_CAPACITY_MULTIPLIER * peakPowerAmps);

            return {
                peakPowerKw,
                peakPowerAmps,
                safetyFactorKw,
                safetyFactorAmps,
                availableCapacityKw,
                availableCapacityAmps,
                hourlyData,
                seasonalLoadApplied: needsSeasonalLoad
            };
        } catch (error) {
            this.log('Calculation error: ' + error, 'error');
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
                    if (calculationMethod === 'hea') {
                        // HEA method: apply 1.3x
                        adjustedMax *= HEA_SINGLE_READING_MULTIPLIER;
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
                if (calculationMethod === 'hea') {
                    // HEA method: apply 1.3x
                    adjustedMax = hourlyMax * HEA_SINGLE_READING_MULTIPLIER;
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
        if (!results) return;
        
        // Update display elements with results
        document.getElementById('peakKw').textContent = results.peakPowerKw.toFixed(1);
        document.getElementById('peakAmps').textContent = results.peakPowerAmps.toFixed(1);
        
        document.getElementById('unusedKw').textContent = results.safetyFactorKw.toFixed(1);
        document.getElementById('unusedAmps').textContent = results.safetyFactorAmps.toFixed(1);
        
        document.getElementById('availableKw').textContent = results.availableCapacityKw.toFixed(1);
        document.getElementById('availableAmps').textContent = results.availableCapacityAmps.toFixed(1);
        
        // Add negative-value class for negative values
        const unusedValueElement = document.getElementById('unusedKw').parentElement;
        const availableValueElement = document.getElementById('availableKw').parentElement;
        
        if (results.safetyFactorKw < 0) {
            unusedValueElement.classList.add('negative-value');
        } else {
            unusedValueElement.classList.remove('negative-value');
        }
        
        if (results.availableCapacityKw < 0) {
            availableValueElement.classList.add('negative-value');
        } else {
            availableValueElement.classList.remove('negative-value');
        }
        
        // Show results section
        this.resultsDiv.classList.remove('hidden');
        
        // Scroll to results
        this.scrollToResults();
        
        // Show seasonal load note if applied
        const existingSeasonalNote = document.querySelector('.seasonal-load-applied');
        if (existingSeasonalNote) {
            existingSeasonalNote.parentNode.removeChild(existingSeasonalNote);
        }
        
        if (results.seasonalLoadApplied) {
            const seasonalLoad = parseFloat(document.getElementById('seasonalLoad').value) / 1000;
            const seasonalNote = document.createElement('div');
            seasonalNote.className = 'seasonal-load-applied info-note';
            seasonalNote.innerHTML = `Includes seasonal adjustment of ${seasonalLoad.toFixed(2)} kW`;
            
            // Add the note below the peak power result
            const peakPowerCard = document.querySelector('.result-card');
            if (peakPowerCard) {
                peakPowerCard.appendChild(seasonalNote);
            }
        }
        
        // Enable export button if it exists
        const exportBtn = document.getElementById('exportResultsBtn');
        if (exportBtn) {
            exportBtn.classList.remove('hidden');
            
            // Add click event listener (remove any existing ones first)
            exportBtn.removeEventListener('click', this.handleExportClick);
            exportBtn.addEventListener('click', this.handleExportClick.bind(this));
        }
        
        // Update the panel visualization
        if (typeof updatePanelVisualization === 'function') {
            updatePanelVisualization();
        }
    }

    // New method to handle export button click with visual effect
    handleExportClick(event) {
        const btn = event.target;
        
        // Add visual feedback
        const originalText = btn.innerHTML;
        btn.innerHTML = `
            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="currentColor" viewBox="0 0 16 16" style="margin-right: 5px;">
                <path d="M8.53 3.97a.75.75 0 0 0-1.06 0l-2 2a.75.75 0 1 0 1.06 1.06l.72-.72v5.19a.75.75 0 0 0 1.5 0V6.31l.72.72a.75.75 0 1 0 1.06-1.06l-2-2Z"/>
                <path d="M2 13.5A2.5 2.5 0 0 0 4.5 16h7a2.5 2.5 0 0 0 2.5-2.5v-2a.75.75 0 0 0-1.5 0v2c0 .55-.45 1-1 1h-7c-.55 0-1-.45-1-1v-2a.75.75 0 0 0-1.5 0v2Z"/>
            </svg>
            Exporting...
        `;
        btn.disabled = true;
        
        // Execute the export with a slight delay for the visual effect
        setTimeout(() => {
            this.exportResults();
            
            // Reset button after a short delay
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
            }, 700);
        }, 300);
    }

    scrollToResults() {
        // Smooth scroll to results section
        this.resultsDiv.scrollIntoView({ 
            behavior: 'smooth', 
            block: 'start'
        });
    }

    createChart(data) {
        // Get the canvas context
        const ctx = document.getElementById('chartCanvas').getContext('2d');
        
        // Destroy existing chart if it exists
        if (this.chart) {
            this.chart.destroy();
        }
        
        // Initialize the panel visualization canvas if it exists
        const panelVisCanvas = document.getElementById('panelVisCanvas');
        if (panelVisCanvas) {
            // Set the canvas size to match its container
            const container = panelVisCanvas.parentElement;
            panelVisCanvas.width = container.clientWidth;
            panelVisCanvas.height = container.clientHeight;
            
            // Call the panel visualization update function if available
            if (typeof updatePanelVisualization === 'function') {
                updatePanelVisualization();
            }
        }

        // Set the chart canvas size to match its container
        const chartCanvas = document.getElementById('chartCanvas');
        const chartContainer = chartCanvas.parentElement;
        chartCanvas.width = chartContainer.clientWidth;
        chartCanvas.height = chartContainer.clientHeight;

        // Get the final peak power value that's already calculated and displayed
        // This ensures the chart matches the Peak Power display exactly
        const peakPowerElement = document.getElementById('peakKw');
        let finalPeakPowerKw = 0;
        if (peakPowerElement && peakPowerElement.textContent !== '-') {
            finalPeakPowerKw = parseFloat(peakPowerElement.textContent);
        }

        // Group data by hour and apply the same conversion logic as calculatePeakLoad
        const hourlyStats = {};
        const calculationMethod = document.getElementById('calculationMethod').value;
        
        // First, group the raw data by hour
        const hourlyGroups = {};
        data.forEach(reading => {
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

        // Now process each hour using the same logic as calculatePeakLoad
        Object.entries(hourlyGroups).forEach(([key, hourData]) => {
            const hour = parseInt(key.split('-')[1]);
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
                    if (calculationMethod === 'hea') {
                        // HEA method: apply 1.3x
                        adjustedMax *= HEA_SINGLE_READING_MULTIPLIER;
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
                if (calculationMethod === 'hea') {
                    // HEA method: apply 1.3x
                    adjustedMax = hourlyMax * HEA_SINGLE_READING_MULTIPLIER;
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

            // Initialize hourlyStats for this hour if not exists
            if (!hourlyStats[hour]) {
                hourlyStats[hour] = {
                    values: [],
                    max: -Infinity,
                    min: Infinity,
                    sum: 0,
                    count: 0
                };
            }
            
            // Store the adjusted kW value
            hourlyStats[hour].values.push(adjustedMax);
            hourlyStats[hour].max = Math.max(hourlyStats[hour].max, adjustedMax);
            hourlyStats[hour].min = Math.min(hourlyStats[hour].min, adjustedMax);
            hourlyStats[hour].sum += adjustedMax;
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

        // Use the final peak power value that's already calculated and displayed
        // This ensures the chart matches the Peak Power display exactly
        const peakValues = Array(24).fill(finalPeakPowerKw);

        // Get panel voltage for amp calculations
        const panelVoltage = parseFloat(document.getElementById('panelVoltage')?.value || '240');
        
        // Calculate amp range for right Y-axis using the final peak power value
        const maxKwValue = Math.max(finalPeakPowerKw, ...Object.values(hourlyStats).map(stat => stat.max));
        const maxAmpsValue = (maxKwValue * 1000) / panelVoltage;
        
        // Round the max amps to a nice round number for better axis readability
        const roundedMaxAmps = Math.ceil(maxAmpsValue / 10) * 10;
        
        // Calculate a compatible kW range that will align with the amp range
        // This prevents Chart.js from auto-scaling both axes to different ranges
        const compatibleMaxKw = (roundedMaxAmps * panelVoltage) / 1000;
        
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
                        tension: 0.1,           // Slightly smooth the lines
                        yAxisID: 'y'            // Use left Y-axis (kW)
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
                        tension: 0.1,           // Slightly smooth the lines
                        yAxisID: 'y'            // Use left Y-axis (kW)
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
                        tension: 0.1,           // Slightly smooth the lines
                        yAxisID: 'y'            // Use left Y-axis (kW)
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
                        tension: 0.1,           // Slightly smooth the lines
                        yAxisID: 'y'            // Use left Y-axis (kW)
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
                        type: 'linear',
                        display: true,
                        position: 'left',
                        title: {
                            display: true,
                            text: 'kW'
                        },
                        beginAtZero: true,
                        min: 0,
                        max: compatibleMaxKw,
                        ticks: {
                            callback: function(value) {
                                return value.toFixed(1);  // Consistent decimal places
                            }
                        }
                    },
                    y1: {
                        type: 'linear',
                        display: true,
                        position: 'right',
                        title: {
                            display: true,
                            text: 'Amps'
                        },
                        beginAtZero: true,
                        min: 0,
                        max: roundedMaxAmps,
                        grid: {
                            drawOnChartArea: false, // Only show grid for left Y-axis
                        },
                        ticks: {
                            callback: function(value) {
                                return value.toFixed(0);  // Whole numbers for amps
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
        // Check if this is a file format error
        const isFileFormatError = message.includes('Unsupported file format');
        
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
                ${isFileFormatError ? `
                    <div class="report-format-container">
                        <button id="reportFormatBtn" class="btn">Report Unsupported Format</button>
                    </div>
                ` : ''}
            </div>
        `;
        
        // Add event listener for the report format button if it exists
        if (isFileFormatError) {
            const reportBtn = document.getElementById('reportFormatBtn');
            if (reportBtn) {
                reportBtn.addEventListener('click', () => {
                    // Get current app state
                    const panelSize = document.getElementById('panelSize').value || 'Not set';
                    const voltage = document.getElementById('panelVoltage').value || 'Not set';
                    const methodElement = document.getElementById('calculationMethod');
                    const method = methodElement ? methodElement.options[methodElement.selectedIndex].text : 'Not set';
                    
                    // Get browser info
                    const browserInfo = `${navigator.userAgent}`;
                    
                    // Create email body
                    const body = `
I encountered an unsupported file format when using the Panel Capacity Calculator.

System Information:
- Browser: ${browserInfo}
- Panel Size: ${panelSize} A
- Voltage: ${voltage} V
- Calculation Method: ${method}
- App Version: ${APP_VERSION}
- Date: ${new Date().toISOString()}

My file is from the following electric utility: 
[Please specify your electric utility company]

Additional information:
[Please provide any additional details that might help us support your file format]

Note: Please attach your CSV file to this email so we can analyze it and add support for your utility.
                    `.trim();
                    
                    // Open mailto link
                    const mailtoUrl = `mailto:steve@hea.com?subject=Unsupported%20File%20Format%20Report&body=${encodeURIComponent(body)}`;
                    window.open(mailtoUrl, '_blank');
                });
            }
        }
        
        this.fileInfo.classList.add('error');
        setTimeout(() => {
            this.fileInfo.classList.remove('error');
        }, 10000); // Keep error showing longer since there's more to read
    }

    analyzeData(data, fileFormat = 'simple') {
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

        // Count hours with different patterns
        let hoursWithSingleReading = 0;
        let hoursWithFourUniqueReadings = 0;
        let hoursWithFourIdenticalReadings = 0;
        const totalHours = Object.keys(hourlyGroups).length;

        Object.values(hourlyGroups).forEach(hourData => {
            const uniqueReadings = new Set(hourData.readings).size;
            const readingCount = hourData.count;

            if (readingCount === 1) {
                hasHourlyData = true;
                hoursWithSingleReading++;
            } else if (readingCount === 4 && uniqueReadings > 1) {
                has15MinData = true;
                hoursWithFourUniqueReadings++;
            } else if (readingCount === 4 && uniqueReadings === 1) {
                hoursWithFourIdenticalReadings++;
            }
        });

        // Apply percentage-based threshold for fake 15-minute data detection
        // Require that >50% of hours show identical 15-minute readings to avoid false positives
        const percentageIdentical = totalHours > 0 ? (hoursWithFourIdenticalReadings / totalHours) * 100 : 0;
        if (percentageIdentical > 50) {
            hasFake15MinData = true;
        }

        // Add note about threshold if there are some identical readings but not enough to classify
        if (hoursWithFourIdenticalReadings > 0 && percentageIdentical <= 50) {
            warnings.push(`Note: ${hoursWithFourIdenticalReadings} hours (${percentageIdentical.toFixed(1)}%) have identical 15-minute readings, but this is below the 50% threshold for classifying as "fake 15-minute" data. These are likely random coincidences.`);
        }

        // Determine data type
        let dataTypes = [];
        if (hasHourlyData) dataTypes.push("Hourly");
        if (has15MinData) dataTypes.push("15-minute");
        if (hasFake15MinData) dataTypes.push("Fake 15-minute");

        // Add warnings based on data type and duration
        if (has15MinData && !hasHourlyData && !hasFake15MinData) {
            // Only 15-minute data present
            if (daysCovered < 30) {
                warnings.push("Warning! NEC code requires at least 30 days of 15-minute interval data.");
            }
        } else if (hasHourlyData || hasFake15MinData) {
            // Has hourly or fake 15-minute data
            if (daysCovered < 365) {
                warnings.push("Warning! Less than 1 year of data detected. Seasonal load adjustment will be applied.");
            }
        }
        
        // Get the calculation method name
        const methodElement = document.getElementById('calculationMethod');
        let methodName = "Not applicable";
        let methodDetail = "";
        
        // Only include calculation method if it's being used (visible)
        if (methodElement && !this.methodSelectorContainer.classList.contains('hidden')) {
            methodName = methodElement.options[methodElement.selectedIndex].text;
            methodDetail = `Calculation method: ${methodName}`;
        }
        
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
                `File format: ${fileFormat === 'pge-pv' ? 'PG&E Solar PV Export' : fileFormat === 'pge' ? 'PG&E Energy Usage Export' : 'Simple CSV'}`,
                `First reading: ${firstDate.toLocaleString()}`,
                `Last reading: ${lastDate.toLocaleString()}`,
                `Total readings: ${data.length}`,
                `Data types detected: ${dataTypes.join(", ") || "Unknown"}`,
                `Average readings per hour: ${(data.length / Object.keys(hourlyGroups).length).toFixed(1)}`,
                `Average readings per day: ${(data.length / daysCovered).toFixed(1)}`,
                `Number of hours with data: ${Object.keys(hourlyGroups).length}`,
                `Peak reading(s): ${peakReadings}`,
                methodDetail,
                // Add detailed pattern breakdown
                `Pattern analysis: ${hoursWithSingleReading} hours with single readings (${totalHours > 0 ? (hoursWithSingleReading / totalHours * 100).toFixed(1) : 0}%), ${hoursWithFourUniqueReadings} hours with 4 unique 15-min readings (${totalHours > 0 ? (hoursWithFourUniqueReadings / totalHours * 100).toFixed(1) : 0}%), ${hoursWithFourIdenticalReadings} hours with 4 identical 15-min readings (${percentageIdentical.toFixed(1)}%)`,
                ...(warnings.length > 0 ? warnings : [])
            ].filter(item => item !== ""),
            warnings,
            dataTypes,
            hasHourlyData,
            has15MinData,
            hasFake15MinData,
            daysCovered
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
            // Clear any previous results
            this.clearResults();
            
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
            
            // Process the file
            this.validateAndProcessFile(file);

            // Add format info to the message
            let formatName;
            if (format === 'pge') {
                formatName = 'PG&E';
            } else if (format === 'pge-pv') {
                formatName = 'PG&E Solar PV';
            } else {
                formatName = 'simple';
            }
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
        // Check for PG&E PV format (has header with Name, Address, Service, etc. and IMPORT/EXPORT columns)
        if (csvContent.includes('Name,') && csvContent.includes('Address,') && 
            csvContent.includes('Account Number,') && csvContent.includes('Service,') &&
            csvContent.includes('IMPORT') && csvContent.includes('EXPORT')) {
            return 'pge-pv';
        }
        
        // Check for standard PG&E format (has header with Name, Address, Service, etc.)
        if (csvContent.includes('Name,') && csvContent.includes('Address,') && 
            csvContent.includes('Account Number,') && csvContent.includes('Service,')) {
            return 'pge';
        }
        
        // Check for simple format (has DateTime and kWh columns)
        const firstLine = csvContent.split('\n')[0].toLowerCase();
        if (firstLine.includes('datetime') && firstLine.includes('kwh')) {
            return 'simple';
        }
        
        // Unknown format
        throw new Error('Unsupported file format. We currently support simple CSV files with DateTime and kWh columns and PG&E energy usage exports. If your file is from your electric utility, please click the "Report Unsupported Format" button below to help us add support for it.');
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

    // Add a logging method that can be easily disabled in production
    log(message, level = 'info') {
        // Set to false to disable logging in production
        const enableLogging = true;
        
        if (!enableLogging) return;
        
        switch(level) {
            case 'error':
                console.error(message);
                break;
            case 'warn':
                console.warn(message);
                break;
            case 'info':
            default:
                console.log(message);
        }
    }

    exportResults() {
        try {
            // Get current results
            const peakKw = document.getElementById('peakKw').textContent;
            const peakAmps = document.getElementById('peakAmps').textContent;
            const safetyFactorKw = document.getElementById('unusedKw').textContent;
            const safetyFactorAmps = document.getElementById('unusedAmps').textContent;
            const availableKw = document.getElementById('availableKw').textContent;
            const availableAmps = document.getElementById('availableAmps').textContent;
            
            // Get input parameters
            const panelSize = document.getElementById('panelSize').value;
            const voltage = document.getElementById('panelVoltage').value;

            // Check if seasonal load is applicable and visible
            const seasonalLoadElement = document.getElementById('seasonalLoad');
            const seasonalLoadContainer = document.getElementById('seasonalLoadContainer');
            let seasonalLoadInfo = "";
            
            // Only include seasonal load if it's being used (visible)
            if (seasonalLoadElement && seasonalLoadContainer && !seasonalLoadContainer.classList.contains('hidden')) {
                const seasonalLoad = seasonalLoadElement.value;
                seasonalLoadInfo = `Seasonal Load,${seasonalLoad} Watts\n`;
            }
            
            // Check if calculation method is applicable (not for pure 15-minute data)
            const methodElement = document.getElementById('calculationMethod');
            let methodInfo = "";
            
            // Only include calculation method if it's being used (visible)
            if (methodElement && !this.methodSelectorContainer.classList.contains('hidden')) {
                const method = methodElement.options[methodElement.selectedIndex].text;
                methodInfo = `Calculation Method,${method}\n`;
            }
            
            // Get data info from the DOM if available
            let dataPeriod = "Not available";
            let dataCount = "Not available";
            let dataTypes = "Not available";
            
            // Try to extract data period from the info summary
            const infoSummary = document.querySelector('.info-summary');
            if (infoSummary) {
                const summaryText = infoSummary.textContent;
                // Extract data period from summary text which has format "Data spans X days (start to end)"
                const dataPeriodMatch = summaryText.match(/Data spans (\d+) days \((.*) to (.*)\)/);
                if (dataPeriodMatch) {
                    dataPeriod = `${dataPeriodMatch[1]} days (${dataPeriodMatch[2]} to ${dataPeriodMatch[3]})`;
                }
            }
            
            // Try to extract reading count and data types from the info details
            const infoDetails = document.querySelectorAll('.info-item');
            infoDetails.forEach(item => {
                if (item.textContent.includes('Total readings:')) {
                    dataCount = item.textContent.replace('Total readings:', '').trim();
                }
                if (item.textContent.includes('Data types detected:')) {
                    dataTypes = item.textContent.replace('Data types detected:', '').trim();
                }
            });
            
            // Create CSV content
            const csvContent = [
                `Date,${new Date().toLocaleDateString()}`,
                `Panel Size,${panelSize} Amps`,
                `Panel Voltage,${voltage} Volts`,
                seasonalLoadInfo,
                methodInfo,
                `Peak Power,${peakKw} kW`,
                `NEC Safety Factor,${safetyFactorKw} kW`,
                `Available Capacity,${availableKw} kW`,
                `Data Period,${dataPeriod}`,
                `Number of Readings,${dataCount}`,
                `Data Types,${dataTypes}`
            ].filter(line => line !== "").join('\n');
            
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
- App Version: ${APP_VERSION}
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

    // Add a method to clear results
    clearResults() {
        // Hide the results section
        if (this.resultsDiv) {
            this.resultsDiv.classList.add('hidden');
            this.resultsDiv.classList.remove('fade-in');
        }
        
        // Clear any data info
        const dataInfo = document.getElementById('dataInfo');
        if (dataInfo) {
            dataInfo.innerHTML = '';
        }
        
        // Reset chart if it exists
        if (this.chart) {
            this.chart.destroy();
            this.chart = null;
        }
        
        // Clear panel visualization if it exists
        const panelVisCanvas = document.getElementById('panelVisCanvas');
        if (panelVisCanvas && panelVisCanvas.getContext) {
            const ctx = panelVisCanvas.getContext('2d');
            if (ctx) {
                ctx.clearRect(0, 0, panelVisCanvas.width, panelVisCanvas.height);
            }
        }
        
        // Remove any existing method selection notification
        const existingNotification = document.querySelector('.method-info-notification');
        if (existingNotification) {
            existingNotification.parentNode.removeChild(existingNotification);
        }
        
        // Hide method selector
        if (this.methodSelectorContainer) {
            this.methodSelectorContainer.classList.add('hidden');
        }
        
        // Hide export button
        const exportBtn = document.getElementById('exportResultsBtn');
        if (exportBtn) {
            exportBtn.classList.add('hidden');
        }
    }
}

// Initialize the calculator when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    checkBrowserCompatibility();
    initializeInstructionsToggle();
    new PanelCalculator();
    
    // Set version number
    const versionInfo = document.getElementById('versionInfo');
    if (versionInfo) {
        versionInfo.textContent = APP_VERSION;
    }
    
    // Add event listener for print button
    const printBtn = document.getElementById('printResultsBtn');
    if (printBtn) {
        printBtn.addEventListener('click', openPrintablePage);
    }
    
    // Initialize panel visualization canvas if it exists
    const panelVisCanvas = document.getElementById('panelVisCanvas');
    if (panelVisCanvas) {
        // Set canvas dimensions based on its container
        const resizeCanvas = () => {
            const container = panelVisCanvas.parentElement;
            if (container) {
                panelVisCanvas.width = container.clientWidth;
                panelVisCanvas.height = container.clientHeight;
                
                // If we have results displayed, update the visualization
                if (!document.getElementById('results').classList.contains('hidden') && 
                    typeof updatePanelVisualization === 'function') {
                    updatePanelVisualization();
                }
            }
        };
        
        // Initial resize
        resizeCanvas();
        
        // Resize on window resize
        window.addEventListener('resize', resizeCanvas);
    }
});