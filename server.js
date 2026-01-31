const express = require('express');
const dgram = require('dgram');
const net = require('net');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static('public'));

const DISCOVERY_PORT = 9007;
const TCP_PORT = 9007;

let discoveredDevices = new Map();
let tcpConnections = new Map();
let sequenceNumber = 1;

function getNextSeq() {
  return sequenceNumber++ > 255 ? (sequenceNumber = 1) : sequenceNumber;
}

function parseDiscoveryMessage(message) {
  const str = message.toString();
  if (!str.startsWith('AG ')) return null;

  const params = {};
  const parts = str.substring(3).split(' ');
  
  for (const part of parts) {
    const [key, value] = part.split('=');
    if (key && value) params[key] = value;
  }

  return {
    ip: params.ip,
    port: parseInt(params.port),
    version: params.v,
    serial: params.serial,
    name: params.name,
    ports: parseInt(params.ports),
    antennas: parseInt(params.antennas),
    mode: params.mode,
    uptime: parseInt(params.uptime)
  };
}

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  socket.emit('devices', Array.from(discoveredDevices.values()));
  
  socket.on('connect_device', async (ip) => {
    console.log(`Connect device requested: ${ip}`);
    await connectToDevice(ip, socket);
  });

  socket.on('disconnect_device', (ip) => {
    console.log(`Disconnect device requested: ${ip}`);
    disconnectFromDevice(ip);
  });

  socket.on('set_antenna', (data) => {
    console.log(`Set antenna: port=${data.portId}, ant=${data.antennaId}`);
    setAntenna(data.ip, data.portId, data.antennaId, socket);
  });

  socket.on('get_status', (ip) => {
    console.log(`Get status requested: ${ip}`);
    getDeviceStatus(ip, socket);
  });

  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

async function connectToDevice(ip, socket) {
  if (tcpConnections.has(ip)) {
    console.log(`  Device ${ip} already connected, checking connection state`);
    const conn = tcpConnections.get(ip);
    if (conn && conn.client && conn.client.destroyed) {
      console.log(`  Existing connection destroyed, removing`);
      tcpConnections.delete(ip);
    } else {
      socket.emit('device_connected', { ip, status: 'already_connected' });
      return;
    }
  }

  const client = new net.Socket();
  
  client.on('connect', () => {
    console.log(`  TCP connected to ${ip}`);
    tcpConnections.set(ip, { client, socket });
    socket.emit('device_connected', { ip, status: 'connected' });
  });

  client.on('data', (data) => {
    handleTcpResponse(ip, data.toString(), socket);
  });

  client.on('error', (err) => {
    console.log(`  TCP error for ${ip}:`, err.message);
    socket.emit('device_error', { ip, error: err.message });
    disconnectFromDevice(ip);
  });

  client.on('close', () => {
    console.log(`  TCP closed for ${ip}`);
    disconnectFromDevice(ip);
  });

  try {
    await new Promise((resolve, reject) => {
      client.connect(TCP_PORT, ip, resolve);
      client.once('error', reject);
    });

    setTimeout(() => {
      sendCommand(ip, 'antenna list', socket);
      setTimeout(() => sendCommand(ip, 'port get 1', socket), 100);
      setTimeout(() => sendCommand(ip, 'port get 2', socket), 200);
      setTimeout(() => sendCommand(ip, 'sub port all', socket), 300);
    }, 500);
  } catch (err) {
    socket.emit('device_error', { ip, error: err.message });
  }
}

function disconnectFromDevice(ip) {
  const conn = tcpConnections.get(ip);
  if (conn) {
    conn.client.destroy();
    tcpConnections.delete(ip);
    io.emit('device_disconnected', { ip });
  }
}

function sendCommand(ip, command, socket) {
  const conn = tcpConnections.get(ip);
  if (!conn) {
    console.log(`  Cannot send command to ${ip}: no connection`);
    return;
  }

  const seq = getNextSeq();
  const cmd = `C${seq}|${command}\r\n`;
  console.log(`  Sending to ${ip}: ${cmd.trim()}`);
  conn.client.write(cmd);
}

function handleTcpResponse(ip, response, socket) {
  console.log(`  Received from ${ip}: ${response.trim()}`);
  const lines = response.trim().split('\n');
  
  for (const line of lines) {
    if (line.startsWith('V') && line.includes(' AG')) {
      const version = line.substring(1, line.indexOf(' AG'));
      socket.emit('device_info', { ip, version });
    }
    else if (line.startsWith('R')) {
      handleCommandResponse(ip, line, socket);
    }
    else if (line.startsWith('S')) {
      handleStatusMessage(ip, line, socket);
    }
  }
}

