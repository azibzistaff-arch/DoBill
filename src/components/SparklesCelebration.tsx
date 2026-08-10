import React, { useMemo, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';

const PASTEL_COLORS = [
  '#FFB7B2', // Soft Peach Pink
  '#FFDAC1', // Creamy Apricot
  '#E2F0CB', // Pale Mint Yellow
  '#B5EAD7', // Pastel Sage Green
  '#C7CEEA', // Lavender Blue
  '#FFC6FF', // Bubblegum Pink
  '#BDB2FF', // Lilac Purple
  '#CAFFBF', // Light Lime
  '#9BF6FF', // Soft Sky Cyan
  '#A0C4FF', // Soft Periwinkle
];

interface SparklesCelebrationProps {
  duration?: number; // Total duration in ms before auto-destroy. Default is 5000ms.
  onComplete?: () => void;
  active?: boolean;
}

export function SparklesCelebration({ duration = 5000, onComplete, active = true }: SparklesCelebrationProps) {
  useEffect(() => {
    if (!active) return;
    const timer = setTimeout(() => {
      if (onComplete) {
        onComplete();
      }
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onComplete, active]);

  const particles = useMemo(() => {
    return Array.from({ length: 70 }).map((_, i) => {
      const isLeft = i % 2 === 0;
      const color = PASTEL_COLORS[i % PASTEL_COLORS.length];
      const delay = Math.random() * 1.5; // Staggered entry
      const pDuration = 2.0 + Math.random() * 1.8; // Floating gravity
      const size = 6 + Math.random() * 12; // 6px to 18px size
      
      // Particle shape styles: 0 = Square/Rectangle, 1 = Circle, 2 = Sparkle/Star Symbol, 3 = Ribbon
      const shapeType = i % 4;

      // Start positions at sides, slightly above bottom
      const startX = isLeft ? "-5vw" : "105vw";
      const startY = `${80 + Math.random() * 10}vh`;

      // Parabolic arc peaks in the upper middle
      const peakX = isLeft 
        ? `${15 + Math.random() * 30}vw` 
        : `${85 - Math.random() * 30}vw`;
      const peakY = `${15 + Math.random() * 30}vh`;

      // Falling down endpoints
      const endX = isLeft 
        ? `${25 + Math.random() * 40}vw` 
        : `${75 - Math.random() * 40}vw`;
      const endY = "115vh";

      // 3D rotations for fluttering feel
      const rotateStart = Math.random() * 90;
      const rotateEnd = 360 + Math.random() * 720;
      const rotateYStart = Math.random() * 180;
      const rotateYEnd = 360 + Math.random() * 360;

      return {
        id: i,
        isLeft,
        startX,
        startY,
        peakX,
        peakY,
        endX,
        endY,
        color,
        delay,
        duration: pDuration,
        size,
        shapeType,
        rotateStart,
        rotateEnd,
        rotateYStart,
        rotateYEnd,
      };
    });
  }, []);

  if (!active) return null;

  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-50 bg-transparent select-none">
      <AnimatePresence>
        {particles.map((p) => (
          <motion.div
            key={p.id}
            initial={{ 
              x: p.startX, 
              y: p.startY, 
              scale: 0, 
              rotate: p.rotateStart,
              rotateY: p.rotateYStart,
              opacity: 1 
            }}
            animate={{ 
              x: [p.startX, p.peakX, p.endX],
              y: [p.startY, p.peakY, p.endY],
              scale: [0, 1.4, 1.1, 0.9, 0.4],
              rotate: [p.rotateStart, p.rotateEnd / 2, p.rotateEnd],
              rotateY: [p.rotateYStart, p.rotateYEnd],
              opacity: [0, 1, 1, 0.9, 0]
            }}
            transition={{
              duration: p.duration,
              delay: p.delay,
              repeat: Infinity,
              repeatDelay: 0.5,
              ease: "easeOut"
            }}
            className="absolute"
            style={{
              width: p.size,
              height: p.shapeType === 3 ? p.size * 2 : p.size,
              backgroundColor: p.shapeType === 2 ? undefined : p.color,
              borderRadius: p.shapeType === 1 ? '50%' : p.shapeType === 0 ? '4px' : p.shapeType === 3 ? '2px' : undefined,
              boxShadow: p.shapeType === 2 ? 'none' : '0 2px 6px rgba(0,0,0,0.15)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {p.shapeType === 2 && (
              <span style={{ fontSize: p.size + 4, color: p.color, textShadow: '0 0 8px rgba(255,255,255,0.6)' }}>
                ✨
              </span>
            )}
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}
