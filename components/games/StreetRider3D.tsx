'use client';

import React from 'react';
import { StreetRider } from '@/src/games/StreetRider';

export interface StreetRider3DProps {
  onBack: () => void;
  onToast: (msg: string) => void;
  currentCoins: number;
}

export function StreetRider3D({ onBack, onToast, currentCoins }: StreetRider3DProps) {
  return (
    <StreetRider
      onBack={onBack}
      onToast={onToast}
      currentCoins={currentCoins}
      isOpen={true}
    />
  );
}

export default StreetRider3D;
