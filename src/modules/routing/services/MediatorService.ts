import { inject, Lifecycle, scoped } from 'tsyringe'
import { Verkey } from 'indy-sdk'

import { createRecord } from './RoutingService'
import { MediationRecord } from '../repository/MediationRecord'
import {
  KeylistUpdateMessage,
  KeylistUpdateAction,
  ForwardMessage,
  KeylistUpdateResult,
  KeylistUpdated,
  MediationGrantMessage,
  MediationRequestMessage,
  KeylistUpdateResponseMessage,
} from '../messages'
import { MediationRole } from '../models/MediationRole'
import { MediationState } from '../models/MediationState'
import { AgentConfig } from '../../../agent/AgentConfig'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { ConnectionRecord } from '../../connections'
import { BaseMessage } from '../../../agent/BaseMessage'
import { Wallet } from '../../../wallet/Wallet'
import { HandlerInboundMessage } from '../../../agent/Handler'
import { ForwardHandler } from '../handlers'
import { uuid } from '../../../utils/uuid'
import { ForwardEvent, MediationKeylistEvent, MediationStateChangedEvent, RoutingEventTypes } from '../RoutingEvents'
import { EventEmitter } from '../../../agent/EventEmitter'
import { AriesFrameworkError } from '../../../error'
import { Symbols } from '../../../symbols'
import { MediationRepository } from '../repository/MediationRepository'

export interface RoutingTable {
  [recipientKey: string]: ConnectionRecord | undefined
}

@scoped(Lifecycle.ContainerScoped)
export class MediatorService {
  private agentConfig: AgentConfig
  private mediationRepository: MediationRepository
  private wallet: Wallet
  private eventEmitter: EventEmitter
  private routingKeys: Verkey[]

  public constructor(
    mediationRepository: MediationRepository,
    agentConfig: AgentConfig,
    @inject(Symbols.Wallet) wallet: Wallet,
    eventEmitter: EventEmitter
  ) {
    this.mediationRepository = mediationRepository
    this.agentConfig = agentConfig
    this.wallet = wallet
    this.eventEmitter = eventEmitter
    this.routingKeys = []
  }

  private _assertConnection(connection: ConnectionRecord | undefined, msgType: BaseMessage): ConnectionRecord {
    if (!connection) throw new AriesFrameworkError(`inbound connection is required for ${msgType.constructor.name}!`)
    connection.assertReady()
    return connection
  }

  public async processForwardMessage(messageContext: HandlerInboundMessage<ForwardHandler>) {
    const { message, recipientVerkey } = messageContext

    // TODO: update to class-validator validation
    if (!message.to) {
      throw new Error('Invalid Message: Missing required attribute "to"')
    }

    const connectionId = await this.findRecipient(message.to)
    if (connectionId) {
      // Emit event to be handled by MediatorModule
      this.eventEmitter.emit<ForwardEvent>({
        type: RoutingEventTypes.Forward,
        payload: {
          connectionId,
          message,
        },
      })
    } else {
      throw new Error(`Connection for verkey ${recipientVerkey} not found!`)
    }
  }

  public async processKeylistUpdateRequest(messageContext: InboundMessageContext<KeylistUpdateMessage>) {
    const { message } = messageContext
    const connection = this._assertConnection(messageContext.connection, ForwardMessage)
    const updated = []
    const mediationRecord = await this.findRecipientByConnectionId(connection.id)
    if (!mediationRecord) {
      throw new Error(`mediation record for  ${connection.id} not found!`)
    }
    for (const update of message.updates) {
      const update_ = new KeylistUpdated({
        action: update.action,
        recipientKey: update.recipientKey,
        result: KeylistUpdateResult.NoChange,
      })
      if (update.action === KeylistUpdateAction.add) {
        update_.result = await this.saveRoute(update.recipientKey, mediationRecord)
        updated.push(update_)
      } else if (update.action === KeylistUpdateAction.remove) {
        update_.result = await this.removeRoute(update.recipientKey, mediationRecord)
        updated.push(update_)
      }
    }
    this.eventEmitter.emit<MediationKeylistEvent>({
      type: RoutingEventTypes.MediationKeylist,
      payload: {
        mediationRecord,
        keylist: updated,
      },
    })
  }

