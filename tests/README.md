# CXL Canvas Testing Framework

This directory contains a comprehensive testing framework for validating CXL topology QEMU command generation and actual VM boot functionality.

## Test Levels

### 1. Syntax Validation (`npm test`)
**Fast validation tests** - Validates QEMU command syntax and structure
- Checks basic CXL configuration
- Validates parameter formats
- Tests application behavior (default, random, reset)
- **Runtime**: ~10 seconds
- **Requirements**: Node.js, Puppeteer

### 2. Realistic Application Testing (`npm run test:realistic`)  
**Comprehensive UI testing** - Tests actual application behavior
- Tests 5 random topology generations
- Validates memory window configuration
- Tests component property handling
- **Runtime**: ~30 seconds
- **Requirements**: Node.js, Puppeteer

### 3. VM Boot Testing (`npm run test:vm-boot`)
**Actual QEMU boot testing** - Boots real VMs with generated commands
- Starts QEMU VMs with generated commands
- Checks for boot completion
- Parses logs for CXL device indicators
- **Runtime**: ~5 minutes per topology
- **Requirements**: QEMU, optionally CXL-enabled kernel

### 4. CXL Device Verification (`npm run test:cxl-verification`)
**Complete end-to-end testing** - Verifies CXL devices in running VMs
- Boots VMs with CXL-enabled kernel
- Runs `cxl list` command inside VM
- Verifies exact device counts match topology
- Tests device functionality
- **Runtime**: ~10 minutes per topology
- **Requirements**: QEMU, CXL-enabled kernel, CXL userspace tools

## Setup for Advanced Testing

### Basic Testing (Levels 1-2)
```bash
npm install
npm test
```

### VM Boot Testing (Level 3)
```bash
# Install QEMU
sudo apt-get install qemu-system-x86

# Run basic VM boot tests
npm run test:vm-boot
```

### Full CXL Verification (Level 4)

#### 1. CXL-Enabled Kernel
You need a kernel with CXL support. Options:

**Option A: Build from upstream kernel**
```bash
# Download kernel 6.0+ with CXL support
wget https://cdn.kernel.org/pub/linux/kernel/v6.x/linux-6.8.tar.xz
tar xf linux-6.8.tar.xz
cd linux-6.8

# Configure with CXL support
make defconfig
scripts/config --enable CONFIG_CXL_BUS
scripts/config --enable CONFIG_CXL_MEM  
scripts/config --enable CONFIG_CXL_ACPI
scripts/config --enable CONFIG_CXL_PMEM
scripts/config --enable CONFIG_CXL_PCI

# Build kernel
make -j$(nproc)
```

**Option B: Use prebuilt CXL kernel**
```bash
# Download from CXL project (if available)
# Or build using distro packages with CXL support
```

#### 2. CXL Userspace Tools
```bash
# Install ndctl/cxl tools
git clone https://github.com/pmem/ndctl.git
cd ndctl
./autogen.sh
./configure --enable-cxl
make && sudo make install
```

#### 3. Run Full Verification
```bash
# Set environment variables
export CXL_KERNEL_PATH=/path/to/cxl-kernel/vmlinuz
export CXL_INITRD_PATH=/path/to/initrd-with-cxl-tools.img

# Run complete verification
npm run test:cxl-verification -- --verbose
```

## Environment Variables

### Required for VM Testing
- `QEMU_PATH`: Path to QEMU binary (default: `qemu-system-x86_64`)

### Required for CXL Verification  
- `CXL_KERNEL_PATH`: Path to CXL-enabled kernel
- `CXL_INITRD_PATH`: Path to initrd with CXL tools (optional)

### Optional
- `VM_TIMEOUT`: VM timeout in milliseconds (default: 120000)
- `TEST_TIMEOUT`: Test timeout in milliseconds (default: 30000)

## Example Usage

### Quick validation during development
```bash
npm test
```

### Test specific scenarios
```bash
# Test with visible browser for debugging
npm run test:realistic -- --no-headless

# Generate HTML test reports  
npm run test:full -- --report --verbose
```

### VM boot testing
```bash
# Basic boot test (no OS required)
npm run test:vm-boot

# With custom QEMU path
QEMU_PATH=/usr/local/bin/qemu-system-x86_64 npm run test:vm-boot
```

### Complete CXL verification
```bash
# Full end-to-end testing
CXL_KERNEL_PATH=./cxl-kernel/vmlinuz npm run test:cxl-verification -- --verbose
```

## Test Output

### Successful VM Boot Test
```
🚀 CXL Canvas VM Boot Tests
===========================

🔧 Testing VM Boot: Default Topology
   Expected CXL devices: 1
   ✅ PASSED - Found 1/1 CXL devices

🔧 Testing VM Boot: Random Topology 1  
   Expected CXL devices: 3
   ✅ PASSED - Found 3/3 CXL devices

📊 VM Boot Test Summary
=======================
Total Tests: 2
Passed: 2
Failed: 0
Success Rate: 100.0%
```

### Successful CXL Verification
```
🔬 CXL Device Verification Tests
================================

🧪 Enhanced CXL Test: Default Topology
   Expected CXL devices: 1
   ✅ PASSED - Verified 1 CXL devices (expected 1)

=== CXL Device Verification ===
✅ CXL tools found
--- CXL List Output ---
{
  "memdevs":[
    {
      "memdev":"mem0",
      "size":"512.00 MiB (536.87 MB)",
      "devtype":"memory"
    }
  ]
}
```

## Troubleshooting

### VM Boot Tests Fail
- Verify QEMU is installed: `qemu-system-x86_64 --version`
- Check system has virtualization support: `grep -E 'vmx|svm' /proc/cpuinfo`
- Try with verbose output: `npm run test:vm-boot -- --verbose`

### CXL Verification Tests Fail
- Ensure CXL kernel is properly configured
- Check CXL tools are in initrd: `cxl --version`
- Verify CXL support in kernel: `grep CXL /boot/config-$(uname -r)`

### Test Timeouts
- Increase timeout: `VM_TIMEOUT=300000 npm run test:vm-boot`
- Check system resources (RAM, CPU)
- Run fewer tests in parallel

## Integration with CI/CD

The test framework supports automated testing in CI environments:

```yaml
# .github/workflows/test.yml
- name: Run basic validation
  run: npm test

- name: Run VM boot tests  
  run: npm run test:vm-boot
  if: matrix.include-vm-tests

- name: Run full CXL verification
  run: npm run test:cxl-verification
  if: matrix.include-cxl-verification
  env:
    CXL_KERNEL_PATH: ${{ secrets.CXL_KERNEL_PATH }}
```

This provides complete validation from syntax checking to actual CXL device functionality verification.