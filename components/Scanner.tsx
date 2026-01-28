import React, { useEffect, useRef, useState } from 'react';
import { Html5Qrcode, Html5QrcodeSupportedFormats } from 'html5-qrcode';
import { Camera, XCircle } from 'lucide-react';

interface ScannerProps {
  onScan: (code: string) => void;
  onClose: () => void;
}

const Scanner: React.FC<ScannerProps> = ({ onScan, onClose }) => {
  const [error, setError] = useState<string | null>(null);
  const scannerRef = useRef<Html5Qrcode | null>(null);
  const mountedRef = useRef(false);

  useEffect(() => {
    mountedRef.current = true;
    const regionId = "html5qr-code-full-region";

    const startScanner = async () => {
      try {
        const scanner = new Html5Qrcode(regionId);
        scannerRef.current = scanner;

        const config = { 
            fps: 10, 
            qrbox: { width: 250, height: 250 },
            formatsToSupport: [ Html5QrcodeSupportedFormats.QR_CODE, Html5QrcodeSupportedFormats.CODE_128, Html5QrcodeSupportedFormats.EAN_13 ] 
        };

        await scanner.start(
          { facingMode: "environment" },
          config,
          (decodedText) => {
            if(mountedRef.current) {
                onScan(decodedText);
            }
          },
          (errorMessage) => {
            // Ignore frame parse errors
          }
        );
      } catch (err) {
        if(mountedRef.current) {
            setError("Não foi possível acessar a câmera. Verifique as permissões.");
            console.error(err);
        }
      }
    };

    // Small delay to ensure DOM is ready
    const timer = setTimeout(startScanner, 100);

    return () => {
        mountedRef.current = false;
        clearTimeout(timer);
        if (scannerRef.current && scannerRef.current.isScanning) {
            scannerRef.current.stop().then(() => {
                scannerRef.current?.clear();
            }).catch(console.error);
        }
    };
  }, [onScan]);

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col">
      <div className="flex justify-between items-center p-4 text-white bg-black/50 z-10">
        <h2 className="text-lg font-bold">Escanear Código</h2>
        <button onClick={onClose} className="p-2 rounded-full hover:bg-white/20">
            <XCircle size={28} />
        </button>
      </div>

      <div className="flex-1 relative bg-black flex items-center justify-center">
        {error ? (
           <div className="text-white text-center p-6">
                <Camera size={48} className="mx-auto mb-4 opacity-50" />
                <p>{error}</p>
           </div> 
        ) : (
            <div id="html5qr-code-full-region" className="w-full h-full"></div>
        )}
      </div>
      
      <div className="p-6 bg-black/80 text-white text-center text-sm">
        Aponte a câmera para o código de barras ou QR Code.
      </div>
    </div>
  );
};

export default Scanner;