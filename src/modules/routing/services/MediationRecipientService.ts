import type { Verkey } from 'indy-sdk'
import { createOutboundMessage } from '../../../agent/helpers'
import { AgentConfig } from '../../../agent/AgentConfig'
import { MessageSender } from '../../../agent/MessageSender'
import {
  KeylistUpdateMessage,
  KeylistUpdate,
  KeylistUpdateAction,
  ForwardMessage,
  MediationGrantedMessage,
  MediationDeniedMessage,
} from '../messages'
import { Logger } from '../../../logger'
import { EventEmitter } from 'events'
import { Repository } from '../../../storage/Repository'
import { ConnectionInvitationMessage, ConnectionRecord } from '../../connections'
import { RoutingTable } from './MediationService'
import { InboundMessageContext } from '../../../agent/models/InboundMessageContext'
import { OutboundMessage } from '../../../types'
import { isIndyError } from '../../../utils/indyError'
import { DefaultMediationRecord, MediationProps, MediationRecord } from '..'

export enum MediationEventType {
  Granted = 'GRANTED',
  Denied = 'DENIED',
  KeylistUpdated = 'KEYLIST_UPDATED',
}

export class MediationRecipientService extends EventEmitter {
  // TODO: Review this, placeholder
  private logger: Logger
  private agentConfig: AgentConfig
  private mediatorRepository: Repository<MediationRecord>
  private messageSender: MessageSender
  private defaultMediatorId?: string

  // TODO: Review this, placeholder
  public constructor(
    agentConfig: AgentConfig,
    mediatorRepository: Repository<MediationRecord>,
    messageSender: MessageSender
  ) {
    super()
    this.agentConfig = agentConfig
    this.logger = agentConfig.logger
    this.mediatorRepository = mediatorRepository
    this.messageSender = messageSender
    this.provision()
  }
  private provision() {
    // Using agent config, establish connection with mediator.
    // Send mediation request.
    // Upon granting, set as default mediator.
  }

  // // TODO: Review this, placeholder
  // public async requestMediation(connectionRecord: ConnectionRecord): Promise<MediationRecipientRecord> {
  //   // Ensure that the connection is complete (check state) (validate, assert state)
  //   // Send mediation request message
  //   // create mediation recipient record and then return it.
  //   return new MediationRecipientRecord();
  // }

  // recieve and handle the "granted" response from the mediator
  public handleGranted() {
    this.emit(MediationEventType.Granted)
  }

  // recieve and handle the "denied" response from the mediator.
  public handleDenied() {
    this.emit(MediationEventType.Denied)
  }

  // Do we want to create a Mediator type?

  public async find(mediatorId: string): Promise<string | MediationRecord | null> {
    try {
      const connection = await this.mediationRecipientRepository.find(mediatorId)

      return connection
    } catch (error) {
      if (isIndyError(error, 'WalletItemNotFound')) {
        this.logger.debug(`Mediation recipient record with id '${mediatorId}' not found.`, {
          indyError: 'WalletItemNotFound',
        })
        return null
      } else {
        throw error
      }
    }
  }

  // Adding empty methods
  public getDefaultMediatorId() {
    // The default mediator id
  }
  public getDefaultMediator() {
    // The default mediator
  }

  public setDefaultMediator(mediatorId: string) {
    // The default mediator
  }

  public clearDefaultMediator() {
    // The default mediator
  }

  public prepareKeylistUpdateMessage(
    action: KeylistUpdateAction,
    recipientKey: Verkey,
    message?: KeylistUpdateMessage
  ) {
    // The default mediator
  }

  public storeKeylistUpdateResults() {
    // Method here
  }
  public prepareKeylistQuery(filter: Map<string, string>, paginateLimit = -1, paginateOffset = 0) {
    // Method here
  }

  public prepareRequest(connectionId: string, mediatorTerms: [string], recipientTerms: [string]) {
    // The default mediator
  }

  public reqeustGranted(mediationRecord: MediationRecord, grant: MediationGrantedMessage) {
    // The default mediator
  }

  public reqeustDenied(mediationRecord: MediationRecord, deny: MediationDeniedMessage) {
    // The default mediator
  }

  public getDefaultMediatorById(mediatorId: string) {
    // The default mediator
  }

  // Taken from Provisioning Service
  public async registerMediator(connectionRecord: ConnectionRecord): Promise<MediationRecord> {
    const mediationRecord = new MediationRecord({
      connectionRecord,
    })
    await this.mediationRecipientRepository.save(mediationRecord)
    return mediationRecord
  }

  //  Taken from ConsumerRoutingService
  public async sendAddKeylistUpdate(verkey: Verkey) {
    this.logger.debug(`Registering route for verkey '${verkey}' at mediator`)

    if (!this.agentConfig.inboundConnection) {
      this.logger.debug(`There is no mediator. Creating route for verkey '${verkey}' skipped.`)
    } else {
      const routingConnection = this.agentConfig.inboundConnection.connection

      const keylistUpdateMessage = new KeylistUpdateMessage({
        updates: [
          new KeylistUpdate({
            action: KeylistUpdateAction.add,
            recipientKey: verkey,
          }),
        ],
      })

      const outboundMessage = createOutboundMessage(routingConnection, keylistUpdateMessage)
      await this.messageSender.sendMessage(outboundMessage)
    }
  }
}

interface MediationRecipientProps {
  mediatorConnectionId: string
  mediatorPublicVerkey: Verkey
}
