# NEC-220.87-Methods
Tools and algorithms for measuring a home's peak power, useful for building electrification

# Open Source Repository for the calculation of NEC 220.87

Goal: We would like an open source repository for a web-based, user-friendly, scalable, documented, secure implementation of the 220.87 algorithm utilizing smart meter data (possibly integrated to UtilityAPI) via a RESTful API which is defined and testable via Swagger, and incorporating test data and a “sandbox” environment for non-invasive testing. It should include a basic UI for testing purposes. Our intent would be to make it good enough for utilities (including CCAs like SVCE) to utilize in order to provide their customers with the key information needed to calculation existing electric panel utilization. If successful, maintenance should be provided by the community of developers who adopt it.

# Description of an NEC 220.87 Toolkit

A set of public resources intended to help homeowners, contractors, software companies, electrification accelerators, utilities, regulators, building departments and others understand and apply National Electric Code 220.87([url](https://up.codes/s/determining-existing-loads/)) for the purpose of avoiding unnecessary electric panel upgrades during home electrification.

## Challenge
Most Americans use fossil fuels in their homes and while driving. To help with the climate crisis, Americans need to migrate off fossil fuels. Electricity in most US states continues to get cleaner -- meaning electric generation produces less carbon emissions -- so replacing fossil fueled devices with electric equivalents reduces carbon emissions. We call this process "home electrification".

The fossil fuels used by homeowners include Natural gas, fuel oil, propane, gasoline and diesel.

Examples of home electrification 
1. Replacing a natural gas furnace with a modern electric heat pump. The heat pump is far more efficient, so less energy is used and operating costs usually go down, but the home will use more electricity. 
2. Replacing a gasoline car with an electric vehicle. This also reduces total energy use, but the owner needs to install an electric vehicle charger in their home and their electric use will go up.
3. Replacing a natural gas water heater with a heat pump water heater.
4. Replacing a natural gas clothes dryer with a new efficient electric dryer (such as a condensing ventless electric dryer).
5. Replacing a natural gas cooktop with an induction cooktop.

These home electrification steps will necessarily increase the home's electric load, and it is necessary to determine whether or not the existing electric service can support this increased load. This can be done several ways, but if the home has a smart meter the easiest method is defined in [NEC 220.87](https://up.codes/s/determining-existing-loads), and requires an analysis of the home's electric interval data. This analysis is not particularly complicated, but the code is not concise about how it should be done, so the goal of this project is to provide reference implementations that can be approved by various regulators, organizations, municipalities, etc.

HEA has applied NEC 220.87 to a wide variety of homes in California and has provided results [here](https://1drv.ms/f/s!Ag7eOV5ifY5Ch2FNngIFZEzuLLFm?e=igYtZF). This analysis shows that most homes will not need a service upgrade. However, it is critical that this code be applied consistently and correctly to make this determination in a safe and reliable manner. These resources are provided to help assure this is done quickly.

## High level inputs and outputs
 1. Required input data at start: Electric interval data.
    - Can be entered various ways: CSV, Greenbutton, UtilityAPI, Arcadia...
    - Must cover at least 30 days if 15 minute intervals exist
    - Must cover at least one year if only hourly intervals exist
    - Must pass validation checks
      - TBD; possibly follow published CalTRACK validation checks? See [section 2.2](https://docs.caltrack.org/en/latest/methods.html#section-2-data-management).
 1. Optional input data: Existing electric panel sizes, in Amps. 
    - We assume all panels are 240 volts (but should allow this to be changed).
    - We should distinguish between the panel size, the conduit size in the service drop, and the main breaker size. Each implies different actions if exceeded.
    - We will eventually want to support multiple versions of the NEC standard (e.g. "2020 NFPA 70 National Electrical Code").
 1. Required Output: Peak usage (in amps and kW and Watts) over some period of time (probably either one year or 30 days).
    - Time span of smart meter data: From M/D/YY to M/D/YY
    - Identification of hourly or 15-minute or pseudo 15 minute or some other interval.
    - Summarize data processed (number of records, min/max values?)
    - Display algorithm used to produce peak load. E.g. "[peak value in kWh] * [Safety factor] * [Intervals per hour] / [Panel voltage]" 
    - List the associated NEC code standard (e.g. "2023 NFPA 70 National Electrical Code")
    - Output summary report showing all of the above
    - Output the Electric Interval Data in some standard format (CSV?)

## Implementation Methods

Users would appreciate multiple implementations of the algorithm(s) so they can use it in different ways.

 1. Jupyter Notebook: A method to easily document the algorithm. Other possible implementations of the core algorithm:
    - SQL Reference implementations for MySQL, Teradata, etc
    - R Reference implementation
 1. Simple tool with rudimentary UI that anyone can use in a browser. CSV upload only. Data stored locally (only).
    - Javascript/Python? Served via Amplify?

## Regression Test Suites

It would be useful to have several examples of interval data (KISS; CSV format?), along with the expected output for each, so that new versions of the algorithm can be verified.

See files in test_data folder for examples.

END
