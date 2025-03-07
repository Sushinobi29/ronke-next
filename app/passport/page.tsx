"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

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

        // const randomX = Math.floor(Math.random() * 91); // Randomize X position by -20 to 20
        // const randomY = Math.floor(Math.random() * 91); // Randomize Y position by -20 to 20
        // const rotation = (Math.random() * 45 - 10) * (Math.PI / 180); // Random rotation between -15 and 15 degrees
        // ctx.save(); // Save the current state
        // ctx.translate(randomX + 500 + 388.5, randomY + 150 + 388.5); // Move to the center of the stamp
        // ctx.rotate(rotation); // Rotate the context
        // ctx.drawImage(stamp, -388.5, -388.5, 777, 777); // Draw the image centered at the new position
        // ctx.restore(); // Restore the original state

      } catch (error) {
        console.error('Error loading images:', error);
      }
    }, [fontLoaded, imageToPlaceSrc, fields]); // Added dependencies
  
    useEffect(() => {
      const idMatch = fields.ronkeId.match(/(\d+)/);
      if (idMatch) {
        const id = idMatch[1];
        import(`@/data/${id}.json`)
          .then((nftData) => {
            const img = new Image();
            img.crossOrigin = "anonymous"; // Add this line
            img.src = nftData.image;
            img.onload = () => setImageToPlaceSrc(nftData.image);
          })
          .catch(console.error);
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
    
        // 2. Draw signature if it exists
        // if (signatureCanvas) {
        //   tempCtx.drawImage(signatureCanvas, 1400, 1500);
        // }
    
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
    
      // Add these initialization properties
      ctx.strokeStyle = "#00b1ff"; // Set stroke color
      ctx.lineWidth = 2; // Set line width
      ctx.lineCap = "round";
      ctx.lineJoin = "round";
      
      const getScaledCoordinates = (e: MouseEvent | TouchEvent) => {
        const rect = signatureCanvas.getBoundingClientRect();
        const scaleX = signatureCanvas.width / rect.width;
        const scaleY = signatureCanvas.height / rect.height;
        
        const clientX = e instanceof TouchEvent ? e.touches[0].clientX : e.clientX;
        const clientY = e instanceof TouchEvent ? e.touches[0].clientY : e.clientY;

        return {
          x: (clientX - rect.left) * scaleX,
          y: (clientY - rect.top) * scaleY
        };
      };

      const startDrawing = (e: MouseEvent | TouchEvent) => {
        const { x, y } = getScaledCoordinates(e);
        ctx.beginPath();
        ctx.moveTo(x, y);
        setIsDrawing(true);
      };

      const draw = (e: MouseEvent | TouchEvent) => {
        if (!isDrawing) return;
        const { x, y } = getScaledCoordinates(e);
        
        ctx.lineTo(x, y);
        ctx.stroke();
      };

      const stopDrawing = () => {
        ctx.closePath();
        setIsDrawing(false);
        drawSignatureOnMainCanvas()
      };

      signatureCanvas.addEventListener("mousedown", startDrawing);
      signatureCanvas.addEventListener("mousemove", draw);
      signatureCanvas.addEventListener("mouseup", stopDrawing);
      signatureCanvas.addEventListener("mouseout", stopDrawing);
      signatureCanvas.addEventListener("touchstart", startDrawing);
      signatureCanvas.addEventListener("touchmove", draw);
      signatureCanvas.addEventListener("touchend", stopDrawing);

      return () => {
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
    <div className="flex flex-col md:flex-row gap-8 p-8">
      {/* Canvas Preview */}
      <div className="flex-1">
        <canvas
          ref={canvasRef}
          width={WIDTH}
          height={HEIGHT}
          className="w-full h-auto border border-zinc-200 dark:border-zinc-800 rounded-lg"
        />
      </div>

      {/* Controls */}
      <div className="w-full md:w-80 space-y-4">
        <div className="space-y-2">
          <Label htmlFor="owner">NFT owner</Label>
          <Input
            id="owner"
            value={fields.owner}
            onChange={(e) => setFields({ ...fields, owner: e.target.value })}
            placeholder="Enter NFT owner"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="givenName">givenName</Label>
          <Input
            id="givenName"
            value={fields.givenName}
            onChange={(e) => setFields({ ...fields, givenName: e.target.value })}
            placeholder="Enter givenName"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="ronkeId">Rarity ronkeId</Label>
          <Input
            id="ronkeId"
            value={fields.ronkeId}
            onChange={(e) => setFields({ ...fields, ronkeId: e.target.value })}
            placeholder="Enter rarity ronkeId"
          />
        </div>

        {/* Signature Canvas */}
        <div className="space-y-2">
          <Label htmlFor="signature">Signature</Label>
          <canvas
            ref={signatureCanvasRef}
            width={SIGNATURE_WIDTH}
            height={SIGNATURE_HEIGHT}
            className="w-full h-auto border border-zinc-200 dark:border-zinc-800 rounded-lg"
          />
          <Button className="w-full" onClick={clearSignature}>
            Clear Signature
          </Button>
        </div>

        <Button 
          className="w-full" 
          onClick={handleDownload}
          disabled={!fields.owner || !fields.givenName || !fields.ronkeId}
        >
          Download Passport
        </Button>
      </div>
    </div>
  );
}