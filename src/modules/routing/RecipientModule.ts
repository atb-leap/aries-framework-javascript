import { AgentConfig } from '../../agent/AgentConfig'
import { assertConnection, MessagePickupService, RecipientService } from './services'
import { KeylistUpdateResponseHandler } from './handlers/KeylistUpdateResponseHandler'
import { ReturnRouteTypes } from '../../decorators/transport/TransportDecorator'
import { MediationGrantHandler } from './handlers/MediationGrantHandler'
import { MediationDenyHandler } from './handlers/MediationDenyHandler'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import {
  ConnectionService,
  ConnectionState,
  ConnectionInvitationMessage,
  ConnectionResponseMessage,
} from '../connections'
import { BatchMessage, BatchPickupMessage } from './messages'
import type { Verkey } from 'indy-sdk'
import { Dispatcher } from '../../agent/Dispatcher'
import { ConnectionRecord } from '../connections'
import agentConfig from '../../../samples/config'
import { EventEmitter } from 'events'
import { MediationRecord } from '.'

export class RecipientModule {
  private agentConfig: AgentConfig
  private recipientService: RecipientService
  private messagePickupService: MessagePickupService
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private eventEmitter: EventEmitter

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    recipientService: RecipientService,
    messagePickupService: MessagePickupService,
    connectionService: ConnectionService,
    messageSender: MessageSender,
    eventEmitter: EventEmitter
  ) {
    this.agentConfig = agentConfig
    this.messagePickupService = messagePickupService
    this.connectionService = connectionService
    this.recipientService = recipientService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.registerHandlers(dispatcher)
  }

  /**
   * Get the event emitter for the mediation service. Will emit events
   * when related messages are received.
   *
   * @returns event emitter for mediation recipient related received messages
   */
  public get events(): EventEmitter {
    return this.recipientService
  }

  // public async provision(mediatorConfiguration: MediatorConfiguration) {
  //   let provisioningRecord = await this.recipientService.find()

  //   if (!provisioningRecord) {
  //     this.logger.info('No provision record found. Creating connection with mediator.')
  //     const { verkey, invitationUrl, alias = 'Mediator' } = mediatorConfiguration
  //     const mediatorInvitation = await ConnectionInvitationMessage.fromUrl(invitationUrl)

  //     const connectionRecord = await this.connectionService.processInvitation(mediatorInvitation, { alias })
  //     const { message: connectionRequest } = await this.connectionService.createRequest(connectionRecord.id)

  //     const outboundMessage = createOutboundMessage(connectionRecord, connectionRequest, connectionRecord.invitation)
  //     outboundMessage.payload.setReturnRouting(ReturnRouteTypes.all)

  //     await this.messageSender.sendMessage(outboundMessage)
  //     await this.connectionService.returnWhenIsConnected(connectionRecord.id)

  //     const provisioningProps = {
  //       mediatorConnectionId: connectionRecord.id,
  //       mediatorPublicVerkey: verkey,
  //     }
  //     provisioningRecord = await this.provisioningService.create(provisioningProps)
  //     this.logger.debug('Provisioning record has been saved.')
  //   }

  //   this.logger.debug('Provisioning record:', provisioningRecord)

  //   const agentConnectionAtMediator = await this.connectionService.find(provisioningRecord.mediatorConnectionId)

  //   if (!agentConnectionAtMediator) {
  //     throw new Error('Connection not found!')
  //   }
  //   this.logger.debug('agentConnectionAtMediator', agentConnectionAtMediator)

  //   agentConnectionAtMediator.assertState(ConnectionState.Complete)

  //   this.agentConfig.establishInbound({
  //     verkey: provisioningRecord.mediatorPublicVerkey,
  //     connection: agentConnectionAtMediator,
  //   })

  //   return agentConnectionAtMediator
  // }

  public async downloadMessages(mediatorConnection?: ConnectionRecord) {
    const mediationRecord: MediationRecord | undefined = await this.recipientService.getDefaultMediator()
    if (mediationRecord) {
      let connection: ConnectionRecord = await this.connectionService.getById(mediationRecord.connectionId)
      connection = assertConnection(connection, 'connection not found for default mediator')
      const batchPickupMessage = new BatchPickupMessage({ batchSize: 10 })
      const outboundMessage = createOutboundMessage(connection, batchPickupMessage)
      outboundMessage.payload.setReturnRouting(ReturnRouteTypes.all)
      await this.messageSender.sendMessage(outboundMessage)
    }
  }

  public async requestMediation(connection: ConnectionRecord) {
    const message = await this.recipientService.createRequest(connection)
    const outboundMessage = createOutboundMessage(connection, message)
    const response = await this.messageSender.sendMessage(outboundMessage)
    return response
  }

  public async notifyKeylistUpdate(connection: ConnectionRecord, verkey?: Verkey) {
    const message = await this.recipientService.createKeylistUpdateMessage(verkey)
    const outboundMessage = createOutboundMessage(connection, message)
    const response = await this.messageSender.sendMessage(outboundMessage)
    return response
  }

  public async requestKeylist(connection: ConnectionRecord) {
    const message = this.recipientService.createKeylistQuery()
    const outboundMessage = createOutboundMessage(connection, message)
    const response = await this.messageSender.sendMessage(outboundMessage)
    return response
  }

  public async getMediators() {
    return await this.recipientService.getMediators()
  }

  public async getDefaultMediatorId() {
    return await this.recipientService.getDefaultMediatorId()
  }

  public async getDefaultMediator(): Promise<MediationRecord | undefined> {
    return await this.recipientService.getDefaultMediator()
  }

  public async getDefaultMediatorConnection(): Promise<ConnectionRecord | undefined> {
    const mediatorRecord = await this.getDefaultMediator()
    if (mediatorRecord) {
      return await this.connectionService.getById(mediatorRecord.connectionId)
    }
    return undefined
  }

  public async keylistUpdate() {
    throw new Error('Method not implemented.')
  }

  public async keylistquery() {
    throw new Error('Method not implemented.')
  }

  // Register handlers for the several messages for the mediator.
  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new KeylistUpdateResponseHandler(this.recipientService))
    dispatcher.registerHandler(new MediationGrantHandler(this.recipientService))
    dispatcher.registerHandler(new MediationDenyHandler(this.recipientService))
    dispatcher.registerHandler(new KeylistUpdateResponseHandler(this.recipientService))
  }
}
