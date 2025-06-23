
"use client";

import Image from 'next/image';

export default function LoadingScreen() {
  return (
    <div className="h-dvh w-full flex flex-col items-center justify-center bg-background text-primary">
      <Image 
        src="/logo.png" 
        alt="EchoFlow Logo" 
        width={64} 
        height={64} 
        className="animate-pulse"
        priority 
      />
      <p className="mt-4 text-lg text-foreground/80">Cargando EchoFlow...</p>
    </div>
  );
}
