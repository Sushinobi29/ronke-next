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

  // Canvas dimensions
  const WIDTH = 2048;
  const HEIGHT = 2048;

  // Load custom font
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

    // Load and draw background image
    const img = new Image();
    img.src = "/passport/passport.png"; // Updated image path
    
    img.onload = () => {
      // Clear canvas
      ctx.clearRect(0, 0, WIDTH, HEIGHT);
      
      // Draw background image
      ctx.drawImage(img, 0, 0, WIDTH, HEIGHT);
      
      // Configure text style
      ctx.fillStyle = "#00b1ff"; // Set text color to cyan
      ctx.textAlign = "left";
      
      // Draw owner
      ctx.font = "56px UglyHandwriting"; // Using custom font
      ctx.fillText(`${fields.owner}`, 900, 1270);
      
      // Draw givenName
      ctx.font = "56px UglyHandwriting"; // Using custom font
      ctx.fillText(`${fields.givenName}`, 900, 1390);
      
      // Draw rarity ronkeId
      ctx.fillText(`${fields.ronkeId}`, 1340, 1270);
      
      // Draw date
      ctx.font = "56px UglyHandwriting"; // Using custom font
      ctx.fillText(`${fields.date}`, 900, 1620);
    };
  };

  // Update canvas when fields change or font loads
  useEffect(() => {
    if (fontLoaded) {
      drawPassport();
    }
  }, [fields, fontLoaded, drawPassport]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create download link
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