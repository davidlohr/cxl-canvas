#!/usr/bin/env node

/**
 * Main test runner script
 * Orchestrates the entire test suite with different options
 */

const fs = require('fs').promises;
const path = require('path');
const { CxlTestRunner } = require('./cxl-test-runner');

class TestOrchestrator {
  constructor() {
    this.options = this.parseArgs();
  }

  parseArgs() {
    const args = process.argv.slice(2);
    const options = {
      headless: true,
      coverage: false,
      report: false,
      filter: null,
      timeout: 30000,
      verbose: false
    };

    for (let i = 0; i < args.length; i++) {
      const arg = args[i];
      switch (arg) {
        case '--no-headless':
          options.headless = false;
          break;
        case '--coverage':
          options.coverage = true;
          break;
        case '--report':
          options.report = true;
          break;
        case '--verbose':
          options.verbose = true;
          break;
        case '--filter':
          options.filter = args[++i];
          break;
        case '--timeout':
          options.timeout = parseInt(args[++i]) || 30000;
          break;
        case '--help':
          this.printHelp();
          process.exit(0);
          break;
      }
    }

    return options;
  }

  printHelp() {
    console.log(`
CXL Canvas Test Suite
====================

Usage: node run-tests.js [options]

Options:
  --no-headless    Run browser in non-headless mode (for debugging)
  --coverage       Generate coverage report (future enhancement)
  --report         Generate detailed HTML report
  --verbose        Enable verbose output
  --filter <name>  Run only tests matching the filter
  --timeout <ms>   Set test timeout in milliseconds (default: 30000)
  --help           Show this help message

Examples:
  node run-tests.js                           # Run all tests headless
  node run-tests.js --no-headless             # Run with visible browser
  node run-tests.js --filter "Basic"          # Run only tests with "Basic" in name
  node run-tests.js --report --verbose        # Generate report with verbose output
`);
  }

  async run() {
    console.log('🔧 CXL Canvas Test Orchestrator');
    console.log('================================');
    
    if (this.options.verbose) {
      console.log('Options:', this.options);
    }

    try {
      // Pre-flight checks
      await this.preflightChecks();

      // Use the realistic test runner instead
      const { RealisticTestRunner } = require('./realistic-test');
      const runner = new RealisticTestRunner();

      // Run tests
      const results = await runner.runAllTests();

      // Generate reports if requested
      if (this.options.report) {
        await this.generateReports(runner);
      }

      // Exit with appropriate code
      const exitCode = results.failed === 0 ? 0 : 1;
      process.exit(exitCode);

    } catch (error) {
      console.error('❌ Test orchestration failed:', error.message);
      if (this.options.verbose) {
        console.error(error.stack);
      }
      process.exit(1);
    }
  }

  async preflightChecks() {
    console.log('🔍 Running pre-flight checks...\n');

    // Check if index.html exists
    try {
      await fs.access(path.join(__dirname, '..', 'index.html'));
      console.log('✅ index.html found');
    } catch {
      throw new Error('index.html not found - ensure you are running from the project root');
    }

    // Check Node.js version
    const nodeVersion = process.version;
    const majorVersion = parseInt(nodeVersion.substring(1).split('.')[0]);
    if (majorVersion < 16) {
      throw new Error(`Node.js 16+ required, found ${nodeVersion}`);
    }
    console.log(`✅ Node.js version: ${nodeVersion}`);

    // Check if puppeteer is available
    try {
      require('puppeteer');
      console.log('✅ Puppeteer available');
    } catch {
      throw new Error('Puppeteer not installed - run: npm install puppeteer');
    }

    console.log('');
  }

  async generateReports(runner) {
    console.log('📄 Generating test reports...');

    const reportsDir = path.join(__dirname, 'reports');
    await fs.mkdir(reportsDir, { recursive: true });

    // Generate JSON report
    const report = runner.generateReport();
    const jsonPath = path.join(reportsDir, `test-report-${Date.now()}.json`);
    await fs.writeFile(jsonPath, JSON.stringify(report, null, 2));
    console.log(`📋 JSON report: ${jsonPath}`);

    // Generate HTML report
    const htmlReport = this.generateHtmlReport(report);
    const htmlPath = path.join(reportsDir, `test-report-${Date.now()}.html`);
    await fs.writeFile(htmlPath, htmlReport);
    console.log(`🌐 HTML report: ${htmlPath}`);

    // Generate latest symlinks
    const latestJsonPath = path.join(reportsDir, 'latest.json');
    const latestHtmlPath = path.join(reportsDir, 'latest.html');
    
    try {
      await fs.unlink(latestJsonPath);
      await fs.unlink(latestHtmlPath);
    } catch {
      // Ignore if files don't exist
    }
    
    await fs.writeFile(latestJsonPath, JSON.stringify(report, null, 2));
    await fs.writeFile(latestHtmlPath, htmlReport);
    
    console.log('✅ Reports generated successfully\n');
  }

