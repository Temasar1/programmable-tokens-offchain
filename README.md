so here are the validator specifications for any one trying to follow-up with the standards to know how they can build their substandards validators and offchains

validator specifications

- ISSUANCE CBOR-HEX
  The issuance cbor hex is a minting validator.

parameters

- always fail script hash
- UTXO reference

rules

    - one shot UTXO must be consumed
    - it's policy validates against minting a one-shot NFT minting
    - The output of the NFT must reside at the always fail scriptHash -> address to avoid it being spent
    - The token name must be `IssuanceCborHex`

why do we need this validator?

- ISSUANCE MINT
  The policy handles the minting and burning of the registered programmable token - `this is the programmable token itself`.

Parameters

    - programmable logic base script Hash
    - minting logic credential

rules

    - That the redeemer contains the minting logic credential
    - That the minted token is at the first output of transaction
    - validate a withdrawal script is invoked that must match match the minting logic credential script
    - The total amount minted must reside at the smart wallet composed of the programmable base script Hash as the payment credential side and any stake credential to identify the owner
    - make sure the script redeemer is invoked once in the transaction to prevent concurrent mints

why do we need this validator?

It helps to mint the so-called programmable tokens by invoking our minting logic using the withdraw zero trick and directing the minting value to the right address formation.

- PROGRAMMABLE LOGIC BASE
  parameters

      - programmable logic global stake credential

rules

    - checks the transaction if the programmable logic global is invoked in the transaction via the withdraw zero trick

why do we need this validator?

This validator payment credential is where the programmable token reside the second part the the stake credential which is what designates the owner of the tokens comprising of the smart wallet

- PROGRAMMABLE LOGIC GLOBAL

parameters
      
    - protocol parameter script hash

rules

    - we expect that protocol param minted token which is specified by it's policyId (scriptHash) is present in one of the reference inputs of the transaction
    - Then we also expect this reference input datum first and last field contains the registry mint policyId and the programmable logic base credential (script Hash) respectively.
    - 

why do we need this validator?

- PROTOCOL PARAM MINT

parameters

    - output reference
    - always fail script hash

rules 

    - policy validates for oneshot minting NFT parameterixed utxo must be consumed
    - The NFT quantity myst be exatly one token and correct name of `ProtocolParams` 
    - NFT output is expected to reside at the always fail script hash -> (address)
    - The nft output is expected to have a datum in the following format 
    `pub type ProgrammableLogicGlobalParams {  registry_node_cs: PolicyId,prog_logic_cred: Credential
    }` 
    The first field must be the registry node script Hash 
    The second field is the programmable logic base credential

why this validator?

- REGISTRY SPEND 

Parameters

   - Protocol param script Hash

rules

   - One of the reference input UTXO must contain the protocol param NFT token
   - This reference Input inline datum must match the programmable logic base param with two fiels of:
      - registry node(mint) policyId
      - programmable logic base script hash
    - Ensure that this first datum field which is the registry node (policyId) NFT is minted in the transaction
