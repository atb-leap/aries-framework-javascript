import type { Logger } from '../../../logger'
import type { RequestedCredentials } from '../../proofs'
import type * as Indy from 'indy-sdk'

import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { IndySdkError } from '../../../error'
import { isIndyError } from '../../../utils/indyError'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { IndyLedgerService } from '../../ledger'

import { IndyUtilitiesService } from './indyUtilitiesService'

@scoped(Lifecycle.ContainerScoped)
export class IndyHolderService {
  private indy: typeof Indy
  private logger: Logger
  private wallet: IndyWallet
  private ledgerService: IndyLedgerService
  private indyUtilitiesService: IndyUtilitiesService

  public constructor(agentConfig: AgentConfig, wallet: IndyWallet, ledgerService: IndyLedgerService, indyUtilitiesService: IndyUtilitiesService) {
    this.indy = agentConfig.agentDependencies.indy
    this.logger = agentConfig.logger
    this.ledgerService = ledgerService
    this.indyUtilitiesService = indyUtilitiesService
    this.wallet = wallet
  }

  /**
   * Creates an Indy Proof in response to a proof request. Will create revocation state if the proof request requests proof of non-revocation
   *
   * @param proofRequest a Indy proof request
   * @param requestedCredentials the requested credentials to use for the proof creation
   * @param schemas schemas to use in proof creation
   * @param credentialDefinitions credential definitions to use in proof creation
   * @throws {Error} if there is an error during proof generation or revocation state generation
   * @returns a promise of Indy Proof
   *
   * @todo support attribute non_revoked fields
   */
  public async createProof({
    proofRequest,
    requestedCredentials,
    schemas,
    credentialDefinitions,
  }: CreateProofOptions): Promise<Indy.IndyProof> {
    try {
      this.logger.debug('Creating Indy Proof')
      const revocationStates: Indy.RevStates = {}

      if (proofRequest.non_revoked) {
        this.logger.debug('Proof request includes a non-revocation, creating revocation state(s)')
        //Create array of credential info
        const credentialObjects = [
          ...Object.values(requestedCredentials.requestedAttributes),
          ...Object.values(requestedCredentials.requestedPredicates),
        ]
          .filter((c) => !!c.credentialInfo)
          .map((c) => c.credentialInfo)

        //Cache object to prevent redundancy
        const cachedRevDefinitions: {
          [revRegId: string]: Indy.RevocRegDef
        } = {}

        //Create revocation state of each revocable credential
        for (const requestedCredential of credentialObjects) {
          const revRegId = requestedCredential?.revocationRegistryId
          const credRevId = requestedCredential?.credentialRevocationId
          if (revRegId && credRevId) {
            let revocRegDef: Indy.RevocRegDef

            if (cachedRevDefinitions[revRegId]) {
              revocRegDef = cachedRevDefinitions[revRegId]
            } else {
              revocRegDef = await this.ledgerService.getRevocRegDef(revRegId)
              cachedRevDefinitions[revRegId] = revocRegDef
            }

            const { revocRegDelta, deltaTimestamp } = await this.ledgerService.getRevocRegDelta(
              revRegId,
              proofRequest.non_revoked?.from,
              proofRequest.non_revoked?.to
            )

            const { tailsLocation, tailsHash } = revocRegDef.value
            const tails = await this.indyUtilitiesService.downloadTails(tailsHash, tailsLocation)
            // @ts-ignore TODO: Remove upon DefinitelyTyped types updated
            const revocationState = await this.indy.createRevocationState(
              tails,
              JSON.stringify(revocRegDef),
              JSON.stringify(revocRegDelta),
              deltaTimestamp,
              credRevId.toString()
            )
            revocationStates[revRegId] = { [deltaTimestamp]: revocationState }
          }
        }
      }
      const indyProof: Indy.IndyProof = await this.indy.proverCreateProof(
        this.wallet.handle,
        proofRequest,
        requestedCredentials.toJSON(),
        this.wallet.masterSecretId,
        schemas,
        credentialDefinitions,
        revocationStates
      )
      this.logger.debug('Created Indy Proof')
      return indyProof
    } catch (error) {
      throw new IndySdkError(error)
    }
  }

  /**
   * Store a credential in the wallet.
   *
   * @returns The credential id
   */
  public async storeCredential({
    credentialRequestMetadata,
    credential,
    credentialDefinition,
    credentialId,
    revocationRegistryDefinitions,
  }: StoreCredentialOptions): Promise<Indy.CredentialId> {
    try {
      return await this.indy.proverStoreCredential(
        this.wallet.handle,
        credentialId ?? null,
        credentialRequestMetadata,
        credential,
        credentialDefinition,
        revocationRegistryDefinitions ?? null
      )
    } catch (error) {
      throw new IndySdkError(error)
    }
  }

