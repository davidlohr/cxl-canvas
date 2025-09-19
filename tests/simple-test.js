const puppeteer = require('puppeteer');
const TestServer = require('./test-server');
const { QemuValidator } = require('./qemu-validator');

/**
 * Simple integration test that validates the default topology
 * and tests basic component creation
 */
class SimpleTestRunner {
  constructor() {
    this.server = new TestServer(3001);
    this.validator = new QemuValidator();
  }

  async runTests() {
    console.log('🧪 Simple CXL Canvas Integration Test');
    console.log('=====================================\n');

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
      
      // Test 1: Default topology
      console.log('✅ Test 1: Default topology validation');
      await this.testDefaultTopology(page);
      
      // Test 2: Add a device to existing topology
      console.log('✅ Test 2: Adding device to topology');
      await this.testAddDevice(page);
      
      // Test 3: Memory window configuration
      console.log('✅ Test 3: Memory window configuration');
      await this.testMemoryWindow(page);
      
      // Test 4: Reset and create new topology
      console.log('✅ Test 4: Reset and create simple topology');
      await this.testResetAndCreate(page);
      
      await browser.close();
      await this.server.stop();
      
      console.log('\n🎉 All simple tests passed!');
      return true;
      
    } catch (error) {
      console.error('❌ Test failed:', error.message);
      await this.server.stop();
      throw error;
    }
  }

  async testDefaultTopology(page) {
    const qemuCommand = await this.getQemuCommand(page);
    console.log('   Default command:', qemuCommand.substring(0, 80) + '...');
    
    // Validate the default topology has basic required elements
    const validation = this.validator.validateCommand(qemuCommand);
    if (!validation.isValid) {
      throw new Error(`Default topology validation failed: ${validation.errors.join(', ')}`);
    }
    
    // Check for basic CXL elements
    if (!qemuCommand.includes('-M q35,cxl=on')) {
      throw new Error('Missing CXL machine configuration');
    }
    
    if (!qemuCommand.includes('pxb-cxl')) {
      throw new Error('Missing CXL host bridge');
    }
    
    console.log('   ✓ Default topology is valid');
  }

  async testAddDevice(page) {
    // Add a Type3 device
    await page.click('#add-device');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Connect it to the existing root port
    await this.connectLastDeviceToRootPort(page);
    
    const qemuCommand = await this.getQemuCommand(page);
    console.log('   Command with device:', qemuCommand.substring(0, 80) + '...');
    
    // Should now have a device and memory object
    if (!qemuCommand.includes('cxl-type3')) {
      throw new Error('Missing Type3 device after adding');
    }
    
    if (!qemuCommand.includes('memory-backend-ram')) {
      throw new Error('Missing memory backend object');
    }
    
    console.log('   ✓ Device addition successful');
  }

  async testMemoryWindow(page) {
    // Add a memory window
    await page.click('#add-window');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Configure the window to target the host bridge
    await this.configureMemoryWindow(page);
    
    const qemuCommand = await this.getQemuCommand(page);
    console.log('   Command with window:', qemuCommand.substring(0, 80) + '...');
    
    // Should now have FMW configuration
    if (!qemuCommand.includes('cxl-fmw')) {
      throw new Error('Missing FMW configuration after adding window');
    }
    
    console.log('   ✓ Memory window configuration successful');
  }

  async testResetAndCreate(page) {
    // Reset canvas
    await page.click('#reset-canvas');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Should go back to default
    let qemuCommand = await this.getQemuCommand(page);
    
    // Add a switch-based topology
    await page.click('#add-switch');
    await new Promise(resolve => setTimeout(resolve, 500));
    
    // Connect switch to existing root port
    await this.connectLastSwitchToRootPort(page);
    
    qemuCommand = await this.getQemuCommand(page);
    console.log('   Command with switch:', qemuCommand.substring(0, 80) + '...');
    
    if (!qemuCommand.includes('cxl-upstream')) {
      throw new Error('Missing upstream switch port');
    }
    
    console.log('   ✓ Switch topology creation successful');
  }

  async connectLastDeviceToRootPort(page) {
    // This is a simplified connection - click on root port downstream, then device upstream
    try {
      // Find and click root port downstream port
      await page.click('.port.downstream');
      await new Promise(resolve => setTimeout(resolve, 200));
      
      // Find and click device upstream port  
      await page.click('.port.upstream');
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.log('   Note: Automatic connection failed, device may be unconnected');
    }
  }

  async connectLastSwitchToRootPort(page) {
    try {
      // Similar connection for switch
      await page.click('.port.downstream');
      await new Promise(resolve => setTimeout(resolve, 200));
      await page.click('.port.upstream');
      await new Promise(resolve => setTimeout(resolve, 200));
    } catch (error) {
      console.log('   Note: Automatic connection failed, switch may be unconnected');
    }
  }

  async configureMemoryWindow(page) {
    try {
      // Click on the memory window to select it
      const windowElements = await page.$$('.cxl-component');
      if (windowElements.length > 0) {
        await windowElements[windowElements.length - 1].click();
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Try to check the host bridge checkbox if it exists
        const hostCheckbox = await page.$('#host-checkboxes input[type="checkbox"]');
        if (hostCheckbox) {
          await hostCheckbox.click();
          await new Promise(resolve => setTimeout(resolve, 200));
          
          // Click update if button exists
          const updateButton = await page.$('#update-component');
          if (updateButton) {
            await updateButton.click();
            await new Promise(resolve => setTimeout(resolve, 500));
          }
        }
      }
    } catch (error) {
      console.log('   Note: Memory window configuration may have failed');
    }
  }

  async getQemuCommand(page) {
    return await page.evaluate(() => {
      const commandElement = document.getElementById('qemu-command');
      return commandElement ? commandElement.textContent : '';
    });
  }
}

// Run if called directly
if (require.main === module) {
  const runner = new SimpleTestRunner();
  runner.runTests()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { SimpleTestRunner };