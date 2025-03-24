// Panel Capacity Visualization
function renderPanelVisualization(panelSize, voltage, peakPower, availableCapacity) {
    const canvas = document.getElementById('panelVisCanvas');
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    const width = canvas.width;
    const height = canvas.height;
    
    // Clear the canvas
    ctx.clearRect(0, 0, width, height);
    
    // Calculate values in Amps
    const totalCapacityAmps = parseFloat(panelSize);
    const peakAmps = (peakPower * 1000) / voltage;
    const availableAmps = (availableCapacity * 1000) / voltage;
    
    // Calculate safety factor section (the difference between peak and available)
    const safetyFactorAmps = (peakAmps * 0.25);
    
    // Set up dimensions with less blank space
    const panelWidth = width * 0.6; // Reduced width to make the visualization more narrow
    const panelHeight = height * 0.85; // Increased height since we removed the legend
    const panelX = width * 0.2; // Position panel more to the left
    const panelY = height * 0.12; // Position panel higher up
    
    // Draw panel background
    ctx.fillStyle = '#f5f5f5';
    ctx.strokeStyle = '#6c757d';
    ctx.lineWidth = 2;
    ctx.fillRect(panelX, panelY, panelWidth, panelHeight);
    ctx.strokeRect(panelX, panelY, panelWidth, panelHeight);
    
    // Limit peak amps to total capacity for visualization purposes
    const displayPeakAmps = Math.min(peakAmps, totalCapacityAmps);
    const excessAmps = Math.max(0, peakAmps - totalCapacityAmps);
    
    // Calculate heights of each section
    const peakAmpsHeight = (displayPeakAmps / totalCapacityAmps) * panelHeight;
    const safetyFactorHeight = Math.min((safetyFactorAmps / totalCapacityAmps) * panelHeight, 
                                      panelHeight - peakAmpsHeight);
    const availableAmpsHeight = Math.max(0, panelHeight - peakAmpsHeight - safetyFactorHeight);
    
    // Calculate positions from bottom
    const peakPosition = panelY + panelHeight - peakAmpsHeight;
    const safetyPosition = peakPosition - safetyFactorHeight;
    const availablePosition = safetyPosition - availableAmpsHeight;
    
    // Draw sections from bottom to top
    
    // Draw used capacity (peak power) - using a blue that is colorblind friendly
    if (displayPeakAmps > 0) {
        ctx.fillStyle = '#3b7ea1'; // Blue that works for most colorblind types
        ctx.fillRect(
            panelX, 
            peakPosition, 
            panelWidth, 
            peakAmpsHeight
        );
    }
    
    // Draw safety factor section - using a gold/amber color
    if (safetyFactorAmps > 0) {
        ctx.fillStyle = '#e9b949'; // Gold/amber color that is colorblind friendly
        ctx.fillRect(
            panelX, 
            safetyPosition, 
            panelWidth, 
            safetyFactorHeight
        );
    }
    
    // Draw available capacity - using a green that is colorblind friendly
    if (availableAmps > 0) {
        ctx.fillStyle = '#5a9e6f'; // Muted green that works for most colorblind types
        ctx.fillRect(
            panelX, 
            availablePosition, 
            panelWidth, 
            availableAmpsHeight
        );
    }
    
    // Add total capacity value at the top
    ctx.fillStyle = '#212529';
    ctx.textAlign = 'center';
    ctx.font = '14px sans-serif';
    ctx.fillText(`Total: ${totalCapacityAmps.toFixed(1)} A`, width / 2, panelY - 5);
    
    // Minimum threshold for in-section labels (in pixels)
    const MIN_SECTION_HEIGHT_FOR_LABEL = 25;
    
    // Helper function to draw section labels
    function drawSectionLabel(label, yPosition, sectionHeight, value, color) {
        // Skip if value is negative
        if (value <= 0) return;
        
        const labelText = `${label}: ${value.toFixed(1)} A  `; // Added spacing after label
        
        // If section is tall enough, draw label inside
        if (sectionHeight >= MIN_SECTION_HEIGHT_FOR_LABEL) {
            ctx.fillStyle = color || 'white';
            ctx.fillText(labelText, panelX + panelWidth / 2, yPosition + sectionHeight / 2);
        } else if (sectionHeight > 0) {
            // Draw small indicator with line to the right
            const labelX = panelX + panelWidth + 5;
            const labelLineLength = 15;
            const labelY = yPosition + sectionHeight / 2;
            
            // Draw a line from section to label
            ctx.beginPath();
            ctx.moveTo(panelX + panelWidth, labelY);
            ctx.lineTo(labelX + labelLineLength, labelY);
            ctx.strokeStyle = '#212529';
            ctx.lineWidth = 1;
            ctx.stroke();
            
            // Draw text vertically to save horizontal space
            ctx.fillStyle = '#212529';
            ctx.save(); // Save the current state
            
            // Position and rotate text
            const textX = labelX + labelLineLength + 15;
            ctx.translate(textX, labelY);
            ctx.rotate(-Math.PI/2); // Rotate 90 degrees counter-clockwise
            
            // Draw the rotated text
            ctx.textAlign = 'right';
            ctx.font = '12px sans-serif';
            ctx.fillText(labelText, 0, 0);
            
            // Restore the context state
            ctx.restore();
        }
    }
    
    // Special case for zero or negative available capacity
    if (availableAmps <= 0) {
        // If peak power exceeds panel capacity, show warning inside the peak power section
        if (excessAmps > 0) {
            // Draw warning triangle and text inside the peak power section
            ctx.fillStyle = '#dc3545';
            ctx.font = 'bold 14px sans-serif';
            
            // Calculate positions for triangle and text
            const textY = peakPosition + peakAmpsHeight - 20; // Position near bottom of peak section
            const triangleX = panelX + 15; // Position triangle at the start of the panel
            const textX = triangleX + 20; // Position text next to triangle
            
            // Draw warning triangle
            ctx.beginPath();
            ctx.moveTo(triangleX, textY - 6);
            ctx.lineTo(triangleX - 7, textY + 6);
            ctx.lineTo(triangleX + 7, textY + 6);
            ctx.closePath();
            ctx.fillStyle = '#dc3545'; // Red warning
            ctx.fill();
            
            // Draw exclamation mark
            ctx.fillStyle = 'white';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('!', triangleX, textY + 4);
            
            // Draw warning text to the right of triangle
            ctx.fillStyle = 'white';
            ctx.textAlign = 'left';
            ctx.font = '12px sans-serif';
            const warningText = `Panel limit exceeded by ${excessAmps.toFixed(1)} A`;
            ctx.fillText(warningText, textX, textY + 4);
        } else {
            // Regular warning below panel when capacity is negative but not exceeding panel size
            ctx.fillStyle = '#dc3545';
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            
            // Calculate positions for triangle and text
            const textY = panelY + panelHeight + 15; // Position below the panel
            const triangleX = panelX + 15; // Position triangle at the start of the panel
            
            // Draw warning triangle
            ctx.beginPath();
            ctx.moveTo(triangleX, textY - 8);
            ctx.lineTo(triangleX - 8, textY + 4);
            ctx.lineTo(triangleX + 8, textY + 4);
            ctx.closePath();
            ctx.fillStyle = '#dc3545'; // Red warning
            ctx.fill();
            
            // Draw exclamation mark
            ctx.fillStyle = 'white';
            ctx.font = 'bold 12px sans-serif';
            ctx.textAlign = 'center';
            ctx.fillText('!', triangleX, textY);
            
            // Draw warning text to the right of triangle
            ctx.fillStyle = '#dc3545';
            ctx.textAlign = 'left';
            ctx.fillText(`No Available Capacity (${availableAmps.toFixed(1)} A)`, triangleX + 20, textY);
        }
        
        // Don't draw available section label when negative
    } else {
        // Draw available capacity label
        drawSectionLabel('Available', availablePosition, availableAmpsHeight, availableAmps);
    }
    
    // Draw safety factor label
    drawSectionLabel('Safety Factor', safetyPosition, safetyFactorHeight, safetyFactorAmps);
    
    // Draw peak power label
    // If peak exceeds total capacity, show the actual value for the label
    drawSectionLabel('Peak Power', peakPosition, peakAmpsHeight, peakAmps);
    
    // If peak power exceeds total capacity, add note at the bottom
    if (excessAmps > 0 && availableAmps > 0) {
        ctx.fillStyle = '#dc3545';
        ctx.font = '12px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText(`Note: Peak power exceeds panel size by ${excessAmps.toFixed(1)} A`, width / 2, panelY + panelHeight + 15);
    }
}

// Update the panel visualization when results are calculated
function updatePanelVisualization() {
    const panelSize = parseFloat(document.getElementById('panelSize').value);
    const voltage = parseFloat(document.getElementById('panelVoltage').value);
    const peakKw = parseFloat(document.getElementById('peakKw').textContent);
    const availableKw = parseFloat(document.getElementById('availableKw').textContent);
    
    renderPanelVisualization(panelSize, voltage, peakKw, availableKw);
} 