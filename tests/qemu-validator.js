/**
 * QEMU Command Validator
 * Validates QEMU command syntax and CXL-specific parameters
 */

class QemuValidator {
  constructor() {
    // Valid QEMU device types for CXL
    this.validDeviceTypes = new Set([
      'pxb-cxl',
      'cxl-rp', 
      'cxl-upstream',
      'cxl-downstream',
      'cxl-type3',
      'cxl-accel',
      'cxl-switch-mailbox-cci'
    ]);

    // Valid object types for memory backends
    this.validObjectTypes = new Set([
      'memory-backend-ram',
      'memory-backend-file'
    ]);

    // Valid size suffixes
    this.validSizeSuffixes = /^[0-9]+[KMGT]?$/i;

    // Valid hex numbers (for serial numbers)
    this.validHex = /^0x[0-9A-F]+$/i;
  }

  /**
   * Parse QEMU command into structured format
   */
  parseCommand(commandText) {
    const cleanCommand = commandText
      .split('\n')
      .map(line => line.trim())
      .filter(line => line && !line.startsWith('#'))
      .join(' ')
      .replace(/\s+/g, ' ')
      .trim();

    const parts = this.splitCommandArgs(cleanCommand);
    const parsed = {
      machine: null,
      devices: [],
      objects: [],
      other: [],
      errors: []
    };

    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      
      if (part === '-M' || part === '-machine') {
        parsed.machine = parts[i + 1];
        i++; // Skip next part
      } else if (part === '-device') {
        parsed.devices.push(parts[i + 1]);
        i++; // Skip next part
      } else if (part === '-object') {
        parsed.objects.push(parts[i + 1]);
        i++; // Skip next part
      } else if (part.startsWith('-')) {
        parsed.other.push(part);
        if (i + 1 < parts.length && !parts[i + 1].startsWith('-')) {
          parsed.other.push(parts[i + 1]);
          i++; // Skip next part
        }
      }
    }

