'use client';

import { useState, useEffect, useCallback } from 'react';
import { Landmark, Loader2, Sparkles, AlertCircle } from 'lucide-react';

interface ConnectBankButtonProps {
  userId?: string;
  onSuccess?: () => void;
  className?: string;
  variant?: 'primary' | 'secondary' | 'outline';
}

declare global {
  interface Window {
    MonoConnect?: any;
  }
}

export default function ConnectBankButton({
  userId = 'default-user-id',
  onSuccess,
  className = '',
  variant = 'primary',
}: ConnectBankButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [isScriptLoaded, setIsScriptLoaded] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // 1. Dynamically inject Mono Connect JS SDK script
  useEffect(() => {
    if (window.MonoConnect) {
      setIsScriptLoaded(true);
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://connect.withmono.co/connect.js';
    script.async = true;
    script.onload = () => {
      setIsScriptLoaded(true);
    };
    script.onerror = () => {
      setErrorMessage('Failed to load Mono Connect SDK script.');
    };
    document.body.appendChild(script);

    return () => {
      // Cleanup script tag on unmount if needed
    };
  }, []);

  // 2. Token Exchange Handler
  const handleAuthCodeExchange = useCallback(
    async (code: string) => {
      setIsLoading(true);
      setErrorMessage(null);

      try {
        const response = await fetch('/api/bank/exchange-token', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code, userId }),
        });

        const data = await response.json();

        if (!response.ok) {
          throw new Error(data.error || 'Failed to exchange bank authorization token.');
        }

        if (onSuccess) {
          onSuccess();
        }
      } catch (err: any) {
        console.error('Error connecting bank account:', err);
        setErrorMessage(err.message || 'An unexpected error occurred during bank connection.');
      } finally {
        setIsLoading(false);
      }
    },
    [userId, onSuccess]
  );

  // 3. Launch Mono Connect Modal
  const launchMonoConnect = useCallback(() => {
    const publicKey = process.env.NEXT_PUBLIC_MONO_PUBLIC_KEY || 'test_pk_dummy_mono_public_key';

    if (!window.MonoConnect) {
      setErrorMessage('Mono Connect widget is still initializing. Please try again.');
      return;
    }

    try {
      const monoInstance = new window.MonoConnect({
        key: publicKey,
        onSuccess: (data: { code: string }) => {
          console.log('Mono Connect authorization code received:', data.code);
          handleAuthCodeExchange(data.code);
        },
        onClose: () => {
          console.log('Mono Connect widget closed by user.');
        },
        onEvent: (eventName: string, data: any) => {
          console.log(`Mono Event [${eventName}]:`, data);
        },
        reference: `tx_ref_${Date.now()}`,
      });

      monoInstance.setup();
      monoInstance.open();
    } catch (err: any) {
      console.error('Error launching MonoConnect:', err);
      setErrorMessage('Could not launch bank connect widget.');
    }
  }, [handleAuthCodeExchange]);

  const getVariantStyles = () => {
    switch (variant) {
      case 'secondary':
        return 'bg-emerald-800 hover:bg-emerald-900 text-white border border-emerald-700';
      case 'outline':
        return 'bg-white hover:bg-emerald-50 text-[#013220] border border-[#013220]/30 shadow-xs';
      default:
        return 'bg-[#013220] hover:bg-[#013220]/90 text-white shadow-md hover:shadow-lg';
    }
  };

  return (
    <div className="inline-flex flex-col items-start gap-1.5">
      <button
        type="button"
        onClick={launchMonoConnect}
        disabled={isLoading || !isScriptLoaded}
        className={`px-4 py-2.5 rounded-xl font-bold text-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${getVariantStyles()} ${className}`}
      >
        {isLoading ? (
          <>
            <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            <span>Connecting Bank Account...</span>
          </>
        ) : (
          <>
            <Landmark className="w-4 h-4 text-[#4ADE80]" />
            <span>Connect Bank Account</span>
            <Sparkles className="w-3.5 h-3.5 text-[#4ADE80] ml-0.5 opacity-80" />
          </>
        )}
      </button>

      {errorMessage && (
        <div className="flex items-center gap-1.5 text-[11px] text-red-600 font-medium bg-red-50 px-2.5 py-1 rounded-lg border border-red-200">
          <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
    </div>
  );
}
