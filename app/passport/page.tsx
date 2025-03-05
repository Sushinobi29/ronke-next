"use client";
import { useEffect, useRef, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";

export default function PassportPage() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [fontLoaded, setFontLoaded] = useState(false);
  const [fields, setFields] = useState({
    name: "",
    rank: "",
    score: "",
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
      
      // Draw name
      ctx.font = "bold 98px UglyHandwriting"; // Using custom font
      ctx.fillText(fields.name, 300, 200);
      
      // Draw rank
      ctx.font = "56px UglyHandwriting"; // Using custom font
      ctx.fillText(`Rank: #${fields.rank}`, 300, 300);
      
      // Draw rarity score
      ctx.fillText(`Rarity Score: ${fields.score}`, 300, 350);
      
      // Draw date
      ctx.font = "56px UglyHandwriting"; // Using custom font
      ctx.fillText(`Generated: ${fields.date}`, 300, 400);
    };
  };

  // Update canvas when fields change or font loads
  useEffect(() => {
    if (fontLoaded) {
      drawPassport();
    }
  }, [fields, fontLoaded]);

  const handleDownload = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Create download link
    const link = document.createElement("a");
    link.download = `ronke-passport-${fields.name}.png`;
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
          <Label htmlFor="name">NFT Name</Label>
          <Input
            id="name"
            value={fields.name}
            onChange={(e) => setFields({ ...fields, name: e.target.value })}
            placeholder="Enter NFT name"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="rank">Rank</Label>
          <Input
            id="rank"
            value={fields.rank}
            onChange={(e) => setFields({ ...fields, rank: e.target.value })}
            placeholder="Enter rank"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="score">Rarity Score</Label>
          <Input
            id="score"
            value={fields.score}
            onChange={(e) => setFields({ ...fields, score: e.target.value })}
            placeholder="Enter rarity score"
          />
        </div>

        <Button 
          className="w-full" 
          onClick={handleDownload}
          disabled={!fields.name || !fields.rank || !fields.score}
        >
          Download Passport
        </Button>
      </div>
    </div>
  );
}