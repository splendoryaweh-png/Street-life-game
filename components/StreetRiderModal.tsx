'use client';

import React from 'react';
import { StreetRider } from '@/src/games/StreetRider';
import { BikeId } from '@/types/game';

interface StreetRiderModalProps {
  isOpen: boolean;
  onClose: () => void;
  streetCoin: number;
  ownedBikes?: BikeId[];
  selectedBike?: BikeId;
  missionNumber?: number;
  onToast: (msg: string) => void;
}

export function StreetRiderModal({
  isOpen,
  onClose,
  streetCoin,
  onToast,
}: StreetRiderModalProps) {
  if (!isOpen) return null;

  return (
    <StreetRider
      onBack={onClose}
      onClose={onClose}
      onToast={onToast}
      currentCoins={streetCoin}
      isOpen={isOpen}
    />
  );
}

export default StreetRiderModal;
