# Deployment Guide - Place Order Application

## 🎯 Overview

This guide covers deploying the Place Order Electron application from macOS development to Windows production environments.

## 📋 Prerequisites

### Development Environment (macOS)
- Node.js 16+ with npm
- Git for version control
- Chrome browser for testing
- Django backend running locally

### Target Environment (Windows)
- Windows 10/11 (64-bit)
- Chrome browser installed
- Network access to backend API
- Administrator privileges for installation

## 🏗️ Build Process

### 1. Prepare for Build

#### Update Version
```json
// package.json
{
  "version": "1.0.0",
  "description": "WhatsApp Order Processing System"
}
```

#### Environment Configuration
```bash
# Create production .env
cat > .env << EOF
BACKEND_URL=https://your-backend-domain.com/api/
WHATSAPP_SESSION_PATH=./whatsapp-session
NODE_ENV=production
EOF
```

#### Clean Build Environment
```bash
# Remove development artifacts
rm -rf node_modules/
rm -rf dist/
rm -rf whatsapp-session/

# Fresh install
npm install
```

### 2. Build Application

#### Development Build (Testing)
```bash
npm run build
```

#### Production Build
```bash
# Build for Windows from macOS
npm run dist

# Specific Windows build
npm run electron:build -- --win
```

#### Build Output
```
dist/
├── place-order Setup 1.0.0.exe    # Windows installer
├── place-order-1.0.0.exe          # Portable executable
└── win-unpacked/                   # Unpacked application files
```

### 3. Build Configuration

#### electron-builder Configuration
```json
{
  "build": {
    "appId": "com.familyfarms.place-order",
    "productName": "Place Order",
    "directories": {
      "output": "dist"
    },
    "files": [
      "main.js",
      "preload.js",
      "renderer/",
      "reader/",
      "shared/",
      "config/",
      "node_modules/",
      "package.json"
    ],
    "win": {
      "target": "nsis",
      "icon": "assets/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "allowToChangeInstallationDirectory": true,
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "Place Order"
    }
  }
}
```

## 🚀 Deployment Steps

### 1. Backend Preparation

#### API Endpoints Verification
Ensure these endpoints are accessible:
```bash
# Test API connectivity (Updated URLs)
curl https://your-backend.com/api/auth/customers/
curl https://your-backend.com/api/products/products/  # Updated: Correct ViewSet URL
curl https://your-backend.com/api/orders/create-from-whatsapp/
curl https://your-backend.com/api/procurement/purchase-orders/create/
curl https://your-backend.com/api/suppliers/suppliers/  # Updated: Correct ViewSet URL
```

#### Database Migrations (Critical)
Ensure all migrations are applied before deployment:
```bash
# Apply all pending migrations
python manage.py makemigrations
python manage.py migrate

# Verify critical tables exist
python manage.py shell -c "
from suppliers.models import Supplier, SalesRep
from procurement.models import PurchaseOrder
print('✅ All models accessible')
"
```

#### Test Data Setup (Required)
Create initial suppliers for procurement functionality:
```bash
python manage.py shell -c "
from suppliers.models import Supplier, SalesRep

# Create default supplier if none exist
if not Supplier.objects.exists():
    supplier = Supplier.objects.create(
        name='Default Supplier',
        contact_person='Contact Person',
        email='contact@supplier.com',
        phone='+27123456789',
        is_active=True
    )
    SalesRep.objects.create(
        supplier=supplier,
        name='Sales Representative',
        email='sales@supplier.com',
        position='Sales Manager',
        is_active=True,
        is_primary=True
    )
    print('✅ Created default supplier and sales rep')
else:
    print('✅ Suppliers already exist')
"
```

#### CORS Configuration
```python
# Django settings.py
CORS_ALLOWED_ORIGINS = [
    "http://localhost:3000",  # Development
    "https://your-frontend.com",  # Production
]

# Allow Electron app
CORS_ALLOW_ALL_ORIGINS = True  # For development only
```

#### SSL Certificate
```bash
# Ensure HTTPS is configured
# Electron requires secure connections for production
```

### 2. Windows Installation

#### Method 1: Installer (Recommended)
1. **Copy Installer**: Transfer `place-order Setup 1.0.0.exe` to Windows machine
2. **Run as Administrator**: Right-click → "Run as administrator"
3. **Follow Wizard**: Choose installation directory and options
4. **Desktop Shortcut**: Installer creates desktop and start menu shortcuts

#### Method 2: Portable Executable
1. **Copy Files**: Transfer entire `win-unpacked/` folder
2. **Create Shortcut**: Create desktop shortcut to `place-order.exe`
3. **Set Permissions**: Ensure user has read/write access to folder

#### Method 3: Network Deployment
```batch
REM Batch script for automated deployment
@echo off
echo Installing Place Order Application...

REM Copy installer to local temp
copy "\\network-share\place-order Setup 1.0.0.exe" "%TEMP%\"

REM Run installer silently
"%TEMP%\place-order Setup 1.0.0.exe" /S

REM Cleanup
del "%TEMP%\place-order Setup 1.0.0.exe"

echo Installation complete!
pause
```

### 3. Configuration

#### Environment Configuration
Create `%APPDATA%\place-order\.env`:
```env
BACKEND_URL=https://your-production-backend.com/api/
WHATSAPP_SESSION_PATH=%APPDATA%\place-order\whatsapp-session
```

#### Registry Settings (Optional)
```reg
Windows Registry Editor Version 5.00

[HKEY_CURRENT_USER\Software\Place Order]
"BackendURL"="https://your-backend.com/api/"
"AutoStart"=dword:00000001
```

## 🔧 Configuration Management

### 1. Environment Variables

#### Development
```env
BACKEND_URL=http://localhost:8000/api/
DEBUG=true
AUTO_UPDATE=false
```

