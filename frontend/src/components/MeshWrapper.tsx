import { MeshProvider, CardanoWallet } from "@meshsdk/react";
import { useEffect, useState } from "react";

export const MeshWrapper = ({ children }: { children: React.ReactNode }) => {
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // libsodium-wrappers is often initialized by Mesh, but we can ensure 
    // the component doesn't interact with Mesh until the client is fully settled.
    setIsReady(true);
  }, []);

  if (!isReady) {
    return (
      <div className="min-h-screen bg-sky-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <MeshProvider>
      <div className="fixed top-4 right-4 z-50">
        <CardanoWallet />
      </div>
      {children}
    </MeshProvider>
  );
};


