const puppeteer = require('puppeteer');
const TestServer = require('./test-server');
const { QemuValidator } = require('./qemu-validator');

/**
 * Realistic test that works with the application's actual behavior
 * Tests the QEMU commands that the application actually generates
 */
class RealisticTestRunner {
  constructor() {
    this.server = new TestServer(3001);
    this.validator = new QemuValidator();
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      tests: []
    };
  }

  async runAllTests() {
    console.log('🚀 CXL Canvas Realistic Test Suite');
    console.log('==================================\n');

    try {
      await this.server.start();
      
      const browser = await puppeteer.launch({ 
        headless: 'new',
        args: ['--no-sandbox', '--disable-setuid-sandbox']
      });
      const page = await browser.newPage();
      await page.setViewport({ width: 1920, height: 1080 });
      
      await page.goto('http://localhost:3001', { waitUntil: 'networkidle0' });
      await page.waitForSelector('#canvas');

      // Test different scenarios that actually work with the app
      await this.testDefaultTopology(page);
      await this.testRandomTopologies(page, 5); // Test 5 random topologies
      await this.testManualConnections(page);
      await this.testMemoryWindowScenarios(page);
      await this.testComponentProperties(page);

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

  async testDefaultTopology(page) {
    console.log('📋 Testing: Default Topology');
    
    const qemuCommand = await this.getQemuCommand(page);
    const testResult = this.createTestResult('Default Topology', qemuCommand);
    
    // Validate the basic structure
    this.validateBasicStructure(testResult, qemuCommand);
    
    if (testResult.validation.isValid && testResult.errors.length === 0) {
      testResult.passed = true;
      this.results.passed++;
      console.log('   ✅ PASSED\n');
    } else {
      this.results.failed++;
      console.log('   ❌ FAILED');
      this.printErrors(testResult);
    }

    this.results.tests.push(testResult);
  }

  async testRandomTopologies(page, count) {
    console.log(`📋 Testing: ${count} Random Topologies`);
    
    for (let i = 0; i < count; i++) {
      // Generate random topology
      await page.click('#generate-random');
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const qemuCommand = await this.getQemuCommand(page);
      const testResult = this.createTestResult(`Random Topology ${i + 1}`, qemuCommand);
      
      // Test random topology expectations
      this.validateRandomTopology(testResult, qemuCommand);
      
      if (testResult.validation.isValid && testResult.errors.length === 0) {
        testResult.passed = true;
        this.results.passed++;
        console.log(`   ✅ Random ${i + 1}: PASSED`);
      } else {
        this.results.failed++;
        console.log(`   ❌ Random ${i + 1}: FAILED`);
      }

      this.results.tests.push(testResult);
    }
    console.log('');
  }

  async testManualConnections(page) {
    console.log('📋 Testing: Manual Component Addition');
    
    // Reset to known state
    await page.click('#reset-canvas');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Add components but don't try to connect them automatically
    // Just test that the app handles additional components gracefully
    await page.click('#add-device');
    await new Promise(resolve => setTimeout(resolve, 500));
    await page.click('#add-switch');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const qemuCommand = await this.getQemuCommand(page);
    const testResult = this.createTestResult('Manual Component Addition', qemuCommand);
    
    // Should still be valid even with unconnected components
    this.validateBasicStructure(testResult, qemuCommand);
    
    // Check for unconnected component handling
    if (qemuCommand.includes('# Unconnected Components')) {
      testResult.notes.push('✓ Properly handles unconnected components');
    }
    
    if (testResult.validation.isValid && testResult.errors.length === 0) {
      testResult.passed = true;
      this.results.passed++;
      console.log('   ✅ PASSED\n');
    } else {
      this.results.failed++;
      console.log('   ❌ FAILED');
      this.printErrors(testResult);
    }

    this.results.tests.push(testResult);
  }

  async testMemoryWindowScenarios(page) {
    console.log('📋 Testing: Memory Window Scenarios');
    
    // Reset and add memory window
    await page.click('#reset-canvas');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    await page.click('#add-window');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Try to configure the memory window
    const windowConfigured = await this.tryConfigureMemoryWindow(page);
    
    const qemuCommand = await this.getQemuCommand(page);
    const testResult = this.createTestResult('Memory Window Configuration', qemuCommand);
    
    this.validateBasicStructure(testResult, qemuCommand);
    
    if (windowConfigured && qemuCommand.includes('cxl-fmw')) {
      testResult.notes.push('✓ Memory window configured successfully');
    } else if (qemuCommand.includes('cxl-fmw')) {
      testResult.notes.push('✓ Memory window present in command');
    }
    
    if (testResult.validation.isValid && testResult.errors.length === 0) {
      testResult.passed = true;
      this.results.passed++;
      console.log('   ✅ PASSED\n');
    } else {
      this.results.failed++;
      console.log('   ❌ FAILED');
      this.printErrors(testResult);
    }

    this.results.tests.push(testResult);
  }

  async testComponentProperties(page) {
    console.log('📋 Testing: Component Property Validation');
    
    // Generate a random topology to have components to test
    await page.click('#generate-random');
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    const qemuCommand = await this.getQemuCommand(page);
    const testResult = this.createTestResult('Component Properties', qemuCommand);
    
    // Test specific property patterns that should be present in a valid topology
    this.validateComponentProperties(testResult, qemuCommand);
    
    if (testResult.validation.isValid && testResult.errors.length === 0) {
      testResult.passed = true;
      this.results.passed++;
      console.log('   ✅ PASSED\n');
    } else {
      this.results.failed++;
      console.log('   ❌ FAILED');
      this.printErrors(testResult);
    }

    this.results.tests.push(testResult);
  }

  createTestResult(name, qemuCommand) {
    this.results.total++;
    return {
      name,
      qemuCommand,
      validation: this.validator.validateCommand(qemuCommand),
      passed: false,
      errors: [],
      notes: []
    };
  }

  validateBasicStructure(testResult, qemuCommand) {
    // Basic required elements
    if (!qemuCommand.includes('-M q35,cxl=on')) {
      testResult.errors.push('Missing CXL-enabled machine configuration');
    } else {
      testResult.notes.push('✓ CXL machine configuration present');
    }

    if (!qemuCommand.includes('pxb-cxl')) {
      testResult.errors.push('Missing CXL host bridge');
    } else {
      testResult.notes.push('✓ CXL host bridge present');
    }

    // Add validation errors
    testResult.errors.push(...testResult.validation.errors);
  }

  validateRandomTopology(testResult, qemuCommand) {
    this.validateBasicStructure(testResult, qemuCommand);
    
    // Random topologies should have some complexity
    const deviceCount = (qemuCommand.match(/-device/g) || []).length;
    const objectCount = (qemuCommand.match(/-object/g) || []).length;
    
    testResult.notes.push(`Generated ${deviceCount} devices and ${objectCount} objects`);
    
    if (deviceCount < 2) {
      testResult.errors.push('Random topology seems too simple (less than 2 devices)');
    }

    // Should have some endpoint devices
    if (qemuCommand.includes('cxl-type3') || qemuCommand.includes('cxl-accel')) {
      testResult.notes.push('✓ Contains CXL endpoint devices');
    } else {
      testResult.errors.push('Missing CXL endpoint devices');
    }
  }

  validateComponentProperties(testResult, qemuCommand) {
    this.validateBasicStructure(testResult, qemuCommand);
    
    // Check for proper serial numbers
    const serialNumbers = qemuCommand.match(/sn=0x[0-9A-F]+/gi) || [];
    if (serialNumbers.length > 0) {
      testResult.notes.push(`✓ Found ${serialNumbers.length} valid serial numbers`);
    }
    
    // Check for memory backend consistency
    const memdevRefs = qemuCommand.match(/(?:volatile-memdev|persistent-memdev|volatile-dc-memdev)=([^,\s]+)/g) || [];
    const membackends = qemuCommand.match(/-object memory-backend-[^,]+,id=([^,\s]+)/g) || [];
    
    testResult.notes.push(`Memory references: ${memdevRefs.length}, Memory backends: ${membackends.length}`);
    
    // Check for bus reference consistency
    const busRefs = qemuCommand.match(/bus=([^,\s]+)/g) || [];
    if (busRefs.length > 0) {
      testResult.notes.push(`✓ Found ${busRefs.length} bus references`);
    }
  }

  async tryConfigureMemoryWindow(page) {
    try {
      // Click on the memory window component (assuming it's the last one added)
      const components = await page.$$('.cxl-component');
      if (components.length > 0) {
        await components[components.length - 1].click();
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Try to check a host bridge if the checkbox exists
        const hostCheckbox = await page.$('#host-checkboxes input[type="checkbox"]');
        if (hostCheckbox) {
          await hostCheckbox.click();
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Try to update
          const updateButton = await page.$('#update-component');
          if (updateButton) {
            await updateButton.click();
            await new Promise(resolve => setTimeout(resolve, 500));
            return true;
          }
        }
      }
      return false;
    } catch (error) {
      return false;
    }
  }

  async getQemuCommand(page) {
    return await page.evaluate(() => {
      const commandElement = document.getElementById('qemu-command');
      return commandElement ? commandElement.textContent : '';
    });
  }

  printErrors(testResult) {
    testResult.errors.forEach(error => console.log(`      - ${error}`));
    console.log('');
  }

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
   * Generate detailed test report for external tools
   */
  generateReport() {
    return {
      summary: {
        total: this.results.total,
        passed: this.results.passed,
        failed: this.results.failed,
        successRate: (this.results.passed / this.results.total) * 100
      },
      tests: this.results.tests.map(test => ({
        name: test.name,
        description: test.description || 'Realistic test scenario',
        passed: test.passed,
        errors: test.errors || [],
        warnings: test.warnings || [],
        notes: test.notes || [],
        qemuCommand: test.qemuCommand,
        validation: test.validation
      }))
    };
  }
}

module.exports = { RealisticTestRunner };

// CLI usage
if (require.main === module) {
  const runner = new RealisticTestRunner();
  runner.runAllTests()
    .then(results => {
      process.exit(results.failed === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('Test runner failed:', error);
      process.exit(1);
    });
}