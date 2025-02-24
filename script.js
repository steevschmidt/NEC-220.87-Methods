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
            this.showError(error.message);
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
                    
                    // Validate CSV structure
                    const dateTimeIndex = headers.findIndex(h => h.trim().toLowerCase() === 'datetime');
                    const kwIndex = headers.findIndex(h => h.trim().toLowerCase() === 'kw');
                    
                    if (dateTimeIndex === -1 || kwIndex === -1) {
                        throw new Error('CSV must contain DateTime and kW columns');
                    }

                    // Parse data rows
                    const data = [];
                    for (let i = 1; i < rows.length; i++) {
                        const row = rows[i].trim();
                        if (!row) continue;

                        const columns = row.split(',');
                        // Remove quotes from values
                        const dateStr = columns[dateTimeIndex]?.trim().replace(/^"|"$/g, '');
                        const kwStr = columns[kwIndex]?.trim().replace(/^"|"$/g, '');
                        
                        if (!dateStr || !kwStr) continue;

                        const datetime = new Date(dateStr);
                        const kw = parseFloat(kwStr);

                        if (isNaN(datetime.getTime()) || isNaN(kw)) {
                            console.warn(`Skipping invalid row ${i + 1}: DateTime=${dateStr}, kW=${kwStr}`);
                            continue;
                        }

                        data.push({ datetime, kw });
                    }

                    if (data.length === 0) {
                        throw new Error('No valid data found in CSV file');
                    }

                    console.log(`Processed ${data.length} valid readings`);
                    resolve(data);
                } catch (error) {
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
            hourlyGroups[hour].readings.push(reading.kw);
            hourlyGroups[hour].count++;
        });
        return hourlyGroups;
    }

    calculatePeakLoad(hourlyData) {
        let peakLoad = 0;
        
        Object.values(hourlyData).forEach(hourData => {
            const { readings, count } = hourData;
            const hourlyMax = Math.max(...readings);
            
            // Check if all readings in the hour are identical
            const uniqueReadings = new Set(readings).size;
            
            // Apply multipliers based on the data pattern:
            // - For single readings or "fake" 15-minute data (all values identical), apply 1.3x
            // - For real 15-minute data (multiple different values), multiply by 4
            if (uniqueReadings === 1) {
                // Single reading or "fake" 15-minute data
                const adjustedMax = hourlyMax * 1.3;
                peakLoad = Math.max(peakLoad, adjustedMax);
            } else {
                // Real 15-minute data
                const adjustedMax = hourlyMax * 4;
                peakLoad = Math.max(peakLoad, adjustedMax);
            }
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

    showError(message) {
        this.fileInfo.textContent = message;
        this.fileInfo.classList.add('error');
        setTimeout(() => {
            this.fileInfo.classList.remove('error');
        }, 3000);
    }
}

// Initialize the calculator when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PanelCalculator();
}); 