  public async saveRoute(recipientKey: Verkey, mediationRecord: MediationRecord | null): Promise<KeylistUpdateResult> {
    if (mediationRecord) {
      mediationRecord.recipientKeys.push(recipientKey)
      this.mediationRepository.update(mediationRecord)
      return KeylistUpdateResult.Success
    }
    return KeylistUpdateResult.ServerError
  }

  public async removeRoute(recipientKey: Verkey, mediationRecord: MediationRecord | null) {
    if (mediationRecord) {
      const index = mediationRecord.recipientKeys.indexOf(recipientKey, 0)
      if (index > -1) {
        mediationRecord.recipientKeys.splice(index, 1)
      }
      this.mediationRepository.update(mediationRecord)
      return KeylistUpdateResult.Success
    }
    return KeylistUpdateResult.ServerError
  }

  public async findRecipient(recipientKey: Verkey): Promise<string | null> {
    const records = await this.getAll()
    for (const record of records) {
      for (const key of record.recipientKeys) {
        if (recipientKey == key) {
          return record.connectionId
        }
      }
    }
    return null
  }

  public async findRecipientByConnectionId(connectionId: string): Promise<MediationRecord | null> {
    const records = await this.mediationRepository.findByQuery({ connectionId })
    return records[0]
  }

  public async createKeylistUpdateResponseMessage(keylist: KeylistUpdated[]): Promise<KeylistUpdateResponseMessage> {
    const keylistUpdateMessage = new KeylistUpdateResponseMessage({
      updated: keylist,
    })
    return keylistUpdateMessage
  }

  public async createGrantMediationMessage(mediation: MediationRecord): Promise<MediationGrantMessage> {
    if (this.routingKeys.length === 0) {
      const [did, verkey] = await this.wallet.createDid()
      this.routingKeys = [verkey]
    }
    mediation.state = MediationState.Granted
    await this.mediationRepository.update(mediation)
    return new MediationGrantMessage({
      id: uuid(), // HELP: should this be the thread id from the request?
      endpoint: this.agentConfig.getEndpoint(),
      routingKeys: this.routingKeys,
    })
  }

  public async processMediationRequest(messageContext: InboundMessageContext<MediationRequestMessage>) {
    // Assert connection
    const connection = this._assertConnection(messageContext.connection, ForwardMessage)

    const mediationRecord = await createRecord(
      {
        connectionId: connection.id,
        role: MediationRole.Mediator,
        state: MediationState.Init,
      },
      this.mediationRepository
    )
    await this.updateState(mediationRecord, MediationState.Init)

    // Mediation can be either granted or denied. If auto-accept is not enabled, let framework controller
    // logic decide that later on
    if (this.agentConfig.autoAcceptMediationRequests) {
      this.createGrantMediationMessage(mediationRecord)
    } else {
      await this.updateState(mediationRecord, MediationState.Requested)
    }
  }

  public async findByConnectionId(id: string): Promise<MediationRecord | null> {
    // TODO: Use findByQuery (connectionId as tag)
    const mediationRecords = await this.mediationRepository.getAll()

    for (const record of mediationRecords) {
      if (record.connectionId == id) {
        return record
      }
    }
    return null
  }

  public async getAll(): Promise<MediationRecord[]> {
    return await this.mediationRepository.getAll()
  }

  private async updateState(mediationRecord: MediationRecord, newState: MediationState) {
    const previousState = mediationRecord.state

    mediationRecord.state = newState

    await this.mediationRepository.update(mediationRecord)

    this.eventEmitter.emit<MediationStateChangedEvent>({
      type: RoutingEventTypes.MediationStateChanged,
      payload: {
        mediationRecord,
        previousState: previousState,
      },
    })
  }
}
