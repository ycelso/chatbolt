
"use client";

import ChatInterface from '@/components/chat/chat-interface';
import LoadingScreen from '@/components/common/loading-screen';
import { useState, useEffect } from 'react';

export default function Home() {
  const [isAppSpecificLoading, setIsAppSpecificLoading] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsAppSpecificLoading(false);
    }, 1000); 
    return () => clearTimeout(timer);
  }, []);
  
  if (isAppSpecificLoading) {
     return <LoadingScreen />;
  }

  return <ChatInterface />;
}
