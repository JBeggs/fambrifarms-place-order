# Fambri Order Processor

Simple Electron app for processing WhatsApp orders manually with a user-friendly interface.

## For End Users (Windows)

### Installation
1. Download the latest `.exe` installer from releases
2. Run the installer and follow the setup wizard
3. The app will create a desktop shortcut "Fambri Order Processor"

### Usage
1. Double-click the desktop shortcut to launch
2. The app will display WhatsApp messages in a list
3. Select messages by clicking checkboxes
4. Choose customer from dropdown
5. Click "Create Order" to process
6. Continue with remaining messages

## For Developers (Mac/Windows)

### Prerequisites
- Node.js 18+ 
- npm or yarn

### Development Setup
```bash
# Clone the repository
git clone https://github.com/JBeggs/fambrifarms-place-order.git
cd fambrifarms-place-order

# Install dependencies
npm install

# Run in development mode
npm run dev
```

### Building for Windows (from Mac)
```bash
# Build Windows executable
npm run build:win

# Output will be in dist/ folder
# Copy the .exe file to Windows machine
```

### Building for Mac
```bash
# Build Mac app
npm run build:mac
```

## Configuration

### Backend Connection
Set environment variables:
- `BACKEND_API_URL` - Django backend URL (e.g., `http://localhost:8000`)
- `TARGET_GROUP_NAME` - WhatsApp group name to monitor

### Customer Data
The app fetches customer list from: `${BACKEND_API_URL}/api/customers/`

## Troubleshooting

### Windows Issues
- **App won't start**: Run as Administrator
- **Network errors**: Check Windows Firewall settings
- **Missing dependencies**: Install Visual C++ Redistributable

### Connection Issues
- Verify backend URL is accessible
- Check network connectivity
- Ensure Django backend is running

## Simple User Workflow

1. **Launch App** → Double-click desktop icon
2. **See Messages** → All WhatsApp messages displayed
3. **Select Messages** → Click checkboxes for one order
4. **Pick Customer** → Choose from dropdown
5. **Create Order** → Click button to process
6. **Repeat** → Continue with next set of messages

No technical knowledge required!
