'use client';

import React from 'react';
import {
  TurfWarMultiplayer as TurfWarMultiplayerRebuild,
  TurfWarMultiplayerProps,
} from '../TurfWarMultiplayer';

export function TurfWarMultiplayer(props: TurfWarMultiplayerProps) {
  return <TurfWarMultiplayerRebuild {...props} />;
}

export default TurfWarMultiplayer;
export type { TurfWarMultiplayerProps };
