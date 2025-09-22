#!/usr/bin/env node

/**
 * JavaScript Compatibility Checker
 * Analyzes the JavaScript code in index.html for browser compatibility issues
 */

const fs = require('fs').promises;
const path = require('path');

class JSCompatibilityChecker {
  constructor() {
    this.issues = [];
    this.features = [];
    this.browserSupport = {
      'Chrome >= 60': true,
      'Firefox >= 55': true,
      'Safari >= 12': true,
      'Edge >= 15': true
    };
  }

  async checkCompatibility() {
    console.log('🔍 JavaScript Compatibility Check');
    console.log('=================================\n');

    try {
      const indexHtml = await fs.readFile(path.join(__dirname, '../index.html'), 'utf8');
      
      // Extract JavaScript from HTML
      const jsCode = this.extractJavaScript(indexHtml);
      
      // Check for compatibility issues
      this.checkModernFeatures(jsCode);
      this.checkDOMAPIs(jsCode);
      this.checkES6Features(jsCode);
      this.checkPolyfillNeeds(jsCode);
      
      this.printReport();
      
      return {
        compatible: this.issues.length === 0,
        issues: this.issues,
        features: this.features
      };
      
    } catch (error) {
      console.error('❌ Failed to check compatibility:', error.message);
      throw error;
    }
  }

  extractJavaScript(html) {
    // Extract content between <script> tags
    const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
    let match;
    let jsCode = '';
    
    while ((match = scriptRegex.exec(html)) !== null) {
      // Skip external scripts
      if (!match[0].includes('src=')) {
        jsCode += match[1] + '\n';
      }
    }
    
    return jsCode;
  }

