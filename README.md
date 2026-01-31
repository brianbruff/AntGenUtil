# Antenna Genius Web Controller

A web application for discovering and controlling 4O3A Antenna Genius devices on your network.

## Features

- **Auto-discovery**: Automatically detects Antenna Genius devices via UDP broadcasts
- **Real-time control**: Change antennas for Radio A and Radio B ports
- **Status monitoring**: View current antenna selection and band for each radio
- **WebSocket updates**: Real-time status updates without page refresh

## Quick Start

### Using Docker (Recommended)

1. Build and run with Docker Compose:
```bash
docker-compose up -d
```

2. Access the web interface at http://localhost:3000

### Manual Setup

1. Install dependencies:
```bash
npm install
```

2. Start the server:
```bash
npm start
```

3. Access the web interface at http://localhost:3000

## Network Requirements

The application needs:
- Port 3000 for HTTP/WebSocket access
- Port 9007/udp for Antenna Genius discovery broadcasts
- Port 9007/tcp for Antenna Genius control connection

## Usage

1. The application will automatically discover Antenna Genius devices on your network
2. Click "Connect" on a discovered device
3. View current antenna selection for Radio A and Radio B
4. Click the "A" or "B" button next to an antenna to select it for that radio port

## API Reference

### Discovery Protocol (UDP 9007)

Antenna Genius devices broadcast their presence every second:

```
AG ip=192.168.1.39 port=9007 v=4.0.22 serial=9A-3A-DC name=My_AG ports=2 antennas=8 mode=master uptime=3034
```

### TCP Control (TCP 9007)

The application connects to discovered devices and sends commands:

- `antenna list` - Get antenna configuration
- `port get <1|2>` - Get radio port status
- `port set <1|2> rxant=<n> txant=<n>` - Set antenna for radio port
- `sub port all` - Subscribe to status updates

## Troubleshooting

**No devices discovered:**
- Ensure your Antenna Genius is on the same network
- Check that UDP port 9007 is not blocked by firewall
- Try manual connection if you know the IP address

**Connection errors:**
- Verify TCP port 9007 is accessible
- Check Antenna Genius is powered on and connected to network
- Review browser console for error messages

## Development

To run in development mode:
```bash
npm run dev
```

## License

MIT
