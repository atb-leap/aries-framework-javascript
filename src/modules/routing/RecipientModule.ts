import type { ConnectionRecord } from '../connections'
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

  public async initialize() {
    const { defaultMediatorId, clearDefaultMediator } = this.agentConfig
    // Set default mediator by id
    if (this.agentConfig.defaultMediatorId) {
      const mediatorRecord = await this.recipientService.findById(this.agentConfig.defaultMediatorId)
      if (mediatorRecord) {
        await this.recipientService.setDefaultMediator(mediatorRecord)
      } else {
        this.agentConfig.logger.error(`Mediator record with id ${defaultMediatorId} not found from config`)
        // TODO: Handle error properly - not found condition
      }
    }
    // Clear the stored default mediator
    else if (clearDefaultMediator) {
      await this.recipientService.clearDefaultMediator()
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
    return this.recipientService.setDefaultMediator(mediatorRecord)
  }

  public async requestMediation(connection: ConnectionRecord): Promise<MediationRecord> {
    const { mediationRecord, message } = await this.recipientService.createRequest(connection)
    const outboundMessage = createOutboundMessage(connection, message)
    await this.messageSender.sendMessage(outboundMessage)
    return mediationRecord
  }

  public async notifyKeylistUpdate(connection: ConnectionRecord, verkey: Verkey) {
    const message = this.recipientService.createKeylistUpdateMessage(verkey)
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

  public async findDefaultMediator(): Promise<MediationRecord | null> {
    return this.recipientService.findDefaultMediator()
  }

  public async findDefaultMediatorConnection(): Promise<ConnectionRecord | null> {
    const mediatorRecord = await this.findDefaultMediator()

    if (mediatorRecord) {
      return this.connectionService.getById(mediatorRecord.connectionId)
    }

    return null
  }

  public async requestAndAwaitGrant(connection: ConnectionRecord, timeoutMs = 10000): Promise<MediationRecord> {
    const [mediationRecord, message] = await this.recipientService.createRequest(connection)

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
        filter((event) => event.payload.mediationRecord.state === MediationState.Granted),
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