  checkModernFeatures(code) {
    const checks = [
      {
        pattern: /const\s+/g,
        feature: 'const declarations',
        support: 'Chrome 49+, Firefox 36+, Safari 10+, Edge 12+',
        level: 'good'
      },
      {
        pattern: /let\s+/g,
        feature: 'let declarations',
        support: 'Chrome 49+, Firefox 44+, Safari 10+, Edge 12+',
        level: 'good'
      },
      {
        pattern: /=>\s*[({]/g,
        feature: 'arrow functions',
        support: 'Chrome 45+, Firefox 22+, Safari 10+, Edge 12+',
        level: 'good'
      },
      {
        pattern: /`[^`]*\$\{[^}]*\}[^`]*`/g,
        feature: 'template literals',
        support: 'Chrome 41+, Firefox 34+, Safari 9+, Edge 12+',
        level: 'good'
      },
      {
        pattern: /\.\.\./g,
        feature: 'spread operator',
        support: 'Chrome 46+, Firefox 27+, Safari 10+, Edge 12+',
        level: 'good'
      },
      {
        pattern: /Array\.from/g,
        feature: 'Array.from()',
        support: 'Chrome 45+, Firefox 32+, Safari 9+, Edge 12+',
        level: 'good'
      },
      {
        pattern: /\.includes\(/g,
        feature: 'Array.includes() / String.includes()',
        support: 'Chrome 47+, Firefox 43+, Safari 9+, Edge 14+',
        level: 'good'
      },
      {
        pattern: /\.forEach\(/g,
        feature: 'Array.forEach()',
        support: 'Widely supported',
        level: 'excellent'
      },
      {
        pattern: /\.map\(/g,
        feature: 'Array.map()',
        support: 'Widely supported',
        level: 'excellent'
      },
      {
        pattern: /\.filter\(/g,
        feature: 'Array.filter()',
        support: 'Widely supported',
        level: 'excellent'
      },
      {
        pattern: /\.find\(/g,
        feature: 'Array.find()',
        support: 'Chrome 45+, Firefox 25+, Safari 7.1+, Edge 12+',
        level: 'good'
      },
      {
        pattern: /async\s+function/g,
        feature: 'async/await',
        support: 'Chrome 55+, Firefox 52+, Safari 11+, Edge 15+',
        level: 'warning'
      },
      {
        pattern: /\?\?/g,
        feature: 'nullish coalescing (??)',
        support: 'Chrome 80+, Firefox 72+, Safari 13.1+, Edge 80+',
        level: 'warning'
      },
      {
        pattern: /\?\./g,
        feature: 'optional chaining (?.)',
        support: 'Chrome 80+, Firefox 74+, Safari 13.1+, Edge 80+',
        level: 'warning'
      }
    ];

    checks.forEach(check => {
      const matches = code.match(check.pattern);
      if (matches) {
        this.features.push({
          feature: check.feature,
          count: matches.length,
          support: check.support,
          level: check.level
        });

        if (check.level === 'warning') {
          this.issues.push({
            type: 'compatibility_warning',
            feature: check.feature,
            message: `${check.feature} may not be supported in older browsers`,
            support: check.support
          });
        }
      }
    });
  }

  checkDOMAPIs(code) {
    const domChecks = [
      {
        pattern: /document\.querySelector/g,
        feature: 'querySelector',
        support: 'Widely supported',
        level: 'excellent'
      },
      {
        pattern: /document\.querySelectorAll/g,
        feature: 'querySelectorAll',
        support: 'Widely supported',
        level: 'excellent'
      },
      {
        pattern: /\.addEventListener/g,
        feature: 'addEventListener',
        support: 'Widely supported',
        level: 'excellent'
      },
      {
        pattern: /\.classList/g,
        feature: 'classList API',
        support: 'IE 10+, widely supported in modern browsers',
        level: 'good'
      },
      {
        pattern: /new CustomEvent/g,
        feature: 'CustomEvent constructor',
        support: 'Chrome 15+, Firefox 11+, Safari 6+, Edge 12+',
        level: 'good'
      },
      {
        pattern: /requestAnimationFrame/g,
        feature: 'requestAnimationFrame',
        support: 'Chrome 24+, Firefox 23+, Safari 6.1+, Edge 12+',
        level: 'good'
      }
    ];

    domChecks.forEach(check => {
      const matches = code.match(check.pattern);
      if (matches) {
        this.features.push({
          feature: check.feature,
          count: matches.length,
          support: check.support,
          level: check.level
        });
      }
    });
  }

  checkES6Features(code) {
    // Check for destructuring
    if (code.match(/const\s*{[^}]+}\s*=/g)) {
      this.features.push({
        feature: 'object destructuring',
        count: code.match(/const\s*{[^}]+}\s*=/g).length,
        support: 'Chrome 49+, Firefox 41+, Safari 10+, Edge 14+',
        level: 'good'
      });
    }

    // Check for default parameters
    if (code.match(/function[^(]*\([^)]*=[^)]*\)/g)) {
      this.features.push({
        feature: 'default parameters',
        count: code.match(/function[^(]*\([^)]*=[^)]*\)/g).length,
        support: 'Chrome 49+, Firefox 15+, Safari 10+, Edge 14+',
        level: 'good'
      });
    }
  }

  checkPolyfillNeeds(code) {
    const polyfillChecks = [
      {
        pattern: /Object\.assign/g,
        feature: 'Object.assign',
        polyfill: 'Consider Object.assign polyfill for IE support'
      },
      {
        pattern: /Promise/g,
        feature: 'Promises',
        polyfill: 'Consider Promise polyfill for IE support'
      },
      {
        pattern: /fetch\(/g,
        feature: 'Fetch API',
        polyfill: 'Consider fetch polyfill for IE support'
      }
    ];

    polyfillChecks.forEach(check => {
      const matches = code.match(check.pattern);
      if (matches) {
        this.issues.push({
          type: 'polyfill_recommendation',
          feature: check.feature,
          message: check.polyfill,
          count: matches.length
        });
      }
    });
  }

  printReport() {
    console.log('📊 JavaScript Feature Analysis');
    console.log('==============================');
    
    if (this.features.length > 0) {
      console.log('\n✅ Detected JavaScript Features:');
      
      const byLevel = {
        excellent: this.features.filter(f => f.level === 'excellent'),
        good: this.features.filter(f => f.level === 'good'),
        warning: this.features.filter(f => f.level === 'warning')
      };

      if (byLevel.excellent.length > 0) {
        console.log('\n  🟢 Excellent Browser Support:');
        byLevel.excellent.forEach(f => {
          console.log(`    - ${f.feature} (used ${f.count} times)`);
        });
      }

      if (byLevel.good.length > 0) {
        console.log('\n  🟡 Good Browser Support:');
        byLevel.good.forEach(f => {
          console.log(`    - ${f.feature} (used ${f.count} times) - ${f.support}`);
        });
      }

      if (byLevel.warning.length > 0) {
        console.log('\n  🟠 Limited Browser Support:');
        byLevel.warning.forEach(f => {
          console.log(`    - ${f.feature} (used ${f.count} times) - ${f.support}`);
        });
      }
    }

    if (this.issues.length > 0) {
      console.log('\n⚠️  Compatibility Issues & Recommendations:');
      this.issues.forEach(issue => {
        if (issue.type === 'compatibility_warning') {
          console.log(`  - ⚠️  ${issue.message}`);
          console.log(`      Support: ${issue.support}`);
        } else if (issue.type === 'polyfill_recommendation') {
          console.log(`  - 💡 ${issue.message} (detected ${issue.count} usage${issue.count > 1 ? 's' : ''})`);
        }
      });
    }

    console.log('\n📝 Browser Compatibility Summary:');
    console.log('================================');
    
    Object.keys(this.browserSupport).forEach(browser => {
      const supported = this.browserSupport[browser];
      console.log(`${supported ? '✅' : '❌'} ${browser}: ${supported ? 'Compatible' : 'Issues detected'}`);
    });

    const hasWarnings = this.issues.filter(i => i.type === 'compatibility_warning').length > 0;
    const hasPolyfillNeeds = this.issues.filter(i => i.type === 'polyfill_recommendation').length > 0;

    console.log('\n💡 Recommendations:');
    console.log('==================');
    
    if (!hasWarnings && !hasPolyfillNeeds) {
      console.log('✅ Your code uses well-supported JavaScript features!');
      console.log('✅ No immediate compatibility concerns detected.');
    } else {
      if (hasWarnings) {
        console.log('⚠️  Consider testing newer features in target browsers');
      }
      if (hasPolyfillNeeds) {
        console.log('💡 Consider adding polyfills for broader browser support');
      }
    }
    
    console.log('🧪 Run browser tests with: npm run test:browser-compat');
    
    const allGood = this.issues.filter(i => i.type === 'compatibility_warning').length === 0;
    console.log('\n' + (allGood ? '🎉 JavaScript compatibility looks good!' : '⚠️  Some compatibility considerations found.'));
  }
}

// CLI usage
if (require.main === module) {
  const checker = new JSCompatibilityChecker();
  
  checker.checkCompatibility()
    .then(result => {
      const hasErrors = result.issues.filter(i => i.type === 'compatibility_warning').length > 0;
      process.exit(hasErrors ? 1 : 0);
    })
    .catch(error => {
      console.error('Compatibility check failed:', error);
      process.exit(1);
    });
}

module.exports = { JSCompatibilityChecker };