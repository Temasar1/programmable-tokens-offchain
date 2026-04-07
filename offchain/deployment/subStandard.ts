import {
  byteString,
  conStr,
  conStr1,
  integer,
  PlutusScript,
  TxInput,
} from "@meshsdk/common";
import { applyParamsToScript, resolveScriptHash } from "@meshsdk/core";
import { scriptHashToRewardAddress } from "@meshsdk/core-cst";
import { serializePlutusScript } from "@meshsdk/core";

import { cborEncode, findValidator } from "../utils";

export class SubStandardScripts {
  constructor(private readonly networkID: number) {}

  private buildRaw(validatorName: string) {
    const _cbor = cborEncode(findValidator(validatorName, false));
    const plutusScript: PlutusScript = { code: _cbor, version: "V3" };
    const policyId = resolveScriptHash(_cbor, "V3");
    const rewardAddress = scriptHashToRewardAddress(policyId, this.networkID);
    return { _cbor, plutusScript, policyId, rewardAddress };
  }

  private buildWithParams(validatorName: string, params: object[]) {
    const _cbor = findValidator(validatorName, false);
    const cbor = applyParamsToScript(_cbor, params, "JSON");
    const plutusScript: PlutusScript = { code: cbor, version: "V3" };
    const policyId = resolveScriptHash(cbor, "V3");
    const rewardAddress = scriptHashToRewardAddress(policyId, this.networkID);
    return { cbor, plutusScript, policyId, rewardAddress };
  }

  private txRef(utxo: TxInput) {
    return conStr(0, [byteString(utxo.txHash), integer(utxo.outputIndex)]);
  }

  async issue() {
    return this.buildRaw("transfer.issue.withdraw");
  }

  async transfer() {
    return this.buildRaw("transfer.transfer.withdraw");
  }

  async blacklistSpend(blacklistNodePolicyId: string) {
    const { cbor, plutusScript, policyId } = this.buildWithParams(
      "blacklist_spend.blacklist_spend.spend",
      [byteString(blacklistNodePolicyId)],
    );
    const address = serializePlutusScript(
      plutusScript,
      "",
      this.networkID,
      false,
    ).address;
    return { cbor, plutusScript, address, policyId };
  }

  async blacklistMint(bootstraptxInput: TxInput, adminPubkeyHash: string) {
    return this.buildWithParams("blacklist_mint.blacklist_mint.mint", [
      this.txRef(bootstraptxInput),
      byteString(adminPubkeyHash),
    ]);
  }

  async issuerAdmin(adminPubKeyHash: string) {
    return this.buildWithParams(
      "example_transfer_logic.issuer_admin_contract.withdraw",
      [conStr(0, [byteString(adminPubKeyHash)])],
    );
  }

  async customTransfer(
    programmableLogicBaseScriptHash: string,
    blacklistNodePolicyId: string,
  ) {
    const { cbor, plutusScript, policyId, rewardAddress } =
      this.buildWithParams("example_transfer_logic.transfer.withdraw", [
        conStr1([byteString(programmableLogicBaseScriptHash)]),
        byteString(blacklistNodePolicyId),
      ]);
    return { cbor, plutusScript, policyId, rewardAddress };
  }
}
