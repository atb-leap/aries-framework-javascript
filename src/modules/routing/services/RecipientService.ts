import type { Verkey } from 'indy-sdk'
import { createOutboundMessage } from '../../../agent/helpers'
import { AgentConfig } from '../../../agent/AgentConfig'
import { MessageSender } from '../../../agent/MessageSender'
import {
  KeylistUpdateMessage,
  KeylistUpdate,
  KeylistUpdateAction,
  ForwardMessage,
  MediationGrantMessage,
  MediationDenyMessage,
  RequestMediationMessage,
  KeylistUpdateResponseMessage,
} from '../messages'
import { Logger } from '../../../logger'
import { EventEmitter } from 'events'
import { Repository } from '../../../storage/Repository'
import { ConnectionInvitationMessage, ConnectionRecord } from '../../connections'
import { MediationEventType, MediationKeylistEvent, MediationStateChangedEvent } from './MediatorService'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { OutboundMessage } from '../../../types'
import { isIndyError } from '../../../utils/indyError'
import { MediationRecord, MediationRecordProps, MediationRole, MediationState, MediationStorageProps } from '..'
import { Wallet } from '../../../wallet/Wallet'

export enum MediationRecipientEventType {
  Granted = 'GRANTED',
  Denied = 'DENIED',
  KeylistUpdated = 'KEYLIST_UPDATED',
}

export class RecipientService extends EventEmitter {
  private agentConfig: AgentConfig
  private mediatorRepository: Repository<MediationRecord>
  private messageSender: MessageSender
  private defaultMediator?: MediationRecord
  private wallet: Wallet

  public constructor(
    agentConfig: AgentConfig,
    mediatorRepository: Repository<MediationRecord>,
    messageSender: MessageSender,
    wallet: Wallet
  ) {
    super()
    this.agentConfig = agentConfig
    this.mediatorRepository = mediatorRepository
    this.messageSender = messageSender
    this.wallet = wallet
    this.provision()
  }

  private provision() {
    /* TODO: handle config flag behaviors.
    autoAcceptMediationRequests
                "automatically granting to everyone asking, rather than enabling the feature altogether"
                "After establishing a connection, "
                "if enabled, an agent may request message mediation, which will "
                "allow the mediator to forward messages on behalf of the recipient. "
                "See aries-rfc:0211."
    mediatorInvitation
                "Connect to mediator through provided invitation "
                "and send mediation request and set as default mediator."
    //mediatorConnectionsInvite
                //--"Connect to mediator through a connection invitation. "
                //"If not specified, connect using an OOB invitation. "
                //"Default: false."--
    defaultMediatorId
                "Set the default mediator by ID"
    clearDefaultMediator
                "Clear the stored default mediator."
    */
    // check for default mediation id record
    // set this.defaultMediator
    // else if mediation invitation in config
    // Use agent config to establish connection with mediator
    // request mediation record
    // Upon granting, set this.defaultMediator
  }

  public async createRecord({
    state,
    role,
    connectionId,
    recipientKeys,
  }: MediationRecordProps): Promise<MediationRecord> {
    const mediationRecord = new MediationRecord({
      state,
      role,
      connectionId,
      recipientKeys,
      tags: {
        state,
        role,
        connectionId,
        default: 'false',
      },
    })
    await this.mediatorRepository.save(mediationRecord)
    return mediationRecord
  }

  public async createRequest(connection: ConnectionRecord) {
    await this.createRecord({
      connectionId: connection.id,
      role: MediationRole.Mediator,
      state: MediationState.Requested,
    })
    return new RequestMediationMessage({})
  }

  public createKeylistQuery(filter: Map<string, string>, paginateLimit = -1, paginateOffset = 0) {
    // Method here
  }

  public async createKeylistUpdateMessage(verkey?: Verkey): Promise<KeylistUpdateMessage> {
    if (!verkey) {
      let did
      ;[did, verkey] = await this.wallet.createDid()
    }
    const keylistUpdateMessage = new KeylistUpdateMessage({
      updates: [
        new KeylistUpdate({
          action: KeylistUpdateAction.add,
          recipientKey: verkey,
        }),
      ],
    })
    return keylistUpdateMessage
  }

