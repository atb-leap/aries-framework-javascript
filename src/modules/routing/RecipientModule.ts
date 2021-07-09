import type { ConnectionRecord } from '../connections'
import type { ConnectionsModule } from '../connections/ConnectionsModule'
import type { MediationStateChangedEvent } from './RoutingEvents'
import type { MediationRecord } from './index'
import type { Verkey } from 'indy-sdk'

import { firstValueFrom, ReplaySubject } from 'rxjs'
import { filter, first, timeout } from 'rxjs/operators'
import { Lifecycle, scoped } from 'tsyringe'

import { AgentConfig } from '../../agent/AgentConfig'
import { Dispatcher } from '../../agent/Dispatcher'
import { EventEmitter } from '../../agent/EventEmitter'
import { MessageSender } from '../../agent/MessageSender'
import { createOutboundMessage } from '../../agent/helpers'
import { ReturnRouteTypes } from '../../decorators/transport/TransportDecorator'
import { ConnectionService } from '../connections/services'

import { RoutingEventTypes } from './RoutingEvents'
import { KeylistUpdateResponseHandler } from './handlers/KeylistUpdateResponseHandler'
import { MediationDenyHandler } from './handlers/MediationDenyHandler'
import { MediationGrantHandler } from './handlers/MediationGrantHandler'
import { BatchPickupMessage } from './messages/BatchPickupMessage'
import { MediationState } from './models/MediationState'
import { RecipientService } from './services/RecipientService'

@scoped(Lifecycle.ContainerScoped)
export class RecipientModule {
  private agentConfig: AgentConfig
  private recipientService: RecipientService
  private connectionService: ConnectionService
  private messageSender: MessageSender
  private eventEmitter: EventEmitter

  public constructor(
    dispatcher: Dispatcher,
    agentConfig: AgentConfig,
    recipientService: RecipientService,
    connectionService: ConnectionService,
    messageSender: MessageSender,
    eventEmitter: EventEmitter
  ) {
    this.agentConfig = agentConfig
    this.connectionService = connectionService
    this.recipientService = recipientService
    this.messageSender = messageSender
    this.eventEmitter = eventEmitter
    this.registerHandlers(dispatcher)
  }

  public async init(connections: ConnectionsModule) {
    this.recipientService.init()
    if (this.agentConfig.mediatorConnectionsInvite) {
      /* --------------------------------
        | Connect to mediator through provided invitation
        | and send mediation request and set as default mediator.
        */
      // Check if inviation was provided in config
      // Assumption: processInvitation is a URL-encoded invitation
      let connectionRecord = await connections.receiveInvitationFromUrl(this.agentConfig.mediatorConnectionsInvite, {
        autoAcceptConnection: true,
        alias: 'InitedMediator', // TODO come up with a better name for this
      })
      connectionRecord = await connections.returnWhenIsConnected(connectionRecord.id)
      const mediationRecord = await this.requestAndAwaitGrant(connectionRecord, 60000) // TODO: put timeout as a config parameter
      await this.recipientService.setDefaultMediator(mediationRecord)
    }
    if (this.agentConfig.defaultMediatorId) {
      /*
        | Set the default mediator by ID
        */
      const mediatorRecord = await this.recipientService.findById(this.agentConfig.defaultMediatorId)
      if (mediatorRecord) {
        this.recipientService.setDefaultMediator(mediatorRecord)
      } else {
        this.agentConfig.logger.error('Mediator record not found from config')
        // TODO: Handle error properly - not found condition
      }
    }
    if (this.agentConfig.clearDefaultMediator) {
      /*
        | Clear the stored default mediator
        */
      this.recipientService.clearDefaultMediator()
    }
  }

  public async discoverMediation() {
    return this.recipientService.discoverMediation()
  }
  public async downloadMessages(mediatorConnection: ConnectionRecord) {
    const batchPickupMessage = new BatchPickupMessage({ batchSize: 10 })
    const outboundMessage = createOutboundMessage(mediatorConnection, batchPickupMessage)
    outboundMessage.payload.setReturnRouting(ReturnRouteTypes.all)
    await this.messageSender.sendMessage(outboundMessage)
  }

  public async setDefaultMediator(mediatorRecord: MediationRecord) {
    return await this.recipientService.setDefaultMediator(mediatorRecord)
  }

  public async requestMediation(connection: ConnectionRecord): Promise<MediationRecord> {
    const [record, message] = await this.recipientService.createRequest(connection)
    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outboundMessage)
    return record
  }

  public async notifyKeylistUpdate(connection: ConnectionRecord, verkey: Verkey) {
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

  public async findByConnectionId(connectionId: string) {
    return await this.recipientService.findByConnectionId(connectionId)
  }

  public async getMediators() {
    return await this.recipientService.getMediators()
  }

  public async getMediatorConnections() {
    const allMediators = await this.getMediators()
    const mediatorConnectionIds = allMediators ? allMediators.map((mediator) => mediator.connectionId) : []
    const allConnections = await this.connectionService.getAll()
    return allConnections && mediatorConnectionIds
      ? allConnections.filter((connection) => mediatorConnectionIds.includes(connection.id))
      : []
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

  /**
   * create mediation record and request.
   * register listener for mediation grant, before sending request to remove race condition
   * resolve record when mediator grants request. time out otherwise
   * send request message to mediator
   * return promise with listener
   **/
  public async requestAndAwaitGrant(connection: ConnectionRecord, timeoutMs = 10000): Promise<MediationRecord> {
    const [mediationRecord, message] = await this.recipientService.createRequest(connection)

    // return message on request response
    message.setReturnRouting(ReturnRouteTypes.all)

    // Create observable for event
    const observable = this.eventEmitter.observable<MediationStateChangedEvent>(RoutingEventTypes.MediationStateChanged)
    const subject = new ReplaySubject<MediationStateChangedEvent>(1)

    // Apply required filters to observable stream subscribe to replay subject
    observable
      .pipe(
        // Only take event for current mediation record
        filter((event) => event.payload.mediationRecord.id === mediationRecord.id),
        // Only take event for previous state requested, current state granted
        filter((event) => event.payload.previousState === MediationState.Requested),
        filter((event) => event.payload.mediationRecord.state === MediationState.Requested),
        // Only wait for first event that matches the criteria
        first(),
        // Do not wait for longer than specified timeout
        timeout(timeoutMs)
      )
      .subscribe(subject)

    // Send mediation request message
    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outboundMessage)

    const event = await firstValueFrom(subject)
    return event.payload.mediationRecord
  }

  // Register handlers for the several messages for the mediator.
  private registerHandlers(dispatcher: Dispatcher) {
    dispatcher.registerHandler(new KeylistUpdateResponseHandler(this.recipientService))
    dispatcher.registerHandler(new MediationGrantHandler(this.recipientService))
    dispatcher.registerHandler(new MediationDenyHandler(this.recipientService))
    //dispatcher.registerHandler(new KeylistListHandler(this.recipientService)) // TODO: write this
  }
}
