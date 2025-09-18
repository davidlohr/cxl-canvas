/**
 * CXL Canvas Test Runner
 * Automated testing for CXL topology QEMU command generation
 */

const puppeteer = require('puppeteer');
const { TEST_SCENARIOS } = require('./test-scenarios');
const { QemuValidator } = require('./qemu-validator');
const TestServer = require('./test-server');

class CxlTestRunner {
  constructor(options = {}) {
    this.options = {
      headless: options.headless !== false,
      timeout: options.timeout || 30000,
      viewport: { width: 1920, height: 1080 },
      ...options
    };
    this.server = new TestServer(3001);
    this.validator = new QemuValidator();
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  /**
   * Run all test scenarios
   */
  async runAllTests() {
    console.log('🚀 Starting CXL Canvas Test Suite');
    console.log('==================================\n');

    try {
      // Start test server
      await this.server.start();
      
      // Launch browser
      const browser = await puppeteer.launch({
        headless: this.options.headless === true ? 'new' : this.options.headless,
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });

      for (const scenario of TEST_SCENARIOS) {
        await this.runScenarioTest(browser, scenario);
      }

      await browser.close();
      await this.server.stop();

      this.printSummary();
      return this.results;

    } catch (error) {
      console.error('❌ Test suite failed:', error.message);
      await this.server.stop();
      throw error;
    }
  }

  /**
   * Run a single test scenario
   */
  async runScenarioTest(browser, scenario) {
    console.log(`📋 Testing: ${scenario.name}`);
    console.log(`   ${scenario.description}`);

    const testResult = {
      name: scenario.name,
      description: scenario.description,
      passed: false,
      errors: [],
      warnings: [],
      qemuCommand: '',
      validationResults: null
    };

    this.results.total++;

    try {
      const page = await browser.newPage();
      await page.setViewport(this.options.viewport);
      
      // Navigate to the application
      await page.goto('http://localhost:3001', { 
        waitUntil: 'networkidle0',
        timeout: this.options.timeout 
      });

      // Wait for the application to load
      await page.waitForSelector('#canvas', { timeout: this.options.timeout });
      
      // Clear the canvas first
      await this.clearCanvas(page);

      // Create the test topology
      await this.createTopology(page, scenario);

      // Wait for QEMU command generation
      await page.waitForDelay(1000);

      // Extract the generated QEMU command
      const qemuCommand = await page.evaluate(() => {
        const commandElement = document.getElementById('qemu-command');
        return commandElement ? commandElement.textContent : '';
      });

      testResult.qemuCommand = qemuCommand;

      // Validate the command against expected patterns
      await this.validateScenario(scenario, qemuCommand, testResult);

      // Additional QEMU syntax validation
      const validationResults = this.validator.validateCommand(qemuCommand);
      testResult.validationResults = validationResults;

      if (!validationResults.isValid) {
        testResult.errors.push(...validationResults.errors);
      }
      testResult.warnings.push(...validationResults.warnings);

      // Determine if test passed
      testResult.passed = testResult.errors.length === 0;

      if (testResult.passed) {
        console.log('   ✅ PASSED\n');
        this.results.passed++;
      } else {
        console.log('   ❌ FAILED');
        testResult.errors.forEach(error => console.log(`      - ${error}`));
        console.log('');
        this.results.failed++;
      }

      await page.close();

    } catch (error) {
      testResult.errors.push(`Test execution error: ${error.message}`);
      console.log(`   ❌ FAILED: ${error.message}\n`);
      this.results.failed++;
    }

    this.results.tests.push(testResult);
  }

  /**
   * Clear the canvas of all components
   */
  async clearCanvas(page) {
    await page.click('#reset-canvas');
    await page.waitForDelay(500);
  }

  /**
   * Create topology based on scenario
   */
  async createTopology(page, scenario) {
    const componentMap = new Map();

    // Create all components first
    for (const comp of scenario.components) {
      const componentId = await this.createComponent(page, comp);
      componentMap.set(comp, componentId);
    }

    // Wait for all components to render
    await page.waitForDelay(1000);

    // Create connections
    for (const connection of scenario.connections) {
      await this.createConnection(page, connection, componentMap, scenario.components);
    }

    // Wait for QEMU command to update
    await page.waitForDelay(500);
  }

  /**
   * Create a single component
   */
  async createComponent(page, comp) {
    const buttonMap = {
      'host': '#add-host',
      'rootport': '#add-rootport', 
      'switch': '#add-switch',
      'device': '#add-device',
      'device-t2': '#add-device-t2',
      'window': '#add-window'
    };

    const button = buttonMap[comp.type];
    if (!button) {
      throw new Error(`Unknown component type: ${comp.type}`);
    }

    // Click the button to create component
    await page.click(button);
    await page.waitForDelay(300);

    // Get the latest component ID
    const componentId = await page.evaluate(() => {
      const components = document.querySelectorAll('.cxl-component');
      if (components.length === 0) return null;
      return components[components.length - 1].id;
    });

    if (!componentId) {
      throw new Error(`Failed to create component of type: ${comp.type}`);
    }

    // Move component to desired position
    if (comp.position) {
      await this.moveComponent(page, componentId, comp.position);
    }

    // Update component properties if needed
    if (this.hasCustomProperties(comp)) {
      await this.updateComponentProperties(page, componentId, comp);
    }

    return componentId;
  }

  /**
   * Check if component has custom properties
   */
  hasCustomProperties(comp) {
    const defaults = {
      host: ['qemuId', 'bus_nr'],
      rootport: ['qemuId', 'numDownstreamPorts', 'chassis', 'slot'],
      switch: ['qemuId', 'upstreamQemuId', 'numDownstreamPorts', 'chassis', 'startSlot', 'hasCCI'],
      device: ['qemuId', 'memObjId', 'size', 'memoryType', 'sn', 'isDCD', 'numDcRegions', 'lsaSize', 'lsaObjId'],
      'device-t2': ['qemuId', 'memObjId', 'size', 'sn'],
      window: ['qemuId', 'size', 'interleaveGranularity', 'hostBridgeIds']
    };

    const expectedProps = defaults[comp.type] || [];
    return expectedProps.some(prop => comp.hasOwnProperty(prop));
  }

  /**
   * Move component to specific position
   */
  async moveComponent(page, componentId, position) {
    const selector = `#${componentId}`;
    
    await page.evaluate((selector, x, y) => {
      const element = document.querySelector(selector);
      if (element) {
        element.style.left = `${x}px`;
        element.style.top = `${y}px`;
        
        // Update the component data
        const components = window.components || [];
        const comp = components.find(c => c.id === selector.substring(1));
        if (comp) {
          comp.x = x;
          comp.y = y;
        }
      }
    }, selector, position.x, position.y);
  }

  /**
   * Update component properties
   */
  async updateComponentProperties(page, componentId, comp) {
    // Click on component to select it
    await page.click(`#${componentId}`);
    await page.waitForDelay(300);

    // Update properties based on component type
    await page.evaluate((comp) => {
      // This would need to be implemented based on the actual property panel structure
      // For now, we'll simulate the property updates by directly modifying the component data
      const components = window.components || [];
      const component = components.find(c => c.id === comp.id || c.qemuId === comp.qemuId);
      if (component) {
        Object.assign(component, comp);
      }
    }, comp);

    await page.waitForDelay(300);
  }

  /**
   * Create connection between components
   */
  async createConnection(page, connection, componentMap, components) {
    // Find source and target components
    const sourceComp = components.find(c => c.type === connection.source.type);
    const targetComp = components.find(c => c.type === connection.target.type);
    
    if (!sourceComp || !targetComp) {
      throw new Error(`Cannot find components for connection: ${connection.source.type} -> ${connection.target.type}`);
    }

    const sourceId = componentMap.get(sourceComp);
    const targetId = componentMap.get(targetComp);

    // Click source port
    const sourcePortSelector = `.port[data-component-id="${sourceId}"][data-port-id="${connection.source.portId}"]`;
    await page.click(sourcePortSelector);
    await page.waitForDelay(200);

    // Click target port
    const targetPortSelector = `.port[data-component-id="${targetId}"][data-port-id="${connection.target.portId}"]`;
    await page.click(targetPortSelector);
    await page.waitForDelay(200);
  }

  /**
   * Validate scenario against expected patterns
   */
  async validateScenario(scenario, qemuCommand, testResult) {
    // Check expected patterns
    for (const pattern of scenario.expectedPatterns) {
      if (!pattern.test(qemuCommand)) {
        testResult.errors.push(`Missing expected pattern: ${pattern.source}`);
      }
    }

    // Check patterns that should NOT match
    if (scenario.shouldNotMatch) {
      for (const pattern of scenario.shouldNotMatch) {
        if (pattern.test(qemuCommand)) {
          testResult.errors.push(`Found forbidden pattern: ${pattern.source}`);
        }
      }
    }

    // Check for basic QEMU command structure
    if (!qemuCommand.includes('-M q35,cxl=on')) {
      testResult.errors.push('Missing required machine configuration');
    }

    // Validate command is not empty
    if (!qemuCommand.trim()) {
      testResult.errors.push('Generated QEMU command is empty');
    }
  }

  /**
   * Print test summary
   */
  printSummary() {
    console.log('\n📊 Test Summary');
    console.log('================');
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Success Rate: ${((this.results.passed / this.results.total) * 100).toFixed(1)}%`);

    if (this.results.failed > 0) {
      console.log('\n❌ Failed Tests:');
      this.results.tests
        .filter(test => !test.passed)
        .forEach(test => {
          console.log(`  - ${test.name}`);
          test.errors.forEach(error => console.log(`    ${error}`));
        });
    }

    console.log('\n' + (this.results.failed === 0 ? '🎉 All tests passed!' : '💥 Some tests failed.'));
  }

  /**
   * Generate detailed test report
   */
  generateReport() {
    const report = {
      summary: {
        total: this.results.total,
        passed: this.results.passed,
        failed: this.results.failed,
        successRate: (this.results.passed / this.results.total) * 100
      },
      tests: this.results.tests.map(test => ({
        name: test.name,
        description: test.description,
        passed: test.passed,
        errors: test.errors,
        warnings: test.warnings,
        qemuCommand: test.qemuCommand,
        validation: test.validationResults
      }))
    };

    return report;
  }
}

module.exports = { CxlTestRunner };

// CLI usage
if (require.main === module) {
  const runner = new CxlTestRunner({
    headless: !process.argv.includes('--no-headless'),
    timeout: parseInt(process.env.TEST_TIMEOUT) || 30000
  });

  runner.runAllTests()
    .then(results => {
      process.exit(results.failed === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}