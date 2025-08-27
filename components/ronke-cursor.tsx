'use client';

import Image from "next/image";
import { useEffect, useState, useRef } from "react";

interface RonkeCursorProps {
  isActive: boolean;
  isExcited?: boolean;
}

export default function RonkeCursor({ isActive, isExcited = false }: RonkeCursorProps) {
  const [ronkePosition, setRonkePosition] = useState({ x: 0, y: 0 });
  const [isWaddling, setIsWaddling] = useState(false);
  const [direction, setDirection] = useState({ x: 1, y: 0 });
  const [showCursor, setShowCursor] = useState(false);
  const targetRef = useRef({ x: 0, y: 0 });
  const animationRef = useRef<number>();

  useEffect(() => {
    if (!isActive) return;

    // Show cursor after 3 seconds
    const showTimer = setTimeout(() => {
      setShowCursor(true);
    }, 3000);

    const handleMouseMove = (e: MouseEvent) => {
      // Update target immediately
      targetRef.current = {
        x: e.clientX - 40,
        y: e.clientY - 40
      };
    };

    // Animation loop
    const animate = () => {
      setRonkePosition(prev => {
        const target = targetRef.current;
        const distanceX = target.x - prev.x;
        const distanceY = target.y - prev.y;
        const distance = Math.sqrt(distanceX * distanceX + distanceY * distanceY);
        
        // Update direction for rotation/mirroring based on movement
        if (distance > 2) {
          setDirection({
            x: distanceX > 0 ? 1 : -1,
            y: distanceY
          });
          setIsWaddling(true);
        } else {
          setIsWaddling(false);
        }

        // Move towards target
        if (distance > 3) {
          return {
            x: prev.x + distanceX * 0.08,
            y: prev.y + distanceY * 0.08
          };
        }
        return prev;
      });
      
      animationRef.current = requestAnimationFrame(animate);
    };

    window.addEventListener('mousemove', handleMouseMove);
    animate();

    return () => {
      clearTimeout(showTimer);
      window.removeEventListener('mousemove', handleMouseMove);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isActive]);

  if (!isActive || !showCursor) return null;

  const rotationAngle = Math.atan2(direction.y, direction.x) * (180 / Math.PI);

  return (
    <div
      className="fixed pointer-events-none z-[9999] transition-transform duration-200 ease-out"
      style={{
        left: `${ronkePosition.x}px`,
        top: `${ronkePosition.y}px`,
        transform: `scale(0.8) ${direction.x < 0 ? 'scaleX(-1)' : 'scaleX(1)'} rotate(${rotationAngle * 0.15}deg)`,
      }}
    >
      <div 
        className={`transition-all duration-150 ${
          isExcited ? 'animate-bounce scale-125' : 
          isWaddling ? 'scale-110' : 'scale-100'
        }`}
      >
        <Image
          src="/ronkebase.png"
          alt="Ronke Cursor"
          width={80}
          height={80}
          className="drop-shadow-xl"
          draggable={false}
        />
      </div>
    </div>
  );
}