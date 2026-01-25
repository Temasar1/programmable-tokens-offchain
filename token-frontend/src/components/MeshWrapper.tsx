"use client";

import { MeshProvider, CardanoWallet } from "@meshsdk/react";

export const MeshWrapper = ({ children }: { children: React.ReactNode }) => {
  return (
    <MeshProvider>
      <div className="fixed top-4 right-4 z-50">
        <CardanoWallet />
      </div>
      {children}
    </MeshProvider>
  );
};
