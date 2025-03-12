import React, { useState, useEffect } from 'react';
import { Camera, Image, Wifi, QrCode, ArrowRight, RefreshCw } from 'lucide-react';
import { createWorker } from 'tesseract.js';
import QRCode from 'qrcode';
import './App.css';

interface WifiCredentials {
  ssid: string;
  password: string;
}

const App: React.FC = () => {
  const [image, setImage] = useState<string | null>(null);
  const [scanning, setScanning] = useState<boolean>(false);
  const [credentials, setCredentials] = useState<WifiCredentials | null>(null);
  const [qrCodeUrl, setQrCodeUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleCapture = (e: React.ChangeEvent<HTMLInputElement>) => {
    setError(null);
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = () => {
        setImage(reader.result as string);
        processImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const processImage = async (imageData: string) => {
    setScanning(true);
    try {
      const worker = await createWorker();
      await worker.load();
      await worker.loadLanguage('eng');
      await worker.initialize('eng');
      
      const { data } = await worker.recognize(imageData);
      await worker.terminate();
      
      // Extract WiFi credentials using regex patterns
      const ssidMatch = data.text.match(/SSID[:\s]+([^\n]+)/i) || 
                        data.text.match(/Network[:\s]+([^\n]+)/i) ||
                        data.text.match(/WiFi[:\s]+([^\n]+)/i);
      
      const passwordMatch = data.text.match(/Password[:\s]+([^\n]+)/i) || 
                           data.text.match(/Pass[:\s]+([^\n]+)/i) ||
                           data.text.match(/Key[:\s]+([^\n]+)/i);
      
      if (ssidMatch && passwordMatch) {
        const ssid = ssidMatch[1].trim();
        const password = passwordMatch[1].trim();
        
        setCredentials({ ssid, password });
        generateQRCode(ssid, password);
      } else {
        setError("Couldn't detect WiFi credentials. Please try another image.");
      }
    } catch (err) {
      setError("Error processing image. Please try again.");
      console.error(err);
    } finally {
      setScanning(false);
    }
  };

  const generateQRCode = async (ssid: string, password: string) => {
    try {
      const wifiString = `WIFI:S:${ssid};T:WPA;P:${password};;`;
      const qrCodeDataUrl = await QRCode.toDataURL(wifiString);
      setQrCodeUrl(qrCodeDataUrl);
    } catch (err) {
      console.error("Error generating QR code:", err);
    }
  };

  const joinWifi = () => {
    if (credentials) {
      // On iOS, we can try to join WiFi using a special URL scheme
      // This may not work on all iOS versions due to security restrictions
      const wifiUrl = `wifi:ssid=${encodeURIComponent(credentials.ssid)};password=${encodeURIComponent(credentials.password)};;`;
      window.location.href = wifiUrl;
    }
  };

  const resetApp = () => {
    setImage(null);
    setCredentials(null);
    setQrCodeUrl(null);
    setError(null);
  };

  // Register service worker for PWA
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch(error => {
          console.error('Service worker registration failed:', error);
        });
      });
    }
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 flex flex-col items-center justify-center p-4">
      <div className="w-full max-w-md bg-white bg-opacity-90 backdrop-blur-sm rounded-2xl shadow-xl overflow-hidden">
        <div className="p-6">
          <div className="flex items-center justify-center mb-6">
            <Wifi className="text-indigo-500 mr-2" size={24} />
            <h1 className="text-2xl font-bold text-gray-800">WiFi Scanner</h1>
          </div>

          {!image ? (
            <div className="space-y-4">
              <p className="text-gray-600 text-center">
                Capture or upload an image of WiFi credentials to scan
              </p>
              
              <div className="grid grid-cols-2 gap-4 mt-6">
                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-indigo-300 rounded-xl hover:bg-indigo-50 transition cursor-pointer">
                  <Camera className="text-indigo-500 mb-2" size={28} />
                  <span className="text-sm text-indigo-600 font-medium">Take Photo</span>
                  <input 
                    type="file" 
                    accept="image/*" 
                    capture="environment"
                    onChange={handleCapture} 
                    className="hidden" 
                  />
                </label>
                
                <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-indigo-300 rounded-xl hover:bg-indigo-50 transition cursor-pointer">
                  <Image className="text-indigo-500 mb-2" size={28} />
                  <span className="text-sm text-indigo-600 font-medium">Upload Image</span>
                  <input 
                    type="file" 
                    accept="image/*"
                    onChange={handleCapture} 
                    className="hidden" 
                  />
                </label>
              </div>
            </div>
          ) : (
            <div className="space-y-6">
              {scanning ? (
                <div className="flex flex-col items-center justify-center py-8">
                  <RefreshCw className="text-indigo-500 animate-spin mb-4" size={32} />
                  <p className="text-gray-600">Scanning image for WiFi credentials...</p>
                </div>
              ) : error ? (
                <div className="text-center py-4">
                  <p className="text-red-500 mb-4">{error}</p>
                  <button 
                    onClick={resetApp}
                    className="px-4 py-2 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition"
                  >
                    Try Again
                  </button>
                </div>
              ) : credentials ? (
                <div className="space-y-6">
                  <div className="bg-gray-100 p-4 rounded-lg">
                    <div className="mb-3">
                      <p className="text-sm text-gray-500">Network Name (SSID)</p>
                      <p className="text-lg font-medium text-gray-800">{credentials.ssid}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-500">Password</p>
                      <p className="text-lg font-medium text-gray-800">{credentials.password}</p>
                    </div>
                  </div>
                  
                  {qrCodeUrl && (
                    <div className="flex justify-center">
                      <img src={qrCodeUrl} alt="WiFi QR Code" className="w-48 h-48" />
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-4">
                    <button 
                      onClick={joinWifi}
                      className="flex items-center justify-center px-4 py-3 bg-indigo-500 text-white rounded-lg hover:bg-indigo-600 transition"
                    >
                      <Wifi className="mr-2" size={18} />
                      Join WiFi
                    </button>
                    
                    <a 
                      href={qrCodeUrl || '#'}
                      download="wifi-qrcode.png"
                      className="flex items-center justify-center px-4 py-3 bg-white border border-indigo-500 text-indigo-500 rounded-lg hover:bg-indigo-50 transition"
                    >
                      <QrCode className="mr-2" size={18} />
                      Save QR Code
                    </a>
                  </div>
                  
                  <button 
                    onClick={resetApp}
                    className="w-full flex items-center justify-center px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition"
                  >
                    <ArrowRight className="mr-2" size={18} />
                    Scan Another
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>
      </div>
      
      <p className="text-white text-opacity-80 text-sm mt-6">
        Add to Home Screen for full PWA experience
      </p>
    </div>
  );
};

export default App;