  public async processKeylistUpdateResults(messageContext: InboundMessageContext<KeylistUpdateResponseMessage>) {
    if (!messageContext.connection) {
      throw new Error(`Connection for verkey ${messageContext.recipientVerkey} not found!`)
    }
    const mediationRecord = await this.findByConnectionId(messageContext.connection.id)
    if (!mediationRecord) {
      throw new Error(`mediation record for  ${messageContext.connection.id} not found!`)
    }
    const keylist = messageContext.message.updated
    // TODO: update keylist in mediationRecord...
    // for ...
    // await this.mediatorRepository.update(mediationRecord)
    const event: MediationKeylistEvent = {
      mediationRecord,
      keylist,
    }
    this.emit(MediationEventType.KeylistUpdate, event)
  }

  public async processMediationGrant(messageContext: InboundMessageContext<MediationGrantMessage>) {
    const connection = messageContext.connection

    // Assert connection
    connection?.assertReady()
    if (!connection) {
      throw new Error('No connection associated with incoming mediation grant message')
    }

    // Mediation record already exists
    const mediationRecord = await this.findByConnectionId(connection.id)

    if (!mediationRecord) {
      throw new Error(`No mediation has been requested for this connection id: ${connection.id}`)
    }

    // Assert
    mediationRecord.assertState(MediationState.Requested)
    mediationRecord.assertConnection(connection.id)

    // Update record
    mediationRecord.endpoint = messageContext.message.endpoint
    mediationRecord.routingKeys = messageContext.message.routingKeys
    await this.updateState(mediationRecord, MediationState.Granted)

    return mediationRecord
  }

  public async processMediationDeny(messageContext: InboundMessageContext<MediationDenyMessage>) {
    const connection = messageContext.connection
    // TODO: duplicate code from processMediationGrant, move into helper method
    // Assert connection
    connection?.assertReady()
    if (!connection) {
      throw new Error('No connection associated with incoming mediation deny message')
    }

    // Mediation record already exists
    const mediationRecord = await this.findByConnectionId(connection.id)

    if (!mediationRecord) {
      throw new Error(`No mediation has been requested for this connection id: ${connection.id}`)
    }

    // Assert
    mediationRecord.assertState(MediationState.Requested)
    mediationRecord.assertConnection(connection.id)

    // Update record
    await this.updateState(mediationRecord, MediationState.Denied)

    return mediationRecord
  }

  /**
   * Update the record to a new state and emit an state changed event. Also updates the record
   * in storage.
   *
   * @param MediationRecord The proof record to update the state for
   * @param newState The state to update to
   *
   */
  private async updateState(mediationRecord: MediationRecord, newState: MediationState) {
    const previousState = mediationRecord.state

    mediationRecord.state = newState

    await this.mediatorRepository.update(mediationRecord)

    const event: MediationStateChangedEvent = {
      mediationRecord,
      previousState: previousState,
    }

    this.emit(MediationEventType.StateChanged, event)
  }

  public async findById(mediatorId: string): Promise<MediationRecord> {
    const connection = await this.mediatorRepository.find(mediatorId)
    return connection
    // TODO - Handle errors
  }

  public async findByConnectionId(id: string): Promise<MediationRecord | null> {
    // TODO: Use findByQuery (connectionId as tag)
    const mediationRecords = await this.mediatorRepository.findAll()

    for (const record of mediationRecords) {
      if (record.connectionId == id) {
        return record
      }
    }
    return null
  }

  public async getMediators(): Promise<MediationRecord[] | null> {
    return await this.mediatorRepository.findAll()
  }

  public async getDefaultMediatorId(): Promise<string | undefined> {
    if (this.defaultMediator !== undefined) {
      return this.defaultMediator.id
    }
    const record = await this.getDefaultMediator()
    return record.id ?? undefined
  }

  public async getDefaultMediator() {
    const results = await this.mediatorRepository.findByQuery({ default: true })
    this.defaultMediator = results[0] ?? undefined // TODO: call setDefaultMediator
    return this.defaultMediator
  }

  public setDefaultMediator(mediator: MediationRecord) {
    // TODO: update default tag to be "true", set all other record default tags to "false"
    this.defaultMediator = mediator
  }

  public clearDefaultMediator() {
    // TODO: set all record default tags to "false"
    delete this.defaultMediator
  }
}

interface MediationRecipientProps {
  mediatorConnectionId: string
  mediatorPublicVerkey: Verkey
}
