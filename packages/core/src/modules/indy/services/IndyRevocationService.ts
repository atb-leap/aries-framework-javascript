import type { Logger } from '../../../logger'
import type { FileSystem } from '../../../storage/FileSystem'
import type { RequestedCredentials } from '../../proofs'
import type { default as Indy, } from 'indy-sdk'

import { scoped, Lifecycle } from 'tsyringe'

import { AgentConfig } from '../../../agent/AgentConfig'
import { IndySdkError } from '../../../error/IndySdkError'
import { isIndyError } from '../../../utils/indyError'
import { IndyWallet } from '../../../wallet/IndyWallet'
import { IndyLedgerService } from '../../ledger'

import { IndyUtilitiesService } from './IndyUtilitiesService'
import { AriesFrameworkError } from '@aries-framework/core'

@scoped(Lifecycle.ContainerScoped)
export class IndyRevocationService {
  private indy: typeof Indy
  private indyUtilitiesService: IndyUtilitiesService
  private fileSystem: FileSystem
  private ledgerService: IndyLedgerService
  private logger: Logger
  private wallet: IndyWallet

  public constructor(
    agentConfig: AgentConfig,
    indyUtilitiesService: IndyUtilitiesService,
    ledgerService: IndyLedgerService,
    wallet: IndyWallet
  ) {
    this.fileSystem = agentConfig.fileSystem
    this.indy = agentConfig.agentDependencies.indy
    this.indyUtilitiesService = indyUtilitiesService
    this.logger = agentConfig.logger
    this.ledgerService = ledgerService
    this.wallet = wallet
  }

  public async createRevocationState(
    proofRequest: Indy.IndyProofRequest,
    requestedCredentials: RequestedCredentials
  ): Promise<Indy.RevStates> {
    try {
      this.logger.debug(`Creating Revocation State(s) for proof request`, {
        proofRequest,
        requestedCredentials
      })
      const revocationStates: Indy.RevStates = {}

      // Create array of attribute referent credentials
      const attributeReferentCredentials = [
        ...Object.values(requestedCredentials.requestedAttributes),
      ]
      .filter((credential) => credential.credentialInfo)
      .map((credential) => credential.credentialInfo)

      // Create array of predicate referent credentials
      const predicateReferentCredentials = [
        ...Object.values(requestedCredentials.requestedPredicates),
      ]
      .filter((credential) => credential.credentialInfo)
      .map((credential) => credential.credentialInfo)

      //Attribute Referents
      for(const referentCredential of attributeReferentCredentials) {
        // Prefer referent-specific revocation interval over global revocation interval
        const requestRevocationInterval = /*proofRequest.requested_attributes[referentCredential?.referent!].non_revoked ??*/ proofRequest.non_revoked
        const credentialRevocationId = referentCredential?.credentialRevocationId
        const revocationRegistryId = referentCredential?.revocationRegistryId
        
        // If revocation interval is present and the credential is revocable
        if(requestRevocationInterval && credentialRevocationId && revocationRegistryId){
          this.logger.trace(`Presentation is requesting proof of non revocation for attribute referent '${referentCredential?.referent!}', creating revocation state for credential`, {
            requestRevocationInterval,
            credentialRevocationId,
            revocationRegistryId
          })

          const {timestamp, revocationState} = await this.createReferentRevocationState(requestRevocationInterval, credentialRevocationId, revocationRegistryId)
          if(!revocationStates[revocationRegistryId]){
            revocationStates[revocationRegistryId] = {}
          }
          revocationStates[revocationRegistryId][timestamp] = revocationState
        }
      }


      // Predicate Referents
      for(const referentCredential of predicateReferentCredentials) {
        // Prefer referent-specific revocation interval over global revocation interval
        const requestRevocationInterval = proofRequest.requested_predicates[referentCredential?.referent!].non_revoked ?? proofRequest.non_revoked
        const credentialRevocationId = referentCredential?.credentialRevocationId
        const revocationRegistryId = referentCredential?.revocationRegistryId
        
        // If revocation interval is present and the credential is revocable
        if(requestRevocationInterval && credentialRevocationId && revocationRegistryId){
          this.logger.trace(`Presentation is requesting proof of non revocation for predicate referent '${referentCredential?.referent!}', creating revocation state for credential`, {
            requestRevocationInterval,
            credentialRevocationId,
            revocationRegistryId
          })
          
          const {timestamp, revocationState} = await this.createReferentRevocationState(requestRevocationInterval, credentialRevocationId, revocationRegistryId)
          if(!revocationStates[revocationRegistryId]){
            revocationStates[revocationRegistryId] = {}
          }
          revocationStates[revocationRegistryId][timestamp] = revocationState
        }
      }

      this.logger.debug(`Created Revocation States for Proof Request`, {
        revocationStates
      })

      return revocationStates
    } catch (error) {
      this.logger.error(`Error creating Indy Revocation State for Proof Request`, {
        error,
        proofRequest,
        requestedCredentials,
      })

      throw isIndyError(error) ? new IndySdkError(error) : error
    }
  }

