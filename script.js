// Constants for calculations
const SINGLE_READING_MULTIPLIER = 1.3;
const FINAL_CAPACITY_MULTIPLIER = 1.25;

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
            const data = await this.parseCSV(file);
            const results = this.calculatePanelCapacity(data);
            this.displayResults(results);
            this.createChart(data);
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
        const hourlyGroups = {};
        data.forEach(reading => {
            const hour = reading.datetime.getHours();
            if (!hourlyGroups[hour]) {
                hourlyGroups[hour] = {
                    readings: [],
                    count: 0
                };
            }
            hourlyGroups[hour].readings.push(reading.kwh);
            hourlyGroups[hour].count++;
        });
        return hourlyGroups;
    }

    calculatePeakLoad(hourlyData) {
        let peakLoad = 0;
        
        Object.values(hourlyData).forEach(hourData => {
            const { readings } = hourData;
            const hourlyMax = Math.max(...readings);
            
            // Check if all readings in the hour are identical
            const uniqueReadings = new Set(readings).size;
            const readingCount = readings.length;
            
            // For 15-minute data (4 readings per hour), multiply by 4
            const intervalMultiplier = readingCount > 1 ? 4 : 1;
            
            // If all readings are identical, also apply the hourly multiplier
            const hourlyMultiplier = uniqueReadings === 1 ? SINGLE_READING_MULTIPLIER : 1;
            
            // Apply both multipliers
            const adjustedMax = hourlyMax * intervalMultiplier * hourlyMultiplier;
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
        
        // Show results section with animation
        this.resultsDiv.classList.remove('hidden');
        this.resultsDiv.classList.add('fade-in');
    }

    createChart(data) {
        // We'll implement this in the next step when we add a charting library
        console.log('Chart data ready:', data);
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
}

// Initialize the calculator when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PanelCalculator();
}); 