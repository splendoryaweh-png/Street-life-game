'use client';

import React from 'react';
import {
  StreetRaceMultiplayer,
  StreetRaceMultiplayerProps,
} from '../StreetRaceMultiplayer';

export function RaceMultiplayer(props: StreetRaceMultiplayerProps) {
  return <StreetRaceMultiplayer {...props} />;
}

export default RaceMultiplayer;
export type { StreetRaceMultiplayerProps };
