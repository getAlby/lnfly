"use client";

import { useEffect, useRef } from "react";

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  opacity: number;
  glowSize: number;
}

//const c1 = "59, 130, 246";
//const c2 = "147, 197, 253";
const c1 = "255, 223, 111";
const c2 = "255, 223, 111";

export function Constellation() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const particlesRef = useRef<Particle[]>([]);
  const animationRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const resizeCanvas = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };

    const createParticles = () => {
      const particles: Particle[] = [];
      const particleCount = Math.floor((canvas.width * canvas.height) / 20000);

      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.25,
          vy: (Math.random() - 0.5) * 0.25,
          size: Math.random() * 2 + 1,
          opacity: Math.random() * 0.8 + 0.2,
          glowSize: Math.random() * 10 + 5,
        });
      }

      particlesRef.current = particles;
    };

    const drawConnections = () => {
      const maxDistance = 120;
      const particles = particlesRef.current;

      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const dx = particles[i].x - particles[j].x;
          const dy = particles[i].y - particles[j].y;
          const distance = Math.sqrt(dx * dx + dy * dy);

          if (distance < maxDistance) {
            const opacity = (1 - distance / maxDistance) * 1;
            ctx.strokeStyle = `rgba(${c1}, ${opacity})`;
            ctx.lineWidth = 0.5;
            ctx.beginPath();
            ctx.moveTo(particles[i].x, particles[i].y);
            ctx.lineTo(particles[j].x, particles[j].y);
            ctx.stroke();
          }
        }
      }
    };

    const updateParticles = () => {
      particlesRef.current.forEach((particle) => {
        particle.x += particle.vx;
        particle.y += particle.vy;

        // Wrap around edges
        const wrapBuffer = particle.size * 2;
        if (particle.x + wrapBuffer < 0) particle.x = canvas.width + wrapBuffer;
        if (particle.x - wrapBuffer > canvas.width) particle.x = -wrapBuffer;
        if (particle.y + wrapBuffer < 0)
          particle.y = canvas.height + wrapBuffer;
        if (particle.y - wrapBuffer > canvas.height) particle.y = -wrapBuffer;

        // Subtle opacity animation
        particle.opacity += (Math.random() - 0.5) * 0.02;
        particle.opacity = Math.max(0.1, Math.min(1, particle.opacity));
      });
    };

    const drawParticles = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // Draw connections first (so they appear behind particles)
      drawConnections();

      particlesRef.current.forEach((particle) => {
        // Create glow effect
        const gradient = ctx.createRadialGradient(
          particle.x,
          particle.y,
          0,
          particle.x,
          particle.y,
          particle.glowSize
        );
        gradient.addColorStop(0, `rgba(${c1}, ${particle.opacity})`);
        gradient.addColorStop(0.5, `rgba(${c1}, ${particle.opacity * 0.3})`);
        gradient.addColorStop(1, `rgba(${c1}, 0)`);

        // Draw glow
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.glowSize, 0, Math.PI * 2);
        ctx.fill();

        // Draw core particle
        ctx.fillStyle = `rgba(${c2}, ${particle.opacity})`;
        ctx.beginPath();
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
        ctx.fill();
      });
    };

    const animate = () => {
      updateParticles();
      drawParticles();
      animationRef.current = requestAnimationFrame(animate);
    };

    const handleResize = () => {
      resizeCanvas();
      createParticles();
    };

    // Initialize
    resizeCanvas();
    createParticles();
    animate();

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, []);

  return (
    <div className="fixed inset-0 -z-10 opacity-50">
      <canvas ref={canvasRef} className="w-full h-full" />
    </div>
  );
}
