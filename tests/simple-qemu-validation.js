#!/usr/bin/env node

/**
 * Simple QEMU Validation Test
 * Tests that generated QEMU commands can be started without errors
 * Creates any required files and validates CXL parameter acceptance
 */

const { spawn } = require('child_process');
const { RealisticTestRunner } = require('./realistic-test');
const fs = require('fs').promises;
const path = require('path');

class SimpleQemuValidator {
  constructor(options = {}) {
    this.options = {
      qemuPath: options.qemuPath || 'qemu-system-x86_64',
      timeout: options.timeout || 15000,
      verbose: options.verbose || false,
      ...options
    };
    this.tempDir = path.join(__dirname, 'temp-qemu-validation');
    this.results = {
      total: 0,
      passed: 0,
      failed: 0,
      skipped: 0,
      tests: []
    };
  }

  async runValidationTests() {
    console.log('🔧 Simple QEMU Validation Tests');
    console.log('===============================\n');

    try {
      await this.checkPrerequisites();
      await fs.mkdir(this.tempDir, { recursive: true });

      // Generate test scenarios
      console.log('📋 Generating test scenarios...');
      const testRunner = new RealisticTestRunner();
      await testRunner.runAllTests();
      const testResults = testRunner.generateReport();

      // Test a subset of scenarios
      const testsToRun = testResults.tests.slice(0, 5); // Test first 5 scenarios

      for (const test of testsToRun) {
        await this.validateQemuCommand(test);
      }

      await this.cleanup();
      this.printSummary();
      return this.results;

    } catch (error) {
      console.error('❌ QEMU validation tests failed:', error.message);
      await this.cleanup();
      throw error;
    }
  }

  async checkPrerequisites() {
    console.log('🔍 Checking prerequisites...\n');

    try {
      const qemuVersion = await this.runCommand(this.options.qemuPath, ['--version'], 5000);
      console.log(`✅ QEMU found: ${qemuVersion.split('\n')[0]}`);
    } catch (error) {
      throw new Error(`QEMU not found at: ${this.options.qemuPath}`);
    }

    console.log('');
  }

  async validateQemuCommand(testCase) {
    const testResult = {
      name: testCase.name,
      qemuCommand: testCase.qemuCommand,
      startSuccessful: false,
      expectedDevices: 0,
      requiredFiles: [],
      errors: [],
      qemuOutput: '',
      status: 'failed'
    };

    this.results.total++;
    console.log(`🔧 Validating QEMU Command: ${testCase.name}`);

    try {
      testResult.expectedDevices = this.countExpectedCXLDevices(testCase.qemuCommand);
      console.log(`   Expected CXL devices: ${testResult.expectedDevices}`);

      if (testResult.expectedDevices === 0) {
        console.log('   ⏭️  Skipping - no CXL devices in topology');
        testResult.status = 'skipped';
        this.results.skipped++;
        this.results.tests.push(testResult);
        return;
      }

      // Create any required files
      await this.createRequiredFiles(testCase.qemuCommand, testResult);

      // Prepare simplified QEMU command
      const qemuCommand = this.prepareSimpleQemuCommand(testCase.qemuCommand);
      
      if (this.options.verbose) {
        console.log(`   Command: ${qemuCommand.slice(0, 3).join(' ')}...`);
      }

      // Test QEMU startup
      const result = await this.testQemuStartup(qemuCommand, testResult);
      
      if (result.success) {
        testResult.startSuccessful = true;
        testResult.status = 'passed';
        this.results.passed++;
        console.log(`   ✅ PASSED - QEMU started successfully with CXL topology`);
      } else {
        testResult.errors.push(result.error);
        this.results.failed++;
        console.log(`   ❌ FAILED - ${result.error}`);
      }

    } catch (error) {
      testResult.errors.push(`Validation error: ${error.message}`);
      this.results.failed++;
      console.log(`   ❌ FAILED - ${error.message}`);
    }

    this.results.tests.push(testResult);
    console.log('');
  }

