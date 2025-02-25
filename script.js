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

        // Add at the end of the constructor, after other initializations
        if (typeof Chart === 'undefined') {
            console.error('Chart.js not loaded');
        } else {
            console.log('Chart.js loaded successfully');
        }
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
            
            // Add data analysis
            const analysis = this.analyzeData(data);
            this.showDataInfo(analysis.summary, analysis.details);
            
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
        
        Object.entries(hourlyData).forEach(([hour, hourData]) => {
            const { readings } = hourData;
            const hourlyMax = Math.max(...readings);
            const uniqueReadings = new Set(readings).size;
            const readingCount = readings.length;
            
            // Debug logging
            console.log('Processing hour:', {
                hour,
                readings,
                hourlyMax,
                uniqueReadings,
                readingCount
            });

            let adjustedMax;
            
            if (readingCount === 4) {
                // 15-minute data (real or fake)
                if (uniqueReadings === 1) {
                    // Fake 15-minute data: apply both 4x and 1.3x
                    adjustedMax = hourlyMax * 4 * SINGLE_READING_MULTIPLIER;
                    console.log('Fake 15-min:', { 
                        hour,
                        hourlyMax, 
                        step1: hourlyMax * 4,
                        adjustedMax, 
                        multiplier: `4 * ${SINGLE_READING_MULTIPLIER} = ${4 * SINGLE_READING_MULTIPLIER}`
                    });
                } else {
                    // Real 15-minute data: apply 4x only
                    adjustedMax = hourlyMax * 4;
                    console.log('Real 15-min:', { hour, hourlyMax, adjustedMax, multiplier: 4 });
                }
            } else {
                // Single reading: apply 1.3x only
                adjustedMax = hourlyMax * SINGLE_READING_MULTIPLIER;
                console.log('Hourly:', { hour, hourlyMax, adjustedMax, multiplier: SINGLE_READING_MULTIPLIER });
            }
            
            peakLoad = Math.max(peakLoad, adjustedMax);
            console.log(`Current peak load: ${peakLoad}`);
        });
        
        console.log('Final peak load:', peakLoad);
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
                `Peak reading(s): ${peakReadings}`
            ]
        };
    }

    showDataInfo(summary, details) {
        const infoHtml = `
            <div class="info-container">
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
}

// Initialize the calculator when the DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new PanelCalculator();
}); 