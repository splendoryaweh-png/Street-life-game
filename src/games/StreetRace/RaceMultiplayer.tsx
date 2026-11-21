'use client';

import React from 'react';
import { StreetRaceMultiplayer } from '../StreetRaceMultiplayer';

export type StreetRaceMultiplayerProps = React.ComponentProps<typeof StreetRaceMultiplayer>;

export function RaceMultiplayer(props: StreetRaceMultiplayerProps) {
  return <StreetRaceMultiplayer {...props} />;
}

export default RaceMultiplayer;