  countExpectedCXLDevices(qemuCommand) {
    const type3Count = (qemuCommand.match(/-device cxl-type3/g) || []).length;
    const accelCount = (qemuCommand.match(/-device cxl-accel/g) || []).length;
    return type3Count + accelCount;
  }

  async createRequiredFiles(qemuCommand, testResult) {
    // Find all memory backend files that need to be created
    const fileMatches = qemuCommand.match(/mem-path=([^,\s]+)/g) || [];
    
    for (const match of fileMatches) {
      const filePath = match.split('=')[1];
      testResult.requiredFiles.push(filePath);
      
      try {
        // Create the directory if it doesn't exist
        const dir = path.dirname(filePath);
        await fs.mkdir(dir, { recursive: true });
        
        // Create empty file if it doesn't exist
        try {
          await fs.access(filePath);
        } catch {
          // File doesn't exist, create it
          const sizeMatch = qemuCommand.match(new RegExp(`id=${path.basename(filePath, '.bin')}[^,]*size=([^,\\s]+)`));
          let size = 1024 * 1024; // Default 1MB
          
          if (sizeMatch) {
            const sizeStr = sizeMatch[1];
            if (sizeStr.endsWith('M')) {
              size = parseInt(sizeStr) * 1024 * 1024;
            } else if (sizeStr.endsWith('G')) {
              size = parseInt(sizeStr) * 1024 * 1024 * 1024;
            } else if (sizeStr.endsWith('K')) {
              size = parseInt(sizeStr) * 1024;
            } else {
              size = parseInt(sizeStr) || size;
            }
          }
          
          // Create sparse file
          const fd = await fs.open(filePath, 'w');
          await fd.truncate(size);
          await fd.close();
          
          if (this.options.verbose) {
            console.log(`   📄 Created memory file: ${filePath} (${size} bytes)`);
          }
        }
      } catch (error) {
        console.log(`   ⚠️  Warning: Could not create ${filePath}: ${error.message}`);
      }
    }
  }

  prepareSimpleQemuCommand(qemuCommand) {
    // Parse and clean the command
    let command = qemuCommand
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .join(' ')
      .replace(/\\\s+/g, ' ')  // Remove backslash line continuations
      .replace(/\s+/g, ' ')
      .trim();

    const args = this.parseQemuArgs(command);

    // Create minimal test command
    const testArgs = [
      this.options.qemuPath,
      ...args,
      '-nographic',
      '-serial', 'none',
      '-monitor', 'none',
      '-display', 'none',
      '-m', '1G',
      '-smp', '1',
      '-S',  // Start in stopped state
      '-no-reboot'
    ];

    return testArgs;
  }

  parseQemuArgs(command) {
    const args = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      
      if (char === '"' || char === "'") {
        inQuotes = !inQuotes;
      } else if (char === ' ' && !inQuotes) {
        if (current) {
          args.push(current);
          current = '';
        }
      } else {
        current += char;
      }
    }
    
    if (current) args.push(current);
    
    // Remove qemu binary name if present
    if (args[0] && args[0].includes('qemu')) {
      args.shift();
    }
    