function handleCommandResponse(ip, line, socket) {
  const parts = line.split('|');
  if (parts.length < 2) return;

  const code = parts[1];
  const message = parts[2] || '';

  if (code !== '00' && code !== '0') {
    console.log(`  Error response for ${ip}: code=${code}, message=${message}`);
    socket.emit('command_error', { ip, error: code, message });
    return;
  }

  if (message.includes('antenna')) {
    const antennaMatch = message.match(/antenna (\d+) name=([^\s]+) tx=([^\s]+) rx=([^\s]+)/);
    if (antennaMatch) {
      console.log(`  Parsed antenna: id=${antennaMatch[1]}, name=${antennaMatch[2]}`);
      socket.emit('antenna_info', {
        ip,
        id: parseInt(antennaMatch[1]),
        name: antennaMatch[2].replace(/_/g, ' '),
        tx: antennaMatch[3],
        rx: antennaMatch[4]
      });
    } else {
      console.log(`  Failed to match antenna regex for: ${message}`);
    }
  }
  else if (message.includes('port')) {
    const portMatch = message.match(/port (\d+) auto=(\d+) source=(\S+) band=(\d+) rxant=(\d+) txant=(\d+)/);
    if (portMatch) {
      socket.emit('port_status', {
        ip,
        portId: parseInt(portMatch[1]),
        auto: portMatch[2] === '1',
        source: portMatch[3],
        band: parseInt(portMatch[4]),
        rxant: parseInt(portMatch[5]),
        txant: parseInt(portMatch[6])
      });
    }
  }
}

function handleStatusMessage(ip, line, socket) {
  const parts = line.split('|');
  if (parts.length < 2) return;

  const message = parts[1];

  if (message.includes('port')) {
    const portMatch = message.match(/port (\d+) auto=(\d+) source=(\S+) band=(\d+) rxant=(\d+) txant=(\d+)/);
    if (portMatch) {
      io.emit('port_status', {
        ip,
        portId: parseInt(portMatch[1]),
        auto: portMatch[2] === '1',
        source: portMatch[3],
        band: parseInt(portMatch[4]),
        rxant: parseInt(portMatch[5]),
        txant: parseInt(portMatch[6])
      });
    }
  }
}

function setAntenna(ip, portId, antennaId, socket) {
  const conn = tcpConnections.get(ip);
  if (!conn) {
    socket.emit('error', 'Not connected to device');
    return;
  }

  sendCommand(ip, `port set ${portId} rxant=${antennaId} txant=${antennaId}`, socket);
}

function getDeviceStatus(ip, socket) {
  const conn = tcpConnections.get(ip);
  if (!conn) {
    socket.emit('error', 'Not connected to device');
    return;
  }

  sendCommand(ip, 'port get 1', socket);
  sendCommand(ip, 'port get 2', socket);
}

const udpServer = dgram.createSocket('udp4');

udpServer.on('message', (msg, rinfo) => {
  const messageStr = msg.toString();
  console.log(`UDP received from ${rinfo.address}:${rinfo.port}: ${messageStr.substring(0, 100)}`);
  
  const device = parseDiscoveryMessage(msg);
  if (device) {
    device.lastSeen = Date.now();
    console.log(`Discovered: ${device.name} (${device.ip})`);
    const isNew = !discoveredDevices.has(device.ip);
    discoveredDevices.set(device.ip, device);
    
    if (isNew && discoveredDevices.size === 1) {
      console.log(`Auto-connecting to single discovered device: ${device.name}`);
      setTimeout(() => {
        io.sockets.emit('devices', Array.from(discoveredDevices.values()));
        const firstSocket = Array.from(io.sockets.sockets.values())[0];
        if (firstSocket) {
          connectToDevice(device.ip, firstSocket);
        }
      }, 500);
    }
    
    io.emit('device_discovered', device);
  }
});

udpServer.on('error', (err) => {
  console.error('UDP error:', err);
});

udpServer.bind({
  port: DISCOVERY_PORT,
  address: '0.0.0.0',
  reuseAddr: true
}, () => {
  console.log(`UDP discovery listener bound to port ${DISCOVERY_PORT}`);
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Listening for Antenna Genius discovery on UDP port ${DISCOVERY_PORT}`);
});