  // Create Revocation State for a referent credential
  // TODO: Remove ts-ignore upon DefinitelyTyped types updated
  // @ts-ignore 
  private async createReferentRevocationState(requestRevocationInterval: Indy.NonRevokedInterval, credentialRevocationId: string, revocationRegistryId: string): Promise<{timestamp: number, revocationState: Indy.RevState}>{
    // TODO: Add Test
    // Check revocation interval in accordance with https://github.com/hyperledger/aries-rfcs/blob/main/concepts/0441-present-proof-best-practices/README.md#semantics-of-non-revocation-interval-endpoints
    if(requestRevocationInterval.from && requestRevocationInterval.to !== requestRevocationInterval.from){
      throw new AriesFrameworkError(`Presentation requests proof of non-revocation with an interval from: '${requestRevocationInterval.from}' that does not match the interval to: '${requestRevocationInterval.to}', as specified in Aries RFC 0441`)
    }

    const revocationRegistryDefinition = await this.ledgerService.getRevocationRegistryDefinition(revocationRegistryId)

    const { revocRegDelta, deltaTimestamp } = await this.ledgerService.getRevocationRegistryDelta(
      revocationRegistryId,
      requestRevocationInterval?.to,
      0
    )

    const { tailsLocation, tailsHash } = revocationRegistryDefinition.value
    const tails = await this.indyUtilitiesService.downloadTails(tailsHash, tailsLocation)

    // TODO: Remove ts-ignore upon DefinitelyTyped types updated
    // @ts-ignore 
    const revocationState = await this.indy.createRevocationState(
      tails,
      JSON.stringify(revocationRegistryDefinition),
      JSON.stringify(revocRegDelta),
      deltaTimestamp,
      credentialRevocationId.toString()
    )

    return {
      timestamp: revocationState.timestamp,
      revocationState
    }
  }

  // Get revocation status for credential (given a from-to) 
  // Note from-to interval details: https://github.com/hyperledger/indy-hipe/blob/master/text/0011-cred-revocation/README.md#indy-node-revocation-registry-intervals
  public async getRevocationStatus(credentialRevocationId: string, revocationRegistryDefinitionId: string, to: number, from: number = 0): Promise<{revoked: boolean, deltaTimestamp: number}> {
    this.logger.trace(`Fetching Credential Revocation Status for Credential Revocation Id '${credentialRevocationId}' with revocation interval from '${from}', to '${to}'`)
    const { revocRegDelta, deltaTimestamp } = await this.ledgerService.getRevocationRegistryDelta(
      revocationRegistryDefinitionId,
      to,
      from
    )
    
    const revoked = revocRegDelta.value.revoked && revocRegDelta.value.revoked.includes(parseInt(credentialRevocationId))
    this.logger.trace(`Credental with Credential Revocation Id '${credentialRevocationId}' is ${revoked ? '' : 'not '}revoked with revocation interval from '${from}', to '${to}'`)
    
    return {
      revoked,
      deltaTimestamp
    }
  }
}