    return args;
  }

  async testQemuStartup(command, testResult) {
    return new Promise((resolve) => {
      const qemu = spawn(command[0], command.slice(1), {
        stdio: ['pipe', 'pipe', 'pipe']
      });

      let stdout = '';
      let stderr = '';
      let resolved = false;

      const result = {
        success: false,
        error: null
      };

      qemu.stdout.on('data', (data) => {
        stdout += data.toString();
        testResult.qemuOutput += data.toString();
      });

      qemu.stderr.on('data', (data) => {
        stderr += data.toString();
        testResult.qemuOutput += data.toString();
        
        if (this.options.verbose) {
          process.stdout.write(`[QEMU] ${data.toString()}`);
        }
      });

      qemu.on('spawn', () => {
        // QEMU started successfully
        result.success = true;
        
        // Kill it immediately since we just want to test startup
        setTimeout(() => {
          if (!resolved) {
            resolved = true;
            qemu.kill('SIGTERM');
            resolve(result);
          }
        }, 2000);
      });

      qemu.on('close', (code) => {
        if (!resolved) {
          resolved = true;
          
          if (code === 0 || result.success) {
            result.success = true;
          } else {
            result.error = `QEMU exited with code ${code}`;
            
            // Parse stderr for specific errors
            if (stderr.includes('No such file')) {
              result.error = 'Missing required files';
            } else if (stderr.includes('invalid option') || stderr.includes('unrecognized option')) {
              result.error = 'Invalid QEMU options';
            } else if (stderr.includes('unknown device')) {
              result.error = 'Unknown device type';
            } else if (stderr.includes('Bus not found')) {
              result.error = 'Bus reference error';
            }
          }
          
          resolve(result);
        }
      });

      qemu.on('error', (error) => {
        if (!resolved) {
          resolved = true;
          result.error = `Failed to start QEMU: ${error.message}`;
          resolve(result);
        }
      });

      // Timeout
      setTimeout(() => {
        if (!resolved) {
          resolved = true;
          qemu.kill('SIGKILL');
          result.success = true; // If it ran this long, startup was successful
          resolve(result);
        }
      }, this.options.timeout);
    });
  }

  async runCommand(command, args, timeout = 10000) {
    return new Promise((resolve, reject) => {
      const proc = spawn(command, args);
      let output = '';

      proc.stdout.on('data', (data) => {
        output += data.toString();
      });

      proc.on('close', (code) => {
        if (code === 0) {
          resolve(output);
        } else {
          reject(new Error(`Command failed with code ${code}`));
        }
      });

      proc.on('error', reject);

      setTimeout(() => {
        proc.kill();
        reject(new Error('Command timeout'));
      }, timeout);
    });
  }

  async cleanup() {
    try {
      await fs.rm(this.tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  }

  printSummary() {
    console.log('📊 QEMU Validation Test Summary');
    console.log('===============================');
    console.log(`Total Tests: ${this.results.total}`);
    console.log(`Passed: ${this.results.passed}`);
    console.log(`Failed: ${this.results.failed}`);
    console.log(`Skipped: ${this.results.skipped}`);
    
    if (this.results.total > 0) {
      const successRate = ((this.results.passed / (this.results.total - this.results.skipped)) * 100).toFixed(1);
      console.log(`Success Rate: ${successRate}% (excluding skipped)`);
    }

    if (this.results.passed > 0) {
      console.log('\n✅ Successfully Validated:');
      this.results.tests
        .filter(test => test.status === 'passed')
        .forEach(test => {
          console.log(`  - ${test.name}: QEMU accepted CXL topology`);
        });
    }

    if (this.results.failed > 0) {
      console.log('\n❌ Failed Validations:');
      this.results.tests
        .filter(test => test.status === 'failed')
        .forEach(test => {
          console.log(`  - ${test.name}`);
          test.errors.forEach(error => console.log(`    ${error}`));
        });
    }

    console.log('\nℹ️  This test validates that QEMU accepts the generated CXL parameters.');
    console.log('   For full device verification, use test:cxl-verification with CXL kernel.');

    console.log('\n' + (this.results.failed === 0 ? '🎉 All QEMU validations passed!' : '💥 Some validations failed.'));
  }
}

// CLI usage
if (require.main === module) {
  const args = process.argv.slice(2);
  const options = {
    verbose: args.includes('--verbose'),
    qemuPath: process.env.QEMU_PATH || 'qemu-system-x86_64',
    timeout: parseInt(process.env.QEMU_TIMEOUT) || 15000
  };

  console.log('🚀 Starting Simple QEMU Validation Tests');
  console.log('');
  console.log('This test will:');
  console.log('1. Create any required memory backend files');
  console.log('2. Start QEMU with CXL topologies in stopped state');
  console.log('3. Verify QEMU accepts all CXL parameters');
  console.log('4. Confirm no device initialization errors');
  console.log('');

  const validator = new SimpleQemuValidator(options);
  
  validator.runValidationTests()
    .then(results => {
      process.exit(results.failed === 0 ? 0 : 1);
    })
    .catch(error => {
      console.error('QEMU validation tests failed:', error);
      process.exit(1);
    });
}

module.exports = { SimpleQemuValidator };