#### Staging
```env
BACKEND_URL=https://staging-api.familyfarms.com/api/
DEBUG=false
AUTO_UPDATE=true
```

#### Production
```env
BACKEND_URL=https://api.familyfarms.com/api/
DEBUG=false
AUTO_UPDATE=true
SENTRY_DSN=https://your-sentry-dsn
```

### 2. Configuration File
```json
// config/app-config.json
{
  "api": {
    "baseUrl": "https://api.familyfarms.com/api/",
    "timeout": 30000,
    "retries": 3
  },
  "whatsapp": {
    "sessionPath": "./whatsapp-session",
    "headless": false,
    "timeout": 60000
  },
  "ui": {
    "theme": "light",
    "language": "en",
    "autoSave": true
  }
}
```

## 🔐 Security Considerations

### 1. Code Signing (Recommended)
```bash
# Sign the executable (requires certificate)
electron-builder --win --publish=never --sign
```

### 2. Application Security
```javascript
// main.js security settings
const mainWindow = new BrowserWindow({
  webPreferences: {
    nodeIntegration: false,
    contextIsolation: true,
    enableRemoteModule: false,
    webSecurity: true
  }
});
```

### 3. Network Security
- Use HTTPS for all API communications
- Implement proper CORS policies
- Use secure WebSocket connections if applicable
- Validate all SSL certificates

## 📊 Monitoring & Logging

### 1. Application Logs
```javascript
// Log configuration
const log = require('electron-log');

log.transports.file.level = 'info';
log.transports.file.maxSize = 5 * 1024 * 1024; // 5MB
log.transports.file.file = path.join(app.getPath('userData'), 'logs/app.log');
```

### 2. Error Reporting
```javascript
// Sentry integration
const Sentry = require('@sentry/electron');

Sentry.init({
  dsn: process.env.SENTRY_DSN,
  environment: process.env.NODE_ENV
});
```

### 3. Performance Monitoring
```javascript
// Performance metrics
const { performance } = require('perf_hooks');

function trackPerformance(operation, fn) {
  const start = performance.now();
  const result = fn();
  const end = performance.now();
  
  log.info(`${operation} took ${end - start} milliseconds`);
  return result;
}
```

## 🔄 Update Management

### 1. Auto-Update Configuration
```json
{
  "build": {
    "publish": {
      "provider": "github",
      "owner": "familyfarms",
      "repo": "place-order",
      "private": true
    }
  }
}
```

### 2. Update Process
```javascript
// Auto-updater setup
const { autoUpdater } = require('electron-updater');

autoUpdater.checkForUpdatesAndNotify();

autoUpdater.on('update-available', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Available',
    message: 'A new version is available. It will be downloaded in the background.',
    buttons: ['OK']
  });
});
```

### 3. Manual Update Process
1. **Build New Version**: Increment version in package.json
2. **Test Thoroughly**: Verify all functionality
3. **Create Installer**: Build Windows installer
4. **Distribute**: Send to users or deploy via network
5. **Verify Installation**: Confirm successful deployment

## 🧪 Testing & Validation

### 1. Pre-Deployment Testing
```bash
# Test checklist
- [ ] Application starts successfully
- [ ] WhatsApp Web integration works
- [ ] API connectivity verified
- [ ] All UI components function
- [ ] Order processing workflow complete
- [ ] Error handling works properly
```

### 2. Post-Deployment Validation
```bash
# Validation checklist
- [ ] Installation completed without errors
- [ ] Desktop shortcut created
- [ ] Application launches from shortcut
- [ ] Backend connectivity established
- [ ] WhatsApp login successful
- [ ] Sample order processed successfully
```

### 3. User Acceptance Testing
```markdown
## UAT Checklist
- [ ] Non-technical user can install application
- [ ] User can log into WhatsApp successfully
- [ ] User can process a complete order
- [ ] Error messages are clear and helpful
- [ ] Performance is acceptable
- [ ] Application is stable during extended use
```

## 🆘 Troubleshooting

### Common Deployment Issues

#### Installation Fails
```bash
# Check Windows version compatibility
# Ensure user has administrator privileges
# Verify antivirus isn't blocking installation
# Check available disk space
```

#### Application Won't Start
```bash
# Check Windows Event Viewer for errors
# Verify Chrome is installed
# Check .NET Framework version
# Ensure Visual C++ Redistributables are installed
```

#### Backend Connectivity Issues
```bash
# Test API endpoints manually
# Check firewall settings
# Verify SSL certificates
# Test network connectivity
```

#### WhatsApp Integration Problems
```bash
# Ensure Chrome is updated
# Check Chrome permissions
# Clear Chrome cache and cookies
# Verify WhatsApp Web compatibility
```

### Log Analysis
```bash
# Application logs location
%APPDATA%\place-order\logs\

# Chrome logs
%LOCALAPPDATA%\Google\Chrome\User Data\Default\

# Windows Event Logs
Event Viewer → Windows Logs → Application
```

## 📞 Support & Maintenance

### 1. Support Documentation
- **User Guide**: Non-technical user instructions
- **Technical Documentation**: Developer reference
- **FAQ**: Common questions and solutions
- **Video Tutorials**: Step-by-step walkthroughs

### 2. Maintenance Schedule
- **Weekly**: Check application logs for errors
- **Monthly**: Verify API connectivity and performance
- **Quarterly**: Update dependencies and security patches
- **Annually**: Review and update deployment procedures

### 3. Escalation Process
1. **Level 1**: User documentation and self-help
2. **Level 2**: Local IT support
3. **Level 3**: Development team
4. **Level 4**: Backend/infrastructure team

---

**Deployment Team**: IT Operations  
**Last Updated**: 2024  
**Version**: 1.0.0