  /**
   * Get a credential stored in the wallet by id.
   *
   * @param credentialId the id (referent) of the credential
   * @throws {Error} if the credential is not found
   * @returns the credential
   *
   * @todo handle record not found
   */
  public async getCredential(credentialId: Indy.CredentialId): Promise<Indy.IndyCredentialInfo> {
    try {
      return await this.indy.proverGetCredential(this.wallet.handle, credentialId)
    } catch (error) {
      throw new IndySdkError(error)
    }
  }

  /**
   * Create a credential request for the given credential offer.
   *
   * @returns The credential request and the credential request metadata
   */
  public async createCredentialRequest({
    holderDid,
    credentialOffer,
    credentialDefinition,
  }: CreateCredentialRequestOptions): Promise<[Indy.CredReq, Indy.CredReqMetadata]> {
    try {
      return await this.indy.proverCreateCredentialReq(
        this.wallet.handle,
        holderDid,
        credentialOffer,
        credentialDefinition,
        this.wallet.masterSecretId
      )
    } catch (error) {
      throw new IndySdkError(error)
    }
  }

  /**
   * Retrieve the credentials that are available for an attribute referent in the proof request.
   *
   * @param proofRequest The proof request to retrieve the credentials for
   * @param attributeReferent An attribute referent from the proof request to retrieve the credentials for
   * @param start Starting index
   * @param limit Maximum number of records to return
   *
   * @returns List of credentials that are available for building a proof for the given proof request
   *
   */
  public async getCredentialsForProofRequest({
    proofRequest,
    attributeReferent,
    start = 0,
    limit = 256,
    extraQuery,
  }: GetCredentialForProofRequestOptions): Promise<Indy.IndyCredential[]> {
    try {
      // Open indy credential search
      const searchHandle = await this.indy.proverSearchCredentialsForProofReq(
        this.wallet.handle,
        proofRequest,
        extraQuery ?? null
      )

      try {
        // Make sure database cursors start at 'start' (bit ugly, but no way around in indy)
        if (start > 0) {
          await this.fetchCredentialsForReferent(searchHandle, attributeReferent, start)
        }

        // Fetch the credentials
        const credentials = await this.fetchCredentialsForReferent(searchHandle, attributeReferent, limit)

        // TODO: sort the credentials (irrevocable first)
        return credentials
      } finally {
        // Always close search
        await this.indy.proverCloseCredentialsSearchForProofReq(searchHandle)
      }
    } catch (error) {
      if (isIndyError(error)) {
        throw new IndySdkError(error)
      }

      throw error
    }
  }

  private async fetchCredentialsForReferent(searchHandle: number, referent: string, limit?: number) {
    try {
      let credentials: Indy.IndyCredential[] = []

      // Allow max of 256 per fetch operation
      const chunk = limit ? Math.min(256, limit) : 256

      // Loop while limit not reached (or no limit specified)
      while (!limit || credentials.length < limit) {
        // Retrieve credentials
        const credentialsJson = await this.indy.proverFetchCredentialsForProofReq(searchHandle, referent, chunk)
        credentials = [...credentials, ...credentialsJson]

        // If the number of credentials returned is less than chunk
        // It means we reached the end of the iterator (no more credentials)
        if (credentialsJson.length < chunk) {
          return credentials
        }
      }

      return credentials
    } catch (error) {
      throw new IndySdkError(error)
    }
  }
}

export interface GetCredentialForProofRequestOptions {
  proofRequest: Indy.IndyProofRequest
  attributeReferent: string
  start?: number
  limit?: number
  extraQuery?: Indy.ReferentWalletQuery
}

export interface CreateCredentialRequestOptions {
  holderDid: string
  credentialOffer: Indy.CredOffer
  credentialDefinition: Indy.CredDef
}

export interface StoreCredentialOptions {
  credentialRequestMetadata: Indy.CredReqMetadata
  credential: Indy.Cred
  credentialDefinition: Indy.CredDef
  credentialId?: Indy.CredentialId
  revocationRegistryDefinitions?: Indy.RevRegsDefs
}

export interface CreateProofOptions {
  proofRequest: Indy.IndyProofRequest
  requestedCredentials: RequestedCredentials
  schemas: Indy.Schemas
  credentialDefinitions: Indy.CredentialDefs
}