  generateHtmlReport(report) {
    const timestamp = new Date().toISOString();
    const statusColor = report.summary.failed === 0 ? '#10b981' : '#ef4444';
    const statusText = report.summary.failed === 0 ? 'PASSED' : 'FAILED';

    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>CXL Canvas Test Report</title>
    <style>
        body { 
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            line-height: 1.6; 
            margin: 0; 
            padding: 20px; 
            background: #f5f5f5; 
        }
        .container { 
            max-width: 1200px; 
            margin: 0 auto; 
            background: white; 
            padding: 30px; 
            border-radius: 8px; 
            box-shadow: 0 2px 10px rgba(0,0,0,0.1); 
        }
        .header { 
            border-bottom: 2px solid #e5e7eb; 
            padding-bottom: 20px; 
            margin-bottom: 30px; 
        }
        .status { 
            display: inline-block; 
            padding: 8px 16px; 
            border-radius: 4px; 
            color: white; 
            font-weight: bold; 
            background: ${statusColor}; 
        }
        .summary { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); 
            gap: 20px; 
            margin-bottom: 30px; 
        }
        .metric { 
            background: #f9fafb; 
            padding: 20px; 
            border-radius: 6px; 
            text-align: center; 
        }
        .metric-value { 
            font-size: 2em; 
            font-weight: bold; 
            color: #374151; 
        }
        .metric-label { 
            color: #6b7280; 
            margin-top: 5px; 
        }
        .test-item { 
            border: 1px solid #e5e7eb; 
            margin-bottom: 20px; 
            border-radius: 6px; 
        }
        .test-header { 
            padding: 15px 20px; 
            background: #f9fafb; 
            border-bottom: 1px solid #e5e7eb; 
            cursor: pointer; 
        }
        .test-header:hover { 
            background: #f3f4f6; 
        }
        .test-title { 
            font-weight: bold; 
            color: #374151; 
        }
        .test-description { 
            color: #6b7280; 
            font-size: 0.9em; 
            margin-top: 5px; 
        }
        .test-status { 
            float: right; 
            padding: 4px 8px; 
            border-radius: 4px; 
            font-size: 0.8em; 
            font-weight: bold; 
        }
        .test-status.passed { 
            background: #d1fae5; 
            color: #065f46; 
        }
        .test-status.failed { 
            background: #fee2e2; 
            color: #991b1b; 
        }
        .test-details { 
            padding: 20px; 
            display: none; 
        }
        .test-details.active { 
            display: block; 
        }
        .errors { 
            background: #fef2f2; 
            border: 1px solid #fecaca; 
            border-radius: 4px; 
            padding: 15px; 
            margin-bottom: 15px; 
        }
        .warnings { 
            background: #fffbeb; 
            border: 1px solid #fed7aa; 
            border-radius: 4px; 
            padding: 15px; 
            margin-bottom: 15px; 
        }
        .qemu-command { 
            background: #1f2937; 
            color: #f9fafb; 
            padding: 15px; 
            border-radius: 4px; 
            font-family: 'Monaco', 'Consolas', monospace; 
            font-size: 0.85em; 
            white-space: pre-wrap; 
            overflow-x: auto; 
        }
        .footer { 
            margin-top: 40px; 
            padding-top: 20px; 
            border-top: 1px solid #e5e7eb; 
            text-align: center; 
            color: #6b7280; 
            font-size: 0.9em; 
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <h1>CXL Canvas Test Report</h1>
            <div class="status">${statusText}</div>
            <p>Generated: ${timestamp}</p>
        </div>

        <div class="summary">
            <div class="metric">
                <div class="metric-value">${report.summary.total}</div>
                <div class="metric-label">Total Tests</div>
            </div>
            <div class="metric">
                <div class="metric-value" style="color: #10b981">${report.summary.passed}</div>
                <div class="metric-label">Passed</div>
            </div>
            <div class="metric">
                <div class="metric-value" style="color: #ef4444">${report.summary.failed}</div>
                <div class="metric-label">Failed</div>
            </div>
            <div class="metric">
                <div class="metric-value">${report.summary.successRate.toFixed(1)}%</div>
                <div class="metric-label">Success Rate</div>
            </div>
        </div>

        <h2>Test Results</h2>
        ${report.tests.map((test, index) => `
            <div class="test-item">
                <div class="test-header" onclick="toggleDetails(${index})">
                    <div class="test-status ${test.passed ? 'passed' : 'failed'}">
                        ${test.passed ? 'PASSED' : 'FAILED'}
                    </div>
                    <div class="test-title">${test.name}</div>
                    <div class="test-description">${test.description}</div>
                </div>
                <div class="test-details" id="details-${index}">
                    ${test.errors.length > 0 ? `
                        <div class="errors">
                            <h4>Errors:</h4>
                            <ul>
                                ${test.errors.map(error => `<li>${error}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    ${test.warnings.length > 0 ? `
                        <div class="warnings">
                            <h4>Warnings:</h4>
                            <ul>
                                ${test.warnings.map(warning => `<li>${warning}</li>`).join('')}
                            </ul>
                        </div>
                    ` : ''}
                    <h4>Generated QEMU Command:</h4>
                    <div class="qemu-command">${test.qemuCommand}</div>
                </div>
            </div>
        `).join('')}

        <div class="footer">
            <p>CXL Canvas Automated Test Suite</p>
        </div>
    </div>

    <script>
        function toggleDetails(index) {
            const details = document.getElementById('details-' + index);
            details.classList.toggle('active');
        }
    </script>
</body>
</html>`;
  }
}

// Run the orchestrator
const orchestrator = new TestOrchestrator();
orchestrator.run();