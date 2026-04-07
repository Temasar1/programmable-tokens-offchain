import { MintProtocolParams } from "../transactions/type-1/protocolParamMint";

async function testBootstrap() {
  console.log("Starting Protocol Bootstrap Test...");
  try {
    // 0 = Preview, 1 = Mainnet
    const bootstrapParams = await MintProtocolParams(0);
    
    if (bootstrapParams) {
      console.log("Bootstrap Successful!");
      console.log(`Transaction Hash: ${bootstrapParams.txHash}`);
      console.log("Core Script Hashes:");
      console.log(`- Protocol Params Mint: ${bootstrapParams.protocolParams.scriptHash}`);
      console.log(`- Always Fail Anchor: ${bootstrapParams.protocolParams.alwaysFailScriptHash}`);
      console.log(`- Registry Mint: ${bootstrapParams.directoryMintParams.scriptHash}`);
      console.log(`- Registry Spend: ${bootstrapParams.directorySpendParams.scriptHash}`);
      console.log(`- Issuance Template: ${bootstrapParams.issuanceParams.scriptHash}`);
      
      console.log("\nReference Inputs:");
      console.log(`- Base Logic: ${bootstrapParams.programmableBaseRefInput.txHash}#${bootstrapParams.programmableBaseRefInput.outputIndex}`);
      console.log(`- Global Logic: ${bootstrapParams.programmableGlobalRefInput.txHash}#${bootstrapParams.programmableGlobalRefInput.outputIndex}`);
    } else {
      console.error("Bootstrap failed: no parameters returned.");
    }
  } catch (error) {
    console.error("Bootstrap failed with error:");
    console.error(error);
  }
}

// Run test if this script is executed directly
if (require.main === module) {
  testBootstrap();
}
