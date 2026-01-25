import "@/styles/globals.css";
import "@meshsdk/react/styles.css";
import type { AppProps } from "next/app";
import dynamic from "next/dynamic";

const MeshWrapper = dynamic(
  () => import("@/components/MeshWrapper").then((mod) => ({ default: mod.MeshWrapper })),
  { 
    ssr: false,
    loading: () => <div>{/* Loading state - Mesh will mount on client */}</div>
  }
);

export default function App({ Component, pageProps }: AppProps) {
  return (
    <MeshWrapper>
      <Component {...pageProps} />
    </MeshWrapper>
  );
}
