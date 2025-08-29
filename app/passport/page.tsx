"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import PageNavbar from "@/components/page-navbar";

declare global {
  interface GlobalEventHandlersEventMap {
    touchstart: TouchEvent;
    touchend: TouchEvent;
    touchmove: TouchEvent;
  }
}

export default function PassportPage() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const signatureCanvasRef = useRef<HTMLCanvasElement>(null);
    const [fontLoaded, setFontLoaded] = useState(false);
    const [fields, setFields] = useState({
      owner: "owner name",
      givenName: "given name",
      ronkeId: "#6969",
      date: new Date().toLocaleDateString(),
    });
    const [imageToPlaceSrc, setImageToPlaceSrc] = useState("");
  
    const WIDTH = 2048;
    const HEIGHT = 2048;
    const SIGNATURE_WIDTH = 400;
    const SIGNATURE_HEIGHT = 200;

    useEffect(() => {
      const loadFont = async () => {
        const font = new FontFace(
          'UglyHandwriting',
          `url('/fonts/uglyhandwriting.ttf')`
        );
        
        try {
          await font.load();
          document.fonts.add(font);
          setFontLoaded(true);
        } catch (error) {
          console.error('Error loading font:', error);
        }
      };
  
      loadFont();
    }, []);
  
    const drawPassport = useCallback(async () => {
      const canvas = canvasRef.current;
      if (!canvas || !fontLoaded) return;
  
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
  
      // Load all images asynchronously
      const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous"; // Add this line
        img.src = src;
        img.onload = () => resolve(img);
        img.onerror = (err) => reject(err);
      });
  
      try {
        const [bgImg, maskImg, nftImage] = await Promise.all([
          loadImage("/passport/passport.png"),
          loadImage("/passport/photomask2.png"),
          imageToPlaceSrc ? loadImage(imageToPlaceSrc) : null,
        ]);
    
        ctx.clearRect(0, 0, WIDTH, HEIGHT);

        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, WIDTH, HEIGHT);
        
        // 1. Draw background first
        ctx.drawImage(bgImg, 0, 0, WIDTH, HEIGHT);
    
        if (nftImage) {
          // Create a temporary canvas for masking
          const tempCanvas = document.createElement('canvas');
          tempCanvas.width = WIDTH;
          tempCanvas.height = HEIGHT;
          const tempCtx = tempCanvas.getContext('2d');
          
          if (!tempCtx) return;
    
          // Draw NFT image on temp canvas
          tempCtx.drawImage(nftImage, 380, 1230, 480, 480);
          
          // Apply mask to temp canvas
          tempCtx.globalCompositeOperation = "destination-in";
          tempCtx.drawImage(maskImg, 0, 0, WIDTH, HEIGHT);
          
          // Draw masked image onto main canvas
          ctx.drawImage(tempCanvas, 0, 0);
        }
  
        // Draw text on top of everything
        ctx.fillStyle = "#00b1ff";
        ctx.textAlign = "left";
        ctx.font = "56px UglyHandwriting";
        
        ctx.fillText(`${fields.owner}`, 900, 1270);
        ctx.fillText(`${fields.givenName}`, 900, 1390);
        ctx.fillText(`${fields.ronkeId}`, 1340, 1270);
        ctx.fillStyle = "black";
        ctx.fillText(`${fields.date.replaceAll("/", "-")}`, 900, 1620);

      } catch (error) {
        console.error('Error loading images:', error);
      }
    }, [fontLoaded, imageToPlaceSrc, fields]); // Added dependencies
  
    useEffect(() => {
      const idMatch = fields.ronkeId.match(/(\d+)/);
      if (idMatch) {
        const id = idMatch[1];
        const img = new Image();
        img.crossOrigin = "anonymous"; // Add this line
        img.src = `/images/${id}.png`;
        img.onload = () => setImageToPlaceSrc(`/images/${id}.png`);
      }
    }, [fields.ronkeId]);
  
    useEffect(() => {
      if (fontLoaded) {
        drawPassport();
      }
    }, [fields, fontLoaded, imageToPlaceSrc, drawPassport]); // Added imageToPlaceSrc as dependency
  
    const drawSignatureOnMainCanvas = () => {
      const mainCanvas = canvasRef.current; // Get the main canvas reference
      const signatureCanvas = signatureCanvasRef.current; // Get the signature canvas reference

      if (!mainCanvas || !signatureCanvas) return;

      const mainCtx = mainCanvas.getContext("2d");
      const signatureCtx = signatureCanvas.getContext("2d");

      if (!mainCtx || !signatureCtx) return;

      // Draw the signature canvas onto the main canvas at (1400, 1500)
      mainCtx.drawImage(signatureCanvas, 1300, 1550);
    };
  
    const handleDownload = async () => {
      try {
        const mainCanvas = canvasRef.current;
    
        if (!mainCanvas) return;
    
        // Create a temporary canvas to combine everything
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = WIDTH;
        tempCanvas.height = HEIGHT;
        const tempCtx = tempCanvas.getContext('2d');
        
        if (!tempCtx) return;
    
        // 1. Draw main canvas content
        tempCtx.drawImage(mainCanvas, 0, 0);
    
        // 3. Convert to data URL and download
        const link = document.createElement("a");
        link.download = `ronke-passport-${fields.owner}.png`;
        link.href = tempCanvas.toDataURL("image/png");
        link.click();
      } catch (error) {
        console.error('Download error:', error);
        alert('Please ensure all images are loaded from secure sources');
      }
    };

    const clearSignature = () => {
      const signatureCanvas = signatureCanvasRef.current;
      const mainCanvas = canvasRef.current; // Get the main canvas reference

      if (signatureCanvas) {
        const ctx = signatureCanvas.getContext("2d");
        if (ctx) {
          ctx.clearRect(0, 0, SIGNATURE_WIDTH, SIGNATURE_HEIGHT); // Clear the signature canvas
        }
      }

      if (mainCanvas) {
        const mainCtx = mainCanvas.getContext("2d");
        if (mainCtx) {
          mainCtx.clearRect(0, 0, WIDTH, HEIGHT); // Clear the main canvas
          drawPassport(); // Redraw the main canvas if necessary
        }
      }
    };

    // Signature drawing logic
    const [isDrawing, setIsDrawing] = useState(false);

    useEffect(() => {
      const signatureCanvas = signatureCanvasRef.current;
      if (!signatureCanvas) return;
    
      const ctx = signatureCanvas.getContext("2d");
      if (!ctx) return;
    
      // Set up drawing properties
      ctx.strokeStyle = "#00b1ff";
      ctx.lineWidth = 2;
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      const getScaledCoordinates = (e: MouseEvent | TouchEvent) => {
        const rect = signatureCanvas.getBoundingClientRect();
        const scaleX = signatureCanvas.width / rect.width;
        const scaleY = signatureCanvas.height / rect.height;
        
        // Handle both mouse and touch events
        const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX;
        const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY;

        return {
          x: (clientX - rect.left) * scaleX,
          y: (clientY - rect.top) * scaleY
        };
      };

      const startDrawing = (e: MouseEvent | TouchEvent) => {
        e.preventDefault(); // Prevent default touch behavior
        const { x, y } = getScaledCoordinates(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
      };

      const draw = (e: MouseEvent | TouchEvent) => {
        e.preventDefault(); // Prevent default touch behavior
        if (!isDrawing) return;
        const { x, y } = getScaledCoordinates(e);
        
        ctx.lineTo(x, y);
        ctx.stroke();
      };

      const stopDrawing = () => {
        setIsDrawing(false);
        drawSignatureOnMainCanvas()
      };

      // Add event listeners
      signatureCanvas.addEventListener("mousedown", startDrawing);
      signatureCanvas.addEventListener("mousemove", draw);
      signatureCanvas.addEventListener("mouseup", stopDrawing);
      signatureCanvas.addEventListener("mouseout", stopDrawing);
      signatureCanvas.addEventListener("touchstart", startDrawing, { passive: false });
      signatureCanvas.addEventListener("touchmove", draw, { passive: false });
      signatureCanvas.addEventListener("touchend", stopDrawing);

      return () => {
        // Cleanup event listeners
        signatureCanvas.removeEventListener("mousedown", startDrawing);
        signatureCanvas.removeEventListener("mousemove", draw);
        signatureCanvas.removeEventListener("mouseup", stopDrawing);
        signatureCanvas.removeEventListener("mouseout", stopDrawing);
        signatureCanvas.removeEventListener("touchstart", startDrawing);
        signatureCanvas.removeEventListener("touchmove", draw);
        signatureCanvas.removeEventListener("touchend", stopDrawing);
      };
    }, [isDrawing]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 dark:from-black dark:via-gray-900 dark:to-black">
      <PageNavbar />
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-12">
        
        {/* Header */}
        <div className="text-center mb-12">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 dark:text-gray-100 mb-4">
            RONKE <span className="text-purple-600">PASSPORT</span>
          </h1>
          <p className="text-xl text-gray-600 dark:text-gray-300 max-w-2xl mx-auto">
            Create your official Ronkeverse passport with your NFT and signature
          </p>
        </div>

        <div className="flex flex-col lg:flex-row gap-12">
          
          {/* Canvas Preview */}
          <div className="flex-1">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mb-6">Passport Preview</h2>
              <canvas
                ref={canvasRef}
                width={WIDTH}
                height={HEIGHT}
                className="w-full h-auto border-2 border-gray-200 dark:border-gray-600 rounded-xl"
              />
            </div>
          </div>

          {/* Controls */}
          <div className="w-full lg:w-96">
            <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 space-y-6">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Passport Details</h2>
              
              <div className="space-y-2">
                <Label htmlFor="owner">NFT Owner</Label>
                <Input
                  id="owner"
                  value={fields.owner}
                  onChange={(e) => setFields({ ...fields, owner: e.target.value })}
                  placeholder="Enter NFT owner"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="givenName">Given Name</Label>
                <Input
                  id="givenName"
                  value={fields.givenName}
                  onChange={(e) => setFields({ ...fields, givenName: e.target.value })}
                  placeholder="Enter given name"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="ronkeId">Ronke ID</Label>
                <Input
                  id="ronkeId"
                  value={fields.ronkeId}
                  onChange={(e) => setFields({ ...fields, ronkeId: e.target.value })}
                  placeholder="Enter Ronke ID (e.g., #6969)"
                />
              </div>

              {/* Signature Canvas */}
              <div className="space-y-2">
                <Label htmlFor="signature">Digital Signature</Label>
                <div className="border-2 border-dashed border-gray-300 dark:border-gray-600 rounded-xl p-4">
                  <canvas
                    ref={signatureCanvasRef}
                    width={SIGNATURE_WIDTH}
                    height={SIGNATURE_HEIGHT}
                    className="w-full h-auto border border-gray-200 dark:border-gray-600 rounded-lg bg-gray-50 dark:bg-gray-700"
                  />
                  <Button 
                    variant="outline" 
                    className="w-full mt-3" 
                    onClick={clearSignature}
                  >
                    Clear Signature
                  </Button>
                </div>
              </div>

              <Button 
                className="w-full bg-purple-600 hover:bg-purple-700 text-white py-3 text-lg" 
                onClick={handleDownload}
                disabled={!fields.owner || !fields.givenName || !fields.ronkeId}
              >
                🎫 Download Passport
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