    return parsed;
  }

  /**
   * Split command arguments respecting quotes and escaping
   */
  splitCommandArgs(command) {
    const args = [];
    let current = '';
    let inQuotes = false;
    let escapeNext = false;

    for (let i = 0; i < command.length; i++) {
      const char = command[i];
      
      if (escapeNext) {
        current += char;
        escapeNext = false;
      } else if (char === '\\') {
        escapeNext = true;
      } else if (char === '"' || char === "'") {
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
    
    if (current) {
      args.push(current);
    }
    
    return args;
  }

  /**
   * Parse device/object parameter string
   */
  parseParameters(paramString) {
    const params = {};
    const parts = paramString.split(',');
    
    for (const part of parts) {
      const [key, ...valueParts] = part.split('=');
      if (key && valueParts.length > 0) {
        params[key.trim()] = valueParts.join('=').trim();
      } else {
        params[part.trim()] = true; // Boolean parameter
      }
    }
    
    return params;
  }

  /**
   * Validate complete QEMU command
   */
  validateCommand(commandText) {
    const results = {
      isValid: true,
      errors: [],
      warnings: [],
      parsed: null
    };

    try {
      const parsed = this.parseCommand(commandText);
      results.parsed = parsed;

      // Validate machine configuration
      this.validateMachine(parsed.machine, results);

      // Validate devices
      for (const deviceStr of parsed.devices) {
        this.validateDevice(deviceStr, results);
      }

      // Validate memory objects
      for (const objectStr of parsed.objects) {
        this.validateObject(objectStr, results);
      }

      // Validate CXL topology rules
      this.validateTopology(parsed, results);

    } catch (error) {
      results.isValid = false;
      results.errors.push(`Parse error: ${error.message}`);
    }

    results.isValid = results.errors.length === 0;
    return results;
  }

  /**
   * Validate machine configuration
   */
  validateMachine(machineStr, results) {
    if (!machineStr) {
      results.errors.push('Missing machine configuration');
      return;
    }

    const params = this.parseParameters(machineStr);
    
    if (!machineStr.includes('q35')) {
      results.errors.push('CXL requires q35 machine type');
    }
    
    if (!params.cxl || params.cxl !== 'on') {
      results.errors.push('CXL must be enabled in machine config (cxl=on)');
    }

    // Check for CXL fixed memory windows
    const fmwKeys = Object.keys(params).filter(key => key.startsWith('cxl-fmw.'));
    if (fmwKeys.length > 0) {
      for (const key of fmwKeys) {
        if (key.includes('.size') && !this.validSizeSuffixes.test(params[key])) {
          results.errors.push(`Invalid FMW size format: ${params[key]}`);
        }
        if (key.includes('.interleave-granularity')) {
          const validGranularities = ['256', '512', '1k', '2k', '4k', '8k', '16k'];
          if (!validGranularities.includes(params[key])) {
            results.errors.push(`Invalid interleave granularity: ${params[key]}`);
          }
        }
      }
    }
  }

  /**
   * Validate device configuration
   */
  validateDevice(deviceStr, results) {
    const params = this.parseParameters(deviceStr);
    const deviceType = Object.keys(params)[0]; // First parameter is usually device type
    
    if (!this.validDeviceTypes.has(deviceType)) {
      results.errors.push(`Invalid device type: ${deviceType}`);
      return;
    }

    // Device-specific validations
    switch (deviceType) {
      case 'pxb-cxl':
        this.validateHostBridge(params, results);
        break;
      case 'cxl-rp':
        this.validateRootPort(params, results);
        break;
      case 'cxl-upstream':
        this.validateUpstream(params, results);
        break;
      case 'cxl-downstream':
        this.validateDownstream(params, results);
        break;
      case 'cxl-type3':
        this.validateType3Device(params, results);
        break;
      case 'cxl-accel':
        this.validateType2Device(params, results);
        break;
      case 'cxl-switch-mailbox-cci':
        this.validateSwitchCCI(params, results);
        break;
    }
  }

  /**
   * Validate memory object configuration
   */
  validateObject(objectStr, results) {
    const params = this.parseParameters(objectStr);
    const objectType = Object.keys(params)[0];
    
    if (!this.validObjectTypes.has(objectType)) {
      results.errors.push(`Invalid object type: ${objectType}`);
      return;
    }

    // Common validations
    if (!params.id) {
      results.errors.push(`Memory object missing id parameter`);
    }
    
    if (!params.size || !this.validSizeSuffixes.test(params.size)) {
      results.errors.push(`Invalid memory size: ${params.size || 'missing'}`);
    }

    // Type-specific validations
    if (objectType === 'memory-backend-file') {
      if (!params['mem-path']) {
        results.errors.push('memory-backend-file requires mem-path parameter');
      }
      if (params.share !== 'on') {
        results.warnings.push('memory-backend-file should typically use share=on');
      }
    }
  }

  /**
   * Validate host bridge parameters
   */
  validateHostBridge(params, results) {
    if (!params.id) {
      results.errors.push('pxb-cxl device missing id parameter');
    }
    if (!params.bus_nr || isNaN(parseInt(params.bus_nr))) {
      results.errors.push('pxb-cxl device missing or invalid bus_nr');
    }
    if (params.bus !== 'pcie.0') {
      results.errors.push('pxb-cxl should be connected to pcie.0 bus');
    }
  }

  /**
   * Validate root port parameters
   */
  validateRootPort(params, results) {
    if (!params.id) {
      results.errors.push('cxl-rp device missing id parameter');
    }
    if (!params.bus) {
      results.errors.push('cxl-rp device missing bus parameter');
    }
    if (params.port === undefined || isNaN(parseInt(params.port))) {
      results.errors.push('cxl-rp device missing or invalid port number');
    }
    if (params.chassis === undefined || isNaN(parseInt(params.chassis))) {
      results.errors.push('cxl-rp device missing or invalid chassis number');
    }
    if (params.slot === undefined || isNaN(parseInt(params.slot))) {
      results.errors.push('cxl-rp device missing or invalid slot number');
    }
  }

  /**
   * Validate upstream port parameters
   */
  validateUpstream(params, results) {
    if (!params.id) {
      results.errors.push('cxl-upstream device missing id parameter');
    }
    if (!params.bus) {
      results.errors.push('cxl-upstream device missing bus parameter');
    }
  }

  /**
   * Validate downstream port parameters
   */
  validateDownstream(params, results) {
    if (!params.id) {
      results.errors.push('cxl-downstream device missing id parameter');
    }
    if (!params.bus) {
      results.errors.push('cxl-downstream device missing bus parameter');
    }
    if (params.port === undefined || isNaN(parseInt(params.port))) {
      results.errors.push('cxl-downstream device missing or invalid port number');
    }
  }

  /**
   * Validate Type 3 device parameters
   */
  validateType3Device(params, results) {
    if (!params.id) {
      results.errors.push('cxl-type3 device missing id parameter');
    }
    if (!params.bus) {
      results.errors.push('cxl-type3 device missing bus parameter');
    }
    
    // Must have exactly one of volatile-memdev, persistent-memdev, or volatile-dc-memdev
    const memdevTypes = ['volatile-memdev', 'persistent-memdev', 'volatile-dc-memdev'];
    const presentMemdevs = memdevTypes.filter(type => params[type]);
    
    if (presentMemdevs.length === 0) {
      results.errors.push('cxl-type3 device missing memory device parameter');
    } else if (presentMemdevs.length > 1) {
      results.errors.push('cxl-type3 device has multiple memory device parameters');
    }

    // LSA required for persistent memory
    if (params['persistent-memdev'] && !params.lsa) {
      results.errors.push('cxl-type3 persistent device missing lsa parameter');
    }

    // DC regions for DCD devices
    if (params['volatile-dc-memdev']) {
      if (!params['num-dc-regions'] || isNaN(parseInt(params['num-dc-regions']))) {
        results.errors.push('cxl-type3 DCD device missing or invalid num-dc-regions');
      } else {
        const numRegions = parseInt(params['num-dc-regions']);
        if (numRegions < 1 || numRegions > 8) {
          results.errors.push('cxl-type3 DCD device num-dc-regions must be 1-8');
        }
      }
    }

    // Serial number validation
    if (!params.sn || !this.validHex.test(params.sn)) {
      results.errors.push('cxl-type3 device missing or invalid serial number (sn)');
    }
  }

  /**
   * Validate Type 2 device parameters
   */
  validateType2Device(params, results) {
    if (!params.id) {
      results.errors.push('cxl-accel device missing id parameter');
    }
    if (!params.bus) {
      results.errors.push('cxl-accel device missing bus parameter');
    }
    if (!params['volatile-memdev']) {
      results.errors.push('cxl-accel device missing volatile-memdev parameter');
    }
    if (!params.sn || !this.validHex.test(params.sn)) {
      results.errors.push('cxl-accel device missing or invalid serial number (sn)');
    }
  }

  /**
   * Validate switch CCI parameters
   */
  validateSwitchCCI(params, results) {
    if (!params.id) {
      results.errors.push('cxl-switch-mailbox-cci device missing id parameter');
    }
    if (!params.bus) {
      results.errors.push('cxl-switch-mailbox-cci device missing bus parameter');
    }
  }

  /**
   * Validate overall topology rules
   */
  validateTopology(parsed, results) {
    // Extract bus hierarchy from devices
    const devices = {};
    const objects = new Set();
    
    // Build device map
    for (const deviceStr of parsed.devices) {
      const params = this.parseParameters(deviceStr);
      const deviceType = Object.keys(params)[0];
      const id = params.id;
      
      if (id) {
        devices[id] = { type: deviceType, params, bus: params.bus };
      }
    }

    // Build object map
    for (const objectStr of parsed.objects) {
      const params = this.parseParameters(objectStr);
      if (params.id) {
        objects.add(params.id);
      }
    }

    // Validate memory object references
    for (const [deviceId, device] of Object.entries(devices)) {
      const { type, params } = device;
      
      if (type === 'cxl-type3') {
        const memdevs = ['volatile-memdev', 'persistent-memdev', 'volatile-dc-memdev'];
        for (const memdevType of memdevs) {
          if (params[memdevType] && !objects.has(params[memdevType])) {
            results.errors.push(`Device ${deviceId} references missing memory object: ${params[memdevType]}`);
          }
        }
        
        if (params.lsa && !objects.has(params.lsa)) {
          results.errors.push(`Device ${deviceId} references missing LSA object: ${params.lsa}`);
        }
      }
      
      if (type === 'cxl-accel') {
        if (params['volatile-memdev'] && !objects.has(params['volatile-memdev'])) {
          results.errors.push(`Device ${deviceId} references missing memory object: ${params['volatile-memdev']}`);
        }
      }
    }

    // Validate bus references
    for (const [deviceId, device] of Object.entries(devices)) {
      const { type, params } = device;
      const bus = params.bus;
      
      if (bus && bus !== 'pcie.0' && !devices[bus] && !bus.includes('.')) {
        results.errors.push(`Device ${deviceId} references unknown bus: ${bus}`);
      }
    }

    // Validate CXL hierarchy rules
    this.validateCxlHierarchy(devices, results);
  }

  /**
   * Validate CXL-specific hierarchy rules
   */
  validateCxlHierarchy(devices, results) {
    // CXL devices should follow proper hierarchy:
    // Host Bridge -> Root Port -> Switch (optional) -> Device
    
    const hostBridges = Object.values(devices).filter(d => d.type === 'pxb-cxl');
    const rootPorts = Object.values(devices).filter(d => d.type === 'cxl-rp');
    const endpoints = Object.values(devices).filter(d => 
      d.type === 'cxl-type3' || d.type === 'cxl-accel'
    );

    if (endpoints.length > 0 && hostBridges.length === 0) {
      results.errors.push('CXL endpoints require at least one CXL host bridge');
    }

    if (endpoints.length > 0 && rootPorts.length === 0) {
      results.warnings.push('CXL endpoints typically require root ports');
    }

    // Check for orphaned switches
    const switches = Object.values(devices).filter(d => 
      d.type === 'cxl-upstream' || d.type === 'cxl-downstream'
    );
    
    if (switches.length > 0) {
      const upstreams = devices => devices.filter(d => d.type === 'cxl-upstream');
      const downstreams = devices => devices.filter(d => d.type === 'cxl-downstream');
      
      // Each downstream should have a corresponding upstream
      for (const downstream of downstreams(switches)) {
        const bus = downstream.params.bus;
        const upstream = upstreams(switches).find(u => u.params.id === bus);
        if (!upstream) {
          results.errors.push(`Downstream port ${downstream.params.id} references missing upstream: ${bus}`);
        }
      }
    }
  }
}

// Export for use in tests
module.exports = { QemuValidator };

// CLI usage
if (require.main === module) {
  const fs = require('fs');
  const validator = new QemuValidator();
  
  const commandFile = process.argv[2];
  if (!commandFile) {
    console.error('Usage: node qemu-validator.js <command-file>');
    process.exit(1);
  }
  
  try {
    const command = fs.readFileSync(commandFile, 'utf8');
    const results = validator.validateCommand(command);
    
    console.log('QEMU Command Validation Results:');
    console.log('================================');
    console.log(`Valid: ${results.isValid}`);
    
    if (results.errors.length > 0) {
      console.log('\nErrors:');
      results.errors.forEach(error => console.log(`  ❌ ${error}`));
    }
    
    if (results.warnings.length > 0) {
      console.log('\nWarnings:');
      results.warnings.forEach(warning => console.log(`  ⚠️  ${warning}`));
    }
    
    if (results.isValid) {
      console.log('\n✅ Command appears to be valid!');
    }
    
    process.exit(results.isValid ? 0 : 1);
    
  } catch (error) {
    console.error(`Error reading file: ${error.message}`);
    process.exit(1);
  }
}