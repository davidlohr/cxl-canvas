/**
 * Test scenarios for CXL topology configurations
 * Each scenario defines a specific topology and expected QEMU command patterns
 */

const TEST_SCENARIOS = [
  {
    name: "Basic Host-RootPort-Device",
    description: "Simplest valid CXL topology",
    components: [
      {
        type: 'host',
        qemuId: 'cxl.0',
        bus_nr: 12,
        position: { x: 100, y: 100 }
      },
      {
        type: 'rootport', 
        qemuId: 'rp-0',
        numDownstreamPorts: 2,
        chassis: 0,
        slot: 0,
        position: { x: 100, y: 300 }
      },
      {
        type: 'device',
        qemuId: 'cxl-type3-dev-0',
        memObjId: 'mem0',
        size: '512M',
        memoryType: 'volatile',
        sn: '0x12345678',
        position: { x: 100, y: 500 }
      },
      {
        type: 'window',
        qemuId: 'fmw.0',
        size: '4G',
        interleaveGranularity: '256',
        hostBridgeIds: ['host-id'],
        position: { x: 400, y: 100 }
      }
    ],
    connections: [
      { source: { type: 'host', portId: 'out-0' }, target: { type: 'rootport', portId: 'in-0' } },
      { source: { type: 'rootport', portId: 'out-0' }, target: { type: 'device', portId: 'in-0' } }
    ],
    expectedPatterns: [
      /-M q35,cxl=on/,
      /-device pxb-cxl,bus=pcie\.0,id=cxl\.0,bus_nr=12/,
      /-device cxl-rp,bus=cxl\.0,port=0,id=rp-0\.0,chassis=0,slot=0/,
      /-device cxl-type3,bus=rp-0\.0,volatile-memdev=mem0,id=cxl-type3-dev-0,sn=0x12345678/,
      /-object memory-backend-ram,id=mem0,size=512M/,
      /cxl-fmw\.0\.size=4G/,
      /cxl-fmw\.0\.interleave-granularity=256/
    ]
  },

  {
    name: "Multi-Device RootPort",
    description: "RootPort with multiple devices connected",
    components: [
      {
        type: 'host',
        qemuId: 'cxl.0',
        bus_nr: 12,
        position: { x: 100, y: 100 }
      },
      {
        type: 'rootport',
        qemuId: 'rp-0', 
        numDownstreamPorts: 3,
        chassis: 0,
        slot: 0,
        position: { x: 100, y: 300 }
      },
      {
        type: 'device',
        qemuId: 'cxl-type3-dev-0',
        memObjId: 'mem0',
        size: '1G',
        memoryType: 'volatile',
        sn: '0x11111111',
        position: { x: 50, y: 500 }
      },
      {
        type: 'device-t2',
        qemuId: 'cxl-ac-dev-0',
        memObjId: 'mem-ac-0',
        size: '256M',
        sn: '0x22222222',
        position: { x: 150, y: 500 }
      }
    ],
    connections: [
      { source: { type: 'host', portId: 'out-0' }, target: { type: 'rootport', portId: 'in-0' } },
      { source: { type: 'rootport', portId: 'out-0' }, target: { type: 'device', portId: 'in-0' } },
      { source: { type: 'rootport', portId: 'out-1' }, target: { type: 'device-t2', portId: 'in-0' } }
    ],
    expectedPatterns: [
      /-device cxl-rp,bus=cxl\.0,port=0,id=rp-0\.0,chassis=0,slot=0/,
      /-device cxl-rp,bus=cxl\.0,port=1,id=rp-0\.1,chassis=0,slot=1/,
      /-device cxl-type3,bus=rp-0\.0,volatile-memdev=mem0,id=cxl-type3-dev-0,sn=0x11111111/,
      /-device cxl-accel,bus=rp-0\.1,volatile-memdev=mem-ac-0,id=cxl-ac-dev-0,sn=0x22222222/,
      /-object memory-backend-ram,id=mem0,size=1G/,
      /-object memory-backend-ram,id=mem-ac-0,size=256M/
    ]
  },

  {
    name: "Switch Topology",
    description: "Host -> RootPort -> Switch -> Devices",
    components: [
      {
        type: 'host',
        qemuId: 'cxl.0',
        bus_nr: 12,
        position: { x: 100, y: 100 }
      },
      {
        type: 'rootport',
        qemuId: 'rp-0',
        numDownstreamPorts: 2,
        chassis: 0,
        slot: 0,
        position: { x: 100, y: 300 }
      },
      {
        type: 'switch',
        qemuId: 'sw0',
        upstreamQemuId: 'us0',
        numDownstreamPorts: 4,
        chassis: 0,
        startSlot: 0,
        hasCCI: false,
        position: { x: 100, y: 500 }
      },
      {
        type: 'device',
        qemuId: 'cxl-type3-dev-0',
        memObjId: 'mem0',
        size: '2G',
        memoryType: 'volatile',
        sn: '0xAAAAAAAA',
        position: { x: 50, y: 700 }
      },
      {
        type: 'device',
        qemuId: 'cxl-type3-dev-1',
        memObjId: 'mem1',
        size: '2G',
        memoryType: 'volatile',
        sn: '0xBBBBBBBB',
        position: { x: 150, y: 700 }
      }
    ],
    connections: [
      { source: { type: 'host', portId: 'out-0' }, target: { type: 'rootport', portId: 'in-0' } },
      { source: { type: 'rootport', portId: 'out-0' }, target: { type: 'switch', portId: 'in-0' } },
      { source: { type: 'switch', portId: 'out-0' }, target: { type: 'device', portId: 'in-0' } },
      { source: { type: 'switch', portId: 'out-1' }, target: { type: 'device', portId: 'in-0' } }
    ],
    expectedPatterns: [
      /-device cxl-upstream,bus=rp-0\.0,id=us0/,
      /-device cxl-downstream,bus=us0,port=0,chassis=0,slot=0,id=sw0\.0/,
      /-device cxl-downstream,bus=us0,port=1,chassis=0,slot=1,id=sw0\.1/,
      /-device cxl-type3,bus=sw0\.0,volatile-memdev=mem0,id=cxl-type3-dev-0,sn=0xAAAAAAAA/,
      /-device cxl-type3,bus=sw0\.1,volatile-memdev=mem1,id=cxl-type3-dev-1,sn=0xBBBBBBBB/
    ]
  },

  {
    name: "Switch with CCI",
    description: "Switch with CCI mailbox enabled",
    components: [
      {
        type: 'host',
        qemuId: 'cxl.0',
        bus_nr: 12,
        position: { x: 100, y: 100 }
      },
      {
        type: 'rootport',
        qemuId: 'rp-0',
        numDownstreamPorts: 2,
        chassis: 0,
        slot: 0,
        position: { x: 100, y: 300 }
      },
      {
        type: 'switch',
        qemuId: 'sw0',
        upstreamQemuId: 'us0',
        numDownstreamPorts: 2,
        chassis: 1,
        startSlot: 5,
        hasCCI: true,
        position: { x: 100, y: 500 }
      }
    ],
    connections: [
      { source: { type: 'host', portId: 'out-0' }, target: { type: 'rootport', portId: 'in-0' } },
      { source: { type: 'rootport', portId: 'out-0' }, target: { type: 'switch', portId: 'in-0' } }
    ],
    expectedPatterns: [
      /-device cxl-upstream,bus=rp-0\.0,id=us0/,
      /-device cxl-downstream,bus=us0,port=0,chassis=1,slot=5,id=sw0\.0/,
      /-device cxl-downstream,bus=us0,port=1,chassis=1,slot=6,id=sw0\.1/,
      /-device cxl-switch-mailbox-cci,bus=us0,id=sw0-mailbox/
    ]
  },

  {
    name: "Persistent Memory Device", 
    description: "Device with persistent memory and LSA",
    components: [
      {
        type: 'host',
        qemuId: 'cxl.0',
        bus_nr: 12,
        position: { x: 100, y: 100 }
      },
      {
        type: 'rootport',
        qemuId: 'rp-0',
        numDownstreamPorts: 2,
        chassis: 0,
        slot: 0,
        position: { x: 100, y: 300 }
      },
      {
        type: 'device',
        qemuId: 'cxl-type3-dev-0',
        memObjId: 'mem0',
        lsaObjId: 'lsa-mem0',
        size: '1G',
        memoryType: 'persistent',
        lsaSize: '16M',
        sn: '0x33333333',
        position: { x: 100, y: 500 }
      }
    ],
    connections: [
      { source: { type: 'host', portId: 'out-0' }, target: { type: 'rootport', portId: 'in-0' } },
      { source: { type: 'rootport', portId: 'out-0' }, target: { type: 'device', portId: 'in-0' } }
    ],
    expectedPatterns: [
      /-device cxl-type3,bus=rp-0\.0,persistent-memdev=mem0,lsa=lsa-mem0,id=cxl-type3-dev-0,sn=0x33333333/,
      /-object memory-backend-file,id=mem0,size=1G,mem-path=\/tmp\/mem0\.bin,share=on/,
      /-object memory-backend-file,id=lsa-mem0,size=16M,mem-path=\/tmp\/lsa-mem0\.bin,share=on/
    ]
  },

  {
    name: "DCD Device",
    description: "Dynamic Capacity Device with multiple regions",
    components: [
      {
        type: 'host',
        qemuId: 'cxl.0',
        bus_nr: 12,
        position: { x: 100, y: 100 }
      },
      {
        type: 'rootport',
        qemuId: 'rp-0',
        numDownstreamPorts: 2,
        chassis: 0,
        slot: 0,
        position: { x: 100, y: 300 }
      },
      {
        type: 'device',
        qemuId: 'cxl-type3-dev-0',
        memObjId: 'mem0',
        size: '512M',
        isDCD: true,
        numDcRegions: 4,
        sn: '0x44444444',
        position: { x: 100, y: 500 }
      }
    ],
    connections: [
      { source: { type: 'host', portId: 'out-0' }, target: { type: 'rootport', portId: 'in-0' } },
      { source: { type: 'rootport', portId: 'out-0' }, target: { type: 'device', portId: 'in-0' } }
    ],
    expectedPatterns: [
      /-device cxl-type3,bus=rp-0\.0,volatile-dc-memdev=mem0,id=cxl-type3-dev-0,num-dc-regions=4,sn=0x44444444/,
      /-object memory-backend-ram,id=mem0,size=512M/
    ]
  },

  {
    name: "Multi-Host Interleaved",
    description: "Multiple hosts with shared memory window",
    components: [
      {
        type: 'host',
        qemuId: 'cxl.0',
        bus_nr: 12,
        position: { x: 50, y: 100 }
      },
      {
        type: 'host',
        qemuId: 'cxl.1',
        bus_nr: 13,
        position: { x: 200, y: 100 }
      },
      {
        type: 'window',
        qemuId: 'fmw.0',
        size: '8G',
        interleaveGranularity: '1k',
        hostBridgeIds: ['host1-id', 'host2-id'],
        position: { x: 350, y: 100 }
      }
    ],
    connections: [],
    expectedPatterns: [
      /-device pxb-cxl,bus=pcie\.0,id=cxl\.0,bus_nr=12/,
      /-device pxb-cxl,bus=pcie\.0,id=cxl\.1,bus_nr=13/,
      /cxl-fmw\.0\.size=8G/,
      /cxl-fmw\.0\.targets\.0=cxl\.0/,
      /cxl-fmw\.0\.targets\.1=cxl\.1/,
      /cxl-fmw\.0\.interleave-granularity=1k/
    ]
  },

  {
    name: "Complex Multi-Level Topology",
    description: "Deep hierarchy with multiple switches and devices",
    components: [
      {
        type: 'host',
        qemuId: 'cxl.0',
        bus_nr: 12,
        position: { x: 300, y: 50 }
      },
      {
        type: 'rootport',
        qemuId: 'rp-0',
        numDownstreamPorts: 3,
        chassis: 0,
        slot: 0,
        position: { x: 300, y: 200 }
      },
      {
        type: 'switch',
        qemuId: 'sw0',
        upstreamQemuId: 'us0',
        numDownstreamPorts: 3,
        chassis: 1,
        startSlot: 0,
        hasCCI: true,
        position: { x: 100, y: 350 }
      },
      {
        type: 'switch',
        qemuId: 'sw1',
        upstreamQemuId: 'us1',
        numDownstreamPorts: 2,
        chassis: 2,
        startSlot: 10,
        hasCCI: false,
        position: { x: 500, y: 350 }
      },
      {
        type: 'device',
        qemuId: 'cxl-type3-dev-0',
        memObjId: 'mem0',
        size: '1G',
        memoryType: 'volatile',
        sn: '0xDEADBEEF',
        position: { x: 50, y: 500 }
      },
      {
        type: 'device',
        qemuId: 'cxl-type3-dev-1',
        memObjId: 'mem1',
        size: '2G',
        memoryType: 'persistent',
        lsaSize: '32M',
        lsaObjId: 'lsa-mem1',
        sn: '0xCAFEBABE',
        position: { x: 150, y: 500 }
      },
      {
        type: 'device-t2',
        qemuId: 'cxl-ac-dev-0',
        memObjId: 'mem-ac-0',
        size: '512M',
        sn: '0xFEEDFACE',
        position: { x: 500, y: 500 }
      }
    ],
    connections: [
      { source: { type: 'host', portId: 'out-0' }, target: { type: 'rootport', portId: 'in-0' } },
      { source: { type: 'rootport', portId: 'out-0' }, target: { type: 'switch', portId: 'in-0' } },
      { source: { type: 'rootport', portId: 'out-1' }, target: { type: 'switch', portId: 'in-0' } },
      { source: { type: 'switch', portId: 'out-0' }, target: { type: 'device', portId: 'in-0' } },
      { source: { type: 'switch', portId: 'out-1' }, target: { type: 'device', portId: 'in-0' } },
      { source: { type: 'switch', portId: 'out-0' }, target: { type: 'device-t2', portId: 'in-0' } }
    ],
    expectedPatterns: [
      // Both switches should be connected
      /-device cxl-upstream,bus=rp-0\.0,id=us0/,
      /-device cxl-upstream,bus=rp-0\.1,id=us1/,
      // CCI only on first switch
      /-device cxl-switch-mailbox-cci,bus=us0,id=sw0-mailbox/,
      // Devices connected correctly
      /-device cxl-type3,bus=sw0\.0,volatile-memdev=mem0/,
      /-device cxl-type3,bus=sw0\.1,persistent-memdev=mem1,lsa=lsa-mem1/,
      /-device cxl-accel,bus=sw1\.0,volatile-memdev=mem-ac-0/
    ]
  },

  {
    name: "Invalid Topology - Unconnected Components",
    description: "Components not connected to host should be listed as unconnected",
    components: [
      {
        type: 'host',
        qemuId: 'cxl.0',
        bus_nr: 12,
        position: { x: 100, y: 100 }
      },
      {
        type: 'device',
        qemuId: 'cxl-type3-dev-0',
        memObjId: 'mem0',
        size: '1G',
        memoryType: 'volatile',
        sn: '0x12345678',
        position: { x: 300, y: 300 }
      },
      {
        type: 'switch',
        qemuId: 'sw0',
        upstreamQemuId: 'us0',
        numDownstreamPorts: 2,
        chassis: 0,
        startSlot: 0,
        hasCCI: false,
        position: { x: 500, y: 300 }
      }
    ],
    connections: [],
    expectedPatterns: [
      /-device pxb-cxl,bus=pcie\.0,id=cxl\.0,bus_nr=12/,
      /# Unconnected Components \(will be ignored by QEMU\):/,
      /#   - CXL Type3 Device \(cxl-type3-dev-0\)/,
      /#   - CXL Switch \(sw0\)/
    ],
    shouldNotMatch: [
      /-device cxl-type3/,
      /-device cxl-upstream/,
      /-object memory-backend-ram,id=mem0/
    ]
  }
];

module.exports = { TEST_SCENARIOS };