import { provider, wallet } from "./config";
import params from "./offchain/protocol.json";
import { ProgrammableTokenContract } from "./offchain/transactions/type-2/offchain";

const contract = new ProgrammableTokenContract({
  wallet: wallet,
  provider: provider,
  params: params,
  networkId: 0,
});

//const txhash = await contract.transferToken("8428ae12aba2b64dc79b1c09d49b753852fe5bb544d1f4104eeb0c6c6369702d3131332d74657374","10","addr_test1qq7uufq87mnxnlpssz63xpj4k0hze92shw27s2enmmdfquvcdyyfvue3t9sqyyg4ys887qkdznwj6d96tn672agd62as3gch4t");
//const txhash = await contract.burnToken("8428ae12aba2b64dc79b1c09d49b753852fe5bb544d1f4104eeb0c6c","temasar","50");
const txhash = await contract.mintTokens("temasar_100", "1000");
console.log(txhash);