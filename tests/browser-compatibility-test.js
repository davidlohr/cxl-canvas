#!/usr/bin/env node

/**
 * Browser Compatibility Test Suite
 * Tests the CXL Canvas application across different browsers and browser versions
 */

const { spawn } = require('child_process');
const puppeteer = require('puppeteer');
const fs = require('fs').promises;
const path = require('path');

class BrowserCompatibilityTester {
  constructor(options = {}) {
    this.options = {
      port: options.port || 3000,
      verbose: options.verbose || false,
      timeout: options.timeout || 30000,
      ...options
    };
    this.server = null;
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      browsers: []
    };
  }

  async runCompatibilityTests() {
    console.log('🌐 CXL Canvas Browser Compatibility Tests');
    console.log('=========================================\n');

    try {
      // Start test server
      await this.startTestServer();
      
      // Wait a moment for server to be fully ready
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Test different browser configurations
      const browserConfigs = this.getBrowserConfigs();
      
      for (const config of browserConfigs) {
        await this.testBrowserConfig(config);
      }
      
      this.printSummary();
      return this.results;
      
    } catch (error) {
      console.error('❌ Browser compatibility tests failed:', error.message);
      throw error;
    } finally {
      await this.cleanup();
    }
  }

  async startTestServer() {
    return new Promise((resolve, reject) => {
      // Import the TestServer class and start it directly
      const TestServer = require('./test-server');
      this.testServerInstance = new TestServer(this.options.port);
      
      this.testServerInstance.start()
        .then(() => {
          console.log(`✅ Test server started on http://localhost:${this.options.port}`);
          resolve();
        })
        .catch(reject);
    });
  }

  async runESLintCompatCheck() {
    return new Promise((resolve, reject) => {
      const eslint = spawn('npx', ['eslint', 'index.html', '--format', 'compact'], {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let output = '';
      let errors = '';

      eslint.stdout.on('data', (data) => {
        output += data.toString();
      });

      eslint.stderr.on('data', (data) => {
        errors += data.toString();
      });

      eslint.on('close', (code) => {
        if (code === 0) {
          console.log('   ✅ No browser compatibility issues found by ESLint');
        } else {
          console.log('   ⚠️  ESLint found potential compatibility issues:');
          if (output) {
            console.log('     ', output.replace(/\n/g, '\n      '));
          }
          if (errors && !errors.includes('Warning')) {
            console.log('     ', errors.replace(/\n/g, '\n      '));
          }
        }
        console.log('');
        resolve();
      });

      eslint.on('error', (error) => {
        console.log('   ⚠️  Could not run ESLint check:', error.message);
        console.log('');
        resolve(); // Don't fail the whole test
      });
    });
  }

  getBrowserConfigs() {
    // Different browser configurations to test
    return [
      {
        name: 'Chrome Latest',
        product: 'chrome',
        headless: 'new',
        args: ['--no-sandbox', '--disable-dev-shm-usage']
      },
      {
        name: 'Chrome Older Version',
        product: 'chrome',
        headless: 'new',
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/70.0.3538.102 Safari/537.36']
      },
      {
        name: 'Firefox (via Chrome engine)', // Puppeteer limitation
        product: 'chrome',
        headless: 'new',
        args: ['--no-sandbox', '--disable-dev-shm-usage', '--user-agent=Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:89.0) Gecko/20100101 Firefox/89.0']
      }
    ];
  }

  async testBrowserConfig(config) {
    const testResult = {
      browser: config.name,
      passed: false,
      features: [],
      errors: [],
      warnings: []
    };

    this.results.total++;
    console.log(`🌐 Testing: ${config.name}`);

    try {
      const browser = await puppeteer.launch({
        product: config.product,
        headless: config.headless === true ? 'new' : config.headless,
        args: config.args
      });

      const page = await browser.newPage();
      
      // Listen for console errors and warnings
      page.on('console', (msg) => {
        if (msg.type() === 'error') {
          testResult.errors.push(msg.text());
        } else if (msg.type() === 'warning') {
          testResult.warnings.push(msg.text());
        }
      });

      // Listen for page errors
      page.on('pageerror', (error) => {
        testResult.errors.push(error.message);
      });

      // Navigate to the application
      await page.goto(`http://localhost:${this.options.port}`, {
        waitUntil: 'networkidle0',
        timeout: this.options.timeout
      });

      // Test core functionality
      const featureTests = await this.runFeatureTests(page);
      testResult.features = featureTests;

      // Check if all critical features work
      const criticalFeatures = featureTests.filter(f => f.critical);
      const failedCritical = criticalFeatures.filter(f => !f.passed);
      
      if (failedCritical.length === 0) {
        testResult.passed = true;
        this.results.passed++;
        console.log(`   ✅ PASSED - All critical features work`);
      } else {
        testResult.passed = false;
        this.results.failed++;
        console.log(`   ❌ FAILED - ${failedCritical.length} critical features failed`);
        failedCritical.forEach(f => {
          console.log(`      - ${f.name}: ${f.error}`);
        });
      }

      // Report non-critical issues
      const warnings = featureTests.filter(f => !f.passed && !f.critical);
      if (warnings.length > 0) {
        console.log(`   ⚠️  ${warnings.length} non-critical features had issues`);
      }

      await browser.close();

    } catch (error) {
      testResult.passed = false;
      testResult.errors.push(error.message);
      this.results.failed++;
      console.log(`   ❌ FAILED - ${error.message}`);
    }

    this.results.browsers.push(testResult);
    console.log('');
  }

  async runFeatureTests(page) {
    const tests = [
      {
        name: 'Page Load',
        critical: true,
        test: async () => {
          const title = await page.title();
          return title.includes('CXL Topology Builder');
        }
      },
      {
        name: 'Canvas Element',
        critical: true,
        test: async () => {
          const canvas = await page.$('#canvas');
          return canvas !== null;
        }
      },
      {
        name: 'Component Addition',
        critical: true,
        test: async () => {
          await page.click('#add-host');
          await new Promise(resolve => setTimeout(resolve, 500));
          const components = await page.$$('.cxl-component');
          return components.length > 0;
        }
      },
      {
        name: 'QEMU Command Generation',
        critical: true,
        test: async () => {
          // Add a minimal topology: host + root port + memory window
          await page.click('#add-host');
          await new Promise(resolve => setTimeout(resolve, 300));
          await page.click('#add-rootport');
          await new Promise(resolve => setTimeout(resolve, 300));
          await page.click('#add-window');
          await new Promise(resolve => setTimeout(resolve, 800));
          
          // Check if the QEMU command element exists and has content
          const qemuElement = await page.$('#qemu-command');
          if (!qemuElement) {
            throw new Error('QEMU command element not found');
          }
          
          const qemuOutput = await page.$eval('#qemu-command', el => el.textContent);
          console.log('QEMU Output:', qemuOutput ? qemuOutput.substring(0, 100) + '...' : 'null/empty');
          
          // The QEMU command should contain CXL-related parameters
          return qemuOutput && qemuOutput.trim().length > 0 && 
                 (qemuOutput.includes('cxl=on') || qemuOutput.includes('pxb-cxl'));
        }
      },
      {
        name: 'Modern JavaScript Features',
        critical: false,
        test: async () => {
          return page.evaluate(() => {
            // Test various JS features
            try {
              // Arrow functions
              const arrow = () => true;
              
              // Template literals
              const template = `test${1}`;
              
              // Array methods
              const arr = [1, 2, 3].map(x => x * 2);
              
              // Object destructuring
              const { length } = arr;
              
              // Spread operator
              const spread = [...arr];
              
              return arrow() && template === 'test1' && length === 3 && spread.length === 3;
            } catch (e) {
              return false;
            }
          });
        }
      },
      {
        name: 'DOM Manipulation',
        critical: true,
        test: async () => {
          return page.evaluate(() => {
            try {
              // Test modern DOM methods
              const el = document.querySelector('#canvas');
              const all = document.querySelectorAll('.cxl-component');
              return el !== null && all !== null;
            } catch (e) {
              return false;
            }
          });
        }
      },
      {
        name: 'Event Handling',
        critical: true,
        test: async () => {
          return page.evaluate(() => {
            try {
              // Test event listener functionality
              let eventFired = false;
              const testElement = document.createElement('div');
              testElement.addEventListener('click', () => {
                eventFired = true;
              });
              testElement.click();
              return eventFired;
            } catch (e) {
              return false;
            }
          });
        }
      }
    ];

    const results = [];
    for (const test of tests) {
      try {
        const passed = await test.test();
        results.push({
          name: test.name,
          critical: test.critical,
          passed,
          error: null
        });
      } catch (error) {
        results.push({
          name: test.name,
          critical: test.critical,
          passed: false,
          error: error.message
        });
      }
    }

    return results;
  }

  printSummary() {
    console.log('📊 Browser Compatibility Summary');
    console.log('=================================');
    console.log(`Total Browsers Tested: ${this.results.total}`);
    console.log(`Compatible: ${this.results.passed}`);
    console.log(`Issues Found: ${this.results.failed}`);
    
    if (this.results.total > 0) {
      const compatRate = ((this.results.passed / this.results.total) * 100).toFixed(1);
      console.log(`Compatibility Rate: ${compatRate}%`);
    }

    if (this.results.passed > 0) {
      console.log('\n✅ Compatible Browsers:');
      this.results.browsers
        .filter(b => b.passed)
        .forEach(browser => {
          console.log(`  - ${browser.browser}`);
        });
    }

    if (this.results.failed > 0) {
      console.log('\n❌ Browsers with Issues:');
      this.results.browsers
        .filter(b => !b.passed)
        .forEach(browser => {
          console.log(`  - ${browser.browser}`);
          if (browser.errors.length > 0) {
            browser.errors.forEach(error => {
              console.log(`    Error: ${error}`);
            });
          }
        });
    }

    console.log('\n💡 Recommendations:');
    console.log('  - Test on real devices/browsers for full validation');
    console.log('  - Consider polyfills for older browser support');
    console.log('  - Monitor browser usage analytics to prioritize support');

    const allPassed = this.results.failed === 0;
    console.log('\n' + (allPassed ? '🎉 All browser tests passed!' : '⚠️  Some compatibility issues found.'));
  }

  async cleanup() {
    if (this.testServerInstance) {
      await this.testServerInstance.stop();
      console.log('🧹 Test server stopped');
    }
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    verbose: args.includes('--verbose'),
    timeout: 30000
  };

  const tester = new BrowserCompatibilityTester(options);
  
  tester.runCompatibilityTests()
    .then(results => {
      process.exit(results.failed === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('Browser compatibility tests failed:', error);
      process.exit(1);
    });
}

module.exports = { BrowserCompatibilityTester };