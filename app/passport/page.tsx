"use client";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function PassportPage() {
    const canvasRef = useRef<HTMLCanvasElement>(null);
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
  
    const drawPassport = async () => {
      const canvas = canvasRef.current;
      if (!canvas || !fontLoaded) return;
  
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
  
      // Load all images asynchronously
      const loadImage = (src: string) => new Promise<HTMLImageElement>((resolve) => {
        const img = new Image();
        img.src = src;
        img.onload = () => resolve(img);
      });
  
      try {
        const [bgImg, maskImg, nftImage] = await Promise.all([
          loadImage("/passport/passport.png"),
          loadImage("/passport/photomask2.png"),
          imageToPlaceSrc ? loadImage(imageToPlaceSrc) : null,
        ]);
    
        ctx.clearRect(0, 0, WIDTH, HEIGHT);
        
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
        ctx.fillText(`${fields.date}`, 900, 1620);
      } catch (error) {
        console.error('Error loading images:', error);
      }
    };
  
    useEffect(() => {
      const idMatch = fields.ronkeId.match(/(\d+)/);
      if (idMatch) {
        const id = idMatch[1];
        import(`@/data/${id}.json`)
          .then((nftData) => {
            setImageToPlaceSrc(nftData.image);
          })
          .catch(console.error);
      }
    }, [fields.ronkeId]);
  
    useEffect(() => {
      if (fontLoaded) {
        drawPassport();
      }
    }, [fields, fontLoaded, imageToPlaceSrc]); // Added imageToPlaceSrc as dependency
  
    const handleDownload = async () => {
      const canvas = canvasRef.current;
      if (!canvas) return;
  
      const link = document.createElement("a");
      link.download = `ronke-passport-${fields.owner}.png`;
      link.href = canvas.toDataURL("image/png");
      link.click();
    };

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