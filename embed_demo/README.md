# Panel Capacity Calculator Embedding Guide

This guide provides instructions for embedding the Panel Capacity Calculator on third-party websites. The calculator allows users to determine their available electrical panel capacity based on historical meter data using NEC 220.87 methods.

## Quick Start

To embed the Panel Capacity Calculator on your website, add the following iframe code:

```html
<iframe 
  src="https://panel.hea.com/index.html" 
  width="100%" 
  height="800px" 
  style="border: none; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" 
  title="Panel Capacity Calculator">
</iframe>
```

## Passing Parameters

You can pre-configure the calculator by passing parameters in the URL:

```html
<iframe 
  src="https://panel.hea.com/index.html?panelSize=200&panelVoltage=240&calculationMethod=hea" 
  width="100%" 
  height="800px" 
  style="border: none; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" 
  title="Panel Capacity Calculator">
</iframe>
```

### Available Parameters

| Parameter | Description | Possible Values | Default |
|-----------|-------------|----------------|---------|
| panelSize | Panel capacity in Amps | Any positive number | 150 |
| panelVoltage | Panel voltage | 240, 120, 208 | 240 |
| calculationMethod | Method used to calculate peak load | hea, nec, lbnl | hea |
| sampleFile | Name of sample file to load | test4_15min_1mo.csv, test2_hourly_1mo.csv, etc. | - |
| autoCalculate | Automatically calculate with sample data | true, false | false |
| hideHeader | Hide the header section | true, false | false |
| seasonalLoad | Additional load (in watts) for seasonal adjustments | Any positive number | 5000 |

## Example Usage

Here's an example of embedding the calculator with multiple parameters:

```html
<iframe 
  src="https://panel.hea.com/index.html?panelSize=200&panelVoltage=240&calculationMethod=hea&hideHeader=true" 
  width="100%" 
  height="800px" 
  style="border: none; border-radius: 8px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);" 
  title="Panel Capacity Calculator">
</iframe>
```

## Receiving Results

To receive calculation results from the embedded calculator, you need to listen for messages using the `window.addEventListener` API. Here's a best practice example:

```javascript
// Listen for messages from the iframe
window.addEventListener('message', function(event) {
  // IMPORTANT: Always verify the origin of the message
  // Replace 'panel.hea.com' with the actual domain where the calculator is hosted
  if (event.origin !== 'https://panel.hea.com') {
    // Message came from an untrusted domain, ignore it
    return;
  }
  
  // Check if the message contains calculation results
  if (event.data && event.data.type === 'calculationResults') {
    const results = event.data.results;
    
    // Now you can use the results in your page
    console.log('Peak Power:', results.peakPowerKw, 'kW,', results.peakPowerAmps, 'A');
    console.log('Unused Capacity:', results.unusedCapacityKw, 'kW,', results.unusedCapacityAmps, 'A');
    console.log('Available Capacity:', results.availableCapacityKw, 'kW,', results.availableCapacityAmps, 'A');
    
    // Update your UI with the results
    document.getElementById('yourPeakPowerElement').textContent = 
      `${results.peakPowerKw.toFixed(2)} kW | ${results.peakPowerAmps.toFixed(1)} A`;
    
    // ... update other elements as needed
  }
});
```

### Results Object Structure

The results object contains the following properties:

| Property | Description | Unit |
|----------|-------------|------|
| peakPowerKw | Peak power in kilowatts | kW |
| peakPowerAmps | Peak power in amperes | A |
| unusedCapacityKw | Unused capacity in kilowatts | kW |
| unusedCapacityAmps | Unused capacity in amperes | A |
| availableCapacityKw | Available capacity in kilowatts (with 1.25x safety factor) | kW |
| availableCapacityAmps | Available capacity in amperes (with 1.25x safety factor) | A |

## Advanced Integration

### JavaScript API

The calculator exposes several JavaScript functions that can be called from the parent page:

```javascript
// Get a reference to the iframe
const calculatorIframe = document.getElementById('panelCalculator');

// Trigger a calculation
calculatorIframe.contentWindow.triggerCalculation();

// Load a sample file
calculatorIframe.contentWindow.loadSampleFile('test4_15min_1mo.csv');

// Get current panel configuration
const config = calculatorIframe.contentWindow.getPanelConfig();
console.log(config); // {panelSize: "150", panelVoltage: "240", calculationMethod: "hea"}

// Set panel configuration
calculatorIframe.contentWindow.setPanelConfig({
  panelSize: "200",
  panelVoltage: "240",
  calculationMethod: "nec"
});
```

**Note:** These JavaScript functions will only work if the calculator is hosted on the same domain as your website, or if the calculator has been configured with appropriate CORS headers.

### Styling the Embedded Calculator

The calculator automatically applies special styles when embedded. If you need additional customization, you can add custom CSS to your page that targets the iframe.

## Example Implementation

The `acme-embed-demo.html` file in this directory provides a complete example of how to embed the Panel Capacity Calculator and interact with it. Try it out at https://panel.hea.com/embed_demo/acme-embed-demo.html 

Key features of this example:

1. Configuring the calculator with user-selected parameters
2. Receiving and displaying calculation results
3. Generating custom recommendations based on the results
4. Responsive design that works on all device sizes

## Security Considerations

When embedding the Panel Capacity Calculator, keep these security best practices in mind:

1. **Always verify message origins**: Only process messages that come from the trusted domain (panel.hea.com).
2. **Use HTTPS**: Always use HTTPS for both your site and the embedded calculator to ensure secure communication.
3. **Sanitize data**: Always validate and sanitize any data received from the calculator before using it in your application.
4. **Respect user privacy**: Be transparent about data handling in your privacy policy.

## Troubleshooting

If you encounter issues with the embedded calculator:

1. **Calculator not loading**: Check that the iframe src URL is correct and accessible.
2. **Parameters not applying**: Verify the URL format and parameter names.
3. **Not receiving results**: Check that your message event listener is correctly implemented and that you're verifying the correct origin.
4. **Cross-origin issues**: If you're trying to directly interact with the iframe using JavaScript, you may encounter cross-origin restrictions if the calculator is hosted on a different domain.

## Support

For questions or issues related to embedding the Panel Capacity Calculator, please contact support at [steve@hea.com](mailto:steve@hea.com?subject=Panel%20Calculator%20Embedding%20Support